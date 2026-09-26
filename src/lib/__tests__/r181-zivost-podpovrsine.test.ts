// R181 — ŽIVOSTNA DRUŽINA na POD-POVRŠINAH (P1-b iz R180):
// PREJEMNI ZAPISNIK (punch-list, Dokumenti tab, /api/punch) +
// POSLI V OZADJU (jobs-panel, Ekipa tab ADMIN, /api/jobs) +
// PONUDBE — SLEDENJE (quote-followup, CRM tab, /api/projects)
// ---------------------------------------------------------------------------
// Motiv: družina pečatov 'Osveženo ob' je od R180 pokrivala 11 GLAVNIH
// površin, a so tri POD-površine ostale brez živosti: (a) prejemni zapisnik
// (monter na terenu si predajo pogleda na telefonu — pisarna lahko medtem
// dodala točke kontrole), (b) register poslov (ledger je časovno odvisen:
// dnevni cron ob 03:30 UTC — ADMIN vidi zastarele zagonove do remonta),
// (c) sledenje ponudb (zapadli follow-up klic stranke = izgubljeni prihodek).
// R181 dopolni družino na vseh treh (isti vzorec, vsaka odstopitev = bug).
// Načela (vzorec R170/R177/R178/R180):
//  1. Refetch-on-focus prek DRUŽINSKEGA hooka useRefetchOnFocus (30 s vrata
//     R170) — EN VIR loaderja: isti callback kot mount + "Poskusi znova".
//  2. Pečat 'Osveženo ob' = čas zadnjega USPEŠNEGA branja primarnega vira
//     (zapisnik → /api/punch; posli → /api/jobs; ponudbe → /api/projects).
//     Napaka/omrežje → null (fail-closed pečat — NIČ lažne svežine nad
//     napako; zastarel seznam ostane viden, a BREZ pečata).
//  3. EN VIR RESNICE: casOznaka() (@/lib/osvezitev-fokus) — komponente NE
//     formatirajo časa same (toLocaleTimeString je prepovedan za pečat).
//  4. tight-header klasni niz IDENTIČEN ostalim površinam (hidden sm:flex +
//     History + tabular-nums + tooltip); pečat viden TOČKO, ko stanje != null.
// Varnostni pas (R165/R167 nauček): vsi source grepi imajo SCOPED vzorce.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

const zapisnik = (): string => srcOf('src/components/roksal/punch-list.tsx')
const posli = (): string => srcOf('src/components/roksal/jobs-panel.tsx')
const ponudbe = (): string => srcOf('src/components/roksal/quote-followup.tsx')

const TIGHT_HEADER_CLASS = 'className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"'
const TOOLTIP = 'title="Čas zadnje uspešne osvežitve podatkov"'
const HISTORY_ICON = /<History className="h-3 w-3 shrink-0" aria-hidden="true" \/>/

