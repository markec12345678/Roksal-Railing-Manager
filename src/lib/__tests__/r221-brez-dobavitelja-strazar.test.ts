// R221 — 'brez dobavitelja' kot TRETJI whitelist vnos (P1-f razširitev NA
// pripravljenem mestu — lib inventory-filter to mesto že od R219 dokumentira
// kot edino točko razširitve) + [Mandatory] stil: tretji čip v roksal-amber
// družini (DRUGA dimenzija — nabavna pripravljenost; rdeča ostane rezervirana
// nizki zalogi; barva ni edini nosilec — dobeseden tekst + iskren števec).
//
// Prej: Zaloga je poznala dva čipa nizke zaloge (pod <= in na ===). Artikli
// brez VPISANE cene pri katerem koli dobavitelju (MaterialPrice števec === 0)
// so bili nevidni — naročilni tok (osnutek R205) bi jih ponasel s ceno 0, pa
// jih nihče ni opazil. Paleta ⌘K je za to vprašanje imela NIČ vrstic.
//
// Zdaj: tretji whitelist vnos 'brez-dobavitelja' (EN VIR lib), tretji čip
// 'Brez dobavitelja' v Zalogi (medsebojno izključen z obema sorojencema —
// ENA leča na enkrat, vsak čipov iskren števec pove TOČNO kar prikaže),
// lastna skupina 'Brez dobavitelja' v paleti (iskren števec iz ISTIH
// podatkov, slovenske oblike prek EN VIR zalogaPovzetekBeseda, deep-link
// peti argument R219/R220 protokola) in iskreno prazno stanje per čip.
// STROGOST brez izmišljevanja: manjkajoči števec (stari predpomnjeni
// odgovor) NIKOLI ni 'brez dobavitelja' — le izrecna 0 (fail-closed).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { INVENTORY_FILTERS, isInventoryFilter } from '@/lib/inventory-filter'
import { zalogaPovzetekBeseda } from '@/lib/zaloga-povzetek'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

describe('R221 — isInventoryFilter: tretji whitelist vnos (fail-closed ostaja)', () => {
  it('vse tri podprte vrednosti', () => {
    expect(isInventoryFilter('pod-minimumom')).toBe(true)
    expect(isInventoryFilter('na-minimumu')).toBe(true)
    expect(isInventoryFilter('brez-dobavitelja')).toBe(true)
  })

  it('near-miss vrednosti ostanejo zavržene (whitelist — brez proizvoljnih nizov)', () => {
    expect(isInventoryFilter('BREZ-DOBAVITELJA')).toBe(false)
    expect(isInventoryFilter('brez dobavitelja')).toBe(false)
    expect(isInventoryFilter('brez-dobavitelj')).toBe(false)
    expect(isInventoryFilter('dobavitelja')).toBe(false)
    expect(isInventoryFilter('brez')).toBe(false)
    expect(isInventoryFilter('brez-dobavitelja ')).toBe(false)
    expect(isInventoryFilter(' brez-dobavitelja')).toBe(false)
  })

  it('prazen/undefined/null = brez namiga', () => {
    expect(isInventoryFilter('')).toBe(false)
    expect(isInventoryFilter(undefined)).toBe(false)
    expect(isInventoryFilter(null)).toBe(false)
  })

  it('whitelist je TRIČLEN — vrstni red stabilen (pod, na, brez-dobavitelja)', () => {
    expect([...INVENTORY_FILTERS]).toEqual(['pod-minimumom', 'na-minimumu', 'brez-dobavitelja'])
  })
})

