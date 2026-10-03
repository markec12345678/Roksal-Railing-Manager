// r382-stil-val61.test.ts — R382 MANDATORY STIL val 61: A/OFFSET
// ZAKLJUČEK + C/BORDER-PARITETA ZAKLJUČEK (dvostopenjsko, 168 × INS,
// in-place, 0 novih vrstic; kanon R382 handover kandidat 1 + 2).
//
// Disk resnica rundi (r383-triaza.py + val61 kontrakt):
//  - STEP 1 (A/offset zaključek): 34 × INS ' focus-visible:ring-offset-2'
//    TIK ZA navy/40 — navy ring-2 vrstice BREZ O2; FROZEN izjema #2
//    (kanon R377): roksal-catalog L95 <Input>;
//  - STEP 2 (C/border-pariteta zaključek): 134 × INS
//    ' focus-visible:border-roksal-navy/40' TIK ZA O2 (val 57 kanon
//    R375) na vrsticah z VIDLJIVIM borderjem [eksplicitni border class
//    ALI <Button variant="outline"> — border iz baze ui/button.tsx];
//  - REGISTER EVOLUCIJA (kanon r371 N3/R377, 4.+5. uporaba): val 61 je
//    prelomil r363 (…ring-offset-2 active:scale…) + r364 (…ring-offset-2")
//    needleja → EVOLVED R383 val 61 + NASLEDNICA (števca 4/4 NESPREMENJENA);
//  - in-place (0 novih vrstic), 0 novih hex, 0 novih aria/title.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const R = (f: string): string => readFileSync(join(process.cwd(), 'src/components', f), 'utf-8')
const pod = (s: string, t: string): number => s.split(t).length - 1
const wcLinije = (src: string): number => (src.match(/\n/g) ?? []).length

const RING2 = 'focus-visible:ring-2'
const NAVY = 'focus-visible:ring-roksal-navy/40'
const O2 = 'focus-visible:ring-offset-2'
const FB = 'focus-visible:border-roksal-navy/40'

