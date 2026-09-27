// R220 — 'na minimumu' kot DRUGI whitelist vnos (P1-f razširitev NA
// pripravljenem mestu — lib inventory-filter je to mesto že ob R219
// dokumentiral) + cross-tab sinhronizacija zgodovine iskanja (P1-e ostanek).
//
// Prej: Zaloga je poznala SAMO čip 'pod minimumom' (<=); artikli TOČNO na
// minimumu (===) so bili videti samo kot del širše rdeče množice, čeprav
// odgovarjajo drugačnemu vprašanju ('kaj pade pod minimum ob NASLEDNJI
// porabi?'). Paleta ⌘K je imela za to vprašanje NIČ vrstic. In zgodovina
// iskanja v paleti DRUGEGA zavihka je ostala stale (writeRecent obvesti
// samo isti tab — 'storage' dogodek nihče ni poslušal).
//
// Zdaj: drugi whitelist vnos 'na-minimumu' (EN VIR lib), drugi čip 'Na
// minimumu' v Zalogi (medsebojno izključen s 'pod' — vsak čipov iskren
// števec pove TOČNO kar prikaže), 'Na minimumu' vrstica v paleti (iskren
// števec iz ISTIH podatkov, slovenske oblike prek EN VIR
// zalogaPovzetekBeseda) in 'storage' poslušalec v subscribeRecent
// (tuji tab osveži zgodovino; tuji ključi ignorirani — deterministično).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { INVENTORY_FILTERS, isInventoryFilter } from '@/lib/inventory-filter'
import { zalogaPovzetekBeseda } from '@/lib/zaloga-povzetek'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

describe('R220 — isInventoryFilter: drugi whitelist vnos (fail-closed ostaja)', () => {
  it('obe podprti vrednosti', () => {
    expect(isInventoryFilter('pod-minimumom')).toBe(true)
    expect(isInventoryFilter('na-minimumu')).toBe(true)
  })

  it('neznane vrednosti ostanejo zavržene (whitelist — brez proizvoljnih nizov)', () => {
    expect(isInventoryFilter('NA-MINIMUMU')).toBe(false)
    expect(isInventoryFilter('na-minimum')).toBe(false)
    expect(isInventoryFilter('naminimumu')).toBe(false)
    expect(isInventoryFilter('na minimumu')).toBe(false)
    expect(isInventoryFilter('vse')).toBe(false)
  })

  it('prazen/undefined/null = brez namiga', () => {
    expect(isInventoryFilter('')).toBe(false)
    expect(isInventoryFilter(undefined)).toBe(false)
    expect(isInventoryFilter(null)).toBe(false)
  })

  it('whitelist je TRIČLEN — vrstni red stabilen (pod prej, na potem, brez-dobavitelja nazadnje — R221)', () => {
    expect([...INVENTORY_FILTERS]).toEqual(['pod-minimumom', 'na-minimumu', 'brez-dobavitelja'])
  })
})

