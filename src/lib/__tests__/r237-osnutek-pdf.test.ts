// R237 (P1-c 'izvozi' družina — PDF dimenzija, 4. člen) — NAROČILNICA OSNUTEK
// PDF: lib osnutek-pdf (družina R234/R235/R236 vzorec — ROKSAL glava, KPI,
// autoTable, noge, bajtni determinizem z client-safe FNV-1a, LASTNI soli
// 0x31–0x34) + PDF gumb v Osnutek dialogu (Material → Zaloga).
//
// ENA RESNICA: količina 'Naroči' = narociloKolicina (ISTA ENA formula kot
// odložišče R204 / CSV R205 — delegirana validacija: pokvaren artikel ALI
// artikel nad minimumom → ISTO TypeError); stolpci = TOČNO ISTI prerez kot
// CSV R205 (Šifra, Naziv, Enota, Zaloga, Min. zaloga, Naroči); BREZ CEN
// (R204/R205/R235); opombe LE ko obstajajo; SKUPNA količina NI KPI (različne
// enote se ne seštevajo — kos + m = ne-smisel).
//
// Tehnika dokazov (r234/r235/r236 vzorec): bajtni dokazi na bufferju (%PDF
// magija, %%EOF, determinizem); vsebinski dokazi na VIRU liba/komponente.
//
// + [Mandatory] stil (P1-f): focus-visible revizija 2. faza — skripta
//   r168-dark-scan.py razširjena na fokus družino (ne-navy focus-visible
//   ringi = kandidati, izjeme whitelist); zagon po reviziji runde R236+R237:
//   LE dokumentirane izjeme (white/60 temne površine + ring-red destructive).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildOsnutekPdfDoc,
  generateOsnutekPdf,
  osnutekPdfFilename,
  type OsnutekPdfOptions,
} from '@/lib/osnutek-pdf'
import { narociloKolicina, type ZalogaArtikelZaNarocilo } from '@/lib/zaloga-povzetek'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

const komponenta = beri('src/components/roksal/inventory-tab.tsx')
const lib = beri('src/lib/osnutek-pdf.ts')
const darkScan = beri('scripts/r168-dark-scan.py')

const ZDANJ: Date = new Date(2026, 8, 28, 10, 0, 0) // fiksen vhod — determinizem

const ARTIKLI: ZalogaArtikelZaNarocilo[] = [
  { id: 'a1', sifraMateriala: 'WPC-120-A', naziv: 'WPC deska 120 A2', kolicinaZaloga: 12, enota: 'm', minimalnaZaloga: 50 },
  { id: 'a2', sifraMateriala: 'INOX-8X60', naziv: 'Inox vijak A2 8x60', kolicinaZaloga: 40, enota: 'kos', minimalnaZaloga: 100 },
]

const OPCIJE: OsnutekPdfOptions = { now: ZDANJ }

function pdfBajti(
  seznam: readonly ZalogaArtikelZaNarocilo[],
  options?: Partial<OsnutekPdfOptions>,
): Buffer {
  const doc = buildOsnutekPdfDoc(seznam, { now: ZDANJ, ...options })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R237 — osnutek-pdf: pravi artefakt + determinizem (R121/R234/R235/R236 vzorec)', () => {
  it('izhod je veljaven PDF (%PDF magični bajti + %%EOF)', () => {
    const b = pdfBajti(ARTIKLI)
    expect(b.length).toBeGreaterThan(1000)
    expect(b.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(b.subarray(-6).toString('ascii').trim()).toBe('%%EOF')
  })

  it('DETERMINIZEM: enak vhod = bajtno enak PDF (setCreationDate + FNV-1a, NIČ crypto uvoza)', () => {
    const a = pdfBajti(ARTIKLI)
    const b = pdfBajti(ARTIKLI)
    expect(a.equals(b)).toBe(true)
    expect(lib).not.toContain("from 'node:crypto'")
    expect(lib).not.toContain('Math.random')
  })

  it('različen `now` → različen PDF (žig je del identitete dokumenta)', () => {
    const a = pdfBajti(ARTIKLI)
    const b = pdfBajti(ARTIKLI, { now: new Date(ZDANJ.getTime() + 60_000) })
    expect(a.equals(b)).toBe(false)
  })

  it('različna zaloga → različen PDF (količina je del file-ID semena)', () => {
    const a = pdfBajti(ARTIKLI)
    const drugi = pdfBajti([{ ...ARTIKLI[0], kolicinaZaloga: 5 }, ...ARTIKLI.slice(1)])
    expect(a.equals(drugi)).toBe(false)
  })

  it('opombe so del identitete dokumenta (prisotne LE ko obstajajo)', () => {
    const a = pdfBajti(ARTIKLI, { opombe: 'dostava do petka' })
    const b = pdfBajti(ARTIKLI, { opombe: 'druga opomba' })
    expect(a.equals(b)).toBe(false)
  })

  it('file-ID soli so LASTNE družini (0x31–0x34 — 4. lib: zaloga 0x01/naročilnica 0x11/dobavitelji 0x21)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0x31)')
    expect(lib).toContain('fnv1aHex(seed, 0x34)')
  })
})

