// R183 — ŽIVOSTNA DRUŽINA 16 → 18 POVRŠIN (fotografije + meritve) +
// FAIL-VERBOSE FOTKE (photo-tab) + MOUNT DVOJNI FETCH FIX (meritve)
// ---------------------------------------------------------------------------
// Motiv: foto-tab je imel STARI fail-silent vzorec (`if (res.ok)` BREZ else +
// `catch { /* ignore */ }`) — neuspelo branje = tiho PRAZEN ali ZASTAREL
// seznam fotografij (terenski delavec ne ve, da fotke manjkajo — dokazno
// gradivo!); meritve pa NISO imele refetch-on-focus niti pečata (pisarna doda
// meritev v drugi seji → terenski seznam zastarel do remonta).
// R183: fail-verbose (viden warning + 'Poskusi znova'), refetch-on-focus prek
// družinskega hooka, pečat 'Osveženo ob' = EN VIR casOznaka.
// Načela (vzorec R170/R176/R177/R181/R182):
//  1. useRefetchOnFocus (30 s vrata R170) — EN VIR loaderja (mount + fokus +
//     'Poskusi znova' + mutacije).
//  2. Pečat 'Osveženo ob' = casOznaka() — komponente NE formatirajo časa same.
//  3. tight-header klasni niz IDENTIČEN družini (hidden sm:flex + History +
//     tabular-nums + tooltip); toLocaleTimeString za pečat PREPOVEDAN.
//  4. Nikoli starega stanja kot svežega: napaka → podatki + pečat počiščena.
//  5. Meritve: izbira projekta se ob fokusu NE resetira (R176 dokumenti
//     vzorec); auto-izbira SAMO ko izbire še ni; BREZ dvojnega fetcha (prej
//     sta mount efekt IN selectedProject efekt oba pobrala meritve).
// Varnostni pas (R165/R167 nauček): vsi source grepi imajo SCOPED vzorce.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

const fotke = (): string => srcOf('src/components/roksal/photo-tab.tsx')
const meritve = (): string => srcOf('src/components/roksal/measurements-tab.tsx')

const TIGHT_HEADER_CLASS = 'className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"'
const TOOLTIP = 'title="Čas zadnje uspešne osvežitve podatkov"'
const HISTORY_ICON = /<History className="h-3 w-3 shrink-0" aria-hidden="true" \/>/
const HOOK_IMPORT = "import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'"
const CAS_IMPORT = "import { casOznaka } from '@/lib/osvezitev-fokus'"

// (R183: družinska tabela 18 površin je po R186 preseljena v kanon
// zivostna-druzina.test.ts — per-površinski opisi spodaj ostanejo.)

