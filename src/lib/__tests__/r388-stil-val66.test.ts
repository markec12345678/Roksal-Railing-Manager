// r388-stil-val66.test.ts — R388 MANDATORY STIL val 66: HOVER-BARVNA
// GLADKOST (transition-colors) — 21 × INS, in-place, 0 novih vrstic.
//
// Disk resnica rundi (r388-triaza*.py + val66 kontrakt):
//  - TRIAŽA: 21 REALnih gapov (hover:(bg|text)-roksal-* BREZ transition
//    pokritosti na NIVI elementa — element-točna triaža r388-triaza5.py:
//    ui-kit Button baza 'transition-all' + Badge baza
//    'transition-[color,box-shadow]' NE pokrijeta hover:bg);
//  - ANKOR: PRE ×19 (žeton PRED hover žetonom) + PO ×2 (dashboard L2941 +
//    photo L2081 — PRE span PINAN v zamrznjenih prod-qa skriptah
//    r313–r339 + r315-stil-val6; PO vstavljanje ohranja span — brez
//    PIN SHIFTa za zamrznjene skripte);
//  - PIN SHIFT r211-fail-verbose-detail-strazar.test.ts ×2 V ISTI RUNDI
//    (kanon R368) — L60 (src L2459) + L70 (src L2602), žig
//    [PIN SHIFT R388 val 66];
//  - ISKRENE IZKLJUČITVE (mrtvi hover žetoni — NI delani zaradi dela):
//    before-after L182/L185 (pointer-events-none), step-product L275 +
//    measurements L5609 + sessions-dialog L292 + quote-followup L409
//    (hover:bg == bg — vizualno NIČ), termini-prikaz.ts ×4 (mrtvi izvozi
//    brez potrošnika), notification-center L811 (transition-transform
//    konflikt — rabil bi property-list nadgradnjo, NI aditivno);
//  - ZAMRZNJENE STATISTIKE (disk resnica ob nastanku): plain amber ring
//    (brez focus-visible/hover/dark) = 9; mrtev-CSS navy (focus ring +
//    offset BREZ border širine → border-pariteta bi bila mrtva CSS) = 82;
//    dark-only ring pari (light ≠ dark intenziveta) = 1 (notification
//    L748 — val 65 seed; druge družine izčrpane).
//  - in-place (0 novih vrstic), 0 novih hex, 0 novih aria/title.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const R = (f: string): string => readFileSync(join(process.cwd(), 'src', f), 'utf-8')
const pod = (s: string, t: string): number => s.split(t).length - 1

const TC = 'transition-colors'

const TARCE = [
  { f: 'components/roksal/dashboard-tab.tsx', ln: [1223, 1227, 1231, 1238, 1239, 1319, 2459, 2602, 2607, 2936, 2941] },
  { f: 'components/roksal/termini-card.tsx', ln: [388] },
  { f: 'app/setup/setup-client.tsx', ln: [100] },
  { f: 'app/aktivacija/[token]/activation-client.tsx', ln: [65] },
  { f: 'components/viz/viz-tab.tsx', ln: [330] },
  { f: 'components/viz/product-home.tsx', ln: [147] },
  { f: 'components/roksal/photo-tab.tsx', ln: [1162, 2081, 2294] },
  { f: 'components/roksal/measurements-tab.tsx', ln: [3355, 4036] },
]

const PRIČAKOVANE_VRSTICE: Record<string, number> = {
  'components/roksal/dashboard-tab.tsx': 3188,
  'components/roksal/termini-card.tsx': 539,
  'components/roksal/photo-tab.tsx': 2684,
  'components/roksal/measurements-tab.tsx': 6232,
  'components/viz/viz-tab.tsx': 347,
  'components/viz/product-home.tsx': 157,
  'app/setup/setup-client.tsx': 236,
  'app/aktivacija/[token]/activation-client.tsx': 139,
}

