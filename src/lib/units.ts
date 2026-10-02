/**
 * R380 (issue #13, korak R168 iz §12) — KANONIČNE ENOTE + konverzijska
 * validacija. EN VIR nabora enot, ki jih posel priznava.
 * ---------------------------------------------------------------------------
 * Problem, ki ga to jedro zapira (issue #13 §12): do R380 je bila "enota"
 * prost string povsod (Inventory.enota, BOMLine.unit, MaterialOrderItem …) —
 * 'm', 'M', 'm2', 'm²', 'kos', 'kos ' so bile VSE "veljavne" in vsaka
 * primerjava je bila fuzzy uganka. §12 določa kanonični nabor:
 *   kos · m · m² · kg · l · komplet · ura · paket
 *
 * Zasnova (isti vzorec kot decimal-policy R380 — čisto jedro):
 *   • NIČ baze, NIČ ure, NIČ I/O;
 *   • EXACT ujemanje (§5 kanon — NO fuzzy): 'M' ≠ 'm', 'm2' ≠ 'm²',
 *     ' kos' ≠ 'kos' — vsak nekanonični zapis je JAVNA napaka z seznamom
 *     veljavnih vrednosti (fail-closed, NE tiha normalizacija: če bi
 *     'm2' tiho pretvorili v 'm²', bi to bila ista hevristika, ki jo §5
 *     prepoveduje pri SKU);
 *   • LEGACY enota (Inventory.enota, BOMLine.unit …) ostaja prost string —
 *     OBSTOJEČI podatki v produkciji lahko imajo nekanonične zapise in
 *     njihova prisilna migracija bi bila izumljanje zgodovine (§8).
 *     Kanonični nabor velja za NOVA struktuirana polja (Inventory.
 *     purchaseUnit/stockUnit/consumptionUnit — CHECK v migraciji) in za
 *     vsako prihodnje mesto, ki zahteva kanonično enoto;
 *   • konverzijska polja (§12): purchaseUnit/stockUnit/consumptionUnit/
 *     supplierPackSize/conversionFactor/precision/rounding — delna
 *     prisotnost je DOVOLJENA (vsako polje je neodvisno znano/neznano —
 *     honest NULL §8), IZRAČUN konverzije pa zahteva popolnost
 *     (izracunajKonverzijo spodaj: manjka karkoli → null, ne ugibanje).
 */

import { NACINI_ZAOKROZEVANJA, MAX_DECIMALKE, type NacinZaokrozevanja } from './decimal-policy'

// ── Kanonični nabor (ZAMRZNJEN — issue #13 §12, EXACT 8) ────────────────────

/**
 * 'm²' vsebuje SUPERSCRIPT 2 (U+00B2) — NE 'm2'! EXACT ujemanje je
 * case-sensitive in presledek-občutljivo (kanon §5 brez fuzzy).
 */
export const KANONICNE_ENOTE = ['kos', 'm', 'm²', 'kg', 'l', 'komplet', 'ura', 'paket'] as const
export type KanonicnaEnota = (typeof KANONICNE_ENOTE)[number]

/** Javna napaka enot — fail-closed, sporočilo vsebuje veljavne vrednosti. */
export class UnitsError extends Error {
  constructor(
    message: string,
    readonly veljavneEnote: readonly KanonicnaEnota[] = KANONICNE_ENOTE,
    /** Predlagan HTTP status. */
    readonly suggestedStatus: number = 400,
  ) {
    super(`[units] ${message}`)
    this.name = 'UnitsError'
  }
}

/**
 * EXACT preverba: true SAMO za enega izmed osmih kanoničnih zapisov.
 * Neveljaven tip (ne-string) → false (ne vrže — preverba, ne validacija).
 */
export function jeKanonicnaEnota(enota: unknown): boolean {
  return (
    typeof enota === 'string' &&
    (KANONICNE_ENOTE as readonly string[]).includes(enota)
  )
}

/**
 * Fail-closed validacija kanonične enote: natančno ena izmed osmih.
 * Neveljaven zapis → UnitsError s seznamom veljavnih vrednosti v
 * sporočilu (klient vidi TOČNO kaj je dovoljeno — ne ugiba).
 */
export function veljavajKanonicnoEnoto(enota: unknown, imePolja: string): KanonicnaEnota {
  if (typeof enota !== 'string') {
    throw new UnitsError(`${imePolja}: enota mora biti string, dobil ${typeof enota}`)
  }
  if (!(KANONICNE_ENOTE as readonly string[]).includes(enota)) {
    throw new UnitsError(
      `${imePolja}: '${enota}' NI kanonična enota — veljavne: ${KANONICNE_ENOTE.join(' · ')} (EXACT zapis; 'm²' ima superscript, ne 'm2')`,
    )
  }
  return enota as KanonicnaEnota
}

// ── Zaokroževalni načini + preciznost (pogodba z decimal-policy) ────────────

export { NACINI_ZAOKROZEVANJA }
export type { NacinZaokrozevanja }

/**
 * Fail-closed validacija načina zaokroževanja (GORI/DOL/NAJBLIZJE).
 * Uporablja se pri Inventory.rounding — material lahko zahteva svoj način
 * (nabava GORI, izdaja DOL, splošno NAIJBLIZJE).
 */
