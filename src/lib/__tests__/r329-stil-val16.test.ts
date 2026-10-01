// ---------------------------------------------------------------------------
// R329 — MANDATORY STIL val 16 (r162/…/R328 vzorec): 56. člen PDF brat +
// ISKREN ALARM na zaslonu (panel Primerjava dobaviteljev — ista površina
// kot val 15, NOVI detajli).
//
// val 15 je prenesel dvonivojsko hierarhijo (Card /30 + vrstica /40) na
// pod panel; val 16 JO OHRANI (obrnjena regresija — polzaporedje ne sme
// nazaj) IN doda:
//  • izvozni PAR = DVA gumba (CSV R328 + NOVI PDF R329 — bratska simetrija
//    z zgodovina PAR R327): OBA nosita družinski navy/40 ring + press-scale
//    (pariteta, nič drugega občutka znotraj istega para);
//  • WYSIWYG iskren alarm: števec Narašča > 0 = text-roksal-red +
//    font-medium (ISTI rdeči pomen kot TrendingUp ikona zgodovina panela IN
//    RED KPI/celica PDF brata); Pada > 0 = text-roksal-green + font-medium
//    (ISTI zeleni pomen kot TrendingDown ikona — zaslonska družina
//    rdeč/zelen; PDF družina rdeč/navy — DATA WYSIWYG, palete po površini);
//  • tabelska glava = `border-b border-border/60` (struktura stolpcev —
//    vzorec zgodovina časovna tabela);
//  • zgodovina PAR (CSV + PDF) ostaja bajtno nespremenjen (obrnjena
//    regresija — 2× RING_NAVY + 2× press-scale v zgodovina panelu);
//  • vodja val 11/12 register ×4/×4 se NE sme premakniti (panel je LOČENA
//    datoteka — LEKCIJA R325 5 / R326);
//  • globals anti-stale: .press-scale definicija ŽIVA; 0 surovih barv
//    (text-roksal-red/green = roksal tokena, kanon val 15 0-hex).
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

/** Vrni okno N vrstic okoli prve vrstice, ki vsebuje marker (vzorec R324/R326/R327/R328). */
function oknoOkoli(vir: string, marker: string, okno = 12): string {
  const vrstice = vir.split('\n')
  const i = vrstice.findIndex((v) => v.includes(marker))
  expect(i).toBeGreaterThanOrEqual(0)
  return vrstice.slice(Math.max(0, i - okno), i + okno + 1).join('\n')
}

describe('r329 STIL val 16 — PDF brat + iskren alarm na panelu Primerjava dobaviteljev', () => {
  it('izvozni PAR = DVA gumba, OBA z družinskim navy/40 ring + press-scale (bratska simetrija zgodovina PAR R327)', () => {
    const csvGumb = oknoOkoli(src, 'aria-label="Izvozi primerjavo dobaviteljev kot CSV"', 6)
    const pdfGumb = oknoOkoli(src, 'aria-label="Izvozi primerjavo dobaviteljev kot PDF"', 6)
    expect(csvGumb).toContain(RING_NAVY)
    expect(csvGumb).toContain('press-scale')
    expect(pdfGumb).toContain(RING_NAVY)
    expect(pdfGumb).toContain('press-scale')
    // par okvir: eno mesto z očmi (bratska simetrija — FileDown CSV + FileText PDF)
    expect(src).toContain('<FileDown className="mr-2 h-4 w-4" aria-hidden="true" />')
    expect(src).toContain('<FileText className="mr-2 h-4 w-4" aria-hidden="true" />')
  })

  it('iskren alarm WYSIWYG: Narašča > 0 = text-roksal-red + font-medium (ISTI rdeči pomen kot TrendingUp ikona + PDF RED)', () => {
    const alarm = oknoOkoli(src, "d.narasca > 0 ? 'py-1 pr-3 font-medium tabular-nums text-roksal-red'", 3)
    expect(alarm).toContain('text-roksal-red')
    expect(alarm).toContain('font-medium')
    expect(alarm).toContain('{d.narasca}')
  })

  it('iskren alarm WYSIWYG: Pada > 0 = text-roksal-green + font-medium (ISTI zeleni pomen kot TrendingDown ikona — zaslonska družina)', () => {
    const alarm = oknoOkoli(src, "d.pada > 0 ? 'py-1 pr-3 font-medium tabular-nums text-roksal-green'", 3)
    expect(alarm).toContain('text-roksal-green')
    expect(alarm).toContain('font-medium')
    expect(alarm).toContain('{d.pada}')
  })

  it('tabelska glava = border-b border-border/60 (struktura stolpcev — vzorec zgodovina časovna tabela)', () => {
    const glava = oknoOkoli(src, 'CENA_DOBAVITELJI_CSV_GLAVE.map', 4)
    expect(glava).toContain('border-b border-border/60')
  })

  it('obrnjena regresija: val 15 hierarhija ostane ŽIVA na novi površini (Card /30 + vrstica /40, hierarhija /40 > /30)', () => {
    expect(src).toContain(BLOK_ZETON)
    expect(src).toContain(VRSTICA_ZETON)
    const blokNivo = Number(BLOK_ZETON.match(/amber\/(\d+)/)?.[1])
    const vrsticaNivo = Number(VRSTICA_ZETON.match(/amber\/(\d+)/)?.[1])
    expect(vrsticaNivo).toBeGreaterThan(blokNivo)
    // zgodovina PAR bajtno NEPREMIKNJEN (obrnjena regresija)
    expect(zgod.split(RING_NAVY).length - 1).toBe(2)
    expect(zgod.split('press-scale').length - 1).toBe(2)
    expect(zgod).toContain(BLOK_ZETON)
    expect(zgod).toContain(VRSTICA_ZETON)
  })

  it('vodja val 11/12 register ostane ×4/×4 (panel je LOČENA datoteka — LEKCIJA R325 5)', () => {
    expect(vodja.split(BLOK_ZETON).length - 1).toBe(4)
    expect(vodja.split(VRSTICA_ZETON).length - 1).toBe(4)
  })

  it('globals anti-stale: .press-scale definicija ŽIVA (kanon r316-stil-val7)', () => {
    expect(globals).toContain('.press-scale {')
    expect(globals).toContain('transform: scale(0.97)')
  })

  it('0 novih surovih barv: panel nosi SAMO roksal žetone (text-roksal-red/green = tokena; nikjer amber/navy/red/green-NNN surovina, nič hex)', () => {
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(src).not.toMatch(/\b(?:bg|text|border|ring)-(?:amber|navy|red|green)-\d{2,3}\b/)
    expect(src).toContain('text-roksal-ink')
  })
})
