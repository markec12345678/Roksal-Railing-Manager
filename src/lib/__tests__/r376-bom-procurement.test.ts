// R376 — PROCUREMENT NAD KANONIČNIM BOM (issue #13, korak R166 iz §11).
// ---------------------------------------------------------------------------
// Integracijski testi NAD ROUTAMI (/api/bom, /api/bom/[id],
// /api/bom/procurement) proti testni bazi — isti vzorec kot r374:
//
//   (1) POST /api/bom: izpeljava DRAFT verzije IZ strežniške verzije ponudbe
//       (EXACT inventarna vezava SIDRA → Inventory.sifraMateriala='SIDRA';
//       nevezane postavke ostanejo NULL — NE tekstovna hevristika);
//   (2) vrata: REJECTED/SUPERSEDED verzija → 409; prečni projekt → 409;
//       SKLADISCE (brez quotes.create) → 403; tampirana verzija → 409;
//   (3) PATCH /api/bom/[id] approve: DRAFT → APPROVED + revizijski vpis;
//       APPROVED je TERMINALNO (drugi approve → 409 — immutabilnost §6);
//   (4) supersede: nova DRAFT verzija postavi prejšnje DRAFT v SUPERSEDED,
//       APPROVED pa OSTANE (terminalno — sprememba = nova verzija, §6);
//   (5) GET /api/bom?projectId: seznam verzij z lineCount;
//   (6) GET /api/bom/[id]: vrstice z NEVEZANO razlogom (§11 honest);
//   (7) §11 MATEMATIKA: planned/reserved/ordered/received/issued/consumed/
//       returned/wasted/variance iz StockLedger + MaterialOrderItem +
//       MaterialUsage (kanonski pisci — recordMovement, ne ročni vpisi);
//   (8) NEVEZANA vrstica → VSE dejanske količine NULL + vezava NEVEZANO
//       (NIKOLI ničle — ničla bi bila laž "nič se ni zgodilo");
//   (9) idempotentna branja (dva GET → identično telo);
//  (10) brez APPROVED verzije → 404 (fail-closed, ne prazen seznam).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import { GET as bomGet, POST as bomPost } from '@/app/api/bom/route'
import { GET as bomVersionGet, PATCH as bomVersionPatch } from '@/app/api/bom/[id]/route'
import { GET as procurementGet } from '@/app/api/bom/procurement/route'
import { computeQuoteVersion } from '@/lib/quote-versions'
import { getActivePriceBookVersion } from '@/lib/price-book-store'
import { recordMovement } from '@/lib/inventory'

const BASE = 'http://localhost/api'
const OZNAKA = 'r376-nabava'
/** EXACT šifra, ki se veže na postavko SIDRA izračunane ponudbe. */
const SIFRA = 'SIDRA'

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

function postBom(token: string | null, projectId: string, quoteVersionId: string): Promise<Response> {
  return bomPost(jsonReq('/bom', token, { method: 'POST', body: { projectId, quoteVersionId } })) as unknown as Promise<Response>
}

function patchApprove(token: string | null, id: string): Promise<Response> {
  return bomVersionPatch(jsonReq(`/bom/${id}`, token, { method: 'PATCH', body: { action: 'approve' } }), {
    params: Promise.resolve({ id }),
  }) as unknown as Promise<Response>
}

/** Vsi projekti tega testa (po oznaki) — za čist start/počistenje. */
async function vsiProjekti(): Promise<string[]> {
  const vrstice = await db.project.findMany({ where: { nazivProjekta: { contains: OZNAKA } }, select: { id: true } })
  return vrstice.map((v) => v.id)
}

