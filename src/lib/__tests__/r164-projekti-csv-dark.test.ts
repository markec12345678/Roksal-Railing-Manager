// R164 — projekti-csv enote + regresija (izvoz seznama projektov) + DARK strazar.
// ---------------------------------------------------------------------------
// Družina izvozov (nagibi R157, zapisnik R158, CRM R159, ekipa R160, ponudbe
// R161, revizija R162, vodja R163) — isti standard: determinizem (2 klica =
// enak izhod), status besedila = ISTA kot UI (en vir resnice — PROJEKTI_STATUS_LABELS,
// dashboard-tab refaktoriran nanj), CSV injekcija zaščita, null → prazen
// stolpec (nikoli 'null' besedilo), fail-closed TypeError na pokvarjenih/
// neznanih podatkih, striktno ime datoteke, slovenska sklanjatev.
// Novost R164: izvoz NE vsebuje "dan do montaže" čipa (odvisen od trenutka —
// 'Danes' v CSV-ju prihodnji mesec = neresnica), ampak IZVORNO resnico čipa:
// datum montaže DD.MM.YYYY. DARK strazar: dashboard-tab (glavna površina,
// 2.5k+ vrstic) mora imeti dark: variante na statusColors NACRTOVANO, amber
// opozorilnih okvirjih, brez golih bg-white površin, fokus ringi na ikonskih
// gumbih (isti vzorec strazarjev R161–R163).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildProjektiCsv,
  projektiCsvFilename,
  projektiLabel,
  PROJEKTI_STATUS_LABELS,
  type ProjektiCsvRow,
} from '../projekti-csv'

const row = (over: Partial<ProjektiCsvRow> = {}): ProjektiCsvRow => ({
  nazivProjekta: 'Balkon Novak — Kranj',
  status: 'V_TEKU',
  strankaIme: 'Jure Novak',
  strankaNaslov: 'Cesta 4, Kranj',
  datumMontaze: '2026-10-15T08:00:00.000Z',
  ...over,
})

describe('projekti-csv: status besedila = en vir resnice z UI', () => {
  it('vsebuje VSE sedem statusov iz prisma enum ProjectStatus (besedila kot UI + PDF)', () => {
    // R164 E2E: baza vsebuje MONTIRANO — UI statusLabels je imel samo 4 od 7
    // (prazna neobarvana značka, izvoz fail-closed). Polni seznam:
    expect(Object.keys(PROJEKTI_STATUS_LABELS).sort()).toEqual(
      [
        'NACRTOVANO', 'V_TEKU', 'ZAKLJUCENO', 'USTAVLJENO',
        'ZA_MONTAZO', 'V_IZDELAVI', 'MONTIRANO',
      ].sort(),
    )
    expect(PROJEKTI_STATUS_LABELS.NACRTOVANO).toBe('Načrtovano')
    expect(PROJEKTI_STATUS_LABELS.V_TEKU).toBe('V teku')
    expect(PROJEKTI_STATUS_LABELS.ZA_MONTAZO).toBe('Za montažo')
    expect(PROJEKTI_STATUS_LABELS.V_IZDELAVI).toBe('V izdelavi')
    expect(PROJEKTI_STATUS_LABELS.MONTIRANO).toBe('Montirano')
    expect(PROJEKTI_STATUS_LABELS.ZAKLJUCENO).toBe('Zaključeno')
    expect(PROJEKTI_STATUS_LABELS.USTAVLJENO).toBe('Ustavljeno')
  })

  it('besedila = ISTA kot vir resnice poročila za vodjo (boss-report-pdf STATUS_SL)', () => {
    const pdf = readFileSync(
      join(process.cwd(), 'src/lib/boss-report-pdf.ts'),
      'utf8',
    )
    for (const [k, v] of Object.entries(PROJEKTI_STATUS_LABELS)) {
      expect(pdf).toContain(`${k}: '${v}',`)
    }
  })

  it('REGRESIJA R164: MONTIRANO se izvozi (E2E fail-closed ujel manjkajoči status)', () => {
    const { csv } = buildProjektiCsv([row({ status: 'MONTIRANO' })])
    expect(csv).toContain('"Montirano"')
    expect(csv).not.toContain('neznan status')
  })

  it('dashboard-tab uporablja ISTE besedile (refaktoriran na konstanto — ni dvojnega vira)', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/components/roksal/dashboard-tab.tsx'),
      'utf8',
    )
    expect(src).toContain('const statusLabels: Record<string, string> = PROJEKTI_STATUS_LABELS')
    // Star dobesedni dvojni vir ne sme več obstajati.
    expect(src).not.toMatch(/const statusLabels: Record<string, string> = \{/)
  })
})

