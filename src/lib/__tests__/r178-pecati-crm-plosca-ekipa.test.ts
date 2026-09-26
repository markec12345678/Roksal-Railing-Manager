// R178 — PEČATI SVEŽINE 'Osveženo ob' za CRM STRANKE + PRODAJNO PLOŠČO + EKIPA
// (R177 kandidat b; zaključi družino na VSEH fail-verbose loaderjih).
// ---------------------------------------------------------------------------
// Motiv: pečati so od R177 pokriti na 6 refetch-on-focus površinah (termini,
// logistika, dashboard, zaloga, dokumenti, varnost), a trije fail-verbose
// loaderji (CRM stranke R162, prodajna plošča R173, ekipa R174) še NISO imeli
// pečata — uporabnik ni videl, KDAJ so podatki sveže. R178 dopolni družino.
// Načela (vzorec R170/R171/R177, vsaka odstopitev = bug):
//  1. Pečat = čas zadnjega USPEŠNEGA branja PRIMARNEGA vira površine
//     (CRM → /api/crm; plošča → /api/projects za ploščo; ekipa → /api/users).
//     Napaka/omrežje → null (NIČ lažne svežine nad napako ali praznim stanjem
//     — fail-closed pečat).
//  2. Ekipa 403 (R175 pravična meja): pečat se TUDI tam počisti — poštno
//     stanje 'Ekipa — ureja pisarna' nima seznama, zato NIČ za pečat.
//  3. EN VIR RESNICE: besedilo prihaja iz casOznaka() (@/lib/osvezitev-fokus,
//     sl-SI 24-urno s sekundami) — komponente NE formatirajo časa same.
//  4. Render vrata: pečat viden TOČNO TAKRAT, ko stanje != null; tight-header
//     klasni niz IDENTIČEN R170/R171/R177 (hidden sm:flex + History +
//     tabular-nums + tooltip); flex-wrap podnaslovna vrstica (brez prelivanja
//     pri ozkih širinah).
// Varnostni pas (R165/R167 nauček): vsi source grepi imajo SCOPED vzorce.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

const ekipa = (): string => srcOf('src/components/roksal/team-tab.tsx')
const plosca = (): string => srcOf('src/components/roksal/deal-pipeline.tsx')
const crm = (): string => srcOf('src/components/roksal/crm-tab.tsx')

const TIGHT_HEADER_CLASS = 'className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"'
const TOOLTIP = 'title="Čas zadnje uspešne osvežitve podatkov"'
const FLEX_WRAP = 'flex flex-wrap items-center gap-x-2 gap-y-0.5'

describe('R178 P1 — ekipa pečat (team-tab)', () => {
  it('EN VIR RESNICE: casOznaka iz osvezitev-fokus + History ikona (brez lokalnega formatiranja pečata)', () => {
    const src = ekipa()
    expect(src).toContain("import { casOznaka } from '@/lib/osvezitev-fokus'")
    expect(src).toMatch(/\n  History,\n  type LucideIcon,\n\} from 'lucide-react'/)
    expect(src).toContain('{casOznaka(ekipaOsvezitev)}')
    expect(src.match(/toLocaleTimeString/g)).toBeNull()
  })

  it('žičenje: pečat nastavljen SAMO v uspešni veji res.ok (primarni vir = /api/users)', () => {
    const src = ekipa()
    expect(src).toMatch(/const \[ekipaOsvezitev, setEkipaOsvezitev\] = useState<Date \| null>\(null\)/)
    expect(src).toMatch(/setUsers\(data\)\s*\n\s*setEkipaOsvezitev\(new Date\(\)\)/)
    // natanko EN uspešen set (auth/me fetch ga NE pomakne)
    expect(src.match(/setEkipaOsvezitev\(new Date\(\)\)/g)).toHaveLength(1)
  })

  it('fail-closed pečat: !res.ok (VSKLJUČNO 403 poštno stanje) in catch počistita pečat (2× null)', () => {
    const src = ekipa()
    expect(src.match(/setEkipaOsvezitev\(null\)/g)).toHaveLength(2)
    // 403 = pravična meja R175: brez seznama NIČ za pečat — null PRED 403 vejo
    expect(src).toMatch(
      /setUsers\(\[\]\)\s*\n[\s\S]*?setEkipaOsvezitev\(null\)\s*\n\s*if \(res\.status !== 403\)/,
    )
    // catch: brez povezave → brez pečata (vzorec R174 fail-verbose)
    expect(src).toMatch(
      /setUsers\(\[\]\)\s*\n\s*setEkipaOsvezitev\(null\)\s*\n\s*setError\('Ni povezave s strežnikom — preverite omrežje in poskusite znova\.'\)/,
    )
  })

  it('render: tight-header pečat z IDENTIČNIM R170/R171/R177 klasnim nizom + tooltip + tabular-nums + flex-wrap podnaslov', () => {
    const src = ekipa()
    expect(src).toContain('{ekipaOsvezitev && (')
    expect(src).toContain(TIGHT_HEADER_CLASS)
    expect(src).toContain(TOOLTIP)
    expect(src).toContain(FLEX_WRAP)
    expect(src).toMatch(/<History className="h-3 w-3 shrink-0" aria-hidden="true" \/>/)
    expect(src).toMatch(/Osveženo ob <span className="tabular-nums">\{casOznaka\(ekipaOsvezitev\)\}/)
  })
})

