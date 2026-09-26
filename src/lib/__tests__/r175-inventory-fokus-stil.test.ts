// R175 — refetch-on-focus za ZALOGO (inventory) + projects fail-verbose +
// EN VIR loader + stilski detajl vseh "Poskusi znova" gumbov.
// ---------------------------------------------------------------------------
// 1. P1-e (iz R174 kandidatov): refetch-on-focus za inventory — skladišče/
//    pisarna beleži premike zaloge v drugi seji; pregled razpoložljivosti
//    je zastarel do remonta. fetchData (v useEffect, nestabilna identiteta)
//    → stabilen useCallback loadAll; hook načelo: loader = EDINI vir napak.
// 2. FIX EN VIR: fetchInventory (druga, prekrivajoča funkcija z ISTO logiko)
//    izbrisana — premik artikla in gumb 'Poskusi znova' zdaj oba kličeta
//    loadAll (zaloga + projekti, enaka sporočila napak).
// 3. FIX fail-verbose: projektna veja je bila tiha (`if (projRes.ok)` brez
//    else) — dropdown premikov bi ostal prazen brez signala; zdaj toast +
//    čiščenje starega stanja (nikoli starega kot svežega).
// 4. Render vrata `loading && inventory.length === 0` (vzorec termini-card
//    R170) — osvežitev ob fokusu ne utripa skeletov nad seznamom; aria-busy.
// 5. STIL DETAJL: VSI error-panel gumbi 'Poskusi znova' imajo enotno povratno
//    informacijo transition-colors hover:text-roksal-ink (konvencija R172/R173)
//    — R175 dopolnila: dashboard (projekti), inclinometer (zgodovina), zaloga.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const inv = (): string =>
  readFileSync(join(process.cwd(), 'src/components/roksal/inventory-tab.tsx'), 'utf8')

const read = (f: string): string =>
  readFileSync(join(process.cwd(), 'src/components/roksal', f), 'utf8')

describe('R175 P1-e — zaloga refetch-on-focus + stabilen EN VIR loader', () => {
  it('inventory-tab importira + žiče useRefetchOnFocus(loadAll) — brez .catch (loader = EDINI vir napak)', () => {
    const src = inv()
    expect(src).toContain("import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'")
    expect(src).toMatch(/useRefetchOnFocus\(loadAll\)/)
    expect(src).not.toMatch(/useRefetchOnFocus\(\s*\(\)\s*=>\s*loadAll\(\)\.catch/)
  })

  it('loadAll je stabilen useCallback in je žičen v useEffect (initial load)', () => {
    const src = inv()
    expect(src).toMatch(/const loadAll = useCallback\(async \(\) => \{/)
    expect(src).toMatch(/useEffect\(\(\) => \{\s*\n\s*void loadAll\(\)\s*\n\s*\}, \[loadAll\]\)/)
  })

  it('fetchInventory (prekrivajoča kopija) je IZBRISANA — EN VIR RESNICE', () => {
    const src = inv()
    expect(src).not.toContain('function fetchInventory')
    expect(src).not.toContain('Zaloge ni bilo mogoče osvežiti')
    // premik artikla osveži prek EN VIR loaderja
    expect(src).toMatch(/await loadAll\(\)/)
  })

  it('fail-verbose: projektna veja NIČ tihega — else počisti projects + viden toast', () => {
    const src = inv()
    expect(src).toMatch(
      /\} else \{\s*\n\s*setProjects\(\[\]\)\s*\n\s*toast\.error\(`Seznam projektov ni bil naložen \(napaka \$\{projRes\.status\}\).`\)/,
    )
    // catch počisti TUDI projects (nikoli starega stanja kot svežega)
    expect(src).toMatch(
      /\} catch \{\s*\n\s*setInventory\(\[\]\)\s*\n\s*setProjects\(\[\]\)/,
    )
  })

  it('render vrata: loading && inventory.length === 0 (osvežitev ne utripa skeletov) + aria-busy', () => {
    const src = inv()
    expect(src).toMatch(/loading && inventory\.length === 0 \?/)
    expect(src).toMatch(/<CardContent className="p-0" aria-busy=\{loading \|\| undefined\}>/)
  })
})

describe('R175 STIL DETAJL — vsi error-panel gumbi imajo enotno hover povratno informacijo', () => {
  it.each([
    ['crm-tab.tsx', 'Ponovno naloži seznam strank'],
    ['deal-pipeline.tsx', 'Ponovno naloži prodajno ploščo'],
    ['team-tab.tsx', 'Ponovno naloži seznam ekipe'],
    ['dashboard-tab.tsx', 'Ponovno naloži projekte'],
    ['inclinometer-tab.tsx', 'Poskusi znova naložiti zgodovino nagibov'],
    ['inventory-tab.tsx', 'Ponovno naloži zalogo'],
    ['safety-tab.tsx', 'Ponovno poskusi pridobiti vremenske podatke'],
  ] as const)('%s: gumb "%s" ima transition-colors hover:text-roksal-ink', (file, label) => {
    const src = read(file)
    expect(
      src.match(
        new RegExp(
          `className="[^"]*transition-colors hover:text-roksal-ink[^"]*"\\s*\\n\\s*aria-label="${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`,
        ),
      ),
      `${file}: ${label}`,
    ).not.toBeNull()
  })
})
