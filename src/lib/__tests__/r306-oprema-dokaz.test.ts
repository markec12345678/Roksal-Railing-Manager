// ---------------------------------------------------------------------------
// R306 — OPREMA CIKEL DOKAZ NA ZASLONU (36. člen 'izvozi' družine, P1,
// bralni ZASLONSKI član) — testi. Filter dokazi (samo akcijska oprema;
// dedovan pregledov red — NIČ re-sorta; kalNeZahteva/brezLokacije NISTA
// žiga) + iskren dvojni števec (vrstic = kosovi, ziga = vsota žigov — kos
// z več žigi ENA vrstica, N ≤ M) + EN VIR dokazi (žigi IDENTIČNI
// opremaCikelPregled vrstam — WYSIWYG s PDF R266/CSV R297) + fail-closed
// (ne-polje / pokvarjena vrsta / podvojen id) + STRAŽAR klientske čistosti
// + REALNIM logistics-tab (memo EN VIR refactor + zaslon blok + veje + žigi).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { opremaCikelDokaz, opremaZigi } from '../oprema-cikel-dokaz'
import {
  opremaCikelPregled,
  type OpremaCikelVnos,
  type OpremaCikelVrsta,
} from '../oprema-cikel-pdf'

/** ISTA oprema kot R297 brat testi (ENA družinska resnica — vse kalibracijske
 *  veje + nezabeležen pregled + zapadel pregled + brez lokacije). */
function kos(over: Partial<OpremaCikelVnos> & Pick<OpremaCikelVnos, 'id' | 'naziv'>): OpremaCikelVnos {
  return {
    tip: 'Ročno orodje',
    status: 'NA_VOLJO',
    lokacija: null,
    serijskaStevilka: null,
    lastInspectionAt: null,
    inspectionIntervalDays: null,
    nextInspectionAt: null,
    inspectionDue: false,
    inspectionUnknown: false,
    calibrationRequired: false,
    calibrationDueDate: null,
    calibrationCertificate: null,
    calibrationOverdue: false,
    calibrationMissing: false,
    zadnjiServis: null,
    assignmentsCount: 0,
    ...over,
  }
}

const OPREMA: OpremaCikelVnos[] = [
  kos({ id: 'e1', naziv: 'Laserni merilec', tip: 'Merska oprema', lokacija: 'Delavnica', lastInspectionAt: '2026-01-01T00:00:00.000Z', inspectionIntervalDays: 180, nextInspectionAt: '2026-06-30T00:00:00.000Z', inspectionDue: true, calibrationRequired: true, calibrationDueDate: '2026-08-01T00:00:00.000Z', calibrationOverdue: true, calibrationCertificate: 'CAL-01', assignmentsCount: 2 }),
  kos({ id: 'e2', naziv: 'Ladder A', status: 'IZGUBLJENO' }),
  kos({ id: 'e3', naziv: 'Blinker Set', status: 'V_UPORABI', tip: 'Merska oprema', inspectionIntervalDays: 90, inspectionUnknown: true, calibrationRequired: true, calibrationMissing: true, assignmentsCount: 1 }),
  kos({ id: 'e4', naziv: 'Viličar', status: 'V_SERVISU', tip: 'Prevoz', lokacija: 'Skladišče', lastInspectionAt: '2026-03-01T00:00:00.000Z', inspectionIntervalDays: 365, nextInspectionAt: '2027-03-01T00:00:00.000Z' }),
  kos({ id: 'e5', naziv: 'Stari kolesek', status: 'UPOKOJENO' }),
  kos({ id: 'e6', naziv: 'Ampèrmer', tip: 'Merska oprema', calibrationRequired: true, calibrationDueDate: '2026-12-01T00:00:00.000Z', calibrationCertificate: 'CAL-77' }),
]

const vrsteOsnova = (): OpremaCikelVrsta[] => opremaCikelPregled(OPREMA).vrste

const lib = readFileSync(resolve(__dirname, '../oprema-cikel-dokaz.ts'), 'utf8')
const komponenta = readFileSync(resolve(__dirname, '../../components/roksal/logistics-tab.tsx'), 'utf8')

