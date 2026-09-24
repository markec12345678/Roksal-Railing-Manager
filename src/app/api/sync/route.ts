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
// Ključi se ustvarijo z `bun run apikey`, v bazi je samo pepper+SHA-256 hash,
// posamezen ključ se da preklicati (revokedAt).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { assertProjectAccess, projectWhereForPrincipal, apiKeyScopeDenied } from '@/lib/access'
import {
  transitionAllowed,
  initialStatusFor,
  InvalidTransitionError,
  isProjectStatus,
} from '@/lib/project-state'
import { auditInTx } from '@/lib/audit'

/**
 * Shema mobilnega payload-a. Namerno SPROŠČENA (vse ključne poslovne polja
 * opcijska z privzetki) — mobilni klient je starejša aplikacija in ne sme
 * obrati, a neznana/napačna tipizirana polja se zavržejo (zod strip).
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
})

type MobileProject = z.infer<typeof mobileProjectSchema>

type SyncResult =
  | { mobileProjectId: string; ok: true; projectId: string; action: 'created' | 'updated'; warnings: string[] }
  | { mobileProjectId: string; ok: false; error: string }

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
      results.push({
        mobileProjectId: id,
        ok: false,
        error: `Neveljaven payload: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      })
      continue
    }
    const mobileProject = parsed.data

    try {
      const outcome = await syncOneProject(auth, mobileProject, request)
      results.push({
        mobileProjectId: mobileProject.id,
        ok: true,
        projectId: outcome.projectId,
        action: outcome.action,
        warnings: outcome.warnings,
      })
      syncedProjects.push(outcome.project as Record<string, unknown>)
    } catch (error) {
      const message =
        error instanceof InvalidTransitionError
          ? error.message
          : error instanceof Error && error.message.includes('Dostop do projekta')
            ? error.message
            : 'Napaka pri sinhronizaciji zapisa'
      console.error('Sync POST item error:', error)
      results.push({ mobileProjectId: mobileProject.id, ok: false, error: message })
    }
  }

  const okCount = results.filter((r) => r.ok).length
  return NextResponse.json({
    message: `Sinhroniziranih ${okCount} projektov (${results.length - okCount} napak)`,
    projects: syncedProjects,
    results,
    timestamp: new Date().toISOString(),
  })
}

/** Obdelaj EN mobilni projekt (update ali create) z auditom v transakciji. */
async function syncOneProject(
  auth: NonNullable<Awaited<ReturnType<typeof authenticate>>>,
  mobileProject: MobileProject,
  request: Request
): Promise<{ projectId: string; action: 'created' | 'updated'; warnings: string[]; project: unknown }> {
  const warnings: string[] = []

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
        stranka: customer!.ime,
        servis: auth.kind === 'apikey' ? auth.name : 'uporabniška seja',
        korigiranStatus: resolved.clampedFrom,
      },
    })
    return row
    })

    return { projectId: newProject.id, action: 'created', warnings, project: newProject }
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
 * Posodobitev obstoječega projekta (statusni stroj + audit v transakciji).
 * Izvlečena iz syncOneProject — uporablja jo tudi P2002 repli pot.
 */
async function applySyncUpdate(
  auth: NonNullable<Awaited<ReturnType<typeof authenticate>>>,
  existingProject: { id: string; status: string; dealLocked: boolean; opombe: string | null; latitude: number | null; longitude: number | null; monterId: string | null; vodjaId: string | null },
  mobileProject: MobileProject,
  request: Request,
  warnings: string[]
): Promise<{ projectId: string; action: 'updated'; warnings: string[]; project: unknown }> {
  // Resource authorization velja tudi tu (R120): servis sme sync polja
  // spreminjati (razen deal-lock), monter sme samo na svojih projektih.
  assertProjectAccess(auth, existingProject, 'update')

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
      },
      newValue: {
        status: nextStatus,
        opombe: row.opombe,
        latitude: row.latitude,
        longitude: row.longitude,
        servis: auth.kind === 'apikey' ? auth.name : 'uporabniška seja',
        zavrnjeniStatus: warnings.length > 0 ? mobileProject.status : undefined,
      },
    })
    return row
  })

  return { projectId: updated.id, action: 'updated', warnings, project: updated }
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
export async function GET(request: Request) {
  // Tudi branje projektov za sinhronizacijo je zaščiteno: seznam razkrije stranke in naslove.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  // R126 (issue #5 §3): API ključ mora nositi scope `projects:read`.
  if (apiKeyScopeDenied(auth, 'projects:read')) {
    return forbidden('Ključ nima scope-a projects:read — branje sync zrcala ni dovoljeno.')
  }
  try {
    const { searchParams } = new URL(request.url)
    const lastSync = searchParams.get('lastSync')

    // R120 (Problem 2): skoping po principalu.
    //  - USER: monter vidi SAMO svoje projekte (projectWhereForPrincipal),
    //    vodstvo/skladišče vse — enako kot na ostalih business rutah.
    //  - SERVICE (MOBILE_SYNC): `{}` je dokumentirana servisna pogodba
    //    (mobilni klient podjetja zrcali projekte podjetja).
    const scope = projectWhereForPrincipal(auth)

    const timeFilter = lastSync
      ? { updatedAt: { gte: new Date(lastSync) } }
      // Brez lastSync: samo projekti z mobilnim izvorom — sync endpoint ni
      // splošni seznam projektov (ta je /api/projects).
      : { mobileProjectId: { not: null } }

    const projects = await db.project.findMany({
      where: { AND: [scope, timeFilter] },
      include: {
        customer: true,
        monter: { select: { id: true, ime: true } },
      },
      orderBy: { updatedAt: 'asc' },
    })

    return NextResponse.json({
      projects,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Sync GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju projektov' }, { status: 500 })
  }
}
