// R378 — ČISTO JESTRO PROIZVODNJE IN AS-INSTALLED (issue #13, korak R167 iz
// §9/§10) — statusni stroji + izpeljave BREZ baze (determinizem, fail-closed).
// ---------------------------------------------------------------------------
//   (1) matrika prehodov proizvodnega naročila: VSAK dovoljen ROB (življenjski
//       cikel §10 + izidi) + vzorci IZRECNO PREPOVEDANIH robov (preskok
//       izpusta, lažni REWORK pred izdelavo, oživljanje terminalcev);
//   (2) terminalni statusi + requiresTransitionReason (SAMO izidi);
//   (3) rework zanka: IN_PRODUCTION → REWORK → IN_PRODUCTION (§10 izrecno);
//   (4) operacijska matrika (PLANNED→IN_PROGRESS→DONE|FAILED; FAILED→PLANNED);
//   (5) matrika as-installed: DRAFT→POTRJENO terminalno;
//   (6) productionOrderLinesFromBom: determinizem (bajtno), snapshot planned,
//       fail-closed (prazno/qty≤0/podvojen id/prazen SKU);
//   (7) installationRecordLinesFromInputs: fail-closed (qty 0, dup bomLineId,
//       dvojniki NULL bomLineId DOVOLJENI — vgrajen izven-BOM material),
//       wasteQty NULL/≥ 0, note;
//   (8) installationRecordDefectsFromInput: opomba obvezna, reseno boolean;
//   (9) STRAŽAR GEOMETRIJE (§10): modul NE uvaža railing-layout/quote —
//       produkcija ne sme ponovno izračunavati geometrije (vir modula).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  INSTALLATION_RECORD_STATUSES,
  INSTALLATION_RECORD_TRANSITIONS,
  MAX_INSTALLATION_RECORD_LINES,
  PRODUCTION_OPERATION_TRANSITIONS,
  PRODUCTION_ORDER_OUTCOMES,
  PRODUCTION_ORDER_PRIORITIES,
  PRODUCTION_ORDER_STATUSES,
  PRODUCTION_ORDER_TRANSITIONS,
  ProductionOrdersError,
  checkInstallationRecordTransition,
  checkProductionOperationTransition,
  checkProductionOrderTransition,
  installationRecordDefectsFromInput,
  installationRecordLinesFromInputs,
  isTerminalInstallationStatus,
  isTerminalProductionStatus,
  productionOrderLinesFromBom,
  requiresTransitionReason,
} from '../production-orders'

const VIR_PRODUCTION_ORDERS = readFileSync(
  fileURLToPath(new URL('../production-orders.ts', import.meta.url)),
  'utf-8',
)

