/**
 * R382 (issue #13, korak R169 iz §13) — ČISTO jedro CRM lijakov: Lead +
 * Opportunity statusna stroja + naslovi stranke po tipih.
 * ---------------------------------------------------------------------------
 * Problem, ki ga to jedro zapira (issue #13 §13): do R382 je bil Customer
 * "preveč blizu končni stranki" — ni bilo sleada (odkod povpraševanje
 * prihaja), ne prodajne cevi (kje je posel), ne razloga izgube, niti
 * ločenih naslovov (kontaktni = računski = montažni). To jedro je EN VIR
 * obeh statusnih strojev + naslovne razdelitve — brez njega bi vsaka ruta
 * pisala svojo matriko prehodov.
 *
 * Zasnova (isti vzorec kot production-orders R378 — čisto jedro):
 *   • NIČ baze, NIČ ure, NIČ I/O — vsi vhodi so argumenti (determinizem:
 *     isti vhodi → iste odločitve, dokazljivo v testih; test preverja tudi
 *     VIR modula — statični pregled, da tu ne uidejo db/next uvozi);
 *   • fail-closed: neznan status/stage/tip → JAVNA napaka (CrmPipelineError),
 *     NIKOLI tiha substitucija ali "pa vrni kar je";
 *   • HONEST NULL (§8): verjetnost/ocena/razlog NULL, ko vir ne obstaja —
 *     nikoli izmišljene vrednosti;
 *   • verjetnost je §13 IZRECNO "CRM polje brez poslovne logike" — to jedro
 *     je EDINO mesto, kjer je sploh dovoljena, in NIKOLI ne teče v izračune
 *     (denar/odstotki so domena decimal-policy R380).
 */

// ── Viri sleada (§13 source) ────────────────────────────────────────────────

/**
 * Starter nabor virov + DRUGO (iskrena odločitev R378-prioritete: v repu NI
 * obstoječega CRM nabora virov — izumljeni enum bi bil izum §8). Širjenje =
 * nova migracija + ta seznam, NE tiha inflacija iz klientovih nizov.
 */
export const LEAD_SOURCES = [
  'WEB',
  'TELEFON',
  'EMAIL',
  'PREPOROKA',
  'OBSTOJECA_STRANKA',
  'SEJEM',
  'DRUGO',
] as const
export type LeadSource = (typeof LEAD_SOURCES)[number]

// ── Tip povpraševanja (§13 enquiry type) ────────────────────────────────────

/** Konteksti ograj, ki jih rep DEJANSKO podpira (kalkulator/meritve) + DRUGO. */
export const LEAD_ENQUIRY_TYPES = ['BALKON', 'TERASA', 'STOPNISCE', 'OGRAJA', 'DRUGO'] as const
export type LeadEnquiryType = (typeof LEAD_ENQUIRY_TYPES)[number]

// ── Statusni stroj SLEADA (PREDkvalifikacija, ne prodajna cev) ──────────────

export const LEAD_STATUSES = ['NOV', 'KONTAKTIRAN', 'PRETVORJEN', 'ZAVRNJEN'] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

/**
 * Dovoljeni prehodi statusa sleada:
 *
 *   NOV → KONTAKTIRAN       prvi uspešen kontakt;
 *   NOV → PRETVORJEN        sprožena pretvorba (kreira Opportunity — isto
 *                           transakcijo naredi crm-store, jedro samo
 *                           DOVOLI prehod);
 *   NOV → ZAVRNJEN          junk/spam/nerelevantno (brez obdelave);
 *   KONTAKTIRAN → PRETVORJEN/ZAVRNJEN   po kontaktu se odloči: posel ali ne;
 *
 * IZRECNO PREPOVEDANI robovi (dokumentirano, ne zgolj izpuščeno):
 *   NOV → PRETVORJEN brez navedbe?   NE — prehod je dovoljen, PAYLOAD
 *                           (naziv priložnosti) zahteva crm-store — jedro
 *                           ne meša strukture in podatka;
 *   PRETVORJEN → karkoli   terminalno: pretvorjen slead ŽIVI naprej kot
 *                           Opportunity + stranka — vračanje bi izbrisalo
 *                           dokaz nastanka;
 *   ZAVRNJEN → karkoli     terminalno: zavrnjeni slead ne oživi (nova
 *                           poizvedba istega kontakta = NOV slead —
 *                           revizijska sled ostane čista);
 *   vsak nazaj-pažen        usmerjeno naprej (isti kanon kot R378).
 */
export const LEAD_TRANSITIONS: Readonly<Record<LeadStatus, readonly LeadStatus[]>> = {
  NOV: ['KONTAKTIRAN', 'PRETVORJEN', 'ZAVRNJEN'],
  KONTAKTIRAN: ['PRETVORJEN', 'ZAVRNJEN'],
  PRETVORJEN: [],
  ZAVRNJEN: [],
}

