// r386-stil-val64.test.ts — R386 MANDATORY STIL val 64: AMBER/40
// BORDER-PARITETA (amber/40 pod-družina — zaključek amber simetrije
// skupaj z val 63; 3 × INS, in-place, 0 novih vrstic; kanon R386 handover
// kandidat 1).
//
// Disk resnica rundi (r386-triaza.py + val64 kontrakt):
//  - TRIAŽA: 3 tarče z VIDLJIVIM borderjem — vse border-class [dashboard
//    L1946 border-roksal-amber/40 kartica, measurements L3478
//    border-roksal-amber/30, vodja L2093 border-roksal-amber/40 kartica
//    — rdeči dvojček L2122 ima FB že od val 62], vseh 3 z O2; 2 N/A
//    iskreno izključena (dashboard L1749, measurements L3329 — brez
//    borderja, brez sorojenca z FB); 21 IZVEN obsega (amber/50 zaključen
//    val 63 + amber/60 prihodnji val); 0 anomalij;
//  - LEKCIJA R383 (2) UPOŠTEVANA V APPLY: PAR (light + dark) SKUPAJ v
//    ENEM vstavljanju — ' focus-visible:border-roksal-amber/40
//    dark:focus-visible:border-roksal-amber/40' TIK ZA O2 (val 57 kanon
//    R375); dark /40 po družinskem precedensu z ISTO intenziveto —
//    crm-tab L811 'dark:border-roksal-amber/40' Card (edini obstoječi
//    dark amber/40 border v kodebazi); amber ostane amber v temni temi
//    (barva je pomen — nizka zaloga / opozorilo; NI ink);
//  - LEKCIJA R385 (1) UPOŠTEVANA: r368-stil-val51 (B) N3 pin PIN SHIFTAN
//    V ISTI RUNDI [stari adjacency 2→1 — L3329 ohrani; EVOLVED adjacency
//    ×1 — L3478 z FB+dark]; register r368 N3 needle ŽIVO (grep binarno —
//    L3329);
//  - in-place (0 novih vrstic), 0 novih hex, 0 novih aria/title.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const R = (f: string): string => readFileSync(join(process.cwd(), 'src/components', f), 'utf-8')
const pod = (s: string, t: string): number => s.split(t).length - 1
const wcLinije = (src: string): number => (src.match(/\n/g) ?? []).length

const RING2 = 'focus-visible:ring-2'
const AMB40 = 'focus-visible:ring-roksal-amber/40'
const O2 = 'focus-visible:ring-offset-2'
const FBA40 = 'focus-visible:border-roksal-amber/40'
const DKA40 = 'dark:focus-visible:border-roksal-amber/40'
const PAR40 = FBA40 + ' ' + DKA40
// LIGHT ring /40 = negative lookbehind — dark: polovica (notification L748
// 'dark:focus-visible:ring-roksal-amber/40', light ring je /60) NI član
// /40 družine (LEKCIJA R384 (2) vzorec: dark: token VSEBUJE light podniz)
const AMB40_LIGHT = /(?<!dark:)focus-visible:ring-roksal-amber\/40/

