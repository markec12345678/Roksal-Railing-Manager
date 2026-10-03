// R402 — ČISTI TESTI FINANČNEGA STATUSNEGA STROJA RAČUNA (issue #13 §19).
// ---------------------------------------------------------------------------
// Brez baze, brez I/O — stroj je deterministična funkcija (ista lastnost
// kot project-state / decimal-policy jedra). Pokrivamo:
//   (1) nabor 9 statusov + izpeljana (DELNO_PLACAN/PLACAN) vs ročna množica;
//   (2) plačilna pot OSNUTEK→IZDAN→POSLAN→DELNO_PLACAN→PLACAN;
//   (3) izterjevalna pot IZDAN→ZAPADLO→OPOZORILO→IZTERJAVA (+ povratki);
//   (4) terminalna stanja: PLACAN samo v STORNIRAN, STORNIRAN nikamor;
//   (5) prepovedani preskoki (OSNUTEK→POSLAN, IZDAN→OPOZORILO, …) → 409;
//   (6) izpeljava plačilnega stanja v centih (0,1+0,2 meja — FP prah);
//   (7) povratni status po prekinitvi (rok/poslano/izdan — determinizem);
//   (8) VOID prehodi: samo deterministični povratki, nikoli v eskalacije.
import { describe, expect, it } from 'vitest'
import {
  DERIVED_INVOICE_STATUSES,
  INVOICE_ALLOWED_TRANSITIONS,
  InvalidInvoiceTransitionError,
  MANUAL_INVOICE_STATUSES,
  VOID_PREHODI,
  assertInvoiceTransition,
  assertInvoiceVoidTransition,
  invoiceTransitionAllowed,
  isDerivedInvoiceStatus,
  isInvoiceStatus,
  izpeljiPlacilniStatus,
  povratniStatusPoPrekinitvi,
  type InvoiceStatusValue,
} from '../invoice-lifecycle'

const VSI: InvoiceStatusValue[] = [
  'OSNUTEK',
  'IZDAN',
  'POSLAN',
  'DELNO_PLACAN',
  'PLACAN',
  'ZAPADLO',
  'OPOZORILO',
  'IZTERJAVA',
  'STORNIRAN',
]

function vrze409(from: string, to: string): boolean {
  try {
    assertInvoiceTransition(from, to)
    return false
  } catch (e) {
    return e instanceof InvalidInvoiceTransitionError && e.status === 409
  }
}

describe('R402 — finančni statusni stroj: nabor + množice', () => {
  it('nabor ima točno 9 statusov; ročna ∪ izpeljana = celota, presek prazen', () => {
    expect(Object.keys(INVOICE_ALLOWED_TRANSITIONS).sort()).toEqual([...VSI].sort())
    const rocne = new Set(MANUAL_INVOICE_STATUSES)
    const izpeljane = new Set(DERIVED_INVOICE_STATUSES)
    for (const s of VSI) {
      expect(rocne.has(s) !== izpeljane.has(s)).toBe(true) // natanko ena množica
    }
    expect([...izpeljane].sort()).toEqual(['DELNO_PLACAN', 'PLACAN'])
  })

  it('isInvoiceStatus prepozna vse, zavrne neznane', () => {
    for (const s of VSI) expect(isInvoiceStatus(s)).toBe(true)
    expect(isInvoiceStatus('IZDAN ')).toBe(false)
    expect(isInvoiceStatus('placan')).toBe(false)
    expect(isInvoiceStatus('ODPOVEDAN')).toBe(false)
  })

  it('izpeljana sta natanko DELNO_PLACAN in PLACAN', () => {
    expect(isDerivedInvoiceStatus('DELNO_PLACAN')).toBe(true)
    expect(isDerivedInvoiceStatus('PLACAN')).toBe(true)
    for (const s of VSI.filter((x) => x !== 'DELNO_PLACAN' && x !== 'PLACAN')) {
      expect(isDerivedInvoiceStatus(s)).toBe(false)
    }
  })
})