describe('R178 P1 — plošča pečat (deal-pipeline)', () => {
  it('EN VIR RESNICE: casOznaka iz osvezitev-fokus + History ikona (brez lokalnega formatiranja pečata)', () => {
    const src = plosca()
    expect(src).toContain("import { casOznaka } from '@/lib/osvezitev-fokus'")
    expect(src).toMatch(/\n  History,\n  type LucideIcon,\n\} from 'lucide-react'/)
    expect(src).toContain('{casOznaka(ploscaOsvezitev)}')
    expect(src.match(/toLocaleTimeString/g)).toBeNull()
  })

  it('žičenje: pečat nastavljen SAMO v uspešni veji res.ok (primarni vir = /api/projects za ploščo)', () => {
    const src = plosca()
    expect(src).toMatch(/const \[ploscaOsvezitev, setPloscaOsvezitev\] = useState<Date \| null>\(null\)/)
    expect(src).toMatch(/setItems\(data\)\s*\n\s*itemsRef\.current = data\s*\n\s*setPloscaOsvezitev\(new Date\(\)\)/)
    expect(src.match(/setPloscaOsvezitev\(new Date\(\)\)/g)).toHaveLength(1)
  })

  it('fail-closed pečat: !res.ok in catch počistita pečat (2× null, vsak v paru s čiščenjem stanja)', () => {
    const src = plosca()
    expect(src.match(/setPloscaOsvezitev\(null\)/g)).toHaveLength(2)
    expect(src).toMatch(
      /setItems\(\[\]\)\s*\n\s*itemsRef\.current = \[\]\s*\n\s*setPloscaOsvezitev\(null\)/,
    )
    expect(src).toMatch(
      /setError\('Ni povezave s strežnikom — preverite omrežje in poskusite znova\.'\)/,
    )
  })

  it('render: tight-header pečat z IDENTIČNIM R170/R171/R177 klasnim nizom + flex-wrap podnaslov', () => {
    const src = plosca()
    expect(src).toContain('{ploscaOsvezitev && (')
    expect(src).toContain(TIGHT_HEADER_CLASS)
    expect(src).toContain(TOOLTIP)
    expect(src).toContain(FLEX_WRAP)
    expect(src).toMatch(/Osveženo ob <span className="tabular-nums">\{casOznaka\(ploscaOsvezitev\)\}/)
  })
})

