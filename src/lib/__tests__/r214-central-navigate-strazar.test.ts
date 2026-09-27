// R214 — centralNavigate EN VIR (page.tsx) + ukazna paleta ⌘K podzavihki (P1-f)
// + osnutek toast deep-link 'Odpri naročila' + bottom-nav aria-current/focus.
//
// Prej: ukazna paleta je šla POVRH MaterialSubTab protokola (setMoreTab direktno
// v onNavigate prop) — 'Material Intelligence (V5)' je vedno pristal na BOM,
// brez whitelist/monotonskega n IN z bugom: 'Skice' je prižigala
// setMoreTab('sketches'), čeprav več-vsebina nima skic modula (skice = overlay
// prek setSketchOpen) → PRAZEN panel. Zdaj: ENA funkcija centralNavigate za
// roksal:navigate dogodek IN paleto; paleta dobi 3 direktne podzavihke.
// Osnutek naročila (Zaloga) pove akcijo, ne le besedilo ('Odpri naročila').
// Bottom-nav: aria-current + focus ringi (stil ni edini nosilec stanja).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  const b = src.indexOf(do_, a)
  return src.slice(a, b)
}

describe('R214 — centralNavigate EN VIR (app/page.tsx)', () => {
  const src = beri('src/app/page.tsx')

  it('centralNavigate obstaja kot useCallback z (tab, more?, subTab?) podpisom', () => {
    expect(src).toContain('const centralNavigate = useCallback(')
    expect(src).toContain('(tab: TabId, more?: MoreTabId | null, subTab?: string | null) => {')
  })

  it('dogodek roksal:navigate hodí čez centralNavigate (brez podvojenega usmerjanja)', () => {
    expect(src).toContain(
      'centralNavigate(d.tab as TabId, (d.more ?? null) as MoreTabId | null, d.subTab ?? null)',
    )
    expect(src).toContain('}, [centralNavigate])')
  })

  it('ukazna paleta je priklopljena direktno na centralNavigate (EN VIR)', () => {
    expect(src).toContain('onNavigate={centralNavigate}')
  })

  it('STARI povrh-protokol je GONE (inline setMoreTab v palette prop)', () => {
    expect(src).not.toContain('onNavigate={(tab, more) => {')
    expect(src).not.toContain('setMoreTab(more)\n            setActiveTab')
  })

  it('whitelist + monotonski n ostajata (R213 semantika, R214 PIN)', () => {
    expect(src).toContain('const namig = subTab')
    expect(src).toContain('isMaterialSubTab(namig) ? { tab: namig, n: (prev?.n ?? 0) + 1 } : null')
    expect(src).toContain(': null,')
  })

  it('MaterialIntelligenceTab še vedno LAZY + hint prop (r212/r213 regresija)', () => {
    expect(src).toContain('initialSubTab={materialSubTab}')
    expect(src).toMatch(/const MaterialIntelligenceTab = dynamic\(/)
    expect(src).not.toContain("from '@/components/roksal/material-intelligence-tab'")
  })

  it('0 novih hex v navigacijski plasti (R213 regresija)', () => {
    const okno = oknoMed(src, '// ── Centralna navigacija', '// AR WebXR')
    expect(okno).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

describe('R214 — ukazna paleta: direktni podzavihki Materiala (command-palette.tsx)', () => {
  const src = beri('src/components/roksal/command-palette.tsx')

  it('trije podzavihki z iskrenimi oznakami in subTab vrednostmi', () => {
    expect(src).toContain(
      "{ label: 'Material — Naročila (V5)', icon: ShoppingCart, tab: 'more', more: 'material', subTab: 'orders' }",
    )
    expect(src).toContain(
      "{ label: 'Material — Dobavitelji (V5)', icon: Truck, tab: 'more', more: 'material', subTab: 'suppliers' }",
    )
    expect(src).toContain(
      "{ label: 'Material — BOM Refine (V5)', icon: Boxes, tab: 'more', more: 'material', subTab: 'bom' }",
    )
  })

  it('glavni Material vnos OSTANE brez subTab (privzeti BOM determinističen)', () => {
    expect(src).toContain("{ label: 'Material Intelligence (V5)', icon: Truck, tab: 'more', more: 'material' }")
    // subTab se pojavi natanko 3× v MORE_NAV (brez kopic)
    expect(src.match(/subTab: '/g)?.length).toBe(3)
  })

  it('NavItem + onNavigate tipa nosita MaterialSubTab (type-only uvoz, brez any)', () => {
    expect(src).toContain('subTab?: MaterialSubTab')
    expect(src).toContain('subTab?: MaterialSubTab | null) => void')
    expect(src).toContain("import type { MaterialSubTab } from '@/lib/material-sub-tab'")
  })

  it('run() posreduje subTab tretji argument (default null)', () => {
    expect(src).toContain('onNavigate(item.tab, item.more ?? null, item.subTab ?? null)')
  })

  it('hierarhija je VIDNA: pl-8 zamik + utišana ikona/napis za podzavihke', () => {
    expect(src).toContain("className={item.subTab ? 'pl-8' : undefined}")
    expect(src).toContain("item.subTab ? 'mr-2 h-4 w-4 text-roksal-amber/70' : 'mr-2 h-4 w-4 text-roksal-amber'")
    expect(src).toContain("item.subTab ? 'text-[13px] text-muted-foreground' : undefined")
  })

  it('0 novih hex v paleti (token družina)', () => {
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

describe('R214 — osnutek toast deep-link (inventory-tab.tsx)', () => {
  const src = beri('src/components/roksal/inventory-tab.tsx')

  it("toast dobi AKCIJO 'Odpri naročila' (izhod, ne le besedilo — R202 družina)", () => {
    expect(src).toContain("label: 'Odpri naročila',")
  })

  it('akcija pošlje ISTI protokol kot zvonček digest (subTab: orders, dispatch ×1 točno)', () => {
    const dispatch =
      "new CustomEvent('roksal:navigate', { detail: { tab: 'more', more: 'material', subTab: 'orders' } })"
    expect(src).toContain(dispatch)
    // šteje SAMO dispeče (komentar omeni protokol — ne šteje se)
    expect(src.match(/new CustomEvent\('roksal:navigate', \{ detail: \{ tab: 'more', more: 'material', subTab: 'orders' \} \}\)/g)?.length).toBe(1)
  })

  it('opis ohrani iskren naslednji korak (regresija R205 besedila)', () => {
    expect(src).toContain('najdeš ga v Material → Naročila. Nič še ni poslano dobavitelju.')
  })
})

describe('R214 — bottom-nav a11y (bottom-nav.tsx)', () => {
  const src = beri('src/components/roksal/bottom-nav.tsx')

  it("aria-current='page' na aktivnem zavihku (stil ni edini nosilec stanja)", () => {
    expect(src).toContain("aria-current={isActive || isMoreActive ? 'page' : undefined}")
  })

  it('focus-visible ringi na glavnih zavihkih in Več ploščicah (družina navy/40)', () => {
    expect(src.match(/focus-visible:ring-roksal-navy\/40/g)?.length).toBe(2)
    expect(src.match(/dark:focus-visible:ring-roksal-ink\/40/g)?.length).toBe(2)
  })

  it('0 novih hex (token družina)', () => {
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
