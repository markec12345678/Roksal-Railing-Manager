// R180 — ŽIVOSTNA DRUŽINA na vodjinih finančnih površinah:
// PREGLED ZA VODJO (vodja-dashboard) + RAČUNI (invoice-manager)
// ---------------------------------------------------------------------------
// Motiv: refetch-on-focus je od R176 dejansko na vseh GLAVNIH zavihkih, a sta
// dve vodjini površini ostali brez živosti: (a) vodja-dashboard (7 vzporednih
// API branj — prihodki, zapadli računi, termini; vodja, ki se vrne v zavihek,
// je videl ZASTARELE KPI-je do remonta) in (b) računi v CRM (FURS seznam —
// finančno kritično: zapadli rok plačila). R180 dopolni družino na obeh.
// Načela (vzorec R170/R177/R178, vsaka odstopitev = bug):
//  1. Refetch-on-focus prek DRUŽINSKEGA hooka useRefetchOnFocus (30 s vrata
//     R170) — EN VIR loaderja: isti callback kot mount + "Poskusi znova".
//  2. Pečat 'Osveženo ob' = čas zadnjega USPEŠNEGA branja primarnega vira
//     (vodja → vseh 7 virov uspešno; računi → /api/invoices). Napaka/omrežje
//     → null (fail-closed pečat — NIČ lažne svežine nad napako).
//  3. EN VIR RESNICE: casOznaka() (@/lib/osvezitev-fokus) — komponente NE
//     formatirajo časa same (toLocaleTimeString je prepovedan).
//  4. tight-header klasni niz IDENTIČEN ostalim 9 površinam (hidden sm:flex +
//     History + tabular-nums + tooltip); pečat viden TOČKO, ko stanje != null.
// Varnostni pas (R165/R167 nauček): vsi source grepi imajo SCOPED vzorce.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

const vodja = (): string => srcOf('src/components/roksal/vodja-dashboard.tsx')
const racuni = (): string => srcOf('src/components/roksal/invoice-manager.tsx')

const TIGHT_HEADER_CLASS = 'className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"'
const TOOLTIP = 'title="Čas zadnje uspešne osvežitve podatkov"'