describe('R378 — matrika prehodov proizvodnega naročila (§10)', () => {
  it('življenjski cikel po verigi: PLANNED→RELEASED→IN_PRODUCTION→QC→PRODUCED→READY_FOR_INSTALLATION', () => {
    const veriga: [string, string][] = [
      ['PLANNED', 'RELEASED'],
      ['RELEASED', 'IN_PRODUCTION'],
      ['IN_PRODUCTION', 'QC'],
      ['QC', 'PRODUCED'],
      ['PRODUCED', 'READY_FOR_INSTALLATION'],
    ]
    for (const [od, do_] of veriga) {
      expect(checkProductionOrderTransition(od, do_).ok).toBe(true)
    }
  })

  it('izidi (REWORK/REJECTED/SCRAPPED/REPLACED) dosegljivi iz živih stanj po matriki', () => {
    // SCRAPPED/REPLACED iz VSEH živih stanj (dokončna odpis/nadomestitev):
    for (const od of ['PLANNED', 'RELEASED', 'IN_PRODUCTION', 'QC', 'PRODUCED', 'READY_FOR_INSTALLATION', 'REWORK']) {
      expect(checkProductionOrderTransition(od, 'SCRAPPED').ok).toBe(true)
      expect(checkProductionOrderTransition(od, 'REPLACED').ok).toBe(true)
    }
    // REWORK samo kjer je KAJ popravljati (izdelano ali v izdelavi):
    for (const od of ['IN_PRODUCTION', 'QC', 'PRODUCED', 'READY_FOR_INSTALLATION']) {
      expect(checkProductionOrderTransition(od, 'REWORK').ok).toBe(true)
    }
    // REJECTED SAMO iz QC (kontrola neuspešna — §10):
    expect(checkProductionOrderTransition('QC', 'REJECTED').ok).toBe(true)
  })

  it('IZRECNO PREPOVEDANI robovi: preskok izpusta, lažni REWORK, oživljanje terminalcev', () => {
    // PLANNED → IN_PRODUCTION (preskok izpusta — kdo je odobril izvedbo?):
    expect(checkProductionOrderTransition('PLANNED', 'IN_PRODUCTION').ok).toBe(false)
    // PLANNED/RELEASED → REWORK (nič izdelanega ni kaj popravljati — laž):
    expect(checkProductionOrderTransition('PLANNED', 'REWORK').ok).toBe(false)
    expect(checkProductionOrderTransition('RELEASED', 'REWORK').ok).toBe(false)
    // REWORK → QC (preskok — §10 določa POVRATEK v IN_PRODUCTION):
    expect(checkProductionOrderTransition('REWORK', 'QC').ok).toBe(false)
    // PRODUCED → REJECTED (kontrola je ŽE uspešno prestala):
    expect(checkProductionOrderTransition('PRODUCED', 'REJECTED').ok).toBe(false)
    // Terminalci ne oživijo (noben prehod iz REJECTED/SCRAPPED/REPLACED):
    for (const terminal of ['REJECTED', 'SCRAPPED', 'REPLACED']) {
      for (const do_ of PRODUCTION_ORDER_STATUSES) {
        expect(checkProductionOrderTransition(terminal, do_).ok).toBe(false)
      }
    }
  })

  it('nazaj-paženi prehodi so prepovedani (usmerjen naprej — revizijska sled)', () => {
    expect(checkProductionOrderTransition('IN_PRODUCTION', 'RELEASED').ok).toBe(false)
    expect(checkProductionOrderTransition('QC', 'IN_PRODUCTION').ok).toBe(false)
    expect(checkProductionOrderTransition('PRODUCED', 'QC').ok).toBe(false)
    expect(checkProductionOrderTransition('READY_FOR_INSTALLATION', 'PRODUCED').ok).toBe(false)
  })

  it('terminalni statusi so natanko REJECTED/SCRAPPED/REPLACED', () => {
    for (const s of PRODUCTION_ORDER_STATUSES) {
      const terminal = ['REJECTED', 'SCRAPPED', 'REPLACED'].includes(s)
      expect(isTerminalProductionStatus(s)).toBe(terminal)
    }
  })

  it('razlog zahtevajo SAMO izidi (naprej-paženi prehodi ne)', () => {
    for (const izid of PRODUCTION_ORDER_OUTCOMES) {
      expect(requiresTransitionReason(izid)).toBe(true)
    }
    for (const naprej of ['RELEASED', 'IN_PRODUCTION', 'QC', 'PRODUCED', 'READY_FOR_INSTALLATION']) {
      expect(requiresTransitionReason(naprej)).toBe(false)
    }
  })

  it('rework zanka: REWORK → IN_PRODUCTION ( popravek se VRAČA v proizvodnjo)', () => {
    expect(PRODUCTION_ORDER_TRANSITIONS.REWORK).toEqual(['IN_PRODUCTION', 'SCRAPPED', 'REPLACED'])
    // Polna zanka IN_PRODUCTION→REWORK→IN_PRODUCTION je možna:
    expect(checkProductionOrderTransition('IN_PRODUCTION', 'REWORK').ok).toBe(true)
    expect(checkProductionOrderTransition('REWORK', 'IN_PRODUCTION').ok).toBe(true)
  })

  it('neznan status → prazen seznam dovoljenih (fail-closed, ne strožji od tabele)', () => {
    expect(PRODUCTION_ORDER_TRANSITIONS[('NEZNAN' as never)]).toBeUndefined()
    expect(checkProductionOrderTransition('NEZNAN', 'RELEASED').ok).toBe(false)
  })
})

