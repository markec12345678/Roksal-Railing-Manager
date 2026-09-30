// R323 — MANDATORY STIL val 11 (r162/…/R321 vzorec): DOKAZNI bloki —
// sekcija-level hover mikrointerakcija. Val 10 (R321) je dal trem vodja
// dokaznim blokom vrstični hover (amber/40 na vrsticah) — sami bloki
// (section kontejnerji) pa ostajajo mrtvi na hover: preglednična ravnina
// brez odziva. Val 11: vsem trem blokom ENOTEN `transition-colors
// hover:border-roksal-amber/30` — blok odgovori z MEHKŠIM bratskim amber
// žetonom (amber/30 < vrstica amber/40 — dve ravnini odgovora, jasna
// hierarhija kontejner → vrstica; transition-colors, NE transform — brez
// layout premika).
//
// PIN SHIFTI izrecno (R322):
//  • r317-stil-val8: amber/50 ring register ×6 → ×7 (NOV meritve-zmogljivosti
//    CSV gumb — bratska simetrija izvozne družine; anti-stale 56 → 57);
//  • r318-stil-val9: press-scale register 13 → 14 pojavitev, 7 → 8 gumbov
//    (NOV CSV gumb taktilna pariteta);
//  • r321-stil-val10: obrnjena regresija lista + CSV gumb (press-scale
//    nedotaknjen); hover:border-roksal-amber/40 register ostane ×3.
//
// STRAŽAR (kanon r316/…/r321 — anti-stale + obrnjena regresija):
//  • vseh 3 dokaznih sekcij nosi transition-colors + hover:border-roksal-
//    amber/30 (okno okoli data-testid);
//  • žeton = roksal token, NI surove barve (val7 kampanja kanon);
//  • hierarhija: vrstica žeton (amber/40) ostane ×3 — NI pomešan z blok
//    žetonom (amber/30);
//  • anti-stale: .press-scale utility ŠE VEDNO v globals.css;
//  • register zaklenjen: natanko 3 pojavitve hover:border-roksal-amber/30
//    v vodja-dashboard (R312 lekcija: štetje POJAVITEV, ne vrstic).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const VODJA = join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx')
const GLOBALS = join(process.cwd(), 'src/app/globals.css')

const src = readFileSync(VODJA, 'utf8')
const globals = readFileSync(GLOBALS, 'utf8')

/** Okno sekcije okoli data-testida (ISTA ekstrakcija kot val8/val9/val10). */
function oknoOkoli(testid: string): string {
  const vrstice = src.split('\n')
  const i = vrstice.findIndex((v) => v.includes(testid))
  if (i < 0) return ''
  return vrstice.slice(Math.max(0, i - 8), i + 2).join('\n')
}

const BLOK_ZETON = 'transition-colors hover:border-roksal-amber/30'
const VRSTICA_ZETON = 'transition-colors hover:border-roksal-amber/40'

describe('r323 STIL val 11 — vodja dokazni bloki: sekcija-level hover mikrointerakcija', () => {
  it('vseh 3 dokaznih sekcij nosi enoten blok hover žeton (zmogljivost + avtomatizacija + končna verifikacija)', () => {
    const bloki = [
      'data-testid="zmogljivost-dokaz"',
      'data-testid="avtomatizacija-dokaz"',
      'data-testid="koncna-verifikacija-dokaz"',
    ]
    const brez = bloki.filter((t) => !oknoOkoli(t).includes(BLOK_ZETON))
    expect(brez).toEqual([])
  })

  it('blok žeton = roksal token (val7 kampanja kanon — NIČ surovih barv) + MEKŠI od vrstičnega (hierarhija /30 < /40)', () => {
    expect(BLOK_ZETON).toMatch(/^transition-colors hover:border-roksal-amber\/\d+$/)
    expect(src).not.toMatch(/hover:border-amber-\d+/)
    // hierarhija: blok MEKŠI kot vrstica (30 < 40 — kontejner umaknjen,
    // vrstica izrazita)
    const blokNivo = Number(BLOK_ZETON.match(/amber\/(\d+)/)?.[1])
    const vrsticaNivo = Number(VRSTICA_ZETON.match(/amber\/(\d+)/)?.[1])
    expect(blokNivo).toBeLessThan(vrsticaNivo)
  })

  it('obrnjena regresija: vrstični hover val 10 ŠE VEDNO ×3 + izvozna družina (z NOVIM CSV gumbom) ŠE VEDNO press-scale', () => {
    // val 10 vrstični žeton ostane ×3 (NI pomešan z blok žetonom)
    const vrsticaPojavitve = src.split(VRSTICA_ZETON).length - 1
    expect(vrsticaPojavitve).toBe(3)
    const gumbi = [
      'aria-label="Izvozi dobičkonosnost projektov kot PDF"',
      'aria-label="Izvozi poročilo končne verifikacije kot PDF"',
      'aria-label="Izvozi meritve zmogljivosti kot PDF"',
      'aria-label="Izvozi meritve zmogljivosti kot CSV"',
    ]
    const izgubljeni = gumbi.filter((a) => !oknoOkoli(a).includes('press-scale'))
    expect(izgubljeni).toEqual([])
  })

  it('anti-stale + register zaklenjen: .press-scale v globals + natanko 3 pojavitve blok žetona v vodja-dashboard', () => {
    expect(globals).toContain('.press-scale {')
    // R312 lekcija (deveta potrditev): štetje POJAVITEV, ne vrstic
    const pojavitve = src.split(BLOK_ZETON).length - 1
    expect(pojavitve).toBe(3)
  })
})
