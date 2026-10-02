// R382 — ČISTO JEDRO CRM LIJAKOV (issue #13, korak R169 iz §13) — matrike +
// validacije BREZ baze (determinizem, fail-closed).
// ---------------------------------------------------------------------------
//   (1) matrika prehodov SLEADA: dovoljeni robovi + terminalnost
//       (PRETVORJEN/ZAVRNJEN ne oživijo) + nazaj-pažne prepovedi;
//   (2) matrika stage-ov PRiložnosti §13 EXACT: polna veriga +preskoki
//       (NEW→SITE_SURVEY/NEW→QUOTE — prisiljevanje lažnih vmesnih korakov
//       bi bilo laž), LOST iz VSAKEGA živega stage-a, ACCEPTED samo iz
//       QUOTE/FOLLOW_UP;
//   (3) IZRECNO PREPOVEDANI robovi: NEW→ACCEPTED ("sprejeli nič"), vsi
//       nazaj-pažni, ACCEPTED→LOST (razpad sprejetega posla živi na
//       Projektu, ne v prepisu CRM zgodovine), terminalci ne oživijo;
//   (4) requiresLossReason (SAMO LOST) + requiresProjectConversion (SAMO
//       ACCEPTED);
//   (5) validateVerjetnost: 0–100 celo ali null (§13 "CRM polje brez
//       poslovne logike" — mnenje, ne napoved);
//   (6) naslovi: validateCustomerAddressType (EXACT, ne fuzzy) +
//       razdeliNaslovePoTipih (fail-closed na neznan tip iz baze);
//   (7) VIR MODULA (stražar): crm-pipeline NE uvaža db/next — čisto jedro.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  CUSTOMER_ADDRESS_TYPES,
  LEAD_ENQUIRY_TYPES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  LEAD_TRANSITIONS,
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_ORDER,
  OPPORTUNITY_TRANSITIONS,
  checkLeadTransition,
  checkOpportunityStageTransition,
  isTerminalLeadStatus,
  isTerminalOpportunityStage,
  razdeliNaslovePoTipih,
  requiresLossReason,
  requiresProjectConversion,
  validateCustomerAddressType,
  validateVerjetnost,
} from '../crm-pipeline'

const VIR_CRM_PIPELINE = readFileSync(
  fileURLToPath(new URL('../crm-pipeline.ts', import.meta.url)),
  'utf-8',
)

describe('R382 — matrika prehodov SLEADA (PREDkvalifikacija)', () => {
  it('dovoljeni robovi: NOV→{KONTAKTIRAN,PRETVORJEN,ZAVRNJEN}, KONTAKTIRAN→{PRETVORJEN,ZAVRNJEN}', () => {
    expect(checkLeadTransition('NOV', 'KONTAKTIRAN').ok).toBe(true)
    expect(checkLeadTransition('NOV', 'PRETVORJEN').ok).toBe(true)
    expect(checkLeadTransition('NOV', 'ZAVRNJEN').ok).toBe(true)
    expect(checkLeadTransition('KONTAKTIRAN', 'PRETVORJEN').ok).toBe(true)
    expect(checkLeadTransition('KONTAKTIRAN', 'ZAVRNJEN').ok).toBe(true)
  })

  it('nazaj-pažni in preskočeni robovi so prepovedani (usmerjen naprej)', () => {
    expect(checkLeadTransition('KONTAKTIRAN', 'NOV').ok).toBe(false)
    expect(checkLeadTransition('PRETVORJEN', 'NOV').ok).toBe(false)
    expect(checkLeadTransition('ZAVRNJEN', 'KONTAKTIRAN').ok).toBe(false)
  })

  it('terminalna stanja (PRETVORJEN/ZAVRNJEN) nimajo izhodnih robov', () => {
    expect(LEAD_TRANSITIONS.PRETVORJEN).toEqual([])
    expect(LEAD_TRANSITIONS.ZAVRNJEN).toEqual([])
    expect(isTerminalLeadStatus('PRETVORJEN')).toBe(true)
    expect(isTerminalLeadStatus('ZAVRNJEN')).toBe(true)
    expect(isTerminalLeadStatus('NOV')).toBe(false)
    expect(isTerminalLeadStatus('KONTAKTIRAN')).toBe(false)
    // Neznan status → PRAZEN seznam (fail-closed: neznan vir nima dovoljenih
    // prehodov — vsak poskus spremembe se odbije, ne pa tiho "vse gre"):
    expect(isTerminalLeadStatus('NEZNAN-STATUS')).toBe(true)
  })

  it('nabor statusov je točno NOV|KONTAKTIRAN|PRETVORJEN|ZAVRNJEN', () => {
    expect([...LEAD_STATUSES]).toEqual(['NOV', 'KONTAKTIRAN', 'PRETVORJEN', 'ZAVRNJEN'])
  })
})

