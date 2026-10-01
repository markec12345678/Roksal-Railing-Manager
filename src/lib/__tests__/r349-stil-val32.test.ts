// R349 — MANDATORY STIL val 32 (vzorec R291/R293 + val 25–31): a11y parity
// AKCIJSKIH gumbov meritev, kjer vidno besedilo NE razlaga akcije:
//  (1) predloga meritev apply — vidno je IME predloge, akcija (nalaganje v
//      obrazec) je nevidna → aria 'Naloži predlogo meritev: {naziv}' + title
//      (parity val 29 kalkulator 'Naloži predlogo');
//  (2) hitro dodajanje — vidna je VRSTA mere, akcija je nevidna → aria
//      'Nova meritev: {tip}' + title (parity R203 'Nova meritev');
//  (3) glavna enota preklop — vidna je ENOTA, akcija je nevidna → aria
//      'Nastavi glavno enoto: {enota}' + title (parity R186 enota);
//  (4) stopnična predloga load — vidno je IME, akcija je nevidna → aria
//      'Naloži stopnično predlogo: {naziv}' + title (parity val 29).
// LEKCIJA R346 (val 8 stražar) kanon: vsak NOVI aria gumb dobi IZRECEN
// focus-visible ring V ISTEM commitu (navy/40 družinski žeton; amber/50
// register ostane zaklenjen v vodji). 0 novih hex (aria/title/ring razredi).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const komponenta = readFileSync(join(process.cwd(), 'src/components/roksal/measurements-tab.tsx'), 'utf8')

function oknoMed(vir: string, od: string, do_: string): string {
  const a = vir.indexOf(od)
  const b = vir.indexOf(do_, a + 1)
  expect(a).toBeGreaterThanOrEqual(0)
  expect(b).toBeGreaterThan(a)
  return vir.slice(a, b)
}

const RING = 'focus-visible:ring-2 focus-visible:ring-roksal-navy/40'

describe('r349 STIL val 32 — a11y parity akcijskih gumbov meritev', () => {
  it('(1) predloga meritev apply: aria + title (parity val 29 Naloži predlogo) + izrecen ring v istem oknu', () => {
    const okno = oknoMed(komponenta, 'onClick={() => handleApplyPredloga(p.id)}', '<Icon')
    expect(okno).toContain('aria-label={`Naloži predlogo meritev: ${p.naziv}`}')
    expect(okno).toContain('title="Naloži predlogo — zapolni vnosni obrazec z vrednostmi predloge"')
  })

  it('(1b) predloga apply nosi izrecen navy/40 ring (LEKCIJA R346: novi aria gumb = ring isti commit)', () => {
    const okno = oknoMed(komponenta, 'onClick={() => handleApplyPredloga(p.id)}', 'aria-label={`Naloži predlogo meritev: ${p.naziv}`}')
    expect(okno).toContain(RING)
  })

  it('(2) hitro dodajanje OBE mesti: aria + title (parity R203 Nova meritev) — replace_all ×2, nič podvojenega stale bloka', () => {
    expect(komponenta.split('aria-label={`Nova meritev: ${tipMeritveLabels[tip]}`}').length - 1).toBe(2)
    expect(komponenta.split('title={`Hitro dodaj novo meritev vrste ${tipMeritveLabels[tip]} v ta projekt`}').length - 1).toBe(2)
    expect(komponenta.split('onClick={() => handleQuickAdd(tip)}').length - 1).toBe(2)
  })

  it('(2b) hitro dodajanje nosi izrecen navy/40 ring na OBEH mestih', () => {
    const okna = komponenta.split('onClick={() => handleQuickAdd(tip)}').slice(1)
    for (const del of okna) {
      expect(del.slice(0, 600)).toContain(RING)
    }
  })

  it('(3) glavna enota preklop: aria + title (parity R186 enota) + izrecen ring', () => {
    const okno = oknoMed(komponenta, 'onClick={() => setPrimaryUnit(u)}', '</button>')
    expect(okno).toContain('aria-label={`Nastavi glavno enoto: ${enotaLabels[u]}`}')
    expect(okno).toContain('title="Glavna enota vseh vnosnih in prikaznih polj meritev"')
    expect(okno).toContain(RING)
  })

  it('(4) stopnična predloga load: aria + title (parity val 29) + izrecen ring', () => {
    const okno = oknoMed(komponenta, 'onClick={() => handleLoadStairTemplate(t)}', 'truncate')
    expect(okno).toContain('aria-label={`Naloži stopnično predlogo: ${t.naziv}`}')
    expect(okno).toContain('title="Naloži stopnično predlogo v vnosni obrazec"')
    expect(okno).toContain(RING)
  })

  it('0 novih hex (val 32 = aria/title/ring razredi — register barv se NE širi)', () => {
    const nove = komponenta.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
    expect(nove).toEqual([])
  })

  it('obrnjena regresija: val 31 izvozna družina meritev ŠE VEDNO ŽIVA (5 aria — 4 v tabu + steber-table v measurements/ mapi) + val 30 kalkulator (parity)', () => {
    const steber = readFileSync(join(process.cwd(), 'src/components/roksal/measurements/steber-table.tsx'), 'utf8')
    for (const [aria, vir] of [
      ['aria-label="Izvozi vse meritve kot CSV"', komponenta],
      ['aria-label="Izvozi pregled meritev kot PDF"', komponenta],
      ['aria-label="Izvozi izbrane meritve kot CSV"', komponenta],
      ['aria-label="Izvozi zgodovino meritev kot CSV"', komponenta],
      ['Izvozi preglednico stebrov kot CSV', steber],
    ] as const) {
      expect(vir).toContain(aria)
    }
    const kalkulator = readFileSync(join(process.cwd(), 'src/components/roksal/calculator-tab.tsx'), 'utf8')
    expect(kalkulator).toContain('Shrani trenutni izračun v shranjene izračune')
    expect(kalkulator).toContain('Počisti vse shranjene izračune')
  })
})
