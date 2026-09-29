// ---------------------------------------------------------------------------
// R285 (i5b — issue #15 §3 po worklog R284/R285 opcijski viri) — TERENSKI
// ZAPISNI LIST CSV iz Meritve taba (measurements-tab.tsx). Vzorec meritve-csv
// R186 (vodja-csv družina: BOM za Excel, escape navedkov, deterministično
// ime; čisto jedro client-safe in 100 % testabilno — komponenta je samo
// žičenje).
//
// SEMANTIČNE ODLOČITVE Y1–Y8 (zapisane PRED razvojem — kanon R277–R284):
//
//  Y1 RAZMEJITEV (glavna odločitev runde): R284 'TERENSKI ZAPISNI LIST PDF'
//     = izpolnjevalni list za TEREN S PERESOM (papir). R285 'TERENSKI ZAPISNI
//     LIST CSV' = ISTI izpolnjevalni list za DIGITALNO IZPOLNJEVANJE V
//     EXCELU — ISTA zapisana resnica + ISTI PRAZNI fizični stolpci
//     (fizicna_ref_mm / delta_mm / zapiski_terena). NI konflikta z bajtnimi
//     kontrakti: NOVA izvozna družina (lasten CSV lib + lasten needle set);
//     meritve-csv.ts (R186 19-stolpčni ARHIV kontrakt) NI dotaknjen;
//     terenski-zapisni-pdf.ts (R284 PDF kontrakt, soli 0xb5–0xb8) NI
//     dotaknjen (samo IMPORT).
//
//  Y2 EN VIR (pariteta stolpcev z R186 arhivom PO KONSTRUKCIJI): vrste =
//     zapisniListVrste IMPORT (R284 → R269 meritevTerenPregled: ISTA R186
//     validacija fizikalnih mer, ISTI fallbacki OSNUTEK/RAZDALJA, ISTI
//     akcijski sort, ISTA dedup-id preverba). R186 stolpci = meritevVrstica
//     IMPORT (ISTI graditelj vrstic kot CSV arhiv — NI ponovne
//     implementacije, NI kopije glave: glava = meritveCsvVrstice([])[0]).
//     Pariteta = isti graditelj, ne podoben izpis: za isti vhod je prvi 19
//     celic zapisni list vrstice BAJTNATO identičen arhivski vrstici.
//
//  Y3 FAIL-CLOSED: ISTI kontrakt kot R284/R269: prazen seznam → TypeError
//     (iskren toast); podvojen id → TypeError; pokvarena polja → TypeError
//     z indeksom krivca (prek R186/R269 validacije — NI lastne tolerance).
//     Prazni fizični stolpci = PRAZNA celica '' (NE 'null', NE '0', NE '—' —
//     izpolnjevalna cona ostane PRAZNA v Excelu; pariteta z R186 odsotnimi
//     polji, ki so prav tako prazne celice).
//
//  Y4 DETERMINIZEM: čista funkcija nad izrecnimi vhodi — brez Date.now() v
//     jedru (referenčni datum pride KOT PARAMETER, tudi v imenu datoteke);
//     vrstni red vrstic = akcijski sort R269 (EN VIR — NI vrstnega reda
//     odgovora); BOM + '\n' zaključki (vzorec meritveCsv R186); vsa polja
//     citirana (narekovaj podvojen — vzorec vodja-csv).
//
//  Y5 KODE VERBATIM (arhiv pariteta): status/tip = ISTI fallbacki kot R186
//     (OSNUTEK/RAZDALJA — izvoženo = zaslon); verzija = surovo število kot
//     niz ('2') ALI '' (NI PDF 'v'-predpone — CSV je mašinetno berljiv arhiv,
//     PDF je človeški izpis); vir = KODA VERBATIM (MANUAL/PHOTO_CV/
//     ARCORE_DEPTH) ALI '' — brez prevajanja v labele (Excel filtri delujejo
//     na kode; ENA resnica kot status/tip).
//
//  Y6 PRAVILA: route NIČ, DB NIČ, shema NIČ, Measurement SDK / geometry /
//     BOM / pricing core NIČ, OgrajaVizija nič, 0 novih hex (CSV nima barv);
//     client+lib only; meritve-csv.ts NI dotaknjen (aditivna runda).
//
//  Y7 CSV = SAMO TABELA (glava + vrstice) — brez komentar vrstic, brez
//     sklepa, brez KPI: mašinetno berljiva pariteta z R186 arhivom (ki tudi
//     ne nosi komentarjev). Namen dokumentiran v kodi (ta glava), v UI title
//     (hover parity kanon R280–R284) in v toast description — NIKOLI v CSV
//     (komentar vrstica bi razbila Excel import in arhiv pariteto).
//
//  Y8 STOLPČNI KONTRAKT = 24 stolpcev: 19 R186 arhivskih (datum, oznaka,
//     tip, dolzina_mm, visina_mm, kot_stopinje, stevilo_stebrov, tip_podlage,
//     enota, originalna_vrednost, tip_stebra, material_stebra,
//     visina_stebra_mm, pozicija_mm, notranji_kot, zunanji_kot, status,
//     lokacija, opomba) + 5 zapisni list (verzija, vir, fizicna_ref_mm,
//     delta_mm, zapiski_terena). Pariteta z R186 = PREDPONA po konstrukciji
//     (test dokazuje startsWith arhivske glave IN arhivske vrstice).
// ---------------------------------------------------------------------------

