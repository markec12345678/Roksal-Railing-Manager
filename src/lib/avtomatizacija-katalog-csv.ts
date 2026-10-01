// ---------------------------------------------------------------------------
// R355 — 65. člen issue #1 (IZVOZI družina): izvoz POLNEGA kataloga zmožnosti
// (issue #1 §11 — AutomationProvider arhitektura) kot DETERMINISTIČNI CSV.
//
// Razlika od brata R317 (audit CSV): audit = projekcija po OBMOČJIH (11
// vrstic), katalog = ENA VRSTICA NA ZMOŽNOST (26 vrstic — vsaka funkcija z
// id/vrsta/območje/opis/modul + razrešen nadomestek za AI vnose). Revizija/
// pisarna dobi prenosljiv dokaz arhitekture «jedro deluje brez AI» — ISTI
// katalog kot UI kartice ('Avtomatizacija — razred funkcij'), ponudniki
// (ponudniki.ts) in docs/automacija-audit.md (EN VIR — NIČ dvojnega).
//
// Kanon (vzorec R317/R322/R337):
//  • toCsv (BOM + podpičje + CRLF + RFC 4180 citiranje — opisi z vejicami/
//    narekovaji varno citirani);
//  • brez metapodatkov časa/hash — isti HEAD → bajtno identična datoteka
//    (determinizem kanon 46.–50. člen); filename brez datuma (veza na HEAD
//    implicitna — vzorec avtomatizacija-audit.csv);
//  • fail-closed: AI zmožnost brez izrečenega nadomestka, nadomestek, ki se
//    ne razreši v katalogu, ALI podvojen id → TypeError (pokvaren katalog ne
//    more postati lažno poročilo — vzorec avtomatizacijaPregled validacije);
//  • vrsta = RAW vrednost ('deterministic'|'sdk'|'script'|'ai') — kanonski
//    identifikator, ki ga nosijo ponudniki (machine-readable za Excel
//    filtriranje; iskreno dokumentirano, NI prikaznega preslikavanja);
//  • sklep = izpeljava iz EN VIR povzetka (avtomatizacijaPovzetek — ISTE
//    številke kot kartica na vodji; NIČ ročno vpisanih, NIČ dvojnega sklepa);
//  • meta vrstice: prazna ločilna + Sklep + Vir (vzorec R317).
// ---------------------------------------------------------------------------

import { toCsv } from '@/lib/csv-export'
import type { CsvValue } from '@/lib/csv-export'
import {
  AUTOMATIZACIJSKI_KATALOG,
  avtomatizacijaPovzetek,
  type AutomatizacijskaZmoznost,
} from './automation/katalog'

/** Glave CSV (EN VIR za celo izvozno družino — vzorec AUDIT_CSV_GLAVE). */
export const KATALOG_CSV_GLAVE: readonly string[] = [
  'Id',
  'Vrsta',
  'Območje',
  'Opis',
  'Modul',
  'Nadomestek (id)',
  'Nadomestek (opis)',
]

/** Vir niz meta vrstice (EN VIR — vzorec AUDIT_VIR_NIZ R318). */
export const KATALOG_VIR_NIZ =
  'AVTOMATIZACIJSKI_KATALOG — isti HEAD = bajtno identičen izvoz'

/** Indeks po id-ju — fail-closed: podvojen id = pokvaren katalog (TypeError;
 *  strazar R294 vsiljuje unikatnost, CSV jo vsiljuje NEODVISNO). */
function indeksPoId(
  katalog: readonly AutomatizacijskaZmoznost[],
): Map<string, AutomatizacijskaZmoznost> {
  const poId = new Map<string, AutomatizacijskaZmoznost>()
  for (const z of katalog) {
    if (poId.has(z.id)) {
      throw new TypeError(
        `avtomatizacijaKatalogCsv: podvojen id zmožnosti '${z.id}' — fail-closed`,
      )
    }
    poId.set(z.id, z)
  }
  return poId
}

/**
 * Zgrodi deterministični CSV polnega kataloga zmožnosti. Privzeti vhod =
 * EN VIR (parametriziran SAMO za teste fail-closed poti — produkcija vedno
 * kliče brez argumenta). Vrstni red vrstic = ISTI vrstni red kot katalog
 * (nič prerazporejanja — kanon pregleda).
 */
export function avtomatizacijaKatalogCsv(
  katalog: readonly AutomatizacijskaZmoznost[] = AUTOMATIZACIJSKI_KATALOG,
): string {
  const poId = indeksPoId(katalog)
  const podatkovne: CsvValue[][] = katalog.map((z) => {
    if (z.vrsta === 'ai') {
      // Kontrakt §11: vsak AI vnos IZRECNO deklarira deterministični
      // nadomestek — CSV ga nosi RAZREŠENEGA (id + opis), sicer ni dokaz.
      if (!z.nadomestek) {
        throw new TypeError(
          `avtomatizacijaKatalogCsv: AI zmožnost '${z.id}' brez izrečenega nadomestka (kontrakt §11) — fail-closed`,
        )
      }
      const n = poId.get(z.nadomestek)
      if (!n) {
        throw new TypeError(
          `avtomatizacijaKatalogCsv: nadomestek '${z.nadomestek}' (AI '${z.id}') ne obstaja v katalogu — fail-closed`,
        )
      }
      return [z.id, z.vrsta, z.obmocje, z.opis, z.modul, z.nadomestek, n.opis]
    }
    return [z.id, z.vrsta, z.obmocje, z.opis, z.modul, '', '']
  })
  // Sklep: EN VIR izpeljava iz povzetka (ISTE številke kot kartica na vodji
  // — avtomatizacijaPovzetek; NIČ ročno vpisanih, NIČ dvojnega sklepa).
  const pov = avtomatizacijaPovzetek(katalog)
  const sklep =
    `Katalog: ${pov.skupaj} zmožnosti (${pov.deterministicnih} determinističnih, ` +
    `${pov.sdk} SDK, ${pov.skriptov} skriptov, ${pov.ai} AI neobveznih) — ` +
    `${pov.aiZNadomestkom} z izrečenim determinističnim nadomestkom; jedro deluje brez AI.`
  const meta: CsvValue[][] = [
    [], // prazna ločilna vrstica pred povzetkom (preglednost v Excelu)
    ['Sklep', sklep],
    ['Vir', KATALOG_VIR_NIZ],
  ]
  return toCsv([...KATALOG_CSV_GLAVE], [...podatkovne, ...meta])
}

/** Deterministično ime datoteke (brez datuma — veza na HEAD je implicitna;
 *  vzorec avtomatizacija-audit.csv, 47. člen). */
export function avtomatizacijaKatalogCsvFilename(): string {
  return 'avtomatizacija-katalog.csv'
}
