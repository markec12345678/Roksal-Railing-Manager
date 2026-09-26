// R157 — testi (dostopnost ikonskih gumbov + izvoz nagibov v CSV).
// ---------------------------------------------------------------------------
//   • REGRESIJSKI STRAŽAR: vsak <Button> SAMO z ikono (brez vidnega besedila)
//     v src/components/roksal MORA imeti aria-label ali aria-labelledby —
//     bralniki zaslona in uporabniki tipkovnice ne morejo ugotoviti, kaj gumb
//     počne (vzorec, ki ga je R157 odpravil na 20 mestih; R156 je istega
//     zaprl na CRM zavihku).
//   • lib/nagibi-csv: BOM, glava, escape navedkov, null/neznana smer →
//     prazen stolpec (iskrenost — brez ugibanja), deterministično ime
//     datoteke, fail-closed na pokvarjenih podatkih.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { buildNagibiCsv, nagibiCsvFilename, type NagibiCsvRow } from '@/lib/nagibi-csv'
import { iconOnlyButtonsWithoutLabel } from '@/lib/a11y-scan'

// ---------------------------------------------------------------------------
// 1) A11Y STRAŽAR — ikonski gumbi brez aria-label
// ---------------------------------------------------------------------------

describe('R157 regresijski stražar — ikonski gumbi morajo imeti aria-label', () => {
  it('noben ikonski <Button> v roksal komponentah ni brez aria-label/aria-labelledby', () => {
    const dir = join(process.cwd(), 'src', 'components', 'roksal')
    const files = readdirSync(dir).filter((f) => f.endsWith('.tsx'))
    const offenders: string[] = []
    for (const f of files) {
      const src = readFileSync(join(dir, f), 'utf8')
      // R158: skener razširjen na surove <button> elemente (lib a11y-scan)
      const found = iconOnlyButtonsWithoutLabel(src, f)
      for (const o of found) offenders.push(`${f}:${o.line}`)
    }
    expect(offenders).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 2) buildNagibiCsv — determinističen, iskren izvoz
// ---------------------------------------------------------------------------

const base: NagibiCsvRow = {
  kotStopinje: 2.34,
  smer: 'Y',
  lokacija: 'Talna plošča balkona',
  createdAt: '2026-09-26T08:30:00.000Z',
}

describe('R157 buildNagibiCsv', () => {
  it('vsebuje BOM, glavo in formatirane vrstice (sl-SI datum/ura, kot 1 decimalka)', () => {
    const { csv, vrstic } = buildNagibiCsv([base])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('Datum,Ura,Kot (stopinje),Smer,Lokacija')
    expect(vrstic).toBe(1)
    // 2.34 → "2.3"; smer Y → Levo-desno
    expect(csv).toContain('2.3,"Levo-desno","Talna plošča balkona"')
  })

  it('je determinističen — dva klica na istih podatkih data enak izhod', () => {
    const a = buildNagibiCsv([base, { ...base, kotStopinje: 1.05, smer: 'X' }])
    const b = buildNagibiCsv([base, { ...base, kotStopinje: 1.05, smer: 'X' }])
    expect(a).toEqual(b)
  })

  it('neznana/null smer → PRAZEN stolpec (iskrenost, brez ugibanja)', () => {
    const { csv } = buildNagibiCsv([{ ...base, smer: null }])
    expect(csv).toContain(',"",')
    const { csv: csv2 } = buildNagibiCsv([{ ...base, smer: 'Z' }])
    expect(csv2).toContain(',"",')
  })

  it('escape navedkov v lokaciji (CSV injekcija varna)', () => {
    const { csv } = buildNagibiCsv([{ ...base, lokacija: 'Tratnikov "posebni" kot' }])
    expect(csv).toContain('"Tratnikov ""posebni"" kot"')
  })

  it('null lokacija → prazen, ne "null" besedilo', () => {
    const { csv } = buildNagibiCsv([{ ...base, lokacija: null }])
    expect(csv).not.toContain('"null"')
  })

  it('prazno polje → samo glava, vrstic 0', () => {
    const { csv, vrstic } = buildNagibiCsv([])
    expect(csv).toBe('\uFEFFDatum,Ura,Kot (stopinje),Smer,Lokacija')
    expect(vrstic).toBe(0)
  })

  it('fail-closed: pokvarjen datum ali ne-finite kot → TypeError (ne tiho pokvarjen CSV)', () => {
    expect(() => buildNagibiCsv([{ ...base, createdAt: 'ni-datum' }])).toThrow(TypeError)
    expect(() => buildNagibiCsv([{ ...base, kotStopinje: Number.NaN }])).toThrow(TypeError)
    expect(() => buildNagibiCsv('ne-polje' as unknown as NagibiCsvRow[])).toThrow(TypeError)
  })
})

describe('R157 nagibiCsvFilename', () => {
  it('deterministično ime: nagibi_<projectId>_<YYYY-MM-DD>.csv', () => {
    expect(nagibiCsvFilename('proj-123', '2026-09-26')).toBe('nagibi_proj-123_2026-09-26.csv')
  })

  it('fail-closed: brez projectId ali slaba oblika datuma → TypeError', () => {
    expect(() => nagibiCsvFilename('', '2026-09-26')).toThrow(TypeError)
    expect(() => nagibiCsvFilename('proj', '26.09.2026')).toThrow(TypeError)
    expect(() => nagibiCsvFilename('proj', 'ne-datum')).toThrow(TypeError)
  })
})