describe("R221 — Zaloga: čip 'Brez dobavitelja' (inventory-tab.tsx)", () => {
  const src = beri('src/components/roksal/inventory-tab.tsx')

  it("tretji čip: aria-pressed + iskren aria-label s števcem + 'klik za izklop'", () => {
    expect(src).toContain('aria-pressed={brezDobaviteljaOnly}')
    expect(src).toContain('Pokaži samo artikle brez vpisane dobaviteljske cene')
    expect(src).toContain('klik za izklop')
    expect(src).toContain('{brezDobaviteljaCount}')
  })

  it('iskren title — pove TOČNO kaj čip pokaže (noben dobavitelj vpisan)', () => {
    expect(src).toContain('title="Pokaži samo artikle, za katere ni vpisana cena pri nobenem dobavitelju"')
  })

  it('[Mandatory] stil — roksal-amber družina za aktivno stanje (druga dimenzija, ne nizka zaloga) + ISTI focus ring', () => {
    expect(src).toContain("brezDobaviteljaOnly\n                ? 'border-roksal-amber/40 bg-roksal-amber/10 text-roksal-amber'")
    // barva ni edini nosilec: dobeseden tekst + tabular-nums števec
    expect(src).toContain('Brez dobavitelja')
    expect(src).toContain('ml-1 tabular-nums font-semibold')
  })

  it('STROGOST: le izrecna 0 pomeni brez dobavitelja (manjkajoči števec NIKOLI — fail-closed)', () => {
    expect(src).toContain('item._count?.prices === 0')
    // prepovedana ohlapnejša izraza (lažno trdita 'brez' pri manjkajočem polju)
    expect(src).not.toContain('_count?.prices <= 0')
    expect(src).not.toContain('_count?.prices ?? 0')
  })

  it('iskren števec ZNOTRAJ filtra tipa (typeFiltered — ISTI vzorec R219/R220)', () => {
    expect(src).toContain('const brezDobaviteljaCount = typeFiltered.filter(')
  })

  it('filtered: STIRI vejice — pod (<=), na (===), brez (prices === 0), ves tip', () => {
    expect(src).toContain(': brezDobaviteljaOnly\n        ? typeFiltered.filter((item) => item._count?.prices === 0)\n        : typeFiltered')
  })

  it('medsebojna izključnost TROJCA: vsak onClick poniža oba sorojena čipa', () => {
    expect(src).toContain('onClick={() => { setPodMinOnly((v) => !v); setNaMinOnly(false); setBrezDobaviteljaOnly(false) }}')
    expect(src).toContain('onClick={() => { setNaMinOnly((v) => !v); setPodMinOnly(false); setBrezDobaviteljaOnly(false) }}')
    expect(src).toContain('onClick={() => { setBrezDobaviteljaOnly((v) => !v); setPodMinOnly(false); setNaMinOnly(false) }}')
  })

  it('iskreno prazno stanje tudi za tretji čip (pove KATERI filter je prazen)', () => {
    expect(src).toContain('Ni artiklov brez vpisane dobaviteljske cene v izbranem tipu')
  })

  it('[Mandatory] stil — prazna stanja per čip v EmptyState družini (pod/na privzeti ton, brez amber + PackageX)', () => {
    expect(src).toContain('icon={Package}\n              title="Ni artiklov pod minimalno zalogo v izbranem tipu"')
    expect(src).toContain('icon={Package}\n              title="Ni artiklov točno na minimalni zalogi v izbranem tipu"')
    expect(src).toContain('icon={PackageX}\n              tone="amber"\n              title="Ni artiklov brez vpisane dobaviteljske cene v izbranem tipu"')
  })

  it('hint effect: veja brez-dobavitelja prižge tretjega + ugasne OBA sorojena (in obratno)', () => {
    expect(src).toContain("if (hintFilter === 'na-minimumu') {\n      setNaMinOnly(true)\n      setPodMinOnly(false) // medsebojna izključnost — NE počistitev namiga\n      setBrezDobaviteljaOnly(false)")
    expect(src).toContain("} else if (hintFilter === 'brez-dobavitelja') {\n      setBrezDobaviteljaOnly(true)\n      setPodMinOnly(false) // medsebojna izključnost — NE počistitev namiga\n      setNaMinOnly(false)")
    expect(src).toContain("} else if (hintFilter) {\n      setPodMinOnly(true)\n      setNaMinOnly(false)\n      setBrezDobaviteljaOnly(false)")
  })

  it('WYSIWYG porabniki ostanejo na KONČNI množici filtered (CSV / Naročilnica / Osnutek ne obidejo čipa)', () => {
    expect(src).toContain('Izvoženih ${filtered.length} artiklov v CSV.')
    expect(src).toContain('filtered.filter((i) => i.kolicinaZaloga <= i.minimalnaZaloga),')
    expect(src).toContain(': filtered.filter((i) => i.kolicinaZaloga <= i.minimalnaZaloga)')
  })
})

