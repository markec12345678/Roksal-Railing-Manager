/**
 * R228 — NOVA tema (konvergenčna serija 'brez dobavitelja' zaključena na 10
 * površinah — R221 čip, R222 paleta/zvonček/zgodovina, R223 Domov, R224
 * vodja-zaslon/CSV/PDF, R225 vrstica, R226 CSV izvoz, R227 naročilni tok):
 * ZANESLJIVOST DOBAV. Zamujena dobava = naročilo z IZRECNO obljubljenim
 * datumom dobave (datumDobave), ki je že pretekel, status pa je ŠE odprt.
 * Obljuba, ki ni bila izpolnjena, je resničen alarm nabavne logistike —
 * sorojenec 'poteklih opomnikov' v CRM (oba pretečen rok; tu za MATERIAL,
 * tam za STRANKE).
 *
 * STROGOST (fail-closed, ISTA družina kot čip R221 / zvonček R222 / Domov
 * R223 / vodja R224 / vrstica R225 / CSV R226 / naročilnica R227):
 * - brez izrecnega datuma (null / undefined / prazen niz) NIKOLI ni zamujen
 *   — manjkajoča obljuba ni prekršek (brez privzetih ničel, brez ohlapnih
 *   enačb, brez lažnega žiga);
 * - pokvaren datum (NaN) NIKOLI ni zamujen;
 * - zaprta stanja (DOBLJENO, PREKLICANO, …) nikoli — prejeto ali preklicano
 *   naročilo ne more biti 'zamujeno'.
 *
 * EN VIR: /api/material-orders vrača celoten model (include, brez select
 * omejitve) — datumDobave je na ISTEM odgovoru, ki ga vodjin pregled ŽE
 * bere za 'odprta naročila' (nič nove zahteve).
 *
 * Vsaka funkcija je čista in deterministična (isti vhod → isti izid; danas
 * je IZRECEN argument — brez skrite ure).
 */

/** Odprti statusi naročila — dobesedna trojica (ISTA kot odprtaNarocila
 * izračun v vodjinem pregledu; ENA definicija pomena 'odprto'). */
export const ODPRTI_STATUSI_NAROCIL = ['OSNUTEK', 'POSLANO', 'POTRJENO'] as const

export type OdprtStatusNarocila = (typeof ODPRTI_STATUSI_NAROCIL)[number]

/** Najmanjši prerez naročila za oceno zamude (podmnožica MaterialOrder —
 * client-safe, brez uvozov; datumDobave je ISO niz iz Prisme). */
export interface NarociloZaZamudo {
  status: string
  datumDobave?: string | null
}

/** Ali je naročilo ZAMUJENO (obljubljeni datum dobave pretekel, status še
 * odprt)? `danas` je začetek trenutnega dneva (polnoč) — klicatelj ga poda
 * IZRECNO (determinizem: isti vhod + isti dan = isti izid).
 *
 * Fail-closed: katera koli neznana oblika vhoda → false (NIKOLI lažnega
 * žiga); le izrecna pretečena obljuba pri odprtem statusu → true. */
export function jeZamujenaDobava(o: NarociloZaZamudo, danas: Date): boolean {
  // Doberesedna trojica odprtih statusov (pozitivna oblika — ISTI pomen
  // kot odprtaNarocila izračun v vodjinem pregledu; includes ohlapnosti
  // na poljubnem nizu so izrecno izključene).
  const odprt =
    o.status === 'OSNUTEK' || o.status === 'POSLANO' || o.status === 'POTRJENO'
  if (!odprt) return false
  // Manjkajoča obljuba = brez žiga (fail-closed — prazen niz TUDI).
  if (typeof o.datumDobave !== 'string' || o.datumDobave === '') return false
  const obljuba = new Date(o.datumDobave)
  // Pokvaren datum = brez žiga (NIKOLI lažnega alarma).
  if (Number.isNaN(obljuba.getTime())) return false
  // Šele zdaj resnica: obljuba STRIKTNO pred začetkom trenutnega dneva
  // (danes je ŠE dan obljube — zamuda se začne JUTRI ob polnoči).
  return obljuba < danas
}

/** Števec zamujenih dobav (fail-verbose na prelomljenem seznamu: TypeError,
 * ISTA družina kot narociloKolicina / counter v vodja-csv — jedro nikoli ne
 * utiša prelomljenega vhoda). Vnosi, ki niso objekti z znano obliko, NE
 * štejejo kot zamujeni (fail-closed per vnos — brez lažnega žiga), a seznam
 * MORA biti seznam. */
export function steviloZamujenihDobav(
  orders: readonly unknown[],
  danas: Date,
): number {
  if (!Array.isArray(orders)) {
    throw new TypeError('R228: orders mora biti seznam naročil')
  }
  let stevec = 0
  for (const o of orders) {
    if (o === null || typeof o !== 'object') continue
    const kandidat = o as { status?: unknown; datumDobave?: unknown }
    if (typeof kandidat.status !== 'string') continue
    if (
      kandidat.datumDobave !== null &&
      kandidat.datumDobave !== undefined &&
      typeof kandidat.datumDobave !== 'string'
    ) {
      continue
    }
    if (
      jeZamujenaDobava(
        {
          status: kandidat.status,
          datumDobave: kandidat.datumDobave as string | null | undefined,
        },
        danas,
      )
    ) {
      stevec += 1
    }
  }
  return stevec
}

/** Slovenske oblike besede 'naročilo' (nominativ, ISTA oblika kot
 * zalogaPovzetekBeseda R221: 1 / 2 / 3-4 / 5+ brez % 100 — EN vzorec
 * družine, pravilno za praktične števce): 1 naročilo, 2 naročili, 3–4
 * naročila, 5+ naročil. Ničelni/sestavljeni konteksti ('Ni zamujenih
 * naročil') obliko NE uporabljajo — kartica je vidna LE ko je števec > 0
 * (iskrena vidnost R224). */
export function narociloBeseda(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError('R228: n mora biti nenegativno celo število')
  }
  if (n === 1) return 'naročilo'
  if (n === 2) return 'naročili'
  if (n === 3 || n === 4) return 'naročila'
  return 'naročil'
}
