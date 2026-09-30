// ---------------------------------------------------------------------------
// R326 — 53. člen issue #1 (§5 Inventory / dobavitelji / naročila):
// ZGODOVINA CEN MATERIALA (price history) — deterministična projekcija
// MaterialPrice vrstic (vključno z ZAPRTO zgodovino veljavnostDo != null).
//
// Motiv: POST /api/material-prices že od R136 (§19) zapira prejšnjo ceno v
// ENI transakciji (EXCLUDE omejitev material_price_no_overlap) — časovna
// resnica JE v bazi in SE NB žganja, a GET je vrnil SAMO trenutno veljavne
// vrstice (veljavnostDo: null). Zgodovina je bila piškot, ki ga ni mogel
// nihče prebrati. Ta lib je čisti bralec te resnice — NIČ ne meri znova,
// NIČ ne spreminja, NIČ ne ugiba (issue #1 §5: 'price history').
//
// R327 — PDF BRAT (54. člen IZVOZI družina): cena-zgodovina-pdf.ts je ločen
// lib (jsPDF teža NE obremenjuje tega podatkovnega brata — vzorec
// vodja-csv/vodja-dnevni-pdf R324); vrstični graditelj cenaParVrstice je
// EN VIR za OBA potrošnika (CSV tabela in PDF tabela ne moreta divergirati
// po konstrukciji); FNV soli 0xd1–0xd4 živijo v PDF bratu (kanon 46.–52. člen).
//
// EN VIR resnice (kanon družine):
//  • vhod = seznam CenaZgodovinaVnos (POSREDOVANA resnica — route ovoji
//    vrstice Prisme; lib je ČISTA projekcija, drugega branja NI);
//  • sklep = CENA_ZGO_SKLEP (ENA preslikava pregleda — zaslon panela IN
//    CSV meta vrstica: ČETRTI potrošnik vzorca AUDIT_VIR_NIZ R318);
//  • glave CSV = CENA_ZGODOVINA_CSV_GLAVE, glave časovne tabe na zaslonu =
//    CENA_ZGODOVINA_TIMELINE_GLAVE (obe izvozni — panel ju CITUJE, nič
//    podvojenih glav, vzorec AUDIT_CSV_GLAVE R317 / ZMOGLJIVOST_IZVOZ_GLAVE
//    R322 / VODJA_*_GLAVE R324);
//  • vir = CENA_ZGO_VIR_NIZ ('ZGODOVINA_CEN — isti HEAD = bajtno identičen
//    izvoz' — vzorec AUDIT_VIR_NIZ R318 / ZMOGLJIVOST_VIR_NIZ R323 /
//    VODJA_VIR_NIZ R324).
//
// Determinizem (kanon 46.–52. člen): brez časa v vsebini (validacija
// deluje na posredovane ISO nize — izvozni časovni žig NE obstaja; isti HEAD =
// bajtno identičen CSV/JSON). Razvrščanje po Date.parse številu (ISO
// nizi različnih dolžin bi pri dict. primerjavi lagali — lekcija
// '39Z' > '39.401Z'), vezava brez locale (artikel/dobavitelj po UTF-16
// kodnih enotah — 100 % ponovljivo). NIČ FNV semena v tem libu (CSV + JSON
// sta vhodno-določena; FNV kanon ŽIVI v PDF bratu cena-zgodovina-pdf R327,
// soli 0xd1–0xd4 — vzorec vodja-csv/vodja-dnevni-pdf R324).
//
// Fail-closed (preveriCenaZgodovinaVnose ×7 skupin): ne-seznam, ne-objekt,
// prazni nizi (inventoryId/supplierId/artikel/dobavitelj), ne-finitna ali
// negativna cena (R136 §18 pogodba — cena >= 0), ne-veljaven veljavnostOd,
// veljavnostDo (nič ali veljaven niz), IN obratjen interval
// (veljavnostDo < veljavnostOd — DB EXCLUDE že to preprečuje; lib brani
// drugo plast, kanon 'vsaka plast brani sama'). Sporočila VERBATIM z
// 'kje' = ime graditelja (vzorec R322/R324).
//
// Obrnjena regresija: lib NE uvaža Prisme (čista projekcija — route je
// edini bralec baze) IN NE nosi jsPDF teže (CSV = toCsv kanon R136).
// ---------------------------------------------------------------------------

