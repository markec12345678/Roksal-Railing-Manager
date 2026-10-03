// R376 — DEAL-LOCK × KANONIČNI BOM (issue #13, korak R166 iz §7 BOM vezava).
// ---------------------------------------------------------------------------
// Integracijski testi NAD ROUTAMA (POST + GET /api/deal-lock) — isti vzorec
// kot r374-canonical-deal-lock (nadaljevanje iste zgodbe):
//
//   (1) zaklep nad ISSUED verzijo TRANSAKCIJSKO ustvari KANONIČNO BOMVersion
//       (status APPROVED) iz strukturiranih postavk + EXACT inventarne
//       vezave (SIDRA → Inventory.sifraMateriala='SIDRA') + honest NULL
//       stroške (§8);
//   (2) §7 veriga: SignatureAudit ×2 nosita bomVersionId (+ quoteVersionId +
//       quoteInputHash) — podpis je vezan na TOČNO to nespremenljivo BOM
//       verzijo, ne na trenutek;
//   (3) odgovor POST vsebuje minimalni bomVersion DTO (id/številka/status/
//       št. vrstic — §17 disciplina R374);
//   (4) LEGACY read-model: Project.bomDraftJson se ŠE vedno piše (stari UI),
//       a NI kanoničen vir (komentar na mestu zapisa v ruti);
//   (5) PO zaklepu je BOM NESPREMENLJIV (§7): dvojni zaklep → 403/409;
//       PATCH approve nad (že APPROVED) verzijo → 409; POST /api/bom na
//       zaklenjen projekt → 409 — sprememba = eksplicitna nova verzija /
//       change order, NIKOLI tiha mutacija;
//   (6) GET /api/deal-lock vrača bomVersion DTO (isti minimalni obraz).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import { POST as dealLockPost, GET as dealLockGet } from '@/app/api/deal-lock/route'
import { POST as bomPost } from '@/app/api/bom/route'
import { PATCH as bomVersionPatch } from '@/app/api/bom/[id]/route'
import { computeQuoteVersion } from '@/lib/quote-versions'
import { getActivePriceBookVersion } from '@/lib/price-book-store'
import { deleteObject } from '@/lib/object-storage'

const BASE = 'http://localhost/api'
const OZNAKA = 'r376-zaklep'
const SIFRA = 'SIDRA'
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

async function pocisti() {
  const projekti = await db.project.findMany({ where: { nazivProjekta: { contains: OZNAKA } }, select: { id: true } })
  const ids = projekti.map((p) => p.id)
  if (ids.length > 0) {
    // Podpisni artefakti v object storage najprej (0 sirot — R122 kompenzacija):
    const znaki = await db.signatureAudit.findMany({ where: { projectId: { in: ids } }, select: { storageKey: true } })
    for (const z of znaki) {
      if (z.storageKey) await deleteObject(z.storageKey).catch(() => undefined)
    }
    // R395 (§16): zaklep zdaj izda tudi PONUDBA PDF — artefakt počistimo
    // PRED brisanjem vrstic (ključi živijo na DocumentVersion):
    const dvs = await db.documentVersion.findMany({
      where: { document: { projectId: { in: ids } } },
      select: { storageKey: true },
    })
    for (const dv of dvs) {
      await deleteObject(dv.storageKey).catch(() => undefined)
    }
    await db.signatureAudit.deleteMany({ where: { projectId: { in: ids } } })
    await db.auditLog.deleteMany({ where: { projectId: { in: ids } } })
    await db.bOM.deleteMany({ where: { projectId: { in: ids } } }) // verzije+vrstice kaskadajo
    await db.quote.deleteMany({ where: { projectId: { in: ids } } })
    await db.project.deleteMany({ where: { id: { in: ids } } })
  }
  await db.inventory.deleteMany({ where: { sifraMateriala: SIFRA } })
  await db.customer.deleteMany({ where: { ime: `Stranka ${OZNAKA}` } })
}

