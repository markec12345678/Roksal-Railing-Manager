/**
 * R390 (issue #13, korak R170 iz §14) — ČISTO JEDRO produktnega kataloga
 * (aplikacijski kontekst). NIČ baze, ure ali IO — vzorec crm-pipeline R382 /
 * production-orders R378: matrike in validacije so PODATEK + funkcije, ki jih
 * store-plast in rute DELIJO (EN VIR — §14 "ne hardcodirati teh pravil v
 * več UI-jih": nabori živijo TU, ne v komponentah).
 *
 * Načela:
 *   • §14 nabor aplikacij EXACT — HORIZONTALNA_OGRAJA | POKONCNA_OGRAJA |
 *     TERASA | PREDELNA_STENA | FASADA | STROP; neznan → JAVNA napaka s
 *     seznamom (fail-closed, NE tiha normalizacija — kanon §5);
 *   • honest NULL (§8): maxRazmakMm/veljavnostDo/okrepitevOpis so NULL, ko
 *     neznani — nikoli izmišljeni;
 *   • statusni stroj verzije kataloga = pariteta PriceBookVersion R373
 *     (DRAFT → ACTIVE → RETIRED; dve ACTIVE hkrati = pokvarjeno stanje);
 *   • JSON kolone (paleta/razmaki/ročaj/dolžine/posebnosti) validirane z
 *     zod ob VSAKI sestavi DTO — pokvarjen JSON = javna napaka, NE tiho
 *     pražen niz.
 */

import { z } from 'zod'

// ── §14 EXACT nabori ────────────────────────────────────────────────────────

/** §14 aplikacije — EXACT besednjak iz issue #13. */
export const APLIKACIJE = [
  'HORIZONTALNA_OGRAJA',
  'POKONCNA_OGRAJA',
  'TERASA',
  'PREDELNA_STENA',
  'FASADA',
  'STROP',
] as const
export type Aplikacija = (typeof APLIKACIJE)[number]

/** Slovenske oznake aplikacij (UI/poročila — iz ENega vira, ne v UI-jih). */
export const APLIKACIJE_OZNAKE: Readonly<Record<Aplikacija, string>> = Object.freeze({
  HORIZONTALNA_OGRAJA: 'Prečna ograja',
  POKONCNA_OGRAJA: 'Pokončna ograja',
  TERASA: 'Terasa',
  PREDELNA_STENA: 'Predelna stena',
  FASADA: 'Fasada',
  STROP: 'Strop / zastor',
})

/** Orientacije — pariteta Product SDK (S+8): horizontal | vertical. */
export const ORIENTACIJE = ['horizontal', 'vertical'] as const
export type Orientacija = (typeof ORIENTACIJE)[number]

/** Kategorije profilov — EXACT iz kataloga (precna | pokoncna | precna+pokoncna). */
export const KATEGORIJE_PRODUKTOV = ['precna', 'pokoncna', 'precna+pokoncna'] as const
export type KategorijaProdukta = (typeof KATEGORIJE_PRODUKTOV)[number]

/** Pravice — pariteta SDK RightsStatus (S+8: pending | granted | rejected). */
export const PRAVICE = ['pending', 'granted', 'rejected'] as const
export type Pravice = (typeof PRAVICE)[number]

/** Statusi verzije kataloga — pariteta PriceBookVersion R373. */
export const KATALOG_STATUSES = ['DRAFT', 'ACTIVE', 'RETIRED'] as const
export type KatalogStatus = (typeof KATALOG_STATUSES)[number]

/** Dovoljeni prehodi statusa verzije kataloga (matrika = TU, ne v ruti). */
export const KATALOG_PREHODI: Readonly<Record<KatalogStatus, readonly KatalogStatus[]>> =
  Object.freeze({
    DRAFT: ['ACTIVE'],
    ACTIVE: ['RETIRED'],
    RETIRED: [],
  })

export function allowedKatalogTransitions(from: string): readonly KatalogStatus[] {
  return KATALOG_PREHODI[from as KatalogStatus] ?? []
}

