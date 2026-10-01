// ---------------------------------------------------------------------------
// R328 — 55. člen issue #1 (§5 Inventory / suppliers / orders — 'supplier
// comparison'): PRIMERJAVA DOBAVITELJEV — deterministična projekcija IZ ISTEGA
// pregleda zgodovine cen (CenaZgodovinaPregled, R326).
//
// Motiv: issue #1 §5 izrecno zahteva 'supplier comparison' — do danes je bila
// resnica zgodovine cen videna SAMO po paru material × dobavitelj (R326
// zaslon + CSV, R327 PDF brat). Poslovno vprašanje 'kateri dobavitelj mi
// narašča, kateri pada, kje so cene stabilne' zahteva DRUGO grupiranje ISTIH
// podatkov. Ta lib je čisti bralec posredovane resnice — NIČ ne meri znova,
// NIČ ne spreminja, NIČ ne ugiba, NIČ ne povprečja (iskren agregat: ŠTEVCI
// smeri, ne izmišljen povprečni trend).
//
// EN VIR resnice (kanon družine):
//  • vhod = CenaZgodovinaPregled (POSREDOVANA resnica liba cena-zgodovina —
//    route /api/material-prices/zgodovina je edini bralec baze; ta lib ima
//    NIČ Prisme in NIČ drugega branja — ISTI odziv hrani OBA panela, nič
//    drugega fetcha, nič dvojne resnice);
//  • podatkovne vrstice = cenaDobaviteljiVrstice (ENA preslikava — CSV
//    potrošnik; morebiti PDF brat kasneje citira ISTO preslikavo, vzorec
//    cenaParVrstice R327);
//  • sklep = cenaDobaviteljiSklep (ENA preslikava — zaslon IN CSV meta);
//  • glave CSV = CENA_DOBAVITELJI_CSV_GLAVE (panel CITUJE — nič podvojenih
//    glav, vzorec CENA_ZGODOVINA_CSV_GLAVE R326);
//  • vir = CENA_DOBAVITELJI_VIR_NIZ ('PRIMERJAVA_DOBAVITELJEV — isti HEAD =
//    bajtno identičen izvoz' — vzorec CENA_ZGO_VIR_NIZ R326).
//
// Determinizem (kanon 46.–55. člen): brez časa v vsebini (izvozni časovni
// žig NE obstaja — primerjava NIMA referenčnega dneva, filename brez datuma;
// isti HEAD = bajtno identičen CSV). Razvrščanje dobaviteljev po nazivu, nato
// supplierId (UTF-16 kodne enote, brez locale — 100 % ponovljivo). NIČ
// semena bajtnega žiga v tem libu (CSV je vhodno-določen; bajtno-seme kanon
// ŽIVI v PDF bratih,
// soli 0xc1–0xd4 — ta lib jih ne sme dotakniti).
//
// Fail-closed (preveriCenaDobaviteljePregled ×6 skupin): ne-objekt pregled,
// pari ne seznam, par ni objekt, prazni supplierId/dobavitelj, ne-finitna ali
// negativna trenutna cena (R136 §18 pogodba), neznana smer (trojica kanona
// CenaSmer — nič tretjih smeri). Sporočila VERBATIM z 'kje' = ime graditelja
// (vzorec R322/R324/R326).
//
// Obrnjena regresija: lib NE uvaža Prisme (čista projekcija), NE nosi PDF
// knjižnične teže in NE uvaža runtime dela cena-zgodovina (SAMO tipi — nič cikla, nič
// podvojenih pravil; gradnja parov ostane v ENEM libu R326).
// ---------------------------------------------------------------------------

import { toCsv } from '@/lib/csv-export'
import type { CsvValue } from '@/lib/csv-export'
import type { CenaZgodovinaPregled } from '@/lib/cena-zgodovina'

/** ENA vrstica primerjave — EN dobavitelj, števci iz NJEGOVIH parov. */
export interface CenaDobaviteljVrstica {
  readonly supplierId: string
  readonly dobavitelj: string
  /** Št. parov material × ta dobavitelj (vsak par ima NATANKO eno odprto ceno). */
  readonly materialov: number
  /** Skupno št. cenovnih vrstic pri tem dobavitelju (odprte + zaprte). */
  readonly vpisov: number
  /** Iskren agregat: ŠTEVCI parov po smeri (NI izmišljenega povprečnega trenda). */
  readonly narasca: number
  readonly pada: number
  readonly stabilna: number
  /** Parov brez zgodovine (prvi vpis — iskrena ničelna veja). */
  readonly prvihVpisov: number
  /** Najnižja trenutna cena med parovi (min — pari > 0 garantirano). */
  readonly najnizja: number
  /** Najvišja trenutna cena med parovi (max). */
  readonly najvisja: number
}

