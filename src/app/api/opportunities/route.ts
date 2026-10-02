// R382 (issue #13, korak R169 iz §13) — API: POSLOVNE PRILOŽNOSTI (Opportunity).
// ---------------------------------------------------------------------------
// GET  — seznam priložnosti s filtri (stage/customerId/leadId/search) — isti
//        prag kot GET /api/customers (authenticate); stage filter je STROGO
//        iz §13 nabora (400 sicer — fail-closed, ne tihi prazen seznam);
// POST — ustvari priložnost (direktna — leadId NI obvezen: repeat posel
//        obstoječe stranke vstopa brez sleada). RBAC: canManageCustomers
//        (customers.write — R156 precedens CRM pisanja). Vsa ustvarjanja GREJO
//        IZKLJUČNO prek crm-store (EN VIR) + revizija ATOMSKA (§19).
//        Decimal DTO: ocenjenaVrednost → number na meji (kanon R380).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { canManageCustomers, actorIdOf } from '@/lib/access'
import { escapeLikePattern } from '@/lib/search-access'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'
import { CrmStoreError, revizijskiKontekst, ustvariOpportunityVTx } from '@/lib/crm-store'
import { OPPORTUNITY_STAGES } from '@/lib/crm-pipeline'

// Meje strani (issue #5 §17 — isti kanon kot /api/customers).
const DEFAULT_LIMIT = 500
const MAX_LIMIT = 500

const MAXNAZIV = 200
const MAXOPIS = 2000

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

// GET — seznam priložnosti (filtri: stage, customerId, leadId, search)
export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const correlationId = correlationFromRequest(request)
  try {
    const { searchParams } = new URL(request.url)
    const stage = searchParams.get('stage')?.trim() ?? ''
    const customerId = searchParams.get('customerId')?.trim() ?? ''
    const leadId = searchParams.get('leadId')?.trim() ?? ''
    const search = searchParams.get('search')?.trim() ?? ''

    const limitRaw = Number.parseInt(searchParams.get('limit') ?? '', 10)
    const offsetRaw = Number.parseInt(searchParams.get('offset') ?? '', 10)
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_LIMIT) : DEFAULT_LIMIT
    const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0

    if (stage && !(OPPORTUNITY_STAGES as readonly string[]).includes(stage)) {
      return NextResponse.json(
        {
          error: `Neveljaven stage filter '${stage}' (§13 lifecycle: ${OPPORTUNITY_STAGES.join(' → ')}).`,
        },
        { status: 400 },
      )
    }

    // R138 kanon: insensitive contains + escape LIKE wildcardov.
    const pattern = escapeLikePattern(search)
    const insensitive = { contains: pattern, mode: 'insensitive' as const }

    const opportunities = await db.opportunity.findMany({
      where: {
        ...(stage ? { stage } : {}),
        ...(customerId ? { customerId } : {}),
        ...(leadId ? { leadId } : {}),
        ...(search ? { OR: [{ naziv: insensitive }, { opis: insensitive }] } : {}),
      },
      include: {
        customer: { select: { id: true, ime: true } },
        lead: { select: { id: true, ime: true, status: true } },
        convertedProject: { select: { id: true, nazivProjekta: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })

    return NextResponse.json(
      opportunities.map((o) => ({
        id: o.id,
        leadId: o.leadId,
        leadIme: o.lead?.ime ?? null,
        customerId: o.customerId,
        customerIme: o.customer?.ime ?? null,
        naziv: o.naziv,
        opis: o.opis,
        ocenjenaVrednost: o.ocenjenaVrednost?.toNumber() ?? null,
        stage: o.stage,
        verjetnost: o.verjetnost,
        razlogIzgube: o.razlogIzgube,
        convertedProjectId: o.convertedProjectId,
        convertedProjectNaziv: o.convertedProject?.nazivProjekta ?? null,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      })),
    )
  } catch (error) {
    logWithCorrelation('opportunities.get', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri branju priložnosti', correlationId },
      { status: 500 },
    )
  }
}

// POST — ustvari priložnost (direktna; §13 — leadId neobvezen)
export async function POST(request: Request) {
  const zavrnjeno = zapisOmejitev(request, 'opportunities')
  if (zavrnjeno) return zavrnjeno

  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  if (!canManageCustomers(auth)) {
    return forbidden('Priložnosti ustvarjajo uporabniki s pravico customers.write (prijava).')
  }
  const correlationId = correlationFromRequest(request)

  try {
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const body = telo.telo as Record<string, unknown>

    const naziv = parseOptionalText(body.naziv, 'naziv', MAXNAZIV)
    if (!naziv.ok) return NextResponse.json({ error: naziv.error }, { status: 400 })
    // Lokalna const — zoženje tipa preživi closure transakcije (kanon R378).
    const nazivVrednost = naziv.value
    if (!nazivVrednost || nazivVrednost.length < 3) {
      return NextResponse.json(
        { error: 'Naziv priložnosti je obvezen (min 3 znaki).' },
        { status: 400 },
      )
    }
    const opis = parseOptionalText(body.opis, 'opis', MAXOPIS)
    if (!opis.ok) return NextResponse.json({ error: opis.error }, { status: 400 })

    const leadId =
      typeof body.leadId === 'string' && body.leadId.trim() !== '' ? body.leadId.trim() : null
    const customerId =
      typeof body.customerId === 'string' && body.customerId.trim() !== ''
        ? body.customerId.trim()
        : null

    // Ocenjena vrednost/verjetnost gresta NEOBDELANI v plast — tip in domeno
    // validira TAM (EN VIR pravil; string/NaN/3 decimalki/101 → 400).
    const ocenjenaVrednost: unknown = body.ocenjenaVrednost
    const verjetnost: unknown = body.verjetnost

    const now = new Date()
    const session = auth.kind === 'user' ? auth.session : null

    const ustvarjena = await db.$transaction(async (tx) =>
      ustvariOpportunityVTx(tx, {
        leadId,
        customerId,
        naziv: nazivVrednost,
        opis: opis.value ?? null,
        ocenjenaVrednost: ocenjenaVrednost as number | null | undefined,
        verjetnost: verjetnost as number | null | undefined,
        actorId: actorIdOf(auth),
        now,
        revizija: revizijskiKontekst(request, session),
      }),
    )

    return NextResponse.json(ustvarjena, { status: 201 })
  } catch (error) {
    if (error instanceof CrmStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    logWithCorrelation('opportunities.post', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri ustvarjanju priložnosti', correlationId },
      { status: 500 },
    )
  }
}
