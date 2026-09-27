// Roksal — R217 P1-d: konvergenca TRETJEGA signalca (iskanje → naročilni tok)
// ---------------------------------------------------------------------------
// ⌘K paleta ima od R215 skupino 'Nizka zaloga' (R216: klik → Osnutek dialog
// prek centralNavigate 4. argumenta) in zvonček od R216 deep-link 'stock'
// vrstico. Iskalni zadetki Materiala so bili EDINI signal, ki je videl
// artikel z nizko zalogo in ga NI povezal z naročilnim tokom — uporabnik,
// ki išče artikel po imenu/šifri in ga zadene, je moral nato ročno v Zalogo.
//
// Ta lib je EN VIR presojanja "ali je ta iskalni zadetek artikel pod
// minimumom, ki lahko odpre naročilni tok". Fail-closed po duhu projekta:
// če odgovor /api/search NIMA popolnih zaloga polj (starejši odgovor,
// sekanc med deployema), funkcija vrne null — UI NE trdi nizke zaloge in
// NE ponudi deep-linka (nič izmišljenega, brez lažnega badgea).
//
// Brez React odvisnosti — čisto enota, testirljivo brez montiranja komponent.
import type { ZalogaArtikelZaNarocilo } from '@/lib/zaloga-povzetek'

// ---------------------------------------------------------------------------
// R218 (P1-e) — ZGODOVINA kot ČETRTI signalec konvergence. Nedavna iskanja
// (⌘K 'Nedavna iskanja') so do zdaj nosila SAMO niz poizvedbe — uporabnik,
// ki je včeraj prek iskanja naletel na artikel z nizko zalogo, danes v
// zgodovini te sledi NE vidi. Ta sekcija je EN VIR shranjevanja/ branja
// vnosov zgodovine z OPCIJSKIM 'nizkaZaloga' žigom (zabeleženim ob izboru
// Material zadetka, ki je imel osnutek). Fail-closed po duhu projekta:
// starejši vnos (gol niz — shema pred R218) ali pokvarjen localStorage
// pomenita "brez žiga" — NIKOLI pa lažnega žiga (žig nosi SAMO dobesedna
// `true`; vse ostalo je nevtralno). Žig je NAMIG (klik zgodovine ponovno
// požene iskanje → badgei iz SVEŽIH podatkov) — zgodovina nikoli ne trdi
// stanja zaloge, ki ga ne more vedeti.
// ---------------------------------------------------------------------------

/** EN vnos zgodovine iskanja. `nizkaZaloga` je opcijski žig (samo dobesedna
 * `true` — glej zgoraj); ključ se NE zapiše, ko ni resničen (deterministična
 * oblika brez šuma). R222 — `brezDobavitelja` je DRUGI neodvisni žig (ISTA
 * strogost: le dobesedna `true`; druga dimenzija — nabavna pripravljenost,
 * R221 — lahko obstaja SOBOJ z nizko zalogo na ISTEM vnosu, vsak žig pove
 * SVOJE). */
export interface RecentSearchVnos {
  q: string
  nizkaZaloga?: true
  brezDobavitelja?: true
}

/** Fail-closed razčlenjevalnik shranjene zgodovine (localStorage JSON).
 * Sprejme mešanico starih (goli niz) in novih ({q, nizkaZaloga?}) vnosov;
 * pokvarjene/prehkratke vnose NEPADIče spusti (noben vnos ne more pokvariti
 * ostalih), počisti presledke, omeji na max. `unknown` vhod — poljuben
 * pokvarjen JSON je pričakovan vhod, ne napaka. */
export function preberiZgodovinoVnose(raw: unknown, max: number): RecentSearchVnos[] {
  if (!Array.isArray(raw)) return []
  const vnosi: RecentSearchVnos[] = []
  for (const el of raw) {
    if (typeof el === 'string') {
      if (el.trim().length >= 2) vnosi.push({ q: el.trim() })
    } else if (typeof el === 'object' && el !== null && 'q' in el) {
      const kandidat = el as { q?: unknown; nizkaZaloga?: unknown; brezDobavitelja?: unknown }
      if (typeof kandidat.q === 'string' && kandidat.q.trim().length >= 2) {
        // R222 — vsak žig NEODVISNO dobesedno true (fail-closed: vse ostalo
        // je nevtralno — NIKOLI lažnega žiga; vnos s SOBOJIMA žigoma je
        // veljaven in ohrani oba).
        const vnos: RecentSearchVnos = { q: kandidat.q.trim() }
        if (kandidat.nizkaZaloga === true) vnos.nizkaZaloga = true
        if (kandidat.brezDobavitelja === true) vnos.brezDobavitelja = true
        vnosi.push(vnos)
      }
    }
    if (vnosi.length >= max) break
  }
  return vnosi.slice(0, max)
}

