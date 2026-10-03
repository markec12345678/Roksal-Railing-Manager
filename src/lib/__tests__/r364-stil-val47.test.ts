import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// R364 — STIL val 47: ring PARITETA measurements-tab družine (največji
// preostali parity gap po val 43–46: fetch-first rg sken = 47 × navy/40
// [18 že nosi offset-2 + 29 brez] = VSI focus-visible ringi, 0 non-focus
// navy/40). 29 × popravkov [28 × focus-visible:ring-offset-2 dodan [12
// vrstic-rep + 8 template `${ + 5 ring-inset + 2 disabled:cursor-wait + 1
// zaprti niz] + 1 × ring-offset-1→2 normalizacija (L3125 status cikel chip —
// val 44 precedens)] — determinističen perl negative-lookahead transform +
// ločena offset-1 substitucija; 47/47 navy/40 nosi offset-2 [razcep števca =
// 0]. aria/title ZAMRZNJENI (ring-only runda — val 44/46 precedens);
// handleStatusCycle in ostala logika NIČ. r172 prst 6051 POTRJEN IZ DISKA
// (ring-only in-place = 0 novih vrstic: 6232→6232; LEKCIJA R361: 'ŠTEJ IZ
// DISKA'). Stale pini PRED-SCAN (proaktiven rg sken): edina 2 exact-quote
// pina v testnem korpusu z navy/40" (r242:157, r268:290) bereta
// material-intelligence-tab.tsx oziroma team-tab.tsx → NE kažeta na
// measurements-tab → 0 shiftov potrebnih; substring pini preživijo in-place
// razširitev (brez zapirala). 0 novih hex [števec najdišč = 0 pred in po —
// LEKCIJA R360 (4)]. FEATURE runde: e2e-lib dedup 4. val — NOV pomočnik
// eb_pocakaj_zalogo (identičen poll predikat h2 'Zaloga' = ×2 byte-identična
// [r363-qa-spot B, r364-qa-spot B] + ×1 O-R brat [r362-qa-spot2 D2] — kanon
// PROAKTIVNO pri 2. ponovitvi, LEKCIJA R362 (3): prag R352 je 3., a helper +
// poroba ob 1. uporabi v ISTI rundi je čistejša; zamrznjeni spot skripti NI
// mutirani; kanonizirana OBLIKA = preprosta h2 oblika).

const MERITVE = readFileSync(join(process.cwd(), 'src/components/roksal/measurements-tab.tsx'), 'utf8')
const E2ELIB = readFileSync(join(process.cwd(), 'scripts/e2e-lib.sh'), 'utf8')
const SPOT = readFileSync(join(process.cwd(), 'scripts/r364-qa-spot.sh'), 'utf8')
const R242 = readFileSync(join(process.cwd(), 'src/lib/__tests__/r242-narocila-rbac.test.ts'), 'utf8')
const R268 = readFileSync(join(process.cwd(), 'src/lib/__tests__/r268-ekipa-stanje-pdf.test.ts'), 'utf8')

describe('R364 — STIL val 47: ring pariteta measurements-tab družine', () => {
  it('(A) PARITETA guard: vsak navy/40 žeton v datoteki nosi ring-offset-2 (razcep števca = 0; 47/47) + ring-offset-1 popolnoma normaliziran', () => {
    const vsi = MERITVE.split('focus-visible:ring-roksal-navy/40').length - 1
    const zOffsetom = MERITVE.split('focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2').length - 1
    expect(vsi).toBe(47)
    expect(vsi - zOffsetom).toBe(0)
    expect(MERITVE.split('ring-offset-1').length - 1).toBe(0)
  })

  it('(B) era-diskriminatorji ×1/×1/×5/×1 (vsi ×0 v HEAD pred rundo — fetch-first git grep)', () => {
    expect(MERITVE.match(/text-3xs font-medium border transition-all hover:opacity-80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-roksal-navy\/40 focus-visible:ring-offset-2/g) ?? []).toHaveLength(1)
    expect(MERITVE.match(/px-2\.5 py-1 text-\[11px\] font-medium hover:bg-roksal-navy\/90 active:scale-\[0\.96\] focus-visible:ring-2 focus-visible:ring-roksal-navy\/40 focus-visible:ring-offset-2/g) ?? []).toHaveLength(1)
    expect(MERITVE.match(/focus-visible:ring-inset focus-visible:ring-roksal-navy\/40 focus-visible:ring-offset-2 focus-visible:outline-hidden transition-colors/g) ?? []).toHaveLength(5)
    expect(MERITVE.match(/h-8 px-3 focus-visible:ring-2 focus-visible:ring-roksal-navy\/40 focus-visible:ring-offset-2( focus-visible:border-roksal-navy\/40)?( dark:focus-visible:border-roksal-ink\/40)?"/g) ?? []).toHaveLength(1)
  })

  it('(C) zamrznjeni aria/logika status-orkestracije (era-kontrakt — ring-only runda, LEKCIJA R361: statični segmenti brez interpolacijske meje)', () => {
    expect(MERITVE.split('Status meritve ').length - 1).toBeGreaterThanOrEqual(1)
    expect(MERITVE).toContain('. Klik za spremembo v ')
    expect(MERITVE.split('handleStatusCycle').length - 1).toBe(2)
    expect(MERITVE.split('disabled:cursor-wait').length - 1).toBe(3)
  })

  it('(D) 0 novih hex — iskrena zamrznjena resnica (števec najdišč = 0, LEKCIJA R360 (4))', () => {
    expect(MERITVE.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toHaveLength(0)
  })

  it('(E) FEATURE e2e-lib dedup 4. val: eb_pocakaj_zalogo ŽIV + poroba ob 1. uporabi v r364-qa-spot.sh + exact-quote pini kažejo MIMO measurements-tab (0 shiftov)', () => {
    expect(E2ELIB).toContain('eb_pocakaj_zalogo() {')
    expect(E2ELIB).toContain("some(h=>h.textContent.trim()==='Zaloga')")
    expect(SPOT).toContain('eb_pocakaj_zalogo 15')
    // exact-quote pina (edina 2 v korpusu z navy/40") bereta MIMO measurements-tab:
    expect(R242).toContain('material-intelligence-tab.tsx')
    expect(R268).toContain('team-tab.tsx')
  })
})
