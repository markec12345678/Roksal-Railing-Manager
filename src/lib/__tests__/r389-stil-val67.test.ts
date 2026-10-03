// r389-stil-val67.test.ts — R389 MANDATORY STIL val 67: LASTNA-PREHOD
// GLADKOST (property-list nadgradnja) — 2 × REPL in-place, 0 novih vrstic.
//
// Disk resnica rundi (r389-triaza.py element-točna + kaskadna analiza
// zgrajenega CSS 437bdcb4b4a2e58f.css):
//  - KONFLIKTNA DRUŽINA = TOČNO 2 elementa (transition-transform utility +
//    hover barvni žeton na istem elementu):
//      (1) notification-center L811 — nativni ChevronRight; group-hover:
//          text-roksal-amber je bil SNAP (transition-property: transform
//          NE pokrije color); aditivni transition-colors bi OVERIL
//          transform (.transition-colors @117441 < .transition-transform
//          @118190 — kaskada vzame KASNEJŠEGA) → edina iskrena rešitev =
//          property-list nadgradnja transition-[transform,color];
//      (2) safety-tab L254 — ui-kit Button; baza 'transition-all'
//          OVERRIDANA s strani elementa (.transition-transform @118190 >
//          .transition-all @117243) → hover:bg-roksal-navy/90 SNAP;
//          LEKCIJA R389 (3): cva baza pokritost je NIČNA, če element sam
//          nosi ožjo transition-* utility; nadgradnja
//          transition-[transform,background-color,box-shadow] — lastna
//          utility uredi transform+bg+ring (box-shadow = focus ring), kaskada
//          po buildu: arbitrary razredi se vrstijo PRED .transition-all
//          (disk resnica: [border-color,box-shadow] @115627 +
//          [color,box-shadow] @115870 < transition-all @117243) → zmagovalec
//          = baza transition-all → bg + ring + transform VSI gladki;
//  - OSTALI transition-transform (6 vrstic: weather-card L176,
//    vodja-dashboard L1842/L1851/L1858, reference-gallery L1551,
//    photo-tab L2177) NISO konfliktni (brez hover barvnega žetona na istem
//    elementu — r389-triaza census) → NIZKRITI, nič sprememb;
//  - EVOLVED V ISTI RUNDI (kanon R368): r388-stil-val66 (C) L811 pin +
//    r388-hover-gladkost-generalizacija izjeme (L811 iz ZAMRZNJENIH —
//    pokritost sedaj resnična) — žigi [EVOLVED R389 val 67];
//  - in-place (0 novih vrstic: 969 + 759), 0 novih hex, 0 novih aria/title.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const R = (f: string): string => readFileSync(join(process.cwd(), 'src', f), 'utf-8')
const pod = (s: string, t: string): number => s.split(t).length - 1

const TARCE = [
  {
    f: 'components/roksal/notification-center.tsx',
    ln: 811,
    nova: 'transition-[transform,color]',
    hover: 'group-hover:text-roksal-amber',
    transform: 'group-hover:translate-x-0.5',
  },
  {
    f: 'components/roksal/safety-tab.tsx',
    ln: 254,
    nova: 'transition-[transform,background-color,box-shadow]',
    hover: 'hover:bg-roksal-navy/90',
    transform: 'active:scale-95',
  },
]

const OSTALI_TT: Array<[string, number]> = [
  ['components/roksal/weather-card.tsx', 176],
  ['components/roksal/vodja-dashboard.tsx', 1842],
  ['components/roksal/vodja-dashboard.tsx', 1851],
  ['components/roksal/vodja-dashboard.tsx', 1858],
  ['components/roksal/reference-gallery.tsx', 1551],
  ['components/roksal/photo-tab.tsx', 2177],
]

describe('R389 stil val 67 — lastna-prehod gladkost (2 × property-list nadgradnja)', () => {
  it('(A) PARITETA: obe tarči nosita nadgrajeno listo na isti vrstici (transform + color oba gladka)', () => {
    for (const { f, ln, nova, hover, transform } of TARCE) {
      const v = R(f).split('\n')[ln - 1]
      expect(v.includes(nova), `${f}:${ln} nosi ${nova}`).toBe(true)
      expect(v.includes(hover), `${f}:${ln} hover žeton ohranjen`).toBe(true)
      expect(v.includes(transform), `${f}:${ln} transform žeton ohranjen`).toBe(true)
      expect(v.includes('transition-transform'), `${f}:${ln} STAR ožji token ×0`).toBe(false)
    }
  })

  it('(B) CENZUS: preostalih 6 transition-transform vrstic NISO konfliktni (brez roksal hover barvnega žetona) — zamrznjen seznam', () => {
    let skupaj = 0
    for (const [f, ln] of OSTALI_TT) {
      const v = R(f).split('\n')[ln - 1]
      expect(v.includes('transition-transform'), `${f}:${ln} še nosi transition-transform`).toBe(true)
      expect(/(group-)?hover:(bg|text|border)-roksal-/.test(v), `${f}:${ln} brez roksal hover barve`).toBe(false)
      skupaj++
    }
    expect(skupaj).toBe(6)
  })

  it('(C) EVOLVED žigi R388 testov: stil-val66 (C) nosi nadgrajeno trditev + feature izjeme brez L811 (žig [EVOLVED R389 val 67])', () => {
    const stil = R('lib/__tests__/r388-stil-val66.test.ts')
    expect(stil.includes('[EVOLVED R389 val 67]')).toBe(true)
    expect(stil.includes("expect(nc.includes('transition-[transform,color]')).toBe(true)")).toBe(true)
    expect(stil.includes("expect(nc.includes('transition-transform')).toBe(false)")).toBe(true)
    const fea = R('lib/__tests__/r388-hover-gladkost-generalizacija.test.ts')
    expect(fea.includes('[EVOLVED R389 val 67]')).toBe(true)
    expect(fea.includes("'components/roksal/notification-center.tsx:811',")).toBe(false)
  })

  it('(D) in-place disk resnica: 970 + 760 segmentov split(\\n) (datoteki končata z \\n — 969 + 759 realnih vrstic, 0 novih) + tarčni žetoni bajtno ×1 v celotnem src', () => {
    expect(R('components/roksal/notification-center.tsx').split('\n').length).toBe(970)
    expect(R('components/roksal/safety-tab.tsx').split('\n').length).toBe(760)
    expect(pod(R('components/roksal/notification-center.tsx'), 'transition-[transform,color]')).toBe(1)
    expect(pod(R('components/roksal/safety-tab.tsx'), 'transition-[transform,background-color,box-shadow]')).toBe(1)
  })
})
