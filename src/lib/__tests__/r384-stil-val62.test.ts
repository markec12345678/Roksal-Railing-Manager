// r384-stil-val62.test.ts — R384 MANDATORY STIL val 62: RED/40
// BORDER-PARITETA (rdeča simetrija po navy zaključku val 61; 16 × INS,
// in-place, 0 novih vrstic; kanon R384 handover kandidat 1).
//
// Disk resnica rundi (r384-triaza.py + val62 kontrakt):
//  - TRIAŽA: 16 tarč z VIDLJIVIM borderjem [border-roksal-red/N barvni
//    override na <Button variant="outline"> ALI eksplicitni border na
//    nativnem gumbu/kartici], vseh 16 z O2 (val 52/59 pairing že ŽIV);
//    9 N/A iskreno izključenih (brez borderja, brez sorojenca z FB);
//  - LEKCIJA R383 (2) UPOŠTEVANA V APPLY: PAR (light + dark) SKUPAJ v
//    ENEM vstavljanju — ' focus-visible:border-roksal-red/40
//    dark:focus-visible:border-roksal-red/50' TIK ZA O2 (val 57 kanon
//    R375); dark par po precedensu team-tab L619
//    'border-roksal-red/40 dark:border-roksal-red/50' — rdeča ostane
//    rdeča v temni temi (ink je navy nevtralni sorojenec, NE rdeči);
//  - PAR-SOROJENCI (R384 kandidat 3, LEKCIJA R382 (2)): r384-triaza.py
//    detekcija — 14 BREZ-SOROJENCA + 2 red-red dvojčka (dashboard
//    L1914↔L2059, oba parirana) + top-bar navy/red meni (obe strani
//    brez FB = uniformost); živi čuvaj: r384-sorojenci-par.test.ts;
//  - in-place (0 novih vrstic), 0 novih hex, 0 novih aria/title.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const R = (f: string): string => readFileSync(join(process.cwd(), 'src/components', f), 'utf-8')
const pod = (s: string, t: string): number => s.split(t).length - 1
const wcLinije = (src: string): number => (src.match(/\n/g) ?? []).length

const RING2 = 'focus-visible:ring-2'
const RED = 'focus-visible:ring-roksal-red/40'
const O2 = 'focus-visible:ring-offset-2'
const FBR = 'focus-visible:border-roksal-red/40'
const DKR = 'dark:focus-visible:border-roksal-red/50'
const PAR = FBR + ' ' + DKR

