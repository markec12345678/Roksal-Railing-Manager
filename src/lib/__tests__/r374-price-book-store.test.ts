// R374 — DB testi strežniško-avtoritativnega cenika (price-book-store.ts).
// ---------------------------------------------------------------------------
// Dokazujemo (vzorec r340-validate-equipment — anti-stale + živa baza):
//   (1) migracija r374 obstaja na disku in SEED v1 cenika je v njej;
//   (2) CHECK omejitve novih tabel so VELJAVNE (convalidated = TRUE);
//   (3) getActivePriceBookVersion po migraciji vrne SEED v1 z vsemi 25
//       postavkami in vrednostmi TOČNO iz defaultPriceBook();
//   (4) DVE ACTIVE hkrati → javna PriceBookStoreError 409 (ročni poseg v
//       bazo se ODKRIJE, ne "izberi novejšo") — test stanje POVNE;
//   (5) reconstruct je fail-closed: manjkajoč postavka → 409 (nikoli
//       privzeta vrednost iz kode), stanje se povrne.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { db } from '@/lib/db'
import {
  getActivePriceBookVersion,
  getPriceBookVersionById,
  PRICE_BOOK_STATUSES,
  PriceBookStoreError,
} from '@/lib/price-book-store'
import { defaultPriceBook } from '@/lib/quote'

const MIGRACIJA = join('prisma', 'migrations', '20261003080000_r374_quote_versions', 'migration.sql')

