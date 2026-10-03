// R350 — MANDATORY STIL val 33: a11y parity skupinske akcije / izbira
// (bulk toolbar). LEKCIJA R346 kanon: izrecen focus ring navy/40 V ISTEM
// commitu kot novi aria/title; 0 novih hex (navy/40 = obstoječi token).
// ---------------------------------------------------------------------------
//  • val 31 (R348) je pokril 'Izvozi izbrane CSV' v ISTI orodni vrstici —
//    val 33 zaključi parity: 4 preostala brata (Izberi vse / Počisti /
//    Kopiraj / Izbriši izbrane) dobi aria-label + title + ring;
//  • obrnjene regresije: val 31/val 32 needleji ostanejo ŽIVO (nič
//    oslabitve obstoječe parity).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const TAB = join(process.cwd(), 'src/components/roksal/measurements-tab.tsx')
const tab = readFileSync(TAB, 'utf8')

const RING = 'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-roksal-navy/40'

describe('r350 stil val 33 — bulk orodna vrstica a11y parity (4 gumba)', () => {
  it('Izberi vse: aria-label + title', () => {
    expect(tab).toContain('aria-label="Izberi vse vidne meritve za skupinske akcije"')
    expect(tab).toContain('title="Izberi vse meritve vidnega (filtriranega) seznama"')
  })

  it('Počisti izbor: aria-label + title', () => {
    expect(tab).toContain('aria-label="Počisti izbor izbranih meritev"')
    expect(tab).toContain('title="Odizbori vse izbrane meritve"')
  })

  it('Kopiraj v ciljni segment: aria-label + title (vidno besedilo NE razlaga cilja)', () => {
    expect(tab).toContain('aria-label="Kopiraj izbrane meritve v ciljni segment"')
    expect(tab).toContain('title="Kopiraj izbrane meritve v izbrani ciljni segment"')
  })

  it('Izbriši izbrane: aria-label + title', () => {
    expect(tab).toContain('aria-label="Izbriši izbrane meritve"')
    expect(tab).toContain('title="Trajno izbriši vse izbrane meritve"')
  })

  it('LEKCIJA R346 kanon: vsi 4 novi aria gumbi imajo izrecen ring navy/40 V ISTEM viru (4 pojitve ringa v bulk bloku + val 31 brat)', () => {
    // 4 NOVI ring razredi (vsak od novih gumbov) + 1 obstoječi (Izvozi izbrane
    // CSV iz val 31) = vsaj 5 pojavitev ring-roksal-navy/40 v tabu po val 33
    expect((tab.match(/ring-roksal-navy\/40/g) || []).length).toBeGreaterThanOrEqual(5)
    // strukturni dokaz: vsak novi aria-label je v istem <button> bloku kot RING
    for (const aria of [
      'aria-label="Izberi vse vidne meritve za skupinske akcije"',
      'aria-label="Počisti izbor izbranih meritev"',
      'aria-label="Kopiraj izbrane meritve v ciljni segment"',
      'aria-label="Izbriši izbrane meritve"',
    ]) {
      const i = tab.indexOf(aria)
      expect(i).toBeGreaterThanOrEqual(0)
      const blok = tab.slice(Math.max(0, i - 400), i + 200)
      expect(blok).toContain(RING)
    }
  })

  it('0 novih hex: navy/40 token je obstoječi razred, brez hex literalov v novih razredih', () => {
    for (const aria of [
      'aria-label="Izberi vse vidne meritve za skupinske akcije"',
      'aria-label="Počisti izbor izbranih meritev"',
      'aria-label="Kopiraj izbrane meritve v ciljni segment"',
      'aria-label="Izbriši izbrane meritve"',
    ]) {
      const i = tab.indexOf(aria)
      const blok = tab.slice(Math.max(0, i - 400), i + 200)
      expect(blok).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    }
  })

  it('obrnjena regresija val 31: Izvozi izbrane CSV parity ostaja ŽIVO', () => {
    expect(tab).toContain('aria-label="Izvozi izbrane meritve kot CSV"')
    expect(tab).toContain('title="Izvozi samo izbrane meritve kot CSV za Excel"')
  })

  it('obrnjena regresija val 32: akcijski gumbi parity ostane ŽIVO (predloga apply / stopnična / enota)', () => {
    expect(tab).toContain('Naloži predlogo meritev: ')
    expect(tab).toContain('Naloži stopnično predlogo: ')
    expect(tab).toContain('Nastavi glavno enoto: ')
  })
})
