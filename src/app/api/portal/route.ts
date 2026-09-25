// Roksal Field - API: Portal stranke + merilna povezava (management endpoints)
// POST /api/portal {projectId, action: 'enable'|'disable'|'regenerate'|'revoke'|'update'
//                            | 'measureEnable'|'measureDisable'|'measureRegenerate'|'measureRevoke'}
// GET  /api/portal?projectId=X  ->  {enabled, token, url, expiresAt, revokedAt, lastUsedAt,
//                                    clientNotes, estimatedPrice, measure:{...}}
//
// R132 (issue #5 §7):
//   • Upravljanje je SAMO za uporabniške seje (API ključi → 403) — mobilni
//     ključi ne potrebujejo žetonov portala, čezrno branje žetona bi bilo
//     nova napadna površina.
//   • assertProjectAccess: vsak klical mora imeti dostop do projekta (prej
//     je bil projekt dosegljiv po ID-ju brez preverbe — IDOR za sejo).
//   • generatePortalToken je kriptografsko varen (prej Math.random()).
//   • Potek: enable/regenerate nastavita privzeto 90 dni (payload
//     `expiresInDays` 1..365), update lahko potek spremeni/podaljša.
//   • revoke: žeton MRTAV (revokedAt) — stran takoj 404; regenerate oživi
//     z NOVIM žetonom in svežim potekom.
// R133 (issue #5 §8): scoped MERILNI žeton — ista pravila, LOČEN žeton
//   (measureToken). `measureExpiresInDays` nastavi potek merilne povezave;
//   enable izda povezavo, če je še ni (ali je zapuščinski cuid → rotacija).
//   Enable na PREKLICANEM žetonu izda NOVEGA (revokacija je trajna —
//   popravljeno tudi za portal, kjer je enable pustil revokedAt postavljen).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { assertProjectAccess, AccessDeniedError, lacksPermission } from '@/lib/access'
import {
  DEFAULT_PORTAL_EXPIRY_DAYS,
  MAX_PORTAL_EXPIRY_DAYS,
  generatePortalToken,
  portalExpiryFromDays,
} from '@/lib/portal'
import {
  DEFAULT_MEASURE_EXPIRY_DAYS,
  MAX_MEASURE_EXPIRY_DAYS,
  generateMeasureToken,
} from '@/lib/measure'

type PortalAction =
  | 'enable'
  | 'disable'
  | 'regenerate'
  | 'revoke'
  | 'update'
  | 'measureEnable'
  | 'measureDisable'
  | 'measureRegenerate'
  | 'measureRevoke'
const ACTIONS: PortalAction[] = [
  'enable',
  'disable',
  'regenerate',
  'revoke',
  'update',
  'measureEnable',
  'measureDisable',
  'measureRegenerate',
  'measureRevoke',
]

/** Skupna izbira polj žetona za odgovor (široka kot UI potrebuje, nič več). */
const PORTAL_SELECT = {
  id: true,
  clientToken: true,
  clientPortalEnabled: true,
  clientTokenExpiresAt: true,
  clientTokenRevokedAt: true,
  clientTokenLastUsedAt: true,
  clientNotes: true,
  estimatedPrice: true,
  // R133 (§8): scoped merilni žeton — ločen življenjski cikl.
  measureToken: true,
  measureEnabled: true,
  measureTokenExpiresAt: true,
  measureTokenRevokedAt: true,
  measureTokenLastUsedAt: true,
} as const

type PortalProjectRow = {
  id: string
  clientToken: string | null
  clientPortalEnabled: boolean
  clientTokenExpiresAt: Date | null
  clientTokenRevokedAt: Date | null
  clientTokenLastUsedAt: Date | null
  clientNotes: string | null
  estimatedPrice: number | null
  measureToken: string | null
  measureEnabled: boolean
  measureTokenExpiresAt: Date | null
  measureTokenRevokedAt: Date | null
  measureTokenLastUsedAt: Date | null
}

function portalPayload(p: PortalProjectRow) {
  return {
    enabled: p.clientPortalEnabled,
    token: p.clientToken,
    url: p.clientToken ? `/portal/${p.clientToken}` : null,
    expiresAt: p.clientTokenExpiresAt?.toISOString() ?? null,
    revokedAt: p.clientTokenRevokedAt?.toISOString() ?? null,
    lastUsedAt: p.clientTokenLastUsedAt?.toISOString() ?? null,
    clientNotes: p.clientNotes,
    estimatedPrice: p.estimatedPrice,
    // R133 (§8): merilna povezava — ločen blok, ločen cikl.
    measure: {
      enabled: p.measureEnabled,
      token: p.measureToken,
      url: p.measureToken ? `/m/${p.measureToken}` : null,
      expiresAt: p.measureTokenExpiresAt?.toISOString() ?? null,
      revokedAt: p.measureTokenRevokedAt?.toISOString() ?? null,
      lastUsedAt: p.measureTokenLastUsedAt?.toISOString() ?? null,
    },
  }
}

