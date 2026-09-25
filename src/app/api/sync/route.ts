// Roksal Field - API: Sinhronizacija z mobilno aplikacijo
// ---------------------------------------------------------------------------
// R120 — security pass:
//
//   1. PRINCIPAL: API ključ (`rkm_…`) je servisni principal MOBILE_SYNC z
//      ožjimi pravicami (glej src/lib/access.ts) — NI več manager. Uporabniška
//      seja ima tu iste pravice kot sicer (resource authorization velja).
//
//   2. GET skoping (Problem 2): branje projektov uporablja
//      `projectWhereForPrincipal()` — monter vidi svoje, vodstvo/servis vidi
//      sync zrcalo podjetja. Servisni pogled (`{}`) je NAMERNA pogodba
//      MOBILE_SYNC (mobilni klient podjetja), dokumentirana v access.ts.
//
//   3. STATUSNI STROJ (Problem 3): tudi NOV projekt ne sprejme slepo statusa
//      iz mobilnega klienta — veljaven je samo začetni status (NACRTOVANO);
//      karkoli drugega se korigira na NACRTOVANO in se javi v `results`
//      (brez tihe degradacije). Pri obstoječem projektu velja
//      `transitionAllowed()` (prej S+9).
//
//   4. AUDIT: vsak sync vpis (ustvarjen/spremenjen projekt, prehod statusa) se
//      zapiše v AuditLog v ISTI transakciji kot poslovni dogodek (princip iz
//      measurement confirm — meritev+audit atomska enota).
//
//   5. ODPUSTLJIVOST SERIJE: vsak mobilni projekt se obdeluje v svojem
//      try/catch — en pokvarjen zapis ne podre cele serije; stanje vsakega
//      zapisa je razvidno iz `results`.
//
// R148 (issue #5 §36 — Mobile sync conflict model):
//
//   • DEVICE ID: `X-Device-Id` header (stabilen klientov UUID, 8–128 znakov,
//     varni znaki) — lenobni upsert v SyncDevice (firstSeenAt/lastSeenAt,
//     apiKeyId = ključ, ki je napravo uvedel). Neveljaven → 400 (fail-closed).
//   • CLIENT MUTATION ID: vsak element sme nositi `mutationId` — echo v
//     results + revizija (klient lahko poveže odgovor s svojo čakajočo vrsto).
//   • ORDERING + CURSOR: monotoni `Project.syncRevision` (rasel SAMO ob sync
//     zapisih); GET ?sinceRevision=N → delta (syncRevision > N, ASC, limit
//     + hasMore + nextCursor). Časovni žigi NIKOLI za vrstni red.
//   • CONFLICT DETECTION/RESOLUTION: element sme nositi `baseRevision` +
//     `baseUpdatedAt` (stanje, ki ga je klient videl). Odstopanje kateregakoli
//     PODANEGA vhoda → konflikt: zapis se NE uporabi, rezultat je
//     { ok:false, action:'conflict', retryable:true, serverState } — klient
//     osveži bazo in ponovi. Star klient brez obeh → uporabljeno z IZRECNIM
//     warningom (nadgrajljivost, dokumentirano — ni tihe LWW).
//   • TOMBSTONES: DELETE /api/sync ustvari grobnico (preživi brisanje
//     projekta); ponovni sync istega mobileProjectId → iskren `tombstone`
//     rezultat (ni dvojnika); GET vrne grobnice za čiščenje in izključi
//     grobnice projekte iz zrcala.
//   • IDEMPOTENCA SERIJE: `Idempotency-Key` header (R128 vzorec) — replay
//     vrne originalni odgovor (exactly-once za celotno serijo; snapshot je
//     best-effort po uspehu — dokumentirano okno, vzorec ar-snapshots).
//   • HTTP 200 jasno pove, kaj je bilo sprejeto: per-item
//     { ok, action: created|updated|conflict|tombstone, revision, retryable }.
//
// Ključi se ustvarijo z `bun run apikey`, v bazi je samo pepper+SHA-256 hash,
// posamezen ključ se da preklicati (revokedAt).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import { assertProjectAccess, projectWhereForPrincipal, apiKeyScopeDenied } from '@/lib/access'
import {
  transitionAllowed,
  initialStatusFor,
  InvalidTransitionError,
  isProjectStatus,
} from '@/lib/project-state'
import { auditInTx } from '@/lib/audit'
import {
  beginIdempotency,
  storeResponse,
  idempotencyConflictResponse,
  idempotencyReplayResponse,
  isValidIdempotencyKey,
} from '@/lib/idempotency'
import {
  normalizeDeviceId,
  detectSyncConflict,
  nextSyncRevision,
  syncRetryable,
  SYNC_GET_DEFAULT_LIMIT,
  SYNC_GET_MAX_LIMIT,
  SYNC_TOMBSTONES_MAX,
} from '@/lib/sync-conflicts'

