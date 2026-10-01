// ---------------------------------------------------------------------------
// R337 — 64. člen issue #1 (IZVOZI družina): izvoz pregleda AI rabe kot
// DETERMINISTIČNI CSV (Deliverable 5 kot prenosljiv artifact — resnica iz
// R311 na zaslonu, zdaj tudi v pisarniškem orodju). ai-raba-dokaz je bil
// ZADNJI vodja dokazni blok brez izvoza (avtomatizacija-dokaz ima PDF R313,
// končna verifikacija TRIADO R316/R320/R334, sistem zdravje CSV R336).
// CSV brat zaslona (vzorec R334 koncna-verifikacija-csv / R336
// sistem-zdravje-csv: ČISTA projekcija EN VIR resnic — ta modul NOSI NIČ
// nove resnice).
//
// EN VIR resnice (NIČ podvojenih pravil):
//  • resnica = aiRabaPregled (UVOŽEN iz brata R311 — ISTA fail-closed
//    validacija kataloga brezplačno: 'ai' vnosi z razrešenim nadomestkom +
//    kandidati z iskreno 'zakaj'; NIČ podvojenih pravil);
//  • žičenje je ŠE BOLJŠE od brata R334: handler na vodji poda že IZRISANI
//    pregled (isti objekt, ki ga renderira blok) — CSV NIČEVE divergence
//    od zaslona po konstrukciji (test pina žičenje 'aiRabaCsv(aiRaba)');
//  • glavi = AI_RABA_CSV_GLAVE_ZIVE + AI_RABA_CSV_GLAVE_KANDIDATI — stolpci
//    nosijo verbatim projcijo (opis/modul/nadomestek* + funkcija/zakaj/
//    status — ISTI nizi kot zaslon; WYSIWYG, vzorec R311);
//  • vrstica 'Kandidati — …' = ISTA formula kot zaslon
//    (kandidatiStatus ?? 'različni statusi');
//  • meta števci = ISTI števci projcije (stAi / stNadomestkov /
//    stKandidatov); 'AI-obveznih' = IZPELJANA (stAi − stNadomestkov = 0 po
//    konstrukciji — aiRabaPregled fail-closed vsili nadomestek vsakemu 'ai'
//    vnosu; NIČ trdo kodirane ničle v CSV);
//  • sklep = pregled.sklep (UVOŽEN — ISTI niz kot zaslon + testi + docs;
//    NOVI potrošnik ENEGA niza).
//
// Format = kanon R136 toCsv (BOM + podpičje + CRLF + RFC 4180 citiranje —
// opisi/zakaj z vejicami/podpičji so varno citirani; vzorec R334/R336 —
// ISTA vodja družina). TRI bloka v ENEM dokumentu (vzorec R334 — tabela
// PRVA, meta NA KONCU — preglednost v Excelu): blok A (AI v živo z
// nadomestki) + prazna ločilna vrstica + meta glava (naslov + števci) +
// blok B (kandidati) + meta povzetek (sklep + vir).
//
// Determinizem (kanon 46./47./49. člen + brez-časa kanon R334/R336): BREZ
// metapodatkov časa/hash (NIČ 'Izvoženo ob' — katalog je statična resnica
// repozitorija, čas bi uničil determinizem; isti katalog = bajtno identična
// datoteka). Veza na HEAD je implicitna — drevo je byte-določeno s HEAD.
//
// Fail-closed: vhodna projcija se validira po imenu polja (kanon
// R299/R302/R306 — niz preživi minifikacijo, identifikatorji ne): ne-objekt
// / ne-polje zive|kandidati / pokvarjen sklep / nefinitni števci / vrstica
// brez opisa|modula|nadomestka|funkcije|zakaja|statusa → TypeError z imenom
// graditelja. Zip po indeksu z IZRECNO usklajenostno asercijo (vzorec
// R334/R320/R317): projcija in vrstice si delata ISTI vrstni red.
// Obrnjena regresija: CSV funkcij NI v bratu ai-raba-pregled libu (cikel in
// duplikat tiran — ena definicija, EN lib; LEKCIJA R318 1).
// ---------------------------------------------------------------------------