import { toCsv } from '@/lib/csv-export'
import type { CsvValue } from '@/lib/csv-export'

/** ENA cenovna vrstica kot jo posreduje route (Prisma vrstica → ravnina). */
export interface CenaZgodovinaVnos {
  readonly inventoryId: string
  readonly artikel: string
  readonly supplierId: string
  readonly dobavitelj: string
  /** EUR na enoto — R136 §18: neznegativno, končno. */
  readonly cena: number
  /** ISO niz (UTC) — začetek veljavnosti. */
  readonly veljavnostOd: string
  /** ISO niz ali nič — nič = trenutno odprta cena (nič zaprtega). */
  readonly veljavnostDo: string | null
  readonly opomba: string | null
}

/** ENA vrstica časovne tabe (zaslon) — izrez vnosa brez ključev para. */
export interface CenaTimelineVrstica {
  readonly cena: number
  readonly veljavnostOd: string
  readonly veljavnostDo: string | null
  readonly opomba: string | null
}

/** Smer spremembe trenutna vs. prejšnja (deterministična trojica). */
export type CenaSmer = 'narasca' | 'pada' | 'stabilna'

/** EN par material × dobavitelj — časovna vrsta cen. */
export interface CenaParZgodovina {
  readonly inventoryId: string
  readonly artikel: string
  readonly supplierId: string
  readonly dobavitelj: string
  /** Trenutno odprta cena (veljavnostDo nič) — vsak par ima NATANKO eno
   *  (EXCLUDE material_price_no_overlap to zagotavlja v bazi; fail-closed
   *  konstrukt tukaj). */
  readonly trenutna: CenaTimelineVrstica
  /** Prva zaprta cena po času (najnovejša zgodovina) — nič, če je par
   *  izkazan prvič (iskrena ničelna veja: brez preteklosti NI smeri). */
  readonly prejsnja: CenaTimelineVrstica | null
  /** Št. zaprtih cenovnih vrstic v zgodovini (brez trenutne). */
  readonly zaprtih: number
  /** trenutna.cena - prejsnja.cena — nič brez prejšnje. */
  readonly deltaEur: number | null
  /** Odstotek spremembe glede na prejšnjo, zaokrožen na 2 decimalki;
   *  nič tudi, če je prejšnja cena 0 EUR (deljenje z 0 ni resnica). */
  readonly deltaOdstotek: number | null
  readonly smer: CenaSmer | null
  /** Celotna časovna vrsta (trenutna PRVA, nato zaprte po času padajoče). */
  readonly casovnica: readonly CenaTimelineVrstica[]
}

/** Pregled zgodovine cen — POSREDOVANA resnica za zaslon IN CSV. */
export interface CenaZgodovinaPregled {
  readonly pari: readonly CenaParZgodovina[]
  /** Skupno št. cenovnih vrstic (odprtih + zaprtih). */
  readonly vnosov: number
  /** Št. parov, kjer je zadnja sprememba NARAŠČALA (iskren alarm). */
  readonly narascajo: number
  readonly padajo: number
  readonly stabilnih: number
  /** Parov brez zgodovine (prvi vpis — iskrena ničelna veja na zaslonu). */
  readonly prvihVpisov: number
}

/** Glave CSV izvoza (par — ENA vrstica = EN odločitveni sklop). */
export const CENA_ZGODOVINA_CSV_GLAVE = [
  'Artikel',
  'Dobavitelj',
  'Prejšnja cena EUR',
  'Trenutna cena EUR',
  'Sprememba EUR',
  'Sprememba %',
  'Smer',
  'Zgodovinskih cen',
] as const

