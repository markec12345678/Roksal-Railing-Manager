// R182 — ŽIVOSTNA DRUŽINA 14 → 16 POVRŠIN + FAIL-VERBOSE AGREGACIJE
// OBVESTILA (notification-center, top-bar zvonek — 5 virov) +
// MATERIALNA INTELIGENCA (material-intelligence-tab, Več → material — 4 viri)
// ---------------------------------------------------------------------------
// Motiv: obe površini sta AGREGACIJA več virov z fail-silent zankami
// (`if (res.ok)` BREZ else / catch /* ignore */):
//  • Obvestila: tihi izpad /api/inventory = nizka zaloga NEVIDNA → lažno
//    'Vse je pod nadzorom' (isti vzorec kot R162 CRM / R174 Ekipa);
//    tihi izpad vremena = LAŽNA VARNOST (R152 vzorec); tihi izpad računov =
//    finančno kritičen zapadli račun NEVIDEN.
//  • Materialna inteligenca: tihi izpad /api/suppliers = PRAZEN seznam z
//    lažnim 'Ni dobaviteljev. Dodaj prvega.' (uporabnik bi dodal DUPLE).
// R182: fail-verbose (viden warning z imeni virov + 'Poskusi znova'), 403 =
// pravična meja vloge (R175 — tiho), pečat samo ob USPEŠNEM branju VSEH
// poskušanih virov, refetch-on-focus prek družinskega hooka.
// Načela (vzorec R170/R177/R178/R180/R181):
//  1. useRefetchOnFocus (30 s vrata R170) — EN VIR loaderja (mount + fokus +
//     'Poskusi znova' + rolsal:refresh / mutacije).
//  2. Pečat 'Osveženo ob' = casOznaka() — komponente NE formatirajo časa same.
//  3. tight-header klasni niz IDENTIČEN družini (hidden sm:flex + History +
//     tabular-nums + tooltip); toLocaleTimeString za pečat PREPOVEDAN.
//  4. Error panel je PREDNOST pred praznim stanjem (R174) — brez lažnih
//     'Ni podatkov' sporočil nad napako.
// Varnostni pas (R165/R167 nauček): vsi source grepi imajo SCOPED vzorce.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

const obvestila = (): string => srcOf('src/components/roksal/notification-center.tsx')
const material = (): string => srcOf('src/components/roksal/material-intelligence-tab.tsx')

const TIGHT_HEADER_CLASS = 'className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"'
const TOOLTIP = 'title="Čas zadnje uspešne osvežitve podatkov"'
const HISTORY_ICON = /<History className="h-3 w-3 shrink-0" aria-hidden="true" \/>/
const FLEX_WRAP_ROW = /flex flex-wrap items-center gap-x-2 gap-y-0\.5 text-\[11px\] text-muted-foreground/