import { aiRabaPregled } from './ai-raba-pregled'
import type { AiRabaPregled, AiZivaPovrsina } from './ai-raba-pregled'
import type { AiKandidat } from './avtomatizacija-audit'
import { toCsv, type CsvValue } from './csv-export'

/** Glava bloka A — AI v živo z nadomestki (stolpci = verbatim projcija
 *  R311; 'Nadomestek (brez AI)' = ISTO besedilo kot zaslon vrstica). */
export const AI_RABA_CSV_GLAVE_ZIVE = [
  'Zmožnost (opis)',
  'Modul',
  'Nadomestek (brez AI)',
  'Nadomestek (modul)',
] as const

/** Glava bloka B — kandidati (VERBATIM polja AiKandidat — ISTI nizi kot
 *  zaslon seznam + docs/automacija-audit.md). */
export const AI_RABA_CSV_GLAVE_KANDIDATI = ['Funkcija', 'Zakaj', 'Status'] as const

/** Iskren vir niz meta vrstice — vzorec KONCNA_VIR_NIZ R334 (ISTI kanon:
 *  brez časa/hash — determinizem kanon 46. člen). */
export const AI_RABA_VIR_NIZ = 'AI raba pregled — isti katalog = bajtno identičen izvoz'

/** ENA vrstica bloka A (VERBATIM — ISTI nizi kot projcija R311, ki jo
 *  renderira zaslon: opis + '→ nadomestek (brez AI): …'). */
export function aiRabaCsvZivaVrstica(z: AiZivaPovrsina): CsvValue[] {
  if (!z || typeof z !== 'object') {
    throw new TypeError('aiRabaCsvZivaVrstica: pričakovana vrstica (AiZivaPovrsina)')
  }
  for (const polje of ['opis', 'modul', 'nadomestekOpis', 'nadomestekModul'] as const) {
    const v = z[polje]
    if (typeof v !== 'string' || v.trim().length === 0) {
      throw new TypeError(`aiRabaCsvZivaVrstica: polje '${polje}' mora biti ne-prazen niz`)
    }
  }
  return [z.opis, z.modul, z.nadomestekOpis, z.nadomestekModul]
}

/** ENA vrstica bloka B (VERBATIM — ISTI nizi kot zaslon seznam kandidatov
 *  + docs/automacija-audit.md; status = iskren 'NE-IMPLEMENTIRANO …'). */
export function aiRabaCsvKandidatVrstica(k: AiKandidat): CsvValue[] {
  if (!k || typeof k !== 'object') {
    throw new TypeError('aiRabaCsvKandidatVrstica: pričakovan kandidat (AiKandidat)')
  }
  for (const polje of ['funkcija', 'zakaj', 'status'] as const) {
    const v = k[polje]
    if (typeof v !== 'string' || v.trim().length === 0) {
      throw new TypeError(`aiRabaCsvKandidatVrstica: polje '${polje}' mora biti ne-prazen niz`)
    }
  }
  return [k.funkcija, k.zakaj, k.status]
}

/**
 * Zgrodi deterministični CSV pregleda AI rabe. Privzeti vhod = EN VIR
 * graditelj aiRabaPregled() (parametriziran SAMO za teste fail-closed poti
 * — produkcija poda že IZRISANI pregled iz vodje; null NE undefined —
 * lekcija R317 4). Vrstni red vrstic = ISTI vrstni red kot projcija (nič
 * prerazporejanja — kanon).
 */
