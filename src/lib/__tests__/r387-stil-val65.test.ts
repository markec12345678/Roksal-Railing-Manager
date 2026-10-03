// r387-stil-val65.test.ts — R387 MANDATORY STIL val 65: AMBER/60
// BORDER-PARITETA (ZADNJA amber pod-družina — amber simetrija TRETJIČ
// zaključena skupaj z val 63 [/50] in val 64 [/40]; 2 × INS, in-place,
// 0 novih vrstic; kanon R386 handover kandidat 1).
//
// Disk resnica rundi (r387-triaza.py + val65 kontrakt):
//  - TRIAŽA: 2 tarči z VIDLJIVIM borderjem — obe border-class
//    [notification L748 border-border/60 + hover:border-roksal-amber/40
//    (ring par light /60 + dark /40 ŽE na vrstici), photo L2113 nativni
//    'border' s pogojnima veja border-roksal-amber / border-white/20
//    (trajno temna površina bg-roksal-navy — brez dark: variant)],
//    obe z O2; 1 N/A iskreno izključen (photo L2414 — brez borderja in
//    brez sorojenca z FB); 0 anomalij;
//  - LEKCIJA R383 (2) UPOŠTEVANA V APPLY: PAR (light + dark) SKUPAJ v
//    ENEM vstavljanju — ' focus-visible:border-roksal-amber/60
//    dark:focus-visible:border-roksal-amber/40' TIK ZA O2 (val 57 kanon
//    R375); dark /40 po DVEH skladiščih resnice: notification L748
//    lasten dark ring JE /40 (FB sledi SVOJI ring pari) + crm-tab L811
//    'dark:border-roksal-amber/40' Card (precedens val 64; /30 je par
//    /50+/30 audit-trail L53 — namenjen /50 družini val 63; /60 NIMA
//    lastnega dark border para v kodebazi → /40 UNIFORMNO za celo
//    družino); amber ostane amber v temni temi (barva je pomen, NI ink);
//  - LEKCIJA R368 KANON (PIN SHIFT V ISTI RUNDI): notification L748
//    sosednost 'ring-offset-2 dark:focus-visible:ring-roksal-amber/40'
//    je PINANA v 11 zamrznjenih needle skriptah (r245–r255) — PIN SHIFT
//    VSEH 11 V ISTI RUNDI (faza 2 r387-val65-apply.py, žig
//    [PIN SHIFT R387 val 65]) + r368-stil-val51 (C) novObv EVOLVED;
//  - LEKCIJA R386 (1) UPOŠTEVANA: lookbehind (?<!dark:) čez VSE preverbe;
//  - in-place (0 novih vrstic), 0 novih hex, 0 novih aria/title.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const R = (f: string): string => readFileSync(join(process.cwd(), 'src/components', f), 'utf-8')
const pod = (s: string, t: string): number => s.split(t).length - 1
const wcLinije = (src: string): number => (src.match(/\n/g) ?? []).length

const O2 = 'focus-visible:ring-offset-2'
const FBA60 = 'focus-visible:border-roksal-amber/60'
const DKA40 = 'dark:focus-visible:border-roksal-amber/40'
const PAR60 = FBA60 + ' ' + DKA40
const AMB60_LIGHT = /(?<!dark:)focus-visible:ring-roksal-amber\/60/

