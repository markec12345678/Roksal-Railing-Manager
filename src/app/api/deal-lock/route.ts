// Roksal Field - API: Deal Lock (V5 — R374 kanonična poslovna resnica)
// ---------------------------------------------------------------------------
// R374 (issue #13, korak R165 iz §32/§2–§8/§16/§17) REWRITE: zaklep posla je
// vezan EXKLUZIVNO na strežniško izračunano QuoteVersion — klientov
// quoteData (items, seštevki) NI VEČ sprejet (400 z jasnim sporočilom):
// do R372 je lahko klient pošiljal poljuben denar, ki je določal BOM draft,
// marginLocked, estimatedPrice in podpisano vsebino.
//
// R376 (issue #13, korak R166, §7 BOM vezava): ob zaklepu strežnik
// TRANSAKCIJSKO ustvari tudi KANONIČNO BOMVersion (status APPROVED) iz
// strukturiranih postavk verzije (bomVersionFromQuoteVersion — EXACT inventarne
// vezave, honest NULL stroški §8) in veže OBEMA podpisa nanjo
// (SignatureAudit.bomVersionId). Project.bomDraftJson se ŠE VEDNO piše —
// LEGACY read-model za stari BOM UI, NI KANONIČEN (komentar na mestu zapisa).
//
// R395 (issue #13, korak R172, §16 SIGNATURE + DOCUMENT CHAIN): NEPREKINJENA
// vez QuoteVersion → DocumentVersion → DEJANSKI PDF bajti → SHA-256 →
// SignatureAudit → DealLock:
//   • telo lahko prinese documentVersionId (EXACT PDF verzija, izdana prek
//     POST /api/quotes/[id]/pdf) — rutna jo PREVERI: vezava na TISO verzijo
//     ponudbe, pripadnost projektu, tip PONUDBA, bajti FIZIČNO v storage in
//     RE-HASH bajtov == zabeležen sha256 (document-chain.ts — jedro §16
//     "PDF hash = hash dejanskih PDF bajtov");
//   • brez njega strežnik SAM izda PONUDBA PDF iz kanonične verzije
//     (quote-pdf.ts renderer; bajti PRE transakcije po R122 vzorcu) in
//     podpiše NAD NJIM — klientova pot do tuje/višje vsebine NE OBSTOJA;
//   • klientov pdfHash (do R393 sprejet kot resnica) je DEPRECIERAN: če ga
//     telo pošlje, se MORA ujemati s strežniško izračunanim (409 sicer —
//     odkrito, ne tiho ignoriranje);
//   • SignatureAudit ×2 nosita documentVersionId + pdfHash = sha256 TE
//     verzije dokumenta; BAZA trigger signature_audit_document_chain zavrne
//     nedosledno vrstico TUDI mimo te plasti (migracija r395).
//
// POST /api/deal-lock { projectId, quoteVersionId, customerName, monterName,
//                        customerSignature, monterSignature, geoLatitude?,
//                        geoLongitude?, documentVersionId?, pdfHash? } — strežnik:
//   1. avtentikacija + deal.lock pravica + dostop 'update' do projekta (R120);
//   2. naloži QuoteVersion; pripadati mora TALEMU projektu (prečni → 409);
//   3. status ISSUED ali APPROVED (DRAFT → 409 — nezaključena ponudba se ne
//      podpisuje; ISSUED→APPROVED se zgodi SAMO tu, ob uspešnem podpisu);
//   4. verifyQuoteVersionIntegrity nad VEZANE knjige — tampiranje → 409 (§16);
//   5. §16 DOKUMENTNA VERIGA (zgoraj) — pdfHash = SHA-256 DEJANSKIH PDF bajtov;
//   6. KANONIČNI BOM iz STRUKTURIRANIH postavk verzije (R376 §6/§7) + legacy
//      bomDraftJson (sku = code, qty = qty — brez hevristike);
//   7. marginLocked = NAČRTOVANA marža iz referenceCost VEZANE knjige —
//      manjka katerikoli → NULL (iskreno NEZNANO; lažni ×0.6/×0.15 IZBRISANI);
//   8. estimatedPrice = total VEZANE verzije (ne klientov, ne ničel);
//   9. ATOMSKO (ena transakcija): zaklep projekta + KANONIČNA BOMVersion
//      (APPROVED + supersede prejšnjih DRAFT) + (§16) PONUDBA Document +
//      DocumentVersion + SignatureAudit ×2 z quoteVersionId + quoteInputHash +
//      bomVersionId + documentVersionId (§16/§7 veriga) + verzija → APPROVED +
//      AuditLog; podpisi in PDF v object storage (R122 vzorec: bajti PRE
//      transakcije, kompenzacija ob padcu — 0 sirot) + R149 validacija vsebine.
//
// GET ?projectId= (§17 IDOR fix): dostop 'read' do projekta (do R372 se je
//   preverila SAMO prijava) + MINIMALNI DTO — BREZ storageKey/ip/userAgent/
//   deviceFingerprint/geo v odgovoru (allowlist: tip, ime, vloga, veljavnost,
//   verzija, BOM verzija id/številka/status/št. vrstic, dokument verzija id/št.,
//   čas). Surovi SignatureAudit NI vračan.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'
import { authenticate, unauthorized } from '@/lib/auth'
import { assertProjectAccess, lacksPermission, actorLabelOf, AccessDeniedError } from '@/lib/access'
import { auditInTx } from '@/lib/audit'
import {
  deleteObject,
  extensionForMime,
  objectKey,
  parseDataUri,
  putObject,
} from '@/lib/object-storage'
import { validateUploadContent } from '@/lib/upload-security'