export function aiRabaCsv(pregled: AiRabaPregled = aiRabaPregled()): string {
  if (!pregled || typeof pregled !== 'object') {
    throw new TypeError('aiRabaCsv: pričakovan pregled (AiRabaPregled)')
  }
  if (!Array.isArray(pregled.zive)) {
    throw new TypeError('aiRabaCsv: pričakovane žive AI površine (seznam)')
  }
  if (!Array.isArray(pregled.kandidati)) {
    throw new TypeError('aiRabaCsv: pričakovani kandidati (seznam)')
  }
  if (typeof pregled.sklep !== 'string' || pregled.sklep.trim().length === 0) {
    throw new TypeError("aiRabaCsv: polje 'sklep' mora biti ne-prazen niz")
  }
  for (const polje of ['stAi', 'stNadomestkov', 'stKandidatov'] as const) {
    const v = pregled[polje]
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw new TypeError(`aiRabaCsv: polje '${polje}' mora biti nefinitno ne-negativno število`)
    }
  }
  // Zip po indeksu z IZRECNO usklajenostno asercijo (vzorec R334/R320/R317):
  // projcija je fail-closed vsilila nadomestek vsakemu 'ai' vnosu —
  // stNadomestkov MORA ujemati z dolžino živih (sicer je vhod pokvaren).
  if (pregled.zive.length !== pregled.stNadomestkov) {
    throw new TypeError(
      'aiRabaCsv: notranja neskladja dolžin (zive vs stNadomestkov) — fail-closed',
    )
  }
  // --- blok A: AI v živo z nadomestki (ISTA ravnina kot zaslon žive
  //     vrstice + moduli za arhiv/auditable vezavo — ISTA projcija);
  //     glava bloka A = toCsv headers (prva vrstica dokumenta — vzorec
  //     R334/R336: tabela PRVA, meta NA KONCU — preglednost v Excelu) ---
  const ziveVrstice: CsvValue[][] = pregled.zive.map((z) => aiRabaCsvZivaVrstica(z))
  // --- meta glava: ISTI števci kot zaslon vrstica ({stAi} AI ·
  //     {stKandidatov} kandidatov · 0 AI-obveznih); 'AI-obveznih' je
  //     IZPELJAN (stAi − stNadomestkov = 0 po konstrukciji — NIČ trdo
  //     kodirane ničle); naslov dokumenta = VERBATIM naslov bloka na
  //     zaslonu ---
  const glava: CsvValue[][] = [
    ['AI raba — iskrena resnica'], // VERBATIM naslov bloka na zaslonu
    ['AI površin v živo (z nadomestkom)', String(pregled.stAi)],
    ['Nadomestkov (determinističnih)', String(pregled.stNadomestkov)],
    ['Kandidatov (ne-implementiranih)', String(pregled.stKandidatov)],
    ['AI-obveznih', String(pregled.stAi - pregled.stNadomestkov)],
  ]
  // --- blok B: kandidati (VERBATIM — ISTI nizi kot zaslon seznam + docs;
  //     vrstica statusa = ISTA formula kot zaslon
  //     'Kandidati — {kandidatiStatus ?? "različni statusi"}') ---
  const statusVrstica = `Kandidati — ${pregled.kandidatiStatus ?? 'različni statusi'}`
  const kandidatiVrstice: CsvValue[][] = pregled.kandidati.map((k) =>
    aiRabaCsvKandidatVrstica(k),
  )
  // --- meta povzetek: EN VIR sklep (ISTI niz kot zaslon + testi + docs) +
  //     vir niz. Brez 'Izvoženo ob' — katalog je statična resnica
  //     repozitorija; isti katalog = bajtno identična datoteka (brez-časa
  //     kanon R334/R336). ---
  const meta: CsvValue[][] = [
    [], // prazna ločilna vrstica pred kandidati (preglednost v Excelu)
    [statusVrstica],
    [...AI_RABA_CSV_GLAVE_KANDIDATI],
    ...kandidatiVrstice,
    [], // prazna ločilna vrstica pred povzetkom (preglednost v Excelu)
    ['Sklep', pregled.sklep],
    ['Vir', AI_RABA_VIR_NIZ],
  ]
  return toCsv(
    [...AI_RABA_CSV_GLAVE_ZIVE],
    [...ziveVrstice, [], ...glava, ...meta],
  )
}

/** Deterministično ime datoteke (brez datuma — veza na HEAD je implicitna;
 *  bratska simetrija z koncna-verifikacija.csv R334 + sistem-zdravje.csv
 *  R336 — vzorec koncnaVerifikacijaCsvFilename, 46./61. člen). */
export function aiRabaCsvFilename(): string {
  return 'ai-raba.csv'
}
