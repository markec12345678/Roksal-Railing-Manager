// R351 — MANDATORY STIL val 34: a11y parity filter čipi družine (status
// čipi ×4 + Foto mere pill). LEKCIJA R346 kanon: izrecen focus ring navy/40
// V ISTEM commitu; 0 novih hex (navy/40 = obstoječi token).
// ---------------------------------------------------------------------------
//  • REALNO a11y izboljšanje: aria-pressed (toggle stanje — bralnik zaslona
//    pove 'pritisnjeno/ne-pritisnjeno') + aria-label z countom + title;
//  • obrnjene regresije: val 31/32/33 needleji ostanejo ŽIVO (nič oslabitve).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const TAB = join(process.cwd(), 'src/components/roksal/measurements-tab.tsx')
const tab = readFileSync(TAB, 'utf8')

const RING = 'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-roksal-navy/40'

describe('r351 stil val 34 — filter čipi a11y parity (4 status čipi + Foto mere)', () => {
  it('status čipi: aria-pressed toggle stanje (bralnik zaslona pove stanje)', () => {
    expect(tab).toContain('aria-pressed={isActive}')
  })

  it('status čipi: aria-label template prefix + title template prefix (statični predponi deli)', () => {
    // statični predponi deli template literalov — minifikacija ohrani prefixe
    expect(tab).toContain('Filtriraj po statusu: ')
    expect(tab).toContain('Pokaži meritve statusa ')
    expect(tab).toContain("aria-label={`Filtriraj po statusu: ${label} (${count})`}")
    expect(tab).toContain("title={`Pokaži meritve statusa ${label} (${count})`}")
  })

  it('status čipi: izrecen ring navy/40 v ISTEM className (LEKCIJA R346 kanon)', () => {
    const i = tab.indexOf('aria-pressed={isActive}')
    expect(i).toBeGreaterThanOrEqual(0)
    const blok = tab.slice(Math.max(0, i - 200), i + 600)
    expect(blok).toContain(RING)
  })

  it('Foto mere pill: aria-pressed + NOV aria-label (vidno besedilo NE razlaga obsega filtra)', () => {
    expect(tab).toContain('aria-pressed={fotoFilterActive}')
    expect(tab).toContain('Foto mere filter: prikaži samo meritve zajete na foto zavihku')
    // obstoječi title pariteta ostane
    expect(tab).toContain('title="Filtriraj samo mere iz foto zavihka"')
  })

  it('Foto mere pill: izrecen ring navy/40 v ISTEM className', () => {
    const i = tab.indexOf('aria-pressed={fotoFilterActive}')
    expect(i).toBeGreaterThanOrEqual(0)
    const blok = tab.slice(Math.max(0, i - 200), i + 500)
    expect(blok).toContain(RING)
  })

  it('0 novih hex: navy/40 token je obstoječi razred, brez hex literalov v novih razredih', () => {
    for (const marker of ['aria-pressed={isActive}', 'aria-pressed={fotoFilterActive}']) {
      const i = tab.indexOf(marker)
      const blok = tab.slice(Math.max(0, i - 200), i + 500)
      expect(blok).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    }
  })

  it('obrnjena regresija val 33: bulk orodna vrstica parity ostane ŽIVO', () => {
    expect(tab).toContain('aria-label="Izberi vse vidne meritve za skupinske akcije"')
    expect(tab).toContain('aria-label="Kopiraj izbrane meritve v ciljni segment"')
    expect(tab).toContain('aria-label="Izbriši izbrane meritve"')
  })

  it('obrnjena regresija val 31/R186: izvozna družina parity ostane ŽIVO', () => {
    expect(tab).toContain('aria-label="Izvozi vidne meritve kot CSV"')
    expect(tab).toContain('aria-label="Izvozi izbrane meritve kot CSV"')
    expect(tab).toContain('aria-label="Kopiraj povzetek vidnih meritev v odložišče"')
  })
})
