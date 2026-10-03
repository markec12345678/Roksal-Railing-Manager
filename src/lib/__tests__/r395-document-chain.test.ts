// R395 — SIGNATURE + DOCUMENT CHAIN (issue #13, korak R172 iz §16).
// ---------------------------------------------------------------------------
// Integracijski testi NAD ROUTNIMA HANDLERJEMA (POST/GET
// /api/quotes/[id]/pdf, POST/GET /api/deal-lock, GET /api/signature-audit)
// proti testni bazi — isti vzorec kot r374/r376 (kanon "rute direktno,
// brez HTTP strežnika"):
//
//   (1) POST PDF: DRAFT → 409 (§3 — osnutek ni ponudba); brez prijave → 401;
//       SKLADISCE brez documents.generate → 403;
//   (2) POST PDF nad ISSUED → 201: Document (PONUDBA, vezan na verzijo) +
//       DocumentVersion (quoteVersionId) + sha256 == SHA-256 DEJANSKIH bajtov
//       ( getObject → sha256Of — dokaz "hash dejanskih PDF bajtov" );
//       regeneracija → v2 v ISTEM zabojniku; GET seznam → obe verziji;
//   (3) ZAKLEP brez documentVersionId → strežnik SAM izda PONUDBA PDF:
//       SignatureAudit ×2 z documentVersionId + pdfHash == DV.sha256 ==
//       sha256(bajti v storage) — NEPREKINJENA §16 veriga;
//   (4) ZAKLEP Z documentVersionId (izdana prek PDF rute) → podpis nad EXACT
//       verzijo: SignatureAudit.documentVersionId == ta verzija;
//   (5) TAMPERED bajti: PDF artefakt v storage prepisan → 409
//       "PDF bajti se ne ujemajo" (zapečatenje NE drži — odkrito);
//   (6) PREČNA verzija: documentVersionId DRUGE verzije ponudbe → 409;
//   (7) KLIENTOV pdfHash (ZASTARELO): neujemanje → 409 (klient NE more
//       potrditi tujega dokumenta);
//   (8) BAZA trigger document_version_no_update: UPDATE vrstice → zavrnjen
//       (immutable DocumentVersion — tudi mimo store-plasti);
//   (9) BAZA trigger quote_version_signed_immutable: PODPISANA (APPROVED)
//       verzija — vsebina IN status zamrznjena (tiha sprememba zavrnjena);
//  (10) BAZA trigger signature_audit_document_chain: vrstica z documentVersionId
//       + napačnim pdfHash → zavrnjena (vrstica NE pristane);
//  (11) signature-audit GET: MINIMALNI DTO (brez ip/UA/fingerprint/geo — §16)
//       + §16 veriga (documentVersionId) + IDOR vrata (tujec → 403);
//  (12) deal-lock GET: signatures nosijo documentVersionId (veriga vidna).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import { POST as dealLockPost, GET as dealLockGet } from '@/app/api/deal-lock/route'
import { POST as pdfPost, GET as pdfGet } from '@/app/api/quotes/[id]/pdf/route'
import { GET as sigAuditGet } from '@/app/api/signature-audit/route'
import { computeQuoteVersion } from '@/lib/quote-versions'
import { getActivePriceBookVersion } from '@/lib/price-book-store'
import { deleteObject, getObject, putObject, sha256Of } from '@/lib/object-storage'

const BASE = 'http://localhost/api'
const OZNAKA = `r395-docchain-${Date.now()}`
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const PODPIS = `data:image/png;base64,${PNG}`

/** Pravokotnik 4 × 1 m (zaprt) — realen vhod za computeQuoteVersion. */
const VHOD = {
  points: [
    { xM: 0, yM: 0, zM: 0 },
    { xM: 4, yM: 0, zM: 0 },
    { xM: 4, yM: 0, zM: 1 },
    { xM: 0, yM: 0, zM: 1 },
  ],
  closed: true,
}

