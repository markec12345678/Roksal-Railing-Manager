// ---------------------------------------------------------------------------
// R307 (P1, 'izvozi' družina — 37. člen) — KONFLIKTNI DOKAZ NA ZASLONU
// (logistics-tab). ZASLONSKI brat Konflikti CSV R301 + Konflikti PDF R302:
// mini-vrstica 30. člena pokaže ŠTEVEC (rdeč žig), DOKAZ pokaže PAROVE —
// vodja/pisarna vidi KATERI termini se prekrivajo TAKOJ (triada: mini =
// števec, ZASLON = dokaz takoj, CSV/PDF = dokaz za Excel/tisk — vzorec
// R306 oprema dokaz).
//
// EN VIR resnice (NIČ dvojnega):
//  • pregled = TedenskiKonfliktPregled (UVOŽEN iz R300 — skupine ASC UTF-16,
//    pari čas ASC f(množica), preverba dedovana; ta lib NIKOLI ne dela
//    svojega pregleda/sorta — ČISTA preslikava v prikazne vrstice);
//  • Čas = vozniRedCasOkno (UVOŽEN R255 — ENA izpeljava časa za celo
//    družino, lekcija R121/R235);
//  • statusi = SCHEDULE_TERMINI_STATUS_LABELS (VERBATIM — nič lastnih
//    oznak; preklicani NE sodelujejo v parih — pregled brani že sam);
//  • Dan = ISO dan para VERBATIM (max začetek, UTC rez — pregled ga že
//    izračuna; NIČ druge časovne resnice).
//
// Načela (družinska pravila):
//  • Fail-closed: ne-pregled / pokvarene skupine / pokvarjen par → TypeError
//    z imenom graditelja (string kanon — R302 lekcija 1; pregled R300 brani
//    že sam, ta lib dvakrat brani — vzorec R305/R306).
//  • Determinizem: vrstice v pregledovem redu (skupine ASC × pari čas ASC —
//    premešan vhod pregleda je ŽE kanon f(množica)); NIČ lastnega sorta,
//    NIČ ure, NIČ FNV (zaslon nima datoteke).
//  • CLIENT-safe: čisti klientski lib — nič baznega uvoza, nič strežniške
//    domene (STRAŽAR test brani; vzorec R300/R305/R306 klientskih libov).
// ---------------------------------------------------------------------------

import { vozniRedCasOkno, type VozniRedTermin } from './logistika-vozni-red-pdf'
import { SCHEDULE_TERMINI_STATUS_LABELS } from './termini-prikaz'
import type { TedenskiKonfliktPregled } from './tedenski-konflikti'

/** ENA dokazna vrstica: ekipa + dan prekrivanja + OBA člena VERBATIM
 *  (čas okna R255 + projekt + status label; nič pretvorbe vira). */
export interface KonfliktiDokazVrstica {
  ekipa: string
  dan: string
  aOkno: string
  bOkno: string
  aProjekt: string | null
  bProjekt: string | null
  aStatus: string
  bStatus: string
}

/** Preslikava pregleda R300 v prikazne vrstice — ENA resnica za zaslon
 *  (vzorec R305 pregrupacije / R306 filtra). Vhod EN (pregled — nikoli
 *  drugih seznamov). Fail-closed: pokvaren pregled/par → TypeError z imenom
 *  graditelja. 0 parov NIKOLI ne pride ven (pregled = null pri 0 konfliktih;
 *  klicna stran garantira non-null — mirror konfliktiSklep kanon). */
export function konfliktiDokaz(pregled: TedenskiKonfliktPregled): KonfliktiDokazVrstica[] {
  if (!pregled || typeof pregled !== 'object' || !Array.isArray(pregled.skupine)) {
    throw new TypeError(
      'konfliktiDokaz: pričakovan pregled (TedenskiKonfliktPregled — non-null iz tedenskiKonflikti)',
    )
  }
  const vrstice: KonfliktiDokazVrstica[] = []
  for (const skupina of pregled.skupine) {
    if (
      !skupina ||
      typeof skupina !== 'object' ||
      typeof skupina.ekipa !== 'string' ||
      !Array.isArray(skupina.pari)
    ) {
      throw new TypeError(
        'konfliktiDokaz: neusklajena ekipa skupina (pričakovano { ekipa: string, pari: TedenskiKonfliktPar[] } — abort)',
      )
    }
    for (const par of skupina.pari) {
      if (
        !par ||
        typeof par !== 'object' ||
        !par.a ||
        !par.b ||
        typeof par.a.datumZacetka !== 'string' ||
        typeof par.b.datumZacetka !== 'string'
      ) {
        throw new TypeError(
          `konfliktiDokaz: neusklajen par ekipe ${skupina.ekipa} (pričakovano { a: VozniRedTermin, b: VozniRedTermin, dan: string } — abort)`,
        )
      }
      vrstice.push({
        ekipa: skupina.ekipa,
        dan: par.dan,
        aOkno: vozniRedCasOkno(par.a),
        bOkno: vozniRedCasOkno(par.b),
        aProjekt: par.a.projekt,
        bProjekt: par.b.projekt,
        aStatus: SCHEDULE_TERMINI_STATUS_LABELS[par.a.status as VozniRedTermin['status']],
        bStatus: SCHEDULE_TERMINI_STATUS_LABELS[par.b.status as VozniRedTermin['status']],
      })
    }
  }
  return vrstice
}