async function pocisti() {
  const ids = await vsiProjekti()
  if (ids.length === 0) return
  // VRSTNI RED pomemben (FK RESTRICT na StockLedger/MaterialUsage/
  // InventoryMovement/AuditLog):
  await db.lotAllocation.deleteMany({ where: { projectId: { in: ids } } })
  await db.stockLedger.deleteMany({ where: { projectId: { in: ids } } })
  await db.materialUsage.deleteMany({ where: { projectId: { in: ids } } })
  await db.inventoryMovement.deleteMany({ where: { projectId: { in: ids } } })
  await db.auditLog.deleteMany({ where: { projectId: { in: ids } } })
  await db.materialOrder.deleteMany({ where: { projectId: { in: ids } } }) // postavke kaskadajo
  await db.bOM.deleteMany({ where: { projectId: { in: ids } } }) // verzije+vrstice kaskadajo
  await db.quote.deleteMany({ where: { projectId: { in: ids } } })
  await db.project.deleteMany({ where: { id: { in: ids } } })
  // Artikli/šarže/dobavitelji cenika tega testa:
  await db.inventoryLot.deleteMany({ where: { inventory: { sifraMateriala: SIFRA } } })
  await db.materialPrice.deleteMany({ where: { inventory: { sifraMateriala: SIFRA } } })
  await db.inventory.deleteMany({ where: { sifraMateriala: SIFRA } })
  await db.supplier.deleteMany({ where: { naziv: `Dobavitelj ${OZNAKA}` } })
}

/** Ustvari Quote + QuoteVersion (strežniško izračunano iz AKTIVNE knjige). */
async function ustvariVerzijo(
  projectId: string,
  status: 'DRAFT' | 'ISSUED' | 'REJECTED' | 'SUPERSEDED',
): Promise<{ quoteId: string; versionId: string; total: number; inputHash: string; sidraQty: number }> {
  const active = (await getActivePriceBookVersion())!
  const computed = computeQuoteVersion(VHOD, active.prices)
  const quote = await db.quote.create({ data: { projectId, status: 'ODPRTA' } })
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
  const sidra = computed.lines.find((l) => l.code === SIFRA)!
  return { quoteId: quote.id, versionId: version.id, total: computed.total, inputHash: computed.inputHash, sidraQty: sidra.qty }
}

// ── Skupni kontekst (ustvarjen enkrat, pred testi) ─────────────────────────
let monter: { user: { id: string }; token: string }
let skladiscnik: { user: { id: string }; token: string }
let projektId: string
let verzijaIssued: Awaited<ReturnType<typeof ustvariVerzijo>>
let inventoryIdSidra: string

beforeAll(async () => {
  await pocisti()
  monter = await createTestUserWithSession(`${OZNAKA}-monter`, 'MONTER')
  skladiscnik = await createTestUserWithSession(`${OZNAKA}-skladisce`, 'SKLADISCE')
  await db.customer.deleteMany({ where: { ime: `Stranka ${OZNAKA}` } })
  const stranka = await db.customer.create({
    data: { ime: `Stranka ${OZNAKA}`, naslov: 'Testna 1', email: `${OZNAKA}@test.si` },
  })
  const projekt = await db.project.create({
    data: { nazivProjekta: `${OZNAKA} ${Date.now()}`, status: 'V_TEKU', monterId: monter.user.id, customerId: stranka.id },
  })
  projektId = projekt.id
  verzijaIssued = await ustvariVerzijo(projektId, 'ISSUED')
  // EXACT inventarna vezava: sifraMateriala === QuoteItem.code ('SIDRA'):
  const artikel = await db.inventory.create({
    data: { sifraMateriala: SIFRA, naziv: 'Kemično sidro M8×80', tip: 'FIXINGS', kolicinaZaloga: 0, enota: 'kos', minimalnaZaloga: 5 },
  })
  inventoryIdSidra = artikel.id
})

afterAll(pocisti)