import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'
import { getPriceBookVersionById } from '@/lib/price-book-store'
import type { QuoteItem } from '@/lib/quote'
import { bomDraftFromLines, plannedMargin, verifyQuoteVersionIntegrity } from '@/lib/quote-versions'
import { bomVersionFromQuoteVersion } from '@/lib/bom-versions'
import { naloziInventarneVezave, ustvariBomVerzijoVTx, BomStoreError } from '@/lib/bom-store'
import { ponudbaKontekst, preveriVerzijoDokumenta } from '@/lib/document-chain'
import { generateQuotePdf } from '@/lib/quote-pdf'

interface DealLockRequest {
  projectId: string
  /** R374: OBVEZNO — kanonična verzija ponudbe, nad katero se podpisuje. */
  quoteVersionId: string
  customerName: string
  monterName: string
  customerSignature: string // base64 PNG
  monterSignature: string // base64 PNG
  geoLatitude?: number
  geoLongitude?: number
  /** R395 (§16): EXACT verzija PONUDBA PDF-ja, nad katero se podpisuje
   * (izdana prek POST /api/quotes/[id]/pdf). Opcijsko — brez njega strežnik
   * SAM izda PDF iz kanonične verzije (znotraj istega zaklepa). */
  documentVersionId?: string
  /** ZASTARELO (R395 §16): klientov pdfHash NI VEČ vir resnice — PDF hash je
   * SHA-256 DEJANSKIH PDF bajtov (DocumentVersion). Če ga telo pošlje, se
   * MORA ujemati s strežniškim (409 sicer — odkrito, ne tiho). */
  pdfHash?: string
  /** ZASTARELO (do R372) — klientovi finančni podatki. ZAVRNJENO (400). */
  quoteData?: unknown
}