export function allowedLeadTransitions(from: string): readonly LeadStatus[] {
  return LEAD_TRANSITIONS[from as LeadStatus] ?? []
}

export function checkLeadTransition(from: string, to: string): { ok: boolean; allowed: readonly LeadStatus[] } {
  const allowed = allowedLeadTransitions(from)
  return { ok: (allowed as readonly string[]).includes(to), allowed }
}

/** Ali je status sleada TERMINALEN (PRETVORJEN | ZAVRNJEN)? */
export function isTerminalLeadStatus(status: string): boolean {
  return allowedLeadTransitions(status).length === 0
}

// ── Statusni stroj PRiložnosti (§13 lifecycle EXACT) ────────────────────────

/**
 * Stage lifecycle §13, EXACT iz speca (EN VIR):
 *   NEW → CONTACTED → SITE_SURVEY → QUOTE → FOLLOW_UP → ACCEPTED / LOST
 */
export const OPPORTUNITY_STAGES = [
  'NEW',
  'CONTACTED',
  'SITE_SURVEY',
  'QUOTE',
  'FOLLOW_UP',
  'ACCEPTED',
  'LOST',
] as const
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number]

/** Zaporedna relativna višina stage-a (NEW=0 … LOST=6) — za smer prehoda. */
export const OPPORTUNITY_STAGE_ORDER: Readonly<Record<OpportunityStage, number>> = Object.freeze({
  NEW: 0,
  CONTACTED: 1,
  SITE_SURVEY: 2,
  QUOTE: 3,
  FOLLOW_UP: 4,
  ACCEPTED: 5,
  LOST: 6,
})

/**
 * Dovoljeni prehodi stage-a priložnosti (§13):
 *
 *   Naprej + PRESKOKI dovoljeni: stranka lahko pride z ŽE opravljenim ogledom
 *   (NEW → SITE_SURVEY) ali z merami in zahtevo po ponudbi (NEW → QUOTE).
 *   Prisiljevanje lažnih vmesnih korakov bi bilo laž o poti posla —
 *   nasprotno od §8.
 *
 *   LOST iz VSAKEGA živega stage-a: stranka lahko odkloni KDARKOLI (po
 *   prvem kontaktu, po ogledu, po ponudbi, po opomniku) — vedno z obveznim
 *   razlogom (requiresLossReason).
 *
 *   ACCEPTED samo iz QUOTE | FOLLOW_UP: sprejeti se da PONUDBO (kanonična
 *   ponudba = QuoteVersion R374; pogodbeni okvir posla). NEW/CONTACTED/
 *   SITE_SURVEY → ACCEPTED bi pomenilo "sprejeli smo nič" — kaj bi sploh
 *   sprejeli? (Dokumentirana poslovna meja, ne izum.)
 *
 * IZRECNO PREPOVEDANI robovi (dokumentirano, ne zgolj izpuščeno):
 *   nazaj-pažni prehodi     revizijska sled je usmerjena naprej (R378
 *                           kanon): "razveljavitev" bi izbrisala zgodovino
 *                           pogajanj — korekcija smeri je NOVA priložnost;
 *   ACCEPTED → LOST         sprejet posel, ki razpade, je REALNOST projekta
 *                           (Project/Invoice domena), ne prepis CRM zgodovine;
 *   ACCEPTED → karkoli      terminalno: pretvorba v projekt je ENKRATNA
 *                           (convertedProjectId UNIQUE) in ne razpada;
 *   LOST → karkoli          terminalno: izgubljeni posel ne oživi — nova
 *                           pogajanja = NOVA priložnost (nova vrstica, nova
 *                           revizijska sled);
 *   NEW → ACCEPTED          kaj bi sprejeli? nič kanoničnega še ni nastalo.
 */
export const OPPORTUNITY_TRANSITIONS: Readonly<Record<OpportunityStage, readonly OpportunityStage[]>> = {
  NEW: ['CONTACTED', 'SITE_SURVEY', 'QUOTE', 'FOLLOW_UP', 'LOST'],
  CONTACTED: ['SITE_SURVEY', 'QUOTE', 'FOLLOW_UP', 'LOST'],
  SITE_SURVEY: ['QUOTE', 'FOLLOW_UP', 'LOST'],
  QUOTE: ['FOLLOW_UP', 'ACCEPTED', 'LOST'],
  FOLLOW_UP: ['ACCEPTED', 'LOST'],
  ACCEPTED: [],
  LOST: [],
}

export function allowedOpportunityTransitions(from: string): readonly OpportunityStage[] {
  return OPPORTUNITY_TRANSITIONS[from as OpportunityStage] ?? []
}

export function checkOpportunityStageTransition(
  from: string,
  to: string,
): { ok: boolean; allowed: readonly OpportunityStage[] } {
  const allowed = allowedOpportunityTransitions(from)
  return { ok: (allowed as readonly string[]).includes(to), allowed }
}

