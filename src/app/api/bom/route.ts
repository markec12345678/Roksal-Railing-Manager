// R376 (issue #13, korak R166 iz §5/§6/§11) — API: kanonični BOM projekta.
// ---------------------------------------------------------------------------
// GET  — seznam BOM nosilca + VSEH verzij projekta (?projectId=; dostop
//        'read' do projekta — ista vrata kot vse projektne rute). Vrača
//        minimalni seznam verzij (brez vrstic — detajl je GET /api/bom/[id],
//        agregati so na GET /api/bom/procurement). Brez BOM → { bom: null }.
// POST — izpeljava NOVE verzije BOM kot DRAFT iz kanonične verzije ponudbe:
//          vhod  = { projectId, quoteVersionId } (SAMO povezavi — vrstice,
//                   količine, cene izhajajojo IZKLJUČNO iz strežniške
//                   verzije ponudbe; klient jih NE pošilja);
//          stroj = naloži verzijo → vrata (prečni projekt → 409; status
//                   REJECTED/SUPERSEDED → 409; DRAFT/ISSUED/APPROVED grejo
//                   skozi) → verifyQuoteVersionIntegrity nad VEZANE knjige
//                   (tampiranje → 409, §16) → bomVersionFromQuoteVersion
//                   (EXACT inventarne vezave, honest NULL stroški §8) →
//                   TRANSAKCIJSKO: supersede prejšnjih DRAFT verzij + nova
//                   DRAFT verzija + vrstice + revizijski vpis (§19).
//
// Pravice (§10 matrika je ZAMRZNJENA — dodajanje bom.* dovoljenja je
// lastniška odločitev, ne rundna): izpeljava BOM iz ponudbe pokriva
// OBSTOJEČE dovoljenje quotes.create — katalog §10 ga izrecno opisuje kot
// »Izračun ponudbe (kalkulator/BOM)« — + dostop 'update' do projekta
// (poslovni zapis NA projektu; servisni ključ BOM ne izpeljuje — ista
// ograda kot POST /api/quotes). Zaklenjen projekt → 409 (BOM je po zaklepu
// nespremenljiv; sprememba = eksplicitna nova verzija/change order, ki je
// izven te runde — iskreno dokumentirano).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { assertProjectAccess, lacksPermission, actorIdOf, AccessDeniedError } from '@/lib/access'
import { PriceBookStoreError, getPriceBookVersionById } from '@/lib/price-book-store'
import { verifyQuoteVersionIntegrity } from '@/lib/quote-versions'
import type { QuoteItem } from '@/lib/quote'
import { bomVersionFromQuoteVersion } from '@/lib/bom-versions'
import { BomStoreError, naloziInventarneVezave, ustvariBomVerzijoVTx } from '@/lib/bom-store'

import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'
import { auditInTx } from '@/lib/audit'

const novaBomVerzijaSchema = z.object({
  projectId: z.string().min(1, 'projectId je obvezen').max(64),
  quoteVersionId: z.string().min(1, 'quoteVersionId je obvezen').max(64),
})