// GET - status portala za projekt
export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  // §7: upravljanje portala je pisarniško delo — samo uporabniške seje.
  if (auth.kind !== 'user') {
    return NextResponse.json({ error: 'Portal upravlja samo osebje' }, { status: 403 })
  }
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { ...PORTAL_SELECT, monterId: true, vodjaId: true },
    })
    if (!project) {
      return NextResponse.json({ error: 'Projekt ni najden' }, { status: 404 })
    }
    assertProjectAccess(auth, project, 'read')

    return NextResponse.json(portalPayload(project))
  } catch (error) {
    return handleError(error, 'Portal GET Error:', 'Napaka pri branju portala')
  }
}

// POST - upravljanje portala (enable/disable/regenerate/revoke/update)
// §10 (R135): upravljanje portalov = pravica portal.manage (pisarna).
// Prej je lastnik-monter lahko omogočil portal; zdaj izključno ADMIN/VODJA
// (izrecna, dokumentirana zožitev — UI pokaže stanje "Ureja pisarna").
export async function POST(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  if (auth.kind !== 'user') {
    return NextResponse.json({ error: 'Portal upravlja samo osebje' }, { status: 403 })
  }
  if (lacksPermission(auth, 'portal.manage')) {
    return NextResponse.json(
      { error: 'Portalne povezave ureja pisarna (pravica portal.manage).' },
      { status: 403 }
    )
  }
  try {
    const body = await request.json() as {
      projectId?: string
      action?: PortalAction
      clientNotes?: string | null
      estimatedPrice?: number | null
      /** R132 (§7): potek v dneh (1..365) — privzeto 90 pri enable/regenerate. */
      expiresInDays?: number
      /** R133 (§8): potek merilne povezave v dneh (1..365) — privzeto 90. */
      measureExpiresInDays?: number
    }
    const { projectId, action } = body

    if (!projectId) {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }
    if (!action || !ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: "action mora biti 'enable', 'disable', 'regenerate', 'revoke', 'update', 'measureEnable', 'measureDisable', 'measureRegenerate' ali 'measureRevoke'" },
        { status: 400 },
      )
    }

    const existing = await db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        monterId: true,
        vodjaId: true,
        clientToken: true,
        clientTokenRevokedAt: true,
        measureToken: true,
        measureEnabled: true,
        measureTokenRevokedAt: true,
      },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Projekt ni najden' }, { status: 404 })
    }
    assertProjectAccess(auth, existing, 'update')

    let updateData: Record<string, unknown> = {}

    if (action === 'enable') {
      updateData.clientPortalEnabled = true
      // Brez žetona, zapuščinski format (pre-R132 cuid ni kripto in brez
      // poteka) ALI PREKLICAN žeton → izdaj NOVEGA s svežim potekom.
      // Revokacija je trajna (§7): ponovni enable = NOVA povezava, ne
      // oživitev mrtvega žetona (prej je enable pustil revokedAt — UI je
      // kazal "omogočen", stran pa je ostala 404).
      if (!isCryptoPortalToken(existing.clientToken) || existing.clientTokenRevokedAt) {
        updateData.clientToken = generatePortalToken()
        updateData.clientTokenRevokedAt = null
      }
      updateData.clientTokenExpiresAt = readExpiry(body.expiresInDays)
    } else if (action === 'disable') {
      // Začasno izklopljen — žeton OSTANE (vrnitev = isti URL).
      updateData.clientPortalEnabled = false
    } else if (action === 'regenerate') {
      // Nov kripto žeton + svež potek + počisti revokacijo (stari URL MRTAV).
      updateData.clientToken = generatePortalToken()
      updateData.clientPortalEnabled = true
      updateData.clientTokenRevokedAt = null
      updateData.clientTokenExpiresAt = readExpiry(body.expiresInDays)
    } else if (action === 'revoke') {
      // §7: revokacija — žeton trajno mrtav, portal izklopljen.
      updateData.clientPortalEnabled = false
      updateData.clientTokenRevokedAt = new Date()
    } else if (action === 'update') {
      if (typeof body.clientNotes === 'string' || body.clientNotes === null) {
        updateData.clientNotes = body.clientNotes?.trim() || null
      }
      if (typeof body.estimatedPrice === 'number' || body.estimatedPrice === null) {
        const price = body.estimatedPrice
        if (price !== null && (Number.isNaN(price) || price < 0)) {
          return NextResponse.json({ error: 'Cena mora biti pozitivno število' }, { status: 400 })
        }
        updateData.estimatedPrice = price
      }
      // Poimenovana sprememba poteka (podaljšanje/okrajšanje, null = brez poteka).
      if (body.expiresInDays !== undefined) {
        updateData.clientTokenExpiresAt =
          body.expiresInDays === null ? null : readExpiry(body.expiresInDays)
      }
    }
    // ------------------------------------------------------------------
    // R133 (§8): scoped merilna povezava — isti cikl kot portal, ločen žeton.
    // ------------------------------------------------------------------
    else if (action === 'measureEnable') {
      updateData.measureEnabled = true
      // Brez žetona, zapuščinski format (pre-R133 = kopija clientToken
      // cuid, ni kripto) ALI PREKLICAN žeton → izdaj NOVEGA s svežim
      // potekom. Revokacija je trajna (§8): ponovni enable = NOVA povezava.
      if (!isCryptoPortalToken(existing.measureToken) || existing.measureTokenRevokedAt) {
        updateData.measureToken = generateMeasureToken()
        updateData.measureTokenRevokedAt = null
      }
      updateData.measureTokenExpiresAt = readMeasureExpiry(body.measureExpiresInDays)
    } else if (action === 'measureDisable') {
      // Začasno izklopljena — žeton OSTANE (vrnitev = isti URL).
      updateData.measureEnabled = false
    } else if (action === 'measureRegenerate') {
      // Nov kripto žeton + svež potek + počisti revokacijo (stari URL MRTAV).
      updateData.measureToken = generateMeasureToken()
      updateData.measureEnabled = true
      updateData.measureTokenRevokedAt = null
      updateData.measureTokenExpiresAt = readMeasureExpiry(body.measureExpiresInDays)
    } else if (action === 'measureRevoke') {
      // §8: revokacija — žeton trajno mrtev, povezava izklopljena.
      updateData.measureEnabled = false
      updateData.measureTokenRevokedAt = new Date()
    }

    // R136 (§19): projektni žetoni + revizijski vpis v ENI transakciji —
    // crash med korakoma ne sme pustiti omogočenega portala brez sledi.
    const updated = await db.$transaction(async (tx) => {
      const row = await tx.project.update({
        where: { id: projectId },
        data: updateData,
        select: PORTAL_SELECT,
      })

      await tx.auditLog.create({
        data: {
          // R132: pravi akter (prej 'system', ki je padal na FK konvencijo).
          userId: auth.session.sub,
          projectId: row.id,
          // Portal akcije ohranijo PORTAL_ predpono (R132 pogodba); merilne
          // akcije nosijo MEASURE_ z podčrtajem (R133).
          akcija: action.startsWith('measure')
            ? action.replace(/^measure/, 'MEASURE_').toUpperCase()
            : `PORTAL_${action.toUpperCase()}`,
          newValue: JSON.stringify({
            enabled: row.clientPortalEnabled,
            hasToken: !!row.clientToken,
            expiresAt: row.clientTokenExpiresAt?.toISOString() ?? null,
            revokedAt: row.clientTokenRevokedAt?.toISOString() ?? null,
            measureEnabled: row.measureEnabled,
            hasMeasureToken: !!row.measureToken,
            measureExpiresAt: row.measureTokenExpiresAt?.toISOString() ?? null,
            measureRevokedAt: row.measureTokenRevokedAt?.toISOString() ?? null,
          }),
        },
      })

      return row
    })

    return NextResponse.json(portalPayload(updated))
  } catch (error) {
    return handleError(error, 'Portal POST Error:', 'Napaka pri upravljanju portala')
  }
}

