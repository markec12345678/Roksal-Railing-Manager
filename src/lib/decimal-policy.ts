/**
 * R380 (issue #13, korak R168 iz §12) — CENTRALNA ZAOKROŽEVALNA POLITIKA +
 * Decimal bridge. EN VIR resnice o tem, KOLIKO decimalk ima katera vrsta
 * poslovne vrednosti in KAKO se zaokrožuje.
 * ---------------------------------------------------------------------------
 * Problem, ki ga to jedro zapira (issue #13 §12): do R378 so bile finančne
 * in količinske vrednosti v Float stolpcih (Project.marginLocked,
 * Invoice.osnova/ddv/znesek, StockLedger.kolicina, Inventory.kolicinaZaloga
 * …) — dvojična plavajoča vejica ZGODOVINSKO laže (0.1 + 0.2 ≠ 0.3) in vsak
 * modul je zaokroževal po svoje (invoices/route.ts je imel LOKALNI round2 z
 * Math.round + EPSILON; drugod toFixed; tretji sploh nič). §12 zahteva:
 * Decimal kjer natančnost šteje + CENTRALNA zaokroževalna politika.
 *
 * Zasnova (isti vzorec kot production-orders R378 — čisto jedro):
 *   • NIČ baze, NIČ ure, NIČ I/O — vsi vhodi so argumenti; edina odvisnost
 *     je decimal.js (čista matematična knjižnica, direktna odvisnost od
 *     R380 — ista verzija kot Prisma-va transicijska, ena kopija v drevesu);
 *   • EKSAKTNA aritmetika: vhodni number se pretvori prek String(v) —
 *     NAJKRAJŠA reprezentacija (kar je uporabnik vpisal / kar je DB poslala),
 *     NE dvojični rep (0.1 → "0.1", ne 0.1000000000000000055…). Vsota
 *     [0.1, 0.2] je zato EXAKTNO 0.3 — float bi dal 0.30000000000000004;
 *   • EN VIR: vsa zaokroževanja poslovnih vrednosti PREK teh funkcij
 *     (zamrznjena preciznost po domenu — DENAR 2, KOLIČINA 3, FAKTOR 4,
 *     ODSOTEK 2; nabor načinov GORI/DOL/NAJBLIZJE);
 *   • DB tipi so od R380 Decimal: denar DECIMAL(12,2), količina
 *     DECIMAL(12,3), faktor DECIMAL(6,4), odstotek DECIMAL(5,2) — te
 *     konstante SO pogodba med shemo in to politiko (en vir dokumentiran);
 *   • decToNum: edini dovoljeni prehod Prisma.Decimal → number na DTO
 *     meji (strukturni tip { toNumber() } — BREZ uvoza Prisma v jedro);
 *   • fail-closed: NaN/Infinity/nekončna vhodna → JAVNA napaka
 *     (DecimalPolicyError), NIKOLI tiha substitucija z 0;
 *   • HONEST NULL (§8): decToNum(null/undefined) → null — neznano ostane
 *     neznano, nikoli izmišljena ničla.
 *
 * SEMANTIKA NAIJBLIZJE (half-up): 0.5 → gor. Za poslovne vrednosti
 * (cene ≥ 0, količine ≥ 0) je to edini standard, ki sešteva konsistentno
 * z DECIMAL stolpci v PG (numeric round-half-up). Negativne vrednosti:
 * -0.5 → -1 (symetrično "gor od nič" — ista semantika kot PG numeric).
 */

import Decimal from 'decimal.js'

// ── Preciznost po domenu (ZAMRZNJENA — pogodba s prisma/schema.prisma) ──────

/** Denar (EUR): DECIMAL(12,2) v shemi. */
export const DENAR_DECIMALKE = 2 as const
/** Količine (kos/m/kg/…): DECIMAL(12,3) v shemi. */
export const KOLICINA_DECIMALKE = 3 as const
/** Faktorji (npr. wasteFactor): DECIMAL(6,4) v shemi. */
export const FAKTOR_DECIMALKE = 4 as const
/** Odstotki (popust, DDV stopnja): DECIMAL(5,2) v shemi. */
export const ODSOTEK_DECIMALKE = 2 as const

/** Zgornja meja decimalk, ki jih politika sprejme (enako kot Inventory.precision CHECK 0–6). */
export const MAX_DECIMALKE = 6 as const

// ── Načini zaokroževanja (EN VIR — Inventory.rounding se sklicuje sem) ─────

export const NACINI_ZAOKROZEVANJA = ['GORI', 'DOL', 'NAJBLIZJE'] as const
export type NacinZaokrozevanja = (typeof NACINI_ZAOKROZEVANJA)[number]

/** Javna napaka politike — fail-closed, sporočilo je vidno klientu (400/500). */
export class DecimalPolicyError extends Error {
  constructor(
    message: string,
    /** Predlagan HTTP status (400 = klientova vrednost, 500 = naš izračun). */
    readonly suggestedStatus: number = 400,
  ) {
    super(`[decimal-policy] ${message}`)
    this.name = 'DecimalPolicyError'
  }
}

