// R343 — dekompozicija calculator-tab FAZA 4: skladišče zgodovine/predlog
// (vzorec R322/R325/R338/R341 dekompozicij + R341 modeLabels EN VIR).
// ---------------------------------------------------------------------------
//  • localStorage ključi: 7× podvojeni literali → EN VIR konstanti;
//  • fail-closed nalagalnik (window guard + try/catch JSON.parse) — ENA
//    funkcija namesto 2 kopiji inicializatorja; node = privzeto (brez
//    okna — determinizem tudi v testnem okolju);
//  • varni zapisovalnik/brisač — ENA funkcija namesto 5 kopij plesa;
//  • zmogljivostni limiti (30/50) — prej magic števila ×3 + UI besedilo;
//  • zgodovinaCsvVrstice + ZGODOVINA_CSV_GLAVE — čista podatkovna resnica
//    za 65. člen izvoz (mehanika toCsv/downloadCsvText ostaja v tabu);
//  • determinizem: brez časa razen podatkov, ki jih nosi zgodovina.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  SKLADISCE_PREDLOGE,
  SKLADISCE_ZGODOVINA,
  MAX_ZGODOVINA,
  MAX_PREDLOG,
  naloziIzSkladisca,
  shraniVSkladisce,
  odstraniIzSkladisca,
  ZGODOVINA_CSV_GLAVE,
  zgodovinaCsvVrstice,
} from '@/components/roksal/calculator/history'
import type { HistoryEntry } from '@/components/roksal/calculator/shared'

const TAB = join(process.cwd(), 'src/components/roksal/calculator-tab.tsx')
const HIST = join(process.cwd(), 'src/components/roksal/calculator/history.ts')

const tab = readFileSync(TAB, 'utf8')
const hist = readFileSync(HIST, 'utf8')