/** Pre-R132 žetoni (cuid iz sheme) niso kripto formata — enable jih rotira. */
function isCryptoPortalToken(token: string | null): boolean {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{24}$/.test(token)
}

/** Prebere/clampa portal potek iz payloada; brez podanega = privzeti 90 dni. */
function readExpiry(days?: number): Date {
  if (typeof days !== 'number' || Number.isNaN(days)) {
    return portalExpiryFromDays(DEFAULT_PORTAL_EXPIRY_DAYS)
  }
  const clamped = Math.min(MAX_PORTAL_EXPIRY_DAYS, Math.max(1, Math.floor(days)))
  return portalExpiryFromDays(clamped)
}

/** R133 (§8): isti dogovor za merilno povezavo (privzeto 90 dni, strop 365). */
function readMeasureExpiry(days?: number): Date {
  if (typeof days !== 'number' || Number.isNaN(days)) {
    return portalExpiryFromDays(DEFAULT_MEASURE_EXPIRY_DAYS)
  }
  const clamped = Math.min(MAX_MEASURE_EXPIRY_DAYS, Math.max(1, Math.floor(days)))
  return portalExpiryFromDays(clamped)
}

function handleError(error: unknown, label: string, message: string): NextResponse {
  if (error instanceof AccessDeniedError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  console.error(label, error)
  return NextResponse.json({ error: message }, { status: 500 })
}
