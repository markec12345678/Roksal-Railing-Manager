// R390 (issue #13, korak R170 iz §14) — API: APLIKACIJSKI KONTEKST PRODUKTA.
// ---------------------------------------------------------------------------
// POST — doda EKSPlicitno aplikacijo produktu (§14 Application):
//        {aplikacija, orientacija, maxRazmakMm?, vir}. Fail-closed: neznan
//        tip/orientacija → 400 s seznamom; duplikat kombinacije → 409;
//        maxRazmakMm pozitiven cel ali null (§8 honest). RBAC:
//        canManageCatalog (catalog.manage — vodstvo). Mutacija IZKLJUČNO
//        prek catalog-store (EN VIR) + revizija ATOMSKA (§19).
// GET  — aplikacije produkta (aplikacijski kontekst za UI izdelovalca).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { canManageCatalog } from '@/lib/access'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'
import { CatalogStoreError, dodajAplikacijoVTx, revizijskiKontekst } from '@/lib/catalog-store'

// GET — aplikacije produkta
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const correlationId = correlationFromRequest(request)
  try {
    const { id } = await context.params
    const produkt = await db.product.findUnique({
      where: { id },
      select: { id: true, sifra: true, applications: true },
    })
    if (!produkt) {
      return NextResponse.json({ error: `Produkt '${id}' ne obstaja` }, { status: 404 })
    }
    return NextResponse.json({
      produktId: produkt.id,
      sifra: produkt.sifra,
      aplikacije: produkt.applications,
    })
  } catch (error) {
    logWithCorrelation('catalog.product.apps.get', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri branju aplikacij produkta', correlationId },
      { status: 500 },
    )
  }
}

// POST — dodaj aplikacijo (§14 Application; catalog.manage)
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const zavrnjeno = zapisOmejitev(request, 'catalog')
  if (zavrnjeno) return zavrnjeno

  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  if (!canManageCatalog(auth)) {
    return forbidden('Aplikacije produktov urejajo uporabniki s pravico catalog.manage (vodstvo).')
  }
  const correlationId = correlationFromRequest(request)

  try {
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const body = telo.telo as Record<string, unknown>

    if (typeof body.aplikacija !== 'string' || body.aplikacija.trim() === '') {
      return NextResponse.json({ error: 'Polje "aplikacija" je obvezno.' }, { status: 400 })
    }
    if (typeof body.orientacija !== 'string' || body.orientacija.trim() === '') {
      return NextResponse.json({ error: 'Polje "orientacija" je obvezno.' }, { status: 400 })
    }
    if (typeof body.vir !== 'string' || body.vir.trim().length < 2) {
      return NextResponse.json(
        { error: 'Polje "vir" je obvezno (citat vira dokumentacije, min 2 znaka).' },
        { status: 400 },
      )
    }

    const { id } = await context.params
    // R294 F4: stena ure živi v ruti.
    const now = new Date()
    const session = auth.kind === 'user' ? auth.session : null

    const ustvarjena = await db.$transaction(async (tx) =>
      dodajAplikacijoVTx(
        tx,
        id,
        {
          aplikacija: (body.aplikacija as string).trim(),
          orientacija: (body.orientacija as string).trim(),
          maxRazmakMm: (body.maxRazmakMm as number | null) ?? null,
          vir: (body.vir as string).trim(),
        },
        revizijskiKontekst(request, session),
        now,
      ),
    )

    return NextResponse.json(
      {
        aplikacijaId: ustvarjena.id,
        aplikacija: ustvarjena.aplikacija,
        orientacija: ustvarjena.orientacija,
        maxRazmakMm: ustvarjena.maxRazmakMm,
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof CatalogStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    logWithCorrelation('catalog.product.apps.post', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri dodajanju aplikacije', correlationId },
      { status: 500 },
    )
  }
}
