/**
 * R393 (issue #13, korak R171 iz §15) — ČISTO JEDRO inženirskih/compliance
 * pravil (ENGINEERING / COMPLIANCE VERSIONING). NIČ baze, ure ali IO —
 * vzorec catalog-domain R390 / crm-pipeline R382 / production-orders R378:
 * nabori in validacije so PODATEK + funkcije, ki jih store-plast in rute
 * DELIJO (EN VIR — §15: "Vsako tehnično pravilo mora imeti [provenanco]";
 * matrike živijo TU, ne v komponentah).
 *
 * Načela:
 *   • §15 EXACT nabori — kategorije/viri/overitve/statusi; neznan → JAVNA
 *     napaka s seznamom (fail-closed, NE tiha normalizacija — kanon §5);
 *   • LOČITEV (§15): "Informativni engineering calculation mora biti jasno
 *     ločen od uradnega projektantskega/statističnega preverjanja" —
 *     overitev INFORMATIVNO je PRIVZETA resnica; URADNO (PROJEKTANTSKA/
 *     STATISTICNA) ZAHTEVA reviewedAt + reviewerId (nepreverjeno pravilo NE
 *     sme biti nikoli uradno — preveriUradnoOveritev guard v store-plasti
 *     na OBEH točkah: ustvarjanje verzije IN aktivacija);
 *   • honest NULL (§8): standardReferenca/standardVerzija/jurisdikcija/
 *     calculatorVerzija so NULL, ko vir NE dokumentira — nikoli izmišljeni
 *     ("Ne uporabljati nepreverjenih ali napačnih standard reference kot
 *     production compliance truth" — §15);
 *   • statusni stroj verzije = pariteta PriceBookVersion R373 /
 *     ProductCatalogVersion R390 (DRAFT → ACTIVE → RETIRED; dve ACTIVE hkrati
 *     = pokvarjeno stanje → partial UNIQUE v bazi + 409 v store-plasti);
 *   • aplikacije = §14 EXACT nabor — uvožen iz catalog-domain (EN VIR, NE
 *     podvajanje besednjaka).
 */

import { z } from 'zod'
import { APLIKACIJE, ORIENTACIJE, type Aplikacija, type Orientacija } from './catalog-domain'

// ── §15 EXACT nabori ────────────────────────────────────────────────────────

/** §15 kategorije tehničnih pravil — EXACT besednjak (seed pokriva vse). */
export const KATEGORIJE_PRAVIL = [
  'MONTAZA',
  'RAZMAK',
  'MATERIAL',
  'OBREMENITEV',
  'GEOMETRIJA',
] as const
export type KategorijaPravila = (typeof KATEGORIJE_PRAVIL)[number]

/** Slovenske oznake kategorij (UI/poročila — iz ENega vira, ne v UI-jih). */
export const KATEGORIJE_OZNAKE: Readonly<Record<KategorijaPravila, string>> = Object.freeze({
  MONTAZA: 'Montaža',
  RAZMAK: 'Razmaki',
  MATERIAL: 'Material',
  OBREMENITEV: 'Obremenitve',
  GEOMETRIJA: 'Geometrija',
})

/** §15 "source" — vir pravila. EXACT besednjak (katalog NE citira standardov). */
export const VIRI_PRAVIL = [
  'KATALOG_PROIZVAJALCA',
  'URADNI_STANDARD',
  'INTERNI_INZENIRING',
  'SEKUNDARNI_VIR',
] as const
export type VirPravila = (typeof VIRI_PRAVIL)[number]

/** Slovenske oznake virov (sledljivost v UI/poročilih). */
export const VIRI_OZNAKE: Readonly<Record<VirPravila, string>> = Object.freeze({
  KATALOG_PROIZVAJALCA: 'Katalog proizvajalca',
  URADNI_STANDARD: 'Uradni standard',
  INTERNI_INZENIRING: 'Interni inženiring',
  SEKUNDARNI_VIR: 'Sekundarni vir',
})

/**
 * §15 LOČITEV — razred overitve:
 *   INFORMATIVNO   = informativni inženirski podatek/izračun (NI uradna
 *                    preverba — edino dovoljeno stanje BREZ pregleda);
 *   PROJEKTANTSKA  = uradna projektantska preverba (ZAHTEVA reviewerId +
 *                    reviewedAt — sicer javna napaka, tudi v bazi CHECK);
 *   STATISTICNA    = uradna statična preverba (isti zahtevek).
 */
export const OVERITVE = ['INFORMATIVNO', 'PROJEKTANTSKA', 'STATISTICNA'] as const
export type Overitev = (typeof OVERITVE)[number]

export const OVERITVE_OZNAKE: Readonly<Record<Overitev, string>> = Object.freeze({
  INFORMATIVNO: 'Informativno',
  PROJEKTANTSKA: 'Projektantska preverba',
  STATISTICNA: 'Statična preverba',
})

/** Statusi verzije pravila — pariteta PriceBookVersion R373 / katalog R390. */
export const STATUSI_VERZIJ = ['DRAFT', 'ACTIVE', 'RETIRED'] as const
export type StatusVerzije = (typeof STATUSI_VERZIJ)[number]

