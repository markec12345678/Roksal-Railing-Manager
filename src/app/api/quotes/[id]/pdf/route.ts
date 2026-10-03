// R395 (issue #13, korak R172 iz §16 — SIGNATURE + DOCUMENT CHAIN) —
// API: PONUDBA PDF verzije ponudbe.
// ---------------------------------------------------------------------------
// POST /api/quotes/[id]/pdf — izda NOVO PDF verzijo kanonične ponudbe.
//   [id] = QuoteVersion id (isti kanon kot GET/PATCH /api/quotes/[id]).
//   Kanonična pot (R121 vzorec, document-pdf.ts): verzija ponudbe →
//   renderer (quote-pdf.ts — čista funkcija) → PDF bajti → SHA-256 →
//   object storage (files/documents/<id>/v<n>.pdf) → Document (tip
//   PONUDBA, EN zabojnik na verzijo — partial UNIQUE) + DocumentVersion
//   (quoteVersionId vezava = §16 veriga) + audit V ISTI transakciji.
//   Regeneracija = NOVA verzija (v2, v3 …) — prejšnje ostanejo (trigger
//   document_version_no_update jim BRANI spremembo; neizbrisna sled).
//
//   Vrata (fail-closed):
//     • authenticate + documents.generate (uradni dokument — kanon
//       documents/route.ts; API ključ ne izdaja ponudb);
//     • dostop 'read' do projekta (terensko dejanje, kanon documents POST);
//     • SAMO ISSUED/APPROVED (DRAFT še ni ponudba — §3; REJECTED/SUPERSEDED
//       sta zgodovina, ne tisk);
//     • INTEGRITETA pred izdajo (verifyQuoteVersionIntegrity — pokvarjena
//       verzija se NE izda v PDF, §16 veriga ne nosi laži).
//
// GET /api/quotes/[id]/pdf — seznam PDF verzij te verzije ponudbe (§16
//   vidljivost verige: id/številka/sha256/velikost/čas/URL — brez blob
//   URL-jev, brez vsebine).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { assertProjectAccess, actorLabelOf, lacksPermission, AccessDeniedError } from '@/lib/access'
import { auditInTx } from '@/lib/audit'
import { deleteObject, extensionForMime, objectKey, objectUrlFor, putObject } from '@/lib/object-storage'
import { generateQuotePdf } from '@/lib/quote-pdf'
import { ponudbaKontekst } from '@/lib/document-chain'
import { getPriceBookVersionById, PriceBookStoreError } from '@/lib/price-book-store'
import { verifyQuoteVersionIntegrity, type StoredQuoteVersionCore } from '@/lib/quote-versions'
import type { QuoteItem } from '@/lib/quote'

import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'

/** Naloži verzijo + Quote + Projekt (lastniška vrata). 404, če ne obstaja. */
async function naloziVerzijo(id: string) {
  return db.quoteVersion.findUnique({
    where: { id },
    include: {
      quote: {
        include: { project: { select: { id: true, monterId: true, vodjaId: true, nazivProjekta: true, status: true, customerId: true } } },
      },
    },
  })
}

