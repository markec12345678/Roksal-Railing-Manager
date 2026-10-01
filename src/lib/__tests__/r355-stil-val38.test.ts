// R355 — MANDATORY STIL val 38: a11y izvozne družine — KATALOG pill na vodji
// (65. člen): polni katalog zmožnosti (§11) kot CSV; bratska simetrija z
// CSV/PDF sosedom (ISTI žetoni — amber/50 izvozna družina vodje, val 8
// stražar register) + aria-label akcija+cilj + title (LEKCIJA R346 kanon,
// R291/R293 precedens). 0 novih hex.
// Obrnjene regresije: audit CSV/PDF + AI-raba CSV pill ostanejo ŽIVO;
// amber/50 ×13 + press-scale ×19 (pini posodobljeni s zgodovino).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const VODJA = readFileSync(join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx'), 'utf8')

const RING_AMBER = 'focus-visible:ring-roksal-amber/50'
const A_KATALOG = 'aria-label="Izvozi polni katalog avtomatizacijskih zmožnosti kot CSV"'

/** Okno okoli anchorja (pill blok = Button element od onClick do </Button>). */
function pillBlok(vir: string, anchor: string): string {
  const i = vir.indexOf(anchor)
  expect(i, anchor).toBeGreaterThanOrEqual(0)
  const zac = vir.lastIndexOf('<Button', i)
  const kon = vir.indexOf('</Button>', i)
  return vir.slice(zac, kon + 9)
}

describe('r355 stil val 38 — a11y izvozna družina: KATALOG pill (65. člen)', () => {
  it('(1) KATALOG pill: aria-label (akcija + cilj) + title (dokaz brez AI) v ISTEM Button bloku', () => {
    expect(VODJA).toContain(A_KATALOG)
    const blok = pillBlok(VODJA, A_KATALOG)
    expect(blok).toContain('title="Izvozi polni katalog zmožnosti (§11 — ENA vrstica na zmožnost; AI vnosi z razrešenim nadomestkom — dokaz \'jedro deluje brez AI\') kot deterministični CSV"')
    expect(blok).toContain('onClick={exportAvtomatizacijaKatalogCsv}')
  })

  it('(2) bratska simetrija: KATALOG pill nosi ISTE žetone kot sosedja (amber/50 ring + ring-offset + press-scale)', () => {
    const blok = pillBlok(VODJA, A_KATALOG)
    expect(blok).toContain(RING_AMBER)
    expect(blok).toContain('focus-visible:ring-offset-2')
    expect(blok).toContain('press-scale')
    // trije bratje v istem bloku glave (CSV + PDF + KATALOG)
    expect(VODJA).toContain('aria-label="Izvozi avtomatizacijski audit kot CSV"')
    expect(VODJA).toContain('aria-label="Izvozi avtomatizacijski audit kot PDF"')
  })

  it('(3) vodja amber/50 register ×13 (12 pill + 1 okno; R355 +1 KATALOG pill)', () => {
    expect(VODJA.split(RING_AMBER).length - 1).toBe(13)
  })

  it('(4) vodja taktilni register ×19 (press-scale; R355 +1 KATALOG)', () => {
    expect(VODJA.split('press-scale').length - 1).toBe(19)
  })

  it('(5) toast naslov VERBATIM + fail-verbose catch (kanon izvozne družine)', () => {
    expect(VODJA).toContain("toast({ title: 'Avtomatizacijski katalog izvožen ✓', description: avtomatizacijaKatalogCsvFilename() })")
    // handler ima fail-verbose catch (razlog vidno, ne tiho)
    const i = VODJA.indexOf('function exportAvtomatizacijaKatalogCsv')
    const okno = VODJA.slice(i, i + 1200)
    expect(okno).toContain("title: 'Izvoz ni uspel'")
    expect(okno).toContain('e instanceof Error ? e.message : String(e)')
  })

  it('(6) obrnjena regresija: AI-raba CSV pill (R337) + dnevni CSV (R163) aria ostanejo ŽIVO', () => {
    expect(VODJA).toContain('aria-label="Izvozi pregled AI rabe kot CSV"')
    expect(VODJA).toContain('aria-label="Izvozi dnevni pregled vodje kot CSV"')
  })

  it('(7) 0 novih hex: KATALOG pill blok + handler brez hex literalov (token razredi)', () => {
    const blok = pillBlok(VODJA, A_KATALOG)
    expect(blok.match(/#[0-9a-fA-F]{3,8}\b/)).toBeNull()
    const i = VODJA.indexOf('function exportAvtomatizacijaKatalogCsv')
    expect(VODJA.slice(i, i + 1200).match(/#[0-9a-fA-F]{3,8}\b/)).toBeNull()
  })

  it('(8) zgodovina v viru: 65. člen označen na obeh mestih (vodja + lib)', () => {
    expect(VODJA).toContain('R355 (65. člen')
    const modul = readFileSync(join(process.cwd(), 'src/lib/avtomatizacija-katalog-csv.ts'), 'utf8')
    expect(modul).toContain('R355 — 65. člen issue #1')
  })
})