describe('R376 — POST /api/bom: izpeljava DRAFT verzije iz kanonske ponudbe (§5/§6)', () => {
  it('USPEŠNA izpeljava: 201 + DRAFT verzija + EXACT vezava SIDRA + nevezane ostanejo NULL', async () => {
    const r = await postBom(monter.token, projektId, verzijaIssued.versionId)
    expect(r.status).toBe(201)
    const telo = await r.json()
    expect(telo.version.status).toBe('DRAFT')
    expect(telo.version.versionNumber).toBe(1)
    expect(telo.version.sourceQuoteVersionId).toBe(verzijaIssued.versionId)
    expect(telo.version.lineCount).toBeGreaterThan(3)
    expect(telo.version.productSdkVersion).toBe('quote-v1')
    expect(telo.version.layoutFingerprint).toBe(verzijaIssued.inputHash)

    // DB resnica: vrstice obstajajo, SIDRA je VEZANA (EXACT), ostale NE:
    const vrstice = await db.bOMLine.findMany({
      where: { bomVersionId: telo.version.id },
      orderBy: { lineOrder: 'asc' },
    })
    expect(vrstice).toHaveLength(telo.version.lineCount)
    const sidraVrstica = vrstice.find((l) => l.internalSku === SIFRA)!
    expect(sidraVrstica.inventoryId).toBe(inventoryIdSidra)
    expect(sidraVrstica.quantity.toNumber()).toBe(verzijaIssued.sidraQty)
    // Nevezana postavka (npr. steklo) ostaja NULL — BREZ fuzzy:
    const steklo = vrstice.find((l) => l.internalSku === 'STK-1323-860')!
    expect(steklo.inventoryId).toBeNull()
    // Honest NULLs (§8) na vseh vrsticah:
    for (const v of vrstice) {
      expect(v.wasteFactor).toBeNull()
      expect(v.grossQuantity).toBeNull()
    }
    // Sled pravila izračuna na vsaki vrstici:
    expect(sidraVrstica.calculationRuleVersion).toBe('quote-v1')
  })

  it('REJECTED verzija → 409 (iz zavrnjene ponudbe BOM ni mogoče izpeljati)', async () => {
    const v = await ustvariVerzijo(projektId, 'REJECTED')
    const r = await postBom(monter.token, projektId, v.versionId)
    expect(r.status).toBe(409)
    const telo = await r.json()
    expect(telo.error).toContain('REJECTED')
  })

  it('SUPERSEDED verzija → 409', async () => {
    const v = await ustvariVerzijo(projektId, 'SUPERSEDED')
    const r = await postBom(monter.token, projektId, v.versionId)
    expect(r.status).toBe(409)
    const telo = await r.json()
    expect(telo.error).toContain('SUPERSEDED')
  })

  it('PREČNI projekt → 409 (verzija TUJEGA projekta)', async () => {
    const stranka = await db.customer.findFirstOrThrow({ where: { ime: `Stranka ${OZNAKA}` } })
    const projektB = await db.project.create({
      data: { nazivProjekta: `${OZNAKA}-B ${Date.now()}`, status: 'V_TEKU', monterId: monter.user.id, customerId: stranka.id },
    })
    try {
      const r = await postBom(monter.token, projektB.id, verzijaIssued.versionId)
      expect(r.status).toBe(409)
      expect((await r.json()).error).toContain('ne pripada temu projektu')
    } finally {
      await db.project.delete({ where: { id: projektB.id } })
    }
  })

  it('SKLADISCE (brez quotes.create) → 403', async () => {
    const r = await postBom(skladiscnik.token, projektId, verzijaIssued.versionId)
    expect(r.status).toBe(403)
  })

  it('TAMPIRANA verzija (ročni UPDATE totala) → 409 (integriteta PRED izpeljavo)', async () => {
    const v = await ustvariVerzijo(projektId, 'ISSUED')
    const totalPred = v.total
    await db.quoteVersion.update({ where: { id: v.versionId }, data: { total: totalPred - 100 } })
    try {
      const r = await postBom(monter.token, projektId, v.versionId)
      expect(r.status).toBe(409)
      expect((await r.json()).error).toContain('Integriteta')
    } finally {
      await db.quoteVersion.update({ where: { id: v.versionId }, data: { total: totalPred } })
      await db.quote.delete({ where: { id: (await db.quoteVersion.findUniqueOrThrow({ where: { id: v.versionId } })).quoteId } })
    }
  })
})

