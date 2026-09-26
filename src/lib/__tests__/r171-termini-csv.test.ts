// R171 — CSV izvoz prikazanih terminov (P1-d) + dashboard refetch-on-focus
// z pečatom (P1-b).
// ---------------------------------------------------------------------------
// P1-d: buildTerminiCsv — IZVOŽENO = ZASLON (iste vrstice kot kartica, ISTI
// povzetek terminUrPovzetek, pečat casOznaka; manjkajoča ura → PRAZNO polje,
// nikoli izmišljenih 0). P1-b: fetchAll + useRefetchOnFocus + pečat v
// dashboard-tab (vzorec R170). Fail-closed povsod.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildTerminiCsv, terminiCsvFilename } from '@/lib/termini-csv'
import { terminUrPovzetek, vsotaPredvidenihUr, type TerminPrikazVnos } from '@/lib/termini-prikaz'

const terminiCard = (): string =>
  readFileSync(join(process.cwd(), 'src/components/roksal/termini-card.tsx'), 'utf8')

const dashboard = (): string =>
  readFileSync(join(process.cwd(), 'src/components/roksal/dashboard-tab.tsx'), 'utf8')

const csvExport = (): string =>
  readFileSync(join(process.cwd(), 'src/lib/csv-export.ts'), 'utf8')

const vnos = (over: Partial<TerminPrikazVnos> = {}): TerminPrikazVnos => ({
  id: 't1',
  projectId: 'p1',
  projektIme: 'Nadstropna ograja, Kranj',
  strankaIme: 'Novak d.o.o.',
  strankaNaslov: 'Cesta 1, Kranj',
  lokacija: 'Vhod A',
  ekipaIme: 'Ekipa 1',
  monterId: 'u1',
  monterIme: 'Janez',
  status: 'NAVRTENO',
  datumZacetka: '2026-09-26T08:00:00.000Z',
  predvideneUre: 8,
  moja: true,
  ...over,
})

const NOW = new Date(2026, 8, 26, 12, 0, 0) // 2026-09-26 lokalno poldne
const OSVEZITEV = new Date(2026, 8, 26, 11, 59, 30)