/** Glave časovne tabe na zaslonu (panel CITUJE — nič dvojnega). */
export const CENA_ZGODOVINA_TIMELINE_GLAVE = [
  'Cena EUR',
  'Od',
  'Do',
  'Opomba',
] as const

/** Vir sklepna vrstica CSV (vzorec AUDIT_VIR_NIZ R318). */
export const CENA_ZGO_VIR_NIZ =
  'ZGODOVINA_CEN — isti HEAD = bajtno identičen izvoz'

/** EN VIR prikaz smeri (CSV celica IN panel pripoved — nič dvojnega besedila;
 *  kljuci = ASCII identifikatorji kanona, vrednosti = prikazno besedilo). */
export const CENA_SMER_NIZ: Readonly<Record<CenaSmer, string>> = Object.freeze({
  narasca: 'narašča',
  pada: 'pada',
  stabilna: 'stabilna',
} as const)

/** Deterministično ime CSV datoteke (brez datuma — vzorec 47.–52. člen). */
export function cenaZgodovinaCsvFilename(): string {
  return 'zgodovina-cen.csv'
}

/** Fail-closed validacija posredovanih vrstic (×7 skupin — glava liba). */
export function preveriCenaZgodovinaVnose(
  vnosi: unknown,
  kje: string,
): readonly CenaZgodovinaVnos[] {
  if (!Array.isArray(vnosi)) {
    throw new Error(`CenaZgodovina: vhod mora biti seznam vrstic (${kje}).`)
  }
  return vnosi.map((v): CenaZgodovinaVnos => {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) {
      throw new Error(`CenaZgodovina: vrstica ni objekt (${kje}).`)
    }
    const r = v as Record<string, unknown>
    const niz = (ime: string): string => {
      const x = r[ime]
      if (typeof x !== 'string' || x.length === 0) {
        throw new Error(`CenaZgodovina: polje ${ime} mora biti neprazen niz (${kje}).`)
      }
      return x
    }
    const inventoryId = niz('inventoryId')
    const artikel = niz('artikel')
    const supplierId = niz('supplierId')
    const dobavitelj = niz('dobavitelj')
    const cena = r.cena
    if (typeof cena !== 'number' || !Number.isFinite(cena) || cena < 0) {
      throw new Error(`CenaZgodovina: cena mora biti končno neznegativno število (${kje}).`)
    }
    const veljavnostOd = niz('veljavnostOd')
    if (Number.isNaN(Date.parse(veljavnostOd))) {
      throw new Error(`CenaZgodovina: veljavnostOd ni veljaven ISO datum (${kje}).`)
    }
    const rawDo = r.veljavnostDo
    if (rawDo !== null && (typeof rawDo !== 'string' || rawDo.length === 0 || Number.isNaN(Date.parse(rawDo)))) {
      throw new Error(`CenaZgodovina: veljavnostDo mora biti nič ali veljaven ISO datum (${kje}).`)
    }
    if (rawDo !== null && Date.parse(rawDo) < Date.parse(veljavnostOd)) {
      throw new Error(`CenaZgodovina: veljavnostDo pred veljavnostOd — obratjen interval (${kje}).`)
    }
    const opomba = r.opomba
    if (opomba !== null && typeof opomba !== 'string') {
      throw new Error(`CenaZgodovina: opomba mora biti nič ali niz (${kje}).`)
    }
    return { inventoryId, artikel, supplierId, dobavitelj, cena, veljavnostOd, veljavnostDo: rawDo, opomba }
  })
}

/** Zaokroži na 2 decimalki (deterministično — izraz, ne knjižnica). */
function zaokrozi2(x: number): number {
  return Math.round(x * 100) / 100
}

