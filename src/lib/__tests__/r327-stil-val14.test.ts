// ---------------------------------------------------------------------------
// R327 — MANDATORY STIL val 14 (r162/…/R325 vzorec): IZVOZNI PAR NA NOVI
// površini — PANEL ZGODOVINE CEN MATERIALA dobi PDF BRATA (54. člen).
//
// val 13 je panelu dala dvonivojsko hierarhijo (par-Card /30 + časovnica
// /40); val 14 JO OHRANI (obrnjena regresija — polzaporedje ne sme nazaj) IN
// harmonizira izvozni par na družinski kanon izvozne družine (val 8):
//  • OBA gumba (CSV + PDF) nosita IZRECEN focus-visible ring roksal-navy/40
//    (amber/50 register ostane zaklenjen v vodja-dashboard ×8 — panel NI
//    član registra);
//  • OBA gumba nosita press-scale (taktilen odziv — val 12 kanon);
//  • OBA gumba pod ISTIM pogojem (iskrena ničelna veja — brez podatkov NI
//    izvoza; par ne more divergirati);
//  • vodja val 11/12 register ×4/×4 se NE sme premakniti (nov par je LOČENA
//    datoteka, vodja registri NEPREMIKNJENI — LEKCIJA R326);
//  • globals anti-stale: .press-scale definicija ŽIVA.
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PANEL = join(process.cwd(), 'src/components/roksal/cena-zgodovina-panel.tsx')
const VODJA = join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx')
const GLOBALS = join(process.cwd(), 'src/app/globals.css')

const src = readFileSync(PANEL, 'utf8')
const vodja = readFileSync(VODJA, 'utf8')
const globals = readFileSync(GLOBALS, 'utf8')

const BLOK_ZETON = 'transition-colors hover:border-roksal-amber/30'
const VRSTICA_ZETON = 'transition-colors hover:border-roksal-amber/40'

const RING_NAVY = 'focus-visible:ring-2 focus-visible:ring-roksal-navy/40'

/** Vrni okno N vrstic okoli prve vrstice, ki vsebuje marker (vzorec R324/R326). */
function oknoOkoli(vir: string, marker: string, okno = 12): string {
  const vrstice = vir.split('\n')
  const i = vrstice.findIndex((v) => v.includes(marker))
  expect(i).toBeGreaterThanOrEqual(0)
  return vrstice.slice(Math.max(0, i - okno), i + okno + 1).join('\n')
}

describe('r327 STIL val 14 — izvozni PAR na zgodovina cen panelu (harmonizacija bratov)', () => {
  it('OBA gumba nosita IZRECEN navy/40 ring (družinski kanon izvozne družine val 8)', () => {
    const csvGumb = oknoOkoli(src, 'aria-label="Izvozi zgodovino cen materiala kot CSV"', 6)
    const pdfGumb = oknoOkoli(src, 'aria-label="Izvozi zgodovino cen materiala kot PDF"', 6)
    expect(csvGumb).toContain(RING_NAVY)
    expect(pdfGumb).toContain(RING_NAVY)
    expect(src.split(RING_NAVY).length - 1).toBe(2)
  })

  it('OBA gumba nosita press-scale (taktilen odziv — val 12 kanon) + NIČ amber/50 (register zaklenjen v vodjo)', () => {
    const csvGumb = oknoOkoli(src, 'aria-label="Izvozi zgodovino cen materiala kot CSV"', 6)
    const pdfGumb = oknoOkoli(src, 'aria-label="Izvozi zgodovino cen materiala kot PDF"', 6)
    expect(csvGumb).toContain('press-scale')
    expect(pdfGumb).toContain('press-scale')
    expect(src.split('press-scale').length - 1).toBe(2)
    expect(src).not.toContain('focus-visible:ring-roksal-amber/50')
  })

  it('iskrena ničelna veja: OBA gumba pod ISTIM pogojem (skupna flex skupina — par ne more divergirati)', () => {
    // skupina obstaja NATANKO enkrat (točna className z zaklepajem — CardTitle
    // in delta pripoved nosita daljše nize) in nosi OBA aria-labela znotraj okna
    expect(src.match(/"flex items-center gap-2"/g)?.length).toBe(1)
    const skupina = oknoOkoli(src, '"flex items-center gap-2"', 24)
    expect(skupina).toContain('aria-label="Izvozi zgodovino cen materiala kot CSV"')
    expect(skupina).toContain('aria-label="Izvozi zgodovino cen materiala kot PDF"')
    // pogoj ene resnice nad skupino
    expect(skupina).toContain('pregled.pari.length > 0 &&')
  })

  it('ODRNJENA regresija: val 13 hierarhija ŽIVA — par-Card /30 + časovnica /40 na panelu', () => {
    expect(src).toContain(BLOK_ZETON)
    expect(src).toContain(VRSTICA_ZETON)
    const blokNivo = Number(BLOK_ZETON.match(/amber\/(\d+)/)?.[1])
    const vrsticaNivo = Number(VRSTICA_ZETON.match(/amber\/(\d+)/)?.[1])
    expect(vrsticaNivo).toBeGreaterThan(blokNivo)
  })

  it('vodja val 11/12 register ostaja ×4/×4 (nov par NE sme premakniti vodje — LEKCIJA R326)', () => {
    expect(vodja.split(BLOK_ZETON).length - 1).toBe(4)
    expect(vodja.split(VRSTICA_ZETON).length - 1).toBe(4)
  })

  it('globals anti-stale: .press-scale definicija ŽIVA (anti-stale kanon r316-stil-val7)', () => {
    expect(globals).toContain('.press-scale {')
  })

  it('PDF gumb ikona = FileText (družinski kanon PDF gumbov — vzorec vodja R324), CSV = FileDown', () => {
    const pdfGumb = oknoOkoli(src, 'aria-label="Izvozi zgodovino cen materiala kot PDF"', 8)
    expect(pdfGumb).toContain('<FileText')
    const csvGumb = oknoOkoli(src, 'aria-label="Izvozi zgodovino cen materiala kot CSV"', 8)
    expect(csvGumb).toContain('<FileDown')
  })
})