describe('buildProjektiCsv', () => {
  it('BOM + glava + ena vrstica: DD.MM.YYYY iz polnega ISO-ja', () => {
    const { csv, vrstic } = buildProjektiCsv([row()])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const lines = csv.split('\n')
    // BOM ostane na prvi vrstici — glava je z njim prefiksirana.
    expect(lines[0]).toBe('\uFEFFNaziv projekta,Status,Stranka,Naslov,Datum montaže')
    expect(lines[1]).toBe(
      '"Balkon Novak — Kranj","V teku","Jure Novak","Cesta 4, Kranj",15.10.2026',
    )
    expect(vrstic).toBe(1)
  })

  it('je determinističen: dva klica = enak izhod', () => {
    const a = buildProjektiCsv([row(), row({ status: 'NACRTOVANO' })])
    const b = buildProjektiCsv([row(), row({ status: 'NACRTOVANO' })])
    expect(a.csv).toBe(b.csv)
    expect(a.vrstic).toBe(b.vrstic)
  })

  it('null stranka/naslov/datum → prazni stolpci (nikoli "null" besedilo)', () => {
    const { csv } = buildProjektiCsv([
      row({ strankaIme: null, strankaNaslov: null, datumMontaze: null }),
    ])
    expect(csv).toBe('\uFEFFNaziv projekta,Status,Stranka,Naslov,Datum montaže\n"Balkon Novak — Kranj","V teku",,,')
    expect(csv).not.toContain('null')
  })

  it('datum-only vhod (YYYY-MM-DD) ostane veljaven (DD.MM.YYYY)', () => {
    const { csv } = buildProjektiCsv([row({ datumMontaze: '2026-10-15' })])
    expect(csv).toContain(',15.10.2026')
  })

  it('CSV injekcija: navedki podvojeni, vejice/nove vrstice ostanejo v citatu', () => {
    const { csv } = buildProjektiCsv([
      row({ nazivProjekta: 'Balkon "Pri Lovrcu", 1. stopnja\nIC =SUM(A1)' }),
    ])
    expect(csv).toContain('"Balkon ""Pri Lovrcu"", 1. stopnja\nIC =SUM(A1)"')
  })

  it('vsi sedem statusov se preslikajo v UI besedila', () => {
    const { csv } = buildProjektiCsv([
      row({ status: 'NACRTOVANO' }),
      row({ status: 'V_TEKU' }),
      row({ status: 'ZA_MONTAZO' }),
      row({ status: 'V_IZDELAVI' }),
      row({ status: 'MONTIRANO' }),
      row({ status: 'ZAKLJUCENO' }),
      row({ status: 'USTAVLJENO' }),
    ])
    expect(csv).toContain('"Načrtovano"')
    expect(csv).toContain('"V teku"')
    expect(csv).toContain('"Za montažo"')
    expect(csv).toContain('"V izdelavi"')
    expect(csv).toContain('"Montirano"')
    expect(csv).toContain('"Zaključeno"')
    expect(csv).toContain('"Ustavljeno"')
  })

  it('prazno polje → samo glava (BOM, brez vrstic)', () => {
    const { csv, vrstic } = buildProjektiCsv([])
    expect(csv).toBe('\uFEFFNaziv projekta,Status,Stranka,Naslov,Datum montaže')
    expect(vrstic).toBe(0)
  })
})

describe('buildProjektiCsv: fail-closed (TypeError, ne tiho ugibanje)', () => {
  it('ne-polje → TypeError', () => {
    expect(() => buildProjektiCsv('ne-polje' as unknown as ProjektiCsvRow[])).toThrow(TypeError)
    expect(() => buildProjektiCsv(null as unknown as ProjektiCsvRow[])).toThrow(TypeError)
  })

  it('manjkajoč/prazen nazivProjekta → TypeError', () => {
    expect(() => buildProjektiCsv([row({ nazivProjekta: '' })])).toThrow(TypeError)
    expect(() => buildProjektiCsv([row({ nazivProjekta: '   ' })])).toThrow(TypeError)
  })

  it('neznan status → TypeError (ne tiho ugibanje)', () => {
    expect(() => buildProjektiCsv([row({ status: 'IZBRISANO' })])).toThrow(/neznan status projekta/)
  })

  it('nemogoč datum (2026-13-99) → TypeError — vzorec R161 vrzel ujeta', () => {
    expect(() => buildProjektiCsv([row({ datumMontaze: '2026-13-99' })])).toThrow(/neveljaven datum/)
    expect(() => buildProjektiCsv([row({ datumMontaze: '2026-00-10' })])).toThrow(/neveljaven datum/)
  })

  it('ne-niz v besedilnem polju → TypeError', () => {
    expect(() =>
      buildProjektiCsv([row({ strankaIme: 42 as unknown as string })]),
    ).toThrow(TypeError)
  })
})