describe('R237 — osnutek-pdf: fail-closed pogodba (delegirana ENA resnica)', () => {
  it('PRAZEN seznam → TypeError (ni prazne datoteke — R232–R236 družina)', () => {
    expect(() => buildOsnutekPdfDoc([], OPCIJE)).toThrowError(
      /prazen seznam ne nastaja dokumenta/,
    )
  })

  it('pokvaren artikel → ISTO TypeError sporočilo kot narociloKolicina (delegacija)', () => {
    const pokvaren = { ...ARTIKLI[0], naziv: '   ' }
    let odLiba = ''
    try {
      narociloKolicina(pokvaren)
    } catch (e) {
      odLiba = (e as TypeError).message
    }
    expect(odLiba).not.toBe('')
    expect(() => buildOsnutekPdfDoc([pokvaren], OPCIJE)).toThrowError(odLiba)
  })

  it('artikel NAD minimumom → ISTO TypeError kot narociloKolicina (osnutek je LE za pod-minimum)', () => {
    const visok = { ...ARTIKLI[0], kolicinaZaloga: 200, minimalnaZaloga: 50 }
    let odLiba = ''
    try {
      narociloKolicina(visok)
    } catch (e) {
      odLiba = (e as TypeError).message
    }
    expect(odLiba).not.toBe('')
    expect(() => buildOsnutekPdfDoc([visok], OPCIJE)).toThrowError(odLiba)
  })

  it('neveljaven now → TypeError (determinizem pogodba — filename IN dokument)', () => {
    expect(() => buildOsnutekPdfDoc(ARTIKLI, { now: new Date(NaN) })).toThrowError(TypeError)
    expect(() => osnutekPdfFilename(new Date(NaN))).toThrowError(TypeError)
  })

  it('osnutekPdfFilename: osnutek-narocilnica-{ISTI dan kot CSV stamp}.pdf (ločen od POSLANE R235)', () => {
    expect(osnutekPdfFilename(ZDANJ)).toBe('osnutek-narocilnica-2026-09-28.pdf')
  })

  it('blank opombe → brez omembe (R206/R227 pravilo — brez izmišljenega konteksta)', () => {
    expect(lib).toContain("const opombe = typeof options.opombe === 'string' ? options.opombe.trim() : ''")
    expect(lib).toContain("if (opombe !== '')")
  })
})

describe('R237 — ENA resnica: PDF tabela = ISTI prerez kot CSV R205 (WYSIWYG)', () => {
  it('količina Naroči = narociloKolicina (ISTA ENA formula — delegacija v libu)', () => {
    expect(lib).toContain('narociloKolicina(a)')
    expect(lib).toContain('artikli.map((a) => narociloKolicina(a))')
  })

  it('tabela: glava = TOČNO ISTI prerez kot CSV R205 (Šifra/Naziv/Enota/Zaloga/Min. zaloga/Naroči)', () => {
    expect(lib).toContain("head: [['Šifra', 'Naziv', 'Enota', 'Zaloga', 'Min. zaloga', 'Naroči']]")
    // CSV R205 nosi ISTI prerez (komponenta — vir resnice za izvozni družini).
    expect(komponenta).toContain("['Šifra', 'Naziv', 'Enota', 'Zaloga', 'Min. zaloga', 'Naroči']")
  })

  it('BREZ cen v dokumentu (R204/R205/R235 pravilo — vrednosti ostanejo v aplikaciji)', () => {
    expect(lib).not.toContain("'Cena'")
    expect(lib).not.toContain('a.cenaEur')
    expect(lib).not.toContain('.toFixed')
  })

  it('KPI iz vrstic: Postavke + Različne enote prek Set — SKUPNA količina NI KPI (kos + m = ne-smisel)', () => {
    expect(lib).toContain('new Set(artikli.map((a) => a.enota.trim()))')
    expect(lib).toContain("kpiBox(doc, 14, y, bw, bh, 'Postavke', String(artikli.length), NAVY)")
    expect(lib).toContain("kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Različne enote', String(enote.size), NAVY)")
    expect(lib).not.toContain("'Naroči skupaj'")
    expect(lib).not.toContain('kolicine.reduce')
  })

  it("sklepna vrstica: ISTA sklanjatev (zalogaPovzetekBeseda) + ISTI žig (zalogaPovzetekCasOznaka) + interni podnaslov", () => {
    expect(lib).toContain('zalogaPovzetekBeseda(artikli.length)')
    expect(lib).toContain('zalogaPovzetekCasOznaka(now)')
    expect(lib).toContain('Interni dokument — priprava naročilnega osnutka')
  })

  it('generateOsnutekPdf shrani z osnutekPdfFilename (WYSIWYG ime — družina R234/R235/R236)', () => {
    expect(lib).toContain('doc.save(osnutekPdfFilename(options.now))')
    expect(typeof generateOsnutekPdf).toBe('function')
  })

  it('NAROČILNICA OSNUTEK naslov (ločen dokument od POSLANE NAROČILNICE R235)', () => {
    expect(lib).toContain("doc.text('NAROČILNICA OSNUTEK', 196, 12, { align: 'right' })")
    expect(lib).toContain('registerSloPdfFonts(doc)')
  })
})

