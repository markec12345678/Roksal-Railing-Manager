// R382 (issue #13, korak R169 iz §13) — API: SLEADI (Lead).
// ---------------------------------------------------------------------------
// GET  — seznam sleadov z filtri (status/owner/search) — isti prag kot
//        GET /api/customers (authenticate: vsi avtenticirani principalci —
//        matrika §10 customers.read ima vsaka vloga; apikey servisno bere);
// POST — ustvari slead (vhod lijaka §13: source/kontakt/tip povpraševanja/
//        owner/nextActionAt). RBAC: canManageCustomers (customers.write —
//        MONTER+ piše, SKLADISCE samo bere, apikey nič; R156 precedens
//        CRM pisanja). Ustvarjanje gre IZKLJUČNO prek crm-store (EN VIR)
//        znotraj transakcije + revizija ATOMSKA (§19).
//        Brez idempotenčnega ključa: sleadi so pisarniški vnos (NE
//        offline vrsta terenskega klienta — kanon idempotence R139 velja
//        tam, kjer retry brez omrežja lahko podvoji; tukaj isti vzorec
//        kot /api/production POST).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { canManageCustomers, actorIdOf } from '@/lib/access'
import { escapeLikePattern } from '@/lib/search-access'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'
import { CrmStoreError, revizijskiKontekst, ustvariLeadVTx } from '@/lib/crm-store'
import { LEAD_STATUSES } from '@/lib/crm-pipeline'

// Meje strani (issue #5 §17 — isti kanon kot /api/customers): brez parametrov
// POPOLN seznam; ?limit=&offset= strani; strop 500.
const DEFAULT_LIMIT = 500
const MAX_LIMIT = 500

const MAXIME = 120
const MAXTELEFON = 60
const MAXEMAIL = 200
const MAXOPOMBE = 2000

/** Stroga (fail-closed) pretvorba neobveznega datuma (R156 vzorec). */
function parseOptionalDate(
  raw: unknown,
  field: string,
): { ok: true; value: Date | null | undefined } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, value: raw === null ? null : undefined }
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, error: `Polje "${field}" mora biti ISO datum ali null` }
  }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) {
    return { ok: false, error: `Polje "${field}" ni veljaven datum` }
  }
  return { ok: true, value: d }
}

/** Stroga (fail-closed) pretvorba neobveznega besedila s stropom (R156). */
function parseOptionalText(
  raw: unknown,
  field: string,
  max: number,
): { ok: true; value: string | null | undefined } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, value: raw === null ? null : undefined }
  if (typeof raw !== 'string') {
    return { ok: false, error: `Polje "${field}" mora biti niz ali null` }
  }
  const trimmed = raw.trim()
  if (trimmed.length === 0) return { ok: true, value: null }
  if (trimmed.length > max) {
    return { ok: false, error: `Polje "${field}" presega ${max} znakov` }
  }
  return { ok: true, value: trimmed }
}

// GET — seznam sleadov (filtri: status, ownerId, search po kontaktu)
export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const correlationId = correlationFromRequest(request)
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')?.trim() ?? ''
    const ownerId = searchParams.get('ownerId')?.trim() ?? ''
    const search = searchParams.get('search')?.trim() ?? ''

    const limitRaw = Number.parseInt(searchParams.get('limit') ?? '', 10)
    const offsetRaw = Number.parseInt(searchParams.get('offset') ?? '', 10)
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_LIMIT) : DEFAULT_LIMIT
    const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0

    if (status && !(LEAD_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json(
        { error: `Neveljaven status filter '${status}' (dovoljeni: ${LEAD_STATUSES.join(', ')}).` },
        { status: 400 },
      )
    }

    // R138 kanon: insensitive contains + escape LIKE wildcardov.
    const pattern = escapeLikePattern(search)
    const insensitive = { contains: pattern, mode: 'insensitive' as const }

    const leads = await db.lead.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(ownerId ? { ownerId } : {}),
        ...(search
          ? { OR: [{ ime: insensitive }, { telefon: insensitive }, { email: insensitive }] }
          : {}),
      },
      include: {
        owner: { select: { id: true, ime: true } },
        _count: { select: { opportunities: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })

    return NextResponse.json(
      leads.map((l) => ({
        id: l.id,
        source: l.source,
        ime: l.ime,
        telefon: l.telefon,
        email: l.email,
        tipPovprasevanja: l.tipPovprasevanja,
        status: l.status,
        ownerId: l.ownerId,
        ownerIme: l.owner?.ime ?? null,
        nextActionAt: l.nextActionAt,
        opombe: l.opombe,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
        steviloPriloznosti: l._count.opportunities,
      })),
    )
  } catch (error) {
    logWithCorrelation('leads.get', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri branju sleadov', correlationId },
      { status: 500 },
    )
  }
}