describe('R374 — SEED migracije cenika (stražar anti-stale, ista baza kot CI)', () => {
  it('migracija r374_quote_versions obstaja na disku in nosi seed v1 (idempotenten)', () => {
    const vir = readFileSync(join(process.cwd(), MIGRACIJA), 'utf8')
    expect(vir).toContain('CREATE TABLE "PriceBookVersion"')
    expect(vir).toContain('CREATE TABLE "PriceBookItem"')
    expect(vir).toContain('CREATE TABLE "Quote"')
    expect(vir).toContain('CREATE TABLE "QuoteVersion"')
    expect(vir).toContain('quoteVersionId')
    // Seed v1: fiksni ID + ON CONFLICT DO NOTHING (idempotentnost):
    expect(vir).toContain("'pricebook-v1'")
    expect(vir).toContain('ON CONFLICT ("id") DO NOTHING')
  })

  it('CHECK omejitve novih tabel so VELJAVNE (convalidated = TRUE — veriga iz nič)', async () => {
    const vrstice = await db.$queryRaw<{ conname: string; convalidated: boolean }[]>`
      SELECT conname, convalidated FROM pg_constraint
      WHERE conname IN (
        'pricebook_version_status_allowed', 'quote_version_status_allowed',
        'pricebook_item_sales_price_nonneg', 'quote_version_subtotal_nonneg',
        'quote_version_vat_nonneg', 'quote_version_total_nonneg'
      )`
    expect(vrstice).toHaveLength(6)
    for (const v of vrstice) {
      expect(v.convalidated, `${v.conname} mora biti VALIDATED`).toBe(true)
    }
  })

  it('getActivePriceBookVersion → SEED v1 z vsemi 25 postavkami, vrednosti TOČNO iz defaultPriceBook()', async () => {
    const active = await getActivePriceBookVersion()
    expect(active).not.toBeNull()
    expect(active!.version).toBe(1)
    expect(active!.status).toBe('ACTIVE')
    expect(active!.currency).toBe('EUR')
    // Whitelist ≡ numerični ključi defaultPriceBook — VSAK mora biti seedan:
    const pricakovanje = defaultPriceBook()
    expect(active!.items).toHaveLength(25)
    for (const [k, v] of Object.entries(pricakovanje)) {
      if (typeof v !== 'number') continue
      const postavka = active!.items.find((i) => i.key === k)
      expect(postavka, `seed mora vsebovati ključ ${k}`).toBeDefined()
      expect(postavka!.salesPrice).toBe(v)
    }
    // Rekonstruirana knjiga ≡ defaultPriceBook (cel objekt):
    expect(active!.prices).toEqual(pricakovanje)
    // referenceCost = NULL povsod — marža iskreno NEZNANO (§8):
    for (const i of active!.items) {
      expect(i.referenceCost).toBeNull()
    }
  })

  it('getPriceBookVersionById → ista verzija po ID (vezana knjiga za integriteto)', async () => {
    const active = await getActivePriceBookVersion()
    const poId = await getPriceBookVersionById(active!.id)
    expect(poId).not.toBeNull()
    expect(poId!.id).toBe(active!.id)
    expect(poId!.prices).toEqual(active!.prices)
  })

  it('DVE ACTIVE hkrati → javna PriceBookStoreError 409 (ročni poseg ODKRIT, stanje POVNJENO)', async () => {
    // Ročno ustvari drugo ACTIVE (simulira pokvarjen administrativni poseg):
    const drugaId = 'pricebook-test-druga-active'
    await db.priceBookVersion.create({
      data: { id: drugaId, version: 999, status: 'ACTIVE', currency: 'EUR', effectiveFrom: new Date() },
    })
    try {
      await expect(getActivePriceBookVersion()).rejects.toMatchObject({
        suggestedStatus: 409,
        message: expect.stringContaining('aktivnih'),
      })
      // Tip je PriceBookStoreError (ne generična napaka):
      await expect(getActivePriceBookVersion()).rejects.toBeInstanceOf(PriceBookStoreError)
    } finally {
      // POVNEJ stanje — test NE pusti pokvarjene baze naslednjim testom:
      await db.priceBookVersion.delete({ where: { id: drugaId } }).catch(() => undefined)
    }
    // Po povrnitvi je stanje spet zdravo:
    const active = await getActivePriceBookVersion()
    expect(active!.version).toBe(1)
  })

  it('reconstruct je fail-closed: manjkajoča postavka → PriceBookStoreError 409, stanje POVNJENO', async () => {
    const active = await getActivePriceBookVersion()
    const zaboica = active!.items.find((i) => i.key === 'postPerEach')!
    // Izbriši po (versionId, key) — ID vzorec seva ni pomemben:
    await db.priceBookItem.deleteMany({ where: { priceBookVersionId: active!.id, key: zaboica.key } })
    try {
      await expect(getActivePriceBookVersion()).rejects.toBeInstanceOf(PriceBookStoreError)
      await expect(getActivePriceBookVersion()).rejects.toMatchObject({ suggestedStatus: 409 })
    } finally {
      // POVNEJ postavko z ISTEMI vrednostmi (iz defaultPriceBook — ENA resnica):
      await db.priceBookItem.create({
        data: {
          id: `pbitem-restore-${zaboica.key}`,
          priceBookVersionId: active!.id,
          key: zaboica.key,
          label: zaboica.label,
          unit: zaboica.unit,
          category: zaboica.category,
          salesPrice: zaboica.salesPrice,
          referenceCost: null,
        },
      })
    }
    const po = await getActivePriceBookVersion()
    expect(po!.items.find((i) => i.key === zaboica.key)).toBeDefined()
    expect(po!.items).toHaveLength(25)
  })

  it('STATUSI: natanko DRAFT/ACTIVE/RETIRED (drift = javna napaka)', () => {
    expect([...PRICE_BOOK_STATUSES]).toEqual(['DRAFT', 'ACTIVE', 'RETIRED'])
  })

  it('SEED v bazi: PriceBookItem števec ≡ whitelist (25 postavk)', async () => {
    const stevilo = await db.priceBookItem.count({ where: { priceBookVersionId: 'pricebook-v1' } })
    expect(stevilo).toBe(25)
  })

  it('neobstoječa verzija → null (NE default iz kode — 503/404 pot klicatelja)', async () => {
    const manjka = await getPriceBookVersionById('neobstojeca-verzija')
    expect(manjka).toBeNull()
  })
})