describe('R386 stil val 64 — AMBER/40 border-pariteta (3 × INS + dark PAR v enem koraku)', () => {
  it('(A) PARITETA: vse 3 tarče nosijo FB amber/40 + dark FB amber/40 TIK ZA O2 (val 57 kanon; LEKCIJA R383 (2) — PAR v enem koraku)', () => {
    const VZORCI = [
      { f: 'roksal/dashboard-tab.tsx', ln: [1946] },
      { f: 'roksal/measurements-tab.tsx', ln: [3478] },
      { f: 'roksal/vodja-dashboard.tsx', ln: [2093] },
    ]
    for (const { f, ln } of VZORCI) {
      const lines = R(f).split('\n')
      for (const n of ln) {
        const v = lines[n - 1]
        expect(v.includes(O2 + ' ' + PAR40), `${f}:${n} FB+dark TIK ZA O2`).toBe(true)
      }
    }
  })

  it('(B) DARK PAR: vseh 3 parov bajtno enakovrednih — 3 × (FB amber/40 light) in 3 × (dark FB amber/40) čez roksal; dark /40 po precedensu crm-tab L811; val 63 amber/50 nedotaknjena 15/15', () => {
    const koren = join(process.cwd(), 'src/components/roksal')
    let light40 = 0
    let dark40 = 0
    let light50 = 0
    let dark50 = 0
    for (const z of readdirSync(koren)) {
      if (!z.endsWith('.tsx')) continue
      const src = readFileSync(join(koren, z), 'utf-8')
      light40 += (src.match(/(?<!dark:)focus-visible:border-roksal-amber\/40/g) ?? []).length
      dark40 += pod(src, DKA40)
      light50 += (src.match(/(?<!dark:)focus-visible:border-roksal-amber\/50/g) ?? []).length
      dark50 += pod(src, 'dark:focus-visible:border-roksal-amber/30')
    }
    expect(light40, 'FB amber/40 light').toBe(3)
    expect(dark40, 'FB amber/40 dark').toBe(3)
    expect(dark40, 'PAR /40 — vsaka light ima dark').toBe(light40)
    expect(light50, 'FB amber/50 light (val 63)').toBe(15)
    expect(dark50, 'FB amber/50 dark (val 63)').toBe(15)
  })

  it('(C) N/A ISKRENO: 2 brez-border vrstici ostaneta brez FB (triaža disk resnica — ničesar obarvati, brez sorojenca z FB)', () => {
    const NA = [
      { f: 'roksal/dashboard-tab.tsx', ln: [1749] },
      { f: 'roksal/measurements-tab.tsx', ln: [3329] },
    ]
    for (const { f, ln } of NA) {
      const lines = R(f).split('\n')
      for (const n of ln) {
        const v = lines[n - 1]
        expect(v.includes(AMB40), `${f}:${n} amber/40 ring prisotna`).toBe(true)
        expect(v.includes(FBA40), `${f}:${n} BREZ FB (iskreno N/A)`).toBe(false)
      }
    }
  })

  it('(D) OSTANEK 0: negativni lookahead (amber/40 + O2 brez FB, na vrstici z border class) = 0 čez VSE roksal; in-place vrstice', () => {
    const koren = join(process.cwd(), 'src/components/roksal')
    let sk = 0
    for (const z of readdirSync(koren)) {
      if (!z.endsWith('.tsx')) continue
      const lines = readFileSync(join(koren, z), 'utf-8').split('\n')
      for (const l of lines) {
        if (!AMB40_LIGHT.test(l) || !l.includes(O2) || l.includes(FBA40)) continue
        const imaBorder = /(?<![\w-])(border(?:-[a-zA-Z0-9./[\]%-]+)?)(?![\w-])/.test(l.replace('focus-visible:border', ''))
        if (imaBorder) sk += 1
      }
    }
    expect(sk, 'bordered amber/40+O2 vrstic brez FB').toBe(0)
    // in-place: zamrznjeni vrstični števci (0 novih vrstic — val 60 kanon)
    expect(wcLinije(R('roksal/dashboard-tab.tsx')), 'dashboard in-place').toBe(3188)
    expect(wcLinije(R('roksal/measurements-tab.tsx')), 'measurements in-place').toBe(6232)
    expect(wcLinije(R('roksal/vodja-dashboard.tsx')), 'vodja in-place').toBe(2199)
  })

  it('(E) IZVEN OBSEGA + REGRESIJA: amber/60 pod-družina (3 vrstice) nedotaknjena; rdeči val 62 (16/16) in navy val 61 (159/159) nedotaknjena', () => {
    const koren = join(process.cwd(), 'src/components/roksal')
    const IZVEN = [
      { f: 'roksal/notification-center.tsx', ln: [748] },
      { f: 'roksal/photo-tab.tsx', ln: [2113, 2414] },
    ]
    for (const { f, ln } of IZVEN) {
      const lines = R(f).split('\n')
      for (const n of ln) {
        const v = lines[n - 1]
        expect(v.includes('focus-visible:ring-roksal-amber/60'), `${f}:${n} amber/60 ring`).toBe(true)
        expect(v.includes('focus-visible:border-roksal-amber'), `${f}:${n} BREZ FB (izven obsega val 64)`).toBe(false)
      }
    }
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

  it('(F) SKUPNA RESNICA: vsaka amber/40 ring-2 vrstica z border class nosi FB ali je iskreno N/A; r368 N3 NASLEDNICA adjacency ŽIVO + NASLEDNICA navy ŽIVO', () => {
    const koren = join(process.cwd(), 'src/components/roksal')
    let borderedBrezFB = 0
    for (const z of readdirSync(koren)) {
      if (!z.endsWith('.tsx')) continue
      const lines = readFileSync(join(koren, z), 'utf-8').split('\n')
      for (const l of lines) {
        if (!l.includes(RING2) || !AMB40_LIGHT.test(l) || l.includes(FBA40)) continue
        const brezFV = l.replace(/focus-visible:[a-z-]+/g, '')
        if (/(?<![\w-])border(?:[-\s"'])/.test(brezFV) || /variant="outline"/.test(l)) borderedBrezFB += 1
      }
    }
    expect(borderedBrezFB, 'bordered amber/40 vrstic brez FB').toBe(0)
    // r368 N3 needle (binarni grep) ŽIVO prek L3329 — val 64 ga NI ubil
    expect(pod(R('roksal/measurements-tab.tsx'), 'focus-visible:ring-roksal-amber/40 focus-visible:ring-offset-2 focus-visible:outline-none')).toBe(1)
    // NASLEDNICA (navy) ŽIVI v src — val 64 jih NI dotaknil
    expect(pod(R('roksal/inventory-tab.tsx'), 'focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40 dark:focus-visible:border-roksal-ink/40 active:scale-[0.96]')).toBe(1)
  })
})
