// R177 — PEČATI SVEŽINE 'Osveženo ob' za ZALOGA + DOKUMENTI + VARNOST
// (R176 kandidat b-i; vzorec Projekti R171 / Termini R170).
// ---------------------------------------------------------------------------
// Motiv: refetch-on-focus je od R176 pokrit na VSEH operativnih površinah, a
// uporabnik na 3 površinah (zaloga, dokumenti, varnost) NI videl, KDAJ so
// podatki nazadnje sveži — pečat je obstojel samo na Termini kartici,
// Logistiki in Dashboard projektnem seznamu. R177 zaključi družino.
// Načela (vzorec R170/R171, vsaka odstopitev = bug):
//  1. Pečat = čas zadnjega USPEŠNEGA branja PRIMARNEGA vira površine
//     (zaloga → /api/inventory; dokumenti → /api/documents; varnost →
//     /api/weather). Napaka/omrežje → null (NIČ lažne svežine nad napako ali
//     praznim stanjem — fail-closed pečat).
//  2. EN VIR RESNICE: besedilo prihaja iz casOznaka() (@/lib/osvezitev-fokus,
//     sl-SI 24-urno s sekundami) — komponente NE formatirajo časa same.
//  3. Render vrata: pečat viden TOČNO TAKRAT, ko stanje != null (nikoli med
//     nalaganjem/nad napako); tight-header klasni niz IDENTIČEN R170/R171
//     (hidden sm:flex + History + tabular-nums + tooltip); flex-wrap
//     podnaslovna vrstica (brez prelivanja pri ozkih širinah).
//  4. R177 doslednost (fail-verbose vzorec R174/R175): documents-tab
//     selectedProject useEffect catch zdaj TUDI počisti zastarele dokumente
//     (prej samo toast — zastareli seznam bi ostal kot "svež").
// Varnostni pas (R165/R167 nauček): vsi source grepi imajo SCOPED vzorce.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

const zaloga = (): string => srcOf('src/components/roksal/inventory-tab.tsx')
const dokumenti = (): string => srcOf('src/components/roksal/documents-tab.tsx')
const varnost = (): string => srcOf('src/components/roksal/safety-tab.tsx')

describe('R177 P1 — zaloga pečat (inventory-tab)', () => {
  it('EN VIR RESNICE: casOznaka iz osvezitev-fokus + History ikona (brez lokalnega formatiranja pečata)', () => {
    const src = zaloga()
    expect(src).toContain("import { casOznaka } from '@/lib/osvezitev-fokus'")
    expect(src).toMatch(/\n  History,\n\} from 'lucide-react'/)
    expect(src).toContain('{casOznaka(zalogaOsvezitev)}')
  })

  it('žičenje: pečat nastavljen SAMO v uspešni veji invRes.ok (primarni vir = /api/inventory)', () => {
    const src = zaloga()
    expect(src).toMatch(/const \[zalogaOsvezitev, setZalogaOsvezitev\] = useState<Date \| null>\(null\)/)
    expect(src).toMatch(
      /setInventory\(data\)\s*\n\s*setInvError\(null\)\s*\n\s*setZalogaOsvezitev\(new Date\(\)\)/,
    )
    // natanko EN uspešen set (primarni vir; projektni dropdown ga NE pomakne)
    expect(src.match(/setZalogaOsvezitev\(new Date\(\)\)/g)).toHaveLength(1)
  })

  it('fail-closed pečat: !res.ok in catch počistita pečat (nikoli lažne svežine nad napako)', () => {
    const src = zaloga()
    expect(src.match(/setZalogaOsvezitev\(null\)/g)).toHaveLength(2)
    expect(src).toMatch(
      /setInvError\(`Zaloge ni bilo mogoče naložiti \(napaka \$\{invRes\.status\}\)\.`\)\s*\n\s*toast\.error\(`Zaloge ni bilo mogoče naložiti \(napaka \$\{invRes\.status\}\)`\)\s*\n\s*setZalogaOsvezitev\(null\)/,
    )
    expect(src).toMatch(
      /setInvError\('Zaloge ni bilo mogoče naložiti — preverite povezavo\.'\)\s*\n\s*toast\.error\('Zaloge ni bilo mogoče naložiti — preverite povezavo\.'\)\s*\n\s*setZalogaOsvezitev\(null\)/,
    )
  })

  it('render: tight-header pečat z IDENTIČNIM R170/R171 klasnim nizom + tooltip + tabular-nums', () => {
    const src = zaloga()
    expect(src).toContain('{zalogaOsvezitev && (')
    expect(src).toContain('className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"')
    expect(src).toContain('title="Čas zadnje uspešne osvežitve podatkov"')
    expect(src).toMatch(/<History className="h-3 w-3 shrink-0" aria-hidden="true" \/>/)
    expect(src).toMatch(/Osveženo ob <span className="tabular-nums">/)
  })
})

