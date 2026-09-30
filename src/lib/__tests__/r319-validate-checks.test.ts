// R319 (issue #5 §18 — ZAKLJUČEK R136 obljube) — VALIDATE CHECK omejitev.
// ---------------------------------------------------------------------------
// R136 je dodal 8 CHECK omejitev z NOT VALID (fail-closed brez tveganja
// deploja) in v glavi migracije izrecno obljubil VALIDATE v ločeni rundi.
// R319 je ta runda: migracija 20261001080000_r319_validate_checks.
//
// STRAŽAR (fail-closed ×3):
//   1. Migracija OBSTOJA na disku (anti-stale: pobrisana mapa = javna napaka).
//   2. Vseh 8 imen ima convalidated = TRUE v testni bazi — globalSetup
//      (tools/vitest-global-setup.ts) zgradi CELO verigo migracij iz nič
//      (prisma migrate deploy), torej ta test dokazuje VERIGO, ne stanja.
//   3. EXCLUDE material_price_no_overlap ostaja validated (R136 takoj).
//
// Zamisljena regresija, ki jo ta test ujame: nekdo pobriše/preimenuje
// migracijo r319 → convalidated ostane false → test pade; nekdo doda
// DEVETO not-valid CHECK omejitev → (ne)pokrit — seznam je ZAKLEPEN na
// R136 nabor (dodajanje = namerna sprememba, ki zahteva lastni STRAŽAR).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { db } from '@/lib/db'

const R319_MIGRACIJA = join('prisma', 'migrations', '20261001080000_r319_validate_checks', 'migration.sql')

/** Nabor R136 CHECK imen — EN VIR resnice: migracija r136_db_constraints. */
const R136_CHECK_IMENA = [
  'invoice_amounts_nonnegative',
  'invoice_status_allowed',
  'invoice_tip_allowed',
  'inventory_stock_nonnegative',
  'order_item_quantity_positive',
  'order_total_nonnegative',
  'usage_quantity_positive',
  'price_nonnegative',
] as const

describe('R319 — VALIDATE CHECK omejitev (R136 obljuba zaprta)', () => {
  it('migracija r319_validate_checks obstaja na disku (anti-stale)', () => {
    const vir = readFileSync(join(process.cwd(), R319_MIGRACIJA), 'utf8')
    // Vseh 8 ukazov je izrecno vsebovanih (žeton po žeton, R136 imena).
    for (const ime of R136_CHECK_IMENA) {
      expect(vir).toContain(`VALIDATE CONSTRAINT "${ime}"`)
    }
  })

  it('vseh 8 R136 CHECKov ima convalidated = TRUE po migrate deploy (veriga iz nič)', async () => {
    const vrstice = await db.$queryRaw<{ conname: string; contype: string; convalidated: boolean }[]>`
      SELECT conname, contype, convalidated FROM pg_constraint
      WHERE conname IN ('invoice_amounts_nonnegative', 'invoice_status_allowed', 'invoice_tip_allowed',
        'inventory_stock_nonnegative', 'order_item_quantity_positive', 'order_total_nonnegative',
        'usage_quantity_positive', 'price_nonnegative')`
    expect(vrstice.map((r) => r.conname).sort()).toEqual([...R136_CHECK_IMENA].sort())
    for (const r of vrstice) {
      expect(r.contype, `${r.conname} mora biti CHECK`).toBe('c')
      expect(r.convalidated, `${r.conname} mora biti VALIDATED (R319)`).toBe(true)
    }
  })

  it('EXCLUDE material_price_no_overlap ostaja validated (R136 takoj — brez spremembe)', async () => {
    const vrstice = await db.$queryRaw<{ conname: string; contype: string; convalidated: boolean }[]>`
      SELECT conname, contype, convalidated FROM pg_constraint
      WHERE conname = 'material_price_no_overlap'`
    expect(vrstice).toHaveLength(1)
    expect(vrstice[0]!.contype).toBe('x')
    expect(vrstice[0]!.convalidated).toBe(true)
  })
})
