// r379-stil-val59.test.ts — R379 MANDATORY STIL val 59: red/40 offset-2
// PARITETA (14 × INS ' focus-visible:ring-offset-2' TIK ZA
// 'focus-visible:ring-roksal-red/40' — val 52 pairing kanon (navy/ink)
// generaliziran na rdečo družino; ciljni kanon = val 43 RED_KANON
// 'focus-visible:ring-2 focus-visible:ring-roksal-red/40
// focus-visible:ring-offset-2'; 11 že-pariranih rdečih vrstic =
// dokazana konvencija; amber/50 100% parirana že od val 52).
//
// Disk resnica rundi:
//  - 14 tarč na 8 datotekah: dashboard ×5, floor-plan ×1, inventory ×1,
//    quote-followup ×1, roksal-catalog ×1, sessions-dialog ×2,
//    termini-card ×1, top-bar ×2 (r379-census.sh družina D);
//  - r372 val 55 (B) je dokumentiral top-bar ×2 + dashboard KIT L1914 kot
//    'ne-tarčni ostanki / izjema #1' — val 59 JIH RESOLVA (r372 asercije
//    ostanejo zelene: toContain/pod podnizi se končajo na /40, INS je
//     ZA njimi);
//  - in-place (0 novih vrstic), 0 novih hex, 0 novih aria/title;
//  - red-400/60 (sketch trio, val 50) = DRUGA družina — izrecno izven.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const R = (f: string): string => readFileSync(join(process.cwd(), 'src/components', f), 'utf-8')
const pod = (s: string, t: string): number => s.split(t).length - 1
const wcLinije = (src: string): number => (src.match(/\n/g) ?? []).length

const RED = 'focus-visible:ring-roksal-red/40'
const O2 = 'focus-visible:ring-offset-2'
const KANON = 'focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2'
const NAVY_KANON = 'focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'

const DATOTEKE = [
  { f: 'roksal/dashboard-tab.tsx', vrstice: 3188, hex: 0, aria: 13, title: 22, red: 6, tarce: [1914, 2059, 2185, 2491, 2635] },
  { f: 'roksal/floor-plan-tab.tsx', vrstice: 2901, hex: 15, aria: 6, title: 0, red: 1, tarce: [1731] },
  { f: 'roksal/inventory-tab.tsx', vrstice: 2299, hex: 0, aria: 17, title: 20, red: 1, tarce: [1740] },
  { f: 'roksal/quote-followup.tsx', vrstice: 683, hex: 0, aria: 9, title: 5, red: 1, tarce: [641] },
  { f: 'roksal/roksal-catalog.tsx', vrstice: 274, hex: 14, aria: 1, title: 0, red: 1, tarce: [201] },
  { f: 'roksal/sessions-dialog.tsx', vrstice: 372, hex: 0, aria: 2, title: 1, red: 2, tarce: [316, 348] },
  { f: 'roksal/termini-card.tsx', vrstice: 539, hex: 0, aria: 5, title: 7, red: 1, tarce: [474] },
  { f: 'roksal/top-bar.tsx', vrstice: 282, hex: 0, aria: 4, title: 4, red: 2, tarce: [261, 268] },
]