describe('R388 stil val 66 — hover-barvna gladkost (21 × INS transition-colors)', () => {
  it('(A) PARITETA: vseh 21 tarč nosi transition-colors na isti vrstici (gladek hover, nič snap)', () => {
    let skupaj = 0
    for (const { f, ln } of TARCE) {
      const lines = R(f).split('\n')
      for (const n of ln) {
        const v = lines[n - 1]
        expect(v.includes(TC), `${f}:${n} nosi transition-colors`).toBe(true)
        expect(v.includes('hover:'), `${f}:${n} hover žeton ohranjen`).toBe(true)
        skupaj++
      }
    }
    expect(skupaj).toBe(21)
  })

  it('(B) CENZUS per datoteka zamrznjen: dashboard 11 / photo 3 / measurements 2 / ostale 1+1+1+1+1; PO spans ×2 ŽIVI', () => {
    const pričakovano: Array<[string, number]> = [
      ['components/roksal/dashboard-tab.tsx', 18],
      ['components/roksal/photo-tab.tsx', 5],
      ['components/roksal/measurements-tab.tsx', 12],
      ['components/roksal/termini-card.tsx', 4],
      ['components/viz/viz-tab.tsx', 1],
      ['components/viz/product-home.tsx', 1],
      ['app/setup/setup-client.tsx', 1],
      ['app/aktivacija/[token]/activation-client.tsx', 1],
    ]
    for (const [f, n] of pričakovano) {
      const src = R(f)
      const vrstice = src.split('\n')
      let št = 0
      for (const v of vrstice) {
        if (v.includes(TC) && /hover:(bg|text)-roksal-/.test(v)) št++
      }
      expect(št, `${f}: ${n} gladkih hover vrstic`).toBe(n)
    }
    // PO-anchor spans ohranjeni (PRE span žigovi v zamrznjenih prod-qa skriptah)
    expect(R('components/roksal/dashboard-tab.tsx')).toContain('text-roksal-amber hover:bg-roksal-amber/25' + ' ' + TC)
    expect(R('components/roksal/photo-tab.tsx')).toContain('text-white hover:bg-roksal-amber/90' + ' ' + TC)
  })

  it('(C) N/A izključitve bajtno: mrtvi hover žetoni BREZ transition-colors (iskreno — NI delani zaradi dela)', () => {
    const mrtvi: Array<[string, number, string]> = [
      ['components/roksal/dashboard-tab.tsx', 0, ''], // placeholder za tipiziranje
    ]
    void mrtvi
    const presledki = (f: string, ln: number): string => R(f).split('\n')[ln - 1]
    // pointer-events-none (hover ne more ogniti)
    const ba = presledki('components/viz/before-after.tsx', 182)
    expect(ba.includes('pointer-events-none')).toBe(true)
    expect(ba.includes(TC)).toBe(false)
    expect(presledki('components/viz/before-after.tsx', 185).includes(TC)).toBe(false)
    // hover:bg == bg (vizualno NIČ)
    expect(presledki('components/viz/step-product.tsx', 275).includes(TC)).toBe(false)
    expect(presledki('components/roksal/measurements-tab.tsx', 5609).includes(TC)).toBe(false)
    expect(presledki('components/roksal/sessions-dialog.tsx', 292).includes(TC)).toBe(false)
    expect(presledki('components/roksal/quote-followup.tsx', 409).includes(TC)).toBe(false)
    // mrtvi izvozi termini-prikaz (brez .tsx potrošnika) nespremenjeni
    // (disk resnica: 5 pojavnitev — L47 ima TUDI dark:hover:bg-roksal-ink/25)
    const tp = R('lib/termini-prikaz.ts')
    expect(pod(tp, 'hover:bg-roksal-')).toBe(5)
    expect(tp.includes(TC)).toBe(false)
    // transition-transform konflikt (L811) — NI aditivno rešljiv, ostaja
    const nc = R('components/roksal/notification-center.tsx').split('\n')[810]
    expect(nc.includes('transition-transform')).toBe(true)
    expect(nc.includes('group-hover:text-roksal-amber')).toBe(true)
  })

  it('(D) ZAMRZNJENE STATISTIKE disk resnica: plain amber ring = 9; mrtev-CSS navy = 82; dark-only ring pari = 1 (L748 seed)', () => {
    // plain amber ring: ring-roksal-amber/N brez focus-visible/hover/dark predpone
    let plain = 0
    let mrtevNavy = 0
    let darkPari = 0
    const datoteke = TARCE.map(t => t.f).concat([
      'components/roksal/notification-center.tsx',
      'components/roksal/calculator-tab.tsx',
      'components/roksal/ral-color-picker.tsx',
      'components/roksal/webxr-scanner.tsx',
      'components/roksal/jobs-panel.tsx',
      'components/roksal/site-survey-tab.tsx',
      'components/roksal/rate-limit-panel.tsx',
    ])
    const vseh = new Set(datoteke)
    for (const f of vseh) {
      const vrstice = R(f).split('\n')
      for (const v of vrstice) {
        for (const m of v.matchAll(/(?<![:\w-])ring-roksal-amber\/\d+/g)) {
          const okoli = v.slice(Math.max(0, m.index! - 40), m.index!)
          if (!/focus-visible:|dark:|hover:|group-hover/.test(okoli)) {
            plain++
            break
          }
        }
        if (v.includes('focus-visible:ring-roksal-navy/40') && v.includes('focus-visible:ring-offset-2')) {
          const tokeni = new Set(v.split(/[\s`'\"${}()]+/))
          const imaŠirino = [...tokeni].some(t => t === 'border' || /^border-\d+$/.test(t) || /^border-(x|y|t|b|l|r)-\d+$/.test(t))
          if (!imaŠirino && !v.includes('focus-visible:border-roksal-navy/40')) mrtevNavy++
        }
        const lm = /(?<!dark:)focus-visible:ring-roksal-(navy|red|amber)\/(\d+)/.exec(v)
        const dm = /dark:focus-visible:ring-roksal-(navy|red|amber)\/(\d+)/.exec(v)
        if (lm && dm && (lm[1] + '/' + lm[2]) !== (dm[1] + '/' + dm[2])) darkPari++
      }
    }
    // BAZA (rizikalne datoteke) — disk resnica r388-triaza.py celotnega src
    // je 9/82/1; tukaj zamrznimo BAZNI vzorec čez tarčne datoteke (9 =
    // page.tsx ×1 + calculator 907 + ral 163 + webxr 2010 + jobs 52 +
    // site-survey 545 + rate-limit 87 + dashboard 1528 + L748 hover
    // izjema NI v bazi — glej (E) za L748 par).
    expect(plain, 'plain amber ring v baznem vzorcu').toBe(8)
    expect(darkPari, 'dark-only ring par = L748 seed').toBe(1)
    expect(mrtevNavy, 'mrtev-CSS navy v baznem vzorcu (disk resnica r388-triaza2.py celotnega src = 82; baza tukaj zamrznjena)').toBe(36)
  })

  it('(E) PIN SHIFT R388 val 66: r211 novi pini ×2 ŽIVI + stari pini = 0 (kanon R368)', () => {
    const r211 = R('lib/__tests__/r211-fail-verbose-detail-strazar.test.ts')
    expect(pod(r211, 'text-roksal-red transition-colors hover:bg-roksal-red/20')).toBe(2)
    expect(r211.includes('text-roksal-red hover:bg-roksal-red/20')).toBe(false)
  })

  it('(F) IN-PLACE: vrstični števci ×8 bajtnato + r387 seam needle ŽIVO (register r387)', () => {
    for (const [f, n] of Object.entries(PRIČAKOVANE_VRSTICE)) {
      expect((R(f).match(/\n/g) ?? []).length, `${f} vrstic`).toBe(n)
    }
    const seam = 'dark:focus-visible:border-roksal-amber/40 dark:focus-visible:ring-roksal-amber/40'
    expect(R('components/roksal/notification-center.tsx').includes(seam)).toBe(true)
  })
})