describe('R382 — matrika stage-ov PRiložnosti (§13 lifecycle EXACT)', () => {
  it('polna veriga NEW→CONTACTED→SITE_SURVEY→QUOTE→FOLLOW_UP→ACCEPTED', () => {
    const veriga: [string, string][] = [
      ['NEW', 'CONTACTED'],
      ['CONTACTED', 'SITE_SURVEY'],
      ['SITE_SURVEY', 'QUOTE'],
      ['QUOTE', 'FOLLOW_UP'],
      ['FOLLOW_UP', 'ACCEPTED'],
    ]
    for (const [od, do_] of veriga) {
      expect(checkOpportunityStageTransition(od, do_).ok).toBe(true)
    }
    // Zaporedje stage-ov narašča po verigi (smer = naprej):
    for (let i = 1; i < OPPORTUNITY_STAGES.length - 1; i += 1) {
      expect(
        OPPORTUNITY_STAGE_ORDER[OPPORTUNITY_STAGES[i] as keyof typeof OPPORTUNITY_STAGE_ORDER],
      ).toBeGreaterThan(
        OPPORTUNITY_STAGE_ORDER[OPPORTUNITY_STAGES[i - 1] as keyof typeof OPPORTUNITY_STAGE_ORDER],
      )
    }
  })

  it('preskoki naprej so DOVOLJENI (stranka pride z ogledom/merami že opravljenimi)', () => {
    expect(checkOpportunityStageTransition('NEW', 'SITE_SURVEY').ok).toBe(true)
    expect(checkOpportunityStageTransition('NEW', 'QUOTE').ok).toBe(true)
    expect(checkOpportunityStageTransition('NEW', 'FOLLOW_UP').ok).toBe(true)
    expect(checkOpportunityStageTransition('CONTACTED', 'QUOTE').ok).toBe(true)
    expect(checkOpportunityStageTransition('SITE_SURVEY', 'FOLLOW_UP').ok).toBe(true)
  })

  it('LOST je dosegljiv iz VSAKEGA živega stage-a (stranka lahko odkloni kdarkoli)', () => {
    for (const od of ['NEW', 'CONTACTED', 'SITE_SURVEY', 'QUOTE', 'FOLLOW_UP']) {
      expect(checkOpportunityStageTransition(od, 'LOST').ok).toBe(true)
    }
  })

  it('ACCEPTED samo iz QUOTE|FOLLOW_UP (sprejeti se da PONUDBO — ne "nič")', () => {
    expect(checkOpportunityStageTransition('QUOTE', 'ACCEPTED').ok).toBe(true)
    expect(checkOpportunityStageTransition('FOLLOW_UP', 'ACCEPTED').ok).toBe(true)
    expect(checkOpportunityStageTransition('NEW', 'ACCEPTED').ok).toBe(false)
    expect(checkOpportunityStageTransition('CONTACTED', 'ACCEPTED').ok).toBe(false)
    expect(checkOpportunityStageTransition('SITE_SURVEY', 'ACCEPTED').ok).toBe(false)
  })

  it('IZRECNO PREPOVEDANI robovi: nazaj, ACCEPTED→LOST, oživljanje terminalcev', () => {
    // Nazaj-pažno (revizijska sled je usmerjena naprej):
    expect(checkOpportunityStageTransition('FOLLOW_UP', 'QUOTE').ok).toBe(false)
    expect(checkOpportunityStageTransition('QUOTE', 'SITE_SURVEY').ok).toBe(false)
    expect(checkOpportunityStageTransition('CONTACTED', 'NEW').ok).toBe(false)
    // Sprejet posel, ki razpade, je realnost PROJEKTA, ne prepis zgodovine:
    expect(checkOpportunityStageTransition('ACCEPTED', 'LOST').ok).toBe(false)
    // Terminalci ne oživijo (nova pogajanja = NOVA priložnost):
    for (const terminal of ['ACCEPTED', 'LOST']) {
      for (const do_ of OPPORTUNITY_STAGES) {
        expect(checkOpportunityStageTransition(terminal, do_).ok).toBe(false)
      }
    }
  })

  it('terminalnost: ACCEPTED in LOST sta mrtvi (prazni matrični vrstici)', () => {
    expect(OPPORTUNITY_TRANSITIONS.ACCEPTED).toEqual([])
    expect(OPPORTUNITY_TRANSITIONS.LOST).toEqual([])
    expect(isTerminalOpportunityStage('ACCEPTED')).toBe(true)
    expect(isTerminalOpportunityStage('LOST')).toBe(true)
    expect(isTerminalOpportunityStage('QUOTE')).toBe(false)
  })

  it('nabor stage-ov je TOČNO §13 lifecycle (EXACT iz speca)', () => {
    expect([...OPPORTUNITY_STAGES]).toEqual([
      'NEW',
      'CONTACTED',
      'SITE_SURVEY',
      'QUOTE',
      'FOLLOW_UP',
      'ACCEPTED',
      'LOST',
    ])
  })
})