/** Dovoljeni prehodi statusa verzije pravila (matrika = TU, ne v ruti). */
export const PREHODI_VERZIJ: Readonly<Record<StatusVerzije, readonly StatusVerzije[]>> =
  Object.freeze({
    DRAFT: ['ACTIVE'],
    ACTIVE: ['RETIRED'],
    RETIRED: [],
  })

export function allowedPrehodiVerzije(from: string): readonly StatusVerzije[] {
  return PREHODI_VERZIJ[from as StatusVerzije] ?? []
}

// ── §15 LOČITEV — jedro (informative ≠ official) ────────────────────────────

/** Oblika, ki jo nosi vsaka verzija pravila (DB vrstica ali DTO). */
export interface OveritevKontekst {
  overitev: string
  reviewedAt: Date | string | null
  reviewerId: string | null
}

/**
 * JE uradno preverjeno? Fail-closed resnica: SAMO overitev != INFORMATIVNO
 * IN reviewedAt != null IN reviewerId != null. Vse ostalo (tudi pokvarjene
 * kombinacije) = false — nikoli "verjetno uradno" (§15: nepreverjeno NE sme
 * biti production compliance truth).
 */
export function jeUradnoPreverjeno(v: OveritevKontekst): boolean {
  if (v.overitev === 'INFORMATIVNO') return false
  if (!(OVERITVE as readonly string[]).includes(v.overitev)) return false
  return v.reviewedAt !== null && v.reviewerId !== null
}

/** Razred izpisa — JASNA ločitev §15 na vsakem odgovoru API-ja. */
export type RazredIzpisa = 'INFORMATIVNO' | 'URADNO'

export function razredIzpisa(v: OveritevKontekst): RazredIzpisa {
  return jeUradnoPreverjeno(v) ? 'URADNO' : 'INFORMATIVNO'
}

/**
 * Guard za USTVARJANJE/aktivacijo verzije: overitev PROJEKTANTSKA/STATISTICNA
 * ZAHTEVA reviewerId + reviewedAt. Vrne javno slovensko napako ali null.
 * (Druga linija je CHECK 'erv_uradno_zahteva_pregled' v bazi — vzorec
 * partial UNIQUE R390: store 409 PRVA, baza ZADNJA.)
 */
export function preveriUradnoOveritev(
  overitev: string,
  reviewerId: string | null,
  reviewedAt: Date | string | null,
): string | null {
  if (overitev === 'INFORMATIVNO') return null
  if (!(OVERITVE as readonly string[]).includes(overitev)) {
    return `Neznana overitev '${overitev}' (dovoljene: ${OVERITVE.join(', ')})`
  }
  if (reviewerId === null || reviewerId.trim() === '') {
    return `Uradna overitev (${overitev}) ZAHTEVA pregledalca (reviewerId) — nepreverjeno pravilo je lahko SAMO INFORMATIVNO (§15)`
  }
  if (reviewedAt === null || reviewedAt === '') {
    return `Uradna overitev (${overitev}) ZAHTEVA datum pregleda (reviewedAt) — nepreverjeno pravilo je lahko SAMO INFORMATIVNO (§15)`
  }
  return null
}

/**
 * §15 ločitev — obvestilo, ki ga vsak odgovor, ki izpostavlja tehnična
 * pravila ali inženirske izračune, nosi odkrito (iz ENEGA vira).
 */
export const SKLADNOST_OPOZORILO =
  'Informativni inženirski podatek/izračun — NE nadomešča uradnega projektantskega oziroma statičnega preverjanja (issue #13 §15). Standardne reference so zabeležene TOČNO kot jih citira vir; niso bile neodvisno preverjene.'

// ── Validacije (fail-closed — javne napake s seznami) ───────────────────────

export type ValidacijaOk<T> = { ok: true; value: T }
export type ValidacijaNapaka = { ok: false; error: string }

export function validateKategorijo(raw: unknown): ValidacijaOk<KategorijaPravila> | ValidacijaNapaka {
  if (typeof raw !== 'string' || !(KATEGORIJE_PRAVIL as readonly string[]).includes(raw)) {
    return {
      ok: false,
      error: `Neznana kategorija pravila '${String(raw)}' (dovoljene: ${KATEGORIJE_PRAVIL.join(', ')})`,
    }
  }
  return { ok: true, value: raw as KategorijaPravila }
}

export function validateVir(raw: unknown): ValidacijaOk<VirPravila> | ValidacijaNapaka {
  if (typeof raw !== 'string' || !(VIRI_PRAVIL as readonly string[]).includes(raw)) {
    return {
      ok: false,
      error: `Neznan vir pravila '${String(raw)}' (dovoljeni: ${VIRI_PRAVIL.join(', ')})`,
    }
  }
  return { ok: true, value: raw as VirPravila }
}

