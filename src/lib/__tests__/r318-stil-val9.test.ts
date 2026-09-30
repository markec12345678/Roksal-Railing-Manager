// R318 — MANDATORY STIL val 9 (r162/…/R317 vzorec): press-scale
// mikrointerakcija na VODJA izvozni družini — taktilna pariteta s pill
// bratje (R258 dobičkonosnost PDF / R261 računi PDF / R293 dobičkonosnost
// CSV — v ISTI datoteki že nosijo press-scale). Pred R318: 5 vodja izvoznih
// gumbov (dnevni CSV R163 + Poročilo PDF + JSON 46. + audit CSV 47. + audit
// PDF 48. člen) NI imelo press-scale — nedosledna taktilna povratna informacija
// znotraj iste datoteke (isti vzorec, dva občutka).
//
// STRAŽAR (kanon r316/r317 — anti-stale + reverse regresija):
//  • vsak od 5 vodja izvoznih gumbov nosi press-scale (okno ±8 vrstic okoli
//    aria-label — ISTA ekstrakcija kot val8);
//  • pill bratje ŠE VEDNO nosijo press-scale (obrnjena regresija — odstranitev
//    = fail);
//  • .press-scale utility ŠE VEDNO definirana v globals.css (anti-stale);
//  • press-scale NI umetno dodan ne-izvoznim površinam v vodji (register
//    zaklenjen — natanko 11 pojavitev v vodja-dashboard: 5 novih + 3 pill +
//    3 obstoječe drugje — odstopanje = fail; R312 lekcija: štetje POJAVITEV).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const VODJA = join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx')
const GLOBALS = join(process.cwd(), 'src/app/globals.css')

const src = readFileSync(VODJA, 'utf8')
const globals = readFileSync(GLOBALS, 'utf8')

/** Okno vrstic okoli aria-labela (ISTA ekstrakcija kot val8 STRAŽAR). */
function oknoOkoli(aria: string): string {
  const vrstice = src.split('\n')
  const i = vrstice.findIndex((v) => v.includes(aria))
  if (i < 0) return ''
  return vrstice.slice(Math.max(0, i - 8), i + 6).join('\n')
}

describe('r318 STIL val 9 — vodja izvozna družina: press-scale taktilna pariteta', () => {
  it('vseh 5 vodja izvoznih gumbov nosi press-scale (taktilna pariteta s pill bratje)', () => {
    const gumbi = [
      'aria-label="Izvozi dnevni pregled vodje kot CSV"',
      'aria-label="Prenesi mesečno PDF poročilo"',
      'aria-label="Izvozi poročilo končne verifikacije kot JSON"',
      'aria-label="Izvozi avtomatizacijski audit kot CSV"',
      'aria-label="Izvozi avtomatizacijski audit kot PDF"',
    ]
    const brez = gumbi.filter((a) => !oknoOkoli(a).includes('press-scale'))
    expect(brez).toEqual([])
  })

  it('obrnjena regresija: pill bratje (R258/R261/R293) ŠE VEDNO nosijo press-scale', () => {
    const pilli = [
      'aria-label="Izvozi dobičkonosnost projektov kot PDF"',
      'aria-label="Izvozi račune po projektih kot PDF"',
      'aria-label="Izvozi dobičkonosnost projektov kot CSV"',
    ]
    const izgubljeni = pilli.filter((a) => !oknoOkoli(a).includes('press-scale'))
    expect(izgubljeni).toEqual([])
  })

  it('anti-stale: .press-scale utility ŠE VEDNO definirana v globals.css', () => {
    expect(globals).toContain('.press-scale {')
    expect(globals).toContain('.press-scale:active {')
    expect(globals).toContain('transform: scale(0.97)')
  })

  it('register zaklenjen: natanko 11 pojavitev press-scale v vodja-dashboard (5 novih + 3 pill + 3 obstoječe drugje)', () => {
    // R312 lekcija (peta potrditev): štetje POJAVITEV, ne vrstic
    const pojavitve = src.split('press-scale').length - 1
    expect(pojavitve).toBe(11)
  })
})