describe('R237 — komponenta: PDF gumb v Osnutek dialogu (ISTI družina R234/R235/R236)', () => {
  it('gumb obstaja z aria + title + disabled na 0 (ISTO semantiko kot CSV sorojec)', () => {
    expect(komponenta).toContain('aria-label="Prenesi naročilnico vidnih artiklov kot PDF"')
    expect(komponenta).toContain('Naročilnica osnutka kot pravi PDF — interni pregled pred pošiljanjem')
    const z = komponenta.indexOf('aria-label="Prenesi naročilnico vidnih artiklov kot PDF"')
    const blok = komponenta.slice(Math.max(0, z - 500), z)
    expect(blok).toContain('onClick={prenesiOsnutekPdf}')
    expect(blok).toContain('disabled={osnutekArtikli.length === 0}')
  })

  it('handler: EN now za dokument IN ime + opombe iz dialoga (passthrough, blank → lib spusti)', () => {
    const z = komponenta.indexOf('function prenesiOsnutekPdf')
    const k = komponenta.indexOf('const selectedItem =')
    const h = komponenta.slice(z, k)
    expect(h).toContain('const now = new Date()')
    expect(h).toContain('buildOsnutekPdfDoc(osnutekArtikli, {')
    expect(h).toContain('opombe: osnutekOpombe,')
    expect(h).toContain('osnutekPdfFilename(now)')
  })

  it('fail-verbose: TypeError → viden razlog; ostalo → Izvoz PDF ni uspel (sonner API — družina R234–R236)', () => {
    expect(komponenta).toContain("toast.error('Osnutka PDF ni mogoče sestaviti iz teh artiklov', { description: err.message })")
    expect(komponenta).toContain('Izvoz PDF ni uspel: ')
  })

  it('prazno stanje guard: 0 artiklov → iskren toast (ISTO kot CSV sorojec R205)', () => {
    const z = komponenta.indexOf('function prenesiOsnutekPdf')
    const h = komponenta.slice(z, komponenta.indexOf('const selectedItem ='))
    expect(h).toContain("'Ni artiklov pod minimalno zalogo — nič za naročilo.'")
  })
})

describe('R237 — [Mandatory] stil (P1-f): focus-visible revizija 2. faza — skripta fokus družina', () => {
  it('r168-dark-scan.py pokriva fokus družino (ne-navy focus-visible ring = kandidat)', () => {
    expect(darkScan).toContain('fokus')
    expect(darkScan).toContain('focus-visible:ring-')
  })

  it('dokumentirane izjeme fokus revizije v skripti (white/60 temne površine + red destructive)', () => {
    expect(darkScan).toContain('white/60 canvas')
    expect(darkScan).toContain('red- destructive')
    expect(darkScan).toContain('ring-ring shadcn')
  })

  it('app glavni fokus ostaja roksal-navy/40 (revizija R236 konverzije ostanejo)', () => {
    expect(komponenta).toContain('focus-visible:ring-2 focus-visible:ring-roksal-navy/40 disabled:opacity-50')
    const racuni = beri('src/components/roksal/invoice-manager.tsx')
    expect(racuni).not.toContain('focus-visible:ring-amber-500/50')
    expect(racuni).not.toContain('focus-visible:ring-emerald-400/50')
  })
})