describe('R382 — razlog izgube + pretvorba (§13 obligations)', () => {
  it('requiresLossReason: SAMO LOST (naprej-pažni prehodi razloga ne zahtevajo)', () => {
    for (const do_ of ['NEW', 'CONTACTED', 'SITE_SURVEY', 'QUOTE', 'FOLLOW_UP', 'ACCEPTED']) {
      expect(requiresLossReason(do_)).toBe(false)
    }
    expect(requiresLossReason('LOST')).toBe(true)
  })

  it('requiresProjectConversion: SAMO ACCEPTED', () => {
    for (const do_ of ['NEW', 'CONTACTED', 'SITE_SURVEY', 'QUOTE', 'FOLLOW_UP', 'LOST']) {
      expect(requiresProjectConversion(do_)).toBe(false)
    }
    expect(requiresProjectConversion('ACCEPTED')).toBe(true)
  })
})

describe('R382 — verjetnost (§13 "CRM polje BREZ poslovne logike")', () => {
  it('veljavne vrednosti: 0, 50, 100 (meje vključno) + null', () => {
    expect(validateVerjetnost(0)).toEqual({ ok: true, value: 0 })
    expect(validateVerjetnost(50)).toEqual({ ok: true, value: 50 })
    expect(validateVerjetnost(100)).toEqual({ ok: true, value: 100 })
    expect(validateVerjetnost(null)).toEqual({ ok: true, value: null })
    expect(validateVerjetnost(undefined)).toEqual({ ok: true, value: null })
  })

  it('meje so OMEJENE: 101 in -1 → javna napaka (fail-closed)', () => {
    const prevec = validateVerjetnost(101)
    expect(prevec.ok).toBe(false)
    if (!prevec.ok) {
      expect(prevec.error).toContain('100')
    }
    expect(validateVerjetnost(-1).ok).toBe(false)
  })

  it('necelo število ali tip ≠ number → javna napaka (mnenje je celo število)', () => {
    expect(validateVerjetnost(1.5).ok).toBe(false)
    expect(validateVerjetnost('50').ok).toBe(false)
    expect(validateVerjetnost(true).ok).toBe(false)
  })
})