// ── Skupni kontekst ─────────────────────────────────────────────────────────
let monter: { user: { id: string }; token: string }
let vodja: { user: { id: string }; token: string }
let projektId: string
let verzija: { versionId: string; inputHash: string; priceBookVersionId: string; vrstic: number }

beforeAll(async () => {
  await pocisti()
  monter = await createTestUserWithSession(`${OZNAKA}-monter`, 'MONTER')
  vodja = await createTestUserWithSession(`${OZNAKA}-vodja`, 'VODJA')
  const stranka = await db.customer.create({
    data: { ime: `Stranka ${OZNAKA}`, naslov: 'Testna 1', email: `${OZNAKA}@test.si` },
  })
  const projekt = await db.project.create({
    data: { nazivProjekta: `${OZNAKA} ${Date.now()}`, status: 'V_TEKU', monterId: monter.user.id, customerId: stranka.id },
  })
  projektId = projekt.id
  // Verzija ponudbe ISSUED (kot v r374 testih — strežniško izračunana):
  const active = (await getActivePriceBookVersion())!
  const computed = computeQuoteVersion(VHOD, active.prices)
  const quote = await db.quote.create({ data: { projectId: projektId, status: 'ODPRTA' } })
  const version = await db.quoteVersion.create({
    data: {
      quoteId: quote.id,
      versionNumber: 1,
      status: 'ISSUED',
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
  verzija = {
    versionId: version.id,
    inputHash: computed.inputHash,
    priceBookVersionId: active.id,
    vrstic: computed.lines.length,
  }
  // EXACT inventarna vezava za postavko SIDRA (preizkus vezave SKOZI zaklep):
  await db.inventory.create({
    data: { sifraMateriala: SIFRA, naziv: 'Kemično sidro M8×80', tip: 'FIXINGS', kolicinaZaloga: 0, enota: 'kos', minimalnaZaloga: 5 },
  })
})

afterAll(pocisti)

describe('R376 — ZAKLEP ustvari KANONIČNO BOMVersion (§7 vezava)', () => {
  it('USPEŠEN zaklep → 200 z bomVersion DTO (APPROVED, minimalni obraz §17)', async () => {
    const r = await lockReq(monter.token, {
      projectId: projektId,
      quoteVersionId: verzija.versionId,
      customerName: 'Stranka Zaklep',
      monterName: 'Monter Zaklep',
      customerSignature: PODPIS,
      monterSignature: PODPIS,
    })
    expect(r.status).toBe(200)
    const telo = await r.json()
    expect(telo.quoteVersionId).toBe(verzija.versionId)
    expect(telo.bomVersion).toBeTruthy()
    expect(telo.bomVersion.status).toBe('APPROVED')
    expect(telo.bomVersion.versionNumber).toBe(1)
    expect(telo.bomVersion.lineCount).toBe(verzija.vrstic)
    expect(typeof telo.bomVersion.id).toBe('string')
    // Minimalni DTO — brez internals (vrstice so na /api/bom/[id]):
    expect(JSON.stringify(telo.bomVersion)).not.toContain('lines')
  })

  it('DB: BOMVersion APPROVED s CELOVITO sledjo izvora (§6) + approvedById/At', async () => {
    const bv = await db.bOMVersion.findFirstOrThrow({
      where: { bom: { projectId: projektId } },
      orderBy: { versionNumber: 'desc' },
    })
    expect(bv.status).toBe('APPROVED')
    expect(bv.versionNumber).toBe(1)
    expect(bv.sourceQuoteVersionId).toBe(verzija.versionId)
    expect(bv.priceBookVersionId).toBe(verzija.priceBookVersionId)
    expect(bv.layoutFingerprint).toBe(verzija.inputHash)
    expect(bv.productSdkVersion).toBe('quote-v1')
    expect(bv.approvedAt).not.toBeNull()
    expect(bv.approvedById).toBe(monter.user.id)
    expect(bv.createdById).toBe(monter.user.id)
  })

  it('DB: BOMLine vrstice = postavke ponudbe (1:1) + EXACT vezava SIDRA + honest NULLs (§8)', async () => {
    const bv = await db.bOMVersion.findFirstOrThrow({
      where: { bom: { projectId: projektId } },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    })
    expect(bv.lines).toHaveLength(verzija.vrstic)
    expect(bv.lines.map((l) => l.lineOrder)).toEqual(bv.lines.map((l) => l.lineOrder).sort((a, b) => a - b))
    // EXACT vezava SIDRA (sifraMateriala === code — skozi zaklep):
    const sidra = bv.lines.find((l) => l.internalSku === SIFRA)!
    expect(sidra.inventoryId).not.toBeNull()
    const artikel = await db.inventory.findUniqueOrThrow({ where: { id: sidra.inventoryId! } })
    expect(artikel.sifraMateriala).toBe(SIFRA)
    // Nevezana postavka ostaja NULL (BREZ fuzzy):
    const steklo = bv.lines.find((l) => l.internalSku === 'STK-1323-860')!
    expect(steklo.inventoryId).toBeNull()
    // Honest NULLs na vseh vrsticah (knjiga brez referenceCost):
    for (const l of bv.lines) {
      expect(l.wasteFactor).toBeNull()
      expect(l.grossQuantity).toBeNull()
    }
    // Sled pravila + geometrije na vsaki vrstici:
    expect(sidra.calculationRuleVersion).toBe('quote-v1')
    expect(sidra.geometrySource).toContain(`layout=${verzija.inputHash}`)
  })

  it('§7 VERIGA: SignatureAudit ×2 z bomVersionId (+ quoteVersionId + quoteInputHash)', async () => {
    const bv = await db.bOMVersion.findFirstOrThrow({ where: { bom: { projectId: projektId } } })
    const znaki = await db.signatureAudit.findMany({ where: { projectId: projektId } })
    expect(znaki).toHaveLength(2)
    expect(new Set(znaki.map((z) => z.signatureType))).toEqual(new Set(['CUSTOMER', 'MONTER']))
    for (const z of znaki) {
      expect(z.bomVersionId).toBe(bv.id) // §7 vezava na TOČNO to verzijo BOM
      expect(z.quoteVersionId).toBe(verzija.versionId)
      expect(z.quoteInputHash).toBe(verzija.inputHash)
    }
  })

  it('LEGACY read-model: Project.bomDraftJson je ŠE zapisan (star UI; NI kanoničen vir)', async () => {
    const projekt = await db.project.findUniqueOrThrow({
      where: { id: projektId },
      select: { bomDraftJson: true, dealLocked: true },
    })
    expect(projekt.dealLocked).toBe(true)
    expect(projekt.bomDraftJson).toBeTruthy()
    const draft = JSON.parse(projekt.bomDraftJson!) as { items: { sku: string }[] }
    expect(draft.items.length).toBe(verzija.vrstic)
  })

  it('Revizijski vpis DEAL_LOCKED nosi bomVersionId (§19 sled ATOMSKO z zaklepom)', async () => {
    const bv = await db.bOMVersion.findFirstOrThrow({ where: { bom: { projectId: projektId } } })
    const revizija = await db.auditLog.findFirstOrThrow({
      where: { projectId: projektId, akcija: 'DEAL_LOCKED', newValue: { contains: bv.id } },
    })
    expect(revizija.newValue).toContain(`"bomVersionNumber":${bv.versionNumber}`)
  })
})

describe('R376 — PO zaklepu je BOM NESPREMENLJIV (§7 immutable)', () => {
  it('DVAKRATNI zaklep → 403/409 + BOM vrstice NEspremenjene', async () => {
    const pred = await db.bOMVersion.findFirstOrThrow({
      where: { bom: { projectId: projektId } },
      include: { lines: true },
    })
    const drugi = await lockReq(monter.token, {
      projectId: projektId,
      quoteVersionId: verzija.versionId,
      customerName: 'S',
      monterName: 'M',
      customerSignature: PODPIS,
      monterSignature: PODPIS,
    })
    expect([403, 409]).toContain(drugi.status)
    // Drugi (NEuspešen) zaklep NI pustil sledu na BOM:
    const po = await db.bOMVersion.findFirstOrThrow({
      where: { bom: { projectId: projektId } },
      include: { lines: true },
    })
    expect(po.id).toBe(pred.id)
    expect(po.lines.length).toBe(pred.lines.length)
    // Ni nastala nova verzija (število verzij nespremenjeno):
    const stevilo = await db.bOMVersion.count({ where: { bom: { projectId: projektId } } })
    expect(stevilo).toBe(1)
  })

  it('PATCH approve nad (že APPROVED) BOM verzijo → monter 403 (stena dostopa) / vodja 409 (BOM guard, §6/§7)', async () => {
    const bv = await db.bOMVersion.findFirstOrThrow({ where: { bom: { projectId: projektId } } })
    // MONTER: zaklenjen projekt mu PREPOVEDUJE update (access stena diha PRED
    // 409 vejo — močnejša zaščita, isti vzorec kot dvojni zaklep v r374):
    const monterR = await bomVersionPatch(
      jsonReq(`/bom/${bv.id}`, monter.token, { method: 'PATCH', body: { action: 'approve' } }),
      { params: Promise.resolve({ id: bv.id }) },
    )
    expect(monterR.status).toBe(403)
    // VODJA: dostop ima, a BOM guard zavrne (APPROVED je terminalno IN
    // zaklenjen projekt = nespremenljiv BOM — 409 z razlogom):
    const vodjaR = await bomVersionPatch(
      jsonReq(`/bom/${bv.id}`, vodja.token, { method: 'PATCH', body: { action: 'approve' } }),
      { params: Promise.resolve({ id: bv.id }) },
    )
    expect(vodjaR.status).toBe(409)
    const telo = await vodjaR.json()
    expect(telo.error).toContain('Zaklenjen projekt')
  })

  it('POST /api/bom na ZAKLENJEN projekt → monter 403 / vodja 409 (sprememba = eksplicitni change order)', async () => {
    const monterR = await bomPost(
      jsonReq('/bom', monter.token, { method: 'POST', body: { projectId: projektId, quoteVersionId: verzija.versionId } }),
    )
    expect(monterR.status).toBe(403)
    const vodjaR = await bomPost(
      jsonReq('/bom', vodja.token, { method: 'POST', body: { projectId: projektId, quoteVersionId: verzija.versionId } }),
    )
    expect(vodjaR.status).toBe(409)
    const telo = await vodjaR.json()
    expect(telo.error).toContain('Zaklenjen projekt')
    // NI nastala nova verzija (BOM ostaja 1 — nespremenljiv §7):
    const stevilo = await db.bOMVersion.count({ where: { bom: { projectId: projektId } } })
    expect(stevilo).toBe(1)
  })
})

describe('R376 — GET /api/deal-lock vrača kanonično BOM verzijo (minimalni DTO)', () => {
  it('GET po zaklepu: bomVersion DTO + brez odhanjenih polj (§17 R374 disciplina ostaja)', async () => {
    const r = await dealLockGet(jsonReq(`/deal-lock?projectId=${projektId}`, monter.token))
    expect(r.status).toBe(200)
    const telo = await r.json()
    expect(telo.dealLocked).toBe(true)
    expect(telo.bomVersion).toBeTruthy()
    expect(telo.bomVersion.status).toBe('APPROVED')
    expect(telo.bomVersion.versionNumber).toBe(1)
    expect(telo.bomVersion.lineCount).toBe(verzija.vrstic)
    // Minimalni DTO R374 ostaja nespremenjen (nobenega odhanjenega polja nazaj):
    const besedilo = JSON.stringify(telo)
    expect(besedilo).not.toContain('storageKey')
    expect(besedilo).not.toContain('ipAddress')
    expect(besedilo).not.toContain('userAgent')
    expect(besedilo).not.toContain('deviceFingerprint')
    expect(besedilo).not.toContain('geoLatitude')
    expect(besedilo).not.toContain('sha256')
  })
})