describe('R376 — PATCH /api/bom/[id]: odobritev + immutabilnost + supersede (§6)', () => {
  it('ODOBRITEV DRAFT → APPROVED (200) + approvedAt + revizijski vpis', async () => {
    const v = await postBom(monter.token, projektId, verzijaIssued.versionId)
    const telo = await v.json()
    const r = await patchApprove(monter.token, telo.version.id)
    expect(r.status).toBe(200)
    const potrditev = await r.json()
    expect(potrditev.version.status).toBe('APPROVED')
    expect(potrditev.version.approvedAt).not.toBeNull()
    // Revizijski vpis ATOMSKO z odobritvijo (§19):
    const revizija = await db.auditLog.findFirst({
      where: { projectId: projektId, akcija: 'BOM_VERSION_APPROVED', newValue: { contains: telo.version.id } },
    })
    expect(revizija).not.toBeNull()
  })

  it('APPROVED je TERMINALNO: drugi approve → 409 (immutable po odobritvi, §6)', async () => {
    // Zadnja verzija v projektu je APPROVED (prejšnji test):
    const zadnja = await db.bOMVersion.findFirstOrThrow({
      where: { bom: { projectId: projektId } },
      orderBy: { versionNumber: 'desc' },
    })
    expect(zadnja.status).toBe('APPROVED')
    const r = await patchApprove(monter.token, zadnja.id)
    expect(r.status).toBe(409)
    const telo = await r.json()
    expect(telo.error).toContain('DRAFT')
    // Status se NI spremenil (tiha mutacija bi bila kršitev §6):
    const po = await db.bOMVersion.findUniqueOrThrow({ where: { id: zadnja.id }, select: { status: true } })
    expect(po.status).toBe('APPROVED')
  })

  it('SUPERSEDE: nova DRAFT verzija nadomesti prejšnje DRAFT-e, APPROVED OSTANE', async () => {
    // Dva osnutka zapored:
    const prvi = await postBom(monter.token, projektId, verzijaIssued.versionId)
    const prviTelo = await prvi.json()
    const drugi = await postBom(monter.token, projektId, verzijaIssued.versionId)
    const drugiTelo = await drugi.json()
    expect(drugiTelo.version.versionNumber).toBeGreaterThan(prviTelo.version.versionNumber)
    // Prvi (DRAFT) je sedaj SUPERSEDED, drugi ostane DRAFT:
    const stanjePrvi = await db.bOMVersion.findUniqueOrThrow({ where: { id: prviTelo.version.id }, select: { status: true } })
    expect(stanjePrvi.status).toBe('SUPERSEDED')
    const stanjeDrugi = await db.bOMVersion.findUniqueOrThrow({ where: { id: drugiTelo.version.id }, select: { status: true } })
    expect(stanjeDrugi.status).toBe('DRAFT')
    // APPROVED verzija (iz prejšnjega testa) je NEDOTIKNJENA:
    const approved = await db.bOMVersion.findMany({
      where: { bom: { projectId: projektId }, status: 'APPROVED' },
    })
    expect(approved.length).toBeGreaterThanOrEqual(1)
    // Počistimo odvečni DRAFT (naslednji describe pričakuje čisto stanje):
    await db.bOMVersion.delete({ where: { id: drugiTelo.version.id } })
    await db.bOMVersion.delete({ where: { id: prviTelo.version.id } })
  })
})

describe('R376 — GET /api/bom in GET /api/bom/[id] (§11 branja)', () => {
  it('GET /api/bom?projectId: seznam verzij z lineCount + nosilec', async () => {
    const r = await bomGet(jsonReq(`/bom?projectId=${projektId}`, monter.token))
    expect(r.status).toBe(200)
    const telo = await r.json()
    expect(telo.projectId).toBe(projektId)
    expect(telo.bom).not.toBeNull()
    expect(Array.isArray(telo.bom.versions)).toBe(true)
    expect(telo.bom.versions.length).toBeGreaterThanOrEqual(1)
    const approved = telo.bom.versions.find((v: { status: string }) => v.status === 'APPROVED')
    expect(approved.lineCount).toBeGreaterThan(3)
  })

  it('GET /api/bom/[id]: vrstice urejene po lineOrder; NEVEZANO razlog na nevezanih', async () => {
    const zadnja = await db.bOMVersion.findFirstOrThrow({
      where: { bom: { projectId: projektId }, status: 'APPROVED' },
      orderBy: { versionNumber: 'desc' },
    })
    const r = await bomVersionGet(jsonReq(`/bom/${zadnja.id}`, monter.token), { params: Promise.resolve({ id: zadnja.id }) })
    expect(r.status).toBe(200)
    const telo = await r.json()
    expect(telo.version.id).toBe(zadnja.id)
    expect(telo.version.lines.map((l: { lineOrder: number }) => l.lineOrder)).toEqual(
      telo.version.lines.map((l: { lineOrder: number }) => l.lineOrder).sort((a: number, b: number) => a - b),
    )
    const sidra = telo.version.lines.find((l: { internalSku: string }) => l.internalSku === SIFRA)
    expect(sidra.inventoryId).toBe(inventoryIdSidra)
    expect(sidra.vezavaRazlog).toBeNull()
    const steklo = telo.version.lines.find((l: { internalSku: string }) => l.internalSku === 'STK-1323-860')
    expect(steklo.inventoryId).toBeNull()
    expect(steklo.vezavaRazlog).toContain('NEVEZANA')
    expect(steklo.vezavaRazlog).toContain('EXACT')
  })

  it('BREZ prijave → 401 (ista vrata kot vse projektne rute)', async () => {
    const r = await bomGet(jsonReq(`/bom?projectId=${projektId}`, null))
    expect(r.status).toBe(401)
  })
})

