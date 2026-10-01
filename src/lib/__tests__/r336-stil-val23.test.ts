// R336 — MANDATORY STIL val 23 (r162/…/R335 vzorec): sistem zdravje CSV pill
// (63. člen — SistemZdravjeCard, zadnja vodja kartica brez izvoza).
// ---------------------------------------------------------------------------
//  • pill = navy/40 družina (val20 Material precedens — gumb v SESTAVLJENI
//    kartici sistem-zdravje-card.tsx, izven vodja-dashboard datoteke →
//    amber/50 register OSTANE zaklenjen v vodji ×10, val8 drevo 69);
//  • taktilni žeton press-scale (val9 vzorec) — kartica NI v vodja-dashboard
//    števcu (17 pojavitev v R336 — register file-scoped);
//    [R337: vodja register 17 → 18 — AI raba CSV pill JE v vodji; kartičin
//    prispevek NEPROMENJEN]
//  • oči para: FileSpreadsheet aria-hidden (CSV brat družina R323/R334/R335);
//  • definicijski naslov medija (title) + legenda medija (starejši podpisi
//    NEPREMIKNJENI);
//  • EN VIR žeton: kartica UVAŽA BAZA_NIZ + graditelja (nič podvojenih nizov);
//  • obrnjena regresija: val 22 PAR ŽIVA + val 21 TRIADA ŽIVA + globals
//    .press-scale ŽIV + 0 surovih barv na novi pill (0-hex kanon val 15–22).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const KARTICA = join(process.cwd(), 'src/components/roksal/sistem-zdravje-card.tsx')
const VODJA = join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx')
const GLOBALS = join(process.cwd(), 'src/app/globals.css')
const VAL8 = join(process.cwd(), 'src/lib/__tests__/r317-stil-val8.test.ts')

const src = readFileSync(KARTICA, 'utf8')
const vodja = readFileSync(VODJA, 'utf8')
const globals = readFileSync(GLOBALS, 'utf8')
const val8 = readFileSync(VAL8, 'utf8')

/** Okno vrstic okoli iskanega niza (ISTA ekstrakcija kot val8 STRAŽAR). */
function oknoOkoli(vir: string, iskalni: string): string {
  const vrstice = vir.split('\n')
  const i = vrstice.findIndex((v) => v.includes(iskalni))
  if (i < 0) return ''
  return vrstice.slice(Math.max(0, i - 8), i + 6).join('\n')
}

describe('r336 STIL val 23 — sistem zdravje CSV pill: navy/40 družina + taktilna + a11y', () => {
  it('pill viden: aria + testid + FileSpreadsheet aria-hidden (oči para CSV bratov)', () => {
    const gumb = oknoOkoli(src, 'aria-label="Izvozi sistem zdravje kot CSV"')
    expect(gumb).toContain('data-testid="sistem-zdravje-csv-pill"')
    expect(gumb).toContain('<FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden="true" />')
    expect(gumb).toContain('variant="outline"')
    expect(gumb).toContain('onClick={handleZdravjeCsv}')
  })

  it('navy/40 ring token — byte paritet z val20 Material družino; amber/50 ODSOTEN (register zaklenjen v vodji)', () => {
    const gumb = oknoOkoli(src, 'aria-label="Izvozi sistem zdravje kot CSV"')
    // className VRSTICA (ne okno — komentarji omenjajo register, NE stil)
    const razred = gumb.split('\n').find((v) => v.includes('className='))
    expect(razred).toContain(
      'press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:outline-none',
    )
    expect(razred?.includes('amber')).toBe(false)
    expect(src.includes('focus-visible:ring-roksal-amber/50')).toBe(false)
  })

  it('taktilni žeton press-scale (val9 vzorec) — vodja register ×18 (R337 PIN SHIFT 17 → 18; kartičin prispevek NEPROMENJEN)', () => {
    const gumb = oknoOkoli(src, 'aria-label="Izvozi sistem zdravje kot CSV"')
    expect(gumb).toContain('press-scale')
    // vodja-dashboard števec 18 (R337 AI raba CSV pill v vodji — R336 pill
    // je še vedo v kartici, ven iz vodja števcu)
    expect(vodja.split('press-scale').length - 1).toBe(18)
  })

  it('definicijski naslov medija (title) — ista resnica, iskren fail-closed, Excel razlika medija', () => {
    const gumb = oknoOkoli(src, 'aria-label="Izvozi sistem zdravje kot CSV"')
    expect(gumb).toContain('title="Izvozi sistem zdravje (iste meritve odzivnih časov te seje) kot CSV za Excel')
    expect(gumb).toContain('prazna/pokvarena zgodovina → iskren toast')
    expect(gumb).toContain('zaslon in CSV = ista resnica')
  })

  it('legenda medija ŽIVA + starejši podpisi NEPREMIKNJENI (javna sonda izpis ostaja)', () => {
    expect(src).toContain('Zdravje CSV = iste meritve te seje (Excel za arhiv in filtriranje).')
    expect(src).toContain('Javna sonda /api/public/health — pinguje bazo (3 s vrata).')
  })

  it('EN VIR žeton: kartica UVAŽA BAZA_NIZ + graditelja — nič podvojenih nizov', () => {
    expect(src).toContain("from '@/lib/sistem-zdravje-csv'")
    expect(src).toContain('BAZA_NIZ,')
    expect(src).toContain('sistemZdravjeCsvFilename()')
    // žeton niz pride IZ liba (nič inline literala v JSX besedilnem vozlišču —
    // anti-divergenca R335 vzorec; komentarji ne štejejo)
    expect(src.includes('{BAZA_NIZ}')).toBe(true)
    expect(src.match(/>\s*Baza odgovarja\s*</)).toBeNull()
  })

  it('obrnjena regresija: val 22 PAR ŽIVA (mesečni) + val 21 TRIADA ŽIVA (končna CSV) + globals .press-scale ŽIV', () => {
    // val 22: mesečni PAR (Poročilo PDF + Poročilo CSV) — amber/50 + offset-2 vodja
    expect(vodja).toContain('data-testid="vodja-mesecni-csv-pill"')
    // val 21: končna verifikacija TRIADA (JSON + PDF + CSV)
    expect(vodja).toContain('data-testid="koncna-verifikacija-csv-pill"')
    // globals anti-stale
    expect(globals).toContain('.press-scale {')
    expect(globals).toContain('transform: scale(0.97)')
  })

  it('register sodelovanje: val8 drevo 70 + R336/R337 PIN SHIFT zapisa (register resnica čez valove — LEKCIJA R334 5)', () => {
    expect(val8).toContain('R336 PIN SHIFT 68 → 69')
    expect(val8).toContain('R337 PIN SHIFT 69 → 70')
    expect(val8).toContain('expect(gumbi.length).toBeGreaterThanOrEqual(70)')
    expect(val8).toContain("g.okno.includes('Izvozi sistem zdravje kot CSV')")
    // 0 surovih barv na novi pill (0-hex kanon)
    const gumb = oknoOkoli(src, 'aria-label="Izvozi sistem zdravje kot CSV"')
    expect(gumb).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
