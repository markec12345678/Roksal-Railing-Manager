// Roksal — FINANČNI STATUSNI STROJ RAČUNA — §19 (issue #13, korak R170, R402).
// ---------------------------------------------------------------------------
// Enotni vir resnice o DOVOLJENIH prehodih finančnega statusa računa
// (isti vzorec kot project-state.ts — issue #4 §14; »Ni UI-only status
// rules« §21: vsak prehod skozi TA stroj, nikoli dashboard posebej).
//
// Življenjski cikel (spec §19 — dve poti iz IZDAN):
//
//   plačilna pot:  OSNUTEK → IZDAN → POSLAN → DELNO_PLACAN → PLACAN
//   izterjevalna:  IZDAN/POSLAN → ZAPADLO → OPOZORILO → IZTERJAVA
//   stranski izhodi iz VSAKEGA nezaključenega: STORNIRAN (pravna sled)
//
// DELNO_PLACAN in PLACAN sta IZPELJANA stanja: nastaneta IZKLJUČNO ob
// zabeležitvi/prekinitvi plačila (vsota KNJIZENO allocacij na račun,
// src/lib/payments.ts). Ročni PATCH na ta statusa je zavrnjen (409 z
// navodilom na /api/payments) — klient NE more izmisliti plačila.
//
// Čisto jedro: NIČ baze, NIČ ure, NIČ I/O — vsi vhodi so argumenti
// (determinizem, enake lastnosti kot decimal-policy.ts R380).

/** Vse finančne statusne vrednosti računa (nabor je ZAMRZNJEN). */
export type InvoiceStatusValue =
  | 'OSNUTEK'
  | 'IZDAN'
  | 'POSLAN'
  | 'DELNO_PLACAN'
  | 'PLACAN'
  | 'ZAPADLO'
  | 'OPOZORILO'
  | 'IZTERJAVA'
  | 'STORNIRAN'

/** Neveljaven prehod finančnega statusa — 409 (isti kontrakt kot InvalidTransitionError). */
export class InvalidInvoiceTransitionError extends Error {
  readonly status = 409
  constructor(message: string) {
    super(message)
    this.name = 'InvalidInvoiceTransitionError'
  }
}

/**
 * Dovoljeni prehodi (spec §19):
 *   • OSNUTEK → IZDAN — edina pot iz osnutka (brisanje osnutka je ločeno);
 *   • plačilna pot naprej: IZDAN → POSLAN; vsa predplačilna stanja →
 *     DELNO_PLACAN/PLACAN (plačilo lahko pride kadar koli);
 *   • izterjevalna pot: IZDAN/POSLAN → ZAPADLO → OPOZORILO → IZTERJAVA
 *     (POSLAN → ZAPADLO: poslan in neplačan preteče rok);
 *   • OPOZORILO → ZAPADLO: korektni povratek ob pomiritvi zapadlosti;
 *   • DELNO_PLACAN → izterjevalna pot: delno plačilo ne ustavi opominov;
 *   • PLACAN = terminalen ZA PLAČILNO POT (ročno se LE še stornira —
 *     odprtje nazaj izključno prek prekinitve plačila, spodaj);
 *   • STORNIRAN = terminalen (pravna sled).
 */
export const INVOICE_ALLOWED_TRANSITIONS: Readonly<
  Record<InvoiceStatusValue, readonly InvoiceStatusValue[]>
> = Object.freeze({
  OSNUTEK: ['IZDAN'],
  IZDAN: ['POSLAN', 'ZAPADLO', 'DELNO_PLACAN', 'PLACAN', 'STORNIRAN'],
  POSLAN: ['ZAPADLO', 'DELNO_PLACAN', 'PLACAN', 'STORNIRAN'],
  ZAPADLO: ['OPOZORILO', 'DELNO_PLACAN', 'PLACAN', 'STORNIRAN'],
  OPOZORILO: ['IZTERJAVA', 'ZAPADLO', 'DELNO_PLACAN', 'PLACAN', 'STORNIRAN'],
  IZTERJAVA: ['OPOZORILO', 'DELNO_PLACAN', 'PLACAN', 'STORNIRAN'],
  DELNO_PLACAN: ['PLACAN', 'ZAPADLO', 'OPOZORILO', 'IZTERJAVA', 'STORNIRAN'],
  PLACAN: ['STORNIRAN'],
  STORNIRAN: [],
})

/** Statusi, ki jih klient NE SME nastaviti ročno — izpelje jih strežnik iz plačil. */
export const DERIVED_INVOICE_STATUSES: readonly InvoiceStatusValue[] = Object.freeze([
  'DELNO_PLACAN',
  'PLACAN',
])

/** Ročno nastavljivi statusi (PATCH /api/invoices — prek stroja). */
export const MANUAL_INVOICE_STATUSES: readonly InvoiceStatusValue[] = Object.freeze(
  (Object.keys(INVOICE_ALLOWED_TRANSITIONS) as InvoiceStatusValue[]).filter(
    (s) => !DERIVED_INVOICE_STATUSES.includes(s),
  ),
)

