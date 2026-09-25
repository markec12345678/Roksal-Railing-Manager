// Roksal Field - API: Portal stranke (management endpoints)
// POST /api/portal {projectId, action: 'enable'|'disable'|'regenerate'|'revoke'|'update'}
// GET  /api/portal?projectId=X  ->  {enabled, token, url, expiresAt, revokedAt, lastUsedAt}
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
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { assertProjectAccess, AccessDeniedError } from '@/lib/access'
import {
  DEFAULT_PORTAL_EXPIRY_DAYS,
  MAX_PORTAL_EXPIRY_DAYS,
  generatePortalToken,
  portalExpiryFromDays,
} from '@/lib/portal'

type PortalAction = 'enable' | 'disable' | 'regenerate' | 'revoke' | 'update'
const ACTIONS: PortalAction[] = ['enable', 'disable', 'regenerate', 'revoke', 'update']

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
} as const

function portalPayload(p: {
  clientToken: string | null
  clientPortalEnabled: boolean
  clientTokenExpiresAt: Date | null
  clientTokenRevokedAt: Date | null
  clientTokenLastUsedAt: Date | null
  clientNotes: string | null
  estimatedPrice: number | null
}) {
  return {
    enabled: p.clientPortalEnabled,
    token: p.clientToken,
    url: p.clientToken ? `/portal/${p.clientToken}` : null,
    expiresAt: p.clientTokenExpiresAt?.toISOString() ?? null,
    revokedAt: p.clientTokenRevokedAt?.toISOString() ?? null,
    lastUsedAt: p.clientTokenLastUsedAt?.toISOString() ?? null,
    clientNotes: p.clientNotes,
    estimatedPrice: p.estimatedPrice,
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
export async function POST(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  if (auth.kind !== 'user') {
    return NextResponse.json({ error: 'Portal upravlja samo osebje' }, { status: 403 })
  }
  try {
    const body = await request.json() as {
      projectId?: string
      action?: PortalAction
      clientNotes?: string | null
      estimatedPrice?: number | null
      /** R132 (§7): potek v dneh (1..365) — privzeto 90 pri enable/regenerate. */
      expiresInDays?: number
    }
    const { projectId, action } = body

    if (!projectId) {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }
    if (!action || !ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: "action mora biti 'enable', 'disable', 'regenerate', 'revoke' ali 'update'" },
        { status: 400 },
      )
    }

    const existing = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, monterId: true, vodjaId: true, clientToken: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Projekt ni najden' }, { status: 404 })
    }
    assertProjectAccess(auth, existing, 'update')

    let updateData: Record<string, unknown> = {}

    if (action === 'enable') {
      updateData.clientPortalEnabled = true
      // Brez žetona ALI zastarelega formata (pre-R132 cuid ni kripto in brez
      // poteka) ustvarimo NOVEGA z svežim potekom — stari URL umre.
      if (!isCryptoPortalToken(existing.clientToken)) {
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

    const updated = await db.project.update({
      where: { id: projectId },
      data: updateData,
      select: PORTAL_SELECT,
    })

    try {
      await db.auditLog.create({
        data: {
          // R132: pravi akter (prej 'system', ki je padal na FK konvencijo).
          userId: auth.session.sub,
          projectId: updated.id,
          akcija: `PORTAL_${action.toUpperCase()}`,
          newValue: JSON.stringify({
            enabled: updated.clientPortalEnabled,
            hasToken: !!updated.clientToken,
            expiresAt: updated.clientTokenExpiresAt?.toISOString() ?? null,
            revokedAt: updated.clientTokenRevokedAt?.toISOString() ?? null,
          }),
        },
      })
    } catch {
      // Audit ne sme porušiti upravljanja; napaka ostane v logih.
    }

    return NextResponse.json(portalPayload(updated))
  } catch (error) {
    return handleError(error, 'Portal POST Error:', 'Napaka pri upravljanju portala')
  }
}

/** Pre-R132 žetoni (cuid iz sheme) niso kripto formata — enable jih rotira. */
function isCryptoPortalToken(token: string | null): boolean {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{24}$/.test(token)
}

/** Prebere/clampa potek iz payloada; brez podanega = privzeti 90 dni. */
function readExpiry(days?: number): Date {
  if (typeof days !== 'number' || Number.isNaN(days)) {
    return portalExpiryFromDays(DEFAULT_PORTAL_EXPIRY_DAYS)
  }
  const clamped = Math.min(MAX_PORTAL_EXPIRY_DAYS, Math.max(1, Math.floor(days)))
  return portalExpiryFromDays(clamped)
}

function handleError(error: unknown, label: string, message: string): NextResponse {
  if (error instanceof AccessDeniedError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  console.error(label, error)
  return NextResponse.json({ error: message }, { status: 500 })
}