describe('R177 P1 — dokumenti pečat (documents-tab)', () => {
  it('žičenje: pečat nastavljen v OBEH uspešnih vejah branja dokumentov (loadAll + selectedProject useEffect)', () => {
    const src = dokumenti()
    expect(src).toContain("import { casOznaka } from '@/lib/osvezitev-fokus'")
    expect(src).toMatch(/const \[dokumentiOsvezitev, setDokumentiOsvezitev\] = useState<Date \| null>\(null\)/)
    expect(src.match(/setDokumentiOsvezitev\(new Date\(\)\)/g)).toHaveLength(2)
  })

  it('fail-closed pečat: !res.ok + catch v OBAH poteh počistita pečat in dokumente (4× null)', () => {
    const src = dokumenti()
    expect(src.match(/setDokumentiOsvezitev\(null\)/g)).toHaveLength(4)
    // vsak null je v paru s setDocuments([]) — nikoli pečata nad praznim stanjem
    expect(src.match(/setDocuments\(\[\]\)\s*\n\s*setDokumentiOsvezitev\(null\)/g)).toHaveLength(4)
    expect(src).toMatch(/setDocuments\(\[\]\)\s*\n\s*setDokumentiOsvezitev\(null\)\s*\n\s*toast\.error\('Dokumentov ni mogoče naložiti \(napaka strežnika\)'\)/)
  })

  it('R177 doslednost (fail-verbose R174/R175): selectedProject useEffect catch zdaj TUDI počisti zastarele dokumente', () => {
    const src = dokumenti()
    expect(src).toMatch(
      /\} catch \{\s*\n\s*\/\/ R177 — fail-verbose doslednost \(vzorec R174\/R175\): tudi omrežna napaka\s*\n\s*\/\/ počisti staro stanje \(nikoli zastarelih dokumentov kot svežih\);\s*\n\s*\/\/ pečat preneha trditi svežino nad odsotnimi podatki\.\s*\n\s*setDocuments\(\[\]\)\s*\n\s*setDokumentiOsvezitev\(null\)\s*\n\s*toast\.error\('Povezava ni uspela — podatki niso na voljo'\)/,
    )
  })

  it('render: tight-header pečat z IDENTIČNIM R170/R171 klasnim nizom + flex-wrap podnaslov', () => {
    const src = dokumenti()
    expect(src).toContain('{dokumentiOsvezitev && (')
    expect(src).toContain('className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"')
    expect(src).toContain('title="Čas zadnje uspešne osvežitve podatkov"')
    expect(src).toContain('flex flex-wrap items-center gap-x-2 gap-y-0.5')
    expect(src).toMatch(/Osveženo ob <span className="tabular-nums">\{casOznaka\(dokumentiOsvezitev\)\}/)
  })
})

