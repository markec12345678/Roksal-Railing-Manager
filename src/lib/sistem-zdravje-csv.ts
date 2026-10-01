// R336 — 63. člen (issue #1 IZVOZI družina): SISTEM — ZDRAVJE CSV.
// ---------------------------------------------------------------------------
// CSV brat zaslona SistemZdravjeCard (R187/R188/R189) — ZADNJA vodja kartica
// brez podatkovnega izvoza (dobičkonost R258/R293, mesečni R335, dnevni
// R163/R324, audit R317, končna R316/R320/R334, zmogljivost R321/R323 imajo
// vse svoje izvoze). Vodja ob podpori/poročanju o težavah dobi trajen zapis
// meritev te seje — isti podatek, ki ga trak palic že pokaže, zdaj v Excelu.
//
// EN VIR (anti-divergenca po konstrukciji — vzorec R334/R335):
//  • meritve = ISTA seja zgodovina (zdravje-zgodovina, ring ZGODOVINA_MAX) —
//    ISTI številski izpisi kot trak palic (title `${ms} ms`);
//  • statistika = ISTA funkcija odziviStatistika (ISTI izračun kot nasvetna
//    vrstica na zaslonu — divergenca nemogoča);
//  • 'Zgrajeno' = ISTI klic zigIzpis kot kartica (vzorec R185 fail-soft:
//    pokvaren žig NE razbije izvoza — prazen stolpec, core meritve ostanejo
//    fail-closed);
//  • 'Baza' = ISTI niz kot žeton na zaslonu (BAZA_NIZ — kartica UVAŽA
//    konstanto, precedens R335 STATUS_SL: const → export, zero-behavior).
//
// BREZ časa — kanon R334 (statičen izvoz te seje): meritve niso čas-anchored
// na zaslonu (trak pokaže SAMO vrednosti, pečat 'Osveženo ob' je živ metapodatek
// kartice, ne del zgodovine), zato izvoz NE nosi 'Izvoženo ob' — isti zgodovina
// + build = bajtno identična datoteka (FULL determinizem; RAZLIKA od
// podatkovnih izvozov R330–R335, ki nosijo 'Izvoženo ob', ker je njihova
// resnica čas-odvisna — zapadli dni, referenčni mesec).
//
// Format = kanon R136 toCsv (BOM + podpičje + CRLF + RFC 4180 citiranje).
// Fail-closed po imenu polja (kanon R299) — vsaka graditeljska vrstica nosi
// ime liba/graditelja; statistika delegira validacijo na odziviStatistika
// (EN VIR strogost brezplačno — NIČ podvojenih pravil).
import { toCsv, type CsvValue } from './csv-export'
import { odziviStatistika } from './zdravje-zgodovina'
import { zigIzpis } from './posodobitev-jedro'

/** Glava bloka meritev — ISTA ravnina kot trak palic (meritev na vrstico). */
export const ZDRAVJE_CSV_GLAVE_MERITEV = ['Zaporedna preverba', 'Odziv (ms)'] as const

/** ISTI niz kot žeton stanja na zaslonu (SistemZdravjeCard ga UVAŽA — en vir). */
export const BAZA_NIZ = 'Baza odgovarja'

/** Vir resnice (meta vrstica; podpičje znotraj = RFC 4180 citiranje v praksi). */
export const ZDRAVJE_VIR_NIZ =
  'Sistem zdravje — zgodovina te seje; javna sonda /api/public/health (pinguje bazo)'

/**
 * ENA vrstica bloka meritev (WYSIWYG — ISTI izpisi kot trak palic:
 * zaporedna številka 1..n + surova meritev v ms, kakršno je kartica izmerila).
 * Fail-closed TypeError na neveljavnem vhodu (kanon R299 — ime polja).
 */
export function sistemZdravjeCsvVrstica(zaporedna: number, ms: number): CsvValue[] {
  if (!Number.isInteger(zaporedna) || zaporedna < 1) {
    throw new TypeError(`sistemZdravjeCsvVrstica: neveljavna zaporedna številka: ${String(zaporedna)}`)
  }
  if (!Number.isFinite(ms) || ms < 0) {
    throw new TypeError(`sistemZdravjeCsvVrstica: neveljavna meritev (ms): ${String(ms)}`)
  }
  return [String(zaporedna), String(ms)]
}

/**
 * Zgrodi deterministični CSV sistem zdravja te seje. Statistika se IZPELJA
 * iz ISTEGA vhoda prek odziviStatistika (EN VIR — NIČ trdo kodiranih števil,
 * NIČ podvojenega izračuna). BREZ 'Izvoženo ob' (kanon R334 — vrnjena resnica
 * je za isti vhod bajtno identična, vedno).
 */
export function sistemZdravjeCsv(zgodovina: readonly number[], build: string | null): string {
  if (!Array.isArray(zgodovina)) {
    throw new TypeError('sistemZdravjeCsv: pričakovana zgodovina meritev (polje)')
  }
  if (zgodovina.length === 0) {
    throw new TypeError('sistemZdravjeCsv: zgodovina te seje je prazna — ničesar ni izvoziti')
  }
  // EN VIR statistika (ISTA funkcija kot nasvetna vrstica na zaslonu) —
  // fail-closed brezplačno: prazna zgodovina + neveljavna meritev sta že
  // preverjena tukaj (kanon R299 strogost ISTEGA jedra).
  const stat = odziviStatistika(zgodovina)
  // Blok meritev — zaporedna 1..n, ISTI surovi ms kot palice.
  const meritve: CsvValue[][] = zgodovina.map((ms, i) => sistemZdravjeCsvVrstica(i + 1, ms))
  // 'Zgrajeno' = fail-soft (vzorec R185/R187: nasvetna podrobnost — pokvaren
  // žig NE razbije izvoza; ISTI klic zigIzpis kot kartica → ISTI izpis).
  let zgrajeno = ''
  if (build !== null) {
    if (typeof build !== 'string') {
      throw new TypeError(`sistemZdravjeCsv: neveljaven build žig: ${String(build)}`)
    }
    try {
      zgrajeno = zigIzpis(build)
    } catch {
      zgrajeno = ''
    }
  }
  // Meta blok: stanje baze (ISTI niz kot žeton) + zgrajeno + statistika
  // (IZRAČUNANA iz istega vhoda — nič trdo kodiranih) + vir. Brez 'Izvoženo ob'.
  const meta: CsvValue[][] = [
    [], // prazna ločilna vrstica pred povzetkom (preglednost v Excelu)
    ['Baza', BAZA_NIZ],
    ['Zgrajeno', zgrajeno],
    ['Najhitrejša (ms)', String(stat.najhitrejsa)],
    ['Povprečna (ms)', String(stat.povprecna)],
    ['Najpočasnejša (ms)', String(stat.najpocasnejsa)],
    ['Vir', ZDRAVJE_VIR_NIZ],
  ]
  return toCsv([...ZDRAVJE_CSV_GLAVE_MERITEV], [...meritve, ...meta])
}

/** Deterministično ime datoteke (brez datuma — brez-časa kanon R334; bratska
 *  simetrija z 'koncna-verifikacija.csv' R334 — statičen izvoz te seje). */
export function sistemZdravjeCsvFilename(): string {
  return 'sistem-zdravje.csv'
}
