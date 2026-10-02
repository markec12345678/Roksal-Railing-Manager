// R380 (issue #13, korak R168 iz §12) — DECIMAL DB round-tripi.
// ---------------------------------------------------------------------------
// Testi dokazujejo, da DB po migraciji r379 nosi EXAKTNE vrednosti:
//   • DECIMAL(12,3) količine: 0.1 + 0.2 = 0.3 TOČNO (float laž ubita v
//     VIRU resnice — bazi, ne samo na DTO meji);
//   • veriga StockLedger.balanceAfter ostane točna skozi več premikov;
//   • DECIMAL(12,2) denar: centna točnost (Invoice.osnova/ddv/znesek,
//     Project.marginLocked/estimatedPrice, MaterialPrice.cena,
//     InventoryLot.purchasePrice, Supplier.popust, Profil.cenaM);
//   • FAILO-CLOSED PRECIZNOST: količina z >3 decimalkami → 400 (ne tiho
//     zaokroževanje = tiha mutacija);
//   • DB CHECK sloj: nekanonična enota v konverzijskem stolpcu → zavrnjeno
//     na BAZI (zadnja linija obrambe, kanon R136).
import { describe, expect, it, afterEach } from 'vitest'
import { db } from '@/lib/db'
import { recordMovement, StockError } from '@/lib/inventory'

let counter = 0
const uniq = (p: string) => `${p}-${Date.now()}-${(counter += 1)}`

const ustvariArtikel = async (zaloga = 0) =>
  db.inventory.create({
    data: {
      sifraMateriala: uniq('R380-SKU'),
      naziv: uniq('R380 Artikel'),
      tip: 'Alu_profil',
      kolicinaZaloga: zaloga,
      enota: 'm',
      minimalnaZaloga: 0,
    },
  })

const pocisti = async (id: string) => {
  await db.inventoryMovement.deleteMany({ where: { inventoryId: id } })
  await db.stockLedger.deleteMany({ where: { inventoryId: id } })
  await db.inventoryLot.deleteMany({ where: { inventoryId: id } })
  await db.inventory.delete({ where: { id } }).catch(() => undefined)
}

const ustvariStranko = () =>
  db.customer.create({ data: { ime: uniq('R380 Stranka'), naslov: 'Test 1', telefon: '00', email: `${uniq('r379')}@t.si` } })

