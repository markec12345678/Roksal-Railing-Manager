// R215 — ⌘K paleta 'Nizka zaloga' skupina (center ukazov) + R204 naročilnica
// toast akcija 'Shrani kot osnutek' + top-bar focus ring + FAB menu struktura.
//
// Prej: paleta je bila navigacija brez podatkovne zavesti (nizka zaloga je
// videla LE zvonček), naročilnica R204 je kopirala besedilo BREZ sledi in
// ponudbe za sledljivost (osnutek je bil ločen klik), FAB je imel
// aria-haspopup="menu" brez pravega menu strukture, iskalnik gumb pa brez
// focus ringa (sorojenci so ga imeli). Zdaj: ENA prijava podatkov ob odprtju
// (Promise.all vzporedno), skupina vidna LE ko nizka zaloga OBSTAJA (brez
// lažne prazne skupine), toast akcija pošlje TOČNO iste artikle v R205 dialog
// (WYSIWYG), menu struktura = struktura, focus ringi = družina.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

describe('R215 — ⌘K paleta Nizka zaloga skupina (command-palette.tsx)', () => {
  const src = beri('src/components/roksal/command-palette.tsx')

  it('fetch ob odprtju je ZDAJ Promise.all (projects + inventory, ENA runda)', () => {
    expect(src).toContain("fetch('/api/projects').then((r) => (r.ok ? r.json() : []))")
    expect(src).toContain("fetch('/api/inventory').then((r) => (r.ok ? r.json() : []))")
    expect(src).toContain('Promise.all([')
  })

  it('izpeljanka iz REALNIH podatkov: kolicinaZaloga <= minimalnaZaloga, top 5', () => {
    expect(src).toContain('zalogaArr.filter((i) => i.kolicinaZaloga <= i.minimalnaZaloga).slice(0, 5)')
  })

  it('skupina vidna LE ko nizka zaloga obstaja (brez lažne prazne skupine)', () => {
    expect(src).toContain('{nizkaZaloga.length > 0 && (')
    expect(src).toContain("countHeading('Nizka zaloga', nizkaZaloga.length)")
  })

  it('klik → Zaloga prek EN VIR onNavigate + close (isti vzorec kot Material search)', () => {
    expect(src).toContain("onNavigate('inventory')")
  })

  it('iskren podnapis: Zaloga X enota · minimum Y (dobrežni podatki, brez sklanjatev)', () => {
    expect(src).toContain('Zaloga {i.kolicinaZaloga} {i.enota} · minimum {i.minimalnaZaloga}')
  })

  it('cancelled flag ohranjen (brez setState po unmountu — regresija R138 vzorca)', () => {
    expect(src).toContain('if (cancelled) return')
  })

  it('0 novih hex v paleti (token družina — regresija R214)', () => {
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

describe('R215 — R204 naročilnica toast akcija (inventory-tab.tsx)', () => {
  const src = beri('src/components/roksal/inventory-tab.tsx')

  it("toast dobi akcijo 'Shrani kot osnutek' (izhod iz kopiranja → sledljivost)", () => {
    expect(src).toContain("label: 'Shrani kot osnutek',")
  })

  it('akcija pošlje TOČNO kopirane artikle (WYSIWYG — openOsnutekDialog(artikli))', () => {
    expect(src).toContain('onClick: () => openOsnutekDialog(artikli)')
  })

  it('openOsnutekDialog sprejme opcijske artikle; brez njih derivira iz filtered (regresija R205)', () => {
    expect(src).toContain('function openOsnutekDialog(artikli?: readonly ZalogaArtikelZaNarocilo[]) {')
    expect(src).toContain('? [...artikli]')
    expect(src).toContain(': filtered.filter((i) => i.kolicinaZaloga <= i.minimalnaZaloga)')
  })

  it('Osnutek gumb kliče BREZ args (MouseEvent ni artikel — tsc zaščita)', () => {
    expect(src).toContain('onClick={() => openOsnutekDialog()}')
  })

  it('iskren opis ostane (prilepi v e-pošto/SMS — regresija R204 besedila)', () => {
    expect(src).toContain('prilepi v e-pošto/SMS dobavitelju.')
  })

  it("R214 deep-link akcija 'Odpri naročila' ŠE VEDNO prisotna (regresija)", () => {
    expect(src).toContain("label: 'Odpri naročila',")
  })
})

describe('R215 — FAB menu struktura (quick-actions-fab.tsx)', () => {
  const src = beri('src/components/roksal/quick-actions-fab.tsx')

  it('role="menu" vsebnik z aria-label (aria-haspopup ima cilj)', () => {
    expect(src).toContain('role="menu"')
    expect(src).toContain('aria-label="Hitre akcije"')
  })

  it('role="menuitem" na akcijah v JSX (ACTIONS.map — poleg omembe v komentarju)', () => {
    // točen JSX vzorec (type="button" + role skupaj v motion.button)
    expect(src).toContain('type="button"\n                    role="menuitem"')
  })

  it('focus ringi akcij ostanejo (družina navy/40 — regresija)', () => {
    expect(src).toContain('focus-visible:ring-roksal-navy/40')
  })

  it('0 novih hex v FAB (token družina)', () => {
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

describe('R215 — top-bar focus ring (top-bar.tsx)', () => {
  const src = beri('src/components/roksal/top-bar.tsx')

  it('iskalnik gumb ima focus-visible ring (družina white/60 — sorojenci)', () => {
    const vrstica = src.split('\n').find((l) => l.includes('aria-label="Odpri iskalnik'))
    const prejsnja = src
      .split('\n')
      .filter((l) => l.includes('focus-visible:ring-white/60'))
    expect(vrstica).toBeDefined()
    expect(prejsnja.length).toBeGreaterThanOrEqual(3)
  })

  it('0 NOVIH hex (predobstoječi #2a3f5f gradient iz prejšnjih rund ostaja edini)', () => {
    const novi = (src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).filter((h) => h !== '#2a3f5f')
    expect(novi).toEqual([])
  })
})
