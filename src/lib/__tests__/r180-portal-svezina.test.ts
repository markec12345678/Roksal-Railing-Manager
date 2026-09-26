// R180 — SVEŽINA TUDI ZA STRANKO: javni portal /[token] dobi (a) pečat
// 'Osveženo ob' v statusni kartici (družina svežine, 10. površina — prva
// STRANŠKA) in (b) banner 'na voljo je nova verzija' (montaža UpdateBanner,
// worklog P1-d).
// ---------------------------------------------------------------------------
// (a) Strežniški izris teče v UTC (Vercel funkcije) — brez eksplicitnega
//     časovnega pasu bi Intl uporabil pas GOSTITELJA in pečat bi LAŽNO
//     pokazal UTC uro namesto slovenske. casOznaka zato dobi opcijski
//     casovniPas (nazaj-kompatibilno — client klici 9 notranjih površin ne
//     podajo pasu = enako vedenje kot prej).
// (b) Fail-closed meje: na NotFound poteh portala NI pečata (ni naloženih
//     podatkov — nikoli lažnega svežine); banner ima ISTO čisto jedro
//     (posodobitev-jedro R179, tu ni ponovno testirano — samo montaža).
// Varnostni pas (R165/R167 nauček): source trditve nad kodo BREZ komentarjev
// (codeOf), SCOPED vzorci — komentarji omenjajo stare klase.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { casOznaka } from '@/lib/osvezitev-fokus'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

/** Koda BREZ komentarjev (line + JSX blok) — trditve nad klasami NE smejo zadeti
 *  dokumentacijskih omemb (vzorec R179: komentar omenja stare klase). */
