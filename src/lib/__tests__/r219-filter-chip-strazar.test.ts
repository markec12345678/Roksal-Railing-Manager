// R219 — 'pod minimumom' filter chip (P1-f zaključek) + zvonček digest kot
// PETI signalec konvergence (P1-e).
//
// Prej: paleta ⌘K 'Vse' vrstica (R218) je obljubila 'Pokaži vse s nizko zalogo
// v Zalogi', a je nosila SAMO navadno navigacijo — uporabnik je v Zalogi moral
// sam prepoznati, kateri artikli so pod minimumom (obljuba brez izpolnitve).
// Zvončkove stock vrstice so bile edini signalec konvergence BREZ badgea.
// Zdaj: EN VIR lib inventory-filter (whitelist + tip namiga), centralNavigate
// peti argument filter (monotonski n + počistitev — ISTI protokol kot osnutek
// R216), čip v Zalogi (dvostopenjsko filtriranje — vsi porabniki 'vidnih
// artiklov' ga spoštujejo) in BadgeNizkaZaloga EN VIR (paleta + zvonček =
// ISTI vizual, ENA definicija).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { INVENTORY_FILTERS, isInventoryFilter } from '@/lib/inventory-filter'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

describe('R219 — isInventoryFilter (EN VIR whitelist, fail-closed)', () => {
  it('podprta vrednost: pod-minimumom', () => {
    expect(isInventoryFilter('pod-minimumom')).toBe(true)
  })

  it('neznan niz = brez namiga (NE napaka — whitelist)', () => {
    expect(isInventoryFilter('vse')).toBe(false)
    expect(isInventoryFilter('POD-MINIMUMOM')).toBe(false)
    expect(isInventoryFilter('pod-minimum')).toBe(false)
    expect(isInventoryFilter(' osnos')).toBe(false)
  })

  it('prazen/undefined/null = brez namiga', () => {
    expect(isInventoryFilter('')).toBe(false)
    expect(isInventoryFilter(undefined)).toBe(false)
    expect(isInventoryFilter(null)).toBe(false)
  })

  it('whitelist je TRIČLEN (R220 drugi + R221 tretji vnos uporabila TO pripravljeno mesto — nikjer drugje)', () => {
    expect(INVENTORY_FILTERS).toEqual(['pod-minimumom', 'na-minimumu', 'brez-dobavitelja'])
  })

  it('type guard zoži tip (posledica whitelist implementacije)', () => {
    const vhod: string | null = 'pod-minimumom'
    if (isInventoryFilter(vhod)) {
      // TS: vhod je zdaj InventoryFilterHint — runtime samo potrditev
      expect(vhod).toBe('pod-minimumom')
    } else {
      throw new Error('guard ni zožil')
    }
  })
})

describe("R219 — page.tsx: centralNavigate peti argument filter + počistitev", () => {
  const src = beri('src/app/page.tsx')

  it('EN VIR lib uvožen (guard + OBA tipa)', () => {
    expect(src).toContain("import { isInventoryFilter, type InventoryFilterHint, type InventoryFilterNamig } from '@/lib/inventory-filter'")
  })

  it('centralNavigate podpis nosi peti argument filter', () => {
    expect(src).toContain("filter?: InventoryFilterHint | null")
  })

  it('filter hint state: monotonski n (zadnji klik zmaga — ISTI vzorec kot osnutek)', () => {
    expect(src).toContain('const [inventoryFilterNamig, setInventoryFilterNamig] = useState<InventoryFilterNamig | null>(null)')
    expect(src).toContain('{ filter: namigFiltra, n: (prev?.n ?? 0) + 1 }')
  })

  it('whitelist guard v updatu (neznan niz iz dogodka = brez namiga)', () => {
    expect(src).toContain('tab === \'inventory\' && isInventoryFilter(namigFiltra)')
  })

  it('počistitev ob vsaki drugi navigaciji (stale čip nikoli ne preseneti)', () => {
    const zac = src.indexOf('setInventoryFilterNamig((prev) =>')
    const okno = src.slice(zac, src.indexOf('if (tab === \'more\' && more)', zac))
    expect(okno).toContain(': null,')
  })

  it('dogodek roksal:navigate podaja filter skozi ISTO funkcijo (EN VIR usmerjanja R214)', () => {
    expect(src).toContain('filter?: string | null')
    expect(src).toContain('(d.filter ?? null) as InventoryFilterHint | null')
  })

  it('InventoryTab dobi OBA hinta (passthrough — brez dvojne resnice)', () => {
    expect(src).toContain('<InventoryTab osnutekHint={inventoryOsnutekHint} filterHint={inventoryFilterNamig} />')
  })
})

