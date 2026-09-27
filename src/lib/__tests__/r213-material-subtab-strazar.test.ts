// R213 — zvonček digest → direktno Naročila podzavihek (P1-h) + skupni E2E
// fetch-intercept helper (P1-g) + 'Prikaži Vse' izhod iz filter-praznega
// stanja + aria-pressed na preklopniku podzavihkov.
//
// Prej: digest klik je pristal na Material → BOM Refine (privzeti podzavihek)
// — uporabnik je moral ročno klikniti Naročila, čeprav je digest PRAVO povedal,
// da so aktivna naročila. Zdaj: roksal:navigate detail nosi subTab:'orders',
// page.tsx ga pretvori v MaterialSubTabHint { tab, n } (whitelist + monotonski
// n), MaterialIntelligenceTab preklopi tudi, ko je že montiran. EN VIR
// podzavihkov = src/lib/material-sub-tab.ts.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { isMaterialSubTab, MATERIAL_SUB_TABS } from '@/lib/material-sub-tab'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  const b = src.indexOf(do_, a)
  return src.slice(a, b)
}

describe('R213 — EN VIR podzavihkov (src/lib/material-sub-tab.ts)', () => {
  it('whitelist je TOČNO trije podzavihki (BOM Refine / Naročila / Dobavitelji)', () => {
    expect([...MATERIAL_SUB_TABS]).toEqual(['bom', 'orders', 'suppliers'])
  })

  it('isMaterialSubTab: veljavni prepozna, proizvoljni zavrne (determinizem)', () => {
    expect(isMaterialSubTab('bom')).toBe(true)
    expect(isMaterialSubTab('orders')).toBe(true)
    expect(isMaterialSubTab('suppliers')).toBe(true)
    expect(isMaterialSubTab('naročila')).toBe(false)
    expect(isMaterialSubTab('')).toBe(false)
    expect(isMaterialSubTab(null)).toBe(false)
    expect(isMaterialSubTab(undefined)).toBe(false)
    expect(isMaterialSubTab('orders ')).toBe(false) // brez podnizov/trim trikov
  })
})

describe('R213 — pošiljatelj (notification-center.tsx)', () => {
  const src = beri('src/components/roksal/notification-center.tsx')

  it('digest dispatch nosi subTab: orders (pristanek na pravem mestu)', () => {
    expect(src).toContain(
      "new CustomEvent('roksal:navigate', { detail: { tab: 'more', more: 'material', subTab: 'orders' } })",
    )
  })

  it('ostale navigacije BREZ subTab (regresija: inventory/dashboard/crm/ekipa)', () => {
    expect(src).toContain("new CustomEvent('roksal:navigate', { detail: { tab: 'inventory' } })")
    expect(src).toContain("new CustomEvent('roksal:navigate', { detail: { tab: 'dashboard' } })")
    expect(src).toContain("new CustomEvent('roksal:navigate', { detail: { tab: 'more', more: 'crm' } })")
    expect(src).toContain("new CustomEvent('roksal:navigate', { detail: { tab: 'more', more: 'ekipa' } })")
    // subTab se pošlje IZKLJUČNO v order veji (enkrat v datoteki)
    expect(src.match(/subTab: 'orders'/g)?.length).toBe(1)
  })
})