/** Pregled primerjave dobaviteljev — POSREDOVANA resnica za zaslon IN CSV. */
export interface CenaDobaviteljiPregled {
  readonly dobavitelji: readonly CenaDobaviteljVrstica[]
  /** Skupno št. parov (vsota materialov — kontrolna vsaka plast brani sama). */
  readonly parov: number
}

/** Glave CSV izvoza primerjave (EN dobavitelj = EN odločitveni sklop). */
export const CENA_DOBAVITELJI_CSV_GLAVE = [
  'Dobavitelj',
  'Materialov',
  'Cenovnih vpisov',
  'Narašča',
  'Pada',
  'Stabilna',
  'Prvi vpis',
  'Najnižja trenutna cena EUR',
  'Najvišja trenutna cena EUR',
] as const

/** Vir sklepna vrstica CSV (vzorec CENA_ZGO_VIR_NIZ R326). */
export const CENA_DOBAVITELJI_VIR_NIZ =
  'PRIMERJAVA_DOBAVITELJEV — isti HEAD = bajtno identičen izvoz'

/** Deterministično ime CSV datoteke (brez datuma — primerjava NIMA referenčnega dneva). */
export function cenaDobaviteljiCsvFilename(): string {
  return 'primerjava-dobaviteljev.csv'
}

/** Znana trojica smeri (kanon CENA_SMER_NIZ — nič tretjih smeri). */
const ZNANE_SMERI: ReadonlySet<string> = new Set(['narasca', 'pada', 'stabilna'])

/** Fail-closed validacija posredovanega pregleda (×6 skupin — glava liba). */
export function preveriCenaDobaviteljePregled(
  pregled: unknown,
  kje: string,
): CenaZgodovinaPregled {
  if (!pregled || typeof pregled !== 'object' || Array.isArray(pregled)) {
    throw new Error(`CenaDobavitelji: pregled mora biti objekt (${kje}).`)
  }
  const pari = (pregled as { pari?: unknown }).pari
  if (!Array.isArray(pari)) {
    throw new Error(`CenaDobavitelji: pregled mora nositi seznam pari (${kje}).`)
  }
  for (const p of pari) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) {
      throw new Error(`CenaDobavitelji: par ni objekt (${kje}).`)
    }
    const r = p as Record<string, unknown>
    for (const ime of ['supplierId', 'dobavitelj'] as const) {
      if (typeof r[ime] !== 'string' || (r[ime] as string).length === 0) {
        throw new Error(`CenaDobavitelji: polje ${ime} mora biti neprazen niz (${kje}).`)
      }
    }
    const trenutna = r.trenutna
    if (!trenutna || typeof trenutna !== 'object' || Array.isArray(trenutna)) {
      throw new Error(`CenaDobavitelji: par mora nositi trenutno ceno (${kje}).`)
    }
    const cena = (trenutna as { cena?: unknown }).cena
    if (typeof cena !== 'number' || !Number.isFinite(cena) || cena < 0) {
      throw new Error(`CenaDobavitelji: trenutna cena mora biti končno neznegativno število (${kje}).`)
    }
    if (r.smer !== null && (typeof r.smer !== 'string' || !ZNANE_SMERI.has(r.smer))) {
      throw new Error(`CenaDobavitelji: smer mora biti nič ali znana trojica (${kje}).`)
    }
    const zaprtih = r.zaprtih
    if (typeof zaprtih !== 'number' || !Number.isInteger(zaprtih) || zaprtih < 0) {
      throw new Error(`CenaDobavitelji: zaprtih mora biti neznegativno celo število (${kje}).`)
    }
  }
  return pregled as CenaZgodovinaPregled
}

/**
 * Zgrodi pregled primerjave dobaviteljev iz POSREDOVANEGA pregleda zgodovine
 * (ČISTA projekcija ISTIH parov — drugo grupiranje, nič drugega branja).
 * Grupiranje po supplierId; razvrščanje po dobavitelj nazivu, nato supplierId
 * (UTF-16 kodne enote, brez locale — 100 % ponovljivo). Števci smeri so
 * iskren agregat — brez izmišljenega povprečnega trenda (nič ugibanja).
 */