describe('R384 stil val 62 — RED/40 border-pariteta (16 × INS + dark PAR v enem koraku)', () => {
  it('(A) PARITETA: vzorčne tarče nosijo FB red + dark FB red TIK ZA O2 (val 57 kanon; LEKCIJA R383 (2) — PAR v enem koraku)', () => {
    const VZORCI = [
      { f: 'roksal/dashboard-tab.tsx', ln: [1914, 1987, 2059, 2185, 2491, 2635] },
      { f: 'roksal/sessions-dialog.tsx', ln: [316, 348] },
      { f: 'roksal/invoice-manager.tsx', ln: [1351, 1363] },
      { f: 'roksal/termini-card.tsx', ln: [474] },
      { f: 'roksal/roksal-catalog.tsx', ln: [201] },
      { f: 'roksal/inventory-tab.tsx', ln: [1740] },
    ]
    for (const { f, ln } of VZORCI) {
      const lines = R(f).split('\n')
      for (const n of ln) {
        const v = lines[n - 1]
        expect(v.includes(O2 + ' ' + PAR), `${f}:${n} FB+dark TIK ZA O2`).toBe(true)
      }
    }
  })

  it('(B) DARK PAR: vseh 16 parov bajtno enakovrednih — 16 × (FB red light) in 16 × (dark FB red /50) čez roksal; /50 je rdeča dark stopnja po precedensu team L619', () => {
    const koren = join(process.cwd(), 'src/components/roksal')
    let light = 0
    let dark = 0
    for (const z of readdirSync(koren)) {
      if (!z.endsWith('.tsx')) continue
      const src = readFileSync(join(koren, z), 'utf-8')
      light += (src.match(/(?<!dark:)focus-visible:border-roksal-red\/40/g) ?? []).length
      dark += pod(src, DKR)
    }
    expect(light, 'FB red light').toBe(16)
    expect(dark, 'FB red dark /50').toBe(16)
    expect(dark, 'PAR — vsaka light ima dark').toBe(light)
  })

  it('(C) N/A ISKRENO: 9 brez-border vrstic ostaja brez FB (triaža disk resnica — ničesar obarvati, brez sorojenca z FB)', () => {
    const NA = [
      { f: 'roksal/top-bar.tsx', ln: [261, 268] },
      { f: 'roksal/photo-tab.tsx', ln: [717] },
      { f: 'roksal/material-intelligence-tab.tsx', ln: [1408] },
      { f: 'roksal/notification-center.tsx', ln: [703] },
      { f: 'roksal/measurements-tab.tsx', ln: [3351, 4032] },
      { f: 'roksal/quote-followup.tsx', ln: [641] },
      { f: 'roksal/sistem-zdravje-card.tsx', ln: [228] },
    ]
    for (const { f, ln } of NA) {
      const lines = R(f).split('\n')
      for (const n of ln) {
        const v = lines[n - 1]
        expect(v.includes(RED), `${f}:${n} rdeča ring prisotna`).toBe(true)
        expect(v.includes(FBR), `${f}:${n} BREZ FB (iskreno N/A)`).toBe(false)
      }
    }
  })

  it('(D) OSTANEK 0: negativni lookahead (red/40 + O2 brez FB, na vrstici z border class) = 0 čez VSE roksal; in-place vrstice', () => {
    const koren = join(process.cwd(), 'src/components/roksal')
    let sk = 0
    for (const z of readdirSync(koren)) {
      if (!z.endsWith('.tsx')) continue
      const lines = readFileSync(join(koren, z), 'utf-8').split('\n')
      for (const l of lines) {
        if (!l.includes(RED) || !l.includes(O2) || l.includes(FBR)) continue
        const imaBorder = /(?<![\w-])(border(?:-[a-zA-Z0-9./[\]%-]+)?)(?![\w-])/.test(l.replace('focus-visible:border', ''))
        if (imaBorder) sk += 1
      }
    }
    expect(sk, 'bordered red+O2 vrstic brez FB').toBe(0)
    // in-place: zamrznjeni vrstični števci (0 novih vrstic — val 60 kanon)
    expect(wcLinije(R('roksal/dashboard-tab.tsx')), 'dashboard in-place').toBe(3188)
    expect(wcLinije(R('roksal/measurements-tab.tsx')), 'measurements in-place').toBe(6232)
    expect(wcLinije(R('roksal/logistics-tab.tsx')), 'logistics in-place').toBe(3294)
  })

  it('(E) OBRNJENA REGRESIJA: navy val 61/57 evolved (159+159), red KANON ×25 val 59, top-bar meni 3+2 — vse nedotaknjeno', () => {
    const koren = join(process.cwd(), 'src/components/roksal')
    let fbNavyLight = 0
    let fbNavyDark = 0
    let kanon = 0
    for (const z of readdirSync(koren)) {
      if (!z.endsWith('.tsx')) continue
      const src = readFileSync(join(koren, z), 'utf-8')
      fbNavyLight += (src.match(/(?<!dark:)focus-visible:border-roksal-navy\/40/g) ?? []).length
      fbNavyDark += pod(src, 'dark:focus-visible:border-roksal-ink/40')
      kanon += pod(src, RING2 + ' ' + RED + ' ' + O2)
    }
    expect(fbNavyLight, 'FB navy light (val 57+61)').toBe(159)
    expect(fbNavyDark, 'FB navy dark ink (val 61 dark-fix)').toBe(159)
    expect(kanon, 'rdeča KANON ×25 (val 59)').toBe(25)
    const TB = R('roksal/top-bar.tsx')
    expect(pod(TB, 'gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2')).toBe(3)
    expect(pod(TB, 'gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2')).toBe(2)
  })

  it('(F) SKUPNA RESNICA: vsaka red ring-2 vrstica z border class nosi FB ali je iskreno N/A; NASLEDNICA r363/r364 ŽIVO', () => {
    const koren = join(process.cwd(), 'src/components/roksal')
    let borderedBrezFB = 0
    for (const z of readdirSync(koren)) {
      if (!z.endsWith('.tsx')) continue
      const lines = readFileSync(join(koren, z), 'utf-8').split('\n')
      for (const l of lines) {
        if (!l.includes(RING2) || !l.includes(RED) || l.includes(FBR)) continue
        const brezFV = l.replace(/focus-visible:[a-z-]+/g, '')
        if (/(?<![\w-])border(?:[-\s"'])/.test(brezFV) || /variant="outline"/.test(l)) borderedBrezFB += 1
      }
    }
    expect(borderedBrezFB, 'bordered red vrstic brez FB').toBe(0)
    // NASLEDNICA (navy) ŽIVI v src — val 62 jih NI dotaknil
    expect(pod(R('roksal/inventory-tab.tsx'), 'focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40 dark:focus-visible:border-roksal-ink/40 active:scale-[0.96]')).toBe(1)
    expect(pod(R('roksal/measurements-tab.tsx'), 'h-8 px-3 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40 dark:focus-visible:border-roksal-ink/40"')).toBe(1)
  })
})