describe("R219 — paleta: 'Vse' vrstica nosi filter (command-palette.tsx)", () => {
  const src = beri('src/components/roksal/command-palette.tsx')

  it('tip InventoryFilterHint uvožen (peti argument onNavigate)', () => {
    expect(src).toContain("import type { InventoryFilterHint } from '@/lib/inventory-filter'")
    expect(src).toContain('filter?: InventoryFilterHint | null')
  })

  it("'Vse' klik → peti argument 'pod-minimumom' (deep-link z namigom)", () => {
    expect(src).toContain("onNavigate('inventory', null, null, null, 'pod-minimumom')")
  })
})

describe('R219 — Zaloga: čip + dvostopenjsko filtriranje (inventory-tab.tsx)', () => {
  const src = beri('src/components/roksal/inventory-tab.tsx')

  it('props: filterHint (opcijski, tip InventoryFilterNamig)', () => {
    expect(src).toContain('filterHint?: InventoryFilterNamig | null')
    expect(src).toContain('({ osnutekHint, filterHint }: InventoryTabProps)')
  })

  it("effect preslika namig na PRAVI čip (R220); počistitev (null) še VEDNO ne ugasne ničesar (namig ≠ lastništvo — R216 vzorec)", () => {
    expect(src).toContain('const hintFilter = filterHint?.filter ?? null')
    expect(src).toContain('const hintFilterNonce = filterHint?.n ?? 0')
    const zac = src.indexOf('const hintFilter = filterHint?.filter ?? null')
    const okno = src.slice(zac, src.indexOf('// R205 — shrani osnutek', zac))
    // R220 — namig 'na-minimumu' prižge drugi čip in ugasne sorojenega
    // (deep-link obljubi TOČNO ta pogled — medsebojna izključnost);
    // 'pod-minimumom' namig obratno. Počistitev (null) NE ugasne ničesar.
    expect(okno).toContain("if (hintFilter === 'na-minimumu') {")
    expect(okno).toContain('setNaMinOnly(true)')
    expect(okno).toContain('setPodMinOnly(false) // medsebojna izključnost — NE počistitev namiga')
    expect(okno).toContain('} else if (hintFilter) {')
    expect(okno).toContain('setNaMinOnly(false)')
    expect(okno).toContain('[hintFilter, hintFilterNonce]')
    expect(okno).not.toContain('if (!hintFilter)')
  })

  it('dvostopenjsko filtriranje: filtered = KONČNO vidna množica (vsi porabniki spoštujejo čip)', () => {
    expect(src).toContain("const typeFiltered = filter === 'ALL'")
    expect(src).toContain('const filtered = podMinOnly')
    expect(src).toContain('? typeFiltered.filter((item) => item.kolicinaZaloga <= item.minimalnaZaloga)')
    // stara enostopenjska derivacija NI več (preimenujena v typeFiltered)
    expect(src).not.toContain("const filtered = filter === 'ALL'")
  })

  it('iskren števec na čipu: ZNOTRAJ filtra tipa (ne celotna zaloga)', () => {
    expect(src).toContain('const podMinCount = typeFiltered.filter(')
  })

  it("čip = pravi toggle: aria-pressed + iskren aria-label s števcem (R220 — klik poniža sorojenega)", () => {
    expect(src).toContain('aria-pressed={podMinOnly}')
    expect(src).toContain('Pokaži samo artikle pod minimalno zalogo')
    expect(src).toContain('klik za izklop')
    expect(src).toContain('onClick={() => { setPodMinOnly((v) => !v); setNaMinOnly(false); setBrezDobaviteljaOnly(false) }}')
  })

  it('čip stil: roksal-red družina ko aktiven (barva ni edini nosilec — števec + tekst)', () => {
    expect(src).toContain("'border-roksal-red/30 bg-roksal-red/10 text-roksal-red'")
    expect(src).toContain('ml-1 tabular-nums font-semibold')
  })

  it('title pove resnico meje (<= — ISTA semantika kot R215/R217)', () => {
    expect(src).toContain('Pokaži samo artikle, katerih zaloga je pod ali na minimumu')
  })

  it('0 novih hex v InventoryTab (token družina — regresija R214–R218)', () => {
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

describe('R219 — build-prepare: seed dobi razrešen DATABASE_URL (F0 local-build fix)', () => {
  const src = beri('prisma/build-prepare.cjs')

  it('seed korak dobi ISTI URL kot migrate deploy (ISTO pravilo, ISTI vir)', () => {
    expect(src).toContain("run('bunx prisma migrate deploy', { DATABASE_URL: url })")
    expect(src).toContain("run('node prisma/seed.cjs', { DATABASE_URL: url })")
    // stari pokvarjeni klic (brez env) NE obstaja več
    expect(src).not.toContain("run('node prisma/seed.cjs')")
  })

  it('SEED_ON_DEPLOY=false ohranjen (izklop ostaja determinističen)', () => {
    expect(src).toContain("process.env.SEED_ON_DEPLOY !== 'false'")
  })
})

describe('R219 — BadgeNizkaZaloga EN VIR + zvonček digest = 5. signalec', () => {
  const badge = beri('src/components/roksal/badge-nizka-zaloga.tsx')
  const zvoncek = beri('src/components/roksal/notification-center.tsx')
  const paleta = beri('src/components/roksal/command-palette.tsx')
  const vsebnik = beri('src/components/roksal/inventory-tab.tsx')

  it('ENA definicija BADGE komponente (v celotni kodni bazi; čip je toggle — lastne razrede, ISTA roksal-red družina)', () => {
    // badge = marker — njegov TOČEN razredni niz obstaja TOČNO ENKRAT
    const badgeRazredi =
      'ml-1.5 shrink-0 rounded border border-roksal-red/30 bg-roksal-red/10 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-roksal-red'
    expect(badge).toContain(badgeRazredi)
    expect(zvoncek).not.toContain(badgeRazredi)
    expect(paleta).not.toContain(badgeRazredi)
    expect(vsebnik).not.toContain(badgeRazredi)
    // badge nosi dobeseden tekst (barva ni edini nosilec)
    expect(badge).toContain('Nizka zaloga')
    // čip = toggle z LASTNO podobo (rounded-full pill) — ista SEMANTIČNA
    // družina (roksal-red obroba/površina/tekst), ne klon badgea
    expect(vsebnik).toContain("'border-roksal-red/30 bg-roksal-red/10 text-roksal-red'")
  })

  it('zvonček: stock vrstica nosi badge (ISTI vizual kot paleta)', () => {
    expect(zvoncek).toContain("import { BadgeNizkaZaloga } from '@/components/roksal/badge-nizka-zaloga'")
    expect(zvoncek).toContain("{item.kind === 'stock' && <BadgeNizkaZaloga />}")
  })

  it('zvonček: 0 novih hex (regresija tokenov)', () => {
    expect(zvoncek).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('badge komponenta: brez novih hex, brez state (čist vizualni nosilec)', () => {
    expect(badge).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(badge).not.toContain('useState')
    expect(badge).toContain('export function BadgeNizkaZaloga()')
  })
})