describe('r343 calc FAZA 4 — skladišče EN VIR: ključi, limiti, nalagalnik', () => {
  it('ključi EN VIR: 0 surovih literalov v tabu, konstanti definirani natanko enkrat', () => {
    expect(tab).not.toContain('roksal_calc_')
    // EN VIR: export definicija + opomba v glavi = 2 pojavitvi, vsaka SMO deklaracija/komentar
    expect(hist.match(/export const SKLADISCE_PREDLOGE/g)?.length).toBe(1)
    expect(hist.match(/export const SKLADISCE_ZGODOVINA/g)?.length).toBe(1)
    expect(tab).toContain('SKLADISCE_PREDLOGE,')
    expect(tab).toContain('SKLADISCE_ZGODOVINA,')
  })

  it('limiti EN VIR: 30/50 — 0 magic števil v tabu (slice + UI besedilo)', () => {
    expect(MAX_ZGODOVINA).toBe(30)
    expect(MAX_PREDLOG).toBe(50)
    expect(tab).not.toContain('.slice(0, 30)')
    expect(tab).not.toContain('.slice(0, 50)')
    expect(tab).not.toContain('(max 30)')
    expect(tab).toContain('slice(0, MAX_ZGODOVINA)')
    expect(tab).toContain('slice(0, MAX_PREDLOG)')
    expect(tab).toContain('(max {MAX_ZGODOVINA})')
  })

  it('fail-closed nalagalnik: izven brskalnika (node) vrne privzeto — NIČ metanja', () => {
    const privzeto = [{ id: 'x' }]
    expect(naloziIzSkladisca('kakršen_koli_kljuc', privzeto)).toBe(privzeto)
    expect(naloziIzSkladisca('kakršen_koli_kljuc', null)).toBeNull()
  })

  it('varni zapisovalnik/brisač: izven brskalnika (node) tiho no-op — NIČ metanja', () => {
    expect(() => shraniVSkladisce('k', { a: 1 })).not.toThrow()
    expect(() => odstraniIzSkladisca('k')).not.toThrow()
  })

  it('nalagalnik zavrže pokvaren JSON (fail-closed parse — R339 vzorec)', () => {
    // simulacija: window+localStorage z pokvarjenim zapisom
    const store: Record<string, string> = { pokvaren: '{ne-velja-json' }
    const g = globalThis as Record<string, unknown>
    const origWindow = g.window
    const origLocalStorage = g.localStorage
    g.window = {}
    g.localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
    }
    try {
      expect(naloziIzSkladisca('pokvaren', [])).toEqual([])
      shraniVSkladisce('veljaven', { a: 1 })
      expect(JSON.parse(store['veljaven'])).toEqual({ a: 1 })
      odstraniIzSkladisca('veljaven')
      expect(store['veljaven']).toBeUndefined()
    } finally {
      g.window = origWindow
      g.localStorage = origLocalStorage
    }
  })

  it('ZGODOVINA_CSV_GLAVE: 7 stolpcev, enak vrstni red (65. člen resnica)', () => {
    expect([...ZGODOVINA_CSV_GLAVE]).toEqual([
      'Datum', 'Način', 'Ključni rezultat', 'Projekt', 'Formula', 'Odtis vhodov', 'Vhodni podatki',
    ])
  })

  it('zgodovinaCsvVrstice: determinizem FULL — bajtno identično za isto zgodovino', () => {
    const vnoski: HistoryEntry[] = [
      {
        id: 'hist_1',
        timestamp: '2026-10-01T10:00:00.000Z',
        mode: 'baluster',
        modeLabel: 'Razmak palic',
        keyResult: '42 palic (rezerva 10%), razmik 102.4mm',
        inputs: { balTotalLength: '2000', balWidth: '40' },
      },
      {
        id: 'hist_2',
        timestamp: '2026-10-01T10:05:00.000Z',
        mode: 'glass',
        modeLabel: 'Steklena balustrada',
        keyResult: '12mm laminirano (2 sloje) — VARNO',
        inputs: { glassSpan: '1200' },
        projectName: 'Test objekt',
        formulaVersion: 'glass-v1',
        inputHash: 'abc123',
      },
    ]
    const a = zgodovinaCsvVrstice(vnoski)
    const b = zgodovinaCsvVrstice(vnoski)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(a).toHaveLength(2)
    // 7 celic v istem vrstnem redu (datum = VERBATIM sl formatirnika)
    expect(a[0]).toHaveLength(7)
    expect(a[0][0]).toContain('1. 10. 2026') // slDatumKratko: dan. mesec. leto (brez dopolnjevanj) — disk resnica
    expect(a[0][1]).toBe('Razmak palic')
    expect(a[1][3]).toBe('Test objekt')
    expect(a[1][4]).toBe('glass-v1')
    expect(a[1][5]).toBe('abc123')
    expect(a[1][6]).toBe('{"glassSpan":"1200"}')
  })

  it('citiranje prehaja na toCsv kanon: celica z ; in " mora biti citirana (RFC 4180)', () => {
    const vnoski: HistoryEntry[] = [
      {
        id: 'h',
        timestamp: '2026-10-01T10:00:00.000Z',
        mode: 'material',
        modeLabel: 'Skupni material',
        keyResult: 'rezultat; z podpičjem in "narekovajem"',
        inputs: {},
      },
    ]
    const vrstice = zgodovinaCsvVrstice(vnoski)
    expect(vrstice[0][2]).toBe('rezultat; z podpičjem in "narekovajem"') // jedro ne citira — toCsv kanon DA
  })

  it('tab žičenje: 5 skladiščnih klicev na EN VIR funkcije (2 load + 3 save/remove)', () => {
    expect(tab.match(/naloziIzSkladisca</g)?.length).toBe(2)
    expect(tab.match(/shraniVSkladisce\(/g)?.length).toBe(3)
    expect(tab.match(/odstraniIzSkladisca\(/g)?.length).toBe(2)
  })

  it('r341 postavitev nedotaknjena: modeLabels EN VIR ŽIVO (FAZA 3 regresija)', () => {
    const shared = readFileSync(join(process.cwd(), 'src/components/roksal/calculator/shared.ts'), 'utf8')
    expect(shared).toContain('export const modeLabels: Record<CalcMode, string> = {')
    expect(tab).not.toContain('modeLabelMap')
  })
})