/** Smer iz delte (kontrakt: 0 = stabilna, pozitivno = narašča, negativno = pada). */
function smerIzDelte(deltaEur: number): CenaSmer {
  if (deltaEur > 0) return 'narasca'
  if (deltaEur < 0) return 'pada'
  return 'stabilna'
}

/**
 * Zgrodi pregled zgodovine cen iz POSREDOVANIH vrstic (ČISTA projekcija —
 * drugega branja NI, kanon R321 'meritev se izvede ENKRAT'). Par = material
 * × dobavitelj; razvrščanje parov po artikel, nato dobavitelj (UTF-16
 * kodne enote, brez locale — 100 % ponovljivo); časovnica padajoče po
 * veljavnostOd (Date.parse število — ISO nizi različnih dolžin pri niznem
 * primerjanju lagajo). vsak par ima NATANKO eno odprto ceno (EXCLUDE
 * material_price_no_overlap — kršitev = fail-closed, kanon 'vsaka plast
 * brani sama').
 */
export function buildCenaZgodovina(
  vnosi: unknown,
  kje: string,
): CenaZgodovinaPregled {
  const resnica = preveriCenaZgodovinaVnose(vnosi, kje)
  const poParu = new Map<string, CenaZgodovinaVnos[]>()
  for (const v of resnica) {
    const kljuc = `${v.inventoryId}\u0000${v.supplierId}`
    const obstoj = poParu.get(kljuc)
    if (obstoj) obstoj.push(v)
    else poParu.set(kljuc, [v])
  }
  const pari: CenaParZgodovina[] = []
  for (const [kljuc, vrstice] of poParu) {
    const odprte = vrstice.filter((v) => v.veljavnostDo === null)
    if (odprte.length !== 1) {
      throw new Error(
        `CenaZgodovina: par ${kljuc.replace('\u0000', ' × ')} ima ${odprte.length} odprtih cen — pričakovana NATANKO ena (EXCLUDE material_price_no_overlap) (${kje}).`,
      )
    }
    const padajoco = (a: CenaZgodovinaVnos, b: CenaZgodovinaVnos): number =>
      Date.parse(b.veljavnostOd) - Date.parse(a.veljavnostOd)
    const casovnicaVrstic = [...vrstice].sort(padajoco)
    const trenutnaV = odprte[0]
    const zaprte = casovnicaVrstic.filter((v) => v.veljavnostDo !== null)
    const prejsnjaV = zaprte[0] ?? null
    const vT = (v: CenaZgodovinaVnos): CenaTimelineVrstica => ({
      cena: v.cena,
      veljavnostOd: v.veljavnostOd,
      veljavnostDo: v.veljavnostDo,
      opomba: v.opomba,
    })
    const trenutna = vT(trenutnaV)
    const prejsnja = prejsnjaV ? vT(prejsnjaV) : null
    const deltaEur = prejsnja ? zaokrozi2(trenutna.cena - prejsnja.cena) : null
    const deltaOdstotek =
      prejsnja && prejsnja.cena > 0
        ? zaokrozi2(((trenutna.cena - prejsnja.cena) / prejsnja.cena) * 100)
        : null
    const smer = prejsnja ? smerIzDelte(trenutna.cena - prejsnja.cena) : null
    pari.push({
      inventoryId: trenutnaV.inventoryId,
      artikel: trenutnaV.artikel,
      supplierId: trenutnaV.supplierId,
      dobavitelj: trenutnaV.dobavitelj,
      trenutna,
      prejsnja,
      zaprtih: zaprte.length,
      deltaEur,
      deltaOdstotek,
      smer,
      casovnica: casovnicaVrstic.map(vT),
    })
  }
  pari.sort((a, b) =>
    a.artikel === b.artikel
      ? (a.dobavitelj < b.dobavitelj ? -1 : a.dobavitelj > b.dobavitelj ? 1 : 0)
      : (a.artikel < b.artikel ? -1 : 1),
  )
  const narascajo = pari.filter((p) => p.smer === 'narasca').length
  const padajo = pari.filter((p) => p.smer === 'pada').length
  const stabilnih = pari.filter((p) => p.smer === 'stabilna').length
  const prvihVpisov = pari.filter((p) => p.prejsnja === null).length
  return {
    pari,
    vnosov: resnica.length,
    narascajo,
    padajo,
    stabilnih,
    prvihVpisov,
  }
}