export function isInvoiceStatus(v: string): v is InvoiceStatusValue {
  return v in INVOICE_ALLOWED_TRANSITIONS
}

export function isDerivedInvoiceStatus(v: string): boolean {
  return (DERIVED_INVOICE_STATUSES as readonly string[]).includes(v)
}

/**
 * Veljavnost prehoda — vrže InvalidInvoiceTransitionError (409) z imeh
 * dovoljenih naslednikov (isti stil sporočila kot project-state.ts).
 */
export function assertInvoiceTransition(from: string, to: string): void {
  if (!isInvoiceStatus(from) || !isInvoiceStatus(to)) {
    throw new InvalidInvoiceTransitionError(
      `Neznan finančni status računa: ${!isInvoiceStatus(from) ? from : to}`,
    )
  }
  if (!INVOICE_ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new InvalidInvoiceTransitionError(
      `Neveljaven prehod finančnega statusa: ${from} → ${to} (dovoljeni: ${INVOICE_ALLOWED_TRANSITIONS[from].join(', ') || '—'})`,
    )
  }
}

/** Ne-metajoča različica za UI/predloge. */
export function invoiceTransitionAllowed(from: string, to: string): boolean {
  try {
    assertInvoiceTransition(from, to)
    return true
  } catch {
    return false
  }
}

/**
 * Deterministični povratki ob PREKINITVI plačila (kanon §19): prekinitev
 * lahko premakne račun SAMO v neplačano stanje, izpeljano iz diska
 * (DELNO_PLACAN / ZAPADLO / POSLAN / IZDAN). To je LOČENA množica od
 * ročnega stroja: ročni PATCH NE more odpreti PLACAN računa (prepreči
 * lažen "neplačan" status), prekinitev plačila (documented finančni
 * dogodek z razlogom + auditom) LAHKO — plačilo je dejansko umaknjeno.
 */
export const VOID_PREHODI: readonly InvoiceStatusValue[] = Object.freeze([
  'DELNO_PLACAN',
  'ZAPADLO',
  'POSLAN',
  'IZDAN',
])

/** Prehod, dovoljen IZKLJUČNO prek prekinitve plačila (store-plast). */
export function assertInvoiceVoidTransition(from: string, to: string): void {
  if (!isInvoiceStatus(from) || !isInvoiceStatus(to)) {
    throw new InvalidInvoiceTransitionError(
      `Neznan finančni status računa: ${!isInvoiceStatus(from) ? from : to}`,
    )
  }
  if (!VOID_PREHODI.includes(to)) {
    throw new InvalidInvoiceTransitionError(
      `Prekinitev plačila ne more premakniti računa v status ${to} (dovoljeni povratki: ${VOID_PREHODI.join(', ')})`,
    )
  }
}

// ── Izpeljava plačilnega stanja (ČISTO — številska primerjava) ─────────────

/**
 * Izpelji plačilni status iz vsote KNJIZENO allocacij in zneska računa:
 *   • allocSum ≤ 0            → null (ni plačila — status ostaja po stroju);
 *   • 0 < allocSum < znesek   → 'DELNO_PLACAN';
 *   • allocSum ≥ znesek       → 'PLACAN'.
 * Števila so že zaokrožena po denarni politiki (2 decimalki, R380) —
 * primerjava poteka v Centih (×100 na celo število), da izniči float
 * prahu (0.1 + 0.2 problema) na meji.
 */
export function izpeljiPlacilniStatus(
  allocSum: number,
  znesek: number,
): 'DELNO_PLACAN' | 'PLACAN' | null {
  const allocCenti = Math.round(allocSum * 100)
  const znesekCenti = Math.round(znesek * 100)
  if (allocCenti <= 0) return null
  return allocCenti >= znesekCenti ? 'PLACAN' : 'DELNO_PLACAN'
}

/**
 * Povratni status po prekinitvi VSEH plačil na računu (allocSum = 0):
 * deterministično iz podatkov računa — NIKOLI iz pomnilnika prejšnjega
 * stanja (uskladitev mora biti reproducibilna iz diska):
 *   • rok plačila pretekel (datumIzdaje + rokPlacilaDni < now) → 'ZAPADLO';
 *   • sicer poslanoAt nastavljen → 'POSLAN';
 *   • sicer → 'IZDAN'.
 * Preverbo preteka roka kliče izključno store-plast (now je argument —
 * R294 F4: stena ure VEDNO kot parameter, nikoli new Date() v jedru).
 */
export function povratniStatusPoPrekinitvi(
  inv: { poslanoAt: Date | null; datumIzdaje: Date; rokPlacilaDni: number },
  now: Date,
): 'ZAPADLO' | 'POSLAN' | 'IZDAN' {
  const rok = new Date(inv.datumIzdaje)
  rok.setDate(rok.getDate() + inv.rokPlacilaDni)
  if (rok.getTime() < now.getTime()) return 'ZAPADLO'
  return inv.poslanoAt ? 'POSLAN' : 'IZDAN'
}