describe('R221 — paleta ⌘K: lastna skupina Brez dobavitelja (command-palette.tsx)', () => {
  const src = beri('src/components/roksal/command-palette.tsx')

  it('izpeljanka iz ISTEGA fetcha (brez druge zahteve) + ista strogost === 0', () => {
    expect(src).toContain('setBrezDobaviteljaSkupaj(')
    expect(src).toContain('zalogaArr.filter((i) => i._count?.prices === 0).length,')
    expect(src).not.toContain("_count?.prices ?? 0")
  })

  it('skupina vidna LE ko > 0 (nič izmišljene prazne skupine) + iskren heading s števcem', () => {
    expect(src).toContain('{brezDobaviteljaSkupaj > 0 && (')
    expect(src).toContain("countHeading('Brez dobavitelja', brezDobaviteljaSkupaj)")
  })

  it('deep-link z namigom brez-dobavitelja (peti argument — R219/R220 protokol)', () => {
    expect(src).toContain("onNavigate('inventory', null, null, null, 'brez-dobavitelja')")
  })

  it('aria-label s slovenskimi oblikami prek EN VIR zalogaPovzetekBeseda', () => {
    expect(src).toContain('aria-label={`Pokaži artikle brez vpisane dobaviteljske cene v Zalogi (${brezDobaviteljaSkupaj} ${zalogaPovzetekBeseda(brezDobaviteljaSkupaj)})`}')
  })

  it('lastna skupina (NE znotraj Nizka zaloga — iskreno grupiranje drugih dimenzij) + PackageX ikona', () => {
    expect(src).toContain("value=\"brez dobavitelja pokaži v Zalogi\"")
    expect(src).toContain('Brez dobavitelja — pokaži v Zalogi')
    expect(src).toContain('PackageX')
  })

  it('iskren števec viden v vrstici (tabular-nums)', () => {
    expect(src).toContain('{brezDobaviteljaSkupaj}\n                </span>')
  })
})

describe('R221 — /api/inventory: števec zasidranj pri dobaviteljih (route.ts)', () => {
  const src = beri('src/app/api/inventory/route.ts')

  it('_count vključuje prices (EN VIR za čip + paleto; ena runda, brez novega fetcha)', () => {
    expect(src).toContain('_count: { select: { usages: true, movements: true, prices: true } }')
  })
})

describe('R221 — page.tsx: union teče skozi obstoječi peti argument (NIČ sprememb)', () => {
  it('whitelist guard ostane EDINI vhod (isInventoryFilter — nove vrednosti avtomatsko pokrite)', () => {
    const src = beri('src/app/page.tsx')
    expect(src).toContain('isInventoryFilter')
    expect(src).toContain('InventoryFilterNamig')
  })
})

describe('R221 — slovenske oblike števca (EN VIR zalogaPovzetekBeseda)', () => {
  it('nominativ pravilen za vse n (1 artikel, 2 artikla, 3/4 artikli, 5+ artiklov)', () => {
    expect(zalogaPovzetekBeseda(0)).toBe('artiklov')
    expect(zalogaPovzetekBeseda(1)).toBe('artikel')
    expect(zalogaPovzetekBeseda(2)).toBe('artikla')
    expect(zalogaPovzetekBeseda(3)).toBe('artikli')
    expect(zalogaPovzetekBeseda(4)).toBe('artikli')
    expect(zalogaPovzetekBeseda(5)).toBe('artiklov')
    expect(zalogaPovzetekBeseda(101)).toBe('artiklov')
  })
})