const codeOf = (p: string): string =>
  srcOf(p).replace(/\/\/[^\n]*/g, '').replace(/\{\/\*[\s\S]*?\*\//g, '')

describe('R180 — casOznaka z eksplicitnim casovniPas (strežniški izris determinističen)', () => {
  const POLETJE = new Date('2026-09-26T14:30:45.000Z') // CEST = UTC+2
  const ZIMA = new Date('2026-01-15T14:30:45.000Z') // CET = UTC+1

  it('ekspliciten pas UTC → ura je točno UTC (14:30:45)', () => {
    expect(casOznaka(POLETJE, { casovniPas: 'UTC' })).toBe('14:30:45')
  })

  it('Europe/Ljubljana poleti → UTC+2 (16:30:45) — pečat pokaže slovensko uro', () => {
    expect(casOznaka(POLETJE, { casovniPas: 'Europe/Ljubljana' })).toBe('16:30:45')
  })

  it('Europe/Ljubljana pozimi → UTC+1 (15:30:45) — pas se pravilno preklaplja', () => {
    expect(casOznaka(ZIMA, { casovniPas: 'Europe/Ljubljana' })).toBe('15:30:45')
  })

  it('nazaj-kompatibilnost: brez moznosti (ali casovniPas undefined) → ISTI izpis kot prej (uporabnikova ura)', () => {
    // Format nespremenjen: sl-SI, 24-urno s sekundami (družina 'Osveženo ob').
    expect(casOznaka(POLETJE)).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    expect(casOznaka(POLETJE, { casovniPas: undefined })).toBe(casOznaka(POLETJE))
  })

  it('fail-closed: pokvarjen datum → TypeError (obnašanje nespremenjeno)', () => {
    expect(() => casOznaka('ni datum' as never)).toThrow(TypeError)
    expect(() => casOznaka(new Date('neveljaven'))).toThrow(TypeError)
  })

  it('fail-closed: pokvarjene moznosti → TypeError (ne-objekt; prazen/ne-string pas)', () => {
    expect(() => casOznaka(POLETJE, 'UTC' as never)).toThrow(TypeError)
    expect(() => casOznaka(POLETJE, { casovniPas: '' })).toThrow(TypeError)
    expect(() => casOznaka(POLETJE, { casovniPas: 42 as never })).toThrow(TypeError)
  })

  it('neveljaven pas vrednost → RangeError od Intl (nikoli tihega napačnega izrisa)', () => {
    expect(() => casOznaka(POLETJE, { casovniPas: 'Mars/Phobos' })).toThrow(RangeError)
  })
})

describe('R180 — portal /[token] žičenje pečata (EN VIR + fail-closed meje)', () => {
  const code = (): string => codeOf('src/app/portal/[token]/page.tsx')

  it('EN VIR: pečat iz casOznaka — komponenta NE formatira sama (ni lokalnega toLocaleTimeString)', () => {
    const src = code()
    expect(src).toContain("import { casOznaka } from '@/lib/osvezitev-fokus'")
    expect(src).toContain("casOznaka(new Date(), { casovniPas: 'Europe/Ljubljana' })")
    expect(src.match(/toLocaleTimeString/g)).toBeNull()
  })

  it('pečat v statusni kartici: ločilna vrsta + History ikona + tabular-nums + tooltip semantika', () => {
    const src = code()
    expect(src).toContain('border-t border-border pt-2.5')
    expect(src).toContain('title="Čas nalaganja podatkov te strani"')
    expect(src).toContain('Osveženo ob <span className="tabular-nums">{osvezitevCas}</span>')
    expect(src).toContain('<History className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />')
  })

  it('fail-closed: pečat je IZKLJUČNO na strani z podatki — na NotFound poteh NI pečata', () => {
    const src = srcOf('src/app/portal/[token]/page.tsx')
    // Točno ENA izrisna točka pečata (v glavnem return; NotFoundPage je ločena
    // funkcija BREZ osvezitevCas — nikoli lažnega 'svežine' nad 404).
    expect(src.match(/Osveženo ob <span className="tabular-nums">/g)?.length).toBe(1)
    const notFoundIdx = src.indexOf('function NotFoundPage')
    const stampIdx = src.indexOf('Osveženo ob <span')
    expect(notFoundIdx).toBeGreaterThan(-1)
    expect(stampIdx).toBeGreaterThan(-1)
    expect(stampIdx).toBeLessThan(notFoundIdx)
  })

  it('pečat je nastanjen ŠELE po vsem branju podatkov (db + slike + timeline)', () => {
    const src = code()
    const približki = src.indexOf('const osvezitevCas = casOznaka(')
    // Po hydrataciji slik (Promise.all → gallerySections) in po timeline mapi:
    const slike = src.indexOf('const gallerySections')
    const timeline = src.indexOf('.filter((t) => t.title)')
    expect(približki).toBeGreaterThan(slike)
    expect(približki).toBeGreaterThan(timeline)
  })
})

describe("R180 — banner 'na voljo je nova verzija' TUDI na portalu (montaža P1-d)", () => {
  const code = (): string => codeOf('src/app/portal/[token]/page.tsx')

  it('UpdateBanner montiran točko ENKRAT kot prvi element v <main> (pred statusno kartico)', () => {
    const src = code()
    expect(src).toContain("import { UpdateBanner } from '@/components/roksal/update-banner'")
    expect(src.match(/<UpdateBanner \/>/g)?.length).toBe(1)
    const mainIdx = src.indexOf('<main')
    const bannerIdx = src.indexOf('<UpdateBanner />')
    const prvaSekcija = src.indexOf('<section')
    expect(mainIdx).toBeGreaterThan(-1)
    expect(bannerIdx).toBeGreaterThan(mainIdx)
    expect(bannerIdx).toBeLessThan(prvaSekcija)
  })

  it('app lupina nespremenjena (regresija R179): banner še vedno montiran izven VizTab produkta', () => {
    expect(srcOf('src/app/page.tsx')).toMatch(/\{activeTab !== 'viz' && <UpdateBanner \/>\}/)
  })
})

// R180 — prevzeto delo predhodne seje (umrla sredi runde, delo OHRANJENO):
// pečati svežine za RAIČUNE (invoice-manager) in VODJIN PREGLED
// (vodja-dashboard) — 10. in 11. notranja površina družine (R170-R178: 9).
// Strukturni vzorec R178: set SAMO v uspešni veji (1×), null v VSEH fail
// vejah v paru s čiščenjem podatkov, družinski hook useRefetchOnFocus,
// tight-header klasni niz IDENTIČEN družini, EN VIR casOznaka.
describe('R180 — pečat RAIČUNI (invoice-manager — 10. notranja površina)', () => {
  const src = (): string => srcOf('src/components/roksal/invoice-manager.tsx')

  it('set SAMO ob uspešnem branju (1×) — v paru z setInvoices', () => {
    const s = src()
    expect(s.match(/setRacuniOsvezitev\(new Date\(\)\)/g)?.length).toBe(1)
    // set v istem bloku kot uspešno branje seznama (nikoli pečata brez podatkov)
    expect(s).toMatch(/setInvoices\(await res\.json\(\)\)\s*\n\s*\/\/ R180: pečat SAMO ob uspešnem branju \(1×\)\s*\n\s*setRacuniOsvezitev\(new Date\(\)\)/)
  })

  it('fail-closed: !res.ok VEJA in catch → pečat null (zastarel seznam ostane, a BREZ pečata)', () => {
    const s = src()
    expect(s.match(/setRacuniOsvezitev\(null\)/g)?.length).toBe(2)
    expect(s).toMatch(/\} else \{\s*\n\s*\/\/ fail-closed pečat: napaka → zastarel seznam ostane, a brez pečata\s*\n\s*setRacuniOsvezitev\(null\)/)
    expect(s).toMatch(/\/\/ offline — obdrži stanje; pečat počisti \(NIČ lažne svežine\)\s*\n\s*setRacuniOsvezitev\(null\)/)
  })

  it('družinski hook: useRefetchOnFocus(loadInvoices) — EN VIR loader (mount + mutacije + fokus)', () => {
    const s = src()
    expect(s).toContain("import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'")
    expect(s).toMatch(/useRefetchOnFocus\(loadInvoices\)/)
  })

  it('tight-header klasni niz IDENTIČEN družini (hidden sm:flex + History + tabular-nums + tooltip)', () => {
    const s = src()
    expect(s).toContain('className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"')
    expect(s).toContain('title="Čas zadnje uspešne osvežitve podatkov"')
    expect(s).toContain('<History className="h-3 w-3 shrink-0" aria-hidden="true" />')
    expect(s).toMatch(/\{racuniOsvezitev && \(/)
    expect(s).toContain("Osveženo ob{' '}")
    expect(s).toContain('<span className="tabular-nums">{casOznaka(racuniOsvezitev)}</span>')
  })

  it('EN VIR: casOznaka uvoz — komponenta NE formatira sama (ni lokalnega toLocaleTimeString)', () => {
    const s = src()
    expect(s).toContain("import { casOznaka } from '@/lib/osvezitev-fokus'")
    expect(s.match(/toLocaleTimeString/g)).toBeNull()
  })
})

describe('R180 — pečat VODJA pregled (vodja-dashboard — 11. notranja površina)', () => {
  const src = (): string => srcOf('src/components/roksal/vodja-dashboard.tsx')

  it('set SAMO ko so VSEH 7 virov uspešno prebrani (1× — enoten trenutek svežine)', () => {
    const s = src()
    expect(s.match(/setVodjaOsvezitev\(new Date\(\)\)/g)?.length).toBe(1)
    // set ŠELE po nastanitvi allProjects/allInvoices (izvoz PDF iz teh držav)
    expect(s).toMatch(/setAllInvoices\(invoices as InvLite\[\]\)\s*\n\s*\/\/ R180: pečat = vseh 7 virov uspešno prebranih/)
  })

  it('fail-closed: TILT clearOnFail počisti pečat — vse 3 fail poti (status, neveljaven, omrežje) skozi ENO funkcijo', () => {
    const s = src()
    expect(s.match(/setVodjaOsvezitev\(null\)/g)?.length).toBe(1)
    // clearOnFail klican v vseh treh fail vejah loadData
    expect(s.match(/clearOnFail\(\)/g)?.length).toBe(3)
  })

  it('družinski hook: useRefetchOnFocus(loadData) — EN VIR (mount + Poskusi znova + fokus)', () => {
    const s = src()
    expect(s).toContain("import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'")
    expect(s).toMatch(/useRefetchOnFocus\(loadData\)/)
  })

  it('tight-header klasni niz IDENTIČEN družini + pogojni izris samo nad svežimi podatki', () => {
    const s = src()
    expect(s).toContain('className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"')
    expect(s).toContain('title="Čas zadnje uspešne osvežitve podatkov"')
    expect(s).toContain('<History className="h-3 w-3 shrink-0" aria-hidden="true" />')
    expect(s).toMatch(/\{vodjaOsvezitev && \(/)
    expect(s).toContain('<span className="tabular-nums">{casOznaka(vodjaOsvezitev)}</span>')
  })
})