import { meritevVrstica, meritveCsvVrstice } from './meritve-csv'
import {
  zapisniListVrste,
  type TerenskiZapisniVnos,
  type TerenskiZapisniVrsta,
} from './terenski-zapisni-pdf'
import { todayStamp } from './csv-export'

/** Zapisni list CSV vrsta = R284 vrsta (EN VIR — kot/fizični/delta/zapiski)
 *  + R186 vrstica join po id (Y2 pariteta po konstrukciji). */
export type TerenskiZapisniCsvVrsta = TerenskiZapisniVrsta

/** Citiranje besedilnih polj (narekovaj podvojen) — vzorec vodja-csv
 *  (družinski kanon: vsak CSV lib nosi lasten 3-vrstični citiraj). */
function citiraj(v: string): string {
  return `"${v.replace(/"/g, '""')}"`
}

/** 5 dodatnih zapisni list stolpcev (Y8) — po 19 R186 arhivskih. */
export const ZAPISNI_CSV_DODATNI = [
  'verzija',
  'vir',
  'fizicna_ref_mm',
  'delta_mm',
  'zapiski_terena',
] as const

/** Število stolpcev kontrakta: 19 R186 + 5 zapisni list = 24 (Y8). */
export const ZAPISNI_CSV_STOLPCEV = 19 + ZAPISNI_CSV_DODATNI.length

/** Glava EN VIR R186: meritveCsvVrstice([]) vrne SAMO glavno vrstico —
 *  arhivska 19-stolpčna glava citirana, BAJTNATO ISTA kot arhiv (Y2 — NI
 *  kopije, NI drifta). + 5 dodatnih zapisni list stolpcev (Y8). */
const R186_GLAVA = meritveCsvVrstice([])[0]
const GLAVA = `${R186_GLAVA},${[...ZAPISNI_CSV_DODATNI].map(citiraj).join(',')}`

/** Dodatne celice iz R284 vrste (Y3 prazni fizični stolpci; Y5 kode
 *  verbatim — verzija surovo število, vir koda; PRAZNO = ''). */
function dodatneCelice(v: TerenskiZapisniVrsta): string[] {
  return [
    v.verzija === null ? '' : String(v.verzija),
    v.vir ?? '',
    // FIZIČNA ref. / Δ / Zapiski — VEDNO prazna celica (Y1/Y3: izpolni
    // lastnik v Excelu; digitalni list NIKOLI ne izmišljuje fizičnih vrednosti).
    '',
    '',
    '',
  ]
}

/** Niz vrstic CSV tabele (brez BOM): glava + vrstice v R269 akcijskem redu
 *  (EN VIR zapisniListVrste). Fail-closed ISTI kontrakt kot R284 (Y3). */
export function zapisniListCsvVrstice(meritve: readonly TerenskiZapisniVnos[]): string[] {
  if (!Array.isArray(meritve)) {
    throw new TypeError('zapisniListCsvVrstice: pričakovano polje meritev (MeritveTerenVnos[])')
  }
  if (meritve.length === 0) {
    throw new TypeError(
      'zapisniListCsvVrstice: prazen seznam meritev ne nastaja CSV — zapisni list se izvozi, ko je vpisana prva meritev projekta (fail-closed)',
    )
  }
  // EN VIR R284: validacija (R186 fizikalne mere + neznani status/vir),
  // dedup id, akcijski sort — NIČ lastne tolerance (Y3).
  const { vrste } = zapisniListVrste(meritve)
  // R186 stolpci EN VIR (Y2): ISTI graditelj vrstic kot CSV arhiv — pariteta
  // po konstrukciji. Join po id (edinstvenost že dokazana znotraj
  // zapisniListVrste dedup-id preverbe).
  const r186PoId = new Map<string, string[]>()
  meritve.forEach((o, i) => {
    let r: string[]
    try {
      r = meritevVrstica(o)
    } catch (e) {
      throw new TypeError(`meritev ${i}: ${e instanceof Error ? e.message : String(e)}`)
    }
    r186PoId.set(o.id, r)
  })
  const vrstice = vrste.map((v) => {
    const r = r186PoId.get(v.id)
    if (!r) {
      throw new TypeError(
        `zapisniListCsvVrstice: vrsta ${v.id} brez R186 vrstice (pokvaren vir — NIČ tihega izpuščanja)`,
      )
    }
    return [...r, ...dodatneCelice(v)].map(citiraj).join(',')
  })
  return [GLAVA, ...vrstice]
}

/** Celoten CSV niz: BOM + vrstice (vzorec meritveCsv R186 — '\n' zaključki). */
export function zapisniListCsv(meritve: readonly TerenskiZapisniVnos[]): {
  csv: string
  vrstic: number
} {
  const lines = zapisniListCsvVrstice(meritve)
  return { csv: '\uFEFF' + lines.join('\n'), vrstic: lines.length }
}

/** Deterministično ime datoteke: Terenski-zapisni-YYYY-MM-DD.csv (pariteta
 *  z PDF imenom Terenski-zapisni-YYYY-MM-DD.pdf — isti.stem, drug medij;
 *  referenčni datum pride KOT parameter — jedro ne bere ure). */
export function zapisniListCsvFilename(now: Date): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('zapisniListCsvFilename: pričakovan veljaven now: Date')
  }
  return `Terenski-zapisni-${todayStamp(now)}.csv`
}
