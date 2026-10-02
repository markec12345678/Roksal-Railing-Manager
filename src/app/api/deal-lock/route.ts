// Roksal Field - API: Deal Lock (V5 — R374 kanonična poslovna resnica)
// ---------------------------------------------------------------------------
// R374 (issue #13, korak R165 iz §32/§2–§8/§16/§17) REWRITE: zaklep posla je
// vezan EXKLUZIVNO na strežniško izračunano QuoteVersion — klientov
// quoteData (items, seštevki) NI VEČ sprejet (400 z jasnim sporočilom):
// do R372 je lahko klient pošiljal poljuben denar, ki je določal BOM draft,
// marginLocked, estimatedPrice in podpisano vsebino.
//
// POST /api/deal-lock { projectId, quoteVersionId, customerName, monterName,
//                        customerSignature, monterSignature, geoLatitude?,
//                        geoLongitude?, pdfHash? } — strežnik:
//   1. avtentikacija + deal.lock pravica + dostop 'update' do projekta (R120);
//   2. naloži QuoteVersion; pripadati mora TALEMU projektu (prečni → 409);
//   3. status ISSUED ali APPROVED (DRAFT → 409 — nezaključena ponudba se ne
//      podpisuje; ISSUED→APPROVED se zgodi SAMO tu, ob uspešnem podpisu);
//   4. verifyQuoteVersionIntegrity nad VEZANE knjige — tampiranje → 409 (§16);
//   5. BOM draft iz STRUKTURIRANIH postavk verzije (sku = code, qty = qty);
//   6. marginLocked = NAČRTOVANA marža iz referenceCost VEZANE knjige —
//      manjka katerikoli → NULL (iskreno NEZNANO; lažni ×0.6/×0.15 IZBRISANI);
//   7. estimatedPrice = total VEZANE verzije (ne klientov, ne ničel);
//   8. ATOMSKO (ena transakcija): zaklep projekta + SignatureAudit ×2 z
//      quoteVersionId + quoteInputHash (§16 veriga) + verzija → APPROVED +
//      AuditLog; podpisi v object storage (R122 vzorec: bajti PRE transakcije,
//      kompenzacija ob padcu — 0 sirot) + R149 validacija vsebine.
//
// GET ?projectId= (§17 IDOR fix): dostop 'read' do projekta (do R372 se je
//   preverila SAMO prijava) + MINIMALNI DTO — BREZ storageKey/ip/userAgent/
//   deviceFingerprint/geo v odgovoru (allowlist: tip, ime, vloga, veljavnost,
//   verzija, čas). Surovi SignatureAudit NI vračan.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'
import { authenticate, unauthorized } from '@/lib/auth'
import { assertProjectAccess, lacksPermission, AccessDeniedError } from '@/lib/access'
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
      include: { quote: { select: { projectId: true } } },
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
    const bomJson = JSON.stringify(bomDraft)

    // NAČRTOVANA marža iz VEZANE knjige (referenceCost); manjka katerikoli →
    // NULL = iskreno NEZNANO. LAŽNI MODEL (×0.6 material / ×0.15 delo) JE
    // IZBRISAN — §8: nikoli več izmišljeni odstotki iz prihodka.
    const marginSource = new Map(bound.items.map((i) => [i.key, { salesPrice: i.salesPrice, referenceCost: i.referenceCost }]))
    const marginLocked = plannedMargin(lines, marginSource)

    // Skupaj z DDV = total VEZANE verzije (edini vir; klientov vpliv = 0).
    const estimatedPrice = version.total.toNumber()

    // Hash podpisanega dokumenta: prioriteta klientov pdfHash (resnična
    // datoteka), sicer determinističen sintetični hash pogodbenih podatkov —
    // vezan na kanonično verzijo (quoteVersionId + inputHash).
    const pdfHash = body.pdfHash ||
      crypto
        .createHash('sha256')
        .update(`${projectId}|${quoteVersionId}|${version.inputHash}|${customerName}|${monterName}|${bomJson}`)
        .digest('hex')

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
    let updatedProject: Awaited<ReturnType<typeof db.project.update>>
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

      updatedProject = await db.$transaction(async (tx) => {
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

        // §16 veriga: SignatureAudit nosi quoteVersionId + quoteInputHash —
        // podpis je vezan na TOČNO to (nespremenljivo) verzijo ponudbe.
        await tx.signatureAudit.createMany({
          data: [
            {
              id: customerSigId,
              projectId,
              quoteVersionId,
              quoteInputHash: version.inputHash,
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
            customerName,
            monterName,
            total: estimatedPrice,
            marginLocked,
            bomItems: bomDraft.items.length,
            pdfHash,
          },
        })

        return updated
      })
    } catch (txError) {
      // R122 kompenzacija: transakcija DB padla → zbriši že zapisane
      // artefakte podpisov (idempotentno; 0 sirot v object storage).
      for (const k of uploadedSignatureKeys) {
        await deleteObject(k).catch(() => undefined)
      }
      throw txError
    }

    const signatureAuditCount = 2

    return NextResponse.json({
      success: true,
      projectId,
      dealLocked: true,
      dealLockedAt: updatedProject.dealLockedAt,
      status: 'ZA_MONTAZO',
      quoteVersionId,
      quoteInputHash: version.inputHash,
      bomDraft,
      // NULL = načrtovana marža NEZNANA (manjka referenceCost v vezani knjigi).
      marginLocked,
      estimatedPrice,
      pdfHash,
      signatureAuditCount,
    })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
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
        pdfHash: true,
        createdAt: true,
      },
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
