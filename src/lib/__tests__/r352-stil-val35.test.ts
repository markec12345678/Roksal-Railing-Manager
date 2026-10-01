// R352 — MANDATORY STIL val 35: a11y parity dialog "Shrani" bratov
// (logistika razpored/ekipa/oprema + materialna inteligenca dobavitelj).
// LEKCIJA R346 kanon: vidno besedilo "Shrani" NE razlaga CILJA → aria-label
// (akcija + cilj) + title + izrecen focus ring navy/40 V ISTEM commitu;
// 0 novih hex (navy/40 = obstoječi token).
// ---------------------------------------------------------------------------
//  • obrnjene regresije: val 33/34 needleji ostanejo ŽIVO (nič oslabitve);
//  • 2 brata sta dobila NOV ring (ekipa, dobavitelj — prej brez), 2 sta ga
//    ŽE nosila (razpored, oprema — prej val 30/32 parity).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const LOGISTIKA = join(process.cwd(), 'src/components/roksal/logistics-tab.tsx')
const MATERIAL = join(process.cwd(), 'src/components/roksal/material-intelligence-tab.tsx')
const MERITVE = join(process.cwd(), 'src/components/roksal/measurements-tab.tsx')
const logistika = readFileSync(LOGISTIKA, 'utf8')
const material = readFileSync(MATERIAL, 'utf8')
const meritve = readFileSync(MERITVE, 'utf8')

const RING = 'focus-visible:ring-2 focus-visible:ring-roksal-navy/40'

/** Strukturni dokaz: aria-label, title in ring v ISTEM Button bloku. */
function bratBlok(vir: string, aria: string): string {
  const i = vir.indexOf(`aria-label="${aria}"`)
  expect(i, aria).toBeGreaterThanOrEqual(0)
  return vir.slice(Math.max(0, i - 120), i + 420)
}

describe('r352 stil val 35 — dialog Shrani a11y parity (4 bratje)', () => {
  it('razpored (logistika): aria-label + title razlagata CILJ (nov razpored v proizvodnjo)', () => {
    expect(logistika).toContain('aria-label="Shrani nov razpored"')
    expect(logistika).toContain('title="Shrani nov razpored v proizvodnjo"')
  })

  it('ekipa (logistika): aria-label + title + NOV izrecen ring (prej brez ringa)', () => {
    expect(logistika).toContain('aria-label="Shrani novo ekipo"')
    expect(logistika).toContain('title="Shrani novo ekipo v proizvodnjo"')
    const blok = bratBlok(logistika, 'Shrani novo ekipo')
    expect(blok).toContain(RING)
  })

  it('oprema (logistika): aria-label + title razlagata CILJ (nova oprema v zalogo)', () => {
    expect(logistika).toContain('aria-label="Shrani novo opremo"')
    expect(logistika).toContain('title="Shrani novo opremo v zalogo opreme"')
  })

  it('dobavitelj (material): aria-label + title + NOV izrecen ring (prej brez ringa)', () => {
    expect(material).toContain('aria-label="Shrani novega dobavitelja"')
    expect(material).toContain('title="Shrani novega dobavitelja v register dobaviteljev"')
    const blok = bratBlok(material, 'Shrani novega dobavitelja')
    expect(blok).toContain(RING)
  })

  it('LEKCIJA R346 kanon: VSI 4 bratje — aria-label + title + ring v ISTEM Button bloku', () => {
    for (const [vir, aria] of [
      [logistika, 'Shrani nov razpored'],
      [logistika, 'Shrani novo ekipo'],
      [logistika, 'Shrani novo opremo'],
      [material, 'Shrani novega dobavitelja'],
    ] as const) {
      const blok = bratBlok(vir, aria)
      expect(blok, aria).toContain(RING)
      expect(blok, aria).toMatch(/title="[^"]+"/)
      expect(blok, aria).toContain('>Shrani</Button>')
    }
  })

  it('0 novih hex: token razredi brez hex literalov v vseh 4 blokih', () => {
    for (const [vir, aria] of [
      [logistika, 'Shrani nov razpored'],
      [logistika, 'Shrani novo ekipo'],
      [logistika, 'Shrani novo opremo'],
      [material, 'Shrani novega dobavitelja'],
    ] as const) {
      expect(bratBlok(vir, aria), aria).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    }
  })

  it('obrnjena regresija val 34: filter čipi parity ostane ŽIVO', () => {
    expect(meritve).toContain('aria-pressed={isActive}')
    expect(meritve).toContain('Filtriraj po statusu: ')
    expect(meritve).toContain('Foto mere filter: prikaži samo meritve zajete na foto zavihku')
  })

  it('obrnjena regresija val 33: bulk orodna vrstica parity ostane ŽIVO', () => {
    expect(meritve).toContain('aria-label="Izberi vse vidne meritve za skupinske akcije"')
    expect(meritve).toContain('aria-label="Izbriši izbrane meritve"')
  })
})
