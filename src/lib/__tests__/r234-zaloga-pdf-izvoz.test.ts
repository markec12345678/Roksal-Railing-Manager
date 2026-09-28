// R234 (P1-c 'izvozi' družina — PDF dimenzija) — Stanje zaloge PDF izvoz iz
// Material → Zaloga: lib zaloga-pdf (boss-report vzorec — ROKSAL glava, KPI,
// autoTable, noge; document-pdf determinizem — setCreationDate + setFileId,
// client-safe FNV-1a namesto node:crypto) + gumb v inventory-tab.
//
// ENA RESNICA: tabela PDF = TOČNO ISTI prerez/strogost kot CSV R136/R226
// ('Nizka' = <=; 'Brez dobavitelja' = _count?.prices === 0 DOBESLEDNO).
//
// Fail-closed: pokvaren artikel / neveljaven čip / PRAZEN seznam → TypeError
// (ni prazne datoteke — R232/R233 družina); komponenta pokaže iskren toast.
//
// + [Mandatory] stil (P1-f): nevtralne status veje gray → žetoni (5 mest:
//   crm NEAKTIVEN, logistics UPOKOJENO, material-intelligence neznana veja
//   ×2, roksal-catalog MATERIAL_BADGE fallback, dashboard 'Načrtovano'
//   palica) — en razred obe temi, 0 novih hex; sorojenci ostanejo semantični.
// + [Mandatory] infra (P1-d): e2e-lib.sh dobi eb_pocakaj_tekst
//   (body.textContent.includes se ponavlja od r228 — IIFE pogodba ZAPRTA).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildZalogaPdfDoc,
  generateZalogaPdf,
  preveriZalogaPdfArtikel,
  zalogaPdfFilename,
  type ZalogaPdfArtikel,
} from '@/lib/zaloga-pdf'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

const komponenta = beri('src/components/roksal/inventory-tab.tsx')
const lib = beri('src/lib/zaloga-pdf.ts')

const ZDANJ: Date = new Date(2026, 8, 28, 10, 0, 0) // fiksen vhod — determinizem

const ARTIKLI: ZalogaPdfArtikel[] = [
  {
    sifraMateriala: 'WPC-120-A',
    naziv: 'WPC deska 120',
    tip: 'WPC',
    enota: 'm',
    kolicinaZaloga: 40,
    minimalnaZaloga: 50,
    _count: { prices: 0 },
  },
  {
    sifraMateriala: 'INOX-A2-8',
    naziv: 'Inox vijak A2 8x60',
    tip: 'Inox',
    enota: 'kos',
    kolicinaZaloga: 12,
    minimalnaZaloga: 12,
    _count: { prices: 2 },
  },
  {
    sifraMateriala: 'ALU-P50',
    naziv: 'Alu profil 50',
    tip: 'Aluminij',
    enota: 'm',
    kolicinaZaloga: 80,
    minimalnaZaloga: 30,
  },
]

function pdfBajti(artikli: readonly ZalogaPdfArtikel[], options?: Partial<Parameters<typeof buildZalogaPdfDoc>[1]>): Buffer {
  const doc = buildZalogaPdfDoc(artikli, { now: ZDANJ, ...options })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R234 — zaloga-pdf: pravi artefakt + determinizem (document-pdf R121 vzorec)', () => {
  it('izhod je veljaven PDF (%PDF magični bajti + %%EOF)', () => {
    const b = pdfBajti(ARTIKLI)
    expect(b.length).toBeGreaterThan(1000)
    expect(b.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(b.subarray(-6).toString('ascii').trim()).toBe('%%EOF')
  })

  it('DETERMINIZEM: enak vhod = bajtno enak PDF (setCreationDate + FNV-1a file-ID, NIČ Math.random)', () => {
    const a = pdfBajti(ARTIKLI)
    const b = pdfBajti(ARTIKLI)
    expect(a.equals(b)).toBe(true)
  })

  it('različen `now` → različen PDF (žig je del identitete dokumenta)', () => {
    const a = pdfBajti(ARTIKLI)
    const b = pdfBajti(ARTIKLI, { now: new Date(2026, 8, 28, 10, 0, 1) })
    expect(a.equals(b)).toBe(false)
  })

  it('različna zaloga → različen PDF (vsebina je del file-ID semena)', () => {
    const a = pdfBajti(ARTIKLI)
    const b = pdfBajti([{ ...ARTIKLI[0], kolicinaZaloga: 41 }, ARTIKLI[1], ARTIKLI[2]])
    expect(a.equals(b)).toBe(false)
  })
})