describe('R378 — operacijska matrika (§10)', () => {
  it('PLANNED→IN_PROGRESS→DONE|FAILED; FAILED→PLANNED (ponovni poskus); DONE terminalen', () => {
    expect(checkProductionOperationTransition('PLANNED', 'IN_PROGRESS').ok).toBe(true)
    expect(checkProductionOperationTransition('PLANNED', 'DONE').ok).toBe(false)
    expect(checkProductionOperationTransition('IN_PROGRESS', 'DONE').ok).toBe(true)
    expect(checkProductionOperationTransition('IN_PROGRESS', 'FAILED').ok).toBe(true)
    expect(checkProductionOperationTransition('FAILED', 'PLANNED').ok).toBe(true)
    expect(checkProductionOperationTransition('DONE', 'PLANNED').ok).toBe(false)
    expect(PRODUCTION_OPERATION_TRANSITIONS.DONE).toEqual([])
  })
})

describe('R378 — matrika as-installed zapisa (§9)', () => {
  it('DRAFT→POTRJENO je edini prehod; POTRJENO terminalno', () => {
    expect(INSTALLATION_RECORD_STATUSES).toEqual(['DRAFT', 'POTRJENO'])
    expect(checkInstallationRecordTransition('DRAFT', 'POTRJENO').ok).toBe(true)
    expect(checkInstallationRecordTransition('POTRJENO', 'DRAFT').ok).toBe(false)
    expect(INSTALLATION_RECORD_TRANSITIONS.POTRJENO).toEqual([])
    expect(isTerminalInstallationStatus('POTRJENO')).toBe(true)
    expect(isTerminalInstallationStatus('DRAFT')).toBe(false)
  })
})

describe('R378 — productionOrderLinesFromBom: snapshoti + determinizem (§10)', () => {
  const Vrstice = [
    { id: 'bl-1', lineOrder: 1, internalSku: 'SIDRA', quantity: 12, unit: 'kos' },
    { id: 'bl-2', lineOrder: 2, internalSku: 'STK-1323-860', quantity: 3.5, unit: 'm2' },
  ]

  it('izpeljava: planned = snapshot quantity, produced/rejected/scrapped = 0, remaining = planned', () => {
    const izpeljane = productionOrderLinesFromBom(Vrstice)
    expect(izdelanoUjemanje(izpeljane, Vrstice)).toBe(true)
    expect(izpeljane[0]).toEqual({
      bomLineId: 'bl-1',
      lineOrder: 1,
      internalSku: 'SIDRA',
      plannedQty: 12,
      unit: 'kos',
      producedQty: 0,
      rejectedQty: 0,
      scrappedQty: 0,
      remainingQty: 12,
    })
    expect(izpeljane[1]!.plannedQty).toBe(3.5)
    expect(izpeljane[1]!.remainingQty).toBe(3.5)
  })

  it('determinizem: isti vhodi (ISTI VRSTNI RED) → BAJTNO identične vrstice', () => {
    const a = JSON.stringify(productionOrderLinesFromBom(Vrstice))
    const b = JSON.stringify(productionOrderLinesFromBom(Vrstice))
    expect(a).toBe(b)
  })

  it('fail-closed: prazen seznam / qty ≤ 0 / podvojen id / prazen SKU ali enota', () => {
    expect(() => productionOrderLinesFromBom([])).toThrow(ProductionOrdersError)
    expect(() =>
      productionOrderLinesFromBom([{ id: 'bl-1', lineOrder: 1, internalSku: 'X', quantity: 0, unit: 'kos' }]),
    ).toThrow(/neveljavno količino/)
    expect(() =>
      productionOrderLinesFromBom([...Vrstice, { id: 'bl-1', lineOrder: 3, internalSku: 'Y', quantity: 1, unit: 'kos' }]),
    ).toThrow(/podvaja id/)
    expect(() =>
      productionOrderLinesFromBom([{ id: 'bl-1', lineOrder: 1, internalSku: '', quantity: 1, unit: 'kos' }]),
    ).toThrow(/internalSku/)
    expect(() =>
      productionOrderLinesFromBom([{ id: 'bl-1', lineOrder: 1, internalSku: 'X', quantity: 1, unit: '' }]),
    ).toThrow(/enote/)
    expect(() =>
      productionOrderLinesFromBom([{ id: 'bl-1', lineOrder: 1, internalSku: 'X', quantity: Number.NaN, unit: 'kos' }]),
    ).toThrow(/neveljavno količino/)
  })
})