describe('R213 — usmerjevalnik (app/page.tsx)', () => {
  const src = beri('src/app/page.tsx')

  it('onNavigate bere subTab in ga pretvori v hint (whitelist + monotonski n)', () => {
    expect(src).toContain('const namig = d.subTab')
    expect(src).toContain('isMaterialSubTab(namig) ? { tab: namig, n: (prev?.n ?? 0) + 1 } : null')
  })

  it('detail tip vsebuje subTab (niz | null) — brez any', () => {
    expect(src).toContain('subTab?: string | null')
  })

  it('navadna navigacija počisti namig (null → privzeti podzavihek ob naslednjem mountu)', () => {
    // ternarna : null veja = počisti
    expect(src).toContain(': null,')
  })

  it('MaterialIntelligenceTab prejme hint kot prop; komponenta ostane LAZY dynamic import', () => {
    expect(src).toContain('initialSubTab={materialSubTab}')
    expect(src).toMatch(/const MaterialIntelligenceTab = dynamic\(/)
  })

  it('page.tsx NE uvaža komponente statično (lazy fingerprint r212 lekcija)', () => {
    expect(src).not.toContain("from '@/components/roksal/material-intelligence-tab'")
    // mikromodul je statičen (majhen, brez React odvisnosti v pomenu chunkov)
    expect(src).toContain("from '@/lib/material-sub-tab'")
  })

  it('0 novih hex v navigacijski plasti', () => {
    const okno = oknoMed(src, '// ── Centralna navigacija', '// AR WebXR')
    expect(okno).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

describe('R213 — porabnik (material-intelligence-tab.tsx)', () => {
  const src = beri('src/components/roksal/material-intelligence-tab.tsx')

  it('prop initialSubTip: začetni podzavihek iz namiga, sicer BOM (determinističen privzetek)', () => {
    expect(src).toContain('initialSubTab?: MaterialSubTabHint | null')
    expect(src).toContain("useState<MaterialSubTab>(initialSubTab?.tab ?? 'bom')")
  })

  it('effect na monotonskem n: preklopi tudi, ko je komponenta že montirana', () => {
    expect(src).toContain('const subTabNamig = initialSubTab?.tab')
    expect(src).toContain('const subTabNonce = initialSubTab?.n ?? 0')
    expect(src).toContain('if (subTabNamig) setTab(subTabNamig)')
    expect(src).toContain('}, [subTabNamig, subTabNonce])')
  })

  it('brez namiga ročna izbira ostane (null hint ne pregazi podzavihka)', () => {
    // effect prižge LE na subTabNamig — null/undefined → brez klica setTab
    expect(src).toContain('if (subTabNamig) setTab(subTabNamig)')
  })

  it('aria-pressed na VSIH treh gumbih preklopnika (stil ni edini nosilec stanja)', () => {
    expect(src).toContain("aria-pressed={tab === 'bom'}")
    expect(src).toContain("aria-pressed={tab === 'orders'}")
    expect(src).toContain("aria-pressed={tab === 'suppliers'}")
  })

  it("filter-prazno stanje ima DEJANSKI gumb 'Prikaži Vse' (izhod, ne le besedilo)", () => {
    const okno = oknoMed(
      src,
      "{vidnaNarocila.length === 0 && statusFilter !== 'VSI' ? (",
      ') : vidnaNarocila.map((order) => {',
    )
    expect(okno).toContain('Ni naročil s statusom {statusFilter}.')
    expect(okno).toContain('Izberi drug status ali prikaži Vse.')
    expect(okno).toContain("onClick={() => setStatusFilter('VSI')}")
    expect(okno).toContain('Prikaži Vse')
    // družina focus ringov (chipCls/CSV) — 0 novih hex
    expect(okno).toContain('focus-visible:ring-roksal-navy/40')
    expect(okno).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('tip-only uvoz iz mikromodula (komponenta ostane LAZY)', () => {
    expect(src).toContain("import type { MaterialSubTab, MaterialSubTabHint } from '@/lib/material-sub-tab'")
  })
})

describe('R213 — skupni E2E fetch-intercept helper (tools/e2e-fetch-intercept.js)', () => {
  const HELPER = 'tools/e2e-fetch-intercept.js'

  function pozeni(args: string[]): { stdout: string; status: number } {
    try {
      const stdout = execFileSync('node', [join(process.cwd(), HELPER), ...args], {
        encoding: 'utf8',
      })
      return { stdout, status: 0 }
    } catch (e) {
      const err = e as { status?: number; stdout?: string }
      return { stdout: err.stdout ?? '', status: err.status ?? 1 }
    }
  }

  it('patch snippet vsebuje URL del, status in sporočilo ter je veljaven JS', () => {
    const { stdout, status } = pozeni(['patch', '/api/material-orders', '500', 'R213 E2E izklop'])
    expect(status).toBe(0)
    expect(stdout).toContain('"/api/material-orders"')
    expect(stdout).toContain('{status:500}')
    expect(stdout).toContain('"R213 E2E izklop"')
    expect(() => new Function(stdout.trim())).not.toThrow()
  })

  it('patch ohranja prejšnji restore (brez ugnezdenih izgub originala)', () => {
    const { stdout } = pozeni(['patch', '/api/portal', '503', 'x'])
    expect(stdout).toContain('if(window.__e2eFetchRestore){window.__e2eFetchRestore();}')
  })

  it('restore snippet je veljaven JS in je idempotenten ("not-patched" brez patcha)', () => {
    const { stdout, status } = pozeni(['restore'])
    expect(status).toBe(0)
    expect(stdout).toContain('not-patched')
    expect(() => new Function(stdout.trim())).not.toThrow()
  })

  it('fail-closed CLI: neveljaven status / manjkajoči argumenti / neznan ukaz → exit 2', () => {
    expect(pozeni(['patch', '/api/x', '999', 'x']).status).not.toBe(0)
    expect(pozeni(['patch', '/api/x', 'abc', 'x']).status).not.toBe(0)
    expect(pozeni(['patch', '/api/x', '500']).status).not.toBe(0)
    expect(pozeni(['patch', '', '500', 'x']).status).not.toBe(0)
    expect(pozeni([]).status).not.toBe(0)
    expect(pozeni(['kvaček']).status).not.toBe(0)
  })
})