// ── Validacije (fail-closed — javne napake s seznami) ──────────────────────

export type ValidacijaOk<T> = { ok: true; value: T }
export type ValidacijaNapaka = { ok: false; error: string }

export function validateAplikacija(raw: unknown): ValidacijaOk<Aplikacija> | ValidacijaNapaka {
  if (typeof raw !== 'string' || !(APLIKACIJE as readonly string[]).includes(raw)) {
    return {
      ok: false,
      error: `Neznan tip aplikacije '${String(raw)}' (dovoljeni: ${APLIKACIJE.join(', ')})`,
    }
  }
  return { ok: true, value: raw as Aplikacija }
}

export function validateOrientacija(raw: unknown): ValidacijaOk<Orientacija> | ValidacijaNapaka {
  if (typeof raw !== 'string' || !(ORIENTACIJE as readonly string[]).includes(raw)) {
    return {
      ok: false,
      error: `Neznana orientacija '${String(raw)}' (dovoljene: ${ORIENTACIJE.join(', ')})`,
    }
  }
  return { ok: true, value: raw as Orientacija }
}

export function validateKategorija(
  raw: unknown,
): ValidacijaOk<KategorijaProdukta> | ValidacijaNapaka {
  if (
    typeof raw !== 'string' ||
    !(KATEGORIJE_PRODUKTOV as readonly string[]).includes(raw)
  ) {
    return {
      ok: false,
      error: `Neznana kategorija '${String(raw)}' (dovoljene: ${KATEGORIJE_PRODUKTOV.join(', ')})`,
    }
  }
  return { ok: true, value: raw as KategorijaProdukta }
}

export function validatePravice(raw: unknown): ValidacijaOk<Pravice> | ValidacijaNapaka {
  if (typeof raw !== 'string' || !(PRAVICE as readonly string[]).includes(raw)) {
    return {
      ok: false,
      error: `Neznane pravice '${String(raw)}' (dovoljene: ${PRAVICE.join(', ')})`,
    }
  }
  return { ok: true, value: raw as Pravice }
}

/** maxRazmakMm — pozitiven ceo mm ALI NULL (neznano, §8). */
export function validateMaxRazmakMm(
  raw: unknown,
): ValidacijaOk<number | null> | ValidacijaNapaka {
  if (raw === undefined || raw === null) return { ok: true, value: null }
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw <= 0) {
    return {
      ok: false,
      error: `maxRazmakMm mora biti pozitivno celo število (mm) ali null (dobili: ${String(raw)})`,
    }
  }
  return { ok: true, value: raw }
}

// ── Zod sheme JSON kolon (katalog je PODATEK — pokvarjen JSON = javna napaka) ─

export const barvnaPaletaSchema = z.array(
  z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    nameSl: z.string(),
    approxHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
    evidence: z.string(),
  }),
)
export type BarvnaPaleta = z.infer<typeof barvnaPaletaSchema>

export const razmakKvalifikatorjiSchema = z.array(
  z.object({
    key: z.string().min(1),
    maxSpacingMm: z.number().positive(),
  }),
)
export type RazmakKvalifikator = z.infer<typeof razmakKvalifikatorjiSchema>[number]

export const standardLengthsSchema = z.array(z.number().positive().int()).min(1)

export const rocajSchema = z.object({
  available: z.boolean(),
  dimensionMm: z.array(z.number()).optional(),
  innerMm: z.array(z.number()).optional(),
  screwsEveryMm: z.number().optional(),
  screwsVisible: z.boolean().optional(),
  maxSpliceMm: z.number().optional(),
  note: z.string().optional(),
})
export type RocajPodatki = z.infer<typeof rocajSchema>

export const viriSchema = z.array(z.string().url()).min(1)

/** Prazna lista pravil ni napaka (družina brez pravil = honest stanje). */
export const splosnaPravilaSchema = z.array(z.string())

/** Varianta — barvaId iz družinske palete SE preveri v store-plasti (DB). */
export const variantaDtoSchema = z.object({
  sifra: z.string().min(1),
  naziv: z.string().min(1),
  barvaId: z.string().nullable().optional(),
  barvaHex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  povrsina: z.string().nullable().optional(),
})

