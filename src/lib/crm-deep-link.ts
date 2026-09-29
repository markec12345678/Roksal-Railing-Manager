/**
 * R288 — (k) opomnik DEEP-LINK — dopolnitev R287 portal akcije:
 * signal → dejanje → CILJ. Zvončkova opomniška vrstica (id 'opomnik-{id
 * stranke}') odpri CRM in IZBERE konkretno stranko (detail Sheet z opomniško
 * kartico + poudarjena vrstica) — dvo-dogodkovni protokol (R214 vzorec:
 * roksal:navigate + roksal:select-crm; pariteta install/select-project).
 *
 * ČISTA funkcija za testabilnost (vzorec R283): odločitev o porabi
 * deep-link zahteve je izvlečena iz CrmTab učinka — VSE robe pokrijejo
 * vitest pini, komponenta ostane tanka vez.
 *
 * STROGOST (fail-closed, ista družina kot opomnik-zvonek R287):
 * - vrstični id brez 'opomnik-' prefiksa ALI brez ostanka → null (klicatelj
 *   naredi samo navadno navigacijo — R216 vzorec 'brez → navadna navigacija');
 * - CAKAJ, dokler seznam ni uspešno naložen (nalaganje ALI napaka — zahteva
 *   ostane v lastniku stanja, poraba šele po uspešnem reload-u; brez ugibanja);
 * - stranka NI več v uspešno naloženem seznamu (izbrisana/RBAC med klikom in
 *   nalaganjem) → PRESKOCI (navadni CRM seznam = R287 vedenje, fail-safe);
 * - ne-objektni vnosi v seznamu so preskočeni (nikoli lažne izbire).
 *
 * Client-safe: brez uvozov. Vsaka funkcija je čista in deterministična
 * (isti vhod → isti izid).
 */

/** Minimalen prerez stranke za deep-link (podmnožica CrmCustomer —
 * client-safe; lib se zanima SAMO za identiteto, ne poslovnih polj). */
export interface CrmDeepLinkStranka {
  id: string
}

/** Iz zvončkove vrstične id ('opomnik-{id stranke}') izlušči id stranke.
 * Fail-closed: ne-niz / brez prefiksa / prazen ostanek → null (klicatelj
 * naredi samo navadno navigacijo — R287 vedenje, R216 fail-safe vzorec).
 * Ostanek se ne validira naprej — resnico o obstoju stranke razsodi seznam
 * (crmDeepLinkOdlocitev), NE ta parser. */
export function opomnikStrankaIdIzVrstice(vrsticniId: unknown): string | null {
  if (typeof vrsticniId !== 'string' || vrsticniId === '') return null
  if (!vrsticniId.startsWith('opomnik-')) return null
  const ostanek = vrsticniId.slice('opomnik-'.length)
  return ostanek === '' ? null : ostanek
}

/** Odločitev porabe deep-link zahteve (izvlečeno iz CrmTab učinka). */
export type CrmDeepLinkOdlocitev<T extends CrmDeepLinkStranka> =
  | { dejanje: 'CAKAJ' }
  | { dejanje: 'ODPRI'; stranka: T }
  | { dejanje: 'PRESKOCI' }

/** Odloči, kaj CrmTab naredi z deep-link zahtevo (id stranke iz zvončka).
 * Generično nad prerezom stranke — klicatelj poda svoj tip (CrmCustomer),
 * lib obljubi SAMO identiteto (id) in vrne najdeni objekt iz PODOANEGA
 * seznama (nikoli konstrukcije iz fantomske resnice).
 *
 * - CAKAJ: brez zahteve / zahteva ni ne-prazen niz / seznam se še naloga /
 *   nalaganje je spodletelo (napaka ≠ null) — zahteva ostane, poraba šele
 *   po uspešnem osvežitvi;
 * - ODPRI: stranka najdena v PODOANEM seznamu → detail Sheet;
 * - PRESKOCI: uspešno naložen seznam brez stranke → navadni CRM seznam
 *   (R287 vedenje); zahteva je porabljena (one-shot — klicatelj počisti). */
export function crmDeepLinkOdlocitev<T extends CrmDeepLinkStranka>(
  zahteva: unknown,
  customers: readonly unknown[],
  nalaganje: boolean,
  napaka: string | null,
): CrmDeepLinkOdlocitev<T> {
  if (typeof zahteva !== 'string' || zahteva === '') return { dejanje: 'CAKAJ' }
  if (nalaganje) return { dejanje: 'CAKAJ' }
  if (napaka !== null) return { dejanje: 'CAKAJ' }
  if (!Array.isArray(customers)) return { dejanje: 'CAKAJ' }
  for (const v of customers) {
    if (v === null || typeof v !== 'object') continue
    const kandidat = v as T
    if (typeof kandidat.id !== 'string') continue
    if (kandidat.id === zahteva) return { dejanje: 'ODPRI', stranka: kandidat }
  }
  return { dejanje: 'PRESKOCI' }
}
