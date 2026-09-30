// ---------------------------------------------------------------------------
// R326 — MANDATORY STIL val 13 (r162/…/R324 vzorec): dvonivojska hierarhija
// odgovora (val 11/12 kanon) razširjena na NOVO površino — PANEL ZGODOVINE
// CEN MATERIALA (53. člen).
//
// Dve ravnini odgovora (ISTI žetona kot val 11/12 — nič novih hex):
//  • par-Card kontejner: MEKŠI `transition-colors hover:border-roksal-amber/30`
//  • časovna vrstica: IZRAZITEJŠI `transition-colors hover:border-roksal-amber/40`
// hierarhija /40 > /30 = jasna ravnina kontejner → vrstica; transition-colors
// NE transform — brez layout premika.
//
// PIN-DRŽAVNE OBVEZNOSTI (obrnjene regresije — polzaporedje ne sme nazaj):
//  • vodja-dashboard BLOK/VRSTICA žetona ostajata ×4/×4 (val 11/12 register
//    — nov panel je LOČEN datoteka, vodja števec se NE sme spremeniti);
//  • izvozni gumb panela: press-scale + ring = navy/40 (val 8: amber/50
//    ring je zaklenjen v vodja-dashboard — panel NI član registra);
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

/** Vrni okno N vrstic okoli prve vrstice, ki vsebuje marker (vzorec R324). */
function oknoOkoli(vir: string, marker: string, okno = 12): string {
  const vrstice = vir.split('\n')
  const i = vrstice.findIndex((v) => v.includes(marker))
  expect(i).toBeGreaterThanOrEqual(0)
  return vrstice.slice(Math.max(0, i - okno), i + okno + 1).join('\n')
}

describe('r325 STIL val 13 — zgodovina cen panel: dvonivojska hierarhija (NOVA površina)', () => {
  it('par-Card kontejner nosi MEKŠI blok žeton amber/30 (okno okoli data-testid)', () => {
    const povrsina = oknoOkoli(src, 'data-testid="cena-zgodovina-dokaz"', 8)
    expect(povrsina).toContain(BLOK_ZETON)
  })

  it('časovna vrstica nosi IZRAZITEJŠI žeton amber/40 (okno okoli časovnice)', () => {
    const vrstica = oknoOkoli(src, 'rounded-lg border border-border/60 p-3', 6)
    expect(vrstica).toContain(VRSTICA_ZETON)
  })

  it('hierarhija preverba: žetona sta roksal in /40 > /30 (ravnina kontejner → vrstica)', () => {
    expect(BLOK_ZETON).toMatch(/^transition-colors hover:border-roksal-amber\/\d+$/)
    expect(VRSTICA_ZETON).toMatch(/^transition-colors hover:border-roksal-amber\/\d+$/)
    expect(src).not.toMatch(/hover:border-amber-\d+/)
    const blokNivo = Number(BLOK_ZETON.match(/amber\/(\d+)/)?.[1])
    const vrsticaNivo = Number(VRSTICA_ZETON.match(/amber\/(\d+)/)?.[1])
    expect(vrsticaNivo).toBeGreaterThan(blokNivo)
  })

  it('ODRNJENA regresija: vodja val 11/12 register ostaja ×4/×4 (nov panel NE sme premakniti vodje)', () => {
    expect(vodja.split(BLOK_ZETON).length - 1).toBe(4)
    expect(vodja.split(VRSTICA_ZETON).length - 1).toBe(4)
  })

  it('izvozni gumb: press-scale + ring navy/40 (amber/50 register je zaklenjen v vodjo) + taktilen dokaz', () => {
    const gumb = oknoOkoli(src, 'aria-label="Izvozi zgodovino cen materiala kot CSV"', 8)
    expect(gumb).toContain('press-scale')
    expect(gumb).toContain('focus-visible:ring-2 focus-visible:ring-roksal-navy/40')
    expect(gumb).not.toContain('focus-visible:ring-roksal-amber/50')
    expect(globals).toContain('.press-scale {')
  })
})