export async function POST(request: Request) {
  // R191 — val 2 omejevanja hitrosti na pisanju (WRITE_LIMIT, kind `write`)
  const zavrnjeno = zapisOmejitev(request, 'deal-lock')
  if (zavrnjeno) return zavrnjeno

  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const body = telo.telo as DealLockRequest
    const { projectId, quoteVersionId, customerName, monterName, customerSignature, monterSignature } = body

    // R374 §2: klientov quoteData NI VEČ vir resnice — odklonimo JASNO.
    if ('quoteData' in body) {
      return NextResponse.json(
        {
          error:
            'Telo s poljem quoteData ni več podprto (R374): zaklep se veže na strežniško verzijo ponudbe. Pošljite quoteVersionId (glej POST /api/quotes + PATCH /api/quotes/[id] action=issue).',
        },
        { status: 400 },
      )
    }

    if (!projectId || !quoteVersionId || !customerSignature || !monterSignature) {
      return NextResponse.json(
        { error: 'Manjkajo obvezni podatki (projectId, quoteVersionId, podpisi)' },
        { status: 400 },
      )
    }

    // Preveri ali projekt obstaja in ali je že zaklenjen
    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ error: 'Projekt ni najden' }, { status: 404 })
    }
    // R120 vzorec: zaklep posla je poslovno kritično dejanje → 'update'
    // (lastni monter/vodja ali upravitelj; servisni ključ ne zaklepa poslov).
    // §10 (R135): + konkretna pravica deal.lock (ADMIN/VODJA/MONTER —
    // podpis poteka na terenu, zato monter ohrani pravico; SKLADISCE/apikey ne).
    if (lacksPermission(auth, 'deal.lock')) {
      return NextResponse.json(
        { error: 'Zaklep posla zahteva pravico deal.lock.' },
        { status: 403 }
      )
    }
    assertProjectAccess(auth, project, 'update')
    if (project.dealLocked) {
      return NextResponse.json({ error: 'Deal je že zaklenjen', dealLockedAt: project.dealLockedAt }, { status: 409 })
    }

    // ── KANONIČNA VERZIJA (§2/§3): naloži + vrata ──────────────────────────
    const version = await db.quoteVersion.findUnique({
      where: { id: quoteVersionId },
      // R395 §16: customerId potrebujemo za PONUDBA PDF (stranka ponudbe).
      include: { quote: { select: { projectId: true, customerId: true } } },
    })
    if (!version) {
      return NextResponse.json({ error: 'Verzija ponudbe ne obstaja' }, { status: 404 })
    }
    // Prečni projekt: verzija TUJEGA projekta se ne podpisuje pod ta projekt.
    if (version.quote.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Verzija ponudbe ne pripada temu projektu (prečni dostop zavrnjen).' },
        { status: 409 },
      )
    }
    // DRAFT se ne podpisuje (§3): samo izdana (ali že odobrena) verzija.
    if (version.status === 'DRAFT') {
      return NextResponse.json(
        {
          error: 'Verzija ponudbe je še osnutek (DRAFT) — najprej jo izdajte (PATCH /api/quotes/[id] action=issue).',
        },
        { status: 409 },
      )
    }
    if (version.status !== 'ISSUED' && version.status !== 'APPROVED') {
      return NextResponse.json(
        {
          error: `Verzija ponudbe je v statusu ${version.status} — zaklep je mogoč samo nad ISSUED/APPROVED.`,
        },
        { status: 409 },
      )
    }

    // ── INTEGRITETA nad VEZANO knjigo (§16) ───────────────────────────────
    const bound = await getPriceBookVersionById(version.priceBookVersionId)
    if (!bound) {
      return NextResponse.json(
        { error: 'Vezana verzija cenika ne obstaja — zaklep je zavrnjen.' },
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
        { error: 'Integriteta verzije ponudbe nedrži — zaklep je zavrnjen.', detail: integrity.detail },
        { status: 409 },
      )
    }

    // ── Strežniška resnica iz verzije (§7/§8) ─────────────────────────────
    const lines = version.linesJson as unknown as QuoteItem[]
    const bomDraft = bomDraftFromLines(lines, project.nazivProjekta, version.total.toNumber(), new Date().toISOString())
    // R376 §6: KANONIČNI BOM — vrstice iz strukturiranih postavk + EXACT
    // inventarne vezave (sifraMateriala === code, brez fuzzy) + honest NULL
    // stroški (§8). Izračun PRE transakcije (baza se ne dotika); zapis pa
    // ATOMSKO znotraj nje spodaj.
    const inventoryBindings = await naloziInventarneVezave(lines)
    const computedBom = bomVersionFromQuoteVersion(
      { linesJson: version.linesJson, inputHash: version.inputHash },
      bound.items,
      inventoryBindings,
      new Date().toISOString(),
    )
    // LEGACY read-model (NI kanoničen od R376 — kanonični vir je BOMVersion):
    const bomJson = JSON.stringify(bomDraft)

    // NAČRTOVANA marža iz VEZANE knjige (referenceCost); manjka katerikoli →
    // NULL = iskreno NEZNANO. LAŽNI MODEL (×0.6 material / ×0.15 delo) JE
    // IZBRISAN — §8: nikoli več izmišljeni odstotki iz prihodka.
    const marginSource = new Map(bound.items.map((i) => [i.key, { salesPrice: i.salesPrice, referenceCost: i.referenceCost }]))
    const marginLocked = plannedMargin(lines, marginSource)

    // Skupaj z DDV = total VEZANE verzije (edini vir; klientov vpliv = 0).
    const estimatedPrice = version.total.toNumber()

    // ── §16 (R395): DOKUMENTNA VERIGA — QuoteVersion → DocumentVersion →
    //    dejanski PDF bajti → SHA-256 → SignatureAudit → zaklep ──────────
    // (a) telo je prineslo documentVersionId → EXACT preverba (vezava na
    //     TISO verzijo ponudbe + projekt + tip PONUDBA + bajti FIZIČNO v
    //     storage + RE-HASH bajtov == zabeležen sha256 — document-chain.ts);
    // (b) sicer strežnik SAM izda PONUDBA PDF iz kanonične verzije
    //     (bajti PRE transakcije, R122 vzorec — kompenzacija spodaj);
    // (c) klientov pdfHash (ZASTARELO) se SAMO preveri proti strežniškemu.
    let pdfHash: string
    let podpisanaDokumentVerzija: {
      id: string
      documentId: string
      version: number
      sha256: string
      sizeBytes: number
    }
    // Samo za pot (b) — zapis v transakciji + kompenzacija ob padcu:
    let novPdf: { documentId: string; version: number; key: string; sizeBytes: number; isNewDocument: boolean } | null = null
    if (body.documentVersionId) {
      const preverba = await preveriVerzijoDokumenta(body.documentVersionId, quoteVersionId, projectId)
      if (!preverba.ok) {
        return NextResponse.json({ error: preverba.error }, { status: preverba.status })
      }
      podpisanaDokumentVerzija = {
        id: preverba.dv.id,
        documentId: preverba.dv.documentId,
        version: preverba.dv.version,
        sha256: preverba.dv.sha256,
        sizeBytes: preverba.dv.sizeBytes,
      }
      pdfHash = preverba.dv.sha256
    } else {
      const kontekst = await ponudbaKontekst(version.id)
      const stranka = (await db.customer.findFirst({
        where: { id: version.quote.customerId ?? project.customerId ?? undefined },
        select: { ime: true, naslov: true, telefon: true, email: true },
      })) ?? null
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
          lines,
        },
        project: { naziv: project.nazivProjekta, status: project.status },
        customer: stranka,
        priceBookVersionNumber: bound.version,
        actor: actorLabelOf(auth),
      })
      const pdfKey = objectKey('documents', kontekst.documentId, `v${kontekst.nextVersion}.${extensionForMime('application/pdf')}`)
      const put = await putObject(pdfKey, pdfBytes, 'application/pdf')
      novPdf = {
        documentId: kontekst.documentId,
        version: kontekst.nextVersion,
        key: put.key,
        sizeBytes: put.sizeBytes,
        isNewDocument: kontekst.isNewDocument,
      }
      podpisanaDokumentVerzija = {
        id: '', // določi se znotraj transakcije (create vrne id)
        documentId: kontekst.documentId,
        version: kontekst.nextVersion,
        sha256: put.sha256,
        sizeBytes: put.sizeBytes,
      }
      pdfHash = put.sha256
    }
    // (c) ZASTARELI klientov pdfHash: odkrita preverba ujemanja (409).
    if (body.pdfHash && body.pdfHash !== pdfHash) {
      return NextResponse.json(
        {
          error:
            'Poslani pdfHash se ne ujema s strežniškim SHA-256 podpisovanega PDF-ja (R395 §16 — hash izhaja IZKLJUČNO iz dejanskih PDF bajtov).',
        },
        { status: 409 },
      )
    }

    // IP + User-Agent iz headers (za audit — NE v GET odgovoru, §17)
    const forwarded = request.headers.get('x-forwarded-for')
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const deviceFingerprint = crypto
      .createHash('sha256')
      .update(`${ipAddress}|${userAgent}`)
      .digest('hex')
      .slice(0, 16)

    // R122 — podpisi v object storage (isti vzorec kot photos R121):
    //   bajti (data URI) → putObject ŠE PRE transakcije → v tx SE ZAPIŠE
    //   SAMO metadata (storageKey/mime/sizeBytes/sha256, signatureImage=null)
    //   → ob padcu transakcije kompenzacija deleteObject (0 sirot).
    //   Fail-closed: neveljaven/neobvladljiv podpis = 400, NI tišega "samo DB".
    const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024 // 2 MB na podpis (PNG poteza)
    const customerParsed = parseDataUri(customerSignature, MAX_SIGNATURE_BYTES)
    const monterParsed = parseDataUri(monterSignature, MAX_SIGNATURE_BYTES)
    if (!customerParsed || !monterParsed) {
      return NextResponse.json(
        { error: 'Neveljaven podpis (pričakovan base64 PNG data URI, ≤2 MB).' },
        { status: 400 },
      )
    }
    // R149 (§37 Upload security): podpis je PNG poteza — deklaracija se
    // preveri proti magičnim bajtom (SVG/HTML/okoromanjan bajti zavrnjeni).
    const customerCheck = validateUploadContent(customerParsed.mime, customerParsed.bytes)
    if (!customerCheck.ok) {
      return NextResponse.json(
        { error: `Podpis stranke: ${customerCheck.reason}` },
        { status: 400 },
      )
    }
    const monterCheck = validateUploadContent(monterParsed.mime, monterParsed.bytes)
    if (!monterCheck.ok) {
      return NextResponse.json({ error: `Podpis monterja: ${monterCheck.reason}` }, { status: 400 })
    }
    const customerSigId = crypto.randomUUID()
    const monterSigId = crypto.randomUUID()
    const customerKey = objectKey(
      'signatures',
      customerSigId,
      `podpis.${extensionForMime(customerParsed.mime)}`,
    )
    const monterKey = objectKey(
      'signatures',
      monterSigId,
      `podpis.${extensionForMime(monterParsed.mime)}`,
    )
    // Artefakti se zapišejo PRE transakcije; ključi ostanejo lokalni — ob
    // padcu transakcije spodaj jih kompenzacija zbriše (0 sirot).
    const uploadedSignatureKeys: string[] = []
    // R376: transakcija vrne { project, bomVerzija } — zaklep IN kanonična
    // BOM verzija sta ENA atomarna enota (§7).
    let transactionResult: { project: Awaited<ReturnType<typeof db.project.update>>; bomVerzija: Awaited<ReturnType<typeof ustvariBomVerzijoVTx>> }
    try {
      await putObject(customerKey, customerParsed.bytes, customerParsed.mime)
      uploadedSignatureKeys.push(customerKey)
      await putObject(monterKey, monterParsed.bytes, monterParsed.mime)
      uploadedSignatureKeys.push(monterKey)

      // ATOMSKO: zaklep + verzija → APPROVED + podpisna revizija + audit v
      // ENI transakciji (E2E veriga issue #9 je dokazala, da ločen update
      // pusti zaklenjen projekt brez revizijskega vnosa in vrne 500).
      // userId = prijavljeni uporabnik (FK na Profile); servisni ključ → null.
      const actorId = auth.kind === 'user' ? auth.session.sub : null

      transactionResult = await db.$transaction(async (tx) => {
        const updated = await tx.project.update({
          where: { id: projectId },
          data: {
            dealLocked: true,
            dealLockedAt: new Date(),
            dealSignedBy: customerName,
            dealSignedByMonter: monterName,
            dealSignatureIp: ipAddress,
            dealSignatureDevice: userAgent,
            bomDraftJson: bomJson,
            // NULL = marža NEZNANA (iskreno) — ne izmišljeni odstotki (§8).
            marginLocked,
            status: 'ZA_MONTAZO',
            estimatedPrice,
          },
        })

        // R376 §7: KANONIČNA BOM verzija (APPROVED) ATOMSKO z zaklepom —
        // supersede prejšnjih DRAFT verzij naredi EN VIR (bom-store). Podpisa
        // se nanjo vežeta prek SignatureAudit.bomVersionId spodaj (§16/§7).
        const bomVerzija = await ustvariBomVerzijoVTx(tx, {
          projectId,
          sourceQuoteVersionId: version.id,
          priceBookVersionId: version.priceBookVersionId,
          status: 'APPROVED',
          computed: computedBom,
          actorId,
          now: new Date(),
        })

        // §16 (R395): PONUDBA PDF — če ga telo NI prineslo, ga strežnik izda
        // SAMO (atomsko z zaklepom): zabojnik Document (tip PONUDBA, vezan
        // na verzijo ponudbe — partial UNIQUE je zadnja linija) + NOVA
        // DocumentVersion (bajti so ŽE v object storage zgoraj; tu SAMO
        // metadata). Zelo namenoma PRED SignatureAudit zapisom: baza trigger
        // signature_audit_document_chain zahteva, da verzija, ki jo podpis
        // referencira, ŽE obstaja znotraj transakcije.
        if (novPdf) {
          if (novPdf.isNewDocument) {
            await tx.document.create({
              data: {
                id: novPdf.documentId,
                projectId,
                tipDokumenta: 'PONUDBA',
                quoteVersionId: version.id,
                storageKey: novPdf.key,
                sha256: podpisanaDokumentVerzija.sha256,
                status: 'GENERIRANO',
              },
            })
          } else {
            await tx.document.update({
              where: { id: novPdf.documentId },
              data: { storageKey: novPdf.key, sha256: podpisanaDokumentVerzija.sha256, status: 'GENERIRANO' },
            })
          }
          const novaDv = await tx.documentVersion.create({
            data: {
              documentId: novPdf.documentId,
              version: novPdf.version,
              storageKey: novPdf.key,
              mime: 'application/pdf',
              sizeBytes: novPdf.sizeBytes,
              sha256: podpisanaDokumentVerzija.sha256,
              quoteVersionId: version.id,
            },
          })
          podpisanaDokumentVerzija = { ...podpisanaDokumentVerzija, id: novaDv.id }
        }

        // §16/§7 veriga: SignatureAudit nosi quoteVersionId + quoteInputHash +
        // bomVersionId + documentVersionId — podpis je vezan na TOČNO to
        // (nespremenljivo) verzijo ponudbe, kanonično BOM verzijo, ustvarjeno
        // ob zaklepu, IN EXACT verzijo PDF dokumenta (pdfHash = njen sha256,
        // izračunan nad DEJANSKIMI bajti — trigger čuva nadalje).
        await tx.signatureAudit.createMany({
          data: [
            {
              id: customerSigId,
              projectId,
              quoteVersionId,
              quoteInputHash: version.inputHash,
              bomVersionId: bomVerzija.versionId,
              documentVersionId: podpisanaDokumentVerzija.id,
              signatureType: 'CUSTOMER',
              signedByName: customerName,
              signedByRole: 'stranka',
              signatureImage: null,
              storageKey: customerKey,
              mime: customerParsed.mime,
              sizeBytes: customerParsed.bytes.length,
              sha256: crypto.createHash('sha256').update(customerParsed.bytes).digest('hex'),
              ipAddress,
              userAgent,
              deviceFingerprint,
              geoLatitude: body.geoLatitude || null,
              geoLongitude: body.geoLongitude || null,
              pdfHash,
            },
            {
              id: monterSigId,
              projectId,
              quoteVersionId,
              quoteInputHash: version.inputHash,
              bomVersionId: bomVerzija.versionId,
              documentVersionId: podpisanaDokumentVerzija.id,
              signatureType: 'MONTER',
              signedByName: monterName,
              signedByRole: 'monter',
              signatureImage: null,
              storageKey: monterKey,
              mime: monterParsed.mime,
              sizeBytes: monterParsed.bytes.length,
              sha256: crypto.createHash('sha256').update(monterParsed.bytes).digest('hex'),
              ipAddress,
              userAgent,
              deviceFingerprint,
              pdfHash,
            },
          ],
        })

        // §3: ISSUED → APPROVED SAMO ob uspešnem zaklepu s podpisom —
        // ATOMSKO z zaklepom (tipična tranzicija; APPROVED ostane kot je).
        if (version.status === 'ISSUED') {
          await tx.quoteVersion.update({
            where: { id: version.id },
            data: { status: 'APPROVED', approvedById: actorId, approvedAt: new Date() },
          })
        }

        await auditInTx(tx, {
          request,
          session: auth.kind === 'user' ? auth.session : null,
          userId: actorId,
          projectId,
          akcija: 'DEAL_LOCKED',
          oldValue: { dealLocked: project.dealLocked, status: project.status },
          newValue: {
            quoteVersionId,
            quoteInputHash: version.inputHash,
            bomVersionId: bomVerzija.versionId,
            bomVersionNumber: bomVerzija.versionNumber,
            bomLineCount: bomVerzija.lineCount,
            // §16 veriga dokumenta: EXACT verzija PONUDBA PDF-ja + njen
            // SHA-256 (hash DEJANSKIH PDF bajtov v object storage).
            documentVersionId: podpisanaDokumentVerzija.id,
            documentVersionNumber: podpisanaDokumentVerzija.version,
            customerName,
            monterName,
            total: estimatedPrice,
            marginLocked,
            bomItems: bomDraft.items.length,
            pdfHash,
          },
        })

        return { project: updated, bomVerzija }
      })
    } catch (txError) {
      // R122 kompenzacija: transakcija DB padla → zbriši že zapisane
      // artefakte podpisov IN (R395) morebitni samodejno izdani PONUDBA PDF
      // (idempotentno; 0 sirot v object storage).
      for (const k of uploadedSignatureKeys) {
        await deleteObject(k).catch(() => undefined)
      }
      if (novPdf) {
        await deleteObject(novPdf.key).catch(() => undefined)
      }
      throw txError
    }

    const updatedProject = transactionResult.project
    const bomVerzija = transactionResult.bomVerzija

    const signatureAuditCount = 2

    return NextResponse.json({
      success: true,
      projectId,
      dealLocked: true,
      dealLockedAt: updatedProject.dealLockedAt,
      status: 'ZA_MONTAZO',
      quoteVersionId,
      quoteInputHash: version.inputHash,
      // R376 §7: KANONIČNA BOM verzija, ustvarjena ob zaklepu (minimalni DTO —
      // vrstice so na GET /api/bom/[id], agregati na /api/bom/procurement).
      bomVersion: {
        id: bomVerzija.versionId,
        versionNumber: bomVerzija.versionNumber,
        status: bomVerzija.status,
        lineCount: bomVerzija.lineCount,
      },
      bomDraft,
      // NULL = načrtovana marža NEZNANA (manjka referenceCost v vezani knjigi).
      marginLocked,
      estimatedPrice,
      // §16 (R395): EXACT verzija PONUDBA PDF-ja, nad katero je podpis dan —
      // pdfHash = njen SHA-256 (izračunan nad DEJANSKIMI bajti; minimalni DTO
      // brez storageKey/sha256 polj — enak kanon kot bomVersion zgoraj).
      documentVersion: {
        id: podpisanaDokumentVerzija.id,
        versionNumber: podpisanaDokumentVerzija.version,
        sizeBytes: podpisanaDokumentVerzija.sizeBytes,
      },
      pdfHash,
      signatureAuditCount,
    })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof BomStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    console.error('Deal Lock Error:', error)
    return NextResponse.json({ error: 'Napaka pri zaklepu deal-a' }, { status: 500 })
  }
}