function jsonReq(path: string, token: string | null, init: { method?: string; body?: unknown } = {}): Request {
  return new Request(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
}

function lockReq(token: string | null, body: unknown): Promise<Response> {
  return dealLockPost(jsonReq('/deal-lock', token, { method: 'POST', body })) as unknown as Promise<Response>
}

function pdfReq(token: string | null, quoteVersionId: string): Promise<Response> {
  return pdfPost(jsonReq(`/quotes/${quoteVersionId}/pdf`, token, { method: 'POST', body: {} }), {
    params: Promise.resolve({ id: quoteVersionId }),
  }) as unknown as Promise<Response>
}

function pdfSeznam(token: string | null, quoteVersionId: string): Promise<Response> {
  return pdfGet(jsonReq(`/quotes/${quoteVersionId}/pdf`, token), {
    params: Promise.resolve({ id: quoteVersionId }),
  }) as unknown as Promise<Response>
}

/** Ustvari Quote + QuoteVersion (strežniško izračunano iz AKTIVNE knjige). */
async function ustvariVerzijo(
  projectId: string,
  status: 'DRAFT' | 'ISSUED',
): Promise<{ quoteId: string; versionId: string; total: number; inputHash: string }> {
  const active = (await getActivePriceBookVersion())!
  const computed = computeQuoteVersion(VHOD, active.prices)
  const quote = await db.quote.create({
    data: { projectId, status: 'ODPRTA' },
  })
  const version = await db.quoteVersion.create({
    data: {
      quoteId: quote.id,
      versionNumber: 1,
      status,
      inputsJson: VHOD as never,
      linesJson: computed.lines as never,
      subtotal: computed.subtotal,
      vat: computed.vat,
      total: computed.total,
      currency: computed.currency,
      inputHash: computed.inputHash,
      priceBookVersionId: active.id,
    },
  })
  return { quoteId: quote.id, versionId: version.id, total: computed.total, inputHash: computed.inputHash }
}

let monter: { user: { id: string }; token: string }
let skladiscnik: { user: { id: string }; token: string }
let projektId: string

beforeAll(async () => {
  monter = await createTestUserWithSession(`${OZNAKA}-monter`, 'MONTER')
  skladiscnik = await createTestUserWithSession(`${OZNAKA}-skladisce`, 'SKLADISCE')
  const stranka = await db.customer.create({
    data: { ime: `Stranka ${OZNAKA}`, naslov: 'Testna 1', email: `${OZNAKA}@test.si` },
  })
  const projekt = await db.project.create({
    data: {
      nazivProjekta: `${OZNAKA} projekt`,
      status: 'V_TEKU',
      monterId: monter.user.id,
      customerId: stranka.id,
    },
  })
  projektId = projekt.id
})

async function pocisti() {
  // Object storage: 0 sirot (podpisi + PDF artefakti verzij ponudb).
  const znaki = await db.signatureAudit.findMany({ where: { projectId: projektId }, select: { storageKey: true } })
  for (const z of znaki) {
    if (z.storageKey) await deleteObject(z.storageKey).catch(() => undefined)
  }
  const dvs = await db.documentVersion.findMany({ where: { quoteVersionId: { not: null } }, select: { storageKey: true } })
  for (const dv of dvs) {
    await deleteObject(dv.storageKey).catch(() => undefined)
  }
  await db.signatureAudit.deleteMany({ where: { projectId: projektId } })
  await db.auditLog.deleteMany({ where: { projectId: projektId } })
  await db.bOM.deleteMany({ where: { projectId: projektId } })
  // quoteVersion delete kaskadira DocumentVersion + Document (FK CASCADE).
  await db.quoteVersion.deleteMany({ where: { quote: { projectId: projektId } } })
  await db.quote.deleteMany({ where: { projectId: projektId } })
  await db.project.deleteMany({ where: { id: projektId } })
  await db.customer.deleteMany({ where: { ime: `Stranka ${OZNAKA}` } })
}
afterAll(pocisti)

describe('R395 — POST /api/quotes/[id]/pdf: vrata + kanonična izdaja', () => {
  it('brez prijave → 401', async () => {
    const v = await ustvariVerzijo(projektId, 'ISSUED')
    const r = await pdfReq(null, v.versionId)
    expect(r.status).toBe(401)
  })

  it('SKLADISCE (brez documents.generate) → 403', async () => {
    const v = await ustvariVerzijo(projektId, 'ISSUED')
    const r = await pdfReq(skladiscnik.token, v.versionId)
    expect(r.status).toBe(403)
    const telo = await r.json()
    // forbidden() nosi sporočilo v `detail` (kanon auth.ts):
    expect(telo.detail).toContain('documents.generate')
  })

  it('DRAFT verzija → 409 (osnutek NI ponudba — §3)', async () => {
    const v = await ustvariVerzijo(projektId, 'DRAFT')
    const r = await pdfReq(monter.token, v.versionId)
    expect(r.status).toBe(409)
    const telo = await r.json()
    expect(telo.error).toContain('DRAFT')
  })

  it('ISSUED → 201: DocumentVersion vezan na verzijo + sha256 == hash DEJANSKIH bajtov (§16)', async () => {
    const v = await ustvariVerzijo(projektId, 'ISSUED')
    const r = await pdfReq(monter.token, v.versionId)
    expect(r.status).toBe(201)
    const telo = await r.json()
    expect(telo.quoteVersionId).toBe(v.versionId)
    expect(telo.documentVersionId).toBeTruthy()

    const dv = await db.documentVersion.findUniqueOrThrow({
      where: { id: telo.documentVersionId },
      include: { document: true },
    })
    // §16 veriga: DocumentVersion.quoteVersionId == podpisovana verzija:
    expect(dv.quoteVersionId).toBe(v.versionId)
    // Zabojnik: tip PONUDBA + vezava na verzijo (partial UNIQUE telo):
    expect(dv.document.tipDokumenta).toBe('PONUDBA')
    expect(dv.document.quoteVersionId).toBe(v.versionId)
    // §16 jedro: sha256 == hash DEJANSKIH bajtov iz object storage:
    const bajti = await getObject(dv.storageKey)
    expect(bajti).not.toBeNull()
    expect(bajti!.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(sha256Of(bajti!)).toBe(dv.sha256)
    expect(dv.sha256).toBe(telo.sha256)
    expect(dv.sizeBytes).toBe(bajti!.length)
  })

  it('regeneracija → v2 v ISTEM zabojniku; GET seznam → obe verziji', async () => {
    const v = await ustvariVerzijo(projektId, 'ISSUED')
    const prva = await pdfReq(monter.token, v.versionId)
    expect(prva.status).toBe(201)
    const druga = await pdfReq(monter.token, v.versionId)
    expect(druga.status).toBe(201)
    const telo1 = await prva.json()
    const telo2 = await druga.json()
    expect(telo2.documentId).toBe(telo1.documentId)
    expect(telo2.version).toBe(2)

    const seznam = await pdfSeznam(monter.token, v.versionId)
    expect(seznam.status).toBe(200)
    const telo = await seznam.json()
    expect(telo.versions).toHaveLength(2)
    expect(telo.versions.map((x: { version: number }) => x.version)).toEqual([1, 2])
    // Vsaka verzija ima zapisan sha256 (preverba verige na kličetu):
    for (const verzija of telo.versions) {
      expect(verzija.sha256).toMatch(/^[0-9a-f]{64}$/)
    }
  })

  it('TAMPIRANA verzija (ročni UPDATE totala) → 409 — pokvarjen PDF se NE izda', async () => {
    const v = await ustvariVerzijo(projektId, 'ISSUED')
    const totalPred = v.total
    await db.quoteVersion.update({ where: { id: v.versionId }, data: { total: totalPred - 100 } })
    try {
      const r = await pdfReq(monter.token, v.versionId)
      expect(r.status).toBe(409)
      expect((await r.json()).error).toContain('Integriteta')
    } finally {
      await db.quoteVersion.update({ where: { id: v.versionId }, data: { total: totalPred } })
    }
  })
})

describe('R395 — deal-lock §16 veriga dokumenta', () => {
  it('ZAKLEP brez documentVersionId → strežnik SAM izda PONUDBA PDF + veriga drži', async () => {
    const v = await ustvariVerzijo(projektId, 'ISSUED')
    const r = await lockReq(monter.token, {
      projectId: projektId,
      quoteVersionId: v.versionId,
      customerName: 'Stranka Veriga',
      monterName: 'Monter Veriga',
      customerSignature: PODPIS,
      monterSignature: PODPIS,
    })
    expect(r.status).toBe(200)
    const telo = await r.json()
    // Odgovor nosi EXACT verzijo dokumenta (minimalni DTO):
    expect(telo.documentVersion.id).toBeTruthy()
    expect(telo.documentVersion.versionNumber).toBe(1)

    // §16 veriga v bazi: SignatureAudit ×2 z documentVersionId + pdfHash.
    const znaki = await db.signatureAudit.findMany({ where: { quoteVersionId: v.versionId } })
    expect(znaki).toHaveLength(2)
    const dv = await db.documentVersion.findUniqueOrThrow({
      where: { id: telo.documentVersion.id },
      include: { document: true },
    })
    expect(dv.document.tipDokumenta).toBe('PONUDBA')
    expect(dv.quoteVersionId).toBe(v.versionId)
    for (const z of znaki) {
      expect(z.documentVersionId).toBe(dv.id)
      expect(z.pdfHash).toBe(dv.sha256)
    }
    // §16 jedro — hash DEJANSKIH bajtov (bajti se poberejo IZ storage):
    const bajti = await getObject(dv.storageKey)
    expect(bajti).not.toBeNull()
    expect(sha256Of(bajti!)).toBe(dv.sha256)
    expect(telo.pdfHash).toBe(dv.sha256)
    // Projekt zaklenjen (veriga NI namesto zaklepa — je Z njim):
    const po = await db.project.findUnique({ where: { id: projektId }, select: { dealLocked: true } })
    expect(po!.dealLocked).toBe(true)
  })

  it('ZAKLEP Z documentVersionId (PDF ruta) → podpis nad EXACT verzijo', async () => {
    // Nov projekt — prejšnji je že zaklenjen (409/403 bi zamotili dokaz).
    const stranka = await db.customer.findFirstOrThrow({ where: { ime: `Stranka ${OZNAKA}` } })
    const projekt2 = await db.project.create({
      data: { nazivProjekta: `${OZNAKA} B`, status: 'V_TEKU', monterId: monter.user.id, customerId: stranka.id },
    })
    try {
      const v = await ustvariVerzijo(projekt2.id, 'ISSUED')
      const pdf = await pdfReq(monter.token, v.versionId)
      expect(pdf.status).toBe(201)
      const pdfTelo = await pdf.json()

      const r = await lockReq(monter.token, {
        projectId: projekt2.id,
        quoteVersionId: v.versionId,
        documentVersionId: pdfTelo.documentVersionId,
        customerName: 'Stranka Explicit',
        monterName: 'Monter Explicit',
        customerSignature: PODPIS,
        monterSignature: PODPIS,
      })
      expect(r.status).toBe(200)
      const telo = await r.json()
      expect(telo.documentVersion.id).toBe(pdfTelo.documentVersionId)

      const znaki = await db.signatureAudit.findMany({ where: { quoteVersionId: v.versionId } })
      expect(znaki).toHaveLength(2)
      for (const z of znaki) {
        expect(z.documentVersionId).toBe(pdfTelo.documentVersionId)
        expect(z.pdfHash).toBe(pdfTelo.sha256)
      }
      // Ni NOVE izdaje ob zaklepu (verzija že obstaja — isti zabojnik):
      const stevilo = await db.documentVersion.count({ where: { quoteVersionId: v.versionId } })
      expect(stevilo).toBe(1)
    } finally {
      // Čiščenje projekta B (isti vzorec kot glavni pocisti):
      const znaki = await db.signatureAudit.findMany({ where: { projectId: projekt2.id }, select: { storageKey: true } })
      for (const z of znaki) if (z.storageKey) await deleteObject(z.storageKey).catch(() => undefined)
      const dvs = await db.documentVersion.findMany({
        where: { document: { projectId: projekt2.id } },
        select: { storageKey: true },
      })
      for (const dv of dvs) await deleteObject(dv.storageKey).catch(() => undefined)
      await db.signatureAudit.deleteMany({ where: { projectId: projekt2.id } })
      await db.auditLog.deleteMany({ where: { projectId: projekt2.id } })
      await db.bOM.deleteMany({ where: { projectId: projekt2.id } })
      await db.quoteVersion.deleteMany({ where: { quote: { projectId: projekt2.id } } })
      await db.quote.deleteMany({ where: { projectId: projekt2.id } })
      await db.project.deleteMany({ where: { id: projekt2.id } })
    }
  })

  it('TAMPERED bajti v storage → 409 (zapečatenje NE drži — odkrito)', async () => {
    const stranka = await db.customer.findFirstOrThrow({ where: { ime: `Stranka ${OZNAKA}` } })
    const projekt3 = await db.project.create({
      data: { nazivProjekta: `${OZNAKA} C`, status: 'V_TEKU', monterId: monter.user.id, customerId: stranka.id },
    })
    try {
      const v = await ustvariVerzijo(projekt3.id, 'ISSUED')
      const pdf = await pdfReq(monter.token, v.versionId)
      const pdfTelo = await pdf.json()
      const dv = await db.documentVersion.findUniqueOrThrow({ where: { id: pdfTelo.documentVersionId } })

      // Ponaredek: artefakt v storage prepisan z TUJIMI bajti (isti ključ —
      // putObject povoji; simulira restore/refaktor napako):
      await putObject(dv.storageKey, Buffer.from('%PDF-forged-ni-pravi-artefakt'), 'application/pdf')

      const r = await lockReq(monter.token, {
        projectId: projekt3.id,
        quoteVersionId: v.versionId,
        documentVersionId: pdfTelo.documentVersionId,
        customerName: 'S',
        monterName: 'M',
        customerSignature: PODPIS,
        monterSignature: PODPIS,
      })
      expect(r.status).toBe(409)
      const telo = await r.json()
      expect(telo.error).toContain('PDF bajti se ne ujemajo')
      // Projekt OSTANE nezaklenjen (nič stranskih učinkov):
      const po = await db.project.findUnique({ where: { id: projekt3.id }, select: { dealLocked: true } })
      expect(po!.dealLocked).toBe(false)
    } finally {
      const dvs = await db.documentVersion.findMany({
        where: { document: { projectId: projekt3.id } },
        select: { storageKey: true },
      })
      for (const dv of dvs) await deleteObject(dv.storageKey).catch(() => undefined)
      await db.signatureAudit.deleteMany({ where: { projectId: projekt3.id } })
      await db.auditLog.deleteMany({ where: { projectId: projekt3.id } })
      await db.bOM.deleteMany({ where: { projectId: projekt3.id } })
      await db.quoteVersion.deleteMany({ where: { quote: { projectId: projekt3.id } } })
      await db.quote.deleteMany({ where: { projectId: projekt3.id } })
      await db.project.deleteMany({ where: { id: projekt3.id } })
    }
  })

  it('PREČNA verzija (PDF DRUGE verzije ponudbe) → 409', async () => {
    const stranka = await db.customer.findFirstOrThrow({ where: { ime: `Stranka ${OZNAKA}` } })
    const projekt4 = await db.project.create({
      data: { nazivProjekta: `${OZNAKA} D`, status: 'V_TEKU', monterId: monter.user.id, customerId: stranka.id },
    })
    try {
      const vA = await ustvariVerzijo(projekt4.id, 'ISSUED')
      const vB = await ustvariVerzijo(projekt4.id, 'ISSUED')
      const pdfB = await pdfReq(monter.token, vB.versionId)
      const pdfBTelo = await pdfB.json()

      // Zaklep nad vA, a z documentVersionId verzije B:
      const r = await lockReq(monter.token, {
        projectId: projekt4.id,
        quoteVersionId: vA.versionId,
        documentVersionId: pdfBTelo.documentVersionId,
        customerName: 'S',
        monterName: 'M',
        customerSignature: PODPIS,
        monterSignature: PODPIS,
      })
      expect(r.status).toBe(409)
      expect((await r.json()).error).toContain('ni vezana na podpisovano verzijo ponudbe')
    } finally {
      const dvs = await db.documentVersion.findMany({
        where: { document: { projectId: projekt4.id } },
        select: { storageKey: true },
      })
      for (const dv of dvs) await deleteObject(dv.storageKey).catch(() => undefined)
      await db.signatureAudit.deleteMany({ where: { projectId: projekt4.id } })
      await db.auditLog.deleteMany({ where: { projectId: projekt4.id } })
      await db.bOM.deleteMany({ where: { projectId: projekt4.id } })
      await db.quoteVersion.deleteMany({ where: { quote: { projectId: projekt4.id } } })
      await db.quote.deleteMany({ where: { projectId: projekt4.id } })
      await db.project.deleteMany({ where: { id: projekt4.id } })
    }
  })

  it('KLIENTOV pdfHash neujemanje → 409 (ZASTARELO polje — samo preverba)', async () => {
    const stranka = await db.customer.findFirstOrThrow({ where: { ime: `Stranka ${OZNAKA}` } })
    const projekt5 = await db.project.create({
      data: { nazivProjekta: `${OZNAKA} E`, status: 'V_TEKU', monterId: monter.user.id, customerId: stranka.id },
    })
    try {
      const v = await ustvariVerzijo(projekt5.id, 'ISSUED')
      const r = await lockReq(monter.token, {
        projectId: projekt5.id,
        quoteVersionId: v.versionId,
        customerName: 'S',
        monterName: 'M',
        customerSignature: PODPIS,
        monterSignature: PODPIS,
        pdfHash: 'deadbeef'.repeat(8),
      })
      expect(r.status).toBe(409)
      expect((await r.json()).error).toContain('pdfHash')
      const po = await db.project.findUnique({ where: { id: projekt5.id }, select: { dealLocked: true } })
      expect(po!.dealLocked).toBe(false)
    } finally {
      await db.signatureAudit.deleteMany({ where: { projectId: projekt5.id } })
      await db.auditLog.deleteMany({ where: { projectId: projekt5.id } })
      await db.bOM.deleteMany({ where: { projectId: projekt5.id } })
      await db.quoteVersion.deleteMany({ where: { quote: { projectId: projekt5.id } } })
      await db.quote.deleteMany({ where: { projectId: projekt5.id } })
      await db.project.deleteMany({ where: { id: projekt5.id } })
    }
  })
})

describe('R395 — BAZA linije (triggerji iz migracije, mimo store-plasti)', () => {
  it('document_version_no_update: UPDATE vrstice → ZAVRNJEN (immutable)', async () => {
    const v = await ustvariVerzijo(projektId, 'ISSUED')
    const pdf = await pdfReq(monter.token, v.versionId)
    const telo = await pdf.json()
    await expect(
      db.documentVersion.update({ where: { id: telo.documentVersionId }, data: { sha256: 'ponaredek' } }),
    ).rejects.toThrow()
    // Vrstica OSTANE nedotaknjena:
    const dv = await db.documentVersion.findUniqueOrThrow({ where: { id: telo.documentVersionId } })
    expect(dv.sha256).not.toBe('ponaredek')
  })

  it('quote_version_signed_immutable: PODPISANA verzija — vsebina IN status zamrznjena', async () => {
    const stranka = await db.customer.findFirstOrThrow({ where: { ime: `Stranka ${OZNAKA}` } })
    const projekt6 = await db.project.create({
      data: { nazivProjekta: `${OZNAKA} F`, status: 'V_TEKU', monterId: monter.user.id, customerId: stranka.id },
    })
    try {
      const v = await ustvariVerzijo(projekt6.id, 'ISSUED')
      const r = await lockReq(monter.token, {
        projectId: projekt6.id,
        quoteVersionId: v.versionId,
        customerName: 'Stranka Zamrzni',
        monterName: 'Monter Zamrzni',
        customerSignature: PODPIS,
        monterSignature: PODPIS,
      })
      expect(r.status).toBe(200)
      const verzija = await db.quoteVersion.findUniqueOrThrow({ where: { id: v.versionId } })
      expect(verzija.status).toBe('APPROVED')

      // TIHA sprememba vsebine → zavrnjena (§16):
      await expect(
        db.quoteVersion.update({ where: { id: v.versionId }, data: { total: v.total - 500 } }),
      ).rejects.toThrow()
      // Prehod IZ APPROVED → zavrnjen (terminalno):
      await expect(
        db.quoteVersion.update({ where: { id: v.versionId }, data: { status: 'SUPERSEDED' } }),
      ).rejects.toThrow()
      // Vsebina OSTANE nedotaknjena:
      const po = await db.quoteVersion.findUniqueOrThrow({ where: { id: v.versionId } })
      expect(po.total.toNumber()).toBe(v.total)
      expect(po.status).toBe('APPROVED')
    } finally {
      const znaki = await db.signatureAudit.findMany({ where: { projectId: projekt6.id }, select: { storageKey: true } })
      for (const z of znaki) if (z.storageKey) await deleteObject(z.storageKey).catch(() => undefined)
      const dvs = await db.documentVersion.findMany({
        where: { document: { projectId: projekt6.id } },
        select: { storageKey: true },
      })
      for (const dv of dvs) await deleteObject(dv.storageKey).catch(() => undefined)
      await db.signatureAudit.deleteMany({ where: { projectId: projekt6.id } })
      await db.auditLog.deleteMany({ where: { projectId: projekt6.id } })
      await db.bOM.deleteMany({ where: { projectId: projekt6.id } })
      await db.quoteVersion.deleteMany({ where: { quote: { projectId: projekt6.id } } })
      await db.quote.deleteMany({ where: { projectId: projekt6.id } })
      await db.project.deleteMany({ where: { id: projekt6.id } })
    }
  })

  it('signature_audit_document_chain: pdfHash ≠ sha256 vezane verzije → vrstica NE pristane', async () => {
    const v = await ustvariVerzijo(projektId, 'ISSUED')
    const pdf = await pdfReq(monter.token, v.versionId)
    const telo = await pdf.json()
    const pred = await db.signatureAudit.count({ where: { projectId: projektId } })
    // Ponaredek: referenca na EXACT verzijo + NAPAČEN pdfHash:
    await expect(
      db.signatureAudit.create({
        data: {
          projectId: projektId,
          signatureType: 'CUSTOMER',
          signedByName: 'Ponarejenec',
          documentVersionId: telo.documentVersionId,
          pdfHash: 'deadbeef'.repeat(8),
        },
      }),
    ).rejects.toThrow()
    // Vrstica NI pristala (števec nespremenjen):
    const po = await db.signatureAudit.count({ where: { projectId: projektId } })
    expect(po).toBe(pred)
    // Manjkajoča verzija dokumenta → prav tako zavrnjena:
    await expect(
      db.signatureAudit.create({
        data: {
          projectId: projektId,
          signatureType: 'CUSTOMER',
          signedByName: 'Ponarejenec 2',
          documentVersionId: 'neobstojeca-verzija',
          pdfHash: 'x',
        },
      }),
    ).rejects.toThrow()
  })
})

describe('R395 — signature-audit GET: §16 minimalni DTO + veriga', () => {
  it('DTO BREZ občutljivih polj + Z §16 verigo (documentVersionId)', async () => {
    const r = await sigAuditGet(jsonReq(`/signature-audit?projectId=${projektId}`, monter.token))
    expect(r.status).toBe(200)
    const telo = await r.json()
    const besedilo = JSON.stringify(telo)
    // §16: nepotrebna občutljiva polja SO ODSTRANJENA iz odgovora:
    expect(besedilo).not.toContain('ipAddress')
    expect(besedilo).not.toContain('userAgent')
    expect(besedilo).not.toContain('deviceFingerprint')
    expect(besedilo).not.toContain('geoLatitude')
    expect(besedilo).not.toContain('geoLongitude')
    expect(besedilo).not.toContain('storageKey')
    expect(besedilo).not.toContain('signatureImage')
    // §16 veriga je VIDNA:
    expect(telo.audits.length).toBeGreaterThan(0)
    expect(telo.audits[0].documentVersionId).toBeTruthy()
    expect(telo.audits[0].quoteVersionId).toBeTruthy()
  })

  it('IDOR: NEDODELJENI monter → 403 (vrata na ravni vira — R395 fix)', async () => {
    const tujec = await createTestUserWithSession(`${OZNAKA}-tujec`, 'MONTER')
    const r = await sigAuditGet(jsonReq(`/signature-audit?projectId=${projektId}`, tujec.token))
    expect(r.status).toBe(403)
  })

  it('deal-lock GET: signatures nosijo documentVersionId (veriga vidna, DTO ostaja minimalen)', async () => {
    const r = await dealLockGet(jsonReq(`/deal-lock?projectId=${projektId}`, monter.token))
    expect(r.status).toBe(200)
    const telo = await r.json()
    expect(telo.signatures.length).toBeGreaterThan(0)
    for (const s of telo.signatures) {
      expect(s.documentVersionId).toBeTruthy()
    }
    const besedilo = JSON.stringify(telo)
    expect(besedilo).not.toContain('ipAddress')
    expect(besedilo).not.toContain('deviceFingerprint')
    expect(besedilo).not.toContain('storageKey')
  })
})