export function veljavajNacinZaokrozevanja(nacin: unknown, imePolja: string): NacinZaokrozevanja {
  if (typeof nacin !== 'string' || !(NACINI_ZAOKROZEVANJA as readonly string[]).includes(nacin)) {
    throw new UnitsError(`${imePolja}: '${String(nacin)}' NI veljaven način — veljavni: ${NACINI_ZAOKROZEVANJA.join(' · ')}`)
  }
  return nacin as NacinZaokrozevanja
}

/**
 * Fail-closed validacija preciznosti količin materiala: celo število 0–6
 * (ista meja kot decimal-policy MAX_DECIMALKE — en vir).
 */
export function veljavajPreciznost(preciznost: unknown, imePolja: string): number {
  if (typeof preciznost !== 'number' || !Number.isInteger(preciznost) || preciznost < 0 || preciznost > MAX_DECIMALKE) {
    throw new UnitsError(`${imePolja}: preciznost mora biti celo število 0–${MAX_DECIMALKE}, dobil: ${String(preciznost)}`)
  }
  return preciznost
}

// ── Konverzija enot (§12 — tri enote + pack size + faktor + preciznost) ─────

/**
 * Neznan vhod konverzije (surov JSON / DB vrstica). VSA polja neobvezna —
 * null = neznano (§8). TIP je namerno širok: validacija spodaj je edina
 * avtoriteta za obliko.
 */
export interface KonverzijaVhod {
  purchaseUnit?: unknown
  stockUnit?: unknown
  consumptionUnit?: unknown
  supplierPackSize?: unknown
  conversionFactor?: unknown
  precision?: unknown
  rounding?: unknown
}

/** Validirana konverzija — vsa polja so ZAGOTOVLJENO veljavna (ne null). */
export interface Konverzija {
  purchaseUnit: KanonicnaEnota
  stockUnit: KanonicnaEnota
  consumptionUnit: KanonicnaEnota
  supplierPackSize: number
  conversionFactor: number
  precision: number
  rounding: NacinZaokrozevanja
}

/**
 * Veljavna konverzija za ZAPIS v DB: vsako prisotno polje validira, vsako
 * odsotno pusti null (delna prisotnost DOVOLJENA — neodvisno znano/neznano).
 * Vrne izključno polja, ki so bila prisotna (za direkten prisma data vhod).
 *
 * Fail-closed: prisoten ampak neveljaven → UnitsError (npr. 'm2' → napaka,
 * NE tiha normalizacija v 'm²' — kanon §5 EXACT).
 */
export function veljavajKonverzijoZaZapis(vhod: KonverzijaVhod): {
  purchaseUnit: KanonicnaEnota | null
  stockUnit: KanonicnaEnota | null
  consumptionUnit: KanonicnaEnota | null
  supplierPackSize: number | null
  conversionFactor: number | null
  precision: number | null
  rounding: NacinZaokrozevanja | null
} {
  return {
    purchaseUnit: vhod.purchaseUnit === undefined || vhod.purchaseUnit === null ? null : veljavajKanonicnoEnoto(vhod.purchaseUnit, 'purchaseUnit'),
    stockUnit: vhod.stockUnit === undefined || vhod.stockUnit === null ? null : veljavajKanonicnoEnoto(vhod.stockUnit, 'stockUnit'),
    consumptionUnit:
      vhod.consumptionUnit === undefined || vhod.consumptionUnit === null
        ? null
        : veljavajKanonicnoEnoto(vhod.consumptionUnit, 'consumptionUnit'),
    supplierPackSize:
      vhod.supplierPackSize === undefined || vhod.supplierPackSize === null ? null : veljavajPozitivnoStevilo(vhod.supplierPackSize, 'supplierPackSize'),
    conversionFactor:
      vhod.conversionFactor === undefined || vhod.conversionFactor === null ? null : veljavajPozitivnoStevilo(vhod.conversionFactor, 'conversionFactor'),
    precision: vhod.precision === undefined || vhod.precision === null ? null : veljavajPreciznost(vhod.precision, 'precision'),
    rounding: vhod.rounding === undefined || vhod.rounding === null ? null : veljavajNacinZaokrozevanja(vhod.rounding, 'rounding'),
  }
}

/**
 * Konverzija za IZRAČUN: zahteva POPOLNOST — manjka katerokoli polje →
 * null (iskreno NEIZRAČUNLJIVO, §8 — nikoli privzeti faktor 1 ali
 * uganjati pack size). Klicatelj mora null javiti naprej, ne tiho
 * nadomestiti.
 */
export function izracunajKonverzijo(vhod: KonverzijaVhod): Konverzija | null {
  const zapis = veljavajKonverzijoZaZapis(vhod)
  if (
    zapis.purchaseUnit === null ||
    zapis.stockUnit === null ||
    zapis.consumptionUnit === null ||
    zapis.supplierPackSize === null ||
    zapis.conversionFactor === null ||
    zapis.precision === null ||
    zapis.rounding === null
  ) {
    return null
  }
  return zapis as Konverzija
}

/** Notranje: pozitivno končno število (količine > 0 — ničla bi bila laž). */
function veljavajPozitivnoStevilo(vrednost: unknown, imePolja: string): number {
  if (typeof vrednost !== 'number' || !Number.isFinite(vrednost) || vrednost <= 0) {
    throw new UnitsError(`${imePolja}: mora biti pozitivno končno število, dobil: ${String(vrednost)}`)
  }
  return vrednost
}