describe('R182 — obvestila (notification-center): fail-verbose agregacije + živost', () => {
  it('EN VIR RESNICE: casOznaka iz osvezitev-fokus + History ikona (brez lokalnega formatiranja pečata)', () => {
    const src = obvestila()
    expect(src).toContain("import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'")
    expect(src).toContain("import { casOznaka } from '@/lib/osvezitev-fokus'")
    // R197: ShieldCheck (varnostne vrstice zvončka) je dodan v isti import —
    // vsi še naprej iz ENEGA lucide-react uvoza (EN VIR ikon).
    // R212: ShoppingCart (aktivna naročila digest) v istem uvozu.
    expect(src).toMatch(/Wrench, History, ShieldCheck, ShoppingCart,\n\} from 'lucide-react'/)
    expect(src).toContain('{casOznaka(obvestilaOsvezitev)}')
    // toLocaleString (persisted createdAt) je domensko formatiranje — dovoljeno;
    // toLocaleTimeString za PEČAT je prepovedan (EN VIR casOznaka)
    expect(src.match(/toLocaleTimeString/g)).toBeNull()
  })

  it('refetch-on-focus: družinski hook z ISTIM load (EN VIR — mount, fokus, rolsal:refresh, Osveži)', () => {
    const src = obvestila()
    expect(src).toMatch(/const load = useCallback\(async \(\) => \{/)
    expect(src).toMatch(/useRefetchOnFocus\(load\)/)
    // mount efekt (roksal:refresh listener) ostane; hook takoj za njim
    expect(src).toMatch(
      /useEffect\(\(\) => \{\s*\n\s*void load\(\)\s*\n\s*const onRefresh = \(\) => void load\(\)\s*\n\s*window\.addEventListener\('roksal:refresh', onRefresh\)\s*\n\s*return \(\) => window\.removeEventListener\('roksal:refresh', onRefresh\)\s*\n\s*\}, \[load\]\)\s*\n[\s\S]*?useRefetchOnFocus\(load\)/,
    )
    // klik na zvonec = ISTI loader (EN VIR)
    expect(src).toMatch(/onClick=\{\(\) => \{ setOpen\(true\); void load\(\) \}\}/)
  })

  it('fail-verbose: 6× status !== 403 (zaloga, projekti, CRM opomniki R287, računi, naročila, vreme) — 403 meja tiho (R175)', () => {
    const src = obvestila()
    // 6 virov × non-403 guard (računi/naročila/vreme imajo tudi catch vejo)
    // R212: naročila = 5. vir (aktivna naročila digest)
    // R287: CRM opomniki = 6. vir ((k) portal akcija — EN VIR /api/crm)
    expect(src.match(/\.status !== 403/g)).toHaveLength(6)
    expect(src).toContain("neuspeliViri.push('zaloga')")
    expect(src).toContain("neuspeliViri.push('projekti')")
    expect(src).toContain("neuspeliViri.push('CRM opomniki')")
    expect(src.split("neuspeliViri.push('računi')").length - 1).toBe(2) // !res.ok + catch
    expect(src.split("neuspeliViri.push('naročila')").length - 1).toBe(2) // R212: !res.ok + catch
    expect(src.split("neuspeliViri.push('vreme')").length - 1).toBe(2) // !res.ok + catch
  })

  it('pečat: set 1× ob uspehu VSEH virov; fail-closed 2× null (neuspeli viri + omrežje)', () => {
    const src = obvestila()
    expect(src).toMatch(/const \[obvestilaOsvezitev, setObvestilaOsvezitev\] = useState<Date \| null>\(null\)/)
    expect(src.match(/setObvestilaOsvezitev\(new Date\(\)\)/g)).toHaveLength(1)
    expect(src.match(/setObvestilaOsvezitev\(null\)/g)).toHaveLength(2)
    // pečat pod pogojem — neuspeli viri → null (nikoli lažne svežine)
    expect(src).toMatch(/if \(neuspeliViri\.length > 0\) \{[\s\S]*?setViriNapaka\([\s\S]*?setObvestilaOsvezitev\(null\)[\s\S]*?\} else \{[\s\S]*?setViriNapaka\(null\)\s*\n\s*setObvestilaOsvezitev\(new Date\(\)\)/)
  })

  it('render: pečat v SheetDescription podnaslovni vrstici (flex-wrap) z IDENTIČNIM klasnim nizom + tooltip', () => {
    const src = obvestila()
    expect(src).toMatch(/\{obvestilaOsvezitev && \(/)
    expect(src).toContain(TIGHT_HEADER_CLASS)
    expect(src).toContain(TOOLTIP)
    expect(src).toMatch(HISTORY_ICON)
    // SheetDescription je družinska flex-wrap podnaslovna vrstica
    expect(src).toMatch(/<SheetDescription className=\{?"?[^\n]*flex flex-wrap items-center gap-x-2/)
    expect(src).toMatch(/Osveženo ob\{' '\}\s*\n\s*<span className="tabular-nums">\{casOznaka\(obvestilaOsvezitev\)\}/)
  })

  it('warning vrstica: role="alert" + Poskusi znova (ISTI load) + hover družina — nad praznim stanjem', () => {
    const src = obvestila()
    expect(src).toMatch(/\{viriNapaka && \(/)
    expect(src).toContain('role="alert"')
    expect(src).toContain('aria-label="Ponovno naloži obvestila"')
    expect(src).toMatch(/Poskusi znova\s*\n\s*<\/button>/)
    // stil družina retry gumbov (R172/R176) + focus ring
    expect(src).toMatch(/transition-colors hover:text-roksal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-red\/40/)
    // error panel PREDNOST: prazno stanje 'Vse je pod nadzorom' NIČ, če viri padli
    expect(src).toMatch(/!persistedError && !viriNapaka && \(/)
  })

  it('omrežni catch: viden sporočilo + brez pečata (prej tiho /* offline */)', () => {
    const src = obvestila()
    expect(src).toMatch(/\} catch \{\s*\n\s*\/\/ R182[^\n]*\n\s*\/\/[^\n]*\n\s*setViriNapaka\('Obvestila niso bila osvežena \(omrežje\)[^']*'\)\s*\n\s*setObvestilaOsvezitev\(null\)/)
  })
})

describe('R182 — materialna inteligenca (material-intelligence-tab): fail-verbose + živost', () => {
  it('EN VIR RESNICE: casOznaka iz osvezitev-fokus + History ikona (brez lokalnega formatiranja pečata)', () => {
    const src = material()
    expect(src).toContain("import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'")
    expect(src).toContain("import { casOznaka } from '@/lib/osvezitev-fokus'")
    expect(src).toMatch(/^  History,$/m)
    expect(src).toContain('{casOznaka(materialOsvezitev)}')
    // fmtDate uporablja toLocaleDateString (domenski datumi) — PEČAT pa
    // izključno casOznaka; toLocaleTimeString prepovedan
    expect(src.match(/toLocaleTimeString/g)).toBeNull()
  })

  it('refetch-on-focus: družinski hook z ISTIM loadData (EN VIR — mount, fokus, mutacije, Poskusi znova)', () => {
    const src = material()
    expect(src).toMatch(/const loadData = useCallback\(async \(\) => \{/)
    expect(src).toMatch(/useRefetchOnFocus\(loadData\)/)
    // mount efekt ostane; hook takoj za njim (družinski vzorec)
    expect(src).toMatch(/useEffect\(\(\) => \{\s*\n\s*loadData\(\)\s*\n\s*\}, \[loadData\]\)\s*\n[\s\S]*?useRefetchOnFocus\(loadData\)/)
  })

  it('fail-verbose: 4× status !== 403 (dobavitelji, zaloga, BOM, naročila) — 403 meja tiho', () => {
    const src = material()
    expect(src.match(/\.status !== 403/g)).toHaveLength(4)
    expect(src).toContain("neuspeliViri.push('dobavitelji')")
    expect(src).toContain("neuspeliViri.push('zaloga')")
    expect(src).toContain("neuspeliViri.push('BOM')")
    expect(src).toContain("neuspeliViri.push('naročila')")
  })

  it('pečat: set 1× ob uspehu VSEH poskušanih virov; fail-closed 2× null (viri + omrežje)', () => {
    const src = material()
    expect(src).toMatch(/const \[materialOsvezitev, setMaterialOsvezitev\] = useState<Date \| null>\(null\)/)
    expect(src.match(/setMaterialOsvezitev\(new Date\(\)\)/g)).toHaveLength(1)
    expect(src.match(/setMaterialOsvezitev\(null\)/g)).toHaveLength(2)
    expect(src).toMatch(/if \(neuspeliViri\.length > 0\) \{[\s\S]*?setMaterialOsvezitev\(null\)[\s\S]*?\} else \{[\s\S]*?setMaterialOsvezitev\(new Date\(\)\)/)
  })

  it('render: pečat v flex-wrap vrstici pod preklopnikom + IDENTIČEN klasni niz + tooltip (skrit na xs)', () => {
    const src = material()
    expect(src).toMatch(/\{materialOsvezitev && \(/)
    expect(src).toContain(TIGHT_HEADER_CLASS)
    expect(src).toContain(TOOLTIP)
    expect(src).toMatch(HISTORY_ICON)
    expect(src).toMatch(/Dobavitelji, zaloge, naročila in BOM optimizacija\./)
    expect(src).toMatch(FLEX_WRAP_ROW)
    expect(src).toMatch(/Osveženo ob\{' '\}\s*\n\s*<span className="tabular-nums">\{casOznaka\(materialOsvezitev\)\}/)
  })

  it('warning vrstica + PREDNOST nad lažnimi praznimi stanji (R174): brez "Ni dobaviteljev" / "Ni naročil" / "Deal ni zaklenjen" nad napako', () => {
    const src = material()
    expect(src).toMatch(/\{viriNapaka && \(/)
    expect(src).toContain('role="alert"')
    expect(src).toContain('aria-label="Ponovno naloži materialno inteligenco"')
    expect(src).toMatch(/transition-colors hover:text-roksal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-red\/40/)
    // BOM: brez lažnega 'Deal ni zaklenjen', ko BOM vir ni naložen
    expect(src).toMatch(/!bomRefine && viriNapaka \? null : !bomRefine\?\.dealLocked \? \(/)
    // orders + suppliers: lažno prazno stanje NIČ, ko je vir padel
    expect(src).toMatch(/orders\.length === 0 \? \(\s*\n\s*\/\/ R182[^\n]*\n\s*viriNapaka \? null : \(/)
    expect(src).toMatch(/suppliers\.length === 0 \? \(\s*\n\s*\/\/ R182[^\n]*\n\s*viriNapaka \? null : \(/)
  })

  it('render vrata (R176 nauček): fokus refetch NE utripa skeletov — vrtiljak SAMO brez podatkov', () => {
    const src = material()
    expect(src).toMatch(/loading && !bomRefine \? \(/)
    expect(src).toMatch(/loading && orders\.length === 0 \? \(/)
    expect(src).toMatch(/loading && suppliers\.length === 0 \? \(/)
  })

  it('omrežni catch: viden sporočilo + brez pečata (prej tiho /* ignore */)', () => {
    const src = material()
    expect(src).toMatch(/\} catch \{\s*\n\s*\/\/ R182[^\n]*\n\s*\/\/[^\n]*\n\s*setViriNapaka\('Podatki niso bili osveženi \(omrežje\)[^']*'\)\s*\n\s*setMaterialOsvezitev\(null\)/)
  })
})

// R186 konsolidacija: kumulativna družinska tabela (2 novi površini +
// skupni seznam 16) preseljena v kanonično datoteko zivostna-druzina.test.ts
// (per-površinski opisi zgoraj ostanejo avtoriteta za SCOPED vzorce).