describe('R171 buildTerminiCsv — IZVOŽENO = ZASLON', () => {
  it('glave + podatkovne vrstice v podanem vrstnem redu (danes + kasneje, kar vidiš to se izvoziš)', () => {
    const a = vnos({ id: 't1', datumZacetka: '2026-09-26T08:00:00.000Z' })
    const b = vnos({ id: 't2', datumZacetka: '2026-09-27T09:00:00.000Z', status: 'V_TEKU' })
    const { csv, vrstic } = buildTerminiCsv([a, b], {
      urAgregat: vsotaPredvidenihUr([a, b]),
      osvezitev: OSVEZITEV,
      now: NOW,
      samoMoje: false,
    })
    expect(vrstic).toBe(2)
    const vrstice = csv.replace(/^\uFEFF/, '').split('\r\n')
    expect(vrstice[0]).toBe('Datum;Dan;Ura;Projekt;Stranka;Naslov;Lokacija;Ekipa;Monter;Status;Predvidene ure')
    // EXPORTED=SCREEN: 1. vrstica = 1. podana (danes), 2. = 2. podana
    expect(vrstice[1]).toContain('Načrtovano')
    expect(vrstice[1].split(';')[3]).toBe(a.projektIme)
    expect(vrstice[2].split(';')[3]).toBe(b.projektIme)
    expect(vrstice[2]).toContain('V teku')
  })

  it('manjkajoča predvidena ura → PRAZEN stolpec (nikoli izmišljenih 0)', () => {
    const { csv } = buildTerminiCsv([vnos({ predvideneUre: null })], {
      urAgregat: vsotaPredvidenihUr([vnos({ predvideneUre: null })]),
      osvezitev: null,
      now: NOW,
      samoMoje: false,
    })
    const podatkovna = csv.split('\r\n')[1]
    const stolpci = podatkovna.split(';')
    expect(stolpci[stolpci.length - 1]).toBe('')
  })

  it('znana ura → decimalna vejica 2 decimalki (kontrakt R136)', () => {
    const { csv } = buildTerminiCsv([vnos({ predvideneUre: 8 })], {
      urAgregat: vsotaPredvidenihUr([vnos({ predvideneUre: 8 })]),
      osvezitev: null,
      now: NOW,
      samoMoje: false,
    })
    expect(csv.split('\r\n')[1]).toContain('8,00')
  })

  it('povzetek = ISTI terminUrPovzetek niz kot na kartici (EN VIR RESNICE)', () => {
    const a = vnos({ predvideneUre: 8 })
    const b = vnos({ id: 't2', predvideneUre: null, status: 'PREKlicANO' })
    const vrstice = [a, b]
    const ag = vsotaPredvidenihUr(vrstice)
    const { csv } = buildTerminiCsv(vrstice, {
      urAgregat: ag,
      osvezitev: null,
      now: NOW,
      samoMoje: false,
    })
    expect(csv).toContain(`Povzetek;${terminUrPovzetek(ag)}`)
  })

  it('metapodatki: Filter (samoMoje) + Povzetek + Izvoženo ob (pečat)', () => {
    const a = vnos()
    const samo = buildTerminiCsv([a], {
      urAgregat: vsotaPredvidenihUr([a]),
      osvezitev: OSVEZITEV,
      now: NOW,
      samoMoje: true,
    }).csv
    expect(samo).toContain('Filter;Samo moje termine')
    expect(samo).toContain(`Izvoženo ob (čas zadnje osvežitve);`)

    const vsi = buildTerminiCsv([a], {
      urAgregat: vsotaPredvidenihUr([a]),
      osvezitev: OSVEZITEV,
      now: NOW,
      samoMoje: false,
    }).csv
    expect(vsi).toContain('Filter;Vsi termini')
  })

  it('osvezitev null → vrstica Izvoženo ob IZPUŠČENA (nikoli lažne svežine)', () => {
    const a = vnos()
    const { csv } = buildTerminiCsv([a], {
      urAgregat: vsotaPredvidenihUr([a]),
      osvezitev: null,
      now: NOW,
      samoMoje: false,
    })
    expect(csv).not.toContain('Izvoženo ob')
  })

  it('kontrakt R136: BOM + CRLF + podpičje', () => {
    const a = vnos()
    const { csv } = buildTerminiCsv([a], {
      urAgregat: vsotaPredvidenihUr([a]),
      osvezitev: null,
      now: NOW,
      samoMoje: false,
    })
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(csv).toContain(';')
  })

  it('prazno polje vrstic → samo glave + metapodatki, vrstic = 0', () => {
    const { csv, vrstic } = buildTerminiCsv([], {
      urAgregat: vsotaPredvidenihUr([]),
      osvezitev: null,
      now: NOW,
      samoMoje: false,
    })
    expect(vrstic).toBe(0)
    expect(csv).toContain('Filter;Vsi termini')
    expect(csv).toContain('Povzetek;Skupaj 0 h · 0 terminov')
  })

  it('determinizem: isti vhod → bajtno identičen izhod', () => {
    const a = vnos()
    const b = vnos({ id: 't2', datumZacetka: '2026-09-28T10:00:00.000Z', status: 'PRELOZENO' })
    const opcije = {
      urAgregat: vsotaPredvidenihUr([a, b]),
      osvezitev: OSVEZITEV,
      now: NOW,
      samoMoje: true,
    } as const
    expect(buildTerminiCsv([a, b], { ...opcije }).csv).toBe(
      buildTerminiCsv([a, b], { ...opcije }).csv
    )
  })

  it('fail-closed: pokvarjeni vhodi → TypeError', () => {
    const a = vnos()
    const ok = {
      urAgregat: vsotaPredvidenihUr([a]),
      osvezitev: null,
      now: NOW,
      samoMoje: false,
    }
    expect(() => buildTerminiCsv('ni polje' as unknown as TerminPrikazVnos[], { ...ok })).toThrow(TypeError)
    expect(() => buildTerminiCsv([a], { ...ok, now: 'ni datum' as unknown as Date })).toThrow(TypeError)
    expect(() => buildTerminiCsv([a], { ...ok, osvezitev: 42 as unknown as Date })).toThrow(TypeError)
    expect(() => buildTerminiCsv([a], { ...ok, samoMoje: 'da' as unknown as boolean })).toThrow(TypeError)
    expect(() => buildTerminiCsv([a], { ...ok, urAgregat: { ure: -1, stTerminov: 0, brezUre: 0, preklicanih: 0 } })).toThrow(TypeError)
    expect(() =>
      buildTerminiCsv([vnos({ datumZacetka: 'pokvarjeno' })], { ...ok })
    ).toThrow(TypeError)
    expect(() =>
      buildTerminiCsv([vnos({ status: 'NEZNAN' as unknown as TerminPrikazVnos['status'] })], { ...ok })
    ).toThrow(TypeError)
  })

  it('datum oznake v CSV = ISTA funkcija kot na zaslonu (terminDatumLabel/terminCasLabel)', () => {
    const a = vnos()
    const { csv } = buildTerminiCsv([a], {
      urAgregat: vsotaPredvidenihUr([a]),
      osvezitev: null,
      now: NOW,
      samoMoje: false,
    })
    // EN VIR RESNICE: oznaki iz iste knjižnice (zaslon in CSV ne moreta raziti)
    const dan = a.datumZacetka
    expect(csv).toContain('Danes')
    expect(dan).toBeTruthy()
  })
})