describe('projektiCsvFilename', () => {
  it('deterministično: projekti_<YYYY-MM-DD>.csv', () => {
    expect(projektiCsvFilename('2026-09-26')).toBe('projekti_2026-09-26.csv')
  })
  it('zavrne ne-ISO vhod', () => {
    expect(() => projektiCsvFilename('26.09.2026')).toThrow(TypeError)
    expect(() => projektiCsvFilename('')).toThrow(TypeError)
  })
})

describe('projektiLabel (slovenska sklanjatev za aria-label)', () => {
  const matrika: [number, string][] = [
    [0, '0 projektov'],
    [1, '1 projekt'],
    [2, '2 projekta'],
    [3, '3 projekti'],
    [4, '4 projekti'],
    [5, '5 projektov'],
    [11, '11 projektov'],
    [12, '12 projektov'],
    [13, '13 projektov'],
    [14, '14 projektov'],
    [21, '21 projekt'],
    [22, '22 projekta'],
    [23, '23 projekti'],
    [24, '24 projekti'],
    [101, '101 projekt'],
    [111, '111 projektov'],
    [122, '122 projekta'],
  ]
  it.each(matrika)('%i → %s', (n, priakovano) => {
    expect(projektiLabel(n)).toBe(priakovano)
  })
  it('zavrne negativna/ne-cela števila', () => {
    expect(() => projektiLabel(-1)).toThrow(TypeError)
    expect(() => projektiLabel(1.5)).toThrow(TypeError)
  })
})

describe('R164 DARK strazar + fokus ringi (dashboard-tab — glavna površina)', () => {
  // Nauček R163: opisni komentarji smejo omenjati prepovedane vzorce
  // (dokumentirajo poprejšnjo napako) — strazar gleda SAMO izvedljive vrstice.
  const raw = readFileSync(
    join(process.cwd(), 'src/components/roksal/dashboard-tab.tsx'),
    'utf8',
  )
  const src = raw
    .replace(/\/\*[\s\S]*?\*\//g, '') // block komentarji
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, '')) // vrstični komentarji (tudi trailing)
    .join('\n')

  it('statusColors NACRTOVANO ima dark: varianti (prej svetlomodra pegi v temni temi)', () => {
    expect(src).toMatch(/NACRTOVANO: 'bg-blue-100 text-blue-800 dark:bg-blue-\d+\/\d+ dark:text-blue-\d+'/)
  })

  it('statusColors za ZA_MONTAZO/V_IZDELAVI/MONTIRANO obstajajo in imajo dark: varianti', () => {
    // R164 regresija (E2E): ta tri statusi prej NISO imeli ne besedila ne barve.
    expect(src).toMatch(/ZA_MONTAZO: 'bg-orange-100 text-orange-800 dark:bg-orange-950\/40 dark:text-orange-300'/)
    expect(src).toMatch(/V_IZDELAVI: 'bg-violet-100 text-violet-800 dark:bg-violet-950\/40 dark:text-violet-300'/)
    expect(src).toMatch(/MONTIRANO: 'bg-teal-100 text-teal-800 dark:bg-teal-950\/40 dark:text-teal-300'/)
  })

  it('ni več golih bg-white površin (iskanje + status dropdown → semantični žetoni)', () => {
    expect(src).not.toContain('bg-white')
  })

  it('amber opozorilni okvirji imajo dark: varianti (border + bg + besedila)', () => {
    const zadetki = src.match(/border-amber-200 bg-amber-50[^"']*/g) ?? []
    expect(zadetki.length).toBeGreaterThanOrEqual(2)
    for (const z of zadetki) {
      expect(z).toContain('dark:border-')
      expect(z).toContain('dark:bg-')
    }
    // Besedila v okvirjih morajo imeti temno varianto.
    expect(src).toMatch(/text-amber-800 dark:/)
    expect(src).toMatch(/text-amber-700\/90[^'"]*dark:/)
  })

  it('ikonski gumbi projektne kartice (kliči/uredi/arhiviraj) imajo focus-visible ring', () => {
    for (const label of ['Pokliči stranko', 'Uredi projekt', 'Arhiviraj projekt']) {
      const pos = src.indexOf(`aria-label="${label}"`)
      expect(pos).toBeGreaterThan(-1)
      const blok = src.slice(Math.max(0, pos - 400), pos)
      expect(blok).toMatch(/focus-visible:ring-/)
    }
  })
})
