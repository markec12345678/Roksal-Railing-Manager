// r371-stil-val54.test.ts — R371 MANDATORY STIL val 54: ring OBLIKOVNA
// pariteta navy/40 NONE TRIAŽA — 13 SUROVIH brand vrstic dobi
// ` focus-visible:ring-offset-2` TIK ZA navy/40 (per-barvni split kanon:
// navy = val 43–49 + val 52 pari + val 53 O1 rep + val 54 NONE triaža,
// red = val 50, amber = val 51) + val 53 POST-deploy spot resnica.
//
// Disk resnica (scripts/r371-none-triage.py — element klasifikacija z
// nazaj-hodom do 15 vrstic, LEKCIJA R364 (4) = KODA ne oči):
//   navy/40 NONE ×54 = KIT ×35 (shadcn <Button> + brand override —
//   NAMERNA izjema #1 iz val 52, offset po dizajnu 0) + RAW ×13 (val 54
//   tarče) + INPUT ×2 (dashboard L1623 + roksal-catalog L95 — iskalni
//   vnosi, NE gumbi — lastni fokus jezik, iskreno izven) + CMP ×5
//   (DropdownMenu/Command/Card — lastni fokus jezik, izven) +
//   deal-pipeline L219 (drag handle cn() — NE gumb, izven).
//   Census PRED {'O2': 192, 'NONE': 54, '?INTERP': 3} gap 57 → PO
//   {'O2': 205, 'NONE': 43, '?INTERP': 1} gap 44 — vsi 44 = DOKUMENTIRANI
//   namerni (35 KIT + 2 INPUT + 5 CMP + 1 drag) → **navy/40 BRAND GUMB
//   pariteta ZAKLJUČENA** (razcep na brand gumboh = 0; milestone
//   val 43–54). 2 tarče (inclinometer L341, punch-list L531) so bile v
//   census klasifi ?INTERP (template literal) — po vstavitvi O2.
//
// Substitucija DODAJA 27 znakov (insert, ne zamenjava) — stale-pin
// PRED-SKAN ČIST: r370-window-scan.py delta +27 = 0 preozkih (65/65);
// r317 must_miss needle ostaja odsoten; r348 steber toContain preživi
// (vstavljanje ZA žetonom); r346 char-okno z anchorji preživi; r271/
// r272/r268 handler pini nedotaknjeni → **0 PIN SHIFTOV v tej rundi**
// (prva runda brez shiftov od R367).
//
// In-place = 0 novih vrstic (wcLinije — LEKCIJA R367 (1)); 0 novih hex
// (10/0/16/0/12/0/0/0/8/0 = HEAD); aria/title ZAMRZNJENI.
//
// val 53 POST-deploy spot (r371-qa-spot.sh spot-r167/16 +
// r371-vodja-identify.sh): vodja pilli 3/3 offset-2 ŽIVO, invoice
// racuniCsv+prihodkiPdf 1/1, calculator zgodovina 1/1, meseciCsv vrata
// meseciPovzetek.ok (iskrena praznina — kanon r277), dashboard 'Izvozi
// CSV' kit override ŽIVO (offset 0 po izjemi #1), 4. navy/40 BrezOffset
// 'Izvozi *' = sistem-zdravje-card L204 kit override (disk dokaz);
// kolektor 0 errorjev.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const R = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')
const pod = (src: string, needle: string): number =>
  (src.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length
const wcLinije = (src: string): number => (src.match(/\n/g) ?? []).length

const NAVY = 'focus-visible:ring-roksal-navy/40'
const O2 = NAVY + ' focus-visible:ring-offset-2'

// [datoteka, wcLinije baza, hex, aria, title, tarče [vrstice]]
const DATOTEKE = [
  { f: 'roksal/audit-trail-dialog.tsx', vrstice: 344, hex: 0, aria: 4, title: 1, tarce: [249, 310] },
  { f: 'roksal/calculator-tab.tsx', vrstice: 4489, hex: 16, aria: 16, title: 19, tarce: [860, 4439] },
  { f: 'roksal/dashboard-tab.tsx', vrstice: 3188, hex: 0, aria: 13, title: 22, tarce: [1628, 1756] },
  { f: 'roksal/inclinometer-tab.tsx', vrstice: 599, hex: 0, aria: 7, title: 2, tarce: [341] },
  { f: 'roksal/photo-tab.tsx', vrstice: 2684, hex: 12, aria: 17, title: 6, tarce: [2370] },
  { f: 'roksal/punch-list.tsx', vrstice: 748, hex: 0, aria: 7, title: 3, tarce: [531] },
  { f: 'roksal/rate-limit-panel.tsx', vrstice: 315, hex: 0, aria: 4, title: 4, tarce: [226] },
  { f: 'roksal/measurements/inline-inclinometer.tsx', vrstice: 268, hex: 0, aria: 1, title: 0, tarce: [131] },
  { f: 'roksal/measurements/inline-kotomer.tsx', vrstice: 420, hex: 8, aria: 2, title: 1, tarce: [185] },
  { f: 'roksal/measurements/steber-table.tsx', vrstice: 169, hex: 0, aria: 1, title: 1, tarce: [69] },
] as const

describe('R371 stil val 54 — navy/40 NONE triaža (13 surovih brand vrstic)', () => {
  it('(A) PARITETA guard: vseh 13 tarč nosi offset-2 TIK ZA navy/40 (razcep = 0 na tarčah) + in-place vrstice + hex/aria/title ZAMRZNJENI per datoteka', () => {
    for (const { f, vrstice, hex, aria, title, tarce } of DATOTEKE) {
      const src = R(`src/components/${f}`)
      const lines = src.split('\n')
      for (const ln of tarce) {
        const v = lines[ln - 1]
        expect(v.includes(NAVY), `${f}:${ln} navy/40`).toBe(true)
        expect(v.includes(O2), `${f}:${ln} offset-2 TIK ZA navy/40`).toBe(true)
        expect(v.includes('ring-offset-1'), `${f}:${ln} brez offset-1`).toBe(false)
      }
      expect(wcLinije(src), `${f} in-place vrstice`).toBe(vrstice)
      expect((src.match(/#[0-9a-fA-F]{6}\b/g) ?? []).length, `${f} hex`).toBe(hex)
      expect(pod(src, 'aria-label='), `${f} aria`).toBe(aria)
      expect(pod(src, 'title='), `${f} title`).toBe(title)
    }
  })

  it('(B) era-diskriminatorji val 54: N1 ×1 / N2 ×1 / N3 ×1 / N4 ×1 (per-datoteka grep -rlF) + dokumentirani ne-tarčni ostanki (KIT ×35 / INPUT ×2 / CMP ×5 / drag ×1 — vsi NE-tarče brez offseta)', () => {
    const N1 = 'rounded-full border px-2 py-0.5 text-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'
    const N2 = 'p-1 rounded-md hover:bg-secondary/60 transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'
    const N3 = 'top-1/2 -translate-y-1/2 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'
    const N4 = 'focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40'
    expect(pod(R('src/components/roksal/audit-trail-dialog.tsx'), N1)).toBe(1)
    expect(pod(R('src/components/roksal/calculator-tab.tsx'), N2)).toBe(1)
    expect(pod(R('src/components/roksal/dashboard-tab.tsx'), N3)).toBe(1)
    expect(pod(R('src/components/roksal/calculator-tab.tsx'), N4)).toBe(1)
    // dokumentirani ne-tarčni: sistem-zdravje-card L204 kit override (spot D2-dokaz)
    const SZC = R('src/components/roksal/sistem-zdravje-card.tsx')
    expect(SZC).toContain('press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:outline-none')
    // [PIN SHIFT R372 val 55: izvirnik 'SZC.includes("ring-offset") === false'
    // (celo-datoteka) → navy-vrstični guard z ISTO namero — val 55 je dodala
    // focus-visible:ring-offset-2 na RAW red/40 brand vrstico L228 (rdeča
    // pariteta); kit override L204 (navy) ostaja brez offseta]
    expect(
      SZC.split('\n')
        .filter((v) => v.includes('focus-visible:ring-roksal-navy/40'))
        .every((v) => !v.includes('ring-offset')),
    ).toBe(true)
    // iskalni vnosi (INPUT) brez offseta — izven obsega, dokumentirano
    expect(R('src/components/roksal/dashboard-tab.tsx')).toContain('pl-9 h-10 bg-background focus-visible:ring-roksal-navy/40')
    expect(R('src/components/roksal/roksal-catalog.tsx')).toContain('h-10 pl-9 focus-visible:ring-2 focus-visible:ring-roksal-navy/40')
  })

  it('(C) stale-pini ČIST — 0 SHIFTOV: r317 must_miss needle še odsoten + r348 steber toContain preživi + r346 char-okno anchor preživi + r316 zaklenjene amber vrstice nedotaknjene', () => {
    // r317-build-needles must_miss: POLNI needle 'h-8 px-2 transition-colors
    // hover:text-roksal-ink focus-visible:ring-roksal-navy/40' — po val 54 ŠE
    // ODSOTEN (L226 nosi ring-2 med hover:text in navy/40; L262 je h-7 KIT vrstica — drug prefix)
    const RL = R('src/components/roksal/rate-limit-panel.tsx')
    expect(RL.includes('h-8 px-2 transition-colors hover:text-roksal-ink focus-visible:ring-roksal-navy/40')).toBe(false)
    // r348-meritve-faza5 steber toContain navy/40 — vstavljanje ZA žetonom preživi
    expect(R('src/components/roksal/measurements/steber-table.tsx')).toContain('focus-visible:ring-roksal-navy/40')
    expect(R('src/components/roksal/measurements/steber-table.tsx')).toContain('aria-label="Izvozi preglednico stebrov kot CSV"')
    // r346 char-okno: aria anchor 'Izvozi zgodovino izračunov' + navy/40 v oknu — preživi
    // (r346 kanon: LINE-okno i-8..i+6 okoli anchor vrstice)
    const calc = R('src/components/roksal/calculator-tab.tsx')
    const vrstice = calc.split('\n')
    const idx = vrstice.findIndex((v) => v.includes('aria-label="Izvozi zgodovino izračunov kot CSV datoteka"'))
    expect(idx).toBeGreaterThan(-1)
    const okno = vrstice.slice(Math.max(0, idx - 8), idx + 6).join('\n')
    expect(okno).toContain('focus-visible:ring-2')
    // r316 zaklenjene vrstice — val 54 ne tilka amber; inclinometer amber/50 ×2 (val 51) nespremenjeno
    const incl = R('src/components/roksal/inclinometer-tab.tsx')
    expect(pod(incl, 'ring-roksal-amber/50')).toBe(2) // val 51 žig ostane (433/539 z offset-2)
    // handler pini r271/r272/r268 nedotaknjeni
    expect(R('src/components/roksal/punch-list.tsx')).toContain('handleStanjePdf')
    expect(R('src/components/roksal/inclinometer-tab.tsx')).toContain('handleNagibiPdf')
  })

  it('(D) census klasa dokaz: 2 tarči (inclinometer L341, punch-list L531) = template ?INTERP → O2; ostalih 11 = NONE → O2; navy/40 žeton skupaj 249 nespremenjen (barvni žigi)', () => {
    // barvni žigi nespremenjeni: skupno število navy/40 žetonov čez tarčne datoteke (disk resnica)
    let navy = 0
    for (const { f } of DATOTEKE) navy += pod(R(`src/components/${f}`), NAVY)
    expect(navy).toBe(32) // 3+4+9+4+2+3+3+1+2+1 — vsota po rundi (vstavljanje ne doda/odstrani žetonov)
    // punch-list template literal — offset pred interpolacijo (LEKCIJA R361: statični segment = veljaven)
    const punch = R('src/components/roksal/punch-list.tsx')
    expect(punch).toContain('navy/40 focus-visible:ring-offset-2 ${')
    // inclinometer template — isti vzorec
    const incl = R('src/components/roksal/inclinometer-tab.tsx')
    expect(incl.split('\n')[340]).toContain(NAVY)
    expect(incl.split('\n')[340]).toContain('ring-offset-2')
  })

  it('(E) orodja ŽIVO + iskren IZPUSTI: none-triage orodje + val54-apply fail-closed žigi + window-scan delta +27 kanon + dedup 11. val IZPUST dokaz V TESTU (13/13/0) + era klon 24. register', () => {
    const TRI = R('scripts/r371-none-triage.py')
    expect(TRI).toContain('r371-none-triage.py')
    expect(TRI).toContain('KLASIFIKACIJA')
    const APP = R('scripts/r371-val54-apply.py')
    expect(APP).toContain('FAILOVEDANO')
    expect(APP).toContain('13')
    const SCAN = R('scripts/r370-window-scan.py')
    expect(SCAN).toContain('delta')
    // dedup 11. val IZPUST — dokaz V TESTU (isti kanon kot r370 (E)): 13/13/0
    const BLOKI = /agent-browser eval "JSON\.stringify\(\{([\s\S]*?)\}\)"/g
    const zetoni: string[] = []
    for (const s of ['r365', 'r366', 'r367', 'r368', 'r369']) {
      const src = R(`scripts/${s}-qa-spot.sh`)
      for (const m of src.matchAll(BLOKI)) {
        zetoni.push(createHash('md5').update((m[1] as string).replace(/\s+/g, '')).digest('hex'))
      }
    }
    expect(zetoni.length).toBe(13)
    expect(new Set(zetoni).size).toBe(13) // 0 ponovitev ≥2 → IZPUST utemeljen
    // era klon kanon: r371-era-harvest.sh ŽIV z 24. registrom + pragom 101
    const ERA = R('scripts/r371-era-harvest.sh')
    expect(ERA).toContain('REG_X="scripts/qa-needles/r370.tsv"')
    expect(ERA).toContain('[ "$need_n" -lt 101 ]')
    expect(ERA).toContain('STIRIINDVJSETIJNA')
  })
})