describe('R234 — zaloga-pdf: fail-closed pogodba (ni izmišljenih dokumentov)', () => {
  it('PRAZEN seznam → TypeError (ni prazne datoteke — R232/R233 družina)', () => {
    expect(() => pdfBajti([])).toThrow(TypeError)
    expect(() => pdfBajti([])).toThrow(/prazen seznam ne nastaja dokumenta/i)
  })

  it('pokvaren artikel → TypeError (negativna zaloga / prazen naziv / pokvarena enota)', () => {
    expect(() =>
      pdfBajti([{ ...ARTIKLI[0], kolicinaZaloga: -1 }]),
    ).toThrow(TypeError)
    expect(() => pdfBajti([{ ...ARTIKLI[0], naziv: '  ' }])).toThrow(TypeError)
    expect(() => pdfBajti([{ ...ARTIKLI[0], enota: '' }])).toThrow(TypeError)
    expect(() => pdfBajti([{ ...ARTIKLI[0], minimalnaZaloga: Number.NaN }])).toThrow(TypeError)
  })

  it('preveriZalogaPdfArtikel pokaže indeks krivca (razvidnost napake)', () => {
    expect(() => preveriZalogaPdfArtikel({ ...ARTIKLI[0], sifraMateriala: '' }, 3)).toThrow(
      /\(3\)/,
    )
  })

  it("neveljaven čip → TypeError; veljaven čip 'pod' → veljaven PDF", () => {
    expect(() => pdfBajti(ARTIKLI, { cip: 'poljuben' as 'pod' })).toThrow(TypeError)
    const b = pdfBajti(ARTIKLI, { cip: 'pod' })
    expect(b.subarray(0, 5).toString('ascii')).toBe('%PDF-')
  })

  it('ime datoteke deterministično (ISTI dan kot todayStamp CSV izvoza)', () => {
    expect(zalogaPdfFilename(ZDANJ)).toBe('zaloga-2026-09-28.pdf')
    expect(zalogaPdfFilename(new Date(2027, 0, 3, 23, 59))).toBe('zaloga-2027-01-03.pdf')
    expect(() => zalogaPdfFilename(new Date(Number.NaN))).toThrow(TypeError)
  })
})

describe('R234 — ENA resnica: PDF tabela = ISTI prerez/strogost kot CSV R136/R226', () => {
  it('Brez dobavitelja = _count?.prices === 0 DOBESLEDNO (lib = CSV = žig R227)', () => {
    expect(lib).toContain("a._count?.prices === 0 ? 'DA' : 'NE'")
    expect(komponenta).toContain("item._count?.prices === 0 ? 'DA' : 'NE'")
    // NIKOLI ohlapnejše forme v libu (fail-closed: brez ?? 0 / <= 0).
    expect(lib).not.toContain('_count?.prices ?? 0')
  })

  it('Nizka = kolicinaZaloga <= minimalnaZaloga (ISTI prerez kot CSV R136 in čip R219)', () => {
    expect(lib).toContain("a.kolicinaZaloga <= a.minimalnaZaloga ? 'DA' : 'NE'")
  })

  it('glava tabele = ISTI stolpci kot CSV R136/R226', () => {
    expect(lib).toContain("['Šifra', 'Naziv', 'Tip', 'Enota', 'Zaloga', 'Min.', 'Nizka', 'Brez dobavitelja']")
  })

  it('KPI se računajo iz vrstic (dokument notranje skladen — komponenta ne posreduje števcev)', () => {
    expect(lib).toContain('artikli.filter((a) => a.kolicinaZaloga <= a.minimalnaZaloga).length')
    expect(lib).toContain('artikli.filter((a) => a._count?.prices === 0).length')
  })

  it('kontekst LE če dejansko aktiven (R227 pravilo — \'Vse\' → brez omembe)', () => {
    expect(lib).toContain("options.kategorija.trim() !== ''")
    expect(komponenta).toContain("filter === 'ALL' ? null :")
  })

  it('generateZalogaPdf shrani z zalogaPdfFilename (WYSIWYG ime)', () => {
    expect(lib).toContain('doc.save(zalogaPdfFilename(options.now))')
  })
})

describe('R234 — komponenta: PDF gumb (ISTI pill družina kot CSV R136)', () => {
  it('gumb obstaja z aria + title (a11y družina R231/R233)', () => {
    expect(komponenta).toContain('aria-label="Izvozi vidno zalogo kot PDF"')
    expect(komponenta).toContain('title="Izvozi vidno zalogo (upošteva filter) kot PDF poročilo"')
  })

  it('handler: fail-closed guard pri 0 vidnih + fail-verbose catch (NIČ tihe degradacije)', () => {
    expect(komponenta).toContain("toast.error('Ni artiklov za izvoz.')")
    expect(komponenta).toContain('Izvoz PDF ni uspel:')
  })

  it('handler pošlje ISTO množico kot CSV (filtered) + čip preslikava pod/na/brez', () => {
    expect(komponenta).toContain("cip: podMinOnly ? 'pod' : naMinOnly ? 'na' : brezDobaviteljaOnly ? 'brez' : null")
    expect(komponenta).toContain('tip: typeLabels[item.tip] || item.tip')
  })
})

