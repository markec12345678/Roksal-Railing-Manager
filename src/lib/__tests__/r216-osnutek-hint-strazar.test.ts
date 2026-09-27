// R216 — osnutek deep-link hint strazar (P1-d + P1-e, družina R213/R214/R215).
// ---------------------------------------------------------------------------
// PAČ (istovetnost): paleto ⌘K 'Nizka zaloga' klik in zvonček 'stock' klik
// pošljeta artikel prek ISTEGA protokola (roksal:navigate osnutek polje →
// page.tsx centralNavigate → InventoryTab osnutekHint prop → Osnutek dialog
// z TOČNO TIM enim artikelom). EN VIR passthrough: artikel gre iz /api/
// inventory odgovora NESPREMENJEN (vseh 6 polj) — brez ponovnega filtra,
// brez izmišljevanja (WYSIWYG, R215 'Shrani kot osnutek' vzorec).
// VARNOST: monotonski n (nov klik = nov dialog, zadnji zmaga); stale hint
// se počisti ob VSAKI drugi navigaciji (prvi vstop v Zalogo je čist);
// fail-safe: zvonček brez osnutka → navadna navigacija (pred-R216 vedenje).
// Stil (0 novih hex): dejanska zaloga v roksal-red (isti semantični pomen
// kot barvni stolpci Zaloge — barva ni edini nosilec, podnapis pove
// 'minimum'), številke tabular-nums (družina R138 števcev).
// Lib zaloga-povzetek, BOM/pricing/geometry core: nedotaknjeni (samo TIP
// uvoz). Brez sheme/migracij.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

/** Odsek med dvema zaznamkoma (družina r214). */
function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  const b = src.indexOf(do_, a)
  return src.slice(a, b)
}