/**
 * EN VIR sklep pregleda (ENA preslikava — zaslon panela IN CSV meta: NIČ
 * dvojnega, kanon pregled.sklep R322). Iskren tudi v ničelni veji.
 */
export function cenaZgoSklep(pregled: CenaZgodovinaPregled): string {
  const delov: string[] = [
    `${pregled.pari.length} parov material × dobavitelj`,
    `${pregled.vnosov} cenovnih vrstic`,
  ]
  if (pregled.narascajo > 0) delov.push(`${pregled.narascajo} narašča`)
  if (pregled.padajo > 0) delov.push(`${pregled.padajo} pada`)
  if (pregled.stabilnih > 0) delov.push(`${pregled.stabilnih} stabilna`)
  if (pregled.prvihVpisov > 0) delov.push(`${pregled.prvihVpisov} prvi vpis`)
  return delov.join(', ')
}

/**
 * EN VIR podatkovne vrstice parov (R327 — 54. člen: SKUPNI potrošnik CSV +
 * PDF tabele; vzorec vodjaKpiVrstice R324 — ENA preslikava, dva potrošnika;
 * CSV in PDF ne moreta divergirati po konstrukciji). Iskrene ničelne veje:
 * brez prejšnje = prazno polje; brez smeri = 'prvi vpis' (NI izmišljenih
 * vrednosti). Čista preslikava — vsak klic vrača NOVE nize, nič skupnega stanja.
 */
export function cenaParVrstice(
  pregled: CenaZgodovinaPregled,
  kje: string,
): string[][] {
  if (!pregled || typeof pregled !== 'object' || !Array.isArray(pregled.pari)) {
    throw new Error(`CenaZgodovina: pregled mora nositi seznam pari (${kje}).`)
  }
  return pregled.pari.map((p) => [
    p.artikel,
    p.dobavitelj,
    p.prejsnja ? p.prejsnja.cena.toFixed(2) : '',
    p.trenutna.cena.toFixed(2),
    p.deltaEur === null ? '' : p.deltaEur.toFixed(2),
    p.deltaOdstotek === null ? '' : p.deltaOdstotek.toFixed(2),
    p.smer ? CENA_SMER_NIZ[p.smer] : 'prvi vpis',
    String(p.zaprtih),
  ])
}

/**
 * Zgrodi deterministični CSV zgodovine cen (par — ENA vrstica = EN
 * odločitveni sklop za naročanje; vzorec buildZmogljivostCsv R323). Brez
 * izvoznega časovnega žiga — čas bi uničil determinizem (isti HEAD = isti CSV).
 * Meta: prazna ločilna + 'Sklep' (EN VIR) + 'Vir' (CENA_ZGO_VIR_NIZ).
 * Podatkovne vrstice = cenaParVrstice (EN VIR — PDF brat R327 citira ISTO
 * preslikavo; arhivska oblika ostaja bajtno nespremenjena).
 */
export function buildCenaZgodovinaCsv(
  pregled: CenaZgodovinaPregled,
  kje: string,
): { csv: string; vrstic: number } {
  const podatkovne: CsvValue[][] = cenaParVrstice(pregled, kje)
  const meta: CsvValue[][] = [
    [], // prazna ločilna vrstica pred povzetkom (preglednost v Excelu)
    ['Sklep', cenaZgoSklep(pregled)],
    ['Vir', CENA_ZGO_VIR_NIZ],
  ]
  const csv = toCsv([...CENA_ZGODOVINA_CSV_GLAVE], [...podatkovne, ...meta])
  return { csv, vrstic: pregled.pari.length }
}
