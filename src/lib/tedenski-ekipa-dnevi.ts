// ---------------------------------------------------------------------------
// R305 (P1, 'izvozi' družina — 35. člen) — VODJA TEDENSKI PREGLED PO DNEVIH
// Z EKIPAMI — ZASLON (logistics-tab). ZASLONSKI brat PDF po ekipah R303 +
// CSV po ekipah R304: vodja vidi naslednjih 7 dni TAKOJ NA POGLED — brez
// tiska (PDF = tisk za vodjo) in brez Excela (CSV = filtriranje po ekipi);
// ZASLON = takoj (bralni član družine, vzorec branja R300 za konflikte).
// ISTA koledarska resnica kot cela tedenska družina — WYSIWYG po
// konstrukciji (isti pregled, isti sort, isti sklep).
//
// EN VIR resnice (NIČ dvojnega — vse primitivne izpeljave UVOŽENE):
//  • pregled = TedenskiEkipaPregled (UVOŽENA oblika iz R303 — okno ASC UTC,
//    skupine ASC UTF-16, termini sortirajVozniRed R255 znotraj ekipe,
//    preverba z indeksom krivca VSE dedovane; ta lib NIKOLI ne dela svojega
//    okna/sorta/filtra — izpeljava je ČISTA pregrupacija pregleda);
//  • Dan ime = tedenskiDanIme (UVOŽEN iz R256 — fiksni slovenski seznam,
//    determinizem čez pasove in locale);
//  • sklep = tedenskiEkipaPdfSklep (UVOŽEN iz R303 — PETI potrošnik ENEGA
//    niza [PDF sklep + PDF/toast + CSV meta + CSV/toast → ZASLON sklep];
//    WYSIWYG po konstrukciji — zaslon izreče ISTO resnico kot tisk in Excel).
//
// Domain pravila (družina R299/R303/R304):
//  • termini BREZ ekipe NISO vrstice (ekipa '—' ne obstaja — ISTI princip
//    kot R299 čipi/R303 sekcije/R304 stolpec); NISO tiho izgubljeni —
//    sklep (EN VIR) nosi iskren števec 'brez ekipe: N' IN komponenta
//    pokaže iskreno vrstico, ko je št. ekip 0 (pregled = null → vsi vidni
//    termini v okviru so brez ekipe — particija dokaz, N = razgled KPI).
//  • PRAZNI dnevi = iskreno vidni (terminov 0, vrstice []) — NIKOLI skriti
//    ('kateri dnevi prazni' JE resnica razgleda, kanon R292/R298).
//
// Načela (družinska pravila):
//  • Fail-closed: ne-objekt / pokvareno okno / pokvarene skupine / termin
//    izven okna / neusklajena particija (vsota dnevih ≠ pregled) → TypeError
//    (iskren abort — nikoli lažna resnica; EN VIR pregled je ŽE preverjen,
//    ta lib dvakrat brani — vzorec R303/R304).
//  • Determinizem: pregled je kanon f(množica) (skupine ASC UTF-16 + vrstice
//    sortirajVozniRed — premešan vhod → ISTI pregled); pregrupacija
//    obdaja okno ASC × skupine ASC × ohranjen sort — premešan vhod = ISTI
//    dnevni razgled (f(pregled), ne f(vrstni red odgovora)). Nič lastne
//    ure, nič lastnega sorta, nič FNV (zaslon nima datoteke/fileId-ja).
//  • CLIENT-safe: čisti klientski lib (uvozi ga logistics-tab) — nič
//    baznega uvoza, nič strežniške domene (STRAŽAR test brani; vzorec
//    R300/R301/R303/R304 klientskih libov).
// ---------------------------------------------------------------------------

import { tedenskiDanIme } from './tedenski-vozni-red-pdf'
import {
  tedenskiEkipaPdfSklep,
  type TedenskiEkipaPregled,
} from './tedenski-vozni-red-ekipa-pdf'
import type { VozniRedTermin } from './logistika-vozni-red-pdf'

/** ENA vrstica dneva: ekipa VERBATIM + termin (izpregledane skupine,
 *  sort ohranjen — sortirajVozniRed R255; NIČ pretvorbe vira). */
export interface TedenskiEkipaDanVrstica {
  ekipa: string
  termin: VozniRedTermin
}

/** EN dan okna: ISO dan + ime (uvožen R256) + števec VSEH vidnih terminov
 *  dneva (preklicani ŠTETI — viden odpad, kanon R298) + preklicani števec
 *  (rdeči žig pariteta PDF R303) + vrstice (ekipa ASC × čas ASC — ohranjen
 *  pregledov sort). */
export interface TedenskiEkipaDan {
  dan: string
  ime: string
  terminov: number
  preklicani: number
  vrstice: TedenskiEkipaDanVrstica[]
}

/** Dnevni razgled po ekipah — zaslonska resnica. Sklep = UVOŽEN
 *  tedenskiEkipaPdfSklep (PETI potrošnik ENEGA niza — WYSIWYG). */