describe('R387 stil val 65 — AMBER/60 border-pariteta (2 × INS + dark PAR v enem koraku)', () => {
  it('(A) PARITETA: obe tarči nosita FB amber/60 + dark FB amber/40 TIK ZA O2 (val 57 kanon; LEKCIJA R383 (2) — PAR v enem koraku)', () => {
    const VZORCI = [
      { f: 'roksal/notification-center.tsx', ln: [748] },
      { f: 'roksal/photo-tab.tsx', ln: [2113] },
    ]
    for (const { f, ln } of VZORCI) {
      const lines = R(f).split('\n')
      for (const n of ln) {
        const v = lines[n - 1]
        expect(v.includes(O2 + ' ' + PAR60), `${f}:${n} FB+dark TIK ZA O2`).toBe(true)
      }
    }
  })

  it('(B) DARK PAR 2/2 + REGRESIJA: amber/50 15/15 + amber/40 3/3 + red 16/16 + navy 159/159 (val 63+64+62+61 nedotaknjene)', () => {
    const koren = join(process.cwd(), 'src/components/roksal')
    let amb60L = 0
    let amb50L = 0
    let amb50D = 0
    let amb40L = 0
    let redL = 0
    let redD = 0
    let navyL = 0
    let navyD = 0
    let ambDark40 = 0
    for (const z of readdirSync(koren)) {
      if (!z.endsWith('.tsx')) continue
      const src = readFileSync(join(koren, z), 'utf-8')
      amb60L += (src.match(/(?<!dark:)focus-visible:border-roksal-amber\/60/g) ?? []).length
      amb50L += (src.match(/(?<!dark:)focus-visible:border-roksal-amber\/50/g) ?? []).length
      amb50D += pod(src, 'dark:focus-visible:border-roksal-amber/30')
      amb40L += (src.match(/(?<!dark:)focus-visible:border-roksal-amber\/40/g) ?? []).length
      redL += (src.match(/(?<!dark:)focus-visible:border-roksal-red\/40/g) ?? []).length
      redD += pod(src, 'dark:focus-visible:border-roksal-red/50')
      navyL += (src.match(/(?<!dark:)focus-visible:border-roksal-navy\/40/g) ?? []).length
      navyD += pod(src, 'dark:focus-visible:border-roksal-ink/40')
      // dark amber/40 = skupni žeton: dark polovica amber/40 (val 64 ×3) IN amber/60 (val 65 ×2)
      ambDark40 += pod(src, DKA40)
    }
    expect(amb60L, 'FB amber/60 light (val 65)').toBe(2)
    expect(ambDark40, 'dark FB amber/40 skupaj (val 64 ×3 + val 65 ×2 — ISTI žeton)').toBe(5)
    expect(amb50L, 'FB amber/50 light (val 63)').toBe(15)
    expect(amb50D, 'FB amber/50 dark /30 (val 63)').toBe(15)
    expect(amb40L, 'FB amber/40 light (val 64)').toBe(3)
    expect(redL, 'FB red light (val 62)').toBe(16)
    expect(redD, 'FB red dark (val 62)').toBe(16)
    expect(navyL, 'FB navy light (val 57+61)').toBe(160) // [PIN SHIFT R402 §19: +1 invoice-manager Poslan]
    expect(navyD, 'FB navy dark ink (val 61)').toBe(160) // [PIN SHIFT R402 §19: +1 Poslan dark:ink/40 par]
  })

  it('(C) N/A iskreno izključen: photo L2414 (brez borderja, brez sorojenca z FB) bajtno nedotaknjen', () => {
    const lines = R('roksal/photo-tab.tsx').split('\n')
    const v = lines[2414 - 1]
    expect(v.includes('focus-visible:ring-roksal-amber/60'), 'L2414 amber/60 ring').toBe(true)
    expect(v.includes('focus-visible:border-roksal-amber'), 'L2414 BREZ FB (N/A — disk resnica r387-triaza)').toBe(false)
  })

  it('(D) OSTANEK 0 + IN-PLACE: 0 bordered amber/60+O2 vrstic brez FB; zamrznjeni vrstični števci (0 novih vrstic — val 60 kanon)', () => {
    const koren = join(process.cwd(), 'src/components/roksal')
    let sk = 0
    for (const z of readdirSync(koren)) {
      if (!z.endsWith('.tsx')) continue
      const lines = readFileSync(join(koren, z), 'utf-8').split('\n')
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i]
        if (!AMB60_LIGHT.test(l) || !l.includes(O2)) continue
        const imaBorder = /(?<![\w-])(border(?:-[a-zA-Z0-9./[\]%-]+)?)(?![\w-])/.test(l.replace('focus-visible:border', ''))
        if (imaBorder && !l.includes(FBA60)) sk += 1
      }
    }
    expect(sk, 'bordered amber/60+O2 vrstic brez FB').toBe(0)
    // in-place: zamrznjeni vrstični števci (0 novih vrstic — val 60 kanon)
    expect(wcLinije(R('roksal/photo-tab.tsx')), 'photo in-place').toBe(2684)
    expect(wcLinije(R('roksal/notification-center.tsx')), 'notification in-place').toBe(969)
  })

  it('(E) REGRESIJA PIN SHIFT: 11 zamrznjenih needle skript (r245–r255) nosi NOV L748 pin z žigom [PIN SHIFT R387 val 65]; 0 starih', () => {
    const novPin = 'focus-visible:ring-roksal-amber/60 focus-visible:ring-offset-2 focus-visible:border-roksal-amber/60 dark:focus-visible:border-roksal-amber/40 dark:focus-visible:ring-roksal-amber/40 active:scale-[0.98]" "R245 notification kartica [PIN SHIFT R368 val 51: offset-2; PIN SHIFT R387 val 65: FB amber/60+dark/40]"'
    const starPin = 'focus-visible:ring-roksal-amber/60 focus-visible:ring-offset-2 dark:focus-visible:ring-roksal-amber/40 active:scale-[0.98]" "R245 notification kartica [PIN SHIFT R368 val 51: offset-2 — izjema zaključena]"'
    const skripte = [
      'r245-build-needles.sh', 'r246-build-needles.sh', 'r247-build-needles.sh',
      'r248-build-needles.sh', 'r249-build-needles.sh', 'r250-build-needles.sh',
      'r251-build-needles.sh', 'r252-build-needles.sh', 'r253-build-needles.sh',
      'r254-build-needles.sh', 'r255-build-needles.sh',
    ]
    for (const s of skripte) {
      const src = readFileSync(join(process.cwd(), 'scripts', s), 'utf-8')
      expect(src.includes(novPin), `${s}: nov R387 pin manjka`).toBe(true)
      expect(src.includes(starPin), `${s}: star R368 pin še živ`).toBe(false)
    }
  })

  it('(F) GLOBALNO: amber/60 ring vrstic = 3 (2 tarči + 1 N/A — r368 popis nespremenjen); NASLEDNICA navy ŽIVO; bordered-brez-FB čez vse tri amber intenzitete = 0', () => {
    const koren = join(process.cwd(), 'src/components/roksal')
    let amb60 = 0
    let borderedBrezFB = 0
    for (const z of readdirSync(koren)) {
      if (!z.endsWith('.tsx')) continue
      const lines = readFileSync(join(koren, z), 'utf-8').split('\n')
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i]
        if (AMB60_LIGHT.test(l)) amb60 += 1
        if (!l.includes(O2) || !AMB60_LIGHT.test(l)) continue
        const imaBorder = /(?<![\w-])(border(?:-[a-zA-Z0-9./[\]%-]+)?)(?![\w-])/.test(l.replace('focus-visible:border', ''))
        if (imaBorder && !l.includes(FBA60)) borderedBrezFB += 1
      }
    }
    expect(amb60, 'amber/60 ring vrstic (r368 popis)').toBe(3)
    expect(borderedBrezFB, 'bordered amber/60 brez FB').toBe(0)
    // NASLEDNICA navy (R385) še ŽIVO
    const vodja = R('roksal/vodja-dashboard.tsx')
    expect(vodja.includes('focus-visible:border-roksal-amber/50 dark:focus-visible:border-roksal-amber/30'), 'NASLEDNICA navy FB ŽIVO').toBe(true)
  })
})