describe('R180 P1 — pregled za vodjo (vodja-dashboard)', () => {
  it('EN VIR RESNICE: casOznaka iz osvezitev-fokus + History ikona (brez lokalnega formatiranja pečata)', () => {
    const src = vodja()
    expect(src).toContain("import { casOznaka } from '@/lib/osvezitev-fokus'")
    expect(src).toContain("import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'")
    expect(src).toMatch(/\n  History,\n\} from 'lucide-react'/)
    expect(src).toContain('{casOznaka(vodjaOsvezitev)}')
    // OPOMBA: vodja ima pre-existing formatTime() (termin listing) — to je
    // domensko formatiranje časa termina, NE pečata; EN VIR pravilo velja za
    // PEČAT (ki uporablja izključno casOznaka — dokazano v render testu).
  })

  it('refetch-on-focus: družinski hook z ISTIM loaderjem (EN VIR — mount, fokus in "Poskusi znova" = loadData)', () => {
    const src = vodja()
    expect(src).toMatch(/useRefetchOnFocus\(loadData\)/)
    // loadData je stabilen useCallback (hook pača vedno zadnjo identiteto)
    expect(src).toMatch(/const loadData = useCallback\(async \(\) => \{/)
    // mount efekt ostane (prvi load je klicateljev — hook poganja samo vračanja)
    expect(src).toMatch(/useEffect\(\(\) => \{ loadData\(\) \}, \[loadData\]\)\s*\n[\s\S]*?useRefetchOnFocus\(loadData\)/)
  })

  it('pečat: set TOČKO 1× v uspešni veji (vseh 7 virov prebranih); fail-closed prek clearOnFail (vse 3 fail poti)', () => {
    const src = vodja()
    expect(src).toMatch(/const \[vodjaOsvezitev, setVodjaOsvezitev\] = useState<Date \| null>\(null\)/)
    expect(src).toMatch(/setAllInvoices\(invoices as InvLite\[\]\)\s*\n\s*\/\/ R180[^\n]*\n\s*setVodjaOsvezitev\(new Date\(\)\)/)
    expect(src.match(/setVodjaOsvezitev\(new Date\(\)\)/g)).toHaveLength(1)
    // clearOnFail je SKUPNA fail-closed točka: počisti podatke TUDI pečat
    expect(src).toMatch(/setAllInvoices\(\[\]\)\s*\n\s*\/\/ R180[^\n]*\n\s*\/\/[^\n]*\n\s*setVodjaOsvezitev\(null\)/)
    // …in clearOnFail je poklican iz VSEH treh fail poti (napake virov,
    // neveljaven odgovor, omrežna napaka) — pečat nikoli ne preživi napake
    const clearCalls = src.match(/clearOnFail\(\)/g) ?? []
    expect(clearCalls.length).toBeGreaterThanOrEqual(3)
  })

  it('render: pečat v glavi pregleda z IDENTIČNIM klasnim nizom + tooltip + tabular-nums (vrata: samo ko != null)', () => {
    const src = vodja()
    expect(src).toMatch(/\{vodjaOsvezitev && \(/)
    expect(src).toContain(TIGHT_HEADER_CLASS)
    expect(src).toContain(TOOLTIP)
    expect(src).toMatch(/<History className="h-3 w-3 shrink-0" aria-hidden="true" \/>/)
    expect(src).toMatch(/Osveženo ob\{' '\}\s*\n\s*<span className="tabular-nums">\{casOznaka\(vodjaOsvezitev\)\}/)
    // pečat v NASLOVNI vrstici pregleda (flex-wrap — brez prelivanja, R171)
    expect(src).toMatch(/Pregled za vodjo<\/h2>[\s\S]{0,600}vodjaOsvezitev && \(/)
  })
})

describe('R180 P1 — računi (invoice-manager)', () => {
  it('EN VIR RESNICE: casOznaka iz osvezitev-fokus + History ikona (brez lokalnega formatiranja pečata)', () => {
    const src = racuni()
    expect(src).toContain("import { casOznaka } from '@/lib/osvezitev-fokus'")
    expect(src).toContain("import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'")
    expect(src).toMatch(/\n  History,\n\} from 'lucide-react'/)
    expect(src).toContain('{casOznaka(racuniOsvezitev)}')
    // PEČAT SAMO: projektni dropdown (sekundarni vir) ne sme formatirati časa
    expect(src.match(/toLocaleTimeString/g)).toBeNull()
  })

  it('refetch-on-focus: družinski hook z loadInvoices (EN VIR — mount, fokus in mutacije = isti loader)', () => {
    const src = racuni()
    expect(src).toMatch(/useRefetchOnFocus\(loadInvoices\)/)
    expect(src).toMatch(/const loadInvoices = useCallback\(async \(\) => \{/)
    expect(src).toMatch(/\}, \[loadInvoices\]\)\s*\n\s*\/\/ R180[^\n]*\n\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*useRefetchOnFocus\(loadInvoices\)/)
  })

  it('pečat: set 1× v res.ok veji; fail-closed 2× null (!res.ok + catch) — zastarel seznam ostane BREZ pečata', () => {
    const src = racuni()
    expect(src).toMatch(/const \[racuniOsvezitev, setRacuniOsvezitev\] = useState<Date \| null>\(null\)/)
    expect(src).toMatch(/if \(res\.ok\) \{\s*\n\s*setInvoices\(await res\.json\(\)\)\s*\n\s*\/\/ R180[^\n]*\n\s*setRacuniOsvezitev\(new Date\(\)\)/)
    expect(src.match(/setRacuniOsvezitev\(new Date\(\)\)/g)).toHaveLength(1)
    // 2× null: napaka strežnika + omrežje (fail-closed — NIČ lažne svežine)
    expect(src.match(/setRacuniOsvezitev\(null\)/g)).toHaveLength(2)
    expect(src).toMatch(/\/\/ fail-closed pečat[^\n]*\n\s*setRacuniOsvezitev\(null\)/)
    expect(src).toMatch(/\/\/ offline[^\n]*\n\s*setRacuniOsvezitev\(null\)/)
  })

  it('render: pečat v CardHeader glavi "Računi (FURS)" z IDENTIČNIM klasnim nizom + tooltip (skrit na xs)', () => {
    const src = racuni()
    expect(src).toMatch(/\{racuniOsvezitev && \(/)
    expect(src).toContain(TIGHT_HEADER_CLASS)
    expect(src).toContain(TOOLTIP)
    expect(src).toMatch(/<History className="h-3 w-3 shrink-0" aria-hidden="true" \/>/)
    expect(src).toMatch(/\(FURS\)<\/span>[\s\S]{0,200}\{\/\* R180[\s\S]*?\{racuniOsvezitev && \(/)
    expect(src).toMatch(/Osveženo ob\{' '\}\s*\n\s*<span className="tabular-nums">\{casOznaka\(racuniOsvezitev\)\}/)
  })
})

describe('R180 P1 — družina pečatov: 11 površin (9 iz R170–R178 + 2 nove)', () => {
  const DRUZINA: Array<[string, string, string]> = [
    ['termini', 'src/components/roksal/termini-card.tsx', 'zdaj'],
    ['logistika', 'src/components/roksal/logistics-tab.tsx', 'zadnjaOsvezitev'],
    ['dashboard', 'src/components/roksal/dashboard-tab.tsx', 'projektiOsvezitev'],
    ['zaloga', 'src/components/roksal/inventory-tab.tsx', 'zalogaOsvezitev'],
    ['dokumenti', 'src/components/roksal/documents-tab.tsx', 'dokumentiOsvezitev'],
    ['varnost', 'src/components/roksal/safety-tab.tsx', 'vremeOsvezitev'],
    ['CRM stranke', 'src/components/roksal/crm-tab.tsx', 'strankeOsvezitev'],
    ['plošča', 'src/components/roksal/deal-pipeline.tsx', 'ploscaOsvezitev'],
    ['ekipa', 'src/components/roksal/team-tab.tsx', 'ekipaOsvezitev'],
    ['vodja', 'src/components/roksal/vodja-dashboard.tsx', 'vodjaOsvezitev'],
    ['računi', 'src/components/roksal/invoice-manager.tsx', 'racuniOsvezitev'],
  ]

  it.each(DRUZINA)('%s: pečat ima EN VIR casOznaka', (_ime, pot, stanje) => {
    const src = srcOf(pot)
    expect(src).toContain("import { casOznaka } from '@/lib/osvezitev-fokus'")
    expect(src).toContain(`{casOznaka(${stanje})}`)
    // tooltip: standardni niz POVŠOD; Logistika ima dokumentirano podaljšano
    // varianto ('... podatkov logistike' — R170 polnvrstična)
    expect(
      src.includes(TOOLTIP) || src.includes('title="Čas zadnje uspešne osvežitve podatkov logistike"'),
    ).toBe(true)
  })

  it('tight-header klasni niz na 10 od 11 površin (Logistika = dokumentirana polnvrstična varianta R170, ni defect)', () => {
    const brezLogistike = DRUZINA.filter(([ime]) => ime !== 'logistika')
    for (const [_ime, pot] of brezLogistike) {
      expect(srcOf(pot)).toContain(TIGHT_HEADER_CLASS)
    }
    // in Logistika ima SVOJO dokumentirano varianto (polna vrstica z besedilom)
    expect(srcOf('src/components/roksal/logistics-tab.tsx')).toContain('Osveženo ob')
  })
})
