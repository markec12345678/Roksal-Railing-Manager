// ---------------------------------------------------------------------------
// R306 (P1, 'izvozi' družina — 36. člen) — OPREMA CIKEL DOKAZ NA ZASLONU
// (logistics-tab). ZASLONSKI brat Cikel PDF R266 + Cikel CSV R297: mini-
// vrstica pokaže ŠTEVCE žigov, DOKAZ pokaže KATERA oprema potrebuje akcijo
// — delavnica/pisarna vidi NAZIVE TAKOJ, brez tiska in Excela (vzorec
// branja R300 konflikti / R305 po dnevih).
//
// EN VIR resnice (NIČ dvojnega):
//  • vrste = OpremaCikelVrsta (UVOŽENE iz R266 pregleda — okno NE obstaja,
//    NAZIV ASC sort dedovan sortirajOpremoCikel, žigi IDENTIČNI celicam
//    PDF/CSV; ta lib NIKOLI ne dela svojega sorta/žigov — ČIST filter);
//  • žigi (4 akcije, pariteta PDF/CSV): pregledZapadel (RED) ·
//    pregledNezabelezen (AMBER — iskreno NEZNANO) · kalPotecena (RED) ·
//    kalManjkaRok (AMBER). kalNeZahteva NI žig (nemerska — sivo, NI alarm);
//    brezLokacije NI žig (higienski odpad, mini-vrstica ga že izreče).
//
// Iskren dvojni števec (NIKOLI zlito):
//  • vrstic = KOSOVI z vsaj enim žigom (kos z več žigi = ENA vrstica —
//    ista resnica kot vrstica PDF/CSV);
//  • ziga = VSOTA žigov (mini-vrstica šteje PER ŽIG — 2 resnici, NIKOLI
//    izenačeni; sklep izreče obe: 'vrstic N · žigov M' z N ≤ M).
//
// Načela (družinska pravila):
//  • Fail-closed: ne-polje / podvojen id → TypeError (pregled R266 je ŽE
//    brani — ta lib dvakrat brani, vzorec R303/R305).
//  • Determinizem: filter ohranja dedovan pregledov vrstni red (NAZIV ASC ×
//    id ASC) — premešan vhod pregleda je ŽE kanon f(množica), filter je
//    f(pregled). Nič lastnega sorta, nič ure, nič FNV (zaslon nima datoteke).
//  • CLIENT-safe: čisti klientski lib — nič baznega uvoza, nič strežniške
//    domene (STRAŽAR test brani; vzorec R300/R305 klientskih libov).
// ---------------------------------------------------------------------------

import type { OpremaCikelVrsta } from './oprema-cikel-pdf'

/** Dokazni razgled — vrstice (samo oprema z vsaj enim žigom, dedovan red)
 *  + iskren dvojni števec (vrstic = kosovi, ziga = vsota žigov). */
export interface OpremaCikelDokazRazgled {
  /** Oprema, ki potrebuje akcijo — ENA vrstica na kos (žigi VERBATIM iz
   *  pregleda R266; red dedovan NAZIV ASC × id ASC — NIČ re-sorta). */
  vrstice: OpremaCikelVrsta[]
  /** Št. kosov z vsaj enim žigom (= vrstice.length — poimenovan za sklep). */
  vrstic: number
  /** Vsota žigov po vrsticah (kos z več žigi šteje VEČ — pariteta mini-
   *  vrstice, ki šteje per žig; NIKOLI izenačen z vrstic). */
  ziga: number
}

/** Št. akcijskih žigov vrstice (4 znane akcije — pariteta PDF/CSV celic;
 *  kalNeZahteva NI akcija, brezLokacije NI akcija). IZVOŽEN — komponenta in
 *  testi brajo ISTO resnico (NIČ dvojnega štetja). Fail-closed: pokvarjena
 *  vrsta → TypeError z imenom graditelja (kanon — sporočilo nosi ime,
 *  needleji na string kanon; vzorec R302 lekcija 1). */
export function opremaZigi(v: OpremaCikelVrsta): number {
  if (!v || typeof v !== 'object' || typeof v.id !== 'string') {
    throw new TypeError('opremaZigi: pričakovana vrsta opreme (OpremaCikelVrsta — R266 EN VIR)')
  }
  return (
    (v.pregledZapadel ? 1 : 0) +
    (v.pregledNezabelezen ? 1 : 0) +
    (v.kalPotecena ? 1 : 0) +
    (v.kalManjkaRok ? 1 : 0)
  )
}

/** Filter pregleda R266 na akcijsko opremo — ČIST filter (vzorec R305
 *  pregrupacije): vhod EN (vrste pregleda — nikoli drugih seznamov =
 *  divergenca po konstrukciji nemogoča). Fail-closed: ne-polje / podvojen
 *  id → TypeError. 0 žigov = iskrena praznina (zelen žig na zaslonu —
 *  nikoli skrit, kanon R292). */
export function opremaCikelDokaz(vrste: readonly OpremaCikelVrsta[]): OpremaCikelDokazRazgled {
  if (!Array.isArray(vrste)) {
    throw new TypeError(
      'opremaCikelDokaz: pričakovano polje vrst (opremaCikelPregled — R266 EN VIR)',
    )
  }
  // Podvojen id = pokvaren pregled (dve vrstici za ISTO identiteto bi lažno
  // podvajali dokaz — fail-closed, NIKOLI tiho združevanje; 2. obramba,
  // pregled R266 brani že sam).
  const videni = new Set<string>()
  for (const v of vrste) {
    if (!v || typeof v !== 'object' || typeof v.id !== 'string') {
      throw new TypeError(
        'opremaCikelDokaz: neusklajena vrsta (pričakovano OpremaCikelVrsta — abort)',
      )
    }
    if (videni.has(v.id)) {
      throw new TypeError(
        `opremaCikelDokaz: podvojen id opreme ${v.id} (pokvaren pregled — abort)`,
      )
    }
    videni.add(v.id)
  }
  const vrstice = vrste.filter((v) => opremaZigi(v) > 0)
  let ziga = 0
  for (const v of vrstice) ziga += opremaZigi(v)
  return { vrstice, vrstic: vrstice.length, ziga }
}