describe('R306 — filter dokazi (samo akcijska oprema + dedovan red)', () => {
  it('vrstice = samo kosovi z vsaj enim od 4 žigov; dedovan pregledov red OHRANJEN (NIČ re-sorta — NAZIV ASC pregleda)', () => {
    const pregled = opremaCikelPregled(OPREMA)
    const razgled = opremaCikelDokaz(pregled.vrste)
    const pričakovani = pregled.vrste.filter((v) => opremaZigi(v) > 0)
    expect(razgled.vrstice).toEqual(pričakovani) // ISTI objekti, ISTI red
    expect(razgled.vrstice.map((v) => v.id)).toEqual(['e3', 'e1']) // NAZIV ASC pregleda: Blinker Set < Laserni merilec (Ampèrmer nima žiga)
  })

  it('iskren dvojni števec: vrstic = kosovi, ziga = vsota žigov; kos z več žigi = ENA vrstica (e1: zapadel pregled + potečena kalibracija; e3: nezabeležen + manjka rok — N < M)', () => {
    const razgled = opremaCikelDokaz(vrsteOsnova())
    expect(razgled.vrstic).toBe(2)
    expect(razgled.ziga).toBe(4) // e1 ×2 (pregledZapadel + kalPotecena) + e3 ×2 (pregledNezabelezen + kalManjkaRok)
    expect(razgled.vrstic).toBeLessThanOrEqual(razgled.ziga)
  })

  it('opremaZigi: točno 4 akcije; kalNeZahteva NI žig (nemerska — NI alarm); brezLokacije NI žig (higienski odpad)', () => {
    const pregled = opremaCikelPregled(OPREMA)
    const e1 = pregled.vrste.find((v) => v.id === 'e1')!
    const e2 = pregled.vrste.find((v) => v.id === 'e2')!
    const e6 = pregled.vrste.find((v) => v.id === 'e6')!
    expect(opremaZigi(e1)).toBe(2) // pregledZapadel + kalPotecena
    expect(opremaZigi(e2)).toBe(0) // IZGUBLJENO + brez lokacije — NI akcija
    expect(opremaZigi(e6)).toBe(0) // nemerska ('ne zahteva') + brez lokacije — NI alarm
    // identitetni dokaz: ziga = Σ opremaZigi(vrstice) — EN VIR štetje
    const razgled = opremaCikelDokaz(pregled.vrste)
    expect(razgled.ziga).toBe(razgled.vrstice.reduce((vs, v) => vs + opremaZigi(v), 0))
  })

  it('0 žigov = iskrena praznina (vrstice [], ziga 0 — zelen žig na zaslonu, nikoli skrit kanon R292)', () => {
    const pregled = opremaCikelPregled([
      kos({ id: 'a', naziv: 'Kos A', lokacija: 'Delavnica' }),
      kos({ id: 'b', naziv: 'Kos B', lokacija: 'Skladišče' }),
    ])
    const razgled = opremaCikelDokaz(pregled.vrste)
    expect(razgled.vrstice).toEqual([])
    expect(razgled.vrstic).toBe(0)
    expect(razgled.ziga).toBe(0)
  })

  it('opremaZigi fail-closed: pokvarjena vrsta → TypeError z imenom graditelja (string kanon — R302 lekcija 1)', () => {
    expect(() => opremaZigi(null as unknown as OpremaCikelVrsta)).toThrow(TypeError)
    expect(() => opremaZigi('ne-vrsta' as unknown as OpremaCikelVrsta)).toThrow(/opremaZigi:/)
    expect(() => opremaZigi({ naziv: 'brez id' } as unknown as OpremaCikelVrsta)).toThrow(/opremaZigi:/)
  })

  it('determinizem: isti pregled = ISTI razgled (filter f(pregled) — brez ure, brez slučaja)', () => {
    expect(opremaCikelDokaz(vrsteOsnova())).toEqual(opremaCikelDokaz(vrsteOsnova()))
  })
})

describe('R306 — EN VIR resnice (žigi IDENTIČNI pregledu R266 — WYSIWYG s PDF/CSV)', () => {
  it('žigi vrstic = žigi pregledovih vrst VERBATIM (isti objekti — nič pretvorbe; pariteta PDF R266/CSV R297 celic)', () => {
    const pregled = opremaCikelPregled(OPREMA)
    const razgled = opremaCikelDokaz(pregled.vrste)
    for (const v of razgled.vrstice) {
      const vir = pregled.vrste.find((x) => x.id === v.id)!
      expect(v.pregledZapadel).toBe(vir.pregledZapadel)
      expect(v.pregledNezabelezen).toBe(vir.pregledNezabelezen)
      expect(v.kalPotecena).toBe(vir.kalPotecena)
      expect(v.kalManjkaRok).toBe(vir.kalManjkaRok)
      expect(v.naslednjiPregled).toBe(vir.naslednjiPregled)
      expect(v.kalRok).toBe(vir.kalRok)
    }
    // particija: vsak pregledov kos je ALI v dokazu (žig > 0) ALI brez (žig = 0) — NIČ tretjega
    const vDokazu = new Set(razgled.vrstice.map((v) => v.id))
    for (const v of pregled.vrste) {
      expect(vDokazu.has(v.id)).toBe(opremaZigi(v) > 0)
    }
  })

  it('pokvarjeni statusi/status oznake pridejo VERBATIM iz pregleda (lib NE ustvarja lastnih oznak — OPREMA_STATUS_LABELI EN VIR)', () => {
    const razgled = opremaCikelDokaz(vrsteOsnova())
    const e3 = razgled.vrstice.find((v) => v.id === 'e3')!
    expect(e3.status).toBe('V uporabi')
    expect(e3.statusKoda).toBe('V_UPORABI')
  })
})