/**
 * Shema mobilnega payload-a. Namerno SPROŠČENA (vse ključne poslovne polja
 * opcijska z privzetki) — mobilni klient je starejša aplikacija in ne sme
 * obrati, a neznana/napačna tipizirana polja se zavržejo (zod strip).
 * R148 (§36): + baseRevision/baseUpdatedAt (konflikti) + mutationId (echo).
 */
const mobileProjectSchema = z.object({
  id: z.string().min(1).max(128),
  customerName: z.string().max(300).optional(),
  customerEmail: z.string().max(300).optional(),
  phone: z.string().max(60).optional(),
  address: z.string().max(500).optional(),
  railingStyle: z.string().max(120).optional(),
  status: z.string().max(40).optional(),
  extraNotes: z.string().max(4000).optional(),
  latitude: z.number().finite().optional(),
  longitude: z.number().finite().optional(),
  lengthCm: z.number().finite().optional(),
  heightCm: z.number().finite().optional(),
  widthCm: z.number().finite().optional(),
  mountType: z.string().max(80).optional(),
  colorHex: z.string().max(20).optional(),
  colorName: z.string().max(80).optional(),
  originalImagePath: z.string().max(1000).optional(),
  geminiEstimate: z.string().max(1000).optional(),
  // R148 (§36) — sync protokol polja (opcijska: stari klient obrati naprej).
  baseRevision: z.number().int().min(0).optional(),
  baseUpdatedAt: z.string().max(64).optional(),
  mutationId: z.string().max(128).optional(),
})

type MobileProject = z.infer<typeof mobileProjectSchema>

type SyncAction = 'created' | 'updated' | 'conflict' | 'tombstone'

type SyncResult = {
  mobileProjectId: string
  mutationId: string | null
  ok: boolean
  action: SyncAction
  /** Strežniška revizija PO operaciji (pri konfliktu: trenutna strežniška). */
  revision: number | null
  retryable: boolean
  warnings?: string[]
  projectId?: string
  error?: string
  /** Pri konfliktu: trenutno strežniško stanje (klient osveži bazo iz njega). */
  serverState?: { syncRevision: number; updatedAt: string; status: string }
}

function deviceIdFrom(request: Request): { error: string } | { deviceId: string } {
  return normalizeDeviceId(request.headers.get('x-device-id'))
}

/** Lenobni upsert naprave (§36 device ID) — lastSeenAt se vsakokrat osveži. */
async function upsertSyncDevice(
  deviceId: string,
  auth: NonNullable<Awaited<ReturnType<typeof authenticate>>>,
): Promise<{ firstSeen: boolean }> {
  const existing = await db.syncDevice.findUnique({ where: { deviceId } })
  if (existing) {
    await db.syncDevice.update({
      where: { deviceId },
      data: {
        lastSeenAt: new Date(),
        ...(auth.kind === 'apikey' && !existing.apiKeyId ? { apiKeyId: auth.id } : {}),
      },
    })
    return { firstSeen: false }
  }
  await db.syncDevice.create({
    data: {
      deviceId,
      ...(auth.kind === 'apikey' ? { apiKeyId: auth.id } : {}),
    },
  })
  return { firstSeen: true }
}

