// R184 — telemetrija omejevanja hitrosti (R181 kandidat d, dokončan) +
// živostna družina 18 → 20 površin (omejitve + seje).
// ---------------------------------------------------------------------------
// Trije sloji (isti vzorec kot r181/r182/r183):
//  1. ČISTO JEDRO (rate-limit.ts): trip števec SAMO na zavrženem zadetku
//     (ok:false), determinističen redakciran izpis (kind + SHA-256 prstni
//     odtis — brez PII), resetRateLimit počisti tudi telemetrijo.
//  2. RUTA (/api/security/rate-limit): SAMO ADMIN (denyUnless ADMIN_ROLES),
//     odgovor z `note` (pošteno poročanje: primerek, ne global), fail-verbose
//     500 s correlationId.
//  3. POVršINE: rate-limit-panel (19. površina — ADMIN kartica, jobs-panel
//     vzorec) + sessions-dialog (20. površina — pečat v DialogDescription).
// Družina: EN VIR casOznaka + družinski hook useRefetchOnFocus (30 s vrata
// R170), tight-header klasni niz IDENTIČEN na 19 površin (Logistika =
// dokumentirana polnvrstična varianta R170).
import { describe, expect, it, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  LOGIN_LIMIT,
  checkRate,
  rateLimitDetail,
  rateLimitStats,
  releaseRate,
  resetRateLimit,
} from '../rate-limit'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

const TIGHT_HEADER_CLASS = 'className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"'
const TOOLTIP = 'title="Čas zadnje uspešne osvežitve podatkov"'
const HISTORY_ICON = /<History className="h-3 w-3 shrink-0" aria-hidden="true" \/>/
const HOOK_IMPORT = "import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'"
const CAS_IMPORT = "import { casOznaka } from '@/lib/osvezitev-fokus'"

// (R184: družinska tabela 20 površin je po R186 preseljena v kanon
// zivostna-druzina.test.ts — per-površinski opisi zgoraj ostanejo.)

