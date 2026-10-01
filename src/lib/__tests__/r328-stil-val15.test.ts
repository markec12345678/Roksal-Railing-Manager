// ---------------------------------------------------------------------------
// R328 — MANDATORY STIL val 15 (r162/…/R327 vzorec): NOVA površina — PANEL
// PRIMERJAVE DOBAVITELJEV (55. člen, §5 'supplier comparison').
//
// val 14 je harmoniziral izvozni PAR zgodovine (navy/40 + press-scale); val
// 15 GA OHRANI (obrnjena regresija — polzaporedje ne sme nazaj) IN prenese
// dvonivojsko hierarhijo (val 11/12/13 kanon) na NOV pod panel:
//  • Card kontejner = MEKŠI žeton `transition-colors hover:border-roksal-
//    amber/30` (površinski nivo — ista ravnina kot zgodovina Card);
//  • tabelska vrstica = IZRAZITEJŠI `transition-colors hover:border-roksal-
//    amber/40` (hierarhija /40 > /30 ŽIVA);
//  • izvozni gumb = družinski kanon izvozne družine (val 8/14): IZRECEN
//    focus-visible ring roksal-navy/40 + press-scale (amber/50 register
//    ostane zaklenjen v vodja-dashboard ×8 — ta panel NI član);
//  • zgodovina PAR (CSV + PDF) ostaja bajtno nespremenjen (obrnjena
//    regresija — 2× RING_NAVY + 2× press-scale v zgodovina panelu);
//  • vodja val 11/12 register ×4/×4 se NE sme premakniti (nov panel je
//    LOČENA datoteka — LEKCIJA R325 5 / R326);
//  • globals anti-stale: .press-scale definicija ŽIVA.
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const NOVI_PANEL = join(process.cwd(), 'src/components/roksal/cena-dobavitelji-panel.tsx')
const ZGOD_PANEL = join(process.cwd(), 'src/components/roksal/cena-zgodovina-panel.tsx')
const VODJA = join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx')
const GLOBALS = join(process.cwd(), 'src/app/globals.css')

const src = readFileSync(NOVI_PANEL, 'utf8')
const zgod = readFileSync(ZGOD_PANEL, 'utf8')
const vodja = readFileSync(VODJA, 'utf8')
const globals = readFileSync(GLOBALS, 'utf8')

const BLOK_ZETON = 'transition-colors hover:border-roksal-amber/30'
const VRSTICA_ZETON = 'transition-colors hover:border-roksal-amber/40'
const RING_NAVY = 'focus-visible:ring-2 focus-visible:ring-roksal-navy/40'

/** Vrni okno N vrstic okoli prve vrstice, ki vsebuje marker (vzorec R324/R326/R327). */
function oknoOkoli(vir: string, marker: string, okno = 12): string {
  const vrstice = vir.split('\n')
  const i = vrstice.findIndex((v) => v.includes(marker))
  expect(i).toBeGreaterThanOrEqual(0)
  return vrstice.slice(Math.max(0, i - okno), i + okno + 1).join('\n')
}

describe('r328 STIL val 15 — dvonivojska hierarhija na panelu Primerjava dobaviteljev', () => {
  it('Card kontejner = MEKŠI površinski žeton amber/30 (val 11/13 kanon)', () => {
    expect(src).toContain(BLOK_ZETON)
    const card = oknoOkoli(src, 'data-testid="cena-dobavitelji-dokaz"', 4)
    expect(card).toContain(BLOK_ZETON)
  })

  it('tabelska vrstica = IZRAZITEJŠI žeton amber/40 (hierarhija /40 > /30 ŽIVA)', () => {
    expect(src).toContain(VRSTICA_ZETON)
    const vrstica = oknoOkoli(src, 'border-t border-border/40 transition-colors', 2)
    expect(vrstica).toContain(VRSTICA_ZETON)
    const blokNivo = Number(BLOK_ZETON.match(/amber\/(\d+)/)?.[1])
    const vrsticaNivo = Number(VRSTICA_ZETON.match(/amber\/(\d+)/)?.[1])
    expect(vrsticaNivo).toBeGreaterThan(blokNivo)
  })

  it('izvozni gumb = družinski kanon: IZRECEN navy/40 ring + press-scale (val 8/14)', () => {
    const gumb = oknoOkoli(src, 'aria-label="Izvozi primerjavo dobaviteljev kot CSV"', 6)
    expect(gumb).toContain(RING_NAVY)
    expect(gumb).toContain('press-scale')
    expect(src).not.toContain('focus-visible:ring-roksal-amber/50')
  })

  it('obrnjena regresija: zgodovina PAR ostaja bajtno nespremenjen (2× navy/40 ring + 2× press-scale + val 13 hierarhija)', () => {
    expect(zgod.split(RING_NAVY).length - 1).toBe(2)
    expect(zgod.split('press-scale').length - 1).toBe(2)
    expect(zgod).toContain(BLOK_ZETON)
    expect(zgod).toContain(VRSTICA_ZETON)
  })

  it('vodja val 11/12 register ostaja ×4/×4 (nov panel je LOČENA datoteka — LEKCIJA R325 5)', () => {
    expect(vodja.split(BLOK_ZETON).length - 1).toBe(4)
    expect(vodja.split(VRSTICA_ZETON).length - 1).toBe(4)
  })

  it('globals anti-stale: .press-scale definicija ŽIVA (kanon r316-stil-val7)', () => {
    expect(globals).toContain('.press-scale {')
  })

  it('0 novih surovih barv: nov panel nosi SAMO roksal žetone (nikjer amber-500/navy-900 surovina)', () => {
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(src).not.toMatch(/\b(?:bg|text|border|ring)-(?:amber|navy|red|green)-\d{2,3}\b/)
    expect(src).toContain('text-roksal-ink')
  })
})