describe('R378 — installationRecordLinesFromInputs: fail-closed validacija (§9)', () => {
  it('veljavne vrstice: vezana + neizvirščan material (bomLineId NULL) + wasteQty NULL', () => {
    const vrstice = installationRecordLinesFromInputs([
      { bomLineId: 'bl-1', internalSku: 'SIDRA', installedQty: 11, unit: 'kos', wasteQty: 1, note: 'en konec poškodovan' },
      { bomLineId: null, internalSku: 'IZVENSKI-VIJAK', installedQty: 4, unit: 'kos' },
    ])
    expect(vrstice).toHaveLength(2)
    expect(vrstice[0]).toEqual({
      bomLineId: 'bl-1',
      internalSku: 'SIDRA',
      installedQty: 11,
      unit: 'kos',
      wasteQty: 1,
      note: 'en konec poškodovan',
    })
    expect(vrstice[1]!.bomLineId).toBeNull()
    expect(vrstice[1]!.wasteQty).toBeNull()
    expect(vrstice[1]!.note).toBeNull()
  })

  it('prazen seznam ni resnica (§9) — zapis brez vrstic ne dokazuje ničesar', () => {
    expect(() => installationRecordLinesFromInputs([])).toThrow(/brez vrstic ni resnica/)
    expect(() => installationRecordLinesFromInputs('ne-seznam')).toThrow(/seznam/)
  })

  it('installedQty ≤ 0 je laž — zavrnjeno', () => {
    expect(() =>
      installationRecordLinesFromInputs([{ bomLineId: null, internalSku: 'X', installedQty: 0, unit: 'kos' }]),
    ).toThrow(/količino/)
    expect(() =>
      installationRecordLinesFromInputs([{ bomLineId: null, internalSku: 'X', installedQty: -1, unit: 'kos' }]),
    ).toThrow(/količino/)
  })

  it('podvojen NE-NULL bomLineId zavrnjen (dvojni števec bi pokvaril §9 verigo); dvojniki NULL DOVOLJENI', () => {
    expect(() =>
      installationRecordLinesFromInputs([
        { bomLineId: 'bl-1', internalSku: 'A', installedQty: 1, unit: 'kos' },
        { bomLineId: 'bl-1', internalSku: 'A', installedQty: 2, unit: 'kos' },
      ]),
    ).toThrow(/podvaja bomLineId/)
    // Dva neizvirščana materiala z ISTIM SKU-jem sta legitimen vnos
    // (nemata števca v verigi):
    const ok = installationRecordLinesFromInputs([
      { bomLineId: null, internalSku: 'IZVENSKI', installedQty: 1, unit: 'kos' },
      { bomLineId: null, internalSku: 'IZVENSKI', installedQty: 2, unit: 'kos' },
    ])
    expect(ok).toHaveLength(2)
  })

  it('wasteQty negativen zavrnjen (§8 ≥ 0); note: odsoten → NULL, sam presledki → napaka', () => {
    expect(() =>
      installationRecordLinesFromInputs([{ bomLineId: null, internalSku: 'X', installedQty: 1, unit: 'kos', wasteQty: -0.5 }]),
    ).toThrow(/odpadek/)
    // Opomba je izrecno NULL ali NEPRAZNA (≤ 500) — sami presledki so
    // zavrnjeni (fail-closed, ne tiho pobrisani):
    expect(() =>
      installationRecordLinesFromInputs([{ bomLineId: null, internalSku: 'X', installedQty: 1, unit: 'kos', note: '   ' }]),
    ).toThrow(/Opomba/)
    const v = installationRecordLinesFromInputs([
      { bomLineId: null, internalSku: 'X', installedQty: 1, unit: 'kos' },
    ])
    expect(v[0]!.note).toBeNull()
  })

  it(`strop ${MAX_INSTALLATION_RECORD_LINES} vrstic — nad mejo javna napaka`, () => {
    const mnogo = Array.from({ length: MAX_INSTALLATION_RECORD_LINES + 1 }, (_, i) => ({
      bomLineId: null,
      internalSku: `IZV-${i}`,
      installedQty: 1,
      unit: 'kos',
    }))
    expect(() => installationRecordLinesFromInputs(mnogo)).toThrow(/Največ/)
  })
})