// POST - Sprejme podatke iz mobilne aplikacije in ustvari/posodobi projekte
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Neveljaven JSON.' }, { status: 400 })
  }

  const auth = await authenticate(request)
  if (!auth) {
    return NextResponse.json(
      { error: 'Neveljavna avtentikacija', detail: 'Pričakujem `Authorization: Bearer rkm_…` ali veljavno sejo.' },
      { status: 401 },
    )
  }
  // R126 (issue #5 §3): API ključ mora nositi scope `projects:write` —
  // ključ samo za branje (projects:read) tu pade s 403, ne s tiho preskočenim vpisom.
  if (apiKeyScopeDenied(auth, 'projects:write')) {
    return forbidden('Ključ nima scope-a projects:write — vpis prek sync ni dovoljen.')
  }

  // R148 (§36): device ID — obvezen NISO (stari klient obrati naprej), a
  // če ga klient pošlje in je neveljaven, je to 400 (ne tiho ignoriranje).
  let deviceId: string | null = null
  const deviceHeader = request.headers.get('x-device-id')
  if (deviceHeader !== null) {
    const norm = normalizeDeviceId(deviceHeader)
    if ('error' in norm) {
      return NextResponse.json({ error: norm.error }, { status: 400 })
    }
    deviceId = norm.deviceId
  }

  // R148 (§36): idempotenca celotne serije (R128 vzorec — replay originala).
  const idemHeader = request.headers.get('Idempotency-Key')
  const idemKey = idemHeader !== null && isValidIdempotencyKey(idemHeader) ? idemHeader : null
  if (idemHeader !== null && !idemKey) {
    return NextResponse.json({ error: 'Neveljaven Idempotency-Key' }, { status: 400 })
  }
  if (idemKey) {
    const profileId = auth.kind === 'user' ? auth.session.sub : null
    const idem = await beginIdempotency(idemKey, 'sync', profileId)
    if (idem.kind === 'replay') return idempotencyReplayResponse(idem)
    if (idem.kind === 'conflict') return idempotencyConflictResponse()
  }

  // R139 (§22): correlation ID za korelacijo serije sync z Vercel logi.
  const correlationId = correlationFromRequest(request)

  // §36 device upsert — po validaciji, pred obdelavo serije.
  let deviceFirstSeen = false
  if (deviceId) {
    try {
      deviceFirstSeen = (await upsertSyncDevice(deviceId, auth)).firstSeen
    } catch (error) {
      logWithCorrelation('sync.device.upsert', correlationId, error)
      // Napaka DB pri napravi NE utaji serije — sync se nadaljuje brez
      // zapisa naprave (naprava je diagnostika, ne poslovni pogoj).
    }
  }

  const rawList = Array.isArray(body) ? body : [body]
  const results: SyncResult[] = []
  const syncedProjects: Array<Record<string, unknown>> = []

  for (const raw of rawList) {
    const parsed = mobileProjectSchema.safeParse(raw)
    if (!parsed.success) {
      const id =
        typeof (raw as { id?: unknown })?.id === 'string'
          ? (raw as { id: string }).id
          : 'neznan'
      const mutationId = typeof (raw as { mutationId?: unknown })?.mutationId === 'string'
        ? ((raw as { mutationId: string }).mutationId)
        : null
      results.push({
        mobileProjectId: id,
        mutationId,
        ok: false,
        action: 'error' as never,
        revision: null,
        retryable: false,
        error: `Neveljaven payload: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      })
      continue
    }
    const mobileProject = parsed.data

    try {
      // §36 TOMBSTONE: izbrisan mobilni projekt se NE ponovno ustvari —
      // iskren rezultat (klient lokalno pobriše), ne dvojnika.
      const tombstone = await db.syncTombstone.findUnique({
        where: { mobileProjectId: mobileProject.id },
      })
      if (tombstone) {
        results.push({
          mobileProjectId: mobileProject.id,
          mutationId: mobileProject.mutationId ?? null,
          ok: false,
          action: 'tombstone',
          revision: null,
          retryable: syncRetryable('tombstone'),
          error: 'Mobilni projekt je izbrisan na strežniku (grobnica) — lokalni zapis pobrišite.',
        })
        continue
      }

      const outcome = await syncOneProject(auth, mobileProject, request)
      results.push(outcome.result)
      if (outcome.action === 'created' || outcome.action === 'updated') {
        syncedProjects.push(outcome.project as Record<string, unknown>)
      }
    } catch (error) {
      const message =
        error instanceof InvalidTransitionError
          ? error.message
          : error instanceof Error && error.message.includes('Dostop do projekta')
            ? error.message
            : 'Napaka pri sinhronizaciji zapisa'
      logWithCorrelation('sync.post.item', correlationId, error)
      results.push({
        mobileProjectId: mobileProject.id,
        mutationId: mobileProject.mutationId ?? null,
        ok: false,
        action: 'error' as never,
        revision: null,
        retryable: syncRetryable('error', message),
        error: message,
      })
    }
  }

  const okCount = results.filter((r) => r.ok).length
  const responseBody = {
    message: `Sinhroniziranih ${okCount} projektov (${results.length - okCount} napak)`,
    projects: syncedProjects,
    results,
    ...(deviceId ? { device: { deviceId, firstSeen: deviceFirstSeen } } : {}),
    timestamp: new Date().toISOString(),
  }
  // R128 vzorec (best-effort snapshot — dokumentirano okno, vzorec ar-snapshots).
  if (idemKey) {
    await storeResponse(idemKey, 200, JSON.stringify(responseBody))
  }
  return NextResponse.json(responseBody)
}

type SyncOutcome =
  | { action: 'created'; projectId: string; project: unknown; result: SyncResult }
  | { action: 'updated'; projectId: string; project: unknown; result: SyncResult }
  | { action: 'conflict'; projectId: string | null; result: SyncResult }

/** Obdelaj EN mobilni projekt (update ali create) z auditom v transakciji. */
async function syncOneProject(
  auth: NonNullable<Awaited<ReturnType<typeof authenticate>>>,
  mobileProject: MobileProject,
  request: Request
): Promise<SyncOutcome> {
  const warnings: string[] = []
  const mutationId = mobileProject.mutationId ?? null

  // R121: mobileProjectId je UNIQUE — dvojnikov ni niti ob vzporednem/replay
  // syncu. findUnique (ne findFirst) je zdaj kanoničen način iskanja.
  const existingProject = await db.project.findUnique({
    where: { mobileProjectId: mobileProject.id },
  })

  if (existingProject) {
    return applySyncUpdate(auth, existingProject, mobileProject, request, warnings)
  }

  // ── NOV PROJEKT ──────────────────────────────────────────────────────────
  // POPRAVEK podvajanja: `OR: [{ email: null }, { telefon: null }]` se je
  // ujemal s PRVO stranko, ki nima e-pošte oziroma telefona, zato je vsaka
  // sinhronizacija brez teh podatkov našla napačno obstoječo stranko — ali pa
  // ustvarila novo in podvojila pravo. Pogoja zdaj dodamo samo, kadar imamo
  // dejansko vrednost, in iščemo po obeh ločeno (e-pošta je močnejši ključ).
  const email = (mobileProject.customerEmail ?? '').trim().toLowerCase() || null
  const phone = (mobileProject.phone ?? '').trim() || null

  let customer = email
    ? await db.customer.findFirst({ where: { email } })
    : null
  if (!customer && phone) {
    customer = await db.customer.findFirst({ where: { telefon: phone } })
  }
  if (!customer && mobileProject.id) {
    // Isti mobilni projekt že ima stranko — ne ustvarjaj dvojnikov.
    customer = await db.customer.findFirst({
      where: { projects: { some: { mobileProjectId: mobileProject.id } } },
    })
  }

  if (!customer) {
    customer = await db.customer.create({
      data: {
        ime: mobileProject.customerName || 'Neznana stranka',
        naslov: mobileProject.address || '',
        telefon: phone,
        email,
      },
    })
  }

  // STATUSNI STROJ (R120 — Problem 3): nov projekt se rodi samo na vhodu
  // cikla. Zahtevan status, ki NI dovoljen začetni (npr. MONTIRANO), se
  // korigira na NACRTOVANO in korekcija se JAVI v warnings.
  const resolved = initialStatusFor(mobileProject.status)
  if (resolved.clampedFrom !== null) {
    warnings.push(
      `Zahtevan začetni status "${resolved.clampedFrom}" ni dovoljen — projekt je ustvarjen kot ${resolved.status} (statusni stroj).`,
    )
  }

  // §36: nov projekt nosi mutationId klienta v reviziji + prvo revizijo 1.
  try {
    const newProject = await db.$transaction(async (tx) => {
    const row = await tx.project.create({
      data: {
        nazivProjekta: `${mobileProject.customerName || 'Neznana stranka'} - ${mobileProject.railingStyle || 'ograja'}`,
        customerId: customer!.id,
        status: resolved.status,
        opombe: mobileProject.extraNotes || null,
        latitude: mobileProject.latitude ?? null,
        longitude: mobileProject.longitude ?? null,
        mobileProjectId: mobileProject.id,
        originalImagePath: mobileProject.originalImagePath || null,
        geminiEstimate: mobileProject.geminiEstimate || null,
        syncRevision: 1,
        projectData: JSON.stringify({
          lengthCm: mobileProject.lengthCm,
          heightCm: mobileProject.heightCm,
          widthCm: mobileProject.widthCm,
          mountType: mobileProject.mountType,
          colorHex: mobileProject.colorHex,
          colorName: mobileProject.colorName,
          railingStyle: mobileProject.railingStyle,
        }),
      },
      include: {
        customer: true,
      },
    })
    await auditInTx(tx, {
      request,
      userId: null,
      akcija: 'SYNC_PROJECT_CREATED',
      projectId: row.id,
      oldValue: null,
      newValue: {
        status: row.status,
        mobileProjectId: mobileProject.id,
        ...(mutationId ? { mutationId } : {}),
        syncRevision: row.syncRevision,
        stranka: customer!.ime,
        servis: auth.kind === 'apikey' ? auth.name : 'uporabniška seja',
        korigiranStatus: resolved.clampedFrom,
      },
    })
    return row
    })

    return {
      action: 'created',
      projectId: newProject.id,
      project: newProject,
      result: {
        mobileProjectId: mobileProject.id,
        mutationId,
        ok: true,
        action: 'created',
        revision: newProject.syncRevision,
        retryable: syncRetryable('created'),
        warnings,
        projectId: newProject.id,
      },
    }
  } catch (error) {
    // R121 — IDEMPOTENTEN REPLAY: mobileProjectId je UNIQUE. Če je med
    // pripravo te zahteve vzporedni sync že ustvaril projekt z istim id-jem
    // (P2002), to NI napaka klienta — obstoječi projekt se posodobi (isti
    // rezultat kot počasnejši zahtevek). Dvojnikov ni niti pod vzporednostjo.
    if (isUniqueViolation(error)) {
      const raced = await db.project.findUnique({
        where: { mobileProjectId: mobileProject.id },
      })
      if (raced) {
        warnings.push(
          'Vzporedni sync z istim mobileProjectId — obstoječi projekt posodobljen (unique constraint).',
        )
        return applySyncUpdate(auth, raced, mobileProject, request, warnings)
      }
    }
    throw error
  }
}

/**
 * Posodobitev obstoječega projekta (statusni stroj + konflikti + audit v
 * transakciji). Izvlečena iz syncOneProject — uporablja jo tudi P2002 repli.
 * R148 (§36): konflikti prek baseRevision/baseUpdatedAt — zapis se uporabi
 * SAMO če je baza kliena še vedno strežniška; sicer iskren konflikt.
 */
async function applySyncUpdate(
  auth: NonNullable<Awaited<ReturnType<typeof authenticate>>>,
  existingProject: { id: string; status: string; dealLocked: boolean; opombe: string | null; latitude: number | null; longitude: number | null; monterId: string | null; vodjaId: string | null; syncRevision: number; updatedAt: Date },
  mobileProject: MobileProject,
  request: Request,
  warnings: string[]
): Promise<SyncOutcome> {
  // Resource authorization velja tudi tu (R120): servis sme sync polja
  // spreminjati (razen deal-lock), monter sme samo na svojih projektih.
  assertProjectAccess(auth, existingProject, 'update')

  // ── §36 CONFLICT DETECTION (PRED statusnim strojem in mutacijo) ──────────
  const verdict = detectSyncConflict({
    baseRevision: mobileProject.baseRevision,
    baseUpdatedAt: mobileProject.baseUpdatedAt,
    serverRevision: existingProject.syncRevision,
    serverUpdatedAt: existingProject.updatedAt,
  })
  if (verdict.kind === 'conflict') {
    return {
      action: 'conflict',
      projectId: existingProject.id,
      result: {
        mobileProjectId: mobileProject.id,
        mutationId: mobileProject.mutationId ?? null,
        ok: false,
        action: 'conflict',
        revision: existingProject.syncRevision,
        retryable: syncRetryable('conflict'),
        error: `Konflikt sinhronizacije: ${verdict.detail} Nič ni bilo spremenjeno — osvežite bazo (GET ?sinceRevision=…) in ponovite.`,
        serverState: {
          syncRevision: existingProject.syncRevision,
          updatedAt: existingProject.updatedAt.toISOString(),
          status: existingProject.status,
        },
      },
    }
  }
  if (verdict.kind === 'legacy') {
    warnings.push(
      'Sync brez baseRevision/baseUpdatedAt (star klient) — zapis uporabljen brez preverbe konflikta.',
    )
  }

  const proposed = mobileProject.status
  let nextStatus = existingProject.status
  if (proposed && proposed !== existingProject.status) {
    if (isProjectStatus(proposed) && transitionAllowed({ from: existingProject.status as never, to: proposed, principal: auth, dealLocked: existingProject.dealLocked })) {
      nextStatus = proposed
    } else {
      warnings.push(
        `Status "${proposed}" zavrnjen (statusni stroj) — ostaja "${existingProject.status}".`,
      )
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.project.update({
      where: { id: existingProject.id },
      data: {
        status: nextStatus as never,
        opombe: mobileProject.extraNotes || existingProject.opombe,
        latitude: mobileProject.latitude ?? existingProject.latitude,
        longitude: mobileProject.longitude ?? existingProject.longitude,
        updatedAt: new Date(),
        // §36: revizija raste MONOTONO ob vsakem sync zapisu.
        syncRevision: nextSyncRevision(existingProject.syncRevision),
      },
      include: {
        customer: true,
        monter: { select: { id: true, ime: true } },
      },
    })
    await auditInTx(tx, {
      request,
      userId: null,
      akcija: 'SYNC_PROJECT_UPDATED',
      projectId: row.id,
      oldValue: {
        status: existingProject.status,
        opombe: existingProject.opombe,
        latitude: existingProject.latitude,
        longitude: existingProject.longitude,
        syncRevision: existingProject.syncRevision,
      },
      newValue: {
        status: nextStatus,
        opombe: row.opombe,
        latitude: row.latitude,
        longitude: row.longitude,
        syncRevision: row.syncRevision,
        ...(mobileProject.mutationId ? { mutationId: mobileProject.mutationId } : {}),
        servis: auth.kind === 'apikey' ? auth.name : 'uporabniška seja',
        zavrnjeniStatus: warnings.length > 0 ? mobileProject.status : undefined,
      },
    })
    return row
  })

  return {
    action: 'updated',
    projectId: updated.id,
    project: updated,
    result: {
      mobileProjectId: mobileProject.id,
      mutationId: mobileProject.mutationId ?? null,
      ok: true,
      action: 'updated',
      revision: updated.syncRevision,
      retryable: syncRetryable('updated'),
      warnings,
      projectId: updated.id,
    },
  }
}

/** Prisma P2002 = kršitev unique constrainta. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  )
}

// GET - Vrne projekte za sinhronizacijo v mobilno aplikacijo
// R148 (§36): delta sync — ?sinceRevision=N (syncRevision > N), limit +
// hasMore + nextCursor, grobnice za čiščenje, syncRevision v vsaki vrstici.
export async function GET(request: Request) {
  // Tudi branje projektov za sinhronizacijo je zaščiteno: seznam razkrije stranke in naslove.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  // R126 (issue #5 §3): API ključ mora nositi scope `projects:read`.
  if (apiKeyScopeDenied(auth, 'projects:read')) {
    return forbidden('Ključ nima scope-a projects:read — branje sync zrcala ni dovoljeno.')
  }
  const correlationId = correlationFromRequest(request)
  try {
    const { searchParams } = new URL(request.url)
    const lastSync = searchParams.get('lastSync')

    // §36 cursor: ne-negativno celo število; neveljaven → 400 (ne tiho 0).
    const sinceRaw = searchParams.get('sinceRevision')
    let sinceRevision: number | null = null
    if (sinceRaw !== null) {
      const parsed = Number.parseInt(sinceRaw, 10)
      if (!Number.isInteger(parsed) || parsed < 0) {
        return NextResponse.json({ error: 'sinceRevision mora biti ne-negativno celo število' }, { status: 400 })
      }
      sinceRevision = parsed
    }
    // §17 strop: neveljavne številke → fail-closed na privzeti limit.
    const limitRaw = Number.parseInt(searchParams.get('limit') ?? '', 10)
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, SYNC_GET_MAX_LIMIT) : SYNC_GET_DEFAULT_LIMIT

    // §36 device recording: z veljavnim X-Device-Id + sinceRevision zabeležimo
    // kurzor naprave (monotono — nazaj se ne premika).
    const deviceHeader = request.headers.get('x-device-id')
    let deviceId: string | null = null
    if (deviceHeader !== null) {
      const norm = normalizeDeviceId(deviceHeader)
      if ('error' in norm) {
        return NextResponse.json({ error: norm.error }, { status: 400 })
      }
      deviceId = norm.deviceId
    }

    // R120 (Problem 2): skoping po principalu.
    //  - USER: monter vidi SAMO svoje projekte (projectWhereForPrincipal),
    //    vodstvo/skladišče vse — enako kot na ostalih business rutah.
    //  - SERVICE (MOBILE_SYNC): `{}` je dokumentirana servisna pogodba
    //    (mobilni klient podjetja zrcali projekte podjetja).
    const scope = projectWhereForPrincipal(auth)

    // §36: grobnice izključijo projekte iz zrcala (klient jih je pobrisal).
    const timeFilter = sinceRevision !== null
      ? { syncRevision: { gt: sinceRevision } }
      : lastSync
        ? { updatedAt: { gte: new Date(lastSync) } }
        // Brez lastSync: samo projekti z mobilnim izvorom — sync endpoint ni
        // splošni seznam projektov (ta je /api/projects).
        : { mobileProjectId: { not: null } }

    const projects = await db.project.findMany({
      where: { AND: [scope, timeFilter, { syncTombstones: { none: {} } }] },
      include: {
        customer: true,
        monter: { select: { id: true, ime: true } },
      },
      orderBy: sinceRevision !== null ? { syncRevision: 'asc' } : { updatedAt: 'asc' },
      take: limit,
    })

    // §36: grobnice za čiščenje (najnovejše SYNC_TOMBSTONES_MAX, DESC).
    const tombstones = await db.syncTombstone.findMany({
      orderBy: { tombstonedAt: 'desc' },
      take: SYNC_TOMBSTONES_MAX,
      select: { mobileProjectId: true, tombstonedAt: true, reason: true },
    })

    // Monoton kurzor: max videna revizija (ali ostane vhod, če nič novega).
    const batchMaxRevision = projects.reduce((m, p) => Math.max(m, p.syncRevision), sinceRevision ?? 0)
    if (deviceId && sinceRevision !== null) {
      try {
        await db.syncDevice.updateMany({
          where: { deviceId, lastSyncCursor: { lt: batchMaxRevision } },
          data: { lastSyncCursor: batchMaxRevision, lastSeenAt: new Date() },
        })
      } catch (error) {
        logWithCorrelation('sync.device.cursor', correlationId, error)
      }
    }

    const responseBody = {
      projects,
      // §36 partial sync: kurzor + nadaljevanje.
      nextCursor: batchMaxRevision,
      hasMore: projects.length === limit,
      tombstones,
      timestamp: new Date().toISOString(),
    }
    return NextResponse.json(responseBody)
  } catch (error) {
    logWithCorrelation('sync.get', correlationId, error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju projektov', correlationId }, { status: 500 })
  }
}

// DELETE (R148 §36 — tombstones): mobilni projekt je izbrisan iz zrcala.
// Grobnica PREŽIVI brisanje projektne vrstice (SetNull) — ponovni sync
// istega mobileProjectId ne ustvari dvojnika, ampak dobi iskren rezultat.
export async function DELETE(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  // Isti scope kot vpis: ključ brez projects:write ne briše iz zrcala.
  if (apiKeyScopeDenied(auth, 'projects:write')) {
    return forbidden('Ključ nima scope-a projects:write — brisanje iz sync zrcala ni dovoljeno.')
  }
  const correlationId = correlationFromRequest(request)
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const mobileProjectId = typeof body?.mobileProjectId === 'string' ? body.mobileProjectId.trim() : ''
    const reason =
      typeof body?.reason === 'string' && body.reason.trim().length > 0
        ? body.reason.trim().slice(0, 500)
        : 'Izbrisano iz mobilne aplikacije'
    if (!mobileProjectId || mobileProjectId.length > 128) {
      return NextResponse.json({ error: 'mobileProjectId je obvezen (≤ 128 znakov)' }, { status: 400 })
    }

    // Fail-closed: grobnica samo za ZNAN mobilni projekt (živ ALI že z grobnico).
    const existingTombstone = await db.syncTombstone.findUnique({ where: { mobileProjectId } })
    if (existingTombstone) {
      // Idempotenten ponovni DELETE → ista grobnica (brez dvojnikov).
      return NextResponse.json({
        tombstoned: true,
        mobileProjectId,
        tombstonedAt: existingTombstone.tombstonedAt.toISOString(),
        already: true,
      })
    }
    const project = await db.project.findUnique({
      where: { mobileProjectId },
      select: { id: true, status: true },
    })
    if (!project) {
      return NextResponse.json(
        { error: 'Mobilni projekt ne obstaja (niti živ niti že izbrisan)' },
        { status: 404 },
      )
    }

    const created = await db.$transaction(async (tx) => {
      const row = await tx.syncTombstone.create({
        data: {
          mobileProjectId,
          reason,
          projectId: project.id,
          ...(auth.kind === 'user' ? { createdById: auth.session.sub } : {}),
        },
      })
      await auditInTx(tx, {
        request,
        userId: auth.kind === 'user' ? auth.session.sub : null,
        akcija: 'SYNC_TOMBSTONE',
        projectId: project.id,
        oldValue: { status: project.status, syncMirror: true },
        newValue: {
          mobileProjectId,
          reason,
          tombstoneId: row.id,
          servis: auth.kind === 'apikey' ? auth.name : 'uporabniška seja',
        },
      })
      return row
    })

    return NextResponse.json({
      tombstoned: true,
      mobileProjectId,
      tombstonedAt: created.tombstonedAt.toISOString(),
      already: false,
    })
  } catch (error) {
    logWithCorrelation('sync.delete', correlationId, error)
    return NextResponse.json({ error: 'Napaka pri brisanju iz sync zrcala', correlationId }, { status: 500 })
  }
}