/** Ali je stage TERMINALEN (ACCEPTED | LOST — mrtva priložnost ne oživi)? */
export function isTerminalOpportunityStage(stage: string): boolean {
  return allowedOpportunityTransitions(stage).length === 0
}

/**
 * Ali prehod ZAHTEVA razlog izgube? (§13 loss reason — IZRECNO samo LOST:
 * odmik od posla brez razloga je tiha mutacija zgodovine. Naprej-paženi
 * prehodi razloga NE zahtevajo — uspeh ne potrebuje opravičila.)
 */
export function requiresLossReason(to: string): boolean {
  return to === 'LOST'
}

/** Ali prehod v ACCEPTED ustvari projekt? (Pretvorba — crm-store izvede.) */
export function requiresProjectConversion(to: string): boolean {
  return to === 'ACCEPTED'
}

// ── Verjetnost (§13 probability — CRM polje BREZ poslovne logike) ───────────

/** Meje verjetnosti (vključno) — mnenje prodajalca, ne napoved. */
export const VERJETNOST_MIN = 0
export const VERJETNOST_MAX = 100

/**
 * Fail-closed validacija verjetnosti: celo število 0–100 ali null.
 * §13: "probability ni potrebna kot napoved, lahko pa kot CRM polje brez
 * poslovne logike" — to je EDINA validacija, nikoli vhod v izračun.
 */
export function validateVerjetnost(v: unknown): { ok: true; value: number | null } | { ok: false; error: string } {
  if (v === undefined || v === null) return { ok: true, value: null }
  if (typeof v !== 'number' || !Number.isInteger(v)) {
    return { ok: false, error: `verjetnost mora biti celo število ${VERJETNOST_MIN}–${VERJETNOST_MAX} ali null` }
  }
  if (v < VERJETNOST_MIN || v > VERJETNOST_MAX) {
    return { ok: false, error: `verjetnost mora biti med ${VERJETNOST_MIN} in ${VERJETNOST_MAX} (dobili smo ${v})` }
  }
  return { ok: true, value: v }
}

// ── Naslovi stranke (§13 — ločitev na tri tipe) ─────────────────────────────

/** Tipi naslovov (§13: contact/mailing, billing, installation/site). */
export const CUSTOMER_ADDRESS_TYPES = ['KONTAKTNI', 'RACUNSKI', 'MONTAZNI'] as const
export type CustomerAddressType = (typeof CUSTOMER_ADDRESS_TYPES)[number]

/** Slovenski opis tipa naslova (za javna sporočila — EN VIR). */
export const CUSTOMER_ADDRESS_TYPE_LABELS: Readonly<Record<CustomerAddressType, string>> = Object.freeze({
  KONTAKTNI: 'kontaktni (poštni)',
  RACUNSKI: 'računski',
  MONTAZNI: 'montažni (lokacija del)',
})

/** Fail-closed validacija tipa naslova (NE tiha normalizacija — kanon §5). */
export function validateCustomerAddressType(
  tip: string,
): { ok: true; value: CustomerAddressType } | { ok: false; error: string } {
  if ((CUSTOMER_ADDRESS_TYPES as readonly string[]).includes(tip)) {
    return { ok: true, value: tip as CustomerAddressType }
  }
  return {
    ok: false,
    error: `Neznan tip naslova '${tip}' (dovoljeni: ${CUSTOMER_ADDRESS_TYPES.join(', ')}).`,
  }
}

/** Vhod naslova za razdelitev po tipih (ISTO obliko vrača Prisma findMany). */
export interface NaslovVhod {
  tip: string
  naslov: string
  kraj: string | null
  postnaSt: string | null
  jePrivzet: boolean
}

/**
 * Razdeli naslove stranke po tipih (§13 ločitev). Fail-closed: neznan tip v
 * VHODNIH podatkih (leži v bazi — lahko le prek ročnega SQL obvoza) se NE
 * razvrsti tiho v "ostalo" (to bi bila skrita korupcija) — vrne JAVNO napako.
 */
export function razdeliNaslovePoTipih(
  naslovi: readonly NaslovVhod[],
): { ok: true; value: Record<CustomerAddressType, readonly NaslovVhod[]> } | { ok: false; error: string } {
  const value: Record<CustomerAddressType, NaslovVhod[]> = {
    KONTAKTNI: [],
    RACUNSKI: [],
    MONTAZNI: [],
  }
  for (const n of naslovi) {
    const tip = validateCustomerAddressType(n.tip)
    if (!tip.ok) return { ok: false, error: tip.error }
    value[tip.value].push(n)
  }
  return { ok: true, value }
}

// ── Javna napaka jedra ──────────────────────────────────────────────────────

/** Napaka CRM jedra — sporočilo je JAVNO (slovensko), status določi plast. */
export class CrmPipelineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CrmPipelineError'
  }
}