export async function GET(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, monterId: true, vodjaId: true, nazivProjekta: true, dealLocked: true },
    })
    assertProjectAccess(auth, project, 'read')

    // Nosilec + vse verzije (novost prvo). Brez nosilca → { bom: null }
    // (iskreno prazno stanje — projekt še ni imel zaklepa niti osnutka).
    const bom = await db.bOM.findUnique({
      where: { projectId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          select: {
            id: true,
            versionNumber: true,
            status: true,
            sourceQuoteVersionId: true,
            priceBookVersionId: true,
            productSdkVersion: true,
            layoutFingerprint: true,
            createdAt: true,
            approvedAt: true,
            _count: { select: { lines: true } },
          },
        },
      },
    })
    if (!bom) {
      return NextResponse.json({ projectId, bom: null })
    }
    return NextResponse.json({
      projectId,
      bom: {
        id: bom.id,
        status: bom.status,
        createdAt: bom.createdAt,
        dealLocked: project!.dealLocked,
        versions: bom.versions.map((v) => ({
          id: v.id,
          versionNumber: v.versionNumber,
          status: v.status,
          sourceQuoteVersionId: v.sourceQuoteVersionId,
          priceBookVersionId: v.priceBookVersionId,
          productSdkVersion: v.productSdkVersion,
          layoutFingerprint: v.layoutFingerprint,
          lineCount: v._count.lines,
          createdAt: v.createdAt,
          approvedAt: v.approvedAt,
        })),
      },
    })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('BOM GET error:', error)
    return NextResponse.json({ error: 'Napaka pri branju BOM' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  // R376 — val 2 omejevanje hitrosti na pisanju (WRITE_LIMIT, kind `write`)
  const zavrnjeno = zapisOmejitev(request, 'bom')
  if (zavrnjeno) return zavrnjeno

  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  // §10 (R135): izpeljava BOM iz ponudbe = quotes.create (katalog ga izrecno
  // opisuje kot »Izračun ponudbe (kalkulator/BOM)«); MONTER jo ima (teren
  // izpelje BOM za nabavo), SKLADISCE/apikey ne.
  if (lacksPermission(auth, 'quotes.create')) {
    return forbidden('Izpeljava BOM iz ponudbe zahteva uporabniško pravico quotes.create.')
  }
  try {
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const parsed = novaBomVerzijaSchema.safeParse(telo.telo)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Neveljavni podatki', detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
        { status: 400 },
      )
    }
    const { projectId, quoteVersionId } = parsed.data

    // Vrata na ravni vira: BOM je poslovni zapis NA projektu.
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, monterId: true, vodjaId: true, dealLocked: true },
    })
    assertProjectAccess(auth, project, 'update')
    if (project!.dealLocked) {
      return NextResponse.json(
        {
          error:
            'Zaklenjen projekt — BOM je nespremenljiv (sprememba = eksplicitna nova verzija/change order).',
        },
        { status: 409 },
      )
    }

    // ── Kanonična verzija ponudbe (§6 sled izvora) ────────────────────────
    const version = await db.quoteVersion.findUnique({
      where: { id: quoteVersionId },
      include: { quote: { select: { projectId: true } } },
    })
    if (!version) {
      return NextResponse.json({ error: 'Verzija ponudbe ne obstaja' }, { status: 404 })
    }
    if (version.quote.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Verzija ponudbe ne pripada temu projektu (prečni dostop zavrnjen).' },
        { status: 409 },
      )
    }
    if (version.status === 'REJECTED' || version.status === 'SUPERSEDED') {
      return NextResponse.json(
        {
          error: `Verzija ponudbe je v statusu ${version.status} — BOM iz zavrnjene/nadomeščene verzije ni mogoče izpeljati.`,
        },
        { status: 409 },
      )
    }

    // §16 integriteta PRED izpeljavo: rekonstrukcija iz shranjenih vhodov +
    // VEZANE knjige mora zadeti — pokvarjena verzija NE sme postati vir BOM.
    const bound = await getPriceBookVersionById(version.priceBookVersionId)
    if (!bound) {
      return NextResponse.json(
        { error: 'Vezana verzija cenika ne obstaja — BOM ni mogoče izpeljati.' },
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
        { error: 'Integriteta verzije ponudbe nedrži — izpeljava BOM je zavrnjena.', detail: integrity.detail },
        { status: 409 },
      )
    }

    // ── Kanonična generacija (čisto jedro + EXACT vezave) ─────────────────
    const lines = version.linesJson as unknown as QuoteItem[]
    const inventoryBindings = await naloziInventarneVezave(lines)
    const computed = bomVersionFromQuoteVersion(
      { linesJson: version.linesJson, inputHash: version.inputHash },
      bound.items,
      inventoryBindings,
      new Date().toISOString(),
    )

    const actor = actorIdOf(auth)
    // R294 F4: stena ure živi v ruti — en trenutek za celo transakcijo.
    const zdaj = new Date()
    const ustvarjena = await db.$transaction(async (tx) => {
      const out = await ustvariBomVerzijoVTx(tx, {
        projectId,
        sourceQuoteVersionId: version.id,
        priceBookVersionId: version.priceBookVersionId,
        status: 'DRAFT',
        computed,
        actorId: actor,
        now: zdaj,
      })
      await auditInTx(tx, {
        request,
        session: auth.kind === 'user' ? auth.session : null,
        userId: actor,
        projectId,
        akcija: 'BOM_VERSION_CREATED',
        oldValue: null,
        newValue: {
          bomId: out.bomId,
          versionId: out.versionId,
          versionNumber: out.versionNumber,
          status: 'DRAFT',
          sourceQuoteVersionId: version.id,
          priceBookVersionId: version.priceBookVersionId,
          lineCount: out.lineCount,
          layoutFingerprint: computed.layoutFingerprint,
          productSdkVersion: computed.productSdkVersion,
        },
      })
      return out
    })

    return NextResponse.json(
      {
        success: true,
        bomId: ustvarjena.bomId,
        version: {
          id: ustvarjena.versionId,
          versionNumber: ustvarjena.versionNumber,
          status: ustvarjena.status,
          lineCount: ustvarjena.lineCount,
          sourceQuoteVersionId: version.id,
          priceBookVersionId: version.priceBookVersionId,
          productSdkVersion: computed.productSdkVersion,
          layoutFingerprint: computed.layoutFingerprint,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof PriceBookStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    if (error instanceof BomStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    console.error('BOM POST error:', error)
    return NextResponse.json({ error: 'Napaka pri izpeljavi BOM' }, { status: 500 })
  }
}