describe('R184 — jedro (rate-limit.ts): trip števec + redakcija + determinizem', () => {
  beforeEach(() => resetRateLimit())

  it('trip se zabeleži SAMO ob ZAVRŽENEM zadetku (ok:false) — uspešni zadetki ne štejejo', () => {
    resetRateLimit()
    const key = 'test:1.2.3.4:a@roksal.si'
    // Polnimo do praga (vse uspešne — še ni tripov)
    for (let i = 0; i < LOGIN_LIMIT.limit; i++) {
      expect(checkRate(key, LOGIN_LIMIT).ok).toBe(true)
    }
    expect(rateLimitDetail().tripsTotal).toBe(0)
    // Naslednji = zavrnjen → trip 1
    const blocked = checkRate(key, LOGIN_LIMIT)
    expect(blocked.ok).toBe(false)
    expect(rateLimitDetail().tripsTotal).toBe(1)
    // Še en zavrnjen → trip 2 (isti ključ, števec raste)
    expect(checkRate(key, LOGIN_LIMIT).ok).toBe(false)
    expect(rateLimitDetail().tripsTotal).toBe(2)
  })

  it('releaseRate (uspešna prijava po napakah) NE briše zgodovine tripov', () => {
    const key = 'test:5.6.7.8:b@roksal.si'
    for (let i = 0; i < LOGIN_LIMIT.limit; i++) checkRate(key, LOGIN_LIMIT)
    checkRate(key, LOGIN_LIMIT) // zavrnjen → trip
    releaseRate(key) // uspeh sprosti mesto v vedru
    expect(rateLimitStats().hits).toBe(LOGIN_LIMIT.limit - 1)
    // trip ostane — blokada se je ZGODILA (zgodovina ni revizija)
    expect(rateLimitDetail().tripsTotal).toBe(1)
  })

  it('redakcija: izpis vsebuje kategorijo + 10-hex odtis, NIKOLI surovega ključa (IP/e-naslov)', () => {
    const key = 'login:203.0.113.9:tajna.osoba@roksal.si'
    for (let i = 0; i <= LOGIN_LIMIT.limit; i++) checkRate(key, LOGIN_LIMIT)
    const detail = rateLimitDetail()
    expect(detail.trips).toHaveLength(1)
    const trip = detail.trips[0]
    expect(trip.kind).toBe('login')
    expect(trip.keyHash).toMatch(/^[0-9a-f]{10}$/)
    // PII ne sme priciti v telemetrijo
    expect(trip.keyHash).not.toContain('203.0.113.9')
    expect(trip.keyHash).not.toContain('tajna.osoba')
    expect(JSON.stringify(detail)).not.toContain('203.0.113.9')
    expect(JSON.stringify(detail)).not.toContain('tajna.osoba@roksal.si')
  })

  it('determinizem: isti odtis za isti ključ (ponovni izračun), urejen izpis (count ↓)', () => {
    const keyA = 'test:10.0.0.1:a@roksal.si'
    const keyB = 'test:10.0.0.2:b@roksal.si'
    // A: 3 tripi, B: 1 trip
    for (let i = 0; i < LOGIN_LIMIT.limit; i++) checkRate(keyA, LOGIN_LIMIT)
    checkRate(keyA, LOGIN_LIMIT)
    checkRate(keyA, LOGIN_LIMIT)
    checkRate(keyA, LOGIN_LIMIT)
    for (let i = 0; i < LOGIN_LIMIT.limit; i++) checkRate(keyB, LOGIN_LIMIT)
    checkRate(keyB, LOGIN_LIMIT)
    const prvi = rateLimitDetail()
    const drugi = rateLimitDetail()
    // isti klic = isti izpis (brez naključij)
    expect(drugi.trips).toEqual(prvi.trips)
    expect(prvi.trips[0].keyHash).toBe(prvi.trips[0].keyHash)
    // A ima več tripov → prvi v urejenem seznamu
    expect(prvi.trips[0].count).toBe(3)
    expect(prvi.trips[1].count).toBe(1)
  })

  it('resetRateLimit() počisti TUDI telemetrijo (restart primerka = restart števcev)', () => {
    const key = 'test:10.0.0.3:c@roksal.si'
    for (let i = 0; i <= LOGIN_LIMIT.limit; i++) checkRate(key, LOGIN_LIMIT)
    expect(rateLimitDetail().tripsTotal).toBe(1)
    resetRateLimit()
    expect(rateLimitDetail().tripsTotal).toBe(0)
    expect(rateLimitDetail().trips).toHaveLength(0)
    expect(rateLimitStats().keys).toBe(0)
  })

  it('resetRateLimit(key) počisti samo tisti ključ (ročno odpuščanje)', () => {
    const keyA = 'test:10.0.0.4:a@roksal.si'
    const keyB = 'test:10.0.0.5:b@roksal.si'
    for (let i = 0; i < LOGIN_LIMIT.limit; i++) checkRate(keyA, LOGIN_LIMIT)
    checkRate(keyA, LOGIN_LIMIT)
    for (let i = 0; i < LOGIN_LIMIT.limit; i++) checkRate(keyB, LOGIN_LIMIT)
    checkRate(keyB, LOGIN_LIMIT)
    resetRateLimit(keyA)
    const detail = rateLimitDetail()
    expect(detail.trips).toHaveLength(1)
    expect(detail.trips[0].kind).toBe('test')
  })
})

