// R187 — SISTEM — ZDRAVJE kartica (21. površina živostne družine).
// ---------------------------------------------------------------------------
// Prva nova družinska površina PO R186 konsolidaciji — dokaz postopka
// 'nova površina = ENA vrstica v kanonu (DRUŽINA_21) + metapodatki +
// per-površinski SCOPED opis TUKAJ':
//  • JAVNA sonda /api/public/health (R186) iz vodjinega pogleda — vodja vidi
//    stanje baze PRED posameznimi seznami (prej: samo posredno prek napak).
//  • EN VIR loader: mount + 'Poskusi znova' + 'online' dogodek (vrnitev
//    povezave → samodejna preverba) + fokus (hook).
//  • Pečat 'Osveženo ob' = casOznaka (EN VIR); fail-closed (napaka/omrežje →
//    null); tight-header klasni niz IDENTIČEN družini.
//  • 'Zgrajeno' podrobnost = EN VIR zigIzpis (posodobitev-jedro, R185 vzorec;
//    nasvetna fail-soft — pokvaren žig NE razbije pasu).
//  • Odzivni čas = REALNA meritev brskalnika (performance.now delta) —
//    telemetrija, ne izmišljena številka.
//  • Fail-verbose: role=alert panel z razlogom + 'Poskusi znova' (hover
//    družina) — nič tihega praznega stanja.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

const kartica = (): string => srcOf('src/components/roksal/sistem-zdravje-card.tsx')
const vodja = (): string => srcOf('src/components/roksal/vodja-dashboard.tsx')

const TIGHT_HEADER_CLASS = 'className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"'
const TOOLTIP = 'title="Čas zadnje uspešne osvežitve podatkov"'
const HISTORY_ICON = /<History className="h-3 w-3 shrink-0" aria-hidden="true" \/>/

describe('R187 — Sistem — zdravje kartica: EN VIR + žičenje + fail-verbose', () => {
  it('EN VIR RESNICE: casOznaka (pečat) + zigIzpis (Zgrajeno) + družinski hook + History ikona', () => {
    const src = kartica()
    expect(src).toContain("import { casOznaka } from '@/lib/osvezitev-fokus'")
    expect(src).toContain("import { zigIzpis } from '@/lib/posodobitev-jedro'")
    expect(src).toContain("import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'")
    expect(src).toContain('{casOznaka(zdravjeOsvezitev)}')
    expect(src.match(/toLocaleTimeString/g)).toBeNull()
  })

  it('žičenje: pečat nastavljen SAMO v uspešni veji (res.ok + db ok); fail-closed 2× null (napaka + omrežje)', () => {
    const src = kartica()
    expect(src).toMatch(/const \[zdravjeOsvezitev, setZdravjeOsvezitev\] = useState<Date \| null>\(null\)/)
    expect(src.match(/setZdravjeOsvezitev\(new Date\(\)\)/g)).toHaveLength(1)
    expect(src.match(/setZdravjeOsvezitev\(null\)/g)).toHaveLength(2)
    expect(src).toMatch(/json\.db === 'ok'/)
  })

  it('loader EN VIR: mount + Poskusi znova + online dogodek + fokus (hook) = isti load', () => {
    const src = kartica()
    expect(src).toMatch(/const load = useCallback\(async \(\) => \{/)
    expect(src).toMatch(/useEffect\(\(\) => \{\s*\n\s*void load\(\)\s*\n\s*\}, \[load\]\)/)
    expect(src).toMatch(/useRefetchOnFocus\(load\)/)
    expect(src).toMatch(/onClick=\{\(\) => void load\(\)\}/)
    // R187: vrnitev povezave → samodejna preverba (online dogodek)
    expect(src).toMatch(/window\.addEventListener\('online', onOnline\)/)
    expect(src).toMatch(/return \(\) => window\.removeEventListener\('online', onOnline\)/)
  })

  it('fail-verbose: role=alert panel + Poskusi znova (aria + hover družina 14. površina) + razlog viden', () => {
    const src = kartica()
    expect(src).toMatch(/\{napaka && \(/)
    expect(src).toContain('role="alert"')
    expect(src).toContain('aria-label="Ponovno preveri zdravje sistema"')
    expect(src).toContain('Poskusi znova')
    expect(src).toMatch(/transition-colors hover:text-roksal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-red\/40/)
    // razlog = fail-verbose (vsebuje napako iz odgovora ALI status)
    expect(src).toMatch(/json\.error/)
    expect(src).toMatch(/napaka \$\{res\.status\}/)
    // omrežna veja je TUDI viden (prej tiho /* ignore */ antivzorec)
    expect(src).toContain('preverite povezavo')
  })

  it('render: tight-header klasni niz IDENTIČEN + tooltip + flex-wrap glava + odziv + Zgrajeno (fail-soft)', () => {
    const src = kartica()
    expect(src).toContain(TIGHT_HEADER_CLASS)
    expect(src).toContain(TOOLTIP)
    expect(src).toMatch(HISTORY_ICON)
    expect(src).toMatch(/Osveženo ob <span className="tabular-nums">\{casOznaka\(zdravjeOsvezitev\)\}/)
    // realna meritev odziva (ne izmišljena številka)
    expect(src).toMatch(/performance\.now\(\)/)
    expect(src).toContain('Odziv:')
    // Zgrajeno = nasvetna podrobnost: try/catch → null (R185 banner vzorec)
    expect(src).toMatch(/try \{\s*\n\s*setZgrajeno\(json\.build \? zigIzpis\(json\.build\) : null\)\s*\n\s*\} catch \{\s*\n\s*setZgrajeno\(null\)/)
    // pošten opis sonde
    expect(src).toContain('Javna sonda /api/public/health')
  })

  it('žičenje vodja: SistemZdravjeCard montiran na koncu vodjinega pregleda (za Skupno mrežo)', () => {
    const src = vodja()
    expect(src).toContain("import { SistemZdravjeCard } from '@/components/roksal/sistem-zdravje-card'")
    expect(src).toMatch(/<SistemZdravjeCard \/>\s*\n\s*<\/div>\s*\n\s*\)/)
  })

  it('regresija R180: vodja pečat + clearOnFail ostajata nedotaknjena (živostna površina 10)', () => {
    const src = vodja()
    expect(src).toContain('{casOznaka(vodjaOsvezitev)}')
    expect(src).toMatch(/useRefetchOnFocus\(loadData\)/)
    expect(src.match(/setVodjaOsvezitev\(new Date\(\)\)/g)).toHaveLength(1)
  })
})