// ── Razreševanje verzije kataloga na datum (§14 effective dates) ────────────

export interface KatalogVerzijaInterval {
  id: string
  verzija: number
  status: string
  veljavnostOd: Date
  veljavnostDo: Date | null
  /** Neobvezno (snapshot ga odraža; resolve ga ne potrebuje). */
  opomba?: string | null
}

/**
 * ACTIVE verzija, veljavna na dan `asOf` (veljavnostOd ≤ asOf <
 * veljavnostDo|neskončno). Več ACTIVE hkrati = POKVARJENO stanje → javna
 * napaka (pariteta price-book R373: nikoli "izberi prvo"). Brez ACTIVE →
 * null (fail-closed klicatelj odgovori 409/503 — NE izmišlji verzije).
 */
export function resolveAktivnaVerzija(
  verzije: readonly KatalogVerzijaInterval[],
  asOf: Date,
): { verzija: KatalogVerzijaInterval } | { napaka: string } | null {
  const aktivne = verzije.filter((v) => v.status === 'ACTIVE')
  if (aktivne.length > 1) {
    return {
      napaka: `Pokvarjeno stanje: ${aktivne.length} ACTIVE verziji kataloga hkrati (${aktivne
        .map((v) => `#${v.verzija}`)
        .join(', ')})`,
    }
  }
  const aktivna = aktivne[0]
  if (!aktivna) return null
  if (aktivna.veljavnostOd > asOf) return null // še ne začela veljati
  if (aktivna.veljavnostDo !== null && aktivna.veljavnostDo <= asOf) return null
  return { verzija: aktivna }
}

// ── Prekrivanje intervalov (§14 supplier mapping effective dates) ───────────

export interface Interval {
  od: Date
  do: Date | null
}

/**
 * Prekrivanje odprtih/zaprtih intervalov istega (produkt, dobavitelj) —
 * polodprta konvencija [od, do): sosednja (do == naslednji od) NI prekrivanje.
 */
export function intervalaSePrekrivata(a: Interval, b: Interval): boolean {
  const aKonec = a.do ?? Number.POSITIVE_INFINITY
  const bKonec = b.do ?? Number.POSITIVE_INFINITY
  return a.od < bKonec && b.od < aKonec
}

/** Zapri interval ob preklicu — do = asOf (MORA biti > od, sicer 400). */
export function zapriInterval(od: Date, asOf: Date): { do: Date } | { napaka: string } {
  if (asOf <= od) {
    return { napaka: 'Preklic pred začetkom veljavnosti ni mogoč (veljavnostDo > veljavnostOd)' }
  }
  return { do: asOf }
}

// ── Kompatibilnost (§14 Compatibility) ──────────────────────────────────────

export interface KompatibilnostCilj {
  kompatibilenProductId: string | null
  kompatibilenDodatekId: string | null
}

/** XOR invarianta — natanko EN cilj (produktna vrstica NE laže o cilju). */
export function kompatibilnostImaNatankoEnCilj(cilj: KompatibilnostCilj): boolean {
  return (cilj.kompatibilenProductId === null) !== (cilj.kompatibilenDodatekId === null)
}

/** Samo-kompatibilnost produkta je nesmisel (isti produkt samemu sebi). */
export function jeSamoKompatibilnost(productId: string, cilj: KompatibilnostCilj): boolean {
  return cilj.kompatibilenProductId === productId
}

// ── DTO sestava (JSON kolone → tipske strukture; javna napaka ob pokvarjenem) ─

export type JsonParseRezultat<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

export function preberiJsonKolono<T>(
  raw: string,
  schema: z.ZodType<T>,
  polje: string,
): JsonParseRezultat<T> {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: `Kolona "${polje}" NI veljaven JSON` }
  }
  const res = schema.safeParse(parsed)
  if (!res.success) {
    const issues = res.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    return { ok: false, error: `Kolona "${polje}" NI veljavna: ${issues}` }
  }
  return { ok: true, value: res.data }
}