// GET — preveri stanje deal lock-a za projekt (§17: resource access + minimalni DTO)
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

    // R374 §17 (IDOR fix): prej je preverba zahtevala SAMO prijavo — vsak
    // avtenticiran uporabnik je bral zaklep TUJEGA projekta. Zdaj: vrata na
    // ravni vira ('read' — ista kot vse projektne rute).
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        monterId: true,
        vodjaId: true,
        dealLocked: true,
        dealLockedAt: true,
        dealSignedBy: true,
        dealSignedByMonter: true,
        status: true,
        marginLocked: true,
        estimatedPrice: true,
        bomDraftJson: true,
      },
    })
    assertProjectAccess(auth, project, 'read')
    if (!project) {
      return NextResponse.json({ error: 'Projekt ni najden' }, { status: 404 })
    }

    const signatures = await db.signatureAudit.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        // §17 MINIMALNI DTO (allowlist): BREZ storageKey/ipAddress/userAgent/
        // deviceFingerprint/geoLatitude/geoLongitude/signatureImage/sha256.
        id: true,
        signatureType: true,
        signedByName: true,
        signedByRole: true,
        isValid: true,
        quoteVersionId: true,
        quoteInputHash: true,
        bomVersionId: true,
        // §16 (R395): veriga dokumenta — EXACT verzija PONUDBA PDF-ja.
        documentVersionId: true,
        pdfHash: true,
        createdAt: true,
      },
    })

    // R376 §7: KANONIČNA BOM verzija projekta (najnovejša po številki) —
    // minimalni DTO (id/številka/status/št. vrstic); vrstice so na
    // GET /api/bom/[id], procurement agregati na GET /api/bom/procurement.
    const bomVersionRow = await db.bOMVersion.findFirst({
      where: { bom: { projectId } },
      orderBy: { versionNumber: 'desc' },
      select: { id: true, versionNumber: true, status: true, _count: { select: { lines: true } } },
    })

    return NextResponse.json({
      projectId: project.id,
      dealLocked: project.dealLocked,
      dealLockedAt: project.dealLockedAt,
      dealSignedBy: project.dealSignedBy,
      dealSignedByMonter: project.dealSignedByMonter,
      status: project.status,
      marginLocked: project.marginLocked,
      estimatedPrice: project.estimatedPrice,
      bomDraft: project.bomDraftJson ? JSON.parse(project.bomDraftJson) : null,
      // R376 §7: kanonična BOM verzija (null = projekt še brez zaklepa/BOM).
      bomVersion: bomVersionRow
        ? {
            id: bomVersionRow.id,
            versionNumber: bomVersionRow.versionNumber,
            status: bomVersionRow.status,
            lineCount: bomVersionRow._count.lines,
          }
        : null,
      signatures,
    })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Deal Lock GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju deal lock-a' }, { status: 500 })
  }
}
