// R339 — dekompozicija measurements-tab FAZA 3 (kanon R319/R325/R338 čist premik):
// OZADJE: KOLIZIJA #13 — vzporedna lastniška seja je oddala identično FAZA 3
// dekompozicijo kot R338 [6a333ae: 3 tipi v labels/format, −344]; moja
// izvedba [048f5fe] je bila SUPERSEDIRANA po kanonu KOLIZIJE #4/R323 —
// runda preimenovana R339, ohranjeni so MOJI unikatni prispevki: vitest
// Pokritost (izčerpnost ključev + determinizem + fail-closed) adaptirana na
// NJIHOVO postavitev (GroundType/AuditEntry v labels.ts, ArMetadata v
// format.ts, shared.ts nespremenjen od R319).
// ---------------------------------------------------------------------------
// Testi dokazujejo: (1) konstante IZČERPNE vsako Record ključ (fail-closed
// tipizacija — kompajlar vsili, testi DOKAŽEJO vsebino), (2) helperji so
// DETERMINISTIČNI čiste funkcije z eksplicitnimi resnicami, (3) fail-closed
// parse (pokvaren JSON = iskrena praznina, nikoli metanje), (4) čist premik —
// glavna datoteka ne definira več premaknjenih členov, uvaža jih EN VIR.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  tipMeritveLabels,
  tipMeritveTitles,
  syncStanjeLabels,
  syncStanjeTitles,
  syncStanjeColors,
  groundTypeLabels,
  groundTypeColors,
  segmentTypeLabels,
  statusLabels,
  statusColors,
  statusCycle,
  auditActionLabels,
  enotaLabels,
} from '@/components/roksal/measurements/labels'
import {
  parseArMetadata,
  parseGPS,
  formatDimension,
  formatM2,
  formatMultiUnit,
  formatAngleMulti,
  formatSlopeMulti,
  convertToMm,
  formatInPrimaryUnit,
  calculateStairDimensions,
  getNextStebriNumber,
  loadAudit,
  loadPrimaryUnit,
} from '@/components/roksal/measurements/format'
import type { Measurement } from '@/components/roksal/measurements/shared'

const TAB = join(process.cwd(), 'src/components/roksal/measurements-tab.tsx')
const LABELS = join(process.cwd(), 'src/components/roksal/measurements/labels.ts')
const FORMAT = join(process.cwd(), 'src/components/roksal/measurements/format.ts')

const tab = readFileSync(TAB, 'utf8')
const labelsVir = readFileSync(LABELS, 'utf8')
const formatVir = readFileSync(FORMAT, 'utf8')

const TIP_MERITVE_KLJUCI = [
  'RAZDALJA', 'VISINA', 'KOT', 'NAGIB', 'GLOBINA', 'PREMER', 'SEGMENT',
  'KOT_VOGAL', 'KOT_STOPNISCE', 'STEBR',
]
const SYNC_KLJUCI = ['synced', 'pending', 'conflict', 'error']
const GROUND_KLJUCI = ['beton', 'les', 'plosca', 'gramoz', 'metal']
const SEGMENT_KLJUCI = ['ravni', 'kotni', 'stopniscje', 'lokan', 'WPC_POKOCNE', 'WPC_VODORAVNE', 'WPC_POSEVNE']
const STATUS_KLJUCI = ['OSNUTEK', 'POTRJENA', 'ARHIVIRANA']
const AUDIT_KLJUCI = ['ADD', 'EDIT', 'DELETE', 'STATUS']
const ENOTA_KLJUCI = ['mm', 'cm', 'm']

