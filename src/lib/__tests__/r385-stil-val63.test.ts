// r385-stil-val63.test.ts — R385 MANDATORY STIL val 63: AMBER/50
// BORDER-PARITETA (amber simetrija po rdečem zaključku val 62; 15 × INS,
// in-place, 0 novih vrstic; kanon R385 handover kandidat 1).
//
// Disk resnica rundi (r385-triaza.py + val63 kontrakt):
//  - TRIAŽA: 15 tarč z VIDLJIVIM borderjem [14 border-class: vodja ×13
//    border-roksal-navy/25 + hover:border-roksal-amber, photo L740 nativni
//    'border'; 1 outline-variant: inclinometer L539 <Button
//    variant="outline"> — border iz baze ui/button.tsx], vseh 15 z O2
//    (val 52/59 pairing že ŽIV); 3 N/A iskreno izključenih (brez
//    borderja, brez sorojenca z FB: inclinometer L433, inventory L1229,
//    photo L1162); 8 IZVEN obsega (amber/40 + amber/60 pod-družini —
//    prihodnja vala po kanonu ena-intenziveta-na-val);
//  - LEKCIJA R383 (2) UPOŠTEVANA V APPLY: PAR (light + dark) SKUPAJ v
//    ENEM vstavljanju — ' focus-visible:border-roksal-amber/50
//    dark:focus-visible:border-roksal-amber/30' TIK ZA O2 (val 57 kanon
//    R375); dark polovica po ISTEM pravilu kot rdeča val 62: sledi
//    družinskemu obstoječemu light+dark border paru z ISTO light
//    intenziveto — amber: audit-trail-dialog L53 'border-roksal-amber/50
//    dark:border-roksal-amber/30' → dark /30; amber ostane amber v temni
//    temi (barva je pomen — nizka zaloga / opozorilo; ink je navy
//    nevtralni sorojenec, NE amber);
//  - PRE-SKAN (LEKCIJA R383 (3)): r383-window-scan delta 79
//    'focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2' —
//    304 okenskih regexov 0 preozkih + 164 needle pinov 0 mrtvih + 133
//    slice-oknen + 0 vrstičnih odstopanj → 0 PIN SHIFT;
//  - in-place (0 novih vrstic), 0 novih hex, 0 novih aria/title.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const R = (f: string): string => readFileSync(join(process.cwd(), 'src/components', f), 'utf-8')
const pod = (s: string, t: string): number => s.split(t).length - 1
const wcLinije = (src: string): number => (src.match(/\n/g) ?? []).length

const RING2 = 'focus-visible:ring-2'
const AMB = 'focus-visible:ring-roksal-amber/50'
const O2 = 'focus-visible:ring-offset-2'
const FBA = 'focus-visible:border-roksal-amber/50'
const DKA = 'dark:focus-visible:border-roksal-amber/30'
const PAR = FBA + ' ' + DKA