// ── Jedro: eno zaokroževanje, trije načini, eksaktna decimal.js ─────────────

/**
 * Zaokroži vrednost na `decimalke` mest po izbranem načinu.
 *
 *   NAIJBLIZJE — half-up (0.5 gor; PG numeric semantika) — PRIVZETO;
 *   GORI       — strop (proti +∞; nabava: bolj naročiti kot zmanjkati);
 *   DOL        — talna (proti −∞; izdaja: ne izdati več kot je);
 *
 * Vrednost se pretvori prek String(v) (najkrajša reprezentacija) —
 * zaokroževanje deli EXAKTNO, kar je vrednost pomenila, ne dvojičnega
 * repa. 0.145 → "0.145" → NAIJBLIZJE(2) = 0.15 (Math.round bi dobil
 * 0.14, ker je 0.145 kot double dejansko 0.1449999999999999…).
 *
 * Fail-closed: nekončna vhodna vrednost (NaN/±Infinity) ali decimalke
 * zunaj 0–6 → DecimalPolicyError. Celo število ustreznih decimalk gre
 * nespremenjeno skozi (identiteta — determinizem).
 */
export function zaokrozi(vrednost: number, decimalke: number, nacin: NacinZaokrozevanja = 'NAJBLIZJE'): number {
  if (typeof vrednost !== 'number' || !Number.isFinite(vrednost)) {
    throw new DecimalPolicyError(`Nekončna vhodna vrednost: ${String(vrednost)}`, 400)
  }
  if (!Number.isInteger(decimalke) || decimalke < 0 || decimalke > MAX_DECIMALKE) {
    throw new DecimalPolicyError(`Decimalke morajo biti celo število 0–${MAX_DECIMALKE}, dobil: ${String(decimalke)}`, 500)
  }
  const nacinD: Decimal.Rounding =
    nacin === 'GORI' ? Decimal.ROUND_CEIL : nacin === 'DOL' ? Decimal.ROUND_FLOOR : Decimal.ROUND_HALF_UP
  return new Decimal(String(vrednost)).toDecimalPlaces(decimalke, nacinD).toNumber()
}

/** Denar → 2 decimalki, NAIJBLIZJE. */
export function zaokroziDenar(vrednost: number): number {
  return zaokrozi(vrednost, DENAR_DECIMALKE)
}

/** Količina → 3 decimalke, NAIJBLIZJE. */
export function zaokroziKolicino(vrednost: number): number {
  return zaokrozi(vrednost, KOLICINA_DECIMALKE)
}

/** Faktor → 4 decimalke, NAIJBLIZJE. */
export function zaokroziFaktor(vrednost: number): number {
  return zaokrozi(vrednost, FAKTOR_DECIMALKE)
}

/** Odstotek → 2 decimalki, NAIJBLIZJE. */
export function zaokroziOdstotek(vrednost: number): number {
  return zaokrozi(vrednost, ODSOTEK_DECIMALKE)
}

// ── Vsote: seštej v Decimal, zaokroži ENKRAT na koncu ───────────────────────

/**
 * Vsota denarja: seštevanje v eksaktnem Decimal (0.1 + 0.2 = 0.3 — ne
 * 0.30000000000000004), zaokrožitev ENKRAT na koncu na 2 decimalki.
 * Zaokroževanje po členih bi kumuliralo pristranost gor — vsota treh 0.005
 * naj bo 0.02 (0.015 → 0.02), ne 0.03.
 * Prazno polje → 0 (vsota praznega nabora je objektivno nič — NI honest-NULL
 * teritorij: funkcija prejme KONČEN seznam znanih vrednosti).
 */
export function vsotaDenarja(vrednosti: readonly number[]): number {
  return vsota(vrednosti, DENAR_DECIMALKE)
}

/** Vsota količin: eksaktno seštevanje, enkratna zaokrožitev na 3 decimalke. */
export function vsotaKolicin(vrednosti: readonly number[]): number {
  return vsota(vrednosti, KOLICINA_DECIMALKE)
}

function vsota(vrednosti: readonly number[], decimalke: number): number {
  let acc = new Decimal(0)
  for (const v of vrednosti) {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new DecimalPolicyError(`Vsota: nekončna vrednost v seznamu: ${String(v)}`, 500)
    }
    acc = acc.plus(String(v))
  }
  return acc.toDecimalPlaces(decimalke, Decimal.ROUND_HALF_UP).toNumber()
}

// ── Decimal → number bridge (DTO meja — EDINI dovoljeni prehod) ─────────────

/**
 * Strukturni tip Prisma.Decimal (in vsak decimal.js objekt) — jedro NE
 * uvaža Prisma (R294 F4), zato sprejemamo strukturno: kar ima toNumber().
 */
export interface DecimalLike {
  toNumber(): number
}

