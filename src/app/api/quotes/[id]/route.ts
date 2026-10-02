// R374 (issue #13, korak R165 iz §32/§3) — API: detajl/izdaja verzije ponudbe.
// ---------------------------------------------------------------------------
// GET   — detajl verzije (dostop 'read' do projekta njenega ponudbe): postavke,
//         seštevki, inputHash, VEZANA verzija cenika. Vir za PDF izvoz in
//         zaklep (deal-lock od R374 sprejema SAMO quoteVersionId).
// PATCH — { action: 'issue' }: DRAFT → ISSUED (izdaja = pisarna: quotes.create
//         — isto pravico kot izračun; MONTER jo ima, saj s terena izdaja
//         ponudbo). FAIL-CLOSED pravila:
//           • SAMO action 'issue' (APPROVED se zgodi IZKLJUČNO ob uspešnem
//             zaklepu s podpisom — deal-lock; tu ni poti do njega);
//           • prehod po matriki QUOTE_VERSION_TRANSITIONS (DRAFT→ISSUED),
//             drugačen status → 409 z dovoljenimi cilji;
//           • INTEGRITETA pred izdajo: rekonstrukcija iz inputsJson + VEZANE
//             knjige mora zadeti — pokvarjena/tampirana verzija se NE izda
//             (409, §16 veriga);
//           • dostop 'update' do projekta + revizijski vpis ATOMSKO (§19).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { assertProjectAccess, lacksPermission, actorIdOf, AccessDeniedError } from '@/lib/access'
import { PriceBookStoreError, getPriceBookVersionById } from '@/lib/price-book-store'
import { checkQuoteVersionTransition, verifyQuoteVersionIntegrity } from '@/lib/quote-versions'

import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'
import { auditInTx } from '@/lib/audit'

const patchActionSchema = z.object({
  action: z.literal('issue', { message: "Edino podprto dejanje je 'issue' (izdaja DRAFT verzije)." }),
})

/** Detajl DTO verzije — postavke + seštevki + vezava (§17 minimalni odgovor). */
function verzijaDto(
  v: {
    id: string
    quoteId: string
    versionNumber: number
    status: string
    subtotal: { toNumber(): number }
    vat: { toNumber(): number }
    total: { toNumber(): number }
    currency: string
    inputHash: string
    priceBookVersionId: string
    createdAt: Date
    approvedAt: Date | null
    linesJson: unknown
  },
  projektIme: string,
  priceBookVersionNumber: number | null,
) {
  return {
    id: v.id,
    quoteId: v.quoteId,
    versionNumber: v.versionNumber,
    status: v.status,
    projectName: projektIme,
    subtotal: v.subtotal.toNumber(),
    vat: v.vat.toNumber(),
    total: v.total.toNumber(),
    currency: v.currency,
    inputHash: v.inputHash,
    priceBookVersionId: v.priceBookVersionId,
    priceBookVersion: priceBookVersionNumber,
    lines: v.linesJson,
    createdAt: v.createdAt,
    approvedAt: v.approvedAt,
  }
}

/** Naloži verzijo + njen Quote + Projekt (lastniška vrata). 404, če ne obstaja. */
async function naloziVerzijo(id: string) {
  const version = await db.quoteVersion.findUnique({
    where: { id },
    include: { quote: { include: { project: { select: { id: true, monterId: true, vodjaId: true, nazivProjekta: true } } } } },
  })
  return version
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { id } = await params
    const version = await naloziVerzijo(id)
    if (!version) {
      return NextResponse.json({ error: 'Verzija ponudbe ne obstaja' }, { status: 404 })
    }
    assertProjectAccess(auth, version.quote.project, 'read')

    // Vezana knjiga (samo za prikaz številke verzije — fail-closed na pokvarjeno).
    const bound = await getPriceBookVersionById(version.priceBookVersionId)
    return NextResponse.json({ version: verzijaDto(version, version.quote.project.nazivProjekta, bound?.version ?? null) })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof PriceBookStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    console.error('Quote version GET error:', error)
    return NextResponse.json({ error: 'Napaka pri branju verzije ponudbe' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // R374 — val 2 omejevanja hitrosti na pisanju (WRITE_LIMIT, kind `write`)
  const zavrnjeno = zapisOmejitev(request, 'quotes/[id]')
  if (zavrnjeno) return zavrnjeno

  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  // Izdaja ponudbe = pisarniško/terensko dejanje ISTO pravico kot izračun
  // (quotes.create — ADMIN/VODJA/MONTER). APPROVED NI tu dosegljiv: zgodi se
  // SAMO avtomatsko ob uspešnem zaklepu s podpisom (deal-lock, §3).
  if (lacksPermission(auth, 'quotes.create')) {
    return forbidden('Izdaja ponudbe zahteva uporabniško pravico quotes.create.')
  }
  try {
    const { id } = await params
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const parsed = patchActionSchema.safeParse(telo.telo)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Neveljavni podatki', detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
        { status: 400 },
      )
    }

    const version = await naloziVerzijo(id)
    if (!version) {
      return NextResponse.json({ error: 'Verzija ponudbe ne obstaja' }, { status: 404 })
    }
    assertProjectAccess(auth, version.quote.project, 'update')

    // Statusni stroj (EN VIR — quote-versions.ts): DRAFT → ISSUED.
    const transition = checkQuoteVersionTransition(version.status, 'ISSUED')
    if (!transition.ok) {
      return NextResponse.json(
        {
          error: `Prehod ${version.status} → ISSUED ni dovoljen.`,
          detail: `Dovoljeni cilji: ${transition.allowed.length > 0 ? transition.allowed.join(', ') : '— (terminalno stanje)'}.`,
        },
        { status: 409 },
      )
    }

    // §16 integriteta PRED izdajo: rekonstrukcija iz shranjenih vhodov +
    // VEZANE knjige mora zadeti — pokvarjena verzija se NE izda.
    const bound = await getPriceBookVersionById(version.priceBookVersionId)
    if (!bound) {
      return NextResponse.json(
        { error: 'Vezana verzija cenika ne obstaja — verzije ni mogoče izdati.' },
        { status: 409 },
      )
    }
    const integrity = verifyQuoteVersionIntegrity(
      {
        inputsJson: version.inputsJson,
        linesJson: version.linesJson,
        subtotal: version.subtotal.toNumber(),
        vat: version.vat.toNumber(),
        total: version.total.toNumber(),
        currency: version.currency,
        inputHash: version.inputHash,
      },
      bound.prices,
    )
    if (!integrity.ok) {
      return NextResponse.json(
        { error: 'Integriteta verzije ponudbe nedrži — izdaja je zavrnjena.', detail: integrity.detail },
        { status: 409 },
      )
    }

    const actor = actorIdOf(auth)
    const izdana = await db.$transaction(async (tx) => {
      const updated = await tx.quoteVersion.update({
        where: { id: version.id },
        data: { status: 'ISSUED' },
      })
      await auditInTx(tx, {
        request,
        session: auth.kind === 'user' ? auth.session : null,
        userId: actor,
        projectId: version.quote.projectId,
        akcija: 'QUOTE_VERSION_ISSUED',
        oldValue: { status: version.status, total: version.total.toNumber() },
        newValue: { status: 'ISSUED', total: updated.total.toNumber(), inputHash: version.inputHash },
      })
      return updated
    })

    return NextResponse.json({
      success: true,
      version: verzijaDto(izdana, version.quote.project.nazivProjekta, bound.version),
    })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof PriceBookStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    console.error('Quote version PATCH error:', error)
    return NextResponse.json({ error: 'Napaka pri izdaji verzije ponudbe' }, { status: 500 })
  }
}
