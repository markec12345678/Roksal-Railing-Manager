// R356 — MANDATORY STIL val 39: a11y parity FAZA 9 družine (4 gumbi v
// measurements-tab, isti obseg kot FAZA 9 orkestracija):
//   1. 'Dodaj stebriček v ta segment' (per-segment) — vidno besedilo NE
//      razlaga CILJA (odpre formo, že tarčno na segment) → aria akcija+cilj
//      (template literal s seg.name) + title + NOV izrecen ring navy/40;
//   2. 'Dodaj WPC palice kot materiale' — vidno besedilo NE pove cilja
//      (izračun iz meritev segmenta → meritev STEBR) → aria + title + NOV ring;
//   3. stopniščni čarovnik 'Ustvari meritve' — vidno besedilo NE pove katerih
//      meritev/kamor → aria + title + NOV ring;
//   4. steber submit 'Dodaj stebriček S#' — vidno besedilo ŽE ima akcijo+cilj
//      (S# dinamično) → title + NOV ring (aria NE dodana — brez dvojnega
//      besedila; LEKCIJA R346: posredovanje cilja le, ko ga vidno besedilo
//      NE nosi).
// LEKCIJA R346 kanon: ring string = val 36/37 kanon (navy/40 + offset-2);
// 0 novih hex (obstoječi žetoni). Obrnjena regresija: val 38 KATALOG pill
// (amber/50 ring izvozne družine) ostane ŽIVO — NI oslabitve.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const MERITVE = readFileSync(join(process.cwd(), 'src/components/roksal/measurements-tab.tsx'), 'utf8')
const VODJA = readFileSync(join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx'), 'utf8')

const RING = 'focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'

/** Strukturni dokaz: blok od aria/title oznake do zaključka gumba —
 *  aria + title + ring v ISTEM bloku (LEKCIJA R346: V ISTEM commitu). */
function blokOkoli(vir: string, igla: string): string {
  const i = vir.indexOf(igla)
  expect(i, igla).toBeGreaterThanOrEqual(0)
  return vir.slice(Math.max(0, i - 120), i + 480)
}

describe('r356 stil val 39 — a11y parity FAZA 9 družine (4 gumbi)', () => {
  it('(1) steber per-segment: aria akcija+cilj (segment name) + title + NOV ring v istem bloku', () => {
    expect(MERITVE).toContain('aria-label={`Dodaj stebriček v segment ${seg.name}`}')
    expect(MERITVE).toContain('title={`Odpre formo za novega stebrička, že tarčno na segment ${seg.name}`}')
    const blok = blokOkoli(MERITVE, 'aria-label={`Dodaj stebriček v segment ${seg.name}`}')
    expect(blok).toContain(RING)
  })

  it('(2) WPC palice: aria akcija+cilj (izračun → meritve v segment) + title + NOV ring v istem bloku', () => {
    expect(MERITVE).toContain('aria-label={`Dodaj izračunane WPC palice kot meritve v segment ${seg.name}`}')
    expect(MERITVE).toContain('title={`Izračuna št. WPC palic iz meritev segmenta ${seg.name} in jih doda kot meritev STEBR`}')
    const blok = blokOkoli(MERITVE, 'aria-label={`Dodaj izračunane WPC palice kot meritve v segment ${seg.name}`}')
    expect(blok).toContain(RING)
  })

  it('(3) stopniščni čarovnik Ustvari meritve: aria akcija+cilj + title + NOV ring v istem bloku', () => {
    expect(MERITVE).toContain('aria-label="Ustvari stopniščne meritve v izbrani segment"')
    expect(MERITVE).toContain('title="Ustvari 5 meritev čarovnika (višina, globina, kot, kos, št. stopnic) v izbrani segment"')
    const blok = blokOkoli(MERITVE, 'aria-label="Ustvari stopniščne meritve v izbrani segment"')
    expect(blok).toContain(RING)
  })

  it('(4) steber submit: title + NOV ring; vidno besedilo ŽE nosi akcija+cilj (S#) — brez dvojnega aria besedila', () => {
    expect(MERITVE).toContain('title="Dodaj meritve STEBR z izračunom pozicije in vrstno oznako"')
    const blok = blokOkoli(MERITVE, 'title="Dodaj meritve STEBR z izračunom pozicije in vrstno oznako"')
    expect(blok).toContain(RING)
    expect(blok).not.toContain('aria-label=')
  })

  it('(5) ring kanon: natanko val 36/37 string (navy/40 + offset-2) v vseh 4 blokih — brez družinskega odmika', () => {
    // 4 pojavitve = 4 val 39 gumbi; vsaka ima IDENTEN kanon string.
    expect(MERITVE.match(new RegExp(RING.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))?.length).toBeGreaterThanOrEqual(4)
    expect(MERITVE).not.toContain('focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2')
  })

  it('(6) 0 novih hex: vsi 4 bloki uporabljajo žetone (amber/40, amber/50, navy, roksal-ink) — brez raw hex', () => {
    for (const igla of [
      'aria-label={`Dodaj stebriček v segment ${seg.name}`}',
      'aria-label={`Dodaj izračunane WPC palice kot meritve v segment ${seg.name}`}',
      'aria-label="Ustvari stopniščne meritve v izbrani segment"',
      'title="Dodaj meritve STEBR z izračunom pozicije in vrstno oznako"',
    ]) {
      expect(blokOkoli(MERITVE, igla).match(/#[0-9a-fA-F]{6}\b/)).toBeNull()
    }
  })

  it('(7) obrnjena regresija val 38: KATALOG pill (amber/50 izvozna družina vodje) ostane ŽIVO', () => {
    expect(VODJA).toContain('aria-label="Izvozi polni katalog avtomatizacijskih zmožnosti kot CSV"')
    expect(VODJA).toContain('focus-visible:ring-roksal-amber/50')
  })

  it('(8) zgodovina: val 39 komentar z LEKCIJO R346 referenco prisoten v tabu (institucionalni spomin)', () => {
    expect(MERITVE).toContain('R356 val 39')
    expect(MERITVE).toContain('LEKCIJA R346')
  })
})