describe('R376 — §11 PROCUREMENT agregacija (planned/reserved/ordered/…/variance)', () => {
  // Kanonski pisci (recordMovement — NE ročni vpisi v StockLedger):
  // OPENING +20 → RESERVATION 5 → RELEASE 2 → RECEIPT 10 → ISSUE 3 →
  // RETURN 1 → WASTE 1. Pričakovano za SIDRA:
  //   reserved = −(−5 + 2) = 3; received = 10; issued = 3; returned = 1;
  //   wasted = 1; ordered (MaterialOrderItem) = 8; consumed (MaterialUsage)
  //   = 4; planned = 34 (iz postavke); variance = 34 − 4 − 1 + 1 = 30.
  beforeAll(async () => {
    let stevec = 0
    const poteza = (eventType: 'OPENING' | 'RESERVATION' | 'RELEASE' | 'RECEIPT' | 'ISSUE' | 'RETURN' | 'WASTE', kolicina: number) =>
      recordMovement({
        inventoryId: inventoryIdSidra,
        eventType,
        kolicina,
        projectId: projektId,
        actorId: monter.user.id,
        reason: `r376 test`,
        idempotencyKey: `r376:${Date.now()}:${stevec++}`,
      })
    await poteza('OPENING', 20)
    await poteza('RESERVATION', 5)
    await poteza('RELEASE', 2)
    await poteza('RECEIPT', 10)
    await poteza('ISSUE', 3)
    await poteza('RETURN', 1)
    await poteza('WASTE', 1)
    // Naročilo projekta za isti artikel (orderedQty):
    const dobavitelj = await db.supplier.create({
      data: { naziv: `Dobavitelj ${OZNAKA}`, kontakt: 'Test', email: `dob-${OZNAKA}@test.si` },
    })
    const narocilo = await db.materialOrder.create({
      data: { projectId: projektId, supplierId: dobavitelj.id, status: 'POSLANO', skupajCena: 8 * 1.2 },
    })
    await db.materialOrderItem.create({
      data: { orderId: narocilo.id, inventoryId: inventoryIdSidra, kolicina: 8, cena: 1.2, naziv: 'Kemično sidro M8×80', enota: 'kos' },
    })
    // Dejanska poraba na projektu (consumedQty):
    await db.materialUsage.create({ data: { projectId: projektId, inventoryId: inventoryIdSidra, porabljenaKolicina: 4 } })
  })

  it('MATEMATIKA §11: vseh 9 količin preslikanih EXACTNO iz virov', async () => {
    const r = await procurementGet(jsonReq(`/bom/procurement?projectId=${projektId}`, monter.token))
    expect(r.status).toBe(200)
    const telo = await r.json()
    expect(telo.bomVersion.status).toBe('APPROVED')
    const sidra = telo.lines.find((l: { internalSku: string }) => l.internalSku === SIFRA)
    expect(sidra.vezava).toBe('VEZANO')
    expect(sidra.plannedQty).toBe(verzijaIssued.sidraQty) // 34
    expect(sidra.reservedQty).toBe(3) // −(Σ RESERVATION −5 + Σ RELEASE +2)
    expect(sidra.orderedQty).toBe(8) // Σ MaterialOrderItem.kolicina
    expect(sidra.receivedQty).toBe(10) // Σ StockLedger RECEIPT
    expect(sidra.issuedQty).toBe(3) // −Σ StockLedger ISSUE
    expect(sidra.consumedQty).toBe(4) // Σ MaterialUsage.porabljenaKolicina
    expect(sidra.returnedQty).toBe(1) // Σ StockLedger RETURN
    expect(sidra.wastedQty).toBe(1) // −Σ StockLedger WASTE
    // PIN SHIFT R378: odgovor /api/bom/procurement je bil NADGRAJEN o §9
    // verigo — po vrstici DODANA polji producedQty (Σ ProductionOrderLine nad
    // vrstico, VSI nalogi) in installedQty (Σ InstallationRecordLine SAMO
    // POTRJENIH zapisov). VEZANA vrstica BREZ nalogov/zapisov → 0 (iskrena
    // ničla: nič ni izdelano/vgrajeno PROTI vrstici — to NI NEVEZANO NULL).
    // Vsa obstoječa polja R376 ostajajo nedotaknjena (additivna razširitev).
    expect(sidra.producedQty).toBe(0) // ni proizvodnih nalogov nad to vrstico
    expect(sidra.installedQty).toBe(0) // ni as-installed zapisov nad to vrstico
    expect(sidra.variance).toBe(verzijaIssued.sidraQty - 4 - 1 + 1) // planned − consumed − wasted + returned
  })

  it('NEVEZANA vrstica → VSE dejanske količine NULL + vezava NEVEZANO (NE ničle)', async () => {
    const r = await procurementGet(jsonReq(`/bom/procurement?projectId=${projektId}`, monter.token))
    const telo = await r.json()
    const steklo = telo.lines.find((l: { internalSku: string }) => l.internalSku === 'STK-1323-860')
    expect(steklo.vezava).toBe('NEVEZANO')
    expect(steklo.vezavaRazlog).toContain('NEZNANE, ne nič')
    // NIČLA bi bila laž "nič se ni zgodilo" — dejansko je NEZNANO:
    // PIN SHIFT R378: med polja NULL-ov dodani producedQty/installedQty (§9
    // veriga nad nevezanim materialom ni dokazljiva — NULL, ne nič).
    for (const polje of ['reservedQty', 'orderedQty', 'receivedQty', 'issuedQty', 'consumedQty', 'returnedQty', 'wastedQty', 'producedQty', 'installedQty', 'variance'] as const) {
      expect(steklo[polje]).toBeNull()
    }
    // plannedQty pa je znana iz kanonske vrstice (§5 sled):
    expect(steklo.plannedQty).toBeGreaterThan(0)
  })

  it('IDEMPOTENTNA branja: dva GET → identično telo (čist read-model)', async () => {
    const a = await procurementGet(jsonReq(`/bom/procurement?projectId=${projektId}`, monter.token))
    const b = await procurementGet(jsonReq(`/bom/procurement?projectId=${projektId}`, monter.token))
    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect(JSON.stringify(await a.json())).toBe(JSON.stringify(await b.json()))
  })

  it('Preslikava je DOKUMENTIRANA v odgovoru (viri + nePreslikano tipi)', async () => {
    const r = await procurementGet(jsonReq(`/bom/procurement?projectId=${projektId}`, monter.token))
    const telo = await r.json()
    // Vsako §11 polje ima izrecen vir (brez ugibanj) — PIN SHIFT R378: med
    // viri dodana producedQty/installedQty (§9 veriga, dodani viri):
    for (const polje of ['plannedQty', 'reservedQty', 'orderedQty', 'receivedQty', 'issuedQty', 'consumedQty', 'returnedQty', 'wastedQty', 'producedQty', 'installedQty', 'variance'] as const) {
      expect(telo.preslikava.viri[polje]).toBeTruthy()
    }
    // Nepreslikani tipi so IZRECNO naštetí (honest fail-closed):
    const nePreslikano = telo.preslikava.nePreslikano.map((n: { tip: string }) => n.tip)
    expect(nePreslikano).toEqual(expect.arrayContaining(['DAMAGE', 'ADJUSTMENT', 'OPENING', 'PURCHASE', 'PROJECT_ALLOCATION']))
  })

  it('Brez APPROVED verzije → 404 (fail-closed, ne prazen seznam)', async () => {
    const stranka = await db.customer.findFirstOrThrow({ where: { ime: `Stranka ${OZNAKA}` } })
    const brez = await db.project.create({
      data: { nazivProjekta: `${OZNAKA}-brez ${Date.now()}`, status: 'V_TEKU', monterId: monter.user.id, customerId: stranka.id },
    })
    try {
      const r = await procurementGet(jsonReq(`/bom/procurement?projectId=${brez.id}`, monter.token))
      expect(r.status).toBe(404)
      expect((await r.json()).error).toContain('odobrene BOM verzije')
    } finally {
      await db.project.delete({ where: { id: brez.id } })
    }
  })
})