describe('R306 fail-closed (družinska pravila)', () => {
  it('ne-polje / pokvarjena vrsta (brez id) → TypeError', () => {
    expect(() => opremaCikelDokaz('ne-polje' as unknown as readonly OpremaCikelVrsta[])).toThrow(TypeError)
    expect(() => opremaCikelDokaz(null as unknown as readonly OpremaCikelVrsta[])).toThrow(TypeError)
    expect(() => opremaCikelDokaz([{ naziv: 'brez id' } as unknown as OpremaCikelVrsta])).toThrow(/neusklajena vrsta/)
  })

  it('podvojen id → TypeError (2. obramba — pregled R266 brani že sam; NIKOLI tiho združevanje)', () => {
    const vrste = vrsteOsnova()
    const e1 = vrste.find((v) => v.id === 'e1')!
    const podvojen = [...vrste, { ...e1 }]
    expect(() => opremaCikelDokaz(podvojen)).toThrow(/podvojen id opreme e1/)
  })
})

describe('R306 STRAŽAR ×2', () => {
  it('klientska čistost: lib NE uvaža @/lib/db + NE strežniške domene + NIČ lastnega sorta/ure/FNV (ČIST filter — pregled R266 EN VIR)', () => {
    expect(lib.includes('@/lib/db')).toBe(false)
    expect(lib.includes("from './schedule-conflicts'")).toBe(false)
    expect(lib).toContain("import type { OpremaCikelVrsta } from './oprema-cikel-pdf'")
    expect(lib.includes('.sort(')).toBe(false)
    expect(lib.includes('new Date(')).toBe(false)
    expect(lib.includes('fnv')).toBe(false)
    expect(lib.includes('export function opremaCikelPregled')).toBe(false)
  })

  it('REALNIM logistics-tab: memo EN VIR refactor (ENA izpeljava pregleda) + dokaz memo IZ istega pregleda + blok (testidi + aria + definicijski naslov pravila) + veje (sklep dvojni števec / zelen žig) + 4 žigi pariteta', () => {
    expect(komponenta.includes("from '@/lib/oprema-cikel-dokaz'")).toBe(true)
    expect(komponenta.includes('opremaCikelDokaz(opremaCikel.vrste)')).toBe(true) // EN VIR — iz memo pregleda
    expect(komponenta.includes('opremaCikelPregled(opremaCikelVhodi)')).toBe(true)
    // ENA izpeljava: NIČ drugega klica opremaCikelPregled v komponenti (EN VIR lekcija)
    expect((komponenta.match(/opremaCikelPregled\(opremaCikelVhodi\)/g) ?? []).length).toBe(1)
    expect(komponenta.includes('data-testid="oprema-cikel-dokaz"')).toBe(true)
    expect(komponenta.includes('data-testid="oprema-cikel-dokaz-prazno"')).toBe(true)
    expect(komponenta.includes('data-testid="oprema-cikel-dokaz-sklep"')).toBe(true)
    expect(komponenta.includes('aria-label="Oprema, ki potrebuje akcijo"')).toBe(true)
    expect(komponenta.includes('Oprema za poskrbeti')).toBe(true)
    expect(komponenta.includes('ISTI žigi kot Cikel PDF in Cikel CSV')).toBe(true) // definicijski naslov izreče PRAVILA
    expect(komponenta.includes('ZASLON = takoj na pogled')).toBe(true) // vidna razlika medija
    expect(komponenta.includes('Vrstic {opremaCikelDokazRazgled.vrstic} · žigov {opremaCikelDokazRazgled.ziga}.')).toBe(true)
    expect(komponenta.includes('je brez zapadlih pregledov in potečenih kalibracij.')).toBe(true) // zelen žig veja
    expect(komponenta.includes('pregled nezabeležen')).toBe(true) // AMBER žig
    expect(komponenta.includes('kalibracija brez roka')).toBe(true) // AMBER žig
    expect(komponenta.includes('kalibracija ne zahteva')).toBe(true) // sivo — NI alarm
    expect((komponenta.match(/bg-roksal-amber\/10/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })
})