/** ENA združitev novega vnosa z obstoječo zgodovino: na začetek, dedup po
 * malih črkah (ISTI vzorec kot pred R218 — ničesar ne spreminjamo v
 * vedenju, samo nosilec se razširi z opcijskim žigom), omejitev na max.
 * R222 — peti neobvezen argument `brezDobavitelja` (starejši klici s 4
 * argumenti ostanejo identični — undefined pomeni brez žiga). Ponovno
 * iskanje ISTEGA q z DRUGAČNO resničnostjo ZAMENJA žige (sveža resnica
 * zmaga — deterministično; žig je namig o ZADNJEM izboru, ne zgodovina
 * vseh izborov). Poizvedbe krajše od 2 znakov zgodovino NE spreminjajo
 * (vrne kopijo — klicalec lahko varno nadaljuje z rezultatom). */
export function zdruziZgodovino(
  obstojeca: readonly RecentSearchVnos[],
  q: string,
  nizkaZaloga: boolean | undefined,
  max: number,
  brezDobavitelja?: boolean,
): RecentSearchVnos[] {
  const trimmed = q.trim()
  if (trimmed.length < 2) return [...obstojeca]
  const vnos: RecentSearchVnos = { q: trimmed }
  if (nizkaZaloga === true) vnos.nizkaZaloga = true
  if (brezDobavitelja === true) vnos.brezDobavitelja = true
  return [
    vnos,
    ...obstojeca.filter((v) => v.q.toLowerCase() !== trimmed.toLowerCase()),
  ].slice(0, max)
}

/** Iskalni zadetek Materiala iz /api/search. Zaloga polja so opcijska:
 * prisotna so od R217 dalje (API jih vrača za iskren badge + deep-link);
 * njihova odsotnost pomeni "ne moremo presoditi" — NI enako "ni nizke".
 * R222 — `cenaVrstic` je števec zasidranj pri dobaviteljih (MaterialPrice
 * po artikel — ISTI EN VIR zasidranja kot R221 /api/inventory: `prices`
 * back-relation, šteje VSE vrstice, pretečena cena je še vedno zasidran
 * dobavitelj). Opcijski: starejši odgovor (sekanc med deployema) brez
 * polja pomeni "ne moremo presoditi" — NI enako "brez dobavitelja". */
export interface IskalniMaterial {
  id: string
  naziv: string
  sifra: string
  kolicinaZaloga?: number
  minimalnaZaloga?: number
  enota?: string
  cenaVrstic?: number
}

/** R222 (P1-c nadaljevanje) — EN VIR presojanja "ali ta iskalni zadetek
 * artikel BREZ vpisane dobaviteljske cene" (druga dimenzija — nabavna
 * pripravljenost; naročilni tok ne more ceniti postavke). Fail-closed po
 * duhu projekta: polje mora biti PRISOTNO in dobesedno 0 — manjkajoči
 * števec NIKOLI ni 'brez' (stari predpomnjeni odgovor ne laže), negativne
 * vrednosti ne obstajajo, vsak drug števec pomeni 'zasidran'. ISTA
 * STROGOST kot R221 čip (=== 0; brez `?? 0` / `<= 0` ohlapnosti). */
export function brezDobaviteljaIzIskanja(m: IskalniMaterial): boolean {
  return m.cenaVrstic === 0
}

/** Vrne POPOLN artikel za osnutek deep-link (ZalogaArtikelZaNarocilo), ko
 * je zadetek pod ali NA minimumu in so vsa polja prisotna/veljavna; sicer
 * null (visoka zaloga, manjkajoča polja ali neveljavne vrednosti — vsak
 * sum gre na strani varnosti: ne ugibamo). Meja je <= — ISTA semantika kot
 * R215/R216 izpeljanka v paleti in zvončku (en podatkovni jezik čez
 * signalce). Preslikava sifra → sifraMateriala (IskalniMaterial je oblika
 * iskalnega odgovora, artikel pa oblika Zaloge — ENA preslikava tu, nikjer
 * drugje).
 * R227 (P1-c nadaljevanje) — deseti signalec: preslikava nosi TUDI
 * nabavno pripravljenost per postavka — `cenaVrstic` (iskalni odgovor za
 * `_count.prices`, R222) gre passthrough v `_count.prices` ISTEGA artikla
 * (ista resnica, ISTA strogost `=== 0` tokrat v Osnutku/naročilnici);
 * manjkajoči `cenaVrstic` = artikel brez `_count` (fail-closed — brez
 * oznake, NIKOLI lažnega žiga). */
export function osnutekIzIskanja(m: IskalniMaterial): ZalogaArtikelZaNarocilo | null {
  const { kolicinaZaloga, minimalnaZaloga, enota } = m
  if (typeof kolicinaZaloga !== 'number' || !Number.isFinite(kolicinaZaloga)) return null
  if (typeof minimalnaZaloga !== 'number' || !Number.isFinite(minimalnaZaloga)) return null
  if (typeof enota !== 'string' || enota.length === 0) return null
  if (kolicinaZaloga > minimalnaZaloga) return null
  return {
    id: m.id,
    sifraMateriala: m.sifra,
    naziv: m.naziv,
    kolicinaZaloga,
    enota,
    minimalnaZaloga,
    ...(typeof m.cenaVrstic === 'number'
      ? { _count: { prices: m.cenaVrstic } }
      : {}),
  }
}