export interface TedenskiEkipaDanRazgled {
  /** 7 dni okna ASC (danes..danes+6, UTC) — EN VIR pregled.okno. */
  dnevi: TedenskiEkipaDan[]
  /** Vsota terminov po dnevih = pregled.terminovVEkipah (particija
   *  dan × ekipa — fail-closed preverjena spodaj). Brez-ekipe NISO v vrsticah. */
  terminovSkupaj: number
  /** Vsota preklicanih po dnevih = pregled.preklicanih (iskren odpad). */
  preklicaniSkupaj: number
  /** Sklep EN VIR (tedenskiEkipaPdfSklep — ISTO besedilo kot PDF/CSV). */
  sklep: string
}

/** Pregrupacija pregleda R303 po dnevih — ENA resnica za zaslon (vzorec
 *  R292 razgled). Vhoda sta DVA: pregled (kanon f(množica)) — NIČ drugega
 *  (nikoli druga polja/vnosi — dvojno okno/sort = divergenca po konstrukciji
 *  nemogoča). Fail-closed: vsak termin pregleda pade NATANKO v EN dan okna
 *  (particija); vsota dnevih = pregled.terminovVEkipah + preklicaniSkupaj =
 *  pregled.preklicanih — neusklajeno → TypeError (abort, ne lažna resnica). */
export function tedenskiEkipaDanRazgled(
  pregled: TedenskiEkipaPregled,
): TedenskiEkipaDanRazgled {
  if (!pregled || typeof pregled !== 'object') {
    throw new TypeError(
      'tedenskiEkipaDanRazgled: pričakovan pregled (tedenskiEkipaPregled — R303 EN VIR)',
    )
  }
  if (!Array.isArray(pregled.okno) || pregled.okno.length === 0) {
    throw new TypeError(
      'tedenskiEkipaDanRazgled: pregled.okno mora biti ne-prazno polje ISO dni (neusklajen pregled — abort)',
    )
  }
  if (!Array.isArray(pregled.skupine)) {
    throw new TypeError(
      'tedenskiEkipaDanRazgled: pregled.skupine mora biti polje ekip sekcij (neusklajen pregled — abort)',
    )
  }
  // Dni okna — ASC (pregled.okno je kanon ASC UTC); ime = uvožen R256
  // (fail-closed tudi tu: ne-ISO dan → TypeError iz uvožene preverbe).
  const dnevi: TedenskiEkipaDan[] = pregled.okno.map((dan) => ({
    dan,
    ime: tedenskiDanIme(dan),
    terminov: 0,
    preklicani: 0,
    vrstice: [],
  }))
  const poDanu = new Map<string, TedenskiEkipaDan>(dnevi.map((d) => [d.dan, d]))
  for (const skupina of pregled.skupine) {
    if (
      !skupina ||
      typeof skupina !== 'object' ||
      typeof skupina.ekipa !== 'string' ||
      !Array.isArray(skupina.termini)
    ) {
      throw new TypeError(
        'tedenskiEkipaDanRazgled: neusklajena ekipa sekcija (pričakovano { ekipa: string, termini: VozniRedTermin[] } — abort)',
      )
    }
    for (const termin of skupina.termini) {
      // Dan = nizovni rez ISO začetka (ISTI princip kot pregled R303 in
      // cela tedenska družina — nikoli Date pretvorba, pasovno varno).
      const cilj = poDanu.get(termin.datumZacetka.slice(0, 10))
      if (!cilj) {
        throw new TypeError(
          `tedenskiEkipaDanRazgled: termin ekipe ${skupina.ekipa} nosi dan ${termin.datumZacetka.slice(0, 10)} izven okna pregleda (neusklajen pregled — abort)`,
        )
      }
      cilj.vrstice.push({ ekipa: skupina.ekipa, termin })
      cilj.terminov++
      if (termin.status === 'PREKlicANO') cilj.preklicani++
    }
  }
  let terminovSkupaj = 0
  let preklicaniSkupaj = 0
  for (const d of dnevi) {
    terminovSkupaj += d.terminov
    preklicaniSkupaj += d.preklicani
  }
  // Dvojna particija (dan × ekipa) — brez-ekipe NISO vrstice (princip
  // R299/R303/R304), zato vsota dnevih NATANKO pokrije pregled.terminovVEkipah.
  if (terminovSkupaj !== pregled.terminovVEkipah) {
    throw new TypeError(
      'tedenskiEkipaDanRazgled: neusklajena particija dnevov (vsota dnevih ≠ pregled.terminovVEkipah — abort)',
    )
  }
  if (preklicaniSkupaj !== pregled.preklicanih) {
    throw new TypeError(
      'tedenskiEkipaDanRazgled: neusklajeni preklicani (vsota dnevih ≠ pregled.preklicanih — abort)',
    )
  }
  return {
    dnevi,
    terminovSkupaj,
    preklicaniSkupaj,
    // PETI potrošnik ENEGA sklepa (PDF sklep + PDF/toast + CSV meta +
    // CSV/toast → ZASLON) — WYSIWYG po konstrukciji, NIČ dvojnega besedila.
    sklep: tedenskiEkipaPdfSklep(pregled),
  }
}