describe("R220 — Zaloga: čip 'Na minimumu' (inventory-tab.tsx)", () => {
  const src = beri('src/components/roksal/inventory-tab.tsx')

  it("drugi čip: aria-pressed + iskren aria-label s števcem + 'klik za izklop'", () => {
    expect(src).toContain('aria-pressed={naMinOnly}')
    expect(src).toContain('Pokaži samo artikle na minimalni zalogi')
    expect(src).toContain('klik za izklop')
  })

  it('medsebojna izključnost v OBEH onClick (klik poniža sorojenega)', () => {
    expect(src).toContain('onClick={() => { setPodMinOnly((v) => !v); setNaMinOnly(false); setBrezDobaviteljaOnly(false) }}')
    expect(src).toContain('onClick={() => { setNaMinOnly((v) => !v); setPodMinOnly(false); setBrezDobaviteljaOnly(false) }}')
  })

  it('filtered = TRI vejice (pod <= → na === → ves tip); porabniki spoštujejo', () => {
    expect(src).toContain('const filtered = podMinOnly')
    expect(src).toContain(': naMinOnly')
    expect(src).toContain('? typeFiltered.filter((item) => item.kolicinaZaloga === item.minimalnaZaloga)')
  })

  it('iskren števec naMinCount ZNOTRAJ filtra tipa (ISTI vzorec kot R219)', () => {
    expect(src).toContain('const naMinCount = typeFiltered.filter(')
    expect(src).toContain('(item) => item.kolicinaZaloga === item.minimalnaZaloga,')
  })

  it('title pove resnico meje (=== — ožja od <=)', () => {
    expect(src).toContain('Pokaži samo artikle, katerih zaloga je točno na minimumu')
  })

  it('iskreno prazno stanje PER čip (ne generično)', () => {
    expect(src).toContain('Ni artiklov pod minimalno zalogo v izbranem tipu')
    expect(src).toContain('Ni artiklov točno na minimalni zalogi v izbranem tipu')
  })

  it('0 novih hex (token družina — regresija R214–R219)', () => {
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

describe("R220 — paleta: 'Na minimumu' vrstica (command-palette.tsx)", () => {
  const src = beri('src/components/roksal/command-palette.tsx')

  it('iskren števec iz ISTIH podatkov (tretja izpeljanka ENEGA fetcha)', () => {
    expect(src).toContain('const [naMinimumuSkupaj, setNaMinimumuSkupaj] = useState(0)')
    expect(src).toContain('const na = zalogaArr.filter((i) => i.kolicinaZaloga === i.minimalnaZaloga)')
    expect(src).toContain('setNaMinimumuSkupaj(na.length)')
  })

  it('vrstica: vidna LE ko > 0, R214 hierarhija (pl-8 + tabular-nums)', () => {
    expect(src).toContain('{naMinimumuSkupaj > 0 && (')
    expect(src).toContain('value="nizka zaloga na minimumu"')
    expect(src).toContain('Na minimumu — pokaži v Zalogi')
    const zac = src.indexOf('value="nizka zaloga na minimumu"')
    const okno = src.slice(zac, src.indexOf('</CommandItem>', zac))
    expect(okno).toContain('className="pl-8"')
    expect(okno).toContain('tabular-nums')
  })

  it("klik → deep-link z namigom 'na-minimumu' (peti argument — R219 protokol)", () => {
    expect(src).toContain("onNavigate('inventory', null, null, null, 'na-minimumu')")
  })

  it('slovenske besedne oblike prek EN VIR zalogaPovzetekBeseda (nominativ v oklepaju)', () => {
    expect(src).toContain('${zalogaPovzetekBeseda(naMinimumuSkupaj)}')
  })

  it('0 novih hex v paleti (regresija tokenov)', () => {
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

describe("R220 — cross-tab zgodovina: 'storage' poslušalec (P1-e ostanek)", () => {
  const src = beri('src/components/roksal/command-palette.tsx')
  const zac = src.indexOf('function subscribeRecent')
  const okno = src.slice(zac, src.indexOf('function getRecentSnapshot', zac))

  it('subscribeRecent posluša storage; tuji ključi ignorirani (deterministično)', () => {
    expect(okno).toContain("window.addEventListener('storage', onStorage)")
    expect(okno).toContain('if (e.key !== null && e.key !== RECENT_KEY) return')
  })

  it('RECENT_KEY + clear (null) vsilita svežo branje + obvestila (stale zgodovina v tujem tabu NIČ več)', () => {
    expect(okno).toContain('recentCache = null')
    expect(okno).toContain('onChange()')
  })

  it('unsubscribe odstrani poslušalca (brez puščanja poslušalcev)', () => {
    expect(okno).toContain("window.removeEventListener('storage', onStorage)")
  })

  it('writeRecent notifikator OSTANE (isti tab — regresija R218 merilne lekcije)', () => {
    expect(src).toContain('recentListeners.forEach((l) => l())')
  })
})

describe('R220 — slovenske oblike (EN VIR zalogaPovzetekBeseda — regresija)', () => {
  it('prave oblike za vse števce', () => {
    expect(zalogaPovzetekBeseda(1)).toBe('artikel')
    expect(zalogaPovzetekBeseda(2)).toBe('artikla')
    expect(zalogaPovzetekBeseda(3)).toBe('artikli')
    expect(zalogaPovzetekBeseda(5)).toBe('artiklov')
  })
})