describe('R402 — plačilna pot (spec §19: ISSUED→SENT→PARTIALLY_PAID→PAID)', () => {
  it('OSNUTEK→IZDAN→POSLAN→DELNO_PLACAN→PLACAN je veljavna veriga', () => {
    expect(invoiceTransitionAllowed('OSNUTEK', 'IZDAN')).toBe(true)
    expect(invoiceTransitionAllowed('IZDAN', 'POSLAN')).toBe(true)
    expect(invoiceTransitionAllowed('POSLAN', 'DELNO_PLACAN')).toBe(true)
    expect(invoiceTransitionAllowed('DELNO_PLACAN', 'PLACAN')).toBe(true)
  })

  it('plačilo lahko pride iz VSAKEGA predplačilnega stanja (IZDAN/POSLAN/ZAPADLO/OPOZORILO/IZTERJAVA → DELNO_PLACAN/PLACAN)', () => {
    for (const from of ['IZDAN', 'POSLAN', 'ZAPADLO', 'OPOZORILO', 'IZTERJAVA'] as const) {
      expect(invoiceTransitionAllowed(from, 'DELNO_PLACAN')).toBe(true)
      expect(invoiceTransitionAllowed(from, 'PLACAN')).toBe(true)
    }
  })

  it('DELNO_PLACAN lahko eskalira v izterjevalno pot (delno plačilo ne ustavi opominov)', () => {
    for (const to of ['ZAPADLO', 'OPOZORILO', 'IZTERJAVA', 'STORNIRAN'] as const) {
      expect(invoiceTransitionAllowed('DELNO_PLACAN', to)).toBe(true)
    }
  })
})

describe('R402 — izterjevalna pot (spec §19: ISSUED→OVERDUE→REMINDER→COLLECTION)', () => {
  it('IZDAN→ZAPADLO→OPOZORILO→IZTERJAVA je veljavna veriga', () => {
    expect(invoiceTransitionAllowed('IZDAN', 'ZAPADLO')).toBe(true)
    expect(invoiceTransitionAllowed('ZAPADLO', 'OPOZORILO')).toBe(true)
    expect(invoiceTransitionAllowed('OPOZORILO', 'IZTERJAVA')).toBe(true)
  })

  it('POSLAN→ZAPADLO (poslan in neplačan preteče rok); OPOZORILO→ZAPADLO povratek', () => {
    expect(invoiceTransitionAllowed('POSLAN', 'ZAPADLO')).toBe(true)
    expect(invoiceTransitionAllowed('OPOZORILO', 'ZAPADLO')).toBe(true)
    expect(invoiceTransitionAllowed('IZTERJAVA', 'OPOZORILO')).toBe(true)
  })
})

describe('R402 — terminalna stanja + prepovedani preskoki', () => {
  it('STORNIRAN je terminalen; PLACAN se ročno LE še stornira', () => {
    expect(INVOICE_ALLOWED_TRANSITIONS.STORNIRAN).toEqual([])
    expect(INVOICE_ALLOWED_TRANSITIONS.PLACAN).toEqual(['STORNIRAN'])
  })

  it('preskoki → 409 z imenom dovoljenih naslednikov', () => {
    expect(vrze409('OSNUTEK', 'POSLAN')).toBe(true)
    expect(vrze409('OSNUTEK', 'PLACAN')).toBe(true)
    expect(vrze409('IZDAN', 'OPOZORILO')).toBe(true) // eskalacija samo prek ZAPADLO
    expect(vrze409('IZDAN', 'IZTERJAVA')).toBe(true)
    expect(vrze409('POSLAN', 'IZDAN')).toBe(true)
    expect(vrze409('ZAPADLO', 'POSLAN')).toBe(true)
    expect(vrze409('PLACAN', 'IZDAN')).toBe(true)
    expect(vrze409('PLACAN', 'ZAPADLO')).toBe(true)
    expect(vrze409('STORNIRAN', 'IZDAN')).toBe(true)
  })

  it('neznan status → 409 (obramba v globino — shema že validira)', () => {
    expect(vrze409('NEZNAN', 'IZDAN')).toBe(true)
    expect(vrze409('IZDAN', 'NEZNAN')).toBe(true)
  })

  it('sporočilo napake nosi dovoljene naslednike (isti stil kot project-state)', () => {
    try {
      assertInvoiceTransition('IZDAN', 'OPOZORILO')
      expect.unreachable('moralo bi vreči')
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidInvoiceTransitionError)
      const sporocilo = (e as Error).message
      expect(sporocilo).toContain('IZDAN → OPOZORILO')
      expect(sporocilo).toContain('POSLAN')
      expect(sporocilo).toContain('ZAPADLO')
    }
  })
})