describe('R234 — [Mandatory] stil (P1-f): nevtralne status veje gray → žetoni', () => {
  it('crm NEAKTIVEN → bg-muted žetoni (R229 Zapadlo vzorec)', () => {
    const src = beri('src/components/roksal/crm-tab.tsx')
    expect(src).toContain("NEAKTIVEN: 'bg-muted text-muted-foreground border-border'")
    expect(src).not.toContain("NEAKTIVEN: 'bg-gray-100")
  })

  it('logistics UPOKOJENO → bg-muted žetoni (sorojenci ostanejo semantični)', () => {
    const src = beri('src/components/roksal/logistics-tab.tsx')
    expect(src).toContain("UPOKOJENO: 'bg-muted text-muted-foreground border-border'")
    expect(src).not.toContain("UPOKOJENO: 'bg-gray-100")
  })

  it('material-intelligence neznana veja (lib + JSX) → žetoni', () => {
    const src = beri('src/components/roksal/material-intelligence-tab.tsx')
    expect(src).not.toContain("'bg-gray-50 dark:bg-gray-950/40 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-800'")
    // Obe mesti zdaj žetoni:
    expect(src.match(/'bg-muted text-muted-foreground border-border'/g)?.length).toBe(2)
  })

  it('roksal-catalog MATERIAL_BADGE fallback → žetoni (znani ostanejo semantični)', () => {
    const src = beri('src/components/roksal/roksal-catalog.tsx')
    expect(src).toContain("cls: 'bg-muted text-muted-foreground'")
    expect(src).not.toContain("'bg-gray-100 dark:bg-gray-500/15 text-gray-800 dark:text-gray-200'")
  })

  it("dashboard 'Načrtovano' palica → bg-muted-foreground (R226 pika vzorec)", () => {
    const src = beri('src/components/roksal/dashboard-tab.tsx')
    expect(src).toContain("color: 'bg-muted-foreground', textColor: 'text-muted-foreground'")
    expect(src).not.toContain("'bg-gray-300 dark:bg-gray-500'")
  })

  it('measurements statusColors + status filtri OSNUTEK/ARHIVIRANA → žetoni (line-through semantika arhiva ostane)', () => {
    const src = beri('src/components/roksal/measurements-tab.tsx')
    expect(src).toContain("OSNUTEK: 'bg-muted text-muted-foreground border-border'")
    expect(src).toContain("ARHIVIRANA: 'bg-muted text-muted-foreground border-border line-through'")
    // Filtrski čipi (neaktivna + aktivna 'solid' nevtralna veja):
    expect(src).toContain("'bg-muted-foreground text-white border-muted-foreground'")
    // Gray unikati izginili (POTRJENA ostane semantična; beton = DOKUMENTIRANA
    // materialna palete — r231 izjema, drugačen tekst-gray-700):
    expect(src).not.toContain('bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-400')
    expect(src).not.toContain('bg-gray-50 dark:bg-gray-950/40 text-gray-400 border-gray-200')
    expect(src).not.toContain('bg-gray-600 text-white border-gray-600')
    expect(src).not.toContain('bg-gray-400 text-white border-gray-400')
  })

  it('r172 PIN sinhroniziran (material-intelligence 1449 — R249, roksal-catalog 234)', () => {
    const src = beri('src/lib/__tests__/r172-dark-spots.test.ts')
    expect(src).toContain("'src/components/roksal/material-intelligence-tab.tsx', 1449,")
    expect(src).toContain("'src/components/roksal/roksal-catalog.tsx', 234,")
  })
})

describe('R234 — [Mandatory] infra (P1-d): eb_pocakaj_tekst v skupni E2E knjižnici', () => {
  it('eb_pocakaj_tekst obstaja (body.textContent.includes — ponavljanje od r228 zaprto)', () => {
    const src = beri('scripts/e2e-lib.sh')
    expect(src).toContain('eb_pocakaj_tekst()')
    expect(src).toContain("document.body.textContent.includes('$tekst')")
  })

  it('IIFE lekcija (r225/r227) ostaja ZAPRTA — vsi literalni predikati so klicani', () => {
    const src = beri('scripts/e2e-lib.sh')
    const vrstice = src
      .split('\n')
      .filter((l) => l.includes('agent-browser eval') && !l.includes('$pred'))
    expect(vrstice.length).toBeGreaterThan(0)
    for (const l of vrstice) {
      expect(l, `predikat ni IIFE: ${l}`).toContain('})()"')
    }
  })
})