describe('R177 P1 — varnost pečat (safety-tab)', () => {
  it('žičenje: pečat nastavljen SAMO v uspešni veji vremena; unmount stražar ohranjen', () => {
    const src = varnost()
    expect(src).toContain("import { casOznaka } from '@/lib/osvezitev-fokus'")
    expect(src).toMatch(/const \[vremeOsvezitev, setVremeOsvezitev\] = useState<Date \| null>\(null\)/)
    expect(src.match(/setVremeOsvezitev\(new Date\(\)\)/g)).toHaveLength(1)
    expect(src).toMatch(
      /setWindData\(data\)\s*\n\s*setVremeOsvezitev\(new Date\(\)\)/,
    )
    expect(src).toMatch(/if \(unmountedRef\.current\) return/)
  })

  it('fail-closed pečat: !res.ok (fail-closed R152) in catch počistita pečat — zastarel pečat bi bil lažna varnost', () => {
    const src = varnost()
    expect(src.match(/setVremeOsvezitev\(null\)/g)).toHaveLength(2)
    expect(src).toMatch(
      /setWindData\(null\)\s*\n\s*setVremeOsvezitev\(null\)\s*\n\s*setWeatherError\(`Vremenska storitev ni odgovorila \(napaka \$\{res\.status\}\)\.`\)/,
    )
    expect(src).toMatch(
      /setWindData\(null\)\s*\n\s*setVremeOsvezitev\(null\)\s*\n\s*setWeatherError\('Vremenskih podatkov ni mogoče pridobiti — preverite povezavo\.'\)/,
    )
  })

  it('render: tight-header pečat z IDENTIČNIM R170/R171 klasnim nizom + flex-wrap podnaslov', () => {
    const src = varnost()
    expect(src).toContain('{vremeOsvezitev && (')
    expect(src).toContain('className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"')
    expect(src).toContain('title="Čas zadnje uspešne osvežitve podatkov"')
    expect(src).toContain('flex flex-wrap items-center gap-x-2 gap-y-0.5')
    expect(src).toMatch(/Osveženo ob <span className="tabular-nums">\{casOznaka\(vremeOsvezitev\)\}/)
  })
})

describe('R177 P1 — družinska popolnost: pečat svežine na VSEH 6 površinah', () => {
  const površine: Array<[string, string]> = [
    ['Termini (R170)', 'src/components/roksal/termini-card.tsx'],
    ['Logistika (R170)', 'src/components/roksal/logistics-tab.tsx'],
    ['Dashboard projekti (R171)', 'src/components/roksal/dashboard-tab.tsx'],
    ['Zaloga (R177)', 'src/components/roksal/inventory-tab.tsx'],
    ['Dokumenti (R177)', 'src/components/roksal/documents-tab.tsx'],
    ['Varnost (R177)', 'src/components/roksal/safety-tab.tsx'],
  ]

  it.each(površine)('%s — vsebuje pečat (besedilo + History ikona + tabular-nums + tooltip)', (_ime, pot) => {
    const src = srcOf(pot)
    expect(src).toContain('Osveženo ob')
    expect(src).toMatch(/<History className="h-3 w-3 shrink-0" aria-hidden="true" \/>/)
    expect(src).toMatch(/Osveženo ob <span className="tabular-nums">/)
    expect(src).toMatch(/title="Čas zadnje uspešne osvežitve podatkov/)
  })

  it('tight-header varianti (vse razen Logistike) uporabljajo IDENTIČEN klasni niz hidden sm:flex', () => {
    for (const [, pot] of površine.filter(([ime]) => !ime.startsWith('Logistika'))) {
      expect(srcOf(pot)).toContain(
        'className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"',
      )
    }
  })

  it('EN VIR RESNICE: vsi 3 novi pečati izhajajo iz casOznaka (osvezitev-fokus) — brez novih Intl klicev v komponentah pečatov', () => {
    for (const [, pot] of površine.filter(([ime]) => ime.includes('R177'))) {
      const src = srcOf(pot)
      expect(src).toContain("import { casOznaka } from '@/lib/osvezitev-fokus'")
      expect(src.match(/casOznaka\(/g)!.length).toBeGreaterThanOrEqual(1)
    }
  })
})