describe('R380 — Decimal DB round-tripi (§12 točnost v viru resnice)', () => {
  const created: string[] = []
  afterEach(async () => {
    for (const id of created.splice(0)) await pocisti(id)
  })

  it('DECIMAL(12,3) zaloga: 0.1 + 0.2 = TOČNO 0.3 v bilanci IN ledger verigi', async () => {
    const inv = await ustvariArtikel(0)
    created.push(inv.id)
    await recordMovement({ inventoryId: inv.id, eventType: 'PURCHASE', kolicina: 0.1, actorId: null })
    await recordMovement({ inventoryId: inv.id, eventType: 'PURCHASE', kolicina: 0.2, actorId: null })

    const fresh = await db.inventory.findUniqueOrThrow({ where: { id: inv.id } })
    // Float bi rekel 0.30000000000000004; DB DECIMAL(12,3) + centralna
    // politika (vsota v Decimal) = TOČNO 0.3.
    expect(fresh.kolicinaZaloga.toNumber()).toBe(0.3)

    // Veriga balanceAfter: zadnji dogodek nosi isti točen saldo.
    const entries = await db.stockLedger.findMany({ where: { inventoryId: inv.id } })
    const sorted = [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    expect(sorted[0].balanceAfter.toNumber()).toBe(0.1)
    expect(sorted[1].balanceAfter.toNumber()).toBe(0.3)
  })

  it('FAILO-CLOSED PRECIZNOST: količina z >3 decimalkami → 400 (ne tiho zaokroževanje)', async () => {
    const inv = await ustvariArtikel(5)
    created.push(inv.id)
    await expect(
      recordMovement({ inventoryId: inv.id, eventType: 'PORABA' as never, kolicina: 0.0005, actorId: null } as never),
    ).rejects.toThrow(StockError)
    // ENAKO za izgubo ob RESTORE (negativna smer):
    try {
      await recordMovement({ inventoryId: inv.id, eventType: 'WASTE', kolicina: 0.9999, actorId: null })
      expect.unreachable('0.9999 mora pasti na preciznosti')
    } catch (e) {
      expect(e).toBeInstanceOf(StockError)
      expect((e as StockError).message).toContain('3 decimalke')
    }
    // Zaloga NESPREMENJENA (ni sledi, ni tihe mutacije):
    const fresh = await db.inventory.findUniqueOrThrow({ where: { id: inv.id } })
    expect(fresh.kolicinaZaloga.toNumber()).toBe(5)
  })

  it('DECIMAL(12,2) denar — Invoice: osnova/ddv/znesek točno do centa', async () => {
    const stranka = await ustvariStranko()
    const projekt = await db.project.create({
      data: { nazivProjekta: uniq('R380 Projekt'), customerId: stranka.id, status: 'NACRTOVANO' },
    })
    const invoice = await db.invoice.create({
      data: {
        stevilka: uniq('R380-INV'),
        tip: 'RACUN',
        projectId: projekt.id,
        postavke: '[]', // obvezno polje sheme (JSON postavk — tu prazno, denar je predmet testa)
        osnova: 1234.56,
        ddv: 271.6,
        znesek: 1506.16,
        rokPlacilaDni: 30,
      },
    })
    expect(invoice.osnova.toNumber()).toBe(1234.56)
    expect(invoice.ddv.toNumber()).toBe(271.6)
    expect(invoice.znesek.toNumber()).toBe(1506.16)
    // Cleanup
    await db.invoice.delete({ where: { id: invoice.id } })
    await db.project.delete({ where: { id: projekt.id } })
    await db.customer.delete({ where: { id: stranka.id } })
  })

  it('DECIMAL(12,2) Project: marginLocked + estimatedPrice centna točnost (issue #13 srce)', async () => {
    const stranka = await ustvariStranko()
    const projekt = await db.project.create({
      data: {
        nazivProjekta: uniq('R380 Marža'),
        customerId: stranka.id,
        status: 'NACRTOVANO',
        estimatedPrice: 3689.61,
        marginLocked: 452.07,
      },
    })
    const po = await db.project.findUniqueOrThrow({ where: { id: projekt.id } })
    expect(po.estimatedPrice!.toNumber()).toBe(3689.61)
    expect(po.marginLocked!.toNumber()).toBe(452.07)
    await db.project.delete({ where: { id: projekt.id } })
    await db.customer.delete({ where: { id: stranka.id } })
  })

  it('DECIMAL po domenu: MaterialPrice.cena (12,2) + Supplier.popust (5,2) + Profil.cenaM (12,2)', async () => {
    const inv = await ustvariArtikel(0)
    created.push(inv.id)
    const dobavitelj = await db.supplier.create({
      data: { naziv: uniq('R380 Dobavitelj'), popust: 12.5 },
    })
    const cena = await db.materialPrice.create({
      data: { inventoryId: inv.id, supplierId: dobavitelj.id, cena: 2.5 },
    })
    expect(cena.cena.toNumber()).toBe(2.5)

    const profil = await db.profil.create({
      data: { sifra: uniq('R380-PROF'), naziv: 'Test profil', material: 'alu', kategorija: 'R380 Line', cenaM: 85.5 },
    })
    expect(profil.cenaM.toNumber()).toBe(85.5)

    const supplierDb = await db.supplier.findUniqueOrThrow({ where: { id: dobavitelj.id } })
    expect(supplierDb.popust.toNumber()).toBe(12.5)

    await db.materialPrice.delete({ where: { id: cena.id } })
    await db.supplier.delete({ where: { id: dobavitelj.id } })
    await db.profil.delete({ where: { id: profil.id } })
  })

  it('DB CHECK sloj: nekanonična enota v konverzijskem stolpcu → zavrnjena NA BAZI', async () => {
    // 'm2' ni v kanonskem naboru — CHECK Inventory_purchaseUnit_kanon mora
    // ustvariti zavrniti (zadnja linija obrambe, kanon R136).
    await expect(
      db.inventory.create({
        data: {
          sifraMateriala: uniq('R380-CHECK'),
          naziv: 'CHECK test',
          tip: 'Alu_profil',
          kolicinaZaloga: 1,
          enota: 'm',
          minimalnaZaloga: 0,
          purchaseUnit: 'm2',
        },
      }),
    ).rejects.toThrow()
  })

  it('DB CHECK sloj: ničelni conversionFactor → zavrnjen (tiho pokvarjena pretvorba prepovedana)', async () => {
    await expect(
      db.inventory.create({
        data: {
          sifraMateriala: uniq('R380-CHECK0'),
          naziv: 'CHECK faktor test',
          tip: 'Alu_profil',
          kolicinaZaloga: 1,
          enota: 'm',
          minimalnaZaloga: 0,
          conversionFactor: 0,
        },
      }),
    ).rejects.toThrow()
  })
})
