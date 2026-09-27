// R219 (P1-f) — EN VIR resnice za 'pod minimumom' filter chip v Zalogi.
// ---------------------------------------------------------------------------
// R218 je 'Vse' vrstico v paleti ⌘K povezal z navadno navigacijo v Zalogo
// (dialog je za EN artikel — ne lažemo). A uporabnik, ki klikne 'Pokaži vse s
// nizko zalogo v Zalogi', je v Zalogi moral SAM ponovno prepoznati, kateri
// artikli so pod minimumom — vrstica je obljubila 'vse s nizko zalogo', Zaloga
// pa je pokazala VSE artikle. Ta modul je ENA definicija filtra 'pod
// minimumom' (whitelist + type guard + tip namiga), ki ga 'Vse' vrstica ZDAJ
// resnično nosi s seboj (deep-link) in Zaloga upošteva kot čip.
//
// Ločena mikromodula (ne izvoz iz komponente): page.tsx sme statično uvoziti
// LE ta modul — komponenta mora ostati LAZY dynamic import (r212 lekcija:
// needleji chunkov se zanašajo na to; ISTI vzorec kot material-sub-tab.ts
// R213). Fail-closed po duhu projekta: neznan niz NIKOLI ne ugasne kot filter
// (whitelist — brez proizvoljnih nizov v URL/state protokolu).

/** R221 — TRI podprta filtra Zaloge: 'pod-minimumom' (zaloga <= minimum —
 * R219 čip), 'na-minimumu' (zaloga === minimum — R220 drugi čip; saj je
 * `===` podmnožica `<=`, je to ožji sorojeni pogled ISTEGA vprašanja nizke
 * zaloge) in 'brez-dobavitelja' (R221 TRETJI vnos — DRUGA dimenzija:
 * nabavna pripravljenost; artikel brez VPISANE cene pri katerem koli
 * dobavitelju = naročilni tok ne more ceniti postavke — MaterialPrice je
 * EN VIR zasidranja dobavitelja). Razširitve dodajo vrednost TUKAJ + v
 * whitelist — nikjer drugje. */
export type InventoryFilterHint = 'pod-minimumom' | 'na-minimumu' | 'brez-dobavitelja'

export const INVENTORY_FILTERS = ['pod-minimumom', 'na-minimumu', 'brez-dobavitelja'] as const

/** Whitelist type guard (ISTI vzorec kot isMaterialSubTab R213): namig iz
 * centralne navigacije je niz — neznan/praazen niz = brez namiga, ne napaka. */
export function isInventoryFilter(v: string | null | undefined): v is InventoryFilterHint {
  return !!v && (INVENTORY_FILTERS as readonly string[]).includes(v)
}

/** Namig iz centralne navigacije (roksal:navigate filter / centralNavigate 5.
 * argument): `n` se monotono poveča na vsak namig, zato porabnik prižge čip
 * tudi, ko je že montiran in je čip uporabnik ročno ugasnil (zadnji klik
 * zmaga — deterministično; ISTI vzorec kot MaterialSubTabHint R213 in
 * osnutek hint R216). null = brez namiga (stale namig nikoli ne preživi
 * naslednje navigacije). */
export interface InventoryFilterNamig {
  filter: InventoryFilterHint
  n: number
}
