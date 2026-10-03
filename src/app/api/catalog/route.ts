// R390 (issue #13, korak R170 iz §14) — API: PRODUKTNI KATALOG (snapshot).
// ---------------------------------------------------------------------------
// GET  — POLNI snapshot aplikacijskega kataloga (aktivna verzija na dan,
//        družine + produkti + aplikacije + dodatki + kompatibilnost +
//        dobavitelji). §14: "ne hardcodirati teh pravil v več UI-jih" —
//        to je EDINA točka, iz katere UI bere produktna pravila.
//        ?aplikacija=HORIZONTALNA_OGRAJA[&orientacija=vertical] → samo
//        DOKUMENTIRANI produkti za aplikacijo (fail-closed 400 za neznan tip).
//        Prag: authenticate (vsi avtenticirani principalci — teren potrebuje
//        kontekst; apikey servisno bere).
// POST — ustvari produkt (§14 polja VSA). RBAC: canManageCatalog
//        (catalog.manage — ADMIN/VODJA; MONTER/SKLADISCE samo berejo).
//        Mutacija IZKLJUČNO prek catalog-store (EN VIR) znotraj transakcije +
//        revizija ATOMSKA (§19). Pisarniški vnos — brez idempotenčnega ključa
//        (kanon /api/production POST, R378).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { canManageCatalog, actorIdOf } from '@/lib/access'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'
import {
  CatalogStoreError,
  katalogSnapshot,
  produktiZaAplikacijo,
  revizijskiKontekst,
  ustvariProduktVTx,
  aplikacijeBesednjak,
} from '@/lib/catalog-store'

// GET — snapshot kataloga / produkti za aplikacijo (§14 anti-hardcode čtivo)
export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const correlationId = correlationFromRequest(request)
  try {
    const { searchParams } = new URL(request.url)
    const aplikacija = searchParams.get('aplikacija')?.trim() ?? ''
    const orientacija = searchParams.get('orientacija')?.trim() ?? ''

    // R294 F4: stena ure živi v ruti — asOf poda klicatelj store-plastim.
    const asOf = new Date()

    if (aplikacija) {
      const produkti = await produktiZaAplikacijo(
        aplikacija,
        asOf,
        orientacija || undefined,
      )
      return NextResponse.json({
        aplikacije: aplikacijeBesednjak(),
        aplikacija,
        ...(orientacija ? { orientacija } : {}),
        produkti,
      })
    }

    const snapshot = await katalogSnapshot(asOf)
    return NextResponse.json({ ...snapshot, aplikacije: aplikacijeBesednjak() })
  } catch (error) {
    if (error instanceof CatalogStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    logWithCorrelation('catalog.get', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri branju kataloga', correlationId },
      { status: 500 },
    )
  }
}

// POST — ustvari produkt (§14 Product; catalog.manage — vodstvo)
export async function POST(request: Request) {
  const zavrnjeno = zapisOmejitev(request, 'catalog')
  if (zavrnjeno) return zavrnjeno

  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  if (!canManageCatalog(auth)) {
    return forbidden('Katalog urejajo uporabniki s pravico catalog.manage (vodstvo).')
  }
  const correlationId = correlationFromRequest(request)

  try {
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const body = telo.telo as Record<string, unknown>

    for (const obvezno of [
      'familySifra',
      'sifra',
      'naziv',
      'kategorija',
      'fixingMetoda',
    ] as const) {
      if (typeof body[obvezno] !== 'string' || (body[obvezno] as string).trim() === '') {
        return NextResponse.json(
          { error: `Polje "${obvezno}" je obvezno (niz).` },
          { status: 400 },
        )
      }
    }
    if (typeof body.rocaj !== 'object' || body.rocaj === null) {
      return NextResponse.json(
        { error: 'Polje "rocaj" je obvezen objekt (available + neobvezne dimenzije).' },
        { status: 400 },
      )
    }

    // R294 F4: stena ure živi v ruti — čas nastanka poda klicatelj.
    const now = new Date()
    const session = auth.kind === 'user' ? auth.session : null

    const ustvarjen = await db.$transaction(async (tx) =>
      ustvariProduktVTx(
        tx,
        {
          familySifra: (body.familySifra as string).trim(),
          catalogVersionId:
            typeof body.catalogVersionId === 'string' && body.catalogVersionId.trim() !== ''
              ? body.catalogVersionId.trim()
              : null,
          sifra: (body.sifra as string).trim(),
          naziv: (body.naziv as string).trim(),
          kategorija: (body.kategorija as string).trim(),
          faceWidthMm: body.faceWidthMm as number,
          thicknessMm: body.thicknessMm as number,
          standardLengthsMm: (body.standardLengthsMm as number[]) ?? [],
          fixingMetoda: (body.fixingMetoda as string).trim(),
          screwsVisible: body.screwsVisible === true,
          interniOkrepitev: body.interniOkrepitev === true,
          okrepitevOpis: typeof body.okrepitevOpis === 'string' ? body.okrepitevOpis : null,
          maxPostSpacingH: (body.maxPostSpacingH as number | null) ?? null,
          maxPostSpacingV: (body.maxPostSpacingV as number | null) ?? null,
          maxRailSpacingV: (body.maxRailSpacingV as number | null) ?? null,
          razmakKvalifikatorji: body.razmakKvalifikatorji as
            | Array<{ key: string; maxSpacingMm: number }>
            | undefined,
          gapMinMm: body.gapMinMm as number,
          gapMaxMm: body.gapMaxMm as number,
          rocaj: body.rocaj,
          posebnosti: (body.posebnosti as string[]) ?? [],
          pravice: typeof body.pravice === 'string' ? body.pravice : 'pending',
          viri: (body.viri as string[]) ?? [],
        },
        revizijskiKontekst(request, session),
        now,
      ),
    )

    return NextResponse.json(
      { produktId: ustvarjen.id, sifra: ustvarjen.sifra, naziv: ustvarjen.naziv },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof CatalogStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    logWithCorrelation('catalog.post', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri ustvarjanju produkta', correlationId },
      { status: 500 },
    )
  }
}
