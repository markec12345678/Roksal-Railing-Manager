// R393 (issue #13, korak R171 iz §15) — API: INŽENIRSKA/COMPLIANCE PRAVILA.
// ---------------------------------------------------------------------------
// GET  — seznam pravil z AKTIVNO verzijo na dan + §15 skladnostni povzetek
//        (število uradno preverjenih odkrito) + opozorilo o ločitvi
//        informativnega izračuna od uradne projektantske/statistične preverbe.
//        Filtri: ?kategorija= ?aplikacija= ?vir= ?productSifra= (EXACT —
//        fail-closed 400 za neznan nabor). Prag: authenticate (vsi
//        avtenticirani principalci — teren potrebuje honest kontekst).
// POST — ustvari pravilo (identiteta) + prvo DRAFT verzijo z VSO §15
//        provenanco. RBAC: canManageEngineeringRules (engineering.manage —
//        ADMIN/VODJA). Mutacija IZKLJUČNO prek engineering-rules-store
//        (EN VIR) znotraj transakcije + revizija ATOMSKA (§19).
//        Pisarniški vnos — brez idempotenčnega ključa (kanon /api/catalog
//        POST, R390).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { canManageEngineeringRules } from '@/lib/access'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'
import {
  EngineeringRulesStoreError,
  pravilaSeznam,
  revizijskiKontekst,
  ustvariPraviloVTx,
  type UstvariPraviloVhod,
} from '@/lib/engineering-rules-store'

// GET — seznam pravil (§15 provenanca + skladnostni povzetek)
export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const correlationId = correlationFromRequest(request)
  try {
    const { searchParams } = new URL(request.url)
    const filtri = {
      kategorija: searchParams.get('kategorija')?.trim() || undefined,
      aplikacija: searchParams.get('aplikacija')?.trim() || undefined,
      vir: searchParams.get('vir')?.trim() || undefined,
      productSifra: searchParams.get('productSifra')?.trim() || undefined,
    }

    // R294 F4: stena ure živi v ruti — asOf poda klicatelj store-plastim.
    const asOf = new Date()
    const rezultat = await pravilaSeznam(asOf, filtri)
    return NextResponse.json(rezultat)
  } catch (error) {
    if (error instanceof EngineeringRulesStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    logWithCorrelation('engineering-rules.get', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri branju tehničnih pravil', correlationId },
      { status: 500 },
    )
  }
}

// POST — ustvari pravilo + prvo DRAFT verzijo (§15 provenanca obvezna)
export async function POST(request: Request) {
  const zavrnjeno = zapisOmejitev(request, 'engineering-rules')
  if (zavrnjeno) return zavrnjeno

  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  if (!canManageEngineeringRules(auth)) {
    return forbidden(
      'Tehnična pravila urejajo uporabniki s pravico engineering.manage (vodstvo).',
    )
  }
  const correlationId = correlationFromRequest(request)

  try {
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const body = telo.telo as Record<string, unknown>

    for (const obvezno of ['sifra', 'naziv', 'kategorija', 'vsebina', 'vir', 'overitev'] as const) {
      if (typeof body[obvezno] !== 'string' || (body[obvezno] as string).trim() === '') {
        return NextResponse.json(
          { error: `Polje "${obvezno}" je obvezno (niz).` },
          { status: 400 },
        )
      }
    }

    // R294 F4: stena ure živi v ruti — čas nastanka poda klicatelj.
    const now = new Date()
    const session = auth.kind === 'user' ? auth.session : null

    const ustvarjeno = await db.$transaction(async (tx) =>
      ustvariPraviloVTx(
        tx,
        {
          sifra: body.sifra as string,
          naziv: body.naziv as string,
          kategorija: body.kategorija as string,
          aplikacija: typeof body.aplikacija === 'string' ? body.aplikacija : null,
          productSifra: typeof body.productSifra === 'string' ? body.productSifra : null,
          orientacija: typeof body.orientacija === 'string' ? body.orientacija : null,
          vsebina: body.vsebina as string,
          struktura:
            typeof body.struktura === 'object' && body.struktura !== null
              ? (body.struktura as Record<string, unknown>)
              : null,
          vir: body.vir as string,
          virZapis: typeof body.virZapis === 'string' ? body.virZapis : null,
          standardReferenca: typeof body.standardReferenca === 'string' ? body.standardReferenca : null,
          standardVerzija: typeof body.standardVerzija === 'string' ? body.standardVerzija : null,
          jurisdikcija: typeof body.jurisdikcija === 'string' ? body.jurisdikcija : null,
          overitev: body.overitev as string,
          calculatorVerzija: typeof body.calculatorVerzija === 'string' ? body.calculatorVerzija : null,
          reviewedAt: typeof body.reviewedAt === 'string' ? body.reviewedAt : null,
          reviewerId: typeof body.reviewerId === 'string' ? body.reviewerId : null,
        } satisfies UstvariPraviloVhod,
        revizijskiKontekst(request, session),
        now,
      ),
    )

    return NextResponse.json(
      {
        praviloId: ustvarjeno.pravilo.id,
        sifra: ustvarjeno.pravilo.sifra,
        verzijaId: ustvarjeno.verzija.id,
        verzija: ustvarjeno.verzija.verzija,
        status: ustvarjeno.verzija.status,
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof EngineeringRulesStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    logWithCorrelation('engineering-rules.post', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri ustvarjanju tehničnega pravila', correlationId },
      { status: 500 },
    )
  }
}
