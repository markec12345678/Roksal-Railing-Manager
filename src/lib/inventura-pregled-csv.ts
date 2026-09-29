// ---------------------------------------------------------------------------
// R286 (P1-f, 'izvozi' družina — 30. člen) — INVENTURA — PREMOŽENJSKI PREGLED
// CSV iz Zaloge (inventory-tab.tsx). SEMANTIČNE ODLOČITVE F1–F6 ZAPISANE
// PRED RAZVOJEM (worklog R286 — kanon R283/R284/R285):
//
//   F1 RAZMEJITEV: R270 inventura-pregled PDF = človeški referenčni list
//      (ROKSAL glava, KPI 5, autoTable, sklep); R286 CSV = ISTA resnica za
//      DIGITALNO izpolnjevanje / računovodski uvoz v Excelu. EN VIR =
//      `inventuraPregled` (ISTI vrsti, ISTI akcijski sort, ISTA validacija
//      — WYSIWYG po konstrukciji); `inventura-pregled-pdf.ts` NI dotaknjen
//      (samo IMPORT) — bajtna družinska zaščita (R285 Y1 vzorec).
//   F2 STOLPCI 11 = 8 PDF tabelnih (Šifra/Naziv/Tip/Zaloga/Enota/Minimum/
//      Manjka/Status — glava startsWith pariteta z R270 autoTable head,
//      bajtno dokazana testom) + 3 strojno-berljivi dodatni (id —
//      identiteta artikla; Premiki — obrat EN VIR join po id nad ISTIMI
//      validiranimi artikli; Izvoženo — kanonični ISO 8601 iz `now`,
//      R186 lekcija: test pričakuje toISOString, ne surov ts).
//   F3 FAIL-CLOSED ISTI KONTRAKT: validacija je notranja resnica
//      `inventuraPregled` (prazen seznam → TypeError; podvojen id ALI
//      šifra → TypeError; pokvaren vnos → TypeError z indeksom krivca) —
//      NIČ lastne tolerance, NIČ tihe degradacije. Manjka = 0 → '0'
//      strojno (R270 PDF '—' je človeška konvencija tiska; CSV je
//      mašinetno berljiv arhiv — R285 Y3 vzorec: izpolnjevalna resnica
//      ostane strojna, ne slikovna).
//   F4 DETERMINIZEM: čista funkcija (brez ure/DB/mreže); `now` KOT
//      parameter; UTF-8 BOM + '\n' zaključki; VSA polja citirana
//      (narekovaj podvojen — vzorec vodja-csv/R285); ime datoteke KOT
//      izpeljanka veljavnega `now` — enak vhod = bajtno enak CSV.
//   F5 KODE VERBATIM: status = enum ('POD MINIMUMOM'|'NA MEJI'|
//      'ZADOSTNO'), tip = label resnica (ISTA preslikava typeLabels kot
//      handler), številke = kolicinaNiz EN VIR iz zaloga-osnutek-pdf R262
//      (celo → String, sicer 2 decimalna mesti, brez locale — NI zasegane
//      kopije; F2 pariteta formata z R270 tabelo po konstrukciji).
//   F6 PRAVILA: route NIČ, DB NIČ, shema NIČ, core NIČ, OgrajaVizija
//      nič, 0 novih hex; UI gumb = družinski kontrakt (press-scale,
//      dvoklik guard, aria-label, hover title, FileSpreadsheet
//      aria-hidden) + legenda 1:1.
// ---------------------------------------------------------------------------
import {
  inventuraPregled,
  type InventuraArtikel,
  type InventuraVrsta,
} from './inventura-pregled-pdf'
import { kolicinaNiz } from './zaloga-osnutek-pdf'
import { todayStamp } from './csv-export'

/** Citiranje besedilnih polj (narekovaj podvojen) — vzorec vodja-csv
 *  (družinski kanon: vsak CSV lib nosi lasten 3-vrstični citiraj). */
function citiraj(v: string): string {
  return `"${v.replace(/"/g, '""')}"`
}

/** 8 tabelnih stolpcev — bajtna pariteta z R270 autoTable head (F2;
 *  PDF lib NI dotaknjen — pariteta dokazana startsWith testom, NI kopije
 *  izvozljive konstante: bajtni kontrakt PDF ostane izoliran, R285 Y1). */
const TABELA_GLAVA = [
  'Šifra',
  'Naziv',
  'Tip',
  'Zaloga',
  'Enota',
  'Minimum',
  'Manjka',
  'Status',
] as const