describe('R183 — fotografije (photo-tab): fail-verbose + živost', () => {
  it('EN VIR RESNICE: casOznaka + družinski hook + History ikona (brez lokalnega formatiranja pečata)', () => {
    const src = fotke()
    expect(src).toContain(HOOK_IMPORT)
    expect(src).toContain(CAS_IMPORT)
    expect(src).toContain('ChevronDown, Lightbulb, FileText, Send, Info, History,')
    expect(src).toContain('{casOznaka(fotkeOsvezitev)}')
    // toLocaleTimeString za PEČAT je prepovedan (EN VIR casOznaka)
    expect(src.match(/toLocaleTimeString/g)).toBeNull()
  })

  it('fail-verbose: stari tihi vzorec (`if (res.ok)` brez else + catch /* ignore */) je IZTISNJEN', () => {
    const src = fotke()
    // R183 jedro popravka: loadPhotos blok NIMA tihiga catcha (druge
    // /* ignore */ mačke v datoteki so domenske — localStorage pari ipd.)
    const loadPhotosBlok = src.match(/const loadPhotos = useCallback\(async \(\) => \{[\s\S]*?\}, \[projectId\]\)/)
    expect(loadPhotosBlok).not.toBeNull()
    expect(loadPhotosBlok![0]).not.toContain('/* ignore */')
    // ok veja: set + pečat + čiščenje napake — else veja: čiščenje podatkov + pečat null + VIDNA napaka
    // (\s je načrtno brez komentarjev — zato med-vejna (\/\/[^\n]*\n\s*)* tolma)
    expect(src).toMatch(
      /if \(res\.ok\) \{\s*\n\s*setPhotos\(await res\.json\(\)\)\s*\n\s*setFotkeOsvezitev\(new Date\(\)\)\s*\n\s*setNapakaNalaganja\(null\)\s*\n\s*\} else \{\s*\n\s*(\/\/[^\n]*\n\s*)*setPhotos\(\[\]\)\s*\n\s*(\/\/[^\n]*\n\s*)*setFotkeOsvezitev\(null\)\s*\n\s*(\/\/[^\n]*\n\s*)*setNapakaNalaganja\(/,
    )
  })

  it('pečat: set 1× ob uspehu; fail-closed 2× null (!res.ok + omrežje); napaka 2× viden + 1× čiščenje', () => {
    const src = fotke()
    expect(src).toMatch(/const \[fotkeOsvezitev, setFotkeOsvezitev\] = useState<Date \| null>\(null\)/)
    expect(src.match(/setFotkeOsvezitev\(new Date\(\)\)/g)).toHaveLength(1)
    expect(src.match(/setFotkeOsvezitev\(null\)/g)).toHaveLength(2)
    expect(src.match(/setNapakaNalaganja\(/g)).toHaveLength(3)
    expect(src.match(/setPhotos\(\[\]\)/g)).toHaveLength(2)
  })

  it('refetch-on-focus: družinski hook z ISTIM loadPhotos (EN VIR — mount + fokus + Poskusi znova)', () => {
    const src = fotke()
    expect(src).toMatch(/const loadPhotos = useCallback\(async \(\) => \{/)
    expect(src).toMatch(/useEffect\(\(\) => \{\s*\n\s*loadPhotos\(\)\s*\n\s*\}, \[loadPhotos\]\)\s*\n[\s\S]*?useRefetchOnFocus\(loadPhotos\)/)
    // fail-closed: brez projekta NI fetcha (nikoli lažnega branja)
    expect(src).toMatch(/const loadPhotos = useCallback\(async \(\) => \{\s*\n\s*if \(!projectId\) return/)
  })

  it('render: pečat v CardTitle vrstici (flex-wrap) z IDENTIČNIM klasnim nizom + tooltip', () => {
    const src = fotke()
    expect(src).toMatch(/\{fotkeOsvezitev && \(/)
    expect(src).toContain(TIGHT_HEADER_CLASS)
    expect(src).toContain(TOOLTIP)
    expect(src).toMatch(HISTORY_ICON)
    // CardTitle je flex-wrap (družina zapisnik/ponudbe R181) — brez prelivanja
    expect(src).toMatch(/<CardTitle className="flex flex-wrap items-center gap-2 text-base">\s*\n\s*<Camera/)
    expect(src).toMatch(/Osveženo ob\{' '\}\s*\n\s*<span className="tabular-nums">\{casOznaka\(fotkeOsvezitev\)\}/)
  })

  it('warning vrstica: role="alert" + Poskusi znova (ISTI loadPhotos) + hover družina — pred lažnim praznim stanjem', () => {
    const src = fotke()
    expect(src).toMatch(/\{napakaNalaganja && \(/)
    expect(src).toMatch(
      /role="alert"\s*\n\s*className="mx-6 mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-roksal-red\/30 bg-roksal-red\/5 px-3 py-2 text-\[11px\] font-semibold text-roksal-red"/,
    )
    expect(src).toContain('aria-label="Ponovno naloži fotografije"')
    expect(src).toMatch(/onClick=\{\(\) => void loadPhotos\(\)\}/)
    // hover družina (R172/R176/R182 — 9 → 10 površin)
    expect(src).toMatch(/transition-colors hover:text-roksal-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-roksal-red\/40/)
  })
})

describe('R183 — meritve (measurements-tab): refetch-on-focus + pečat + EN VIR loader', () => {
  it('EN VIR RESNICE: casOznaka + družinski hook (History že uvožen) + brez toLocaleTimeString', () => {
    const src = meritve()
    expect(src).toContain(HOOK_IMPORT)
    expect(src).toContain(CAS_IMPORT)
    expect(src).toContain('{casOznaka(meritveOsvezitev)}')
    expect(src.match(/toLocaleTimeString/g)).toBeNull()
  })

  it('EN VIR loader: stabilen loadAll (mount + fokus + isti vir) — prej nestabilen fetchData v useEffect', () => {
    const src = meritve()
    expect(src).toMatch(/const loadAll = useCallback\(async \(\) => \{/)
    expect(src).toMatch(/useEffect\(\(\) => \{\s*\n\s*void loadAll\(\)\s*\n\s*\}, \[loadAll\]\)/)
    expect(src).toMatch(/useRefetchOnFocus\(loadAll\)/)
    expect(src.match(/useRefetchOnFocus\(loadAll\)/g)).toHaveLength(1)
    // stari nestabilni vzorec je iztisnjen
    expect(src).not.toMatch(/async function fetchData\(\)/)
  })

  it('auto-izbira SAMO ko izbire še ni (sledi glavni app, sicer prvi) — izbira se ob fokusu NE resetira', () => {
    const src = meritve()
    // auto-izbira vrata + wanted logika ohranjena (runda G bug ostaja popravljen)
    expect(src).toMatch(/if \(!selectedProjectRef\.current\) \{[\s\S]*?const wanted = selectedProjectIdRef\.current[\s\S]*?wanted && projData\.some\(\(p: \{ id: string \}\) => p\.id === wanted\)[\s\S]*?setSelectedProject\(firstProjectId\)\s*\n\s*return/)
    // fokus veja pobere meritve za TRENUTNO izbrani projekt (NE firstProjectId)
    expect(src).toContain('/api/measurements?projectId=${selectedProjectRef.current}')
    // STARI DVOJNI FETCH je iztisnjen: mount veja NE pobira meritev neposredno
    expect(src).not.toContain('?projectId=${firstProjectId}')
  })

  it('pečat: set 2× (loadAll + selectedProject efekt — vzorec R177 dokumenti); fail-closed 6× null', () => {
    const src = meritve()
    expect(src).toMatch(/const \[meritveOsvezitev, setMeritveOsvezitev\] = useState<Date \| null>\(null\)/)
    expect(src.match(/setMeritveOsvezitev\(new Date\(\)\)/g)).toHaveLength(2)
    // loadAll: !projRes.ok + prazni projekti + !measRes.ok + catch (4) —
    // selectedProject efekt: !ok + catch (2) → 6
    expect(src.match(/setMeritveOsvezitev\(null\)/g)).toHaveLength(6)
  })

  it('R152 fail-verbose toasti ohranjeni v OBEH vejah (naložiti / osvežiti) + čiščenje v paru s stanjem', () => {
    const src = meritve()
    expect(src).toContain('`Projektov ni bilo mogoče naložiti (napaka ${projRes.status})`')
    expect(src).toContain('`Meritev ni bilo mogoče naložiti (napaka ${measRes.status})`')
    expect(src).toContain('`Meritev ni bilo mogoče osvežiti (napaka ${measRes.status})`')
    // vsak setMeritveOsvezitev(null) v paru s čiščenjem meritev (nikoli pečata nad starim stanjem)
    const nulls = src.split('setMeritveOsvezitev(null)').length - 1
    const clears = src.split('setMeasurements([])').length - 1
    expect(nulls).toBeGreaterThanOrEqual(6)
    expect(clears).toBeGreaterThanOrEqual(6)
  })

  it('render: pečat v flex-wrap podnaslovni vrstici glave "Meritve" z IDENTIČNIM klasnim nizom + tooltip', () => {
    const src = meritve()
    expect(src).toMatch(/<h2 className="text-xl font-bold text-roksal-ink">Meritve<\/h2>/)
    expect(src).toMatch(/<div className="flex flex-wrap items-center gap-x-2 gap-y-0\.5">\s*\n\s*<p className="text-sm text-muted-foreground">\s*\n\s*Meritve ograj/)
    expect(src).toMatch(/\{meritveOsvezitev && \(/)
    expect(src).toContain(TIGHT_HEADER_CLASS)
    expect(src).toContain(TOOLTIP)
    expect(src).toMatch(HISTORY_ICON)
    expect(src).toMatch(/Osveženo ob <span className="tabular-nums">\{casOznaka\(meritveOsvezitev\)\}/)
  })
})

// R186 konsolidacija: kumulativna družinska tabela (18 površin) preseljena v
// kanonično datoteko zivostna-druzina.test.ts (per-površinski opisi zgoraj
// ostanejo avtoriteta za SCOPED vzorce).
