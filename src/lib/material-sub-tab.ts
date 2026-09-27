// R213 — EN VIR resnice za podzavihke MaterialIntelligenceTab (BOM Refine /
// Naročila / Dobavitelji). Rabilo se na treh mestih (notification-center
// pošiljatelj, page.tsx usmerjevalnik, material-intelligence-tab porabnik) —
// ENA definicija, brez podvojenih nizov. Ločena mikromodula (ne izvoz iz
// komponente): page.tsx sme statično uvoziti LE ta modul — komponenta mora
// ostati LAZY dynamic import (r212 lekcija: needleji chunkov se zanašajo na to).
export type MaterialSubTab = 'bom' | 'orders' | 'suppliers'

export const MATERIAL_SUB_TABS = ['bom', 'orders', 'suppliers'] as const

export function isMaterialSubTab(v: string | null | undefined): v is MaterialSubTab {
  return !!v && (MATERIAL_SUB_TABS as readonly string[]).includes(v)
}

/** Namig iz centralne navigacije (roksal:navigate subTab): `n` se monotono
 * poveča na vsak namig, zato porabnik preklopi tudi, ko je že montiran
 * (isti tab dvakrat zapored = vseeno nov dogodek). null = brez namiga. */
export interface MaterialSubTabHint {
  tab: MaterialSubTab
  n: number
}