describe('R184 — ruta /api/security/rate-limit: ADMIN-only + pošten odgovor', () => {
  const ruta = (): string => srcOf('src/app/api/security/rate-limit/route.ts')

  it('ADMIN-only vrata: denyUnless + ADMIN_ROLES (isti vzorec kot /api/jobs)', () => {
    const src = ruta()
    expect(src).toContain("import { denyUnless, ADMIN_ROLES } from '@/lib/auth'")
    expect(src).toMatch(/const denied = await denyUnless\(request, ADMIN_ROLES\)\s*\n\s*if \(denied\) return denied/)
    expect(src).toContain("import { rateLimitDetail } from '@/lib/rate-limit'")
    expect(src).toContain("export const runtime = 'nodejs'")
  })

  it('odgovor: stats + tripsTotal + trips + note (pošteno: primerek, ne global) + fail-verbose 500', () => {
    const src = ruta()
    // pošteno poročanje — note izrecno pove omejitev telemetrije
    expect(src).toContain('Števeci so v pomnilniku trenutnega primerka (serverless)')
    expect(src).toMatch(/stats: \{ keys: detail\.keys, hits: detail\.hits \}/)
    expect(src).toContain('tripsTotal: detail.tripsTotal')
    expect(src).toMatch(/trips: detail\.trips\.slice\(0, 10\)/)
    expect(src).toContain('generatedAt: new Date().toISOString()')
    // fail-verbose: 500 s correlationId (nič tihega praznega stanja)
    expect(src).toMatch(/status: 500/)
    expect(src).toContain("logWithCorrelation('security.rate-limit.error', correlationId, error)")
  })
})