describe('R382 — naslovi stranke (§13 ločitev na tri tipe)', () => {
  it('nabor tipov je TOČNO KONTAKTNI|RACUNSKI|MONTAZNI', () => {
    expect([...CUSTOMER_ADDRESS_TYPES]).toEqual(['KONTAKTNI', 'RACUNSKI', 'MONTAZNI'])
  })

  it('validateCustomerAddressType: EXACT (ne fuzzy, ne case-fold)', () => {
    expect(validateCustomerAddressType('KONTAKTNI')).toEqual({ ok: true, value: 'KONTAKTNI' })
    expect(validateCustomerAddressType('RACUNSKI')).toEqual({ ok: true, value: 'RACUNSKI' })
    expect(validateCustomerAddressType('MONTAZNI')).toEqual({ ok: true, value: 'MONTAZNI' })
    // kanon §5: brez tihe normalizacije:
    expect(validateCustomerAddressType('kontaktni').ok).toBe(false)
    expect(validateCustomerAddressType('MONTAZNI ').ok).toBe(false)
    expect(validateCustomerAddressType('POSTNI').ok).toBe(false)
  })

  it('razdeliNaslovePoTipih: razdelitev po treh tipih + privzeti flag se ohrani', () => {
    const izhod = razdeliNaslovePoTipih([
      { tip: 'KONTAKTNI', naslov: 'Aškerčeva 1', kraj: 'Ljubljana', postnaSt: '1000', jePrivzet: true },
      { tip: 'RACUNSKI', naslov: 'Dunajska 50', kraj: 'Ljubljana', postnaSt: '1000', jePrivzet: false },
      { tip: 'MONTAZNI', naslov: 'Objekt A', kraj: 'Kranj', postnaSt: '4000', jePrivzet: false },
      { tip: 'MONTAZNI', naslov: 'Objekt B', kraj: 'Kranj', postnaSt: '4000', jePrivzet: false },
    ])
    expect(izhod.ok).toBe(true)
    if (izhod.ok) {
      expect(izhod.value.KONTAKTNI).toHaveLength(1)
      expect(izhod.value.RACUNSKI).toHaveLength(1)
      expect(izhod.value.MONTAZNI).toHaveLength(2) // več montažnih lokacij je dovoljenih
      expect(izhod.value.KONTAKTNI[0]?.jePrivzet).toBe(true)
    }
  })

  it('razdeliNaslovePoTipih: neznan tip → JAVNA napaka (NE tiho v "ostalo")', () => {
    const izhod = razdeliNaslovePoTipih([
      { tip: 'POSTNI', naslov: 'x', kraj: null, postnaSt: null, jePrivzet: false },
    ])
    expect(izhod.ok).toBe(false)
    if (!izhod.ok) {
      expect(izhod.error).toContain('POSTNI')
      expect(izhod.error).toContain('MONTAZNI') // seznam veljavnih vrednosti je v sporočilu
    }
  })
})

describe('R382 — VIR MODULA (stražar čistosti jedra)', () => {
  it('crm-pipeline NE uvaža db/next — jedro ostane čisto (determinizem)', () => {
    expect(VIR_CRM_PIPELINE).not.toContain("from '@/lib/db'")
    expect(VIR_CRM_PIPELINE).not.toContain("from './db'")
    expect(VIR_CRM_PIPELINE).not.toContain('next/server')
    expect(VIR_CRM_PIPELINE).not.toContain('PrismaClient')
  })

  it('starter nabora vira/tipa povpraševanja ostajata DOKUMENTIRANA vrednota (ne inflacija)', () => {
    expect([...LEAD_SOURCES]).toEqual([
      'WEB',
      'TELEFON',
      'EMAIL',
      'PREPOROKA',
      'OBSTOJECA_STRANKA',
      'SEJEM',
      'DRUGO',
    ])
    expect([...LEAD_ENQUIRY_TYPES]).toEqual(['BALKON', 'TERASA', 'STOPNISCE', 'OGRAJA', 'DRUGO'])
  })
})