/**
 * Prisma.Decimal | number | string | null → number | null.
 *
 *   • Decimal (objekt s toNumber)  → njegov number;
 *   • number                       → preverjen (končen!) in vrnjen;
 *   • string                       → SAMO če se parse-a v končno število
 *                                    (fail-closed: 'abc' → napaka, NE NaN);
 *   • null | undefined             → null (HONEST NULL §8 — neznano ostane
 *                                    neznano, nikoli tiha ničla).
 *
 * To je EDINI dovoljeni prehod DB-Decimal → number na DTO meji. Aritmetika
 * v domenski logiki teče po policy funkcijah (eksaktni Decimal); EXAKTNOST
 * izvora nosi DECIMAL stolpec v PG.
 */
export function decToNum(vrednost: DecimalLike | number | string | null | undefined): number | null {
  if (vrednost === null || vrednost === undefined) return null
  if (typeof vrednost === 'number') {
    if (!Number.isFinite(vrednost)) {
      throw new DecimalPolicyError(`Nekončna številska vrednost: ${String(vrednost)}`, 500)
    }
    return vrednost
  }
  if (typeof vrednost === 'string') {
    // Prazen/ samo-presledkov niz: Number('') = 0 — TIHA ničla iz smeti.
    // Fail-closed: smet je smet (400/500 z javnim sporočilom).
    if (vrednost.trim() === '') {
      throw new DecimalPolicyError(`Vrednost ni veljavno število: ${JSON.stringify(vrednost)}`, 500)
    }
    const parsano = Number(vrednost)
    if (!Number.isFinite(parsano)) {
      throw new DecimalPolicyError(`Vrednost ni veljavno število: ${JSON.stringify(vrednost)}`, 500)
    }
    return parsano
  }
  // DecimalLike — toNumber() je lahko izjem; tudi njegova vrednost mora biti
  // končna (zagovorjeni fail-closed verižno).
  const pretvorjeno = vrednost.toNumber()
  if (!Number.isFinite(pretvorjeno)) {
    throw new DecimalPolicyError(`Decimal vrednost ni končna: ${String(vrednost)}`, 500)
  }
  return pretvorjeno
}

/**
 * decToNum z ZAGOTOVLJENO vrnitvijo number (za obvezna polja): null →
 * DecimalPolicyError (klicatelj VE, da polje mora obstajati — missing =
 * napaka, ne tiha ničla). Za neobvezna polja uporabite decToNum.
 */
export function decToNumObvezno(vrednost: DecimalLike | number | string | null | undefined, imePolja: string): number {
  const pretvorjeno = decToNum(vrednost)
  if (pretvorjeno === null) {
    throw new DecimalPolicyError(`Obvezno polje ${imePolja} je NULL`, 500)
  }
  return pretvorjeno
}

// ── Globoki serializer DTO meja (Decimal → number v CELEM drevesu) ──────────

/**
 * Rekreativno pretvori VSE Decimal vrednosti v number znotraj poljubnega
 * objektnega drevesa (DTO meja za NextResponse.json):
 *
 *   • DecimalLike (strukturno: ima toNumber) → number;
 *   • Array → vsak element rekurzivno;
 *   • plain objekt → vsaka vrednost rekurzivno;
 *   • Date/string/number/boolean/null → NESPREMENJENO (Date nima toNumber —
 *     ostane Date, ki ga JSON serializira kot ISO string kot prej);
 *
 * ZAKO sploh: Prisma Decimal se v JSON.stringify serializira kot STRING
 * ("12.5") — klientova aritmetika bi dobila NaN. Ta funkcija je EN VIR
 * tega prehoda za API odgovore, ki vračajo surove DB vrstice.
 *
 * Determinizem: isti vhod → strukturno identičen izhod (Decimal 12.5 →
 * number 12.5, vedno). Fail-closed: Decimal s nekončno vrednostjo →
 * DecimalPolicyError (NE tiha null).
 *
 * NE uporabljati za MUTACIJO vhoda — funkcija gradi NOVO drevo (čisti
 * izhod, vhod ostane nedotaknjen).
 */
export function decToPlain(vrednost: unknown): unknown {
  if (vrednost === null || vrednost === undefined) return vrednost
  if (Array.isArray(vrednost)) {
    return vrednost.map((v) => decToPlain(v))
  }
  if (typeof vrednost === 'object') {
    // Date (in vsak ne-Decimal objekt brez toNumber): pusti kot je — JSON
    // ga serializira po starih pravilih. Strukturna preverba je EKSAKTNA:
    // samo objekti z toNumber funkcijo se pretvorijo.
    if (typeof (vrednost as { toNumber?: unknown }).toNumber === 'function') {
      return decToNum(vrednost as DecimalLike)
    }
    if (vrednost instanceof Date) return vrednost
    const izhod: Record<string, unknown> = {}
    for (const [kljuc, v] of Object.entries(vrednost as Record<string, unknown>)) {
      izhod[kljuc] = decToPlain(v)
    }
    return izhod
  }
  return vrednost
}
