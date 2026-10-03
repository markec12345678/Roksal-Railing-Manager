// R390 (issue #13, korak R170 iz §14) — API: PRESLIKAVE PRODUKT → DOBAVITELJ.
// ---------------------------------------------------------------------------
// POST  — doda preslikavo z veljavnostnim intervalom (§14 supplier mapping +
//         effective dates): {productId, supplierId, veljavnostOd, veljavnostDo?,
//         opomba?}. Prekrivanje intervalov istega para → 409 (NE tisan
//         podvojeno naročanje). RBAC: canManageCatalog (vodstvo).
// PATCH — prekliče (zapre) ODPRTO preslikavo: {action: 'preklici',
//         mappingId} — veljavnostDo = now; že zaprta → 409.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { canManageCatalog } from '@/lib/access'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'
import {
  CatalogStoreError,
  dodajDobaviteljaVTx,
  prekliciDobaviteljaVTx,
  revizijskiKontekst,
} from '@/lib/catalog-store'

function parseDatum(raw: unknown, polje: string): { ok: true; value: Date } | { ok: false; error: string } {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, error: `Polje "${polje}" mora biti ISO datum.` }
  }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) {
    return { ok: false, error: `Polje "${polje}" ni veljaven datum.` }
  }
  return { ok: true, value: d }
}

// POST — dodaj preslikavo (§14 supplier mapping; catalog.manage)
export async function POST(request: Request) {
  const zavrnjeno = zapisOmejitev(request, 'catalog')
  if (zavrnjeno) return zavrnjeno

  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  if (!canManageCatalog(auth)) {
    return forbidden('Preslikave dobaviteljev urejajo uporabniki s pravico catalog.manage (vodstvo).')
  }
  const correlationId = correlationFromRequest(request)

  try {
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const body = telo.telo as Record<string, unknown>

    const productId = typeof body.productId === 'string' ? body.productId.trim() : ''
    const supplierId = typeof body.supplierId === 'string' ? body.supplierId.trim() : ''
    if (!productId || !supplierId) {
      return NextResponse.json(
        { error: 'Polji "productId" in "supplierId" sta obvezni.' },
        { status: 400 },
      )
    }
    const veljavnostOd = parseDatum(body.veljavnostOd, 'veljavnostOd')
    if (!veljavnostOd.ok) return NextResponse.json({ error: veljavnostOd.error }, { status: 400 })
    let veljavnostDo: Date | null = null
    if (body.veljavnostDo !== undefined && body.veljavnostDo !== null) {
      const rez = parseDatum(body.veljavnostDo, 'veljavnostDo')
      if (!rez.ok) return NextResponse.json({ error: rez.error }, { status: 400 })
      veljavnostDo = rez.value
    }

    // R294 F4: stena ure živi v ruti.
    const now = new Date()
    const session = auth.kind === 'user' ? auth.session : null

    const ustvarjena = await db.$transaction(async (tx) =>
      dodajDobaviteljaVTx(
        tx,
        {
          productId,
          supplierId,
          veljavnostOd: veljavnostOd.value,
          veljavnostDo,
          opomba: typeof body.opomba === 'string' ? body.opomba : null,
        },
        revizijskiKontekst(request, session),
        now,
      ),
    )

    return NextResponse.json(
      {
        mappingId: ustvarjena.id,
        productId: ustvarjena.productId,
        supplierId: ustvarjena.supplierId,
        veljavnostOd: ustvarjena.veljavnostOd.toISOString(),
        veljavnostDo: ustvarjena.veljavnostDo?.toISOString() ?? null,
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof CatalogStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    logWithCorrelation('catalog.supplier-mappings.post', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri dodajanju preslikave dobavitelja', correlationId },
      { status: 500 },
    )
  }
}

// PATCH — prekliči (zapri) odprto preslikavo (catalog.manage)
export async function PATCH(request: Request) {
  const zavrnjeno = zapisOmejitev(request, 'catalog')
  if (zavrnjeno) return zavrnjeno

  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  if (!canManageCatalog(auth)) {
    return forbidden('Preslikave dobaviteljev urejajo uporabniki s pravico catalog.manage (vodstvo).')
  }
  const correlationId = correlationFromRequest(request)

  try {
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const body = telo.telo as Record<string, unknown>

    const mappingId = typeof body.mappingId === 'string' ? body.mappingId.trim() : ''
    if (!mappingId) {
      return NextResponse.json({ error: 'Polje "mappingId" je obvezno.' }, { status: 400 })
    }
    const action = typeof body.action === 'string' ? body.action.trim() : ''
    if (action !== 'preklici') {
      return NextResponse.json(
        { error: "Polje \"action\" mora biti 'preklici'." },
        { status: 400 },
      )
    }

    // R294 F4: stena ure živi v ruti.
    const now = new Date()
    const session = auth.kind === 'user' ? auth.session : null

    const zaprta = await db.$transaction(async (tx) =>
      prekliciDobaviteljaVTx(tx, mappingId, revizijskiKontekst(request, session), now),
    )

    return NextResponse.json({
      mappingId: zaprta.id,
      veljavnostDo: zaprta.veljavnostDo?.toISOString() ?? null,
    })
  } catch (error) {
    if (error instanceof CatalogStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    logWithCorrelation('catalog.supplier-mappings.patch', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri preklicu preslikave dobavitelja', correlationId },
      { status: 500 },
    )
  }
}