describe('R216 — page.tsx: centralNavigate osnutek hint (protokolni center)', () => {
  const src = beri('src/app/page.tsx')

  it('centralNavigate sprejme četrti argument osnutek (ZalogaArtikelZaNarocilo | null)', () => {
    expect(src).toContain(
      '(tab: TabId, more?: MoreTabId | null, subTab?: string | null, osnutek?: ZalogaArtikelZaNarocilo | null) => {',
    )
  })

  it('hint je nastavljen LE ob navigaciji na Zalogo Z artikelom + monotonski n', () => {
    expect(src).toContain("tab === 'inventory' && osnutek")
    expect(src).toContain('? { artikel: osnutek, n: (prev?.n ?? 0) + 1 }')
    expect(src).toContain(': null,')
  })

  it('stale hint se počisti ob VSAKI drugi navigaciji (updater vrne null)', () => {
    // updater ima vedno : null vejo — tudi 'more' in glavni zavihki počistijo
    expect(src).toMatch(/setInventoryOsnutekHint\(\(prev\) =>\s*\n\s*tab === 'inventory' && osnutek/)
  })

  it('dogodek roksal:navigate prenaša osnutek polje (4. argument)', () => {
    expect(src).toContain(
      'centralNavigate(d.tab as TabId, (d.more ?? null) as MoreTabId | null, d.subTab ?? null, d.osnutek ?? null)',
    )
    expect(src).toContain('osnutek?: ZalogaArtikelZaNarocilo | null')
  })

  it('InventoryTab dobi osnutekHint prop (EN VIR povezava)', () => {
    expect(src).toContain('<InventoryTab osnutekHint={inventoryOsnutekHint} />')
  })

  it('TIP-only uvoz iz lib zaloga-povzetek (lib NI modificiran)', () => {
    expect(src).toContain("import type { ZalogaArtikelZaNarocilo } from '@/lib/zaloga-povzetek'")
  })

  it('materialSubTab protokol (R213/R214) OSTANE nespremenjen — regresija', () => {
    expect(src).toContain('const namig = subTab')
    expect(src).toContain("isMaterialSubTab(namig) ? { tab: namig, n: (prev?.n ?? 0) + 1 } : null")
    expect(src).toContain('onNavigate={centralNavigate}')
  })

  it('0 novih hex v navigacijski plasti (R213/R214 regresija)', () => {
    const okno = oknoMed(src, '// ── Centralna navigacija', '// AR WebXR')
    expect(okno).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

describe('R216 — InventoryTab: osnutekHint prop → Osnutek dialog (deep-link)', () => {
  const src = beri('src/components/roksal/inventory-tab.tsx')

  it('InventoryTabProps z opcijskim osnutekHint { artikel, n }', () => {
    expect(src).toContain('export interface InventoryTabProps {')
    expect(src).toContain('osnutekHint?: { artikel: ZalogaArtikelZaNarocilo; n: number } | null')
    expect(src).toContain('export function InventoryTab({ osnutekHint }: InventoryTabProps) {')
  })

  it('hint effect odpre dialog z TOČNO TIM enim artikelom (passthrough)', () => {
    expect(src).toContain('if (hintArtikel) openOsnutekDialog([hintArtikel])')
    expect(src).toContain('}, [hintArtikel, hintNonce])')
  })

  it('monotonski n: hintNonce iz hinta (nov klik = nov dialog)', () => {
    expect(src).toContain('const hintNonce = osnutekHint?.n ?? 0')
  })

  it('hint pot Uporablja obstoječi openOsnutekDialog (R205 WYSIWYG EN VIR) — regresija', () => {
    // nič novega dialoga, nič novega filtra — ISTA funkcija kot R205/R215
    expect(src).toContain('function openOsnutekDialog(artikli?: readonly ZalogaArtikelZaNarocilo[]) {')
    expect(src).not.toContain('function openOsnutekDialogHin')
  })

  it('R215 toast akcija ' + "'Shrani kot osnutek'" + ' OSTANE — regresija', () => {
    expect(src).toContain("label: 'Shrani kot osnutek',")
  })

  it('0 novih hex v hint plasti (družina)', () => {
    const okno = oknoMed(src, '// R216 — props za deep-link hint', 'export function InventoryTab')
    expect(okno).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

describe('R216 — paleta ⌘K: Nizka zaloga deep-link (P1-d)', () => {
  const src = beri('src/components/roksal/command-palette.tsx')

  it('onNavigate podpis ima četrti argument osnutek', () => {
    expect(src).toContain(
      'onNavigate: (tab: TabId, more?: MoreTabId | null, subTab?: MaterialSubTab | null, osnutek?: ZalogaArtikelZaNarocilo | null) => void',
    )
  })

  it('Nizka zaloga klik pošlje VSEH 6 polj artikla (EN VIR passthrough, nič izmišljenega)', () => {
    const okno = oknoMed(src, "value={`nizka zaloga ${i.naziv}`}", 'close()')
    expect(okno).toContain("onNavigate('inventory', null, null, {")
    expect(okno).toContain('id: i.id,')
    expect(okno).toContain('sifraMateriala: i.sifraMateriala,')
    expect(okno).toContain('naziv: i.naziv,')
    expect(okno).toContain('kolicinaZaloga: i.kolicinaZaloga,')
    expect(okno).toContain('enota: i.enota,')
    expect(okno).toContain('minimalnaZaloga: i.minimalnaZaloga,')
  })

  it('tip razširjen s sifraMateriala (fetch že vrača — brez novega vira)', () => {
    expect(src).toContain('id: string; sifraMateriala: string; naziv: string; kolicinaZaloga: number; minimalnaZaloga: number; enota: string')
  })

  it('stil: dejanska zaloga roksal-red + tabular-nums (barva ni edini nosilec)', () => {
    expect(src).toMatch(/Zaloga <span className="font-medium tabular-nums text-roksal-red">\{i\.kolicinaZaloga\}<\/span>/)
    expect(src).toContain('· minimum <span className="tabular-nums">{i.minimalnaZaloga}</span>')
  })

  it('R215 skupina-pogoj OSTANE (brez lažne prazne skupine) — regresija', () => {
    // R218 PIN posodobitev: heading števec zdaj ISKREN — skupno število pod
    // minimumom (nizkaZalogaSkupaj), ne števec prikazanih top 5.
    expect(src).toContain('{nizkaZaloga.length > 0 && (')
    expect(src).toContain("countHeading('Nizka zaloga', nizkaZalogaSkupaj)")
  })

  it('0 novih hex (družina)', () => {
    const okno = oknoMed(src, '{/* R215 — nizka zaloga', '{(projects.length > 0 || searchProjectHits.length > 0) && (')
    expect(okno).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

describe('R216 — zvonček: konvergence signalcev (P1-e)', () => {
  const src = beri('src/components/roksal/notification-center.tsx')

  it('NotificationItem ima opcijski osnutek (tip iz lib — EN VIR oblike)', () => {
    expect(src).toContain('osnutek?: ZalogaArtikelZaNarocilo')
  })

  it('stock item nosi artikel (vseh 6 polj — isti objekt kot paleta)', () => {
    const okno = oknoMed(src, "id: `stock-${i.id}`", '})')
    expect(okno).toContain('osnutek: {')
    expect(okno).toContain('id: i.id,')
    expect(okno).toContain('sifraMateriala: i.sifraMateriala,')
    expect(okno).toContain('naziv: i.naziv,')
    expect(okno).toContain('kolicinaZaloga: i.kolicinaZaloga,')
    expect(okno).toContain('enota: i.enota,')
    expect(okno).toContain('minimalnaZaloga: i.minimalnaZaloga,')
  })

  it('klik stock: z osnutkom deep-link, brez → navadna navigacija (fail-safe)', () => {
    expect(src).toContain(
      "detail: item.osnutek ? { tab: 'inventory', osnutek: item.osnutek } : { tab: 'inventory' },",
    )
  })

  it('R212 orders digest OSTANE (subTab:' + "'orders'" + ') — regresija', () => {
    expect(src).toContain("window.dispatchEvent(new CustomEvent('roksal:navigate', { detail: { tab: 'more', more: 'material', subTab: 'orders' } }))")
  })

  it('R182 fail-verbose zaloga vira OSTANE (non-403 → vidna vrstica) — regresija', () => {
    expect(src).toContain("neuspeliViri.push('zaloga')")
  })

  it('stil: stock subtitle tabular-nums (družina R138 števcev)', () => {
    expect(src).toContain("${item.kind === 'stock' ? 'tabular-nums' : ''}")
  })
})

describe('R216 — higienske pravice (lib/core nedotaknjen)', () => {
  it('lib zaloga-povzetek NIMA R216 sprememb (samo TIP uvozi)', () => {
    const lib = beri('src/lib/zaloga-povzetek.ts')
    expect(lib).not.toContain('R216')
    expect(lib).toContain('export interface ZalogaArtikelZaNarocilo {')
    expect(lib).toContain('export function narociloKolicina(a: ZalogaArtikelZaNarocilo): number {')
  })

  it('lib material-sub-tab NI modificiran (R213 mikromodul ostaja)', () => {
    const lib = beri('src/lib/material-sub-tab.ts')
    expect(lib).not.toContain('R216')
  })
})
