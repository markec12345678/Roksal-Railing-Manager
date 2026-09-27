// R208 — F2: ŠTEVEC AKTIVNIH NAROČIL NA ZAVIHKU (stražar).
// ---------------------------------------------------------------------------
// Material zavihek: gumb 'Naročila' dobi badge s številom AKTIVNIH naročil
// (OSNUTEK/POSLANO/POTRJENO — čakajo na dejanje; DOBLJENO/PREKlicANO so
// zaključena). Pravila družine:
//  (1) IZPELJANKA iz realnih naročil (EN vir resnice, R207/R201 vzorec) —
//      ni konstant, ni ročnih števcev;
//  (2) viden LE ko > 0 (brez lažnega 0 — dokler naročila niso naložena,
//      badge NE trdi nič);
//  (3) iskren tooltip: 'iz zadnjega nalaganja' (naročila se naložijo ob
//      obisku zavihka — badge je svežinski opomnik, ne živa poizvedba);
//  (4) 0 novih hex — tokena bg-roksal-amber + text-roksal-ink (r166/r172).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..', '..')

const beri = (rel: string): string => readFileSync(join(ROOT, rel), 'utf-8')

function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  expect(a).toBeGreaterThanOrEqual(0)
  const b = src.indexOf(do_, a)
  expect(b).toBeGreaterThan(a)
  return src.slice(a, b)
}

describe('R208 stražar: izpeljanka aktivnaNarocila', () => {
  const src = beri('src/components/roksal/material-intelligence-tab.tsx')

  it('števec iz REALNIH naročil: samo OSNUTEK/POSLANO/POTRJENO (DOBLJENO/PREKlicANO izključena)', () => {
    const okno = oknoMed(
      src,
      '// R208 — F2: števec AKTIVNIH naročil',
      ').length',
    )
    expect(okno).toContain("o.status === 'OSNUTEK'")
    expect(okno).toContain("o.status === 'POSLANO'")
    expect(okno).toContain("o.status === 'POTRJENO'")
    expect(okno).not.toContain("o.status === 'DOBLJENO'")
    expect(okno).not.toContain("o.status === 'PREKlicANO'")
  })

  it('izpeljanka je nad orders stanjem (EN vir resnice — ne lokalen števec)', () => {
    const okno = oknoMed(
      src,
      '// R208 — F2: števec AKTIVNIH naročil',
      ').length',
    )
    expect(okno).toContain('orders.filter(')
  })
})

describe('R208 stražar: badge na zavihku Naročila', () => {
  const src = beri('src/components/roksal/material-intelligence-tab.tsx')

  it('badge viden LE ko > 0 (brez lažnega 0)', () => {
    const okno = oknoMed(
      src,
      '{/* R208 — F2: števec aktivnih naročil',
      '</Button>',
    )
    expect(okno).toContain('{aktivnaNarocila > 0 && (')
    expect(okno).toContain('{aktivnaNarocila}')
  })

  it('iskren tooltip: iz zadnjega nalaganja (ne živa poizvedba)', () => {
    const okno = oknoMed(
      src,
      '{/* R208 — F2: števec aktivnih naročil',
      '</Button>',
    )
    expect(okno).toContain(
      'Naročila, ki čakajo na dejanje (OSNUTEK/POSLANO/POTRJENO) — iz zadnjega nalaganja',
    )
  })

  it('0 novih hex: badge iz tokenov bg-roksal-amber + text-roksal-ink', () => {
    const okno = oknoMed(
      src,
      '{/* R208 — F2: števec aktivnih naročil',
      '</Button>',
    )
    expect(okno).toContain('bg-roksal-amber')
    expect(okno).toContain('text-roksal-ink')
    expect(okno).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('badge na Naročila zavihku (med BOM Refine in Dobavitelji)', () => {
    const okno = oknoMed(
      src,
      "onClick={() => setTab('orders')}",
      "onClick={() => setTab('suppliers')}",
    )
    expect(okno).toContain('Naročila')
    expect(okno).toContain('aktivnaNarocila')
  })

  it('badge tabular-nums + rounded-full (družina pečatov/žetonov)', () => {
    const okno = oknoMed(
      src,
      '{/* R208 — F2: števec aktivnih naročil',
      '</Button>',
    )
    expect(okno).toContain('rounded-full')
    expect(okno).toContain('tabular-nums')
  })
})