describe('r339 FAZA 3 — labels.ts: izčerpnost Record ključev (fail-closed tipizacija dokazana)', () => {
  it('tipMeritveLabels/Titles — vseh 10 tipov meritev, naslovi nosijo razlago (hover parity R280)', () => {
    expect(Object.keys(tipMeritveLabels).sort()).toEqual([...TIP_MERITVE_KLJUCI].sort())
    expect(Object.keys(tipMeritveTitles).sort()).toEqual([...TIP_MERITVE_KLJUCI].sort())
    for (const k of TIP_MERITVE_KLJUCI) {
      expect(tipMeritveLabels[k as keyof typeof tipMeritveLabels].length).toBeGreaterThan(0)
      expect(tipMeritveTitles[k as keyof typeof tipMeritveTitles]).toContain('Vrsta meritve:')
    }
  })

  it('syncStanjeLabels/Titles/Colors — vsa 4 stanja kontrakta (R281)', () => {
    expect(Object.keys(syncStanjeLabels).sort()).toEqual([...SYNC_KLJUCI].sort())
    expect(Object.keys(syncStanjeTitles).sort()).toEqual([...SYNC_KLJUCI].sort())
    expect(Object.keys(syncStanjeColors).sort()).toEqual([...SYNC_KLJUCI].sort())
    for (const k of SYNC_KLJUCI) {
      expect(syncStanjeTitles[k as keyof typeof syncStanjeTitles]).toContain('Sinhronizacijsko stanje:')
    }
  })

  it('groundType/segmentType/status/audit/enota — izčerpne mape (vse VERBATIM vsebine)', () => {
    expect(Object.keys(groundTypeLabels).sort()).toEqual([...GROUND_KLJUCI].sort())
    expect(Object.keys(groundTypeColors).sort()).toEqual([...GROUND_KLJUCI].sort())
    expect(Object.keys(segmentTypeLabels).sort()).toEqual([...SEGMENT_KLJUCI].sort())
    expect(Object.keys(statusLabels).sort()).toEqual([...STATUS_KLJUCI].sort())
    expect(Object.keys(statusColors).sort()).toEqual([...STATUS_KLJUCI].sort())
    expect(Object.keys(auditActionLabels).sort()).toEqual([...AUDIT_KLJUCI].sort())
    expect(Object.keys(enotaLabels).sort()).toEqual([...ENOTA_KLJUCI].sort())
    expect(groundTypeLabels.beton).toBe('Beton')
    expect(groundTypeLabels.les).toBe('Lesena podlaga')
    expect(segmentTypeLabels.lokan).toBe('Lokan / ukrivljen')
    expect(auditActionLabels.ADD).toBe('Dodano')
    expect(auditActionLabels.STATUS).toBe('Status')
  })

  it('statusCycle — zaprt cikel OSNUTEK → POTRJENA → ARHIVIRANA → OSNUTEK (bijekcija)', () => {
    expect(statusCycle.OSNUTEK).toBe('POTRJENA')
    expect(statusCycle.POTRJENA).toBe('ARHIVIRANA')
    expect(statusCycle.ARHIVIRANA).toBe('OSNUTEK')
    for (const k of STATUS_KLJUCI) {
      expect(STATUS_KLJUCI).toContain(statusCycle[k as keyof typeof statusCycle])
    }
  })

  it('0 surovih hex barv v labels.ts (0-hex kanon val 15–24 — vse žetone)', () => {
    expect(labelsVir).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

describe('r339 FAZA 3 — format.ts: deterministične čiste funkcije', () => {
  it('formatDimension — mm pod 1000, m nad 1000 (točna resnica)', () => {
    expect(formatDimension(950)).toBe('950mm')
    expect(formatDimension(1000)).toBe('1.00m')
    expect(formatDimension(2750)).toBe('2.75m')
    expect(formatDimension(0)).toBe('0mm')
  })

  it('formatM2 + formatMultiUnit + formatAngleMulti + formatSlopeMulti — deterministični izpisi', () => {
    expect(formatM2(6_000_000)).toBe('6.00m²')
    expect(formatM2(0)).toBe('0.00m²')
    expect(formatMultiUnit(1234)).toBe('1234mm · 123cm · 1.23m')
    expect(formatAngleMulti(90)).toBe('90° · 1.57rad')
    expect(formatSlopeMulti(30)).toBe('30.0° · 57.7%')
    // determinizem: dva klica = isti niz
    expect(formatSlopeMulti(45)).toBe(formatSlopeMulti(45))
  })

  it('convertToMm — mm/cm/m pretvorbe + fail-closed ne-finite → 0', () => {
    expect(convertToMm(5, 'mm')).toBe(5)
    expect(convertToMm(5, 'cm')).toBe(50)
    expect(convertToMm(5, 'm')).toBe(5000)
    expect(convertToMm(NaN, 'mm')).toBe(0)
    expect(convertToMm(Infinity, 'm')).toBe(0)
  })

  it('formatInPrimaryUnit — primarne enote + fail-closed ne-finite → em-dash', () => {
    expect(formatInPrimaryUnit(1234, 'mm')).toBe('1234mm')
    expect(formatInPrimaryUnit(1234, 'cm')).toBe('123.4cm')
    expect(formatInPrimaryUnit(1234, 'm')).toBe('1.23m')
    expect(formatInPrimaryUnit(NaN, 'mm')).toBe('—')
  })

  it('calculateStairDimensions — veljavna veja (kot iz resnice) + fail-closed neveljavna vhoda', () => {
    const ok = calculateStairDimensions(1800, 10, 280)
    expect(ok.valid).toBe(true)
    expect(ok.visinaPosamezne).toBe(180)
    expect(ok.kotStopinje).toBeCloseTo(32.74, 1)
    expect(ok.priporocilo).toBe('Standardni kot 30–35°')
    const prestrmo = calculateStairDimensions(1800, 6, 200)
    expect(prestrmo.valid).toBe(true)
    expect(prestrmo.priporocilo).toBe('Nevarno: >40° (prestrmo!)')
    const slabo = calculateStairDimensions(0, 10, 280)
    expect(slabo.valid).toBe(false)
    expect(slabo.priporocilo).toBe('Vnesite veljavne vhodne podatke')
    expect(calculateStairDimensions(NaN, 10, 280).valid).toBe(false)
  })

  it('getNextStebriNumber — avto-številčenje S1, S2 … znotraj segmenta (STEBR filter)', () => {
    const m = (over: Partial<Measurement>): Measurement => ({
      id: 'x', dolzinaMm: 0, visinaMm: 0, createdAt: '', projectId: 'p', ...over,
    })
    const seznam = [
      m({ tipMeritve: 'STEBR', segmentId: 's1' }),
      m({ tipMeritve: 'STEBR', segmentId: 's1' }),
      m({ tipMeritve: 'STEBR', segmentId: 's2' }),
      m({ tipMeritve: 'RAZDALJA', segmentId: 's1' }),
    ]
    expect(getNextStebriNumber(seznam, 's1')).toBe(3)
    expect(getNextStebriNumber(seznam, 's2')).toBe(2)
    expect(getNextStebriNumber(seznam)).toBe(4)
    expect(getNextStebriNumber([], 's1')).toBe(1)
  })

  it('parseArMetadata + parseGPS — fail-closed: pokvaren JSON = iskrena praznina, NIKOLI metanje', () => {
    expect(parseArMetadata(null)).toEqual({})
    expect(parseArMetadata(undefined)).toEqual({})
    expect(parseArMetadata('')).toEqual({})
    expect(parseArMetadata('{pokvaren')).toEqual({})
    const ok = parseArMetadata('{"tipMeritve":"KOT","kot":45}')
    expect(ok.tipMeritve).toBe('KOT')
    expect(ok.kot).toBe(45)
    expect(parseGPS(null)).toBeNull()
    expect(parseGPS('ni json')).toBeNull()
    expect(parseGPS('{"lat":46.2,"lng":14.3}')).toEqual({ lat: 46.2, lng: 14.3 })
  })

  it('loadAudit + loadPrimaryUnit — fail-closed brez localStorage (node okolje) = praznina', () => {
    expect(loadAudit('projekt-x')).toEqual([])
    expect(loadPrimaryUnit()).toBe('mm')
  })

  it('DETERMINIZEM FULL: isti vhod = bajtno enak izpis (brez časa, brez naključja)', () => {
    const a = JSON.stringify([formatDimension(1234), formatM2(2_500_000), formatMultiUnit(999), formatAngleMulti(45), formatSlopeMulti(45)])
    const b = JSON.stringify([formatDimension(1234), formatM2(2_500_000), formatMultiUnit(999), formatAngleMulti(45), formatSlopeMulti(45)])
    expect(a).toBe(b)
  })
})

describe('r339 FAZA 3 — čist premik dokazan (vir preiskava; KOLIZIJA #13 — NJIHOVA postavitev)', () => {
  it('glavna datoteka NE definira več premaknjenih členov — uvaža jih EN VIR', () => {
    expect(tab).not.toMatch(/^const tipMeritveLabels/m)
    expect(tab).not.toMatch(/^function parseArMetadata/m)
    expect(tab).not.toMatch(/^function calculateStairDimensions/m)
    expect(tab).not.toMatch(/^type GroundType/m)
    expect(tab).not.toMatch(/^interface AuditEntry/m)
    expect(tab).toContain("from './measurements/labels'")
    expect(tab).toContain("from './measurements/format'")
    expect(tab).toContain('type ArMetadata,')
    expect(tab).toContain('type AuditEntry,')
    expect(tab).toContain('type GroundType,')
  })

  it('VERBATIM premik: konstante/helperji živijo v novih modulih z export žigom', () => {
    expect(labelsVir).toContain('export const tipMeritveLabels')
    expect(labelsVir).toContain('export const statusCycle')
    expect(labelsVir).toContain('export const enotaLabels')
    expect(labelsVir).toContain('R280 MANDATORY STIL')
    expect(labelsVir).toContain('R281 MANDATORY STIL')
    expect(labelsVir).toContain('R311 — žetoni')
    expect(formatVir).toContain('export function parseArMetadata')
    expect(formatVir).toContain('export function calculateStairDimensions')
    expect(formatVir).toContain('export function loadPrimaryUnit')
    expect(formatVir).toContain('P3 — avto-številčenje stebrov')
  })

  it('skupni tipi po NJIHOVI postavitvi (GroundType/AuditEntry v labels.ts, ArMetadata v format.ts — KOLIZIJA #13 dedovanje)', () => {
    expect(labelsVir).toContain('export type GroundType')
    expect(labelsVir).toContain('export interface AuditEntry')
    expect(formatVir).toContain('export interface ArMetadata')
    expect(labelsVir).toContain('R338 — dekompozicija measurements-tab FAZA 3')
  })

  it('sub-komponente (FAZA 1/R325) ostanejo nedotaknjene — nihče ne divergira', () => {
    expect(tab).toContain("from './measurements/laser-panel'")
    expect(tab).toContain("from './measurements/use-laser'")
    expect(tab).toContain("from './measurements/templates'")
    expect(tab).toContain('PREDLOGE,')
    expect(tab).toContain("from './measurements/shared'")
  })
})
