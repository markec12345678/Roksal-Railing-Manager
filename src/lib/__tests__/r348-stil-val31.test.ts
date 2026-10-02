// R348 — MANDATORY STIL val 31 (val 25–30 vzorec): a11y parity izvozne
// družine meritev.
// ---------------------------------------------------------------------------
//  • vzorec R291/R293 a11y družina + val 25–30 parity: 5 izvoznih gumbov
//    meritev je nosilo NIKOLI razloženih akcij (samo "CSV"/"PDF" oziroma
//    goli Button) — R186/R269/R284/R285 bratje so vodje z aria+title+ring;
//  • 4 gumbov v tabu (CSV vse / PDF / bulk CSV / zgodovina CSV) → aria-label
//    + title; 3 goli <button> → še izrecen focus ring navy/40 (kanon
//    LEKCIJA R346 val 29: družinski sken razkrije manjkajoč ring);
//  • steber-table CSV gumb (onExportCsv) → aria + title + ring;
//  • 0 novih hex (0-hex kanon val 15–30) — val 31 = samo aria/title/ring;
//  • obrnjene regresije: R186/R269/R284/R285 vodje ŽIVO + val 30/28 kalkulator.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const TAB = join(process.cwd(), 'src/components/roksal/measurements-tab.tsx')
const STEBER = join(process.cwd(), 'src/components/roksal/measurements/steber-table.tsx')

const tab = readFileSync(TAB, 'utf8')
const steber = readFileSync(STEBER, 'utf8')

const RING = 'focus-visible:ring-2 focus-visible:ring-roksal-navy/40'

/** Pomožnica: okno JSX bloka okoli onClick dispečerja (vzorec r347 val 30). */
function oknoOkoli(vir: string, dejnik: string, dolzina = 600): string {
  const i = vir.indexOf(dejnik)
  expect(i).toBeGreaterThan(-1)
  return vir.slice(i, i + dolzina)
}

describe('r348 STIL val 31 — a11y parity izvozne družine meritev', () => {
  it('CSV vse meritve: aria + title + izrecen ring', () => {
    // PIN SHIFT R375 val 57 (INS +76 znakov na vrstici className — razdalja
    // anchor→title 528→604; okno 600→700, headroom 96; LEKCIJA R369 (2) +
    // R375: oknoOkoli SLICE okna niso regex — window-scan jih ne vidi,
    // FULL vitest je mreža)
    const okno = oknoOkoli(tab, 'onClick={handleExportCSV}', 700)
    expect(okno).toContain('aria-label="Izvozi vse meritve kot CSV"')
    expect(okno).toContain('title="Izvozi VSE meritve projekta (brez filtra) kot CSV za Excel"')
    expect(okno).toContain(RING)
  })

  it('PDF pregled meritev: aria + title + izrecen ring (amber brat, navy ring kanon)', () => {
    const okno = oknoOkoli(tab, 'onClick={handleExportPDF}')
    expect(okno).toContain('aria-label="Izvozi pregled meritev kot PDF"')
    expect(okno).toContain('title="Pregled vseh meritev projekta kot PDF za arhiv"')
    expect(okno).toContain(RING)
  })

  it('bulk CSV izbrane: aria + title + izrecen ring (disabled ohranjen)', () => {
    // R364: okno 600→800 — val 47 ring-only className razširitev (+28 znakov)
    // je title potisnil iz okna (LEKCIJA R359: test okno ≥800 ob dolgih
    // className verigah; precedens R359 lastna okna 400→500/800).
    const okno = oknoOkoli(tab, 'onClick={handleBulkExportCSV}', 800)
    expect(okno).toContain('aria-label="Izvozi izbrane meritve kot CSV"')
    expect(okno).toContain('title="Izvozi samo izbrane meritve kot CSV za Excel"')
    expect(okno).toContain(RING)
    expect(okno).toContain('disabled={selectedIds.size === 0}')
  })

  it('zgodovina CSV (shadcn Button): aria + title', () => {
    const okno = oknoOkoli(tab, 'onClick={handleExportAuditCSV}')
    expect(okno).toContain('aria-label="Izvozi zgodovino meritev kot CSV"')
    expect(okno).toContain('title="Revizijska zgodovina meritev (akcije, statusi) kot CSV"')
  })

  it('steber-table CSV: aria + title + izrecen ring', () => {
    const okno = oknoOkoli(steber, 'onClick={onExportCsv}')
    expect(okno).toContain('aria-label="Izvozi preglednico stebrov kot CSV"')
    expect(okno).toContain('title="Izvozi stebre tega segmenta kot CSV za Excel"')
    expect(okno).toContain(RING)
  })

  it('0 novih hex: val 31 ne uvaja barv (samo aria/title/ring razredi)', () => {
    for (const dejnik of ['onClick={handleExportCSV}', 'onClick={handleExportPDF}', 'onClick={handleBulkExportCSV}']) {
      const okno = oknoOkoli(tab, dejnik)
      expect(okno).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    }
    expect(steber).not.toMatch(/#[0-9a-fA-F]{6}\b/)
  })

  it('obrnjena regresija — vodje družine ŽIVO (R186/R269/R284/R285)', () => {
    expect(tab).toContain('aria-label="Izvozi vidne meritve kot CSV"')
    expect(tab).toContain('title="Izvozi vidne meritve (upošteva filter) kot CSV za Excel"')
    expect(tab).toContain('aria-label="Izvozi terenski pregled meritev kot PDF"')
    expect(tab).toContain('aria-label="Izvozi terenski zapisni list kot PDF"')
    expect(tab).toContain('aria-label="Izvozi terenski zapisni list kot CSV"')
  })

  it('obrnjena regresija — kalkulator val 30/28 parity nizi ŽIVO (nedotaknjeni)', () => {
    const calc = readFileSync(
      join(process.cwd(), 'src/components/roksal/calculator-tab.tsx'),
      'utf8',
    )
    expect(calc).toContain('aria-label="Shrani trenutni izračun v shranjene izračune"')
    expect(calc).toContain('aria-label="Počisti vse shranjene izračune"')
    expect(calc).toContain('title="Izvoz zgodovine izračunov kot CSV datoteka"')
    expect(calc).toContain('aria-label="Počisti vse predloge"')
  })
})