// POST — ustvari slead (vhod CRM lijaka §13)
export async function POST(request: Request) {
  const zavrnjeno = zapisOmejitev(request, 'leads')
  if (zavrnjeno) return zavrnjeno

  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  if (!canManageCustomers(auth)) {
    return forbidden('Sleade ustvarjajo uporabniki s pravico customers.write (prijava).')
  }
  const correlationId = correlationFromRequest(request)

  try {
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const body = telo.telo as Record<string, unknown>

    const ime = parseOptionalText(body.ime, 'ime', MAXIME)
    if (!ime.ok) return NextResponse.json({ error: ime.error }, { status: 400 })
    // Lokalna const — zoženje tipa preživi closure transakcije (kanon R378
    // lekcija: parsed.data referenca se v closure-u ne ohrani).
    const imeVrednost = ime.value
    if (!imeVrednost || imeVrednost.length < 2) {
      return NextResponse.json(
        { error: 'Ime stika sleada je obvezno (min 2 znaka).' },
        { status: 400 },
      )
    }
    const telefon = parseOptionalText(body.telefon, 'telefon', MAXTELEFON)
    if (!telefon.ok) return NextResponse.json({ error: telefon.error }, { status: 400 })
    const email = parseOptionalText(body.email, 'email', MAXEMAIL)
    if (!email.ok) return NextResponse.json({ error: email.error }, { status: 400 })
    const opombe = parseOptionalText(body.opombe, 'opombe', MAXOPOMBE)
    if (!opombe.ok) return NextResponse.json({ error: opombe.error }, { status: 400 })
    const nextActionAt = parseOptionalDate(body.nextActionAt, 'nextActionAt')
    if (!nextActionAt.ok) return NextResponse.json({ error: nextActionAt.error }, { status: 400 })

    const source = typeof body.source === 'string' ? body.source : undefined
    const tipPovprasevanja =
      typeof body.tipPovprasevanja === 'string' ? body.tipPovprasevanja : undefined
    const ownerId =
      typeof body.ownerId === 'string' && body.ownerId.trim() !== '' ? body.ownerId.trim() : null

    // R294 F4: stena ure živi v RUTI — čas nastanka poda klicatelj.
    const now = new Date()
    const session = auth.kind === 'user' ? auth.session : null

    const ustvarjen = await db.$transaction(async (tx) =>
      ustvariLeadVTx(tx, {
        source,
        ime: imeVrednost,
        telefon: telefon.value ?? null,
        email: email.value ?? null,
        tipPovprasevanja,
        ownerId,
        nextActionAt: nextActionAt.value ?? null,
        opombe: opombe.value ?? null,
        actorId: actorIdOf(auth),
        now,
        revizija: revizijskiKontekst(request, session),
      }),
    )

    return NextResponse.json(ustvarjen, { status: 201 })
  } catch (error) {
    if (error instanceof CrmStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    logWithCorrelation('leads.post', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri ustvarjanju sleada', correlationId },
      { status: 500 },
    )
  }
}
