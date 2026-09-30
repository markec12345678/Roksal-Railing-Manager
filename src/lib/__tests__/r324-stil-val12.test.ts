// R324 — MANDATORY STIL val 12 (r162/…/R323 vzorec): dvonivojski odziv na
// NOVI površini — DANAŠNJI TERMINI. Val 11 (R323) je dvonivojsko hierarhijo
// (blok amber/30 < vrstica amber/40) uvedel na treh dokaznih blokih; val 12
// jo razširi na seznam današnjih terminov (isti vodja pregled, doslej mrtva
// površina): Card kontejner dobi `transition-colors hover:border-roksal-
// amber/30` (kontejner umaknjen), vrstice dobi `transition-colors
// hover:border-roksal-amber/40` (vrstica izrazita) — ISTA dve ravnini
// odgovora, brez transform (nič layout premika), 0 novih hex (samo žetoni).
//
// PIN SHIFTI izrecno (kanon R320/R321/R323):
//  • r317-stil-val8: amber/50 ring register ×7 → ×8 (NOV dnevni PDF gumb —
//    52. člen, bratska simetrija izvozne družine; anti-stale 57 → 58);
//  • r318-stil-val9: press-scale register 14 → 15 pojavitev, 8 → 9 gumbov
//    (NOV dnevni PDF gumb taktilna pariteta);
//  • r323-stil-val11: blok žeton register ×3 → ×4 (+ termini Card), vrstica
//    žeton register ×3 → ×4 (+ termini vrstice) — hierarhija ohranjena.
//
// STRAŽAR (kanon r316/…/r323 — anti-stale + obrnjena regresija):
//  • termini Card + termini vrstica nosita žetona (okno okoli površine);
//  • žetona = roksal tokena, NI surove barve (val7 kampanja kanon);
//  • hierarhija: vrstica /40 ostane IZRAZITEJŠA od bloka /30 (NI obrnjeno);
//  • obrnjena regresija: 3 dokazni bloki (val 11 okna) ŠE VEDNO nosijo blok
//    žeton — register pa je narasel na ×4 (NI pomešan z drugimi žetoni);
//  • anti-stale: .press-scale utility ŠE VEDNO v globals.css.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const VODJA = join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx')
const GLOBALS = join(process.cwd(), 'src/app/globals.css')

const src = readFileSync(VODJA, 'utf8')
const globals = readFileSync(GLOBALS, 'utf8')

/** Okno sekcije okoli označevalca (ISTA ekstrakcija kot val8/val9/val10/val11). */
function oknoOkoli(marker: string, pre = 8, post = 6): string {
  const vrstice = src.split('\n')
  const i = vrstice.findIndex((v) => v.includes(marker))
  if (i < 0) return ''
  return vrstice.slice(Math.max(0, i - pre), i + post).join('\n')
}

const BLOK_ZETON = 'transition-colors hover:border-roksal-amber/30'
const VRSTICA_ZETON = 'transition-colors hover:border-roksal-amber/40'

describe('r324 STIL val 12 — današnji termini: dvonivojski odziv na novi površini', () => {
  it('termini Card (kontejner) nosi blok žeton /30 + termini vrstica nosi vrstica žeton /40', () => {
    const povrsina = oknoOkoli('{/* Današnji termini seznam */}', 0, 40)
    expect(povrsina).toContain(BLOK_ZETON)
    expect(povrsina).toContain(VRSTICA_ZETON)
  })

  it('žetona = roksal tokena (val7 kampanja kanon — NIČ surovih barv) + hierarhija ohranjena (vrstica /40 IZRAZITEJŠA od bloka /30)', () => {
    expect(BLOK_ZETON).toMatch(/^transition-colors hover:border-roksal-amber\/\d+$/)
    expect(VRSTICA_ZETON).toMatch(/^transition-colors hover:border-roksal-amber\/\d+$/)
    expect(src).not.toMatch(/hover:border-amber-\d+/)
    const blokNivo = Number(BLOK_ZETON.match(/amber\/(\d+)/)?.[1])
    const vrsticaNivo = Number(VRSTICA_ZETON.match(/amber\/(\d+)/)?.[1])
    expect(vrsticaNivo).toBeGreaterThan(blokNivo)
  })

  it('obrnjena regresija: 3 dokazni bloki (val 11) ŠE VEDNO nosijo blok žeton (okna nedotaknjena)', () => {
    const bloki = [
      'data-testid="zmogljivost-dokaz"',
      'data-testid="avtomatizacija-dokaz"',
      'data-testid="koncna-verifikacija-dokaz"',
    ]
    const brez = bloki.filter((t) => !oknoOkoli(t).includes(BLOK_ZETON))
    expect(brez).toEqual([])
  })

  it('anti-stale + register zaklenjen: .press-scale v globals + natanko 4 blok žetona + 4 vrstica žetona v vodja-dashboard', () => {
    expect(globals).toContain('.press-scale {')
    // R312 lekcija: štetje POJAVITEV, ne vrstic
    expect(src.split(BLOK_ZETON).length - 1).toBe(4)
    expect(src.split(VRSTICA_ZETON).length - 1).toBe(4)
  })

  it('izvozna družina (z NOVIM dnevnim PDF gumbom) ŠE VEDNO taktilna + obročna: press-scale + amber/50 ring na novem gumbu', () => {
    const gumb = oknoOkoli('aria-label="Izvozi dnevni pregled vodje kot PDF"')
    expect(gumb).toContain('press-scale')
    expect(gumb).toContain('focus-visible:ring-roksal-amber/50')
    expect(gumb).toContain('onClick={exportDailyPdf}')
  })
})