/** Skupni core za integrity preverbo (ista oblika kot quotes/[id]). */
function integrityCore(version: {
  inputsJson: unknown
  linesJson: unknown
  subtotal: { toNumber(): number }
  vat: { toNumber(): number }
  total: { toNumber(): number }
  currency: string
  inputHash: string
}): StoredQuoteVersionCore {
  return {
    inputsJson: version.inputsJson,
    linesJson: version.linesJson,
    subtotal: version.subtotal.toNumber(),
    vat: version.vat.toNumber(),
    total: version.total.toNumber(),
    currency: version.currency,
    inputHash: version.inputHash,
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // R191 — val 2 omejevanja hitrosti na pisanju (WRITE_LIMIT, kind `write`)
  const zavrnjeno = zapisOmejitev(request, 'quotes/[id]/pdf')
  if (zavrnjeno) return zavrnjeno

  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  // §10 (R135): uraden dokument = documents.generate — uporabniške vloge
  // (API ključ NE izdaja uradnih dokumentov; izrecna, dokumentirana zožitev
  // servisne pogodbe — isti kanon kot /api/documents POST).
  if (lacksPermission(auth, 'documents.generate')) {
    return forbidden('Izdaja PDF ponudbe zahteva uporabniško pravico documents.generate.')
  }
  try {
    const { id } = await params
    // Telo je prazno/odvečno — edini vhod je potna verzija (kanon
    // discipliniranega vnosa: brez klientovih PDF bajtov, §16).
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor

    const version = await naloziVerzijo(id)
    if (!version) {
      return NextResponse.json({ error: 'Verzija ponudbe ne obstaja' }, { status: 404 })
    }
    const projekt = version.quote.project
    // Terensko/pisarniško dejanje brez spremembe poslovnega stanja: 'read'
    // (kanon /api/documents POST — isti vir, isti prag).
    assertProjectAccess(auth, projekt, 'read')

    // §3/§16: PDF ponudbe se izdaja SAMO nad izdano/odobreno verzijo.
    if (version.status === 'DRAFT') {
      return NextResponse.json(
        {
          error:
            'Verzija ponudbe je še osnutek (DRAFT) — najprej jo izdajte (PATCH /api/quotes/[id] action=issue), nato izdajte PDF.',
        },
        { status: 409 },
      )
    }
    if (version.status !== 'ISSUED' && version.status !== 'APPROVED') {
      return NextResponse.json(
        { error: `Verzija ponudbe je v statusu ${version.status} — PDF se izdaja samo nad ISSUED/APPROVED.` },
        { status: 409 },
      )
    }

    // §16 integriteta PRED izdajo (ista preverba kot PATCH issue): PDF je
    // PRAVNI artefakt — pokvarjena/tampirana verzija se ne izda.
    const bound = await getPriceBookVersionById(version.priceBookVersionId)
    if (!bound) {
      return NextResponse.json(
        { error: 'Vezana verzija cenika ne obstaja — PDF ni mogoče izdati.' },
        { status: 409 },
      )
    }
    const integrity = verifyQuoteVersionIntegrity(integrityCore(version), bound.prices)
    if (!integrity.ok) {
      return NextResponse.json(
        { error: 'Integriteta verzije ponudbe nedrži — PDF izdaja je zavrnjena.', detail: integrity.detail },
        { status: 409 },
      )
    }

    // Stranka (prikaz v PDF-ju): stranka ponudbe → stranka projekta.
    const stranka = (await db.customer.findFirst({
      where: { id: version.quote.customerId ?? projekt.customerId ?? undefined },
      select: { ime: true, naslov: true, telefon: true, email: true },
    })) ?? null

    // §16 zabojnik: EN Document (PONUDBA) na verzijo — obstoječi ali nov.
    const kontekst = await ponudbaKontekst(version.id)

    const pdfBytes = generateQuotePdf({
      documentId: kontekst.documentId,
      version: kontekst.nextVersion,
      datumIzdaje: new Date().toISOString(),
      quoteVersion: {
        id: version.id,
        versionNumber: version.versionNumber,
        status: version.status,
        inputHash: version.inputHash,
        subtotal: version.subtotal.toNumber(),
        vat: version.vat.toNumber(),
        total: version.total.toNumber(),
        currency: version.currency,
        lines: version.linesJson as unknown as QuoteItem[],
      },
      project: { naziv: projekt.nazivProjekta, status: projekt.status },
      customer: stranka,
      priceBookVersionNumber: bound.version,
      actor: actorLabelOf(auth),
    })

    // Object storage najprej (R122): bajti → ključ; DB = točka zaveze;
    // kompenzacija ob padcu transakcije (0 sirot).
    const key = objectKey('documents', kontekst.documentId, `v${kontekst.nextVersion}.${extensionForMime('application/pdf')}`)
    const put = await putObject(key, pdfBytes, 'application/pdf')

    try {
      const documentVersion = await db.$transaction(async (tx) => {
        // Zabojnik: NOV (prva izdaja) ali POSODOBLJEN kazalnik aktualne
        // verzije (isti vzorec kot /api/documents POST — master vrstica kaže
        // na zadnji artefakt, zgodovina živi v DocumentVersion).
        if (kontekst.isNewDocument) {
          await tx.document.create({
            data: {
              id: kontekst.documentId,
              projectId: projekt.id,
              tipDokumenta: 'PONUDBA',
              quoteVersionId: version.id,
              storageKey: put.key,
              sha256: put.sha256,
              status: 'GENERIRANO',
            },
          })
        } else {
          await tx.document.update({
            where: { id: kontekst.documentId },
            data: { storageKey: put.key, sha256: put.sha256, status: 'GENERIRANO' },
          })
        }

        const dv = await tx.documentVersion.create({
          data: {
            documentId: kontekst.documentId,
            version: kontekst.nextVersion,
            storageKey: put.key,
            mime: 'application/pdf',
            sizeBytes: put.sizeBytes,
            sha256: put.sha256,
            // §16 veriga: KANONIČNA vezava na verzijo ponudbe.
            quoteVersionId: version.id,
          },
        })

        await auditInTx(tx, {
          request,
          session: auth.kind === 'user' ? auth.session : null,
          userId: auth.kind === 'user' ? auth.session.sub : null,
          projectId: projekt.id,
          akcija: 'QUOTE_PDF_GENERATED',
          newValue: {
            quoteVersionId: version.id,
            quoteVersionNumber: version.versionNumber,
            documentId: kontekst.documentId,
            documentVersionId: dv.id,
            verzija: kontekst.nextVersion,
            storageKey: put.key,
            sha256: put.sha256,
            sizeBytes: put.sizeBytes,
          },
        })

        return dv
      })

      return NextResponse.json(
        {
          documentVersionId: documentVersion.id,
          documentId: kontekst.documentId,
          version: documentVersion.version,
          quoteVersionId: version.id,
          // §16: to je vrednost, nad katero se (ob podpisu) zapiše
          // SignatureAudit.pdfHash — SHA-256 DEJANSKIH PDF bajtov.
          sha256: put.sha256,
          sizeBytes: put.sizeBytes,
          url: objectUrlFor(put.key),
        },
        { status: 201 },
      )
    } catch (dbError) {
      // R122 kompenzacija: transakcija DB padla → zbriši artefakt (0 sirot).
      await deleteObject(key)
      throw dbError
    }
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof PriceBookStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    console.error('Quote PDF POST error:', error)
    return NextResponse.json({ error: 'Napaka pri izdaji PDF ponudbe' }, { status: 500 })
  }
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

    // §16 vidljivost verige: VSE PDF verzije te verzije ponudbe (naraščajoče).
    const versions = await db.documentVersion.findMany({
      where: { quoteVersionId: version.id },
      orderBy: { version: 'asc' },
      select: {
        id: true,
        documentId: true,
        version: true,
        sha256: true,
        sizeBytes: true,
        storageKey: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      quoteVersionId: version.id,
      quoteVersionStatus: version.status,
      versions: versions.map((v) => ({
        id: v.id,
        documentId: v.documentId,
        version: v.version,
        sha256: v.sha256,
        sizeBytes: v.sizeBytes,
        createdAt: v.createdAt,
        url: objectUrlFor(v.storageKey),
      })),
    })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Quote PDF GET error:', error)
    return NextResponse.json({ error: 'Napaka pri branju PDF verzij ponudbe' }, { status: 500 })
  }
}