export function validateOveritev(raw: unknown): ValidacijaOk<Overitev> | ValidacijaNapaka {
  if (typeof raw !== 'string' || !(OVERITVE as readonly string[]).includes(raw)) {
    return {
      ok: false,
      error: `Neznana overitev '${String(raw)}' (dovoljene: ${OVERITVE.join(', ')})`,
    }
  }
  return { ok: true, value: raw as Overitev }
}

export function validateStatusVerzije(raw: unknown): ValidacijaOk<StatusVerzije> | ValidacijaNapaka {
  if (typeof raw !== 'string' || !(STATUSI_VERZIJ as readonly string[]).includes(raw)) {
    return {
      ok: false,
      error: `Neznan status verzije '${String(raw)}' (dovoljeni: ${STATUSI_VERZIJ.join(', ')})`,
    }
  }
  return { ok: true, value: raw as StatusVerzije }
}

export function validateAplikacijoPravila(raw: unknown): ValidacijaOk<Aplikacija | null> | ValidacijaNapaka {
  if (raw === null || raw === undefined || raw === '') return { ok: true, value: null }
  if (typeof raw !== 'string' || !(APLIKACIJE as readonly string[]).includes(raw)) {
    return {
      ok: false,
      error: `Neznan tip aplikacije '${String(raw)}' (dovoljeni: ${APLIKACIJE.join(', ')})`,
    }
  }
  return { ok: true, value: raw as Aplikacija }
}

export function validateOrientacijoPravila(raw: unknown): ValidacijaOk<Orientacija | null> | ValidacijaNapaka {
  if (raw === null || raw === undefined || raw === '') return { ok: true, value: null }
  if (typeof raw !== 'string' || !(ORIENTACIJE as readonly string[]).includes(raw)) {
    return {
      ok: false,
      error: `Neznana orientacija '${String(raw)}' (dovoljene: ${ORIENTACIJE.join(', ')})`,
    }
  }
  return { ok: true, value: raw as Orientacija }
}

// ── Struktura pravila (JSON kolona — zod ob vsaki sestavi DTO) ──────────────

/**
 * Strukturirana vrednost pravila: PRAZNEK nedoslednosti NE — objekt s
 * primitivnimi/plavajočimi vrednostmi (npr. {maxSpacingMm:1450},
 * {minMm:2,maxMm:30}, {terenskiFaktorji:{I:1.0,...}}). Zod dovoljuje eno
 * raven gnezdenja (faktorji). NULL v DB = čisto besedilno pravilo.
 */
export const strukturaPravilaSchema: z.ZodType<Record<string, unknown>> = z.lazy(() =>
  z.record(
    z.string(),
    z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
    ]),
  ),
)

// ── Intervali (pariteta catalog-domain R390 — EN VIR konvencij) ─────────────

export interface Interval {
  od: Date
  do: Date | null
}

/** Prekrivanje odprtih/zaprtih intervalov — [od, do): sosednja NI prekrivanje. */
export function intervalaSePrekrivata(a: Interval, b: Interval): boolean {
  const aKonec = a.do ?? Number.POSITIVE_INFINITY
  const bKonec = b.do ?? Number.POSITIVE_INFINITY
  return a.od < bKonec && b.od < aKonec
}

/** Zapri interval ob preklicu — do = asOf (MORA biti > od, sicer napaka). */
export function zapriIntervalPravila(od: Date, asOf: Date): { do: Date } | { napaka: string } {
  if (asOf <= od) {
    return { napaka: 'Preklic pred začetkom veljavnosti ni mogoč (veljavnostDo > veljavnostOd)' }
  }
  return { do: asOf }
}

// ── As-of resolucija aktivne verzije (pariteta R390) ─────────────────────────

export interface VerzijaLike {
  status: string
  veljavnostOd: Date
  veljavnostDo: Date | null
}

/**
 * Izberi ACTIVE verzijo, ki velja na dan asOf (veljavnostOd ≤ asOf <
 * veljavnostDo|∞). Druge statuse ignorira; neveljavna (še ne začeta /
 * pretekla) → null — NE padne nazaj na staro (honest).
 */
export function resolveAktivnaVerzijoPravila<T extends VerzijaLike>(
  verzije: readonly T[],
  asOf: Date,
): T | null {
  const aktivna = verzije.find((v) => v.status === 'ACTIVE')
  if (!aktivna) return null
  if (aktivna.veljavnostOd > asOf) return null
  if (aktivna.veljavnostDo !== null && aktivna.veljavnostDo <= asOf) return null
  return aktivna
}

// ── Skladnost (§15 compliance statement — JASNA ločitev) ─────────────────────

/** Povzetek skladnosti množice pravil — odkrito število uradno preverjenih. */
export function povzetekSkladnosti(pravila: readonly OveritevKontekst[]): {
  stevilo: number
  uradnoPreverjenih: number
  informativnih: number
  opozorilo: string
} {
  const uradno = pravila.filter((p) => jeUradnoPreverjeno(p)).length
  return {
    stevilo: pravila.length,
    uradnoPreverjenih: uradno,
    informativnih: pravila.length - uradno,
    opozorilo: SKLADNOST_OPOZORILO,
  }
}