export function buildCenaDobavitelje(
  pregled: unknown,
  kje: string,
): CenaDobaviteljiPregled {
  const resnica = preveriCenaDobaviteljePregled(pregled, kje)
  const poDobavitelju = new Map<string, {
    supplierId: string
    dobavitelj: string
    materialov: number
    vpisov: number
    narasca: number
    pada: number
    stabilna: number
    prvihVpisov: number
    najnizja: number
    najvisja: number
  }>()
  for (const p of resnica.pari) {
    const obstoj = poDobavitelju.get(p.supplierId)
    const cena = p.trenutna.cena
    if (obstoj) {
      obstoj.materialov += 1
      obstoj.vpisov += p.zaprtih + 1
      if (p.smer === 'narasca') obstoj.narasca += 1
      else if (p.smer === 'pada') obstoj.pada += 1
      else if (p.smer === 'stabilna') obstoj.stabilna += 1
      else obstoj.prvihVpisov += 1
      if (cena < obstoj.najnizja) obstoj.najnizja = cena
      if (cena > obstoj.najvisja) obstoj.najvisja = cena
    } else {
      poDobavitelju.set(p.supplierId, {
        supplierId: p.supplierId,
        dobavitelj: p.dobavitelj,
        materialov: 1,
        vpisov: p.zaprtih + 1,
        narasca: p.smer === 'narasca' ? 1 : 0,
        pada: p.smer === 'pada' ? 1 : 0,
        stabilna: p.smer === 'stabilna' ? 1 : 0,
        prvihVpisov: p.smer === null ? 1 : 0,
        najnizja: cena,
        najvisja: cena,
      })
    }
  }
  const dobavitelji = [...poDobavitelju.values()].sort((a, b) =>
    a.dobavitelj === b.dobavitelj
      ? (a.supplierId < b.supplierId ? -1 : a.supplierId > b.supplierId ? 1 : 0)
      : (a.dobavitelj < b.dobavitelj ? -1 : 1),
  )
  const parov = dobavitelji.reduce((vsota, d) => vsota + d.materialov, 0)
  if (parov !== resnica.pari.length) {
    throw new Error(
      `CenaDobavitelji: kontrolna vsota parov ${parov} != pregled ${resnica.pari.length} (${kje}).`,
    )
  }
  return { dobavitelji, parov }
}

/**
 * EN VIR sklep primerjave (ENA preslikava — zaslon panela IN CSV meta: NIČ
 * dvojnega, kanon cenaZgoSklep R326). Iskren tudi v ničelni veji.
 */
export function cenaDobaviteljiSklep(pregled: CenaDobaviteljiPregled): string {
  const delov: string[] = [
    `${pregled.dobavitelji.length} dobaviteljev`,
    `${pregled.parov} parov material × dobavitelj`,
  ]
  const narasca = pregled.dobavitelji.reduce((v, d) => v + d.narasca, 0)
  const pada = pregled.dobavitelji.reduce((v, d) => v + d.pada, 0)
  const stabilna = pregled.dobavitelji.reduce((v, d) => v + d.stabilna, 0)
  const prvih = pregled.dobavitelji.reduce((v, d) => v + d.prvihVpisov, 0)
  if (narasca > 0) delov.push(`${narasca} narašča`)
  if (pada > 0) delov.push(`${pada} pada`)
  if (stabilna > 0) delov.push(`${stabilna} stabilna`)
  if (prvih > 0) delov.push(`${prvih} prvi vpis`)
  return delov.join(', ')
}

/**
 * EN VIR podatkovne vrstice primerjave (ENA preslikava — CSV potrošnik; morebiti
 * PDF brat kasneje citira ISTO preslikavo, vzorec cenaParVrstice R327).
 * Iskrene veje: števci so števci (0 ostane 0 — nič skrivanja ničel); cena
 * min/max = trenutni razpon. Čista preslikava — vsak klic vrača NOVE nize.
 */
export function cenaDobaviteljiVrstice(
  pregled: CenaDobaviteljiPregled,
  kje: string,
): string[][] {
  if (!pregled || typeof pregled !== 'object' || !Array.isArray(pregled.dobavitelji)) {
    throw new Error(`CenaDobavitelji: pregled mora nositi seznam dobavitelji (${kje}).`)
  }
  return pregled.dobavitelji.map((d) => [
    d.dobavitelj,
    String(d.materialov),
    String(d.vpisov),
    String(d.narasca),
    String(d.pada),
    String(d.stabilna),
    String(d.prvihVpisov),
    d.najnizja.toFixed(2),
    d.najvisja.toFixed(2),
  ])
}

/**
 * Zgrodi deterministični CSV primerjave dobaviteljev (vzorec
 * buildCenaZgodovinaCsv R326). Brez izvoznega časovnega žiga — čas bi uničil
 * determinizem (isti HEAD = isti CSV). Meta: prazna ločilna + 'Sklep' (EN VIR)
 * + 'Vir' (CENA_DOBAVITELJI_VIR_NIZ). Podatkovne vrstice =
 * cenaDobaviteljiVrstice (EN VIR).
 */
export function buildCenaDobaviteljeCsv(
  pregled: CenaDobaviteljiPregled,
  kje: string,
): { csv: string; vrstic: number } {
  const podatkovne: CsvValue[][] = cenaDobaviteljiVrstice(pregled, kje)
  const meta: CsvValue[][] = [
    [], // prazna ločilna vrstica pred povzetkom (preglednost v Excelu)
    ['Sklep', cenaDobaviteljiSklep(pregled)],
    ['Vir', CENA_DOBAVITELJI_VIR_NIZ],
  ]
  const csv = toCsv([...CENA_DOBAVITELJI_CSV_GLAVE], [...podatkovne, ...meta])
  return { csv, vrstic: pregled.dobavitelji.length }
}
