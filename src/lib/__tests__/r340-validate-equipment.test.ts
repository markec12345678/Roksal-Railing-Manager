// R340 (issue #5 §31/§18 — ZAKLJUČEK R145 obljube) — VALIDATE CHECK omejitev.
// ---------------------------------------------------------------------------
// R145 je dodal Equipment CHECK "equipment_status_allowed" z NOT VALID
// (fail-closed brez tveganja deploja). R319 je validiral vseh 8 R136 CHECKov
// in izpustil ta R145 CHECK (najdba analize R339/R340). R340 je ta runda:
// migracija 20261001200000_r340_validate_equipment.
//
// STRAŽAR (fail-closed ×3, vzorec r319-validate-checks):
//   1. Migracija OBSTOJA na disku (anti-stale: pobrisana mapa = javna napaka).
//   2. equipment_status_allowed ima convalidated = TRUE v testni bazi —
//      globalSetup (tools/vitest-global-setup.ts) zgradi CELO verigo
//      migracij iz nič (prisma migrate deploy), torej ta test dokazuje
//      VERIGO, ne stanja.
//   3. Nabor EQUIPMENT_STATUSES v aplikaciji (equipment-lifecycle.ts) je
//      IDENTIČEN CHECK naboru (drift med DB in aplikacijo = javna napaka).
//
// Zamisljena regresija, ki jo ta test ujame: nekdo pobriše/preimenuje
// migracijo r339 → convalidated ostane false → test pade; nekdo spremeni
// CHECK nabor v R145 migraciji → nabor ni več identičen aplikacijskemu
// EQUIPMENT_STATUSES → test pade (namerna sprememba zahteva posodobitev
// obeh strani hkrati — ENA resnica).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { db } from '@/lib/db'
import { EQUIPMENT_STATUSES } from '@/lib/equipment-lifecycle'

const R339_MIGRACIJA = join('prisma', 'migrations', '20261001200000_r340_validate_equipment', 'migration.sql')
const R145_MIGRACIJA = join('prisma', 'migrations', '20260926080000_r145_equipment_lifecycle', 'migration.sql')

/** CHECK nabor, ki ga je R145 zabetoniral v DB. */
const R145_CHECK_NABOR = ['NA_VOLJO', 'V_UPORABI', 'V_SERVISU', 'IZGUBLJENO', 'UPOKOJENO'] as const

describe('R340 — VALIDATE CHECK Equipment (R145 obljuba zaprta)', () => {
  it('migracija r339_validate_equipment obstaja na disku (anti-stale)', () => {
    const vir = readFileSync(join(process.cwd(), R339_MIGRACIJA), 'utf8')
    expect(vir).toContain('VALIDATE CONSTRAINT "equipment_status_allowed"')
  })

  it('equipment_status_allowed ima convalidated = TRUE po migrate deploy (veriga iz nič)', async () => {
    const vrstice = await db.$queryRaw<{ conname: string; contype: string; convalidated: boolean }[]>`
      SELECT conname, contype, convalidated FROM pg_constraint
      WHERE conname = 'equipment_status_allowed'`
    expect(vrstice).toHaveLength(1)
    expect(vrstice[0]!.contype, 'equipment_status_allowed mora biti CHECK').toBe('c')
    expect(vrstice[0]!.convalidated, 'equipment_status_allowed mora biti VALIDATED (R340)').toBe(true)
  })

  it('CHECK nabor (R145 DB) je identičen aplikacijskemu EQUIPMENT_STATUSES (drift = javna napaka)', () => {
    // DB stran: dobesedno iz migracije R145 (EN VIR resnice — ne kopija v spominu).
    const r145 = readFileSync(join(process.cwd(), R145_MIGRACIJA), 'utf8')
    const checkMatch = /CHECK \("status" IN \(([^)]+)\)\)/.exec(r145)
    expect(checkMatch, 'R145 migracija mora vsebovati CHECK(status IN (...))').not.toBeNull()
    const dbNabor = checkMatch![1]!
      .split(',')
      .map((s) => s.trim().replace(/^'|'$/g, ''))
      .sort()
    // Aplikacijska stran: EQUIPMENT_STATUSES (equipment-lifecycle.ts).
    expect(dbNabor).toEqual([...EQUIPMENT_STATUSES].sort())
    expect(dbNabor).toEqual([...R145_CHECK_NABOR].sort())
  })
})
