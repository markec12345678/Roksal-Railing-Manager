// R172 — dark-spot regresijski stražar: 18 popravljenih svetlih žetonov
// (nove barvne družine v r168-dark-scan.py: bg-barvni-svetli, border-barvni,
// text-barvni-temni) MORA imeti dark: ogledalo NA ISTI VRSTICI (nauček
// R165/R167: scopa samo vrstica; celoten surovec vsebuje namerne žetone).
// Vzorec r170 javne strani it.each + idempotentnost pregleda.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const vrstice = (rel: string): string[] =>
  readFileSync(join(root, rel), 'utf8').split('\n')

/** Vrstica (1-based) mora vsebovati SVETLI žeton IN njegovo dark: ogledalo. */
const stražar = (rel: string, st: number, svetli: string, dark: string) => ({
  rel,
  st,
  svetli,
  dark,
  vrsta: () => vrstice(rel)[st - 1],
})

const PRIMERI = [
  // portal/[token]/page.tsx — STATUS_CONFIG (bg/ring/text) + monter notes + 404
  stražar('src/app/portal/[token]/page.tsx', 52, 'bg-amber-50', 'dark:bg-amber-950/40'),
  stražar('src/app/portal/[token]/page.tsx', 54, 'ring-amber-200', 'dark:ring-amber-800'),
  stražar('src/app/portal/[token]/page.tsx', 59, 'bg-blue-50', 'dark:bg-blue-950/40'),
  stražar('src/app/portal/[token]/page.tsx', 60, 'text-blue-700', 'dark:text-blue-300'),
  stražar('src/app/portal/[token]/page.tsx', 61, 'ring-blue-200', 'dark:ring-blue-800'),
  stražar('src/app/portal/[token]/page.tsx', 66, 'bg-green-50', 'dark:bg-green-950/40'),
  stražar('src/app/portal/[token]/page.tsx', 68, 'ring-green-200', 'dark:ring-green-800'),
  stražar('src/app/portal/[token]/page.tsx', 73, 'bg-red-50', 'dark:bg-red-950/40'),
  stražar('src/app/portal/[token]/page.tsx', 75, 'ring-red-200', 'dark:ring-red-800'),
  stražar('src/app/portal/[token]/page.tsx', 343, 'bg-amber-50', 'dark:bg-amber-950/40'), // R179: vrstica +3 (tokenizacijski komentar)
  stražar('src/app/portal/[token]/page.tsx', 477, 'bg-red-50', 'dark:bg-red-950/40'), // R179: vrstica +3 (tokenizacijski komentar)
  // portal/[token]/gallery.tsx — PRED/MED/PO značke
  stražar('src/app/portal/[token]/gallery.tsx', 193, 'bg-amber-100', 'dark:bg-amber-500/15'),
  stražar('src/app/portal/[token]/gallery.tsx', 194, 'bg-blue-100', 'dark:bg-blue-500/15'),
  stražar('src/app/portal/[token]/gallery.tsx', 195, 'bg-green-100', 'dark:bg-green-500/15'),
  // calculator-tab — estrih opozorilni Card (obe mesti)
  stražar('src/components/roksal/calculator-tab.tsx', 2343, 'bg-amber-50/60', 'dark:bg-amber-950/40'),
  stražar('src/components/roksal/calculator-tab.tsx', 3802, 'bg-amber-50/60', 'dark:bg-amber-950/40'),
  // material-intelligence-tab — NAJBOLJŠI ponudnik
  stražar('src/components/roksal/material-intelligence-tab.tsx', 329, 'bg-green-50', 'dark:bg-green-950/40'),
  // roksal-catalog — steklo tint (vzorec Inox fix R171)
  stražar('src/components/roksal/roksal-catalog.tsx', 193, 'bg-cyan-200/40', 'dark:bg-cyan-500/20'),
  // site-survey-tab — estrih Card + opravljeno opravilo
  stražar('src/components/roksal/site-survey-tab.tsx', 625, 'bg-amber-50/40', 'dark:bg-amber-950/40'),
  stražar('src/components/roksal/site-survey-tab.tsx', 873, 'bg-green-50', 'dark:bg-green-950/40'),
  // measurements-tab — AR snapshot hover obroba
  stražar('src/components/roksal/measurements-tab.tsx', 6364, 'hover:border-cyan-300', 'dark:hover:border-cyan-700'),
]

describe('R172 dark-spot stražar — vsak svetli barvni žeton ima dark: ogledalo na ISTI vrstici', () => {
  it.each(PRIMERI)('$rel:$st [$svetli → $dark]', ({ rel, st, svetli, dark, vrsta }) => {
    const v = vrsta()
    expect(v, `vrstica ${rel}:${st} naj vsebuje svetli žeton ${svetli}`).toContain(svetli)
    expect(v, `vrstica ${rel}:${st} naj vsebuje dark: ogledalo ${dark}`).toContain(dark)
  })

  it('pregled idempotenten: r168-dark-scan.py (razširjen ×23 družin) poroča NIČ kandidatov', () => {
    // Rustična stražar preverba brez odvisnosti od Pythona: kanditati vzorci
    // treh NOVIH družin, kjer je bil popravek, ne smejo več obstajati brez
    // dark: ogledala (scan sam se poganja v CI ročno — ta test je hitri stražar).
    const sveže = [
      ...vrstice('src/app/portal/[token]/page.tsx'),
      ...vrstice('src/app/portal/[token]/gallery.tsx'),
    ].filter((v) => /bg-(amber|blue|green|red)-(50|100)\b/.test(v) && !v.trim().startsWith('*'))
    for (const v of sveže) {
      expect(v, `svetli bg brez dark: ogledala: ${v.trim()}`).toMatch(/dark:(?:[\w-]+:)*bg-/)
    }
  })
})