describe('R379 stil val 59 — red/40 offset-2 pariteta (14 × INS, val 43 RED_KANON)', () => {
  it('(A) PARITETA: vseh 14 tarč nosi O2 TIK ZA red/40 (indexOf = RED.length + 1) + per-datoteka zamrznjeni števci (vrstice/hex/aria/title/red)', () => {
    for (const { f, vrstice, hex, aria, title, red } of DATOTEKE) {
      const src = R(f)
      const lines = src.split('\n')
      for (const ln of lines.map((_, i) => i + 1).filter((n) => lines[n - 1].includes(RED))) {
        const v = lines[ln - 1]
        expect(v.includes(O2), `${f}:${ln} offset-2`).toBe(true)
        expect(v.indexOf(O2), `${f}:${ln} O2 TIK ZA red/40`).toBe(v.indexOf(RED) + RED.length + 1)
      }
      expect(wcLinije(src), `${f} in-place vrstice`).toBe(vrstice)
      expect((src.match(/#[0-9a-fA-F]{6}\b/g) ?? []).length, `${f} hex`).toBe(hex)
      expect(pod(src, 'aria-label='), `${f} aria`).toBe(aria)
      expect(pod(src, 'title='), `${f} title`).toBe(title)
      expect(pod(src, RED), `${f} red/40 skupaj`).toBe(red)
    }
  })

  it('(B) VAL 43 KANON: kanon-string pojavitev == red/40 pojavitev per datoteka (popolna pariteta — vsak rdeč ring je kanonski)', () => {
    for (const { f, red } of DATOTEKE) {
      const src = R(f)
      expect(pod(src, KANON), `${f} kanon == red`).toBe(red)
    }
  })

  it('(C) OSTANEK 0: negativni lookahead (red/40 brez O2) = 0 čez VSE roksal komponente (idempotenca + družina zaključena)', () => {
    const ost = new RegExp(RED + '(?! ' + O2 + ')', 'g')
    let sk = 0
    const koren = join(process.cwd(), 'src/components/roksal')
    for (const z of readdirSync(koren)) {
      if (!z.endsWith('.tsx')) continue
      const src = readFileSync(join(koren, z), 'utf-8')
      sk += (src.match(ost) ?? []).length
    }
    expect(sk, 'ne-pariranih red/40 v roksal').toBe(0)
  })

  it('(D) era-diskriminatorji val 59: top-bar CMP par ×2 z O2 (prej brez) + sessions-dialog par ×2 + dashboard KIT izjema #1 RESOLVANA', () => {
    const TB = R('roksal/top-bar.tsx')
    // [PIN SHIFT R381 val 60 / EVOLVED: val 60 INS ' transition-colors' PRED
    // ring-2 na ISTI vrstici (kanon val 58) — pin evoluiral na nov niz;
    // O2 sosledje red/40+' '+O2 ostaja neovirano (INS je PRED ring-2).]
    expect(pod(TB, 'gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2')).toBe(2)
    const SD = R('roksal/sessions-dialog.tsx')
    expect(pod(SD, 'press-scale focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2')).toBe(2)
    const DB = R('roksal/dashboard-tab.tsx')
    // val 55 (B) izjema #1 (KIT brez offseta) — val 59 resolva: isti podniz
    // zdaj VEDNO nosi O2 (stara asercija brez O2 ostaje zelena — podniz)
    expect(pod(DB, 'h-7 border-roksal-red/40 text-roksal-red hover:bg-roksal-red/10 hover:text-roksal-red focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2')).toBeGreaterThanOrEqual(1)
  })

  it('(E) OBRNJENA REGRESIJA: val 55 needleji N1–N4 ostajajo ×1 + val 58 transition-colors + navy kanon + amber/50 pariteta 100%', () => {
    const N1 = 'animate-fade-in-up cursor-pointer transition-colors hover:bg-roksal-red/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2'
    const N2 = 'shadow-sm animate-fade-in-up transition-colors hover:bg-roksal-red/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2'
    const N3 = 'p-1.5 rounded-lg hover:bg-roksal-red/10 focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2 focus-visible:outline-none transition-colors'
    const N4 = 'flex items-center gap-1 transition-colors hover:text-roksal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2'
    expect(pod(R('roksal/dashboard-tab.tsx'), N1)).toBe(1)
    expect(pod(R('roksal/vodja-dashboard.tsx'), N2)).toBe(1)
    expect(pod(R('roksal/measurements-tab.tsx'), N3)).toBe(1)
    expect(pod(R('roksal/sistem-zdravje-card.tsx'), N4)).toBe(1)
    // val 58 (dashboard L1628 'Počisti iskanje projektov') — nedotaknjen
    expect(R('roksal/dashboard-tab.tsx')).toContain('transition-colors focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 rounded')
    // navy kanon (val 52 družina) — vzorec ostaja
    expect(R('roksal/dashboard-tab.tsx')).toContain(NAVY_KANON)
    // amber/50: vsak amber/40+ ring nosi O2 (družina je bila 100% — ostane)
    const amb = new RegExp('focus-visible:ring-roksal-amber/50(?! ' + O2 + ')', 'g')
    let ambSk = 0
    const korenA = join(process.cwd(), 'src/components/roksal')
    for (const z of readdirSync(korenA)) {
      if (!z.endsWith('.tsx')) continue
      ambSk += (readFileSync(join(korenA, z), 'utf-8').match(amb) ?? []).length
    }
    expect(ambSk, 'ne-pariranih amber/50').toBe(0)
  })

  it('(F) SKUPNA RESNICA: 14 val 59 INS — skupni števec kanonov == 14 + že-parirani 11 = rdeča družina 25/25 kanonska', () => {
    let kanoni = 0
    const korenF = join(process.cwd(), 'src/components/roksal')
    for (const z of readdirSync(korenF)) {
      if (!z.endsWith('.tsx')) continue
      kanoni += pod(readFileSync(join(korenF, z), 'utf-8'), KANON)
    }
    expect(kanoni, 'rdeča družina skupaj kanonska').toBe(25)
  })
})
