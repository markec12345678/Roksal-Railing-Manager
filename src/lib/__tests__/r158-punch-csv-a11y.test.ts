// R158 — testi (surovi <button> a11y stražar + izvoz zapisnika v CSV).
// ---------------------------------------------------------------------------
//   • REGRESIJSKI STRAŽAR: skener je razširjen na SUROVE <button> elemente
//     (R157 je pokril samo shadcn <Button>) — vsak ikonski gumb v roksal
//     komponentah MORA imeti aria-label/aria-labelledby (R158 je zaprl 11
//     takih na measurements/photo/calculator/dashboard).
//   • lib/punch-csv: BOM, glava, status preslikan v ISTA besedila kot UI
//     (Odprto/Rešeno/Napaka), neznan status → fail-closed TypeError,
//     escape navedkov, null opomba → prazen stolpec, deterministično ime.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { iconOnlyButtonsWithoutLabel } from '@/lib/a11y-scan'
import {
  buildPunchCsv,
  punchCsvFilename,
  PUNCH_STATUS_LABELS,
  type PunchCsvRow,
} from '@/lib/punch-csv'

// ---------------------------------------------------------------------------
// 1) A11Y STRAŽAR — surovi <button> elementi
// ---------------------------------------------------------------------------

describe('R158 regresijski stražar — surovi ikonski <button> gumbi', () => {
  it('noben ikonski surovi <button> v roksal komponentah ni brez aria-label', () => {
    const dir = join(process.cwd(), 'src', 'components', 'roksal')
    const files = readdirSync(dir).filter((f) => f.endsWith('.tsx'))
    const offenders: string[] = []
    for (const f of files) {
      const src = readFileSync(join(dir, f), 'utf8')
      const found = iconOnlyButtonsWithoutLabel(src, f).filter((o) => o.tag === '<button')
      for (const o of found) offenders.push(`${f}:${o.line}`)
    }
    expect(offenders).toEqual([])
  })
})

describe('R158 a11y-scan enote', () => {
  it('prepozna ikonski <Button> in surovi <button> brez aria-label', () => {
    const src = [
      '<Button size="icon" onClick={f}><X /></Button>',
      '<button type="button" onClick={g}><Trash2 /></button>',
      '<button type="button">Počisti</button>',
      '<Button size="icon" aria-label="Ok"><X /></Button>',
    ].join('\n')
    const found = iconOnlyButtonsWithoutLabel(src)
    expect(found).toHaveLength(2)
    expect(found[0].tag).toBe('<Button')
    expect(found[1].tag).toBe('<button')
  })

  it('ne lažno javi gumba z besedilom v fragmentih ali ternariju', () => {
    const src = [
      '<button onClick={a}>{cond ? (<>Ustavi merjenje</>) : (<>Nadaljuj</>)}</button>',
      '<Button>{action.label}</Button>',
      '<button>{tipMeritveLabels[tip]}</button>',
    ].join('\n')
    expect(iconOnlyButtonsWithoutLabel(src)).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// 2) buildPunchCsv — determinističen, iskren izvoz zapisnika
// ---------------------------------------------------------------------------

const base: PunchCsvRow = {
  naslov: 'Urejena meja z sosedom (geodetski zaznam)',
  opomba: 'Preveri zaznamovanje meje pred izkopom',
  status: 'open',
  createdAt: '2026-09-26T08:30:00.000Z',
}

describe('R158 buildPunchCsv', () => {
  it('vsebuje BOM, glavo in vrstico s statusom Odprto', () => {
    const { csv, vrstic } = buildPunchCsv([base])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('Datum,Naslov,Status,Opomba')
    expect(vrstic).toBe(1)
    expect(csv).toContain('"Urejena meja z sosedom (geodetski zaznam)","Odprto"')
  })

  it('preslika vse tri statuse v ISTA besedila kot UI (STATUS_META)', () => {
    expect(PUNCH_STATUS_LABELS).toEqual({ open: 'Odprto', done: 'Rešeno', issue: 'Napaka' })
    const { csv } = buildPunchCsv([
      { ...base, status: 'open' },
      { ...base, status: 'done' },
      { ...base, status: 'issue' },
    ])
    expect(csv).toContain('"Rešeno"')
    expect(csv).toContain('"Napaka"')
    expect(csv).toContain('"Odprto"')
  })

  it('je determinističen — dva klica na istih podatkih data enak izhod', () => {
    const rows = [base, { ...base, status: 'done' as const }]
    expect(buildPunchCsv(rows)).toEqual(buildPunchCsv(rows))
  })

  it('escape navedkov v naslovu in opombi (CSV injekcija varna)', () => {
    const { csv } = buildPunchCsv([
      { ...base, naslov: 'Panel "specijal" 12m', opomba: 'opomba z "naveki"' },
    ])
    expect(csv).toContain('"Panel ""specijal"" 12m"')
    expect(csv).toContain('"opomba z ""naveki"""')
  })

  it('null opomba → prazen stolpec, ne "null" besedilo', () => {
    const { csv } = buildPunchCsv([{ ...base, opomba: null }])
    expect(csv).not.toContain('"null"')
  })

  it('prazno polje → samo glava, vrstic 0', () => {
    const { csv, vrstic } = buildPunchCsv([])
    expect(csv).toBe('\uFEFFDatum,Naslov,Status,Opomba')
    expect(vrstic).toBe(0)
  })

  it('fail-closed: neznan status, pokvarjen datum, prazen naslov → TypeError', () => {
    expect(() =>
      buildPunchCsv([{ ...base, status: 'NEZNAN' as unknown as PunchCsvRow['status'] }]),
    ).toThrow(TypeError)
    expect(() => buildPunchCsv([{ ...base, createdAt: 'ni-datum' }])).toThrow(TypeError)
    expect(() => buildPunchCsv([{ ...base, naslov: '  ' }])).toThrow(TypeError)
    expect(() => buildPunchCsv('ne-polje' as unknown as PunchCsvRow[])).toThrow(TypeError)
  })
})

describe('R158 punchCsvFilename', () => {
  it('deterministično ime: zapisnik_<projectId>_<YYYY-MM-DD>.csv', () => {
    expect(punchCsvFilename('proj-9', '2026-09-26')).toBe('zapisnik_proj-9_2026-09-26.csv')
  })

  it('fail-closed: brez projectId ali slaba oblika datuma → TypeError', () => {
    expect(() => punchCsvFilename('', '2026-09-26')).toThrow(TypeError)
    expect(() => punchCsvFilename('p', '26.09.2026')).toThrow(TypeError)
  })
})