describe('R184 — omejitve (rate-limit-panel): ADMIN kartica, jobs-panel vzorec + živost', () => {
  const panel = (): string => srcOf('src/components/roksal/rate-limit-panel.tsx')

  it('EN VIR RESNICE: casOznaka + družinski hook + History ikona (brez lokalnega formatiranja pečata)', () => {
    const src = panel()
    expect(src).toContain(CAS_IMPORT)
    expect(src).toContain(HOOK_IMPORT)
    expect(src).toContain('{casOznaka(omejitveOsvezitev)}')
    expect(src).toContain("useRefetchOnFocus(load)")
    // toLocaleTimeString za PEČAT je prepovedan (EN VIR casOznaka; dtFmt za
    // DOMENSKE čase blokad je dovoljen — jobs-panel vzorec)
    expect(src).toContain('dtFmt.format(new Date(t.lastAt))')
  })

  it('pečat: set 1× ob uspehu; fail-closed 2× null (!res.ok + neveljaven odgovor) + 1× omrežje', () => {
    const src = panel()
    expect(src).toMatch(/const \[omejitveOsvezitev, setOmejitveOsvezitev\] = useState<Date \| null>\(null\)/)
    expect(src.match(/setOmejitveOsvezitev\(new Date\(\)\)/g)).toHaveLength(1)
    expect(src.match(/setOmejitveOsvezitev\(null\)/g)).toHaveLength(3)
  })

  it('fail-verbose: viden error panel role="alert" + Poskusi znova (hover družina 10 → 11) — prazno stanje POGOJENO', () => {
    const src = panel()
    expect(src).toMatch(/role="alert"/)
    expect(src).toContain('Telemetrije omejevanja hitrosti ni bilo mogoče naložiti')
    expect(src).toMatch(/aria-label="Ponovno naloži telemetrijo omejevanja hitrosti"/)
    expect(src).toContain('Poskusi znova')
    // hover družina (R172/R176/R182/R183 — 10 → 11 površin)
    expect(src).toMatch(/transition-colors hover:text-roksal-ink/)
    // prazno stanje je v else veji napake (nikoli lažnega miru nad napako)
    expect(src).toMatch(/Ni zabeleženih blokad na tem primerku/)
    // 403 se pokaže s strežnikovim sporočilom (fail-verbose, nič ugibanja)
    expect(src).toMatch(/json\?\.error \?\? `Telemetrije omejevanja hitrosti ni bilo mogoče naložiti \(napaka \$\{res\.status\}\)`/)
  })

  it('render: glava + pečat (tight-header IDENTIČEN družini) + statistika + redakcija ključev', () => {
    const src = panel()
    expect(src).toContain('Vzdrževanje — omejevanje hitrosti')
    expect(src).toContain('Blokade brute-force zaščite — prijava in pisanje po API-ju.')
    expect(src).toContain(TIGHT_HEADER_CLASS)
    expect(src).toContain(TOOLTIP)
    expect(src).toMatch(HISTORY_ICON)
    expect(src).toMatch(/\{omejitveOsvezitev && \(/)
    // statistika: 3 čipi (ključi, zadetki, blokade)
    expect(src).toContain('aktivnih ključev')
    expect(src).toContain('zadetkov v oknih')
    expect(src).toContain('blokad skupaj')
    // redakcija: samo odtis, surovega ključa NI v UI
    expect(src).toContain('t.keyHash')
    // poštena opomba iz API-ja je vidna
    expect(src).toMatch(/\{data\?\.note &&/)
  })

  it('mračno: barvne značke imajo dark: ogledala (r172 pravilo — isti vrstici)', () => {
    const src = panel()
    // auth značka (jantar) — dark: tekst na isti vrstici
    expect(src).toMatch(/'bg-roksal-amber\/15 text-amber-700 ring-1 ring-inset ring-roksal-amber\/30 dark:text-roksal-amber'/)
    // hover obrobe vrstic blokad — obe temi
    expect(src).toMatch(/hover:border-roksal-navy\/25 dark:hover:border-roksal-ink\/25/)
  })
})

describe('R184 — seje (sessions-dialog): pečat + fokus refetch (20. površina)', () => {
  const dialog = (): string => srcOf('src/components/roksal/sessions-dialog.tsx')

  it('EN VIR RESNICE: casOznaka + družinski hook (wrapper `open` — precedens R181 punch-list)', () => {
    const src = dialog()
    expect(src).toContain(CAS_IMPORT)
    expect(src).toContain(HOOK_IMPORT)
    expect(src).toContain('{casOznaka(sejeOsvezitev)}')
    // wrapper: zaprt dialog NE sme fetchati v ozadju
    expect(src).toMatch(/useRefetchOnFocus\(\(\) => \{\s*\n\s*if \(open\) void load\(\)\s*\n\s*\}\)/)
  })

  it('pečat: set 1× ob uspehu; fail-closed 3× null (!res.ok + neveljaven odgovor + omrežje)', () => {
    const src = dialog()
    expect(src).toMatch(/const \[sejeOsvezitev, setSejeOsvezitev\] = useState<Date \| null>\(null\)/)
    expect(src.match(/setSejeOsvezitev\(new Date\(\)\)/g)).toHaveLength(1)
    expect(src.match(/setSejeOsvezitev\(null\)/g)).toHaveLength(3)
    // obstoječi fail-verbose (R137) ostaja: viden error + Znova
    expect(src).toMatch(/role="alert"/)
    expect(src).toContain('Znova')
  })

  it('render: pečat v DialogDescription (flex-wrap družinska vrstica) z IDENTIČNIM klasnim nizom + tooltip', () => {
    const src = dialog()
    expect(src).toMatch(/\{sejeOsvezitev && \(/)
    expect(src).toContain(TIGHT_HEADER_CLASS)
    expect(src).toContain(TOOLTIP)
    expect(src).toMatch(HISTORY_ICON)
    expect(src).toMatch(/Osveženo ob\{' '\}\s*<span className="tabular-nums">\{casOznaka\(sejeOsvezitev\)\}/)
    expect(src).toMatch(/className="flex flex-wrap items-center gap-x-2 gap-y-0\.5"/)
  })
})

describe('R184 — montaža: panel je ADMIN-only v Ekipi (zraven poslov)', () => {
  it('team-tab: dynamic import + montaža pod myRole === ADMIN (isti strežar kot JobsPanel)', () => {
    const src = srcOf('src/components/roksal/team-tab.tsx')
    expect(src).toContain("import('@/components/roksal/rate-limit-panel').then((m) => m.RateLimitPanel)")
    expect(src).toMatch(/\{myRole === 'ADMIN' && <JobsPanel \/>\}\s*\n\s*\{\/\* R184[\s\S]*?\*\/\}\s*\n\s*\{myRole === 'ADMIN' && <RateLimitPanel \/>\}/)
  })
})

// R186 konsolidacija: kumulativna družinska tabela (20 površin) preseljena v
// kanonično datoteko zivostna-druzina.test.ts.