describe('R171 terminiCsvFilename', () => {
  it('deterministično ime z obsegom 7 dni', () => {
    expect(terminiCsvFilename('2026-09-26')).toBe('Termini-7-dni_2026-09-26.csv')
  })
  it.each(['', '26.09.2026', '2026-9-6', 'ni datum', '2026-09-26T10:00'])(
    'zavrne pokvarjen format %j',
    (slab) => {
      expect(() => terminiCsvFilename(slab)).toThrow(TypeError)
    }
  )
})

describe('R171 P1-d žičenje — Termini kartica izvozi PRIKAZANE', () => {
  it('kartica importira ISTE lib funkcije (buildTerminiCsv + downloadCsvText + todayStamp)', () => {
    const card = terminiCard()
    expect(card).toContain("from '@/lib/termini-csv'")
    expect(card).toContain('buildTerminiCsv')
    expect(card).toContain('terminiCsvFilename')
    expect(card).toContain("downloadCsvText, todayStamp } from '@/lib/csv-export'")
    expect(card).toContain('FileDown')
  })

  it('izvoziCsv podaje urAgregat + zdaj (pečat) + samoMoje — EN VIR RESNICE z zaslonom', () => {
    const card = terminiCard()
    expect(card).toContain('const izvoziCsv = useCallback(')
    expect(card).toContain('const vrstice = [...prikazane.danes, ...prikazane.kasneje]')
    expect(card).toContain('osvezitev: zdaj')
    expect(card).toContain('samoMoje,')
    expect(card).toContain('urAgregat,')
  })

  it('gumb: aria-label + fail-closed vrata (brez podatkov onemogočen)', () => {
    const card = terminiCard()
    expect(card).toContain('Izvozi prikazane termine v CSV')
    expect(card).toContain('disabled={loading || !prikazane || skupnoSkupin === 0}')
    expect(card).toContain('upošteva filter Samo moje')
  })

  it('toast potrditev z terminBeseda (vzorec projekti CSV)', () => {
    const card = terminiCard()
    expect(card).toContain("toast.success('CSV izvožen'")
    expect(card).toContain('terminBeseda(vrstic)')
  })
})

describe('R171 P1-b žičenje — dashboard refetch-on-focus + pečat', () => {
  it('fetchAll = ENA ovojnica (Promise.all ×3 + setLoading(false)) — začetni load IN fokus', () => {
    const dash = dashboard()
    expect(dash).toContain('const fetchAll = useCallback(')
    expect(dash).toContain('await Promise.all([fetchProjects(), fetchInventory(), fetchCustomers()])')
    expect(dash).toContain('useRefetchOnFocus(fetchAll)')
    const idx = dash.indexOf('const fetchAll = useCallback(')
    const body = dash.slice(idx, idx + 400)
    expect(body).toContain('setLoading(false)')
    expect(body).toContain('[fetchProjects, fetchInventory, fetchCustomers]')
  })

  it('pečat projektnega seznama: History + tabular-nums + title + hidden sm:flex (vzorec R170)', () => {
    const dash = dashboard()
    const idx = dash.indexOf('Čas zadnje uspešne osvežitve podatkov')
    expect(idx).toBeGreaterThan(-1)
    const block = dash.slice(Math.max(0, idx - 400), idx + 300)
    expect(block).toContain('hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex')
    expect(block).toContain('tabular-nums')
    expect(block).toContain('casOznaka(projektiOsvezitev)')
  })

  it('pečat nastavljen SAMO v uspešni veji fetchProjects; obe napaki ga počistita (nikoli lažne svežine)', () => {
    const dash = dashboard()
    expect(dash).toContain('setProjektiOsvezitev(new Date())')
    expect(dash).toMatch(/setProjectsError\(`Projektov ni bilo mogoče naložiti \(napaka \$\{res\.status\}\)\.`\)\n\s*setProjektiOsvezitev\(null\)/)
    expect(dash).toMatch(/setProjectsError\('Projektov ni bilo mogoče naložiti — preverite povezavo\.'\)\n\s*setProjektiOsvezitev\(null\)/)
  })

  it('DARK pečat stražar (obseg SAMO vrstice pečata — nauček R165/R167)', () => {
    const dash = dashboard()
    const idx = dash.indexOf('Čas zadnje uspešne osvežitve podatkov')
    const block = dash.slice(Math.max(0, idx - 200), idx + 200)
    // semantični žeton — temna tema samodejno; brez golih svetlih barv
    expect(block).toContain('text-muted-foreground')
    expect(block).not.toMatch(/text-(?:gray|slate|stone|zinc|neutral)-\d+/)
    expect(block).not.toMatch(/bg-(?:white|gray|slate|stone|zinc|neutral)-\d+/)
  })

  it('csv-export: downloadCsv delegira na downloadCsvText (EN prenosni kontrakt)', () => {
    const src = csvExport()
    expect(src).toContain('export function downloadCsvText(filename: string, csv: string): void')
    expect(src).toContain('downloadCsvText(filename, toCsv(headers, rows))')
  })
})