describe('R378 — installationRecordDefectsFromInput (§9 napake)', () => {
  it('NULL/undefined → prazen seznam (ni napak — iskrena praznina)', () => {
    expect(installationRecordDefectsFromInput(null)).toEqual([])
    expect(installationRecordDefectsFromInput(undefined)).toEqual([])
  })

  it('obvezna opomba + reseno boolean — fail-closed', () => {
    expect(() => installationRecordDefectsFromInput([{ reseno: true }])).toThrow(/opombe/)
    expect(() => installationRecordDefectsFromInput([{ opomba: 'praska', reseno: 'ja' }])).toThrow(/reseno/)
    const ok = installationRecordDefectsFromInput([{ opomba: 'praska na steklu', reseno: false }])
    expect(ok).toEqual([{ opomba: 'praska na steklu', reseno: false }])
  })
})

describe('R378 — STRAŽAR GEOMETRIJE (§10: produkcija NE izračunava)', () => {
  it('modul production-orders NE uvaža railing-layout / quote (vir modula, ne beseda)', () => {
    expect(VIR_PRODUCTION_ORDERS).not.toContain(`from '../railing-layout'`)
    expect(VIR_PRODUCTION_ORDERS).not.toContain(`from './railing-layout'`)
    expect(VIR_PRODUCTION_ORDERS).not.toContain(`from '../quote'`)
    expect(VIR_PRODUCTION_ORDERS).not.toContain(`from './quote'`)
    expect(VIR_PRODUCTION_ORDERS).not.toContain(`from '../quote-versions'`)
    expect(VIR_PRODUCTION_ORDERS).not.toContain(`from './quote-versions'`)
  })

  it('prioritete so natanko tri (NIZKA/NORMALNA/URGENTNO — iskreni nivoji)', () => {
    expect(PRODUCTION_ORDER_PRIORITIES).toEqual(['NIZKA', 'NORMALNA', 'URGENTNO'])
  })
})

/** Pomoč: izpeljane vrstice se ujemajo z vhodom po vrstnem redu (snapshoti). */
function izdelanoUjemanje(
  izpeljane: ReturnType<typeof productionOrderLinesFromBom>,
  vhod: readonly { id: string; internalSku: string; quantity: number; unit: string }[],
): boolean {
  if (izpeljane.length !== vhod.length) return false
  return izpeljane.every((l, i) => l.bomLineId === vhod[i]!.id && l.internalSku === vhod[i]!.internalSku && l.unit === vhod[i]!.unit)
}