describe('R181 P1 — prejemni zapisnik (punch-list)', () => {
  it('EN VIR RESNICE: casOznaka iz osvezitev-fokus + History ikona (brez lokalnega formatiranja pečata)', () => {
    const src = zapisnik()
    expect(src).toContain("import { casOznaka } from '@/lib/osvezitev-fokus'")
    expect(src).toContain("import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'")
    expect(src).toMatch(/^  History,$/m)
    expect(src).toContain('{casOznaka(zapisnikOsvezitev)}')
    // PEČAT SAMO: PDF izpis uporablja toLocaleDateString (domensko formatiranje
    // datuma), toLocaleTimeString pa je za pečat prepovedan — sploh ni v datoteki
    expect(src.match(/toLocaleTimeString/g)).toBeNull()
  })

  it('refetch-on-focus: družinski hook z ISTIM fetchItems (EN VIR — mount, fokus in "Poskusi znova")', () => {
    const src = zapisnik()
    // wrapper bere projectIdRef (loader rabi projectId) — ISTI fetchItems callback
    expect(src).toMatch(/useRefetchOnFocus\(\(\) => \{\s*\n\s*const pid = projectIdRef\.current\s*\n\s*if \(pid\) void fetchItems\(pid\)\s*\n\s*\}\)/)
    expect(src).toMatch(/const fetchItems = useCallback\(async \(projectId: string\) => \{/)
    // mount efekt ostane (prvi load je klicateljev — hook poganja samo vračanja)
    expect(src).toMatch(/void fetchItems\(project\.id\)\s*\n\s*\}\s*\n\s*\}, \[project\?\.id, fetchItems\]\)\s*\n[\s\S]*?useRefetchOnFocus\(/)
    // "Poskusi znova" gumb = ISTI loader (EN VIR)
    expect(src).toMatch(/void fetchItems\(project\.id\)\s*\n\s*\}\}\s*\n\s*aria-label="Poskusi znova naložiti zapisnik"/)
  })

  it('pečat: set 1× v res.ok veji; fail-closed 2× null (!res.ok + catch) — v paru s čiščenjem seznama', () => {
    const src = zapisnik()
    expect(src).toMatch(/const \[zapisnikOsvezitev, setZapisnikOsvezitev\] = useState<Date \| null>\(null\)/)
    expect(src).toMatch(/setItems\(\(await res\.json\(\)\) as PunchItem\[\]\)\s*\n\s*\/\/ R181[^\n]*\n\s*setZapisnikOsvezitev\(new Date\(\)\)/)
    expect(src.match(/setZapisnikOsvezitev\(new Date\(\)\)/g)).toHaveLength(1)
    // 2× null: napaka strežnika (403/404) + omrežje — VSAKO v paru s setItems([])
    expect(src.match(/setZapisnikOsvezitev\(null\)/g)).toHaveLength(2)
    expect(src).toMatch(/setItems\(\[\]\)\s*\n\s*\/\/ R181[^\n]*\n\s*setZapisnikOsvezitev\(null\)/)
  })

  it('render: pečat v CardTitle glavi "Prejemni zapisnik" z IDENTIČNIM klasnim nizom + tooltip (skrit na xs)', () => {
    const src = zapisnik()
    expect(src).toMatch(/\{zapisnikOsvezitev && \(/)
    expect(src).toContain(TIGHT_HEADER_CLASS)
    expect(src).toContain(TOOLTIP)
    expect(src).toMatch(HISTORY_ICON)
    expect(src).toMatch(/Prejemni zapisnik\s*\n\s*\{zapisnikOsvezitev && \(/)
    expect(src).toMatch(/Osveženo ob\{' '\}\s*\n\s*<span className="tabular-nums">\{casOznaka\(zapisnikOsvezitev\)\}/)
  })
})

describe('R181 P1 — posli v ozadju (jobs-panel, ADMIN)', () => {
  it('EN VIR RESNICE: casOznaka iz osvezitev-fokus + History ikona (brez lokalnega formatiranja pečata)', () => {
    const src = posli()
    expect(src).toContain("import { casOznaka } from '@/lib/osvezitev-fokus'")
    expect(src).toContain("import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'")
    // lucide import je enovrstični: { History, Loader2, ... }
    expect(src).toMatch(/\{ History, Loader2, PlayCircle, RefreshCw, Timer, Wrench \} from 'lucide-react'/)
    expect(src).toContain('{casOznaka(posliOsvezitev)}')
    // dtFmt (seznam zagonov) je domensko formatiranje — NE pečat; toLocaleTimeString
    // za pečat prepovedan (dtFmt uporablja hour/minute brez sekund, za zagonove)
    expect(src.match(/toLocaleTimeString/g)).toBeNull()
  })

  it('refetch-on-focus: družinski hook z ISTIM load (EN VIR — mount, fokus, "Osveži" in runNow osvežitev)', () => {
    const src = posli()
    expect(src).toMatch(/useRefetchOnFocus\(load\)/)
    expect(src).toMatch(/const load = useCallback\(async \(\) => \{/)
    // mount efekt ostane; hook takoj za njim (družinski vzorec)
    expect(src).toMatch(/useEffect\(\(\) => \{\s*\n\s*void load\(\)\s*\n\s*\}, \[load\]\)\s*\n[\s\S]*?useRefetchOnFocus\(load\)/)
  })

  it('pečat: set 1× v res.ok veji; fail-closed 2× null (!res.ok vključno 403 + catch) — ledger brez lažne svežine', () => {
    const src = posli()
    expect(src).toMatch(/const \[posliOsvezitev, setPosliOsvezitev\] = useState<Date \| null>\(null\)/)
    expect(src).toMatch(/setData\(\{ jobs: json\?\.jobs \?\? \[\], registry: json\?\.registry \?\? \[\], retryPolicy: json\?\.retryPolicy \?\? \{ maxAttempts: 3, window: 'dan' \} \}\)\s*\n\s*\/\/ R181[^\n]*\n\s*setPosliOsvezitev\(new Date\(\)\)/)
    expect(src.match(/setPosliOsvezitev\(new Date\(\)\)/g)).toHaveLength(1)
    // 2× null: napaka strežnika (403 za MONTER = fail-closed meja) + omrežje
    expect(src.match(/setPosliOsvezitev\(null\)/g)).toHaveLength(2)
  })

  it('render: pečat v podnaslovni vrstici glave "Vzdrževanje — posli v ozadju" (flex-wrap, R171 vzorec)', () => {
    const src = posli()
    expect(src).toMatch(/\{posliOsvezitev && \(/)
    expect(src).toContain(TIGHT_HEADER_CLASS)
    expect(src).toContain(TOOLTIP)
    expect(src).toMatch(HISTORY_ICON)
    // podnaslovna vrstica je flex-wrap (brez prelivanja — R171 nauček)
    expect(src).toMatch(/Vzdrževanje — posli v ozadju<\/h3>[\s\S]{0,400}posliOsvezitev && \(/)
    expect(src).toMatch(/flex flex-wrap items-center gap-x-2 gap-y-0\.5 text-\[11px\] text-muted-foreground/)
    expect(src).toMatch(/Osveženo ob\{' '\}\s*\n\s*<span className="tabular-nums">\{casOznaka\(posliOsvezitev\)\}/)
  })
})

describe('R181 P1 — ponudbe — sledenje (quote-followup)', () => {
  it('EN VIR RESNICE: casOznaka iz osvezitev-fokus + History ikona (brez lokalnega formatiranja pečata)', () => {
    const src = ponudbe()
    expect(src).toContain("import { casOznaka } from '@/lib/osvezitev-fokus'")
    expect(src).toContain("import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'")
    expect(src).toMatch(/^  History,$/m)
    expect(src).toContain('{casOznaka(ponudbeOsvezitev)}')
    // fmt() uporablja toLocaleDateString (domenski datumi spomnikov) — PEČAT pa
    // izključno casOznaka; toLocaleTimeString je v datoteki prepovedan
    expect(src.match(/toLocaleTimeString/g)).toBeNull()
  })

  it('refetch-on-focus: družinski hook z ISTIM load (EN VIR — mount, fokus in "Poskusi znova")', () => {
    const src = ponudbe()
    expect(src).toMatch(/useRefetchOnFocus\(load\)/)
    expect(src).toMatch(/const load = useCallback\(async \(\) => \{/)
    expect(src).toMatch(/useEffect\(\(\) => \{\s*\n\s*void load\(\)\s*\n\s*\}, \[load\]\)\s*\n[\s\S]*?useRefetchOnFocus\(load\)/)
  })

  it('pečat: set 1× v uspešni veji; fail-closed 3× null (!res.ok + !Array + catch) — vse v paru s čiščenjem', () => {
    const src = ponudbe()
    expect(src).toMatch(/const \[ponudbeOsvezitev, setPonudbeOsvezitev\] = useState<Date \| null>\(null\)/)
    expect(src).toMatch(/setProjects\(all\.filter\(\(p\) => !p\.dealLocked\)\)\s*\n\s*\/\/ R181[^\n]*\n\s*setPonudbeOsvezitev\(new Date\(\)\)/)
    expect(src.match(/setPonudbeOsvezitev\(new Date\(\)\)/g)).toHaveLength(1)
    // 3× null: HTTP napaka + neveljaven odgovor + omrežje (vsi v paru s setProjects([]))
    expect(src.match(/setPonudbeOsvezitev\(null\)/g)).toHaveLength(3)
  })

  it('render: pečat v CardTitle glavi "Ponudbe — sledenje" z IDENTIČNIM klasnim nizom + tooltip (skrit na xs)', () => {
    const src = ponudbe()
    expect(src).toMatch(/\{ponudbeOsvezitev && \(/)
    expect(src).toContain(TIGHT_HEADER_CLASS)
    expect(src).toContain(TOOLTIP)
    expect(src).toMatch(HISTORY_ICON)
    expect(src).toMatch(/Ponudbe — sledenje\s*\n\s*\{ponudbeOsvezitev && \(/)
    expect(src).toMatch(/Osveženo ob\{' '\}\s*\n\s*<span className="tabular-nums">\{casOznaka\(ponudbeOsvezitev\)\}/)
  })
})

// R186 konsolidacija: kumulativna družinska tabela (3 nove pod-površine +
// skupni seznam 14) preseljena v kanonično datoteko zivostna-druzina.test.ts
// (per-površinski opisi zgoraj ostanejo avtoriteta za SCOPED vzorce).