describe('R402 — izpeljava plačilnega stanja (centi, FP varnost)', () => {
  it('0/null → brez plačila; 0 < vsota < znesek → DELNO_PLACAN; ≥ znesek → PLACAN', () => {
    expect(izpeljiPlacilniStatus(0, 100)).toBeNull()
    expect(izpeljiPlacilniStatus(0.01, 100)).toBe('DELNO_PLACAN')
    expect(izpeljiPlacilniStatus(50, 100)).toBe('DELNO_PLACAN')
    expect(izpeljiPlacilniStatus(100, 100)).toBe('PLACAN')
    expect(izpeljiPlacilniStatus(150, 100)).toBe('PLACAN')
    // Pogodba: vhodi so že zaokroženi po denarni politiki (2 decimalki) —
    // pod-centni vnos (0,001) se v centih zaokroži navzdol na 0 = brez plačila.
    expect(izpeljiPlacilniStatus(0.001, 100)).toBeNull()
  })

  it('FP meja: 0,1 + 0,2 = 0,3 točno (primerjava v centih, ne float ==)', () => {
    // float: 0,1 + 0,2 = 0,30000000000000004 — v centih je 30 == 30.
    const vsota = 0.1 + 0.2
    expect(izpeljiPlacilniStatus(vsota, 0.3)).toBe('PLACAN')
    expect(izpeljiPlacilniStatus(vsota - 0.05, 0.3)).toBe('DELNO_PLACAN')
  })
})

describe('R402 — povratni status po prekinitvi (determinizem iz diska)', () => {
  const osnova = { poslanoAt: null, datumIzdaje: new Date('2026-01-01T00:00:00Z'), rokPlacilaDni: 8 }

  it('rok pretekel → ZAPADLO (ne glede na poslanoAt)', () => {
    const now = new Date('2026-02-01T00:00:00Z')
    expect(povratniStatusPoPrekinitvi({ ...osnova }, now)).toBe('ZAPADLO')
    expect(povratniStatusPoPrekinitvi({ ...osnova, poslanoAt: new Date('2026-01-02T00:00:00Z') }, now)).toBe('ZAPADLO')
  })

  it('rok NI pretekel + poslanoAt → POSLAN; sicer IZDAN', () => {
    const now = new Date('2026-01-05T00:00:00Z') // rok: 9. januar
    expect(povratniStatusPoPrekinitvi({ ...osnova, poslanoAt: new Date('2026-01-02T00:00:00Z') }, now)).toBe('POSLAN')
    expect(povratniStatusPoPrekinitvi({ ...osnova }, now)).toBe('IZDAN')
  })

  it('meja roka je EKSKLUZIVNA (rok == now → še ni zapadlo)', () => {
    const now = new Date('2026-01-09T00:00:00Z')
    expect(povratniStatusPoPrekinitvi({ ...osnova }, now)).toBe('IZDAN')
  })
})

describe('R402 — VOID prehodi (samo prek prekinitve plačila)', () => {
  it('VOID_PREHODI = deterministični povratki (DELNO_PLACAN/ZAPADLO/POSLAN/IZDAN)', () => {
    expect([...VOID_PREHODI].sort()).toEqual(['DELNO_PLACAN', 'IZDAN', 'POSLAN', 'ZAPADLO'])
  })

  it('prekinitev lahko odpre PLACAN (ročni PATCH NE more — ločena množica)', () => {
    expect(() => assertInvoiceVoidTransition('PLACAN', 'DELNO_PLACAN')).not.toThrow()
    expect(() => assertInvoiceVoidTransition('PLACAN', 'POSLAN')).not.toThrow()
    expect(() => assertInvoiceVoidTransition('PLACAN', 'IZDAN')).not.toThrow()
    // ISTA smer prek ROČNEGA stroja je zavrnjena (klient ne more lažno odpreti):
    expect(vrze409('PLACAN', 'DELNO_PLACAN')).toBe(true)
    expect(vrze409('PLACAN', 'POSLAN')).toBe(true)
    expect(vrze409('PLACAN', 'IZDAN')).toBe(true)
  })

  it('prekinitev NIKOLI v eskalacije/terminalna (OPOZORILO/IZTERJAVA/STORNIRAN/PLACAN)', () => {
    for (const to of ['OPOZORILO', 'IZTERJAVA', 'STORNIRAN', 'PLACAN'] as const) {
      expect(() => assertInvoiceVoidTransition('PLACAN', to)).toThrow(InvalidInvoiceTransitionError)
      expect(() => assertInvoiceVoidTransition('DELNO_PLACAN', to)).toThrow(InvalidInvoiceTransitionError)
    }
  })
})
