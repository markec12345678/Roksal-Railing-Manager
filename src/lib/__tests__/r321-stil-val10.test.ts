// R321 — MANDATORY STIL val 10 (r162/…/R320 vzorec): DOKAZNI bloki —
// vrstični hover mikrointerakcija. Trije vodja dokazni bloki (meritve
// zmogljivosti R312 + avtomatizacijski audit R314 + končna verifikacija
// R315) izrisujejo ISTE vrstične kartice (rounded-md border bg-background/60)
// — pred R321 Noben ni nosil hover povratne informacije: mrtva območja na
// gosto poseljenem vodja pregledu, brez signal da je vrstica ciljna površina.
// Val 10: vsem trem blokom ENOTEN `transition-colors hover:border-roksal-
// amber/40` — vrstica odgovori z bratskim amber žetonom (ISTI žeton kot
// izvozna družina gumbov v ISTIH blokih — val8 register), brez premikanja
// layouta (transition-colors, NE transform).
//
// PIN SHIFTI izrecno (R321):
//  • r317-stil-val8: amber/50 ring register ×5 → ×6 (NOV meritve-zmogljivosti
//    PDF gumb — bratska simetrija blok glav; anti-stale 55 → 56 gumbov);
//  • r318-stil-val9: press-scale register 12 → 13 pojavitev, 6 → 7 gumbov
//    (NOV gumb taktilna pariteta).
//
// STRAŽAR (kanon r316/r317/r318 — anti-stale + obrnjena regresija):
//  • vseh 3 dokaznih vrstic nosi transition-colors + hover:border-roksal-
//    amber/40 (okno okoli data-testid);
//  • hover žeton = roksal token, NI surove barve (val7 kampanja kanon);
//  • obrnjena regresija: pill bratje ŠE VEDNO nosijo press-scale (val9);
//  • anti-stale: .press-scale utility ŠE VEDNO v globals.css;
//  • register zaklenjen: natanko 3 pojitve hover:border-roksal-amber/40 v
//    vodja-dashboard (R312 lekcija: štetje POJAVITEV, ne vrstic).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const VODJA = join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx')
const GLOBALS = join(process.cwd(), 'src/app/globals.css')

const src = readFileSync(VODJA, 'utf8')
const globals = readFileSync(GLOBALS, 'utf8')

/** Okno vrstic okoli data-testida (ISTA ekstrakcija kot val8/val9). */
function oknoOkoli(testid: string): string {
  const vrstice = src.split('\n')
  const i = vrstice.findIndex((v) => v.includes(testid))
  if (i < 0) return ''
  return vrstice.slice(Math.max(0, i - 6), i + 4).join('\n')
}

const HOVER_ZETON = 'transition-colors hover:border-roksal-amber/40'

describe('r321 STIL val 10 — vodja dokazni bloki: vrstični hover mikrointerakcija', () => {
  it('vseh 3 dokaznih vrstic nosi enoten hover žeton (zmogljivost + avtomatizacija + končna verifikacija)', () => {
    const bloki = [
      'data-testid="zmogljivost-vrstica"',
      'data-testid="avtomatizacija-vrstica"',
      'data-testid="koncna-verifikacija-vrstica"',
    ]
    const brez = bloki.filter((t) => !oknoOkoli(t).includes(HOVER_ZETON))
    expect(brez).toEqual([])
  })

  it('hover žeton = roksal token (val7 kampanja kanon — NIČ surovih barv)', () => {
    expect(HOVER_ZETON).toMatch(/^transition-colors hover:border-roksal-amber\/\d+$/)
    // žeton je del globals žetonskega sistema (roksal-amber definiran)
    expect(src).not.toMatch(/hover:border-amber-\d+/)
  })

  it('obrnjena regresija: pill bratje + izvozna družina ŠE VEDNO nosijo press-scale (val9 nedotaknjen)', () => {
    const gumbi = [
      'aria-label="Izvozi dobičkonosnost projektov kot PDF"',
      'aria-label="Izvozi račune po projektih kot PDF"',
      'aria-label="Izvozi poročilo končne verifikacije kot PDF"',
      'aria-label="Izvozi meritve zmogljivosti kot PDF"',
    ]
    const izgubljeni = gumbi.filter((a) => !oknoOkoli(a).includes('press-scale'))
    expect(izgubljeni).toEqual([])
  })

  it('anti-stale + register zaklenjen: .press-scale v globals + natanko 4 pojavitve hover žetona v vodja-dashboard (3 dokazni + termini R324)', () => {
    expect(globals).toContain('.press-scale {')
    // R312 lekcija (osma potrditev): štetje POJAVITEV, ne vrstic
    // R324 PIN SHIFT: register ×3 → ×4 (+ termini vrstica — val 12)
    const pojavitve = src.split(HOVER_ZETON).length - 1
    expect(pojavitve).toBe(4)
  })
})