describe('R178 P1 — CRM pečat (crm-tab)', () => {
  it('EN VIR RESNICE: casOznaka iz osvezitev-fokus + History ikona (brez lokalnega formatiranja pečata)', () => {
    const src = crm()
    expect(src).toContain("import { casOznaka } from '@/lib/osvezitev-fokus'")
    expect(src).toMatch(/\n  History,\n\} from 'lucide-react'/)
    expect(src).toContain('{casOznaka(strankeOsvezitev)}')
    expect(src.match(/toLocaleTimeString/g)).toBeNull()
  })

  it('žičenje: pečat nastavljen SAMO v uspešni veji res.ok (primarni vir = /api/crm)', () => {
    const src = crm()
    expect(src).toMatch(/const \[strankeOsvezitev, setStrankeOsvezitev\] = useState<Date \| null>\(null\)/)
    expect(src).toMatch(/setStats\(json\?\.stats \?\? null\)\s*\n\s*setStrankeOsvezitev\(new Date\(\)\)/)
    expect(src.match(/setStrankeOsvezitev\(new Date\(\)\)/g)).toHaveLength(1)
  })

  it('fail-closed pečat: !res.ok in catch počistita pečat (2× null, vsak v paru s čiščenjem strank+stats)', () => {
    const src = crm()
    expect(src.match(/setStrankeOsvezitev\(null\)/g)).toHaveLength(2)
    expect(src).toMatch(
      /setCustomers\(\[\]\)\s*\n\s*setStats\(null\)\s*\n\s*setStrankeOsvezitev\(null\)/,
    )
  })

  it('render: NOVA glava seznama "CRM stranke" (jasna ločnica od kart) + tight-header pečat + flex-wrap', () => {
    const src = crm()
    expect(src).toContain('{strankeOsvezitev && (')
    expect(src).toContain('>CRM stranke</h2>')
    expect(src).toContain('Seznam strank, opomniki in zgodovina sodelovanja')
    expect(src).toContain(TIGHT_HEADER_CLASS)
    expect(src).toContain(TOOLTIP)
    expect(src).toContain(FLEX_WRAP)
    expect(src).toMatch(/Osveženo ob <span className="tabular-nums">\{casOznaka\(strankeOsvezitev\)\}/)
  })
})

describe('R178 — družinska popolnost: pečat svežine na VSEH 9 površinah', () => {
  const površine: Array<[string, string]> = [
    ['Termini (R170)', 'src/components/roksal/termini-card.tsx'],
    ['Logistika (R170)', 'src/components/roksal/logistics-tab.tsx'],
    ['Dashboard projekti (R171)', 'src/components/roksal/dashboard-tab.tsx'],
    ['Zaloga (R177)', 'src/components/roksal/inventory-tab.tsx'],
    ['Dokumenti (R177)', 'src/components/roksal/documents-tab.tsx'],
    ['Varnost (R177)', 'src/components/roksal/safety-tab.tsx'],
    ['Prodajna plošča (R178)', 'src/components/roksal/deal-pipeline.tsx'],
    ['CRM stranke (R178)', 'src/components/roksal/crm-tab.tsx'],
    ['Ekipa (R178)', 'src/components/roksal/team-tab.tsx'],
  ]

  it.each(površine)('%s — vsebuje pečat (besedilo + History ikona + tabular-nums + tooltip)', (_ime, pot) => {
    const src = srcOf(pot)
    expect(src).toContain('Osveženo ob')
    expect(src).toMatch(/<History className="h-3 w-3 shrink-0" aria-hidden="true" \/>/)
    expect(src).toMatch(/Osveženo ob <span className="tabular-nums">/)
    expect(src).toMatch(/title="Čas zadnje uspešne osvežitve podatkov/)
  })

  it('tight-header klasni niz IDENTIČEN na vseh 8 tight-header površinah (Logistika = dokumentirana polna-vrstična varianta R170, ni defect)', () => {
    for (const [, pot] of površine.filter(([ime]) => !ime.startsWith('Logistika'))) {
      expect(srcOf(pot)).toContain(TIGHT_HEADER_CLASS)
    }
  })

  it('EN VIR RESNICE: vsi 3 R178 pečati izhajajo iz casOznaka (osvezitev-fokus) — brez novih Intl klicev v komponentah', () => {
    for (const pot of ['src/components/roksal/deal-pipeline.tsx', 'src/components/roksal/crm-tab.tsx', 'src/components/roksal/team-tab.tsx']) {
      const src = srcOf(pot)
      expect(src).toContain("import { casOznaka } from '@/lib/osvezitev-fokus'")
      expect(src.match(/casOznaka\(/g)!.length).toBeGreaterThanOrEqual(1)
      expect(src.match(/toLocaleTimeString/g)).toBeNull()
    }
  })
})