describe('R385 stil val 63 — AMBER/50 border-pariteta (15 × INS + dark PAR v enem koraku)', () => {
  it('(A) PARITETA: vzorčne tarče nosijo FB amber + dark FB amber TIK ZA O2 (val 57 kanon; LEKCIJA R383 (2) — PAR v enem koraku)', () => {
    const VZORCI = [
      { f: 'roksal/vodja-dashboard.tsx', ln: [1213, 1229, 1241, 1258, 1475, 1549, 1563, 1646, 1657, 1672, 1744, 1755, 1771] },
      { f: 'roksal/photo-tab.tsx', ln: [740] },
      { f: 'roksal/inclinometer-tab.tsx', ln: [539] },
    ]
    for (const { f, ln } of VZORCI) {
      const lines = R(f).split('\n')
      for (const n of ln) {
        const v = lines[n - 1]
        expect(v.includes(O2 + ' ' + PAR), `${f}:${n} FB+dark TIK ZA O2`).toBe(true)
      }
    }
  })

  it('(B) DARK PAR: vseh 15 parov bajtno enakovrednih — 15 × (FB amber light /50) in 15 × (dark FB amber /30) čez roksal; /30 je amber dark stopnja po precedensu audit-trail L53', () => {
    const koren = join(process.cwd(), 'src/components/roksal')
    let light = 0
    let dark = 0
    for (const z of readdirSync(koren)) {
      if (!z.endsWith('.tsx')) continue
      const src = readFileSync(join(koren, z), 'utf-8')
      light += (src.match(/(?<!dark:)focus-visible:border-roksal-amber\/50/g) ?? []).length
      dark += pod(src, DKA)
    }
    expect(light, 'FB amber light /50').toBe(15)
    expect(dark, 'FB amber dark /30').toBe(15)
    expect(dark, 'PAR — vsaka light ima dark').toBe(light)
  })

  it('(C) N/A ISKRENO: 3 brez-border vrstice ostanejo brez FB (triaža disk resnica — ničesar obarvati, brez sorojenca z FB)', () => {
    const NA = [
      { f: 'roksal/inclinometer-tab.tsx', ln: [433] },
      { f: 'roksal/inventory-tab.tsx', ln: [1229] },
      { f: 'roksal/photo-tab.tsx', ln: [1162] },
    ]
    for (const { f, ln } of NA) {
      const lines = R(f).split('\n')
      for (const n of ln) {
        const v = lines[n - 1]
        expect(v.includes(AMB), `${f}:${n} amber/50 ring prisotna`).toBe(true)
        expect(v.includes(FBA), `${f}:${n} BREZ FB (iskreno N/A)`).toBe(false)
      }
    }
  })

  it('(D) OSTANEK 0: negativni lookahead (amber/50 + O2 brez FB, na vrstici z border class) = 0 čez VSE roksal; in-place vrstice', () => {
    const koren = join(process.cwd(), 'src/components/roksal')
    let sk = 0
    for (const z of readdirSync(koren)) {
      if (!z.endsWith('.tsx')) continue
      const lines = readFileSync(join(koren, z), 'utf-8').split('\n')
      for (const l of lines) {
        if (!l.includes(AMB) || !l.includes(O2) || l.includes(FBA)) continue
        const imaBorder = /(?<![\w-])(border(?:-[a-zA-Z0-9./[\]%-]+)?)(?![\w-])/.test(l.replace('focus-visible:border', ''))
        if (imaBorder) sk += 1
      }
    }
    expect(sk, 'bordered amber/50+O2 vrstic brez FB').toBe(0)
    // in-place: zamrznjeni vrstični števci (0 novih vrstic — val 60 kanon)
    expect(wcLinije(R('roksal/vodja-dashboard.tsx')), 'vodja in-place').toBe(2199)
    expect(wcLinije(R('roksal/photo-tab.tsx')), 'photo in-place').toBe(2684)
    expect(wcLinije(R('roksal/inclinometer-tab.tsx')), 'inclinometer in-place').toBe(599)
  })

  it('(E) IZVEN OBSEGA + REGRESIJA: amber/60 pod-družina (3 vrstice) nedotaknjena; amber/40 tarče EVOLVED R386 val 64 (zdaj nosijo FB); rdeči val 62 (16/16) in navy val 61 (159/159) nedotaknjena', () => {
    const koren = join(process.cwd(), 'src/components/roksal')
    // [EVOLVED R386 val 64: 3 amber/40 bordered tarče (dashboard L1946,
    // measurements L3478, vodja L2093) so bili ob R385 izven obsega —
    // val 64 jih je pariral; izven obsega ostane SAMO amber/60 + brez-
    // border amber/40 vrstici (dashboard L1749, measurements L3329)]
    const IZVEN = [
      { f: 'roksal/dashboard-tab.tsx', ln: [1749] },
      { f: 'roksal/measurements-tab.tsx', ln: [3329] },
      { f: 'roksal/notification-center.tsx', ln: [748] },
      { f: 'roksal/photo-tab.tsx', ln: [2113, 2414] },
    ]
    for (const { f, ln } of IZVEN) {
      const lines = R(f).split('\n')
      for (const n of ln) {
        const v = lines[n - 1]
        expect(/focus-visible:ring-roksal-amber\/(40|60)/.test(v), `${f}:${n} amber/40|60 ring`).toBe(true)
        expect(v.includes('focus-visible:border-roksal-amber'), `${f}:${n} BREZ FB (izven obsega val 63+64)`).toBe(false)
      }
    }
    // EVOLVED: 3 amber/40 bordered tarče zdaj nosijo FB amber/40 + dark (val 64)
    const EVOLVED = [
      { f: 'roksal/dashboard-tab.tsx', ln: [1946] },
      { f: 'roksal/measurements-tab.tsx', ln: [3478] },
      { f: 'roksal/vodja-dashboard.tsx', ln: [2093] },
    ]
    for (const { f, ln } of EVOLVED) {
      const lines = R(f).split('\n')
      for (const n of ln) {
        const v = lines[n - 1]
        expect(v.includes('focus-visible:border-roksal-amber/40 dark:focus-visible:border-roksal-amber/40'), `${f}:${n} EVOLVED R386 val 64 FB+dark`).toBe(true)
      }
    }
    // regresija: rdeči val 62 in navy val 61 парa števca
    let redL = 0
    let redD = 0
    let navyL = 0
    let navyD = 0
    for (const z of readdirSync(koren)) {
      if (!z.endsWith('.tsx')) continue
      const src = readFileSync(join(koren, z), 'utf-8')
      redL += (src.match(/(?<!dark:)focus-visible:border-roksal-red\/40/g) ?? []).length
      redD += pod(src, 'dark:focus-visible:border-roksal-red/50')
      navyL += (src.match(/(?<!dark:)focus-visible:border-roksal-navy\/40/g) ?? []).length
      navyD += pod(src, 'dark:focus-visible:border-roksal-ink/40')
    }
    expect(redL, 'FB red light (val 62)').toBe(16)
    expect(redD, 'FB red dark (val 62)').toBe(16)
    expect(navyL, 'FB navy light (val 57+61)').toBe(159)
    expect(navyD, 'FB navy dark ink (val 61)').toBe(159)
  })

  it('(F) SKUPNA RESNICA: vsaka amber/50 ring-2 vrstica z border class nosi FB ali je iskreno N/A; NASLEDNICA navy ŽIVO', () => {
    const koren = join(process.cwd(), 'src/components/roksal')
    let borderedBrezFB = 0
    for (const z of readdirSync(koren)) {
      if (!z.endsWith('.tsx')) continue
      const lines = readFileSync(join(koren, z), 'utf-8').split('\n')
      for (const l of lines) {
        if (!l.includes(RING2) || !l.includes(AMB) || l.includes(FBA)) continue
        const brezFV = l.replace(/focus-visible:[a-z-]+/g, '')
        if (/(?<![\w-])border(?:[-\s"'])/.test(brezFV) || /variant="outline"/.test(l)) borderedBrezFB += 1
      }
    }
    expect(borderedBrezFB, 'bordered amber/50 vrstic brez FB').toBe(0)
    // NASLEDNICA (navy) ŽIVI v src — val 63 jih NI dotaknil
    expect(pod(R('roksal/inventory-tab.tsx'), 'focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40 dark:focus-visible:border-roksal-ink/40 active:scale-[0.96]')).toBe(1)
    expect(pod(R('roksal/measurements-tab.tsx'), 'h-8 px-3 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40 dark:focus-visible:border-roksal-ink/40"')).toBe(1)
  })
})
