// R393 (issue #13, korak R171 iz §15) — API: NOVA VERZIJA PRAVILA.
// ---------------------------------------------------------------------------
// POST — ustvari NASLEDNJO DRAFT verzijo obstoječega pravila (zaporedna =
//        max + 1; sprememba vsebine/provenance = nova verzija, NE tiho
//        prefinjanje obstoječe — §15 verzioniranje). VSA §15 provenanca je
//        obvezna enako kot pri ustvarjanju. RBAC: canManageEngineeringRules
//        (engineering.manage — vodstvo). Mutacija IZKLJUČNO prek
//        engineering-rules-store (EN VIR) znotraj transakcije + revizija
//        ATOMSKA (§19). Aktivacija je ločena (PATCH versions/[id]).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { canManageEngineeringRules } from '@/lib/access'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'
import {
  EngineeringRulesStoreError,
  novaVerzijaPravilaVTx,
  revizijskiKontekst,
  type VsebinaVerzijeVhod,
} from '@/lib/engineering-rules-store'

// POST — nova DRAFT verzija pravila
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const zavrnjeno = zapisOmejitev(request, 'engineering-rules')
  if (zavrnjeno) return zavrnjeno

  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  if (!canManageEngineeringRules(auth)) {
    return forbidden(
      'Verzije tehničnih pravil urejajo uporabniki s pravico engineering.manage (vodstvo).',
    )
  }
  const correlationId = correlationFromRequest(request)

  try {
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const body = telo.telo as Record<string, unknown>

    for (const obvezno of ['vsebina', 'vir', 'overitev'] as const) {
      if (typeof body[obvezno] !== 'string' || (body[obvezno] as string).trim() === '') {
        return NextResponse.json(
          { error: `Polje "${obvezno}" je obvezno (niz).` },
          { status: 400 },
        )
      }
    }

    const { id } = await context.params
    // R294 F4: stena ure živi v ruti — čas nastanka poda klicatelj.
    const now = new Date()
    const session = auth.kind === 'user' ? auth.session : null

    const verzija = await db.$transaction(async (tx) =>
      novaVerzijaPravilaVTx(
        tx,
        id,
        {
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
        } satisfies VsebinaVerzijeVhod,
        revizijskiKontekst(request, session),
        now,
      ),
    )

    return NextResponse.json(
      {
        verzijaId: verzija.id,
        verzija: verzija.verzija,
        status: verzija.status,
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof EngineeringRulesStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    logWithCorrelation('engineering-rules.versions.post', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri ustvarjanju verzije tehničnega pravila', correlationId },
      { status: 500 },
    )
  }
}