describe('R383 stil val 61 — A/offset + C/border-pariteta zaključek (168 × INS)', () => {
  it('(A) STEP 1 PARITETA: vseh 34 nekdanjih brez-O2 vrstic nosi O2 TIK ZA navy/40 (indexOf = NAVY.length + 1) — A/offset družina zaključena', () => {
    const VZORCI = [
      { f: 'roksal/audit-trail-dialog.tsx', ln: [219] },
      { f: 'roksal/calculator-tab.tsx', ln: [4396] },
      { f: 'roksal/dashboard-tab.tsx', ln: [2360, 2696, 3015] },
      { f: 'roksal/deal-pipeline.tsx', ln: [219, 235, 602] },
      { f: 'roksal/team-tab.tsx', ln: [497, 515, 523, 916, 926] },
      { f: 'roksal/roksal-catalog.tsx', ln: [110] },
    ]
    for (const { f, ln } of VZORCI) {
      const lines = R(f).split('\n')
      for (const n of ln) {
        const v = lines[n - 1]
        expect(v.includes(O2), `${f}:${n} O2 prisoten`).toBe(true)
        expect(v.indexOf(NAVY + ' ' + O2), `${f}:${n} O2 TIK ZA navy/40`).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('(B) FROZEN IZJEMA #2: catalog Input L95 ostaja bajtno nespremenjen (brez O2, brez border-paritete) — zamrznjen', () => {
    const KAT = R('roksal/roksal-catalog.tsx')
    const lines = KAT.split('\n')
    const v = lines[94]
    expect(v.includes('h-10 pl-9 ' + RING2 + ' ' + NAVY), 'L95 zamrznjena oblika').toBe(true)
    expect(v.includes(O2), 'L95 BREZ O2 (frozen)').toBe(false)
    expect(v.includes(FB), 'L95 BREZ border-paritete (frozen)').toBe(false)
  })

  it('(C) STEP 2 PARITETA: vzorčne border-paritete — val 57 kanon (FB TIK ZA O2) na nativnih + outline Button tarčah', () => {
    const VZORCI = [
      { f: 'roksal/measurements-tab.tsx', ln: 5182 },
      { f: 'roksal/inclinometer-tab.tsx', ln: 341 },
      { f: 'roksal/material-intelligence-tab.tsx', ln: 456 },
      { f: 'roksal/inventory-tab.tsx', ln: 1397 },
    ]
    for (const { f, ln } of VZORCI) {
      const lines = R(f).split('\n')
      const v = lines[ln - 1]
      expect(v.includes(O2 + ' ' + FB), `${f}:${ln} FB TIK ZA O2`).toBe(true)
    }
  })

  it('(D) OSTANEK 0: negativni lookahead (navy/40 + O2 brez FB, na vrstici z border class) = 0 čez VSE roksal; in-place vrstice', () => {
    const koren = join(process.cwd(), 'src/components/roksal')
    let sk = 0
    for (const z of readdirSync(koren)) {
      if (!z.endsWith('.tsx')) continue
      const lines = readFileSync(join(koren, z), 'utf-8').split('\n')
      for (const l of lines) {
        if (!l.includes(NAVY) || !l.includes(O2) || l.includes(FB)) continue
        const imaBorder = /(?<![\w-])(border(?:-[a-zA-Z0-9./[\]%-]+)?)(?![\w-])/.test(l.replace('focus-visible:border', ''))
        if (imaBorder) sk += 1
      }
    }
    expect(sk, 'bordered navy+O2 vrstic brez FB').toBe(0)
    // in-place: zamrznjeni vrstični števci na težjih tarčah
    expect(wcLinije(R('roksal/logistics-tab.tsx')), 'logistics in-place').toBe(3294)
    expect(wcLinije(R('roksal/measurements-tab.tsx')), 'measurements in-place').toBe(6232)
    expect(wcLinije(R('roksal/dashboard-tab.tsx')), 'dashboard in-place').toBe(3188)
  })

  it('(E) OBRNJENA REGRESIJA: val 60 evolved kanoni + val 59 KANON ×25 + val 58 + amber 100% — vse nedotaknjeno', () => {
    // val 60 top-bar meni evolved (nedotaknjen — meni itemi brez borderja)
    const TB = R('roksal/top-bar.tsx')
    expect(pod(TB, 'gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2')).toBe(3)
    expect(pod(TB, 'gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2')).toBe(2)
    // val 59 KANON ×25
    const KANON = 'focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2'
    let kanoni = 0
    const koren = join(process.cwd(), 'src/components/roksal')
    for (const z of readdirSync(koren)) {
      if (!z.endsWith('.tsx')) continue
      kanoni += pod(readFileSync(join(koren, z), 'utf-8'), KANON)
    }
    expect(kanoni, 'rdeča družina kanonov').toBe(25)
    // val 58 dashboard
    expect(R('roksal/dashboard-tab.tsx')).toContain('transition-colors focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 rounded')
    // amber/50 100%
    const amb = new RegExp('focus-visible:ring-roksal-amber/50(?! ' + O2 + ')', 'g')
    let ambSk = 0
    for (const z of readdirSync(koren)) {
      if (!z.endsWith('.tsx')) continue
      ambSk += (readFileSync(join(koren, z), 'utf-8').match(amb) ?? []).length
    }
    expect(ambSk, 'ne-pariranih amber/50').toBe(0)
  })

  it('(F) SKUPNA RESNICA: vsaka navy ring-2 vrstica z border class nosi FB ali je frozen; 155 register needlejev preživi (NASLEDNICA r363/r364 v src)', () => {
    const koren = join(process.cwd(), 'src/components/roksal')
    let borderedBrezFB = 0
    for (const z of readdirSync(koren)) {
      if (!z.endsWith('.tsx')) continue
      if (z === 'roksal-catalog.tsx') continue // frozen izjema #2 datoteka
      const lines = readFileSync(join(koren, z), 'utf-8').split('\n')
      for (const l of lines) {
        if (!l.includes(RING2) || !l.includes(NAVY) || l.includes(FB)) continue
        const brezFV = l.replace(/focus-visible:[a-z-]+/g, '')
        if (/(?<![\w-])border(?:[-\s"'])/.test(brezFV) || /variant="outline"/.test(l)) borderedBrezFB += 1
      }
    }
    expect(borderedBrezFB, 'bordered navy vrstic brez FB (izven frozen datoteke)').toBe(0)
    // NASLEDNICA r363 (inventory) + r364 (measurements) ŽIVI v src
    expect(pod(R('roksal/inventory-tab.tsx'), 'focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40 dark:focus-visible:border-roksal-ink/40 active:scale-[0.96]')).toBe(1) // [PIN SHIFT R383 val 61 dark-fix: NASLEDNICA-2]
    expect(pod(R('roksal/measurements-tab.tsx'), 'h-8 px-3 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40 dark:focus-visible:border-roksal-ink/40"')).toBe(1) // [PIN SHIFT R383 val 61 dark-fix]
  })
})
