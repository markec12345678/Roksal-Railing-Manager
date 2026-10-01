// R352 — kalkulator pdf-exports GLIFNI POPRAVEK: helvetica (WinAnsi — č/š/ž
// NE renderirata: 'Širina palice', 'Število letvev', 'Širina reza' → artefakti)
// → registerSloPdfFonts (Roboto subset latin-ext, r269/R351 vzorec).
// ---------------------------------------------------------------------------
//  • ENA vsebinska sprememba izvoza — iskreno dokumentirana (r269/R351 kanon):
//    izvoženi PDF-i (5 gradnikov) se SPROTI spremenijo (vgrajeni fonti +
//    pravilni šumniki); vsebina (številke, izračuni) ostane NESPREMENJENA —
//    kalkulator jedro (@/lib/calculator) NIČ;
//  • dokaz glifne zmogljivosti: /FontFile2 (vgrajen TrueType) v izhodu —
//    standard-14 helvetica PDF NIMA vgrajenih tokov;
//  • regresija R325: VERBATIM glave/toasti/imena datotek ostanejo;
//  • časovni žigi (new Date/Date.now) so OBSTOJEČA klicateljeva resnica —
//    bajtna enakost med teki NI kontrakt tega modula (iskreno).
import { describe, expect, it, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type jsPDF from 'jspdf'
import {
  exportBalusterPdf,
  exportGlassPdf,
  type CncSegment,
  type GlassType,
} from '@/components/roksal/calculator/pdf-exports'
import type { EqualSpacingResult } from '@/lib/calculator'
import type { GlassCalcResult } from '@/lib/glass-model'

// jsPDF 4.x dodeljuje save kot PRIPIS lastnost na instansi (prototype chain
// je ne nosi) — spyOn na API/prototipu ne deluje. Namesto tega: podrazred z
// NO-OP save, ki ujame instanco (pravi konstruktor + pravi autoTable + pravi
// output — samo prenos je izklopljen; glifni dokaz ostane na bajtih).
const { ujeti } = vi.hoisted(() => ({ ujeti: [] as unknown[] }))
vi.mock('jspdf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jspdf')>()
  class JsPdfR352 extends actual.default {
    // jsPDF 4.x konstruktor dodeli save kot INSTANČNO own property
    // (senči podrazredno metodo) — zato jo po super() pišemo čez.
    constructor(...args: ConstructorParameters<typeof actual.default>) {
      super(...args)
      ;(this as unknown as { save: () => jsPDF }).save = () => {
        ujeti.push(this)
        return this
      }
    }
  }
  return { ...actual, default: JsPdfR352 }
})
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

const MOD = join(process.cwd(), 'src/components/roksal/calculator/pdf-exports.ts')
const TEREN = join(process.cwd(), 'src/lib/meritve-teren-pdf.ts')
const SEZNAM = join(process.cwd(), 'src/components/roksal/measurements/pdf-seznam.ts')
const mod = readFileSync(MOD, 'utf8')
const teren = readFileSync(TEREN, 'utf8')
const seznam = readFileSync(SEZNAM, 'utf8')
// Gradniki so VERBATIM R325 — 5 izvoznih funkcij, 5 × new jsPDF.
const BUILDERJI = [
  'export function exportBalusterPdf(',
  'export function exportMaterialPdf(',
  'export function exportCncPdf(',
  'export function exportWindLocPdf(',
  'export function exportGlassPdf(',
] as const

const balusterResult: EqualSpacingResult = {
  balusterCount: 12,
  actualGapMm: 78.4,
  positions: [0, 118.4, 236.8],
  centers: [20, 138.4, 256.8, 375.2],
  isCompliant: true,
  warnings: [],
}

const glassResult: GlassCalcResult = {
  recommendedThicknessMm: 10,
  alternativeThicknesses: [
    { mm: 8, safe: false, reason: 'Napetost presega dovoljeno' },
    { mm: 10, safe: true, reason: 'Zadošča' },
  ],
  maxSpanForThicknessMm: 1400,
  maxHeightForThicknessMm: 1200,
  stressMpa: 32.5,
  allowableStressMpa: 120,
  deflectionMm: 4.2,
  deflectionLimitMm: 12.5,
  deflectionOk: true,
  governing: 'deflection',
  isSafe: true,
  layers: 1,
  modelNote: 'poenostavljen model',
  warnings: ['Preveri pritrditev pri dobavitelju'],
  recommendations: ['Upoštevaj SIST EN 12600'],
}

const glassInput: { spanMm: number; heightMm: number; loadKnPerM: number; glassType: GlassType } = {
  spanMm: 1200,
  heightMm: 1100,
  loadKnPerM: 1.0,
  glassType: 'tempered',
}