/** 3 dodatni strojno-berljivi stolpci (F2) — po 8 R270 tabelnih. */
export const INVENTURA_CSV_DODATNI = ['id', 'Premiki', 'Izvoženo'] as const

/** Število stolpcev kontrakta: 8 R270 tabela + 3 dodatni = 11 (F2). */
export const INVENTURA_CSV_STOLPCEV = 8 + INVENTURA_CSV_DODATNI.length

/** Glava: 8 R270 tabelnih + 3 dodatni (vsi citirani). */
const GLAVA = `${TABELA_GLAVA.map((c) => citiraj(c)).join(',')},${INVENTURA_CSV_DODATNI.map((c) => citiraj(c)).join(',')}`

/** Dodatne celice iz vrste + artikla (F2/F5): id verbatim, Premiki =
 *  obrat EN VIR (_count.movements — celo število), Izvoženo = kanonični
 *  ISO iz `now` (parameter — jedro ne bere ure, F4). */
function dodatneCelice(v: InventuraVrsta, premiki: number, izvozeno: string): string[] {
  return [v.id, String(premiki), izvozeno]
}

/** Niz vrstic CSV tabele (brez BOM): glava + vrstice v R270 akcijskem
 *  redu (EN VIR inventuraPregled). Fail-closed ISTI kontrakt (F3).
 *  `izvozeno` pride KOT parameter (kanonični ISO — klicatelj ga izpelje
 *  iz veljavnega `now`; jedro ostane čisto, F4). */
export function inventuraPregledCsvVrstice(
  artikli: readonly InventuraArtikel[],
  izvozeno: string,
): string[] {
  if (!Array.isArray(artikli)) {
    throw new TypeError('inventuraPregledCsvVrstice: pričakovano polje artiklov (InventuraArtikel[])')
  }
  if (typeof izvozeno !== 'string' || izvozeno === '') {
    throw new TypeError('inventuraPregledCsvVrstice: izvozeno mora biti ne-prazen niz (kanonični ISO — F4)')
  }
  // EN VIR R270 (F1/F3): validacija (ne-prazni nizi, končne ne-negativne
  // količine, premiki celo ≥ 0, dedup id ALI šifra), akcijski sort —
  // NIČ lastne tolerance.
  const { vrste } = inventuraPregled(artikli)
  // Premiki EN VIR (F2): join po id nad ISTIMI validiranimi artikli
  // (edinstvenost id že dokazana znotraj inventuraPregled dedup).
  const premikiPoId = new Map<string, number>()
  artikli.forEach((a) => {
    premikiPoId.set(a.id, a.premiki)
  })
  const vrstice = vrste.map((v) => {
    const premiki = premikiPoId.get(v.id)
    if (premiki === undefined) {
      throw new TypeError(
        `inventuraPregledCsvVrstice: vrsta ${v.id} brez premikov v viru (pokvaren vir — NIČ tihega izpuščanja)`,
      )
    }
    const tabela = [
      v.sifra,
      v.naziv,
      v.tip,
      kolicinaNiz(v.zaloga),
      v.enota,
      kolicinaNiz(v.minimum),
      // F3: manjka = 0 → '0' strojno (PDF '—' je tiskarska konvencija).
      kolicinaNiz(v.manjka),
      v.status,
    ]
    return [...tabela, ...dodatneCelice(v, premiki, izvozeno)].map(citiraj).join(',')
  })
  return [GLAVA, ...vrstice]
}

/** Celoten CSV niz: BOM + vrstice ('\n' zaključki — vzorec meritveCsv
 *  R186 / zapisniListCsv R285). Vrstic = glava + vrstice podatkov. */
export function inventuraPregledCsv(
  artikli: readonly InventuraArtikel[],
  now: Date,
): { csv: string; vrstic: number } {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('inventuraPregledCsv: pričakovan veljaven now: Date')
  }
  const lines = inventuraPregledCsvVrstice(artikli, now.toISOString())
  return { csv: '\uFEFF' + lines.join('\n'), vrstic: lines.length }
}

/** Deterministično ime datoteke: Inventura-pregled-YYYY-MM-DD.csv (pariteta
 *  z PDF imenom Inventura-pregled-YYYY-MM-DD.pdf — ISTI stem, drug medij;
 *  referenčni datum pride KOT parameter — jedro ne bere ure, F4). */
export function inventuraPregledCsvFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('inventuraPregledCsvFilename: pričakovan veljaven now: Date')
  }
  return `Inventura-pregled-${todayStamp(now)}.csv`
}