describe('r352 kalkulator pdf-exports — registerSloPdfFonts (glifni popravek, r269/R351 vzorec)', () => {
  afterEach(() => {
    ujeti.length = 0
    vi.clearAllMocks()
  })

  it('vir: import + 5 × registerSloPdfFonts (EN na gradnik) + pozicijski dokaz (prvi registr < prva setFont)', () => {
    expect(mod).toContain("import { registerSloPdfFonts } from '@/lib/pdf-sl-font'")
    expect((mod.match(/registerSloPdfFonts\(doc\)/g) || []).length).toBe(5)
    const iNew = mod.indexOf('new jsPDF(')
    const iReg = mod.indexOf('registerSloPdfFonts(doc)')
    const iFont = mod.indexOf("doc.setFont('Roboto'")
    expect(iNew).toBeGreaterThanOrEqual(0)
    expect(iReg).toBeGreaterThan(iNew)
    expect(iFont).toBeGreaterThan(iReg)
  })

  it('vir: VSAK gradnik — register PO svojem new jsPDF, PRED svojo prvo setFont, 0 × helvetica', () => {
    for (let b = 0; b < BUILDERJI.length; b++) {
      const zacetek = mod.indexOf(BUILDERJI[b])
      expect(zacetek).toBeGreaterThanOrEqual(0)
      const konec = b + 1 < BUILDERJI.length ? mod.indexOf(BUILDERJI[b + 1]) : mod.length
      const seg = mod.slice(zacetek, konec)
      const iNew = seg.indexOf('new jsPDF(')
      const iReg = seg.indexOf('registerSloPdfFonts(doc)')
      const iFont = seg.indexOf("doc.setFont('Roboto'")
      expect(iNew).toBeGreaterThan(0)
      expect(iReg).toBeGreaterThan(iNew)
      expect(iFont).toBeGreaterThan(iReg)
      expect(seg).not.toContain("doc.setFont('helvetica'")
    }
  })

  it('vir: 0 × helvetica setFont v modulu; 29 × setFont Roboto (15 bold + 14 normal)', () => {
    expect(mod).not.toContain("doc.setFont('helvetica'")
    expect((mod.match(/doc\.setFont\('Roboto', 'bold'\)/g) || []).length).toBe(15)
    expect((mod.match(/doc\.setFont\('Roboto', 'normal'\)/g) || []).length).toBe(14)
  })

  it('vir: zgodovina v komentarju (iskrena dokumentacija ENA vsebinska sprememba)', () => {
    expect(mod).toContain('R352 — GLIFNI POPRAVEK')
    expect(mod).toContain('registerSloPdfFonts')
    expect(mod).toContain('ENA vsebinska sprememba izvoza')
  })

  it('vir: VERBATIM regresija R325 — glave, toasti, imena datotek ostanejo', () => {
    expect(mod).toContain("'ROKSAL — Predloga vrtanja'")
    expect(mod).toContain("'ROKSAL — Materialni list'")
    expect(mod).toContain("'ROKSAL — Razrezni list CNC'")
    expect(mod).toContain("'ROKSAL — Vetrno poročilo'")
    expect(mod).toContain("'ROKSAL — Steklena balustrada specifikacija'")
    expect(mod).toContain("toast.success('Predloga PDF izvožena')")
    expect(mod).toContain("toast.success('Materialni list PDF izvožen')")
    expect(mod).toContain("doc.save(`roksal-predloga-vrtanja-${Date.now()}.pdf`)")
    expect(mod).toContain("doc.save(`roksal-steklena-balustrada-${Date.now()}.pdf`)")
  })

  it('GLIFNA ZMOGLJIVOST (exportBalusterPdf): %PDF- magija + /FontFile2 (vgrajen TrueType — helvetica standard-14 ga NIMA)', () => {
    exportBalusterPdf({
      balusterResult,
      balTotalLength: '12.34',
      balWidth: '40',
      balMaxGap: '110',
      rezervaPctBaluster: 10,
    })
    expect(ujeti.length).toBe(1)
    const doc = ujeti[0] as unknown as jsPDF
    const bin = Buffer.from(doc.output('arraybuffer'))
    expect(bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(bin.toString('latin1')).toContain('/FontFile2')
  })

  it('GLIFNA ZMOGLJIVOST (exportGlassPdf): /FontFile2 + getFontList Roboto normal+bold na dokumentu', () => {
    exportGlassPdf({ glassResult, glassInput, projectName: 'Šmartno — Žalec' })
    expect(ujeti.length).toBe(1)
    const doc = ujeti[0] as unknown as jsPDF
    const bin = Buffer.from(doc.output('arraybuffer'))
    expect(bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(bin.toString('latin1')).toContain('/FontFile2')
    const fonti = doc.getFontList()
    expect(fonti['Roboto']).toEqual(expect.arrayContaining(['normal', 'bold']))
  })

  it('GLIFNA STABILNOST: isti vhod ×2 → /FontFile2 obakrat (zmogljivost deterministična; bajtna enakost NI kontrakt — časovni žigi)', () => {
    const argsBal = () => ({
      balusterResult,
      balTotalLength: '12.34',
      balWidth: '40',
      balMaxGap: '110',
      rezervaPctBaluster: 10,
    })
    exportBalusterPdf(argsBal())
    exportBalusterPdf(argsBal())
    expect(ujeti.length).toBe(2)
    for (const d of ujeti) {
      expect(Buffer.from((d as unknown as jsPDF).output('arraybuffer')).toString('latin1')).toContain('/FontFile2')
    }
  })

  it('družinska konsistenznost: meritve-teren (r269) + pdf-seznam (R351) + kalkulator (R352) = trije potrošniki ENEGA modula', () => {
    for (const [ime, vir] of [['teren', teren], ['seznam', seznam], ['kalkulator', mod]] as const) {
      expect(vir, ime).toContain('registerSloPdfFonts(doc)')
      expect(vir, ime).toContain("doc.setFont('Roboto'")
      expect(vir, ime).not.toContain("doc.setFont('helvetica'")
    }
  })

  it('kalkulator jedro NIČ: modul uvaža iz @/lib/calculator (render plasti), jedro NE uvaža pdf-exports', () => {
    expect(mod).toContain("} from '@/lib/calculator'")
    const jedro = readFileSync(join(process.cwd(), 'src/lib/calculator.ts'), 'utf8')
    expect(jedro).not.toContain("from '@/components/roksal/calculator/pdf-exports'")
    // Tip CncSegment ostane izvožen (stanje + PDF + JSX uporaba — R325 kontrakt)
    const seg: CncSegment = { lengthMm: '1200', count: '2', label: 'Vrata' }
    expect(seg.count).toBe('2')
  })
})
