// R353 — GLIFNI POPRAVEK za preostale komponentne PDF potrošnike: helvetica
// (WinAnsi — č/š/ž NE renderirata) → registerSloPdfFonts (Roboto subset
// latin-ext, kanon r269/R351/R352). ŠTIRI potrošniki (fetch-first sken celotnega
// repa je potrdil, da so to ZADNJI štirje z helvetica setFont):
//   post-signature-panel.tsx (11: 6 bold + 5 normal)
//   floor-plan-tab.tsx       ( 8: 4 bold + 4 normal)
//   reference-gallery.tsx    ( 6: 2 bold + 3 normal + 1 italic→normal)
//   signature-quote.tsx      (16: 8 bold + 8 normal)
// ---------------------------------------------------------------------------
//  • ENA vsebinska sprememba izvoza na potrošnika — ISKRENO dokumentirana
//    (kanon r269/R351/R352): izvoženi PDF-i se SPROTI spremenijo (vgrajeni
//    fonti + pravilni šumniki); vsebina/izračuni ostanejo NESPREMENJENI;
//  • posebnost reference-gallery: italic NI registriran (Roboto subset ima
//    samo normal+bold) → placeholder 'Brez slike' izgubi naklon, dobi
//    pravilne glife — sprememba stila dokumentirana v viru (fail-closed:
//    brez registrirane italic variante NI tihega fallbacka);
//  • komponentni potrošniki gradijo PDF znotraj useCallback/handlerjev —
//    bajtni dokaz (/FontFile2) je na MODULSKIH potrošnikih (r351/r352 testi);
//    tu je ŽIV dokaz istega modula pdf-sl-font (registracija + FontFile2 +
//    idempotenten ponoven klic) + pozicijske invariante po vseh štirih virih.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import jsPDF from 'jspdf'
import { registerSloPdfFonts } from '@/lib/pdf-sl-font'

const POST = readFileSync(join(process.cwd(), 'src/components/roksal/post-signature-panel.tsx'), 'utf8')
const FLOOR = readFileSync(join(process.cwd(), 'src/components/roksal/floor-plan-tab.tsx'), 'utf8')
const GALLERY = readFileSync(join(process.cwd(), 'src/components/roksal/reference-gallery.tsx'), 'utf8')
const SIGN = readFileSync(join(process.cwd(), 'src/components/roksal/signature-quote.tsx'), 'utf8')

const POTROŠNIKI = [
  ['post-signature-panel', POST],
  ['floor-plan-tab', FLOOR],
  ['reference-gallery', GALLERY],
  ['signature-quote', SIGN],
] as const

const IMPORT = "import { registerSloPdfFonts } from '@/lib/pdf-sl-font'"

describe('r353 glifni popravek — registerSloPdfFonts na 4 komponentnih potrošnikih (kanon r269/R351/R352)', () => {
  it('vir: vsak potrošnik — import + točno 1 × registerSloPdfFonts(doc)', () => {
    for (const [ime, vir] of POTROŠNIKI) {
      expect(vir, ime).toContain(IMPORT)
      expect((vir.match(/registerSloPdfFonts\(doc\)/g) || []).length, ime).toBe(1)
    }
  })

  it('vir: pozicijski dokaz po vseh 4 — register PO new jsPDF, PRED prvo setFont', () => {
    for (const [ime, vir] of POTROŠNIKI) {
      const iNew = vir.indexOf('new jsPDF(')
      const iReg = vir.indexOf('registerSloPdfFonts(doc)')
      const iFont = vir.indexOf("doc.setFont('Roboto'")
      expect(iNew, ime).toBeGreaterThan(0)
      expect(iReg, ime).toBeGreaterThan(iNew)
      expect(iFont, ime).toBeGreaterThan(iReg)
    }
  })

  it('vir: 0 × helvetica setFont po vseh 4; counting 6/5 + 4/4 + 2/4 + 8/8 (skupaj 41)', () => {
    const skupaj = { bold: 0, normal: 0 }
    for (const [ime, vir, bold, normal] of [
      ['post-signature-panel', POST, 6, 5],
      ['floor-plan-tab', FLOOR, 4, 4],
      ['reference-gallery', GALLERY, 2, 4],
      ['signature-quote', SIGN, 8, 8],
    ] as const) {
      expect(vir, ime).not.toContain("doc.setFont('helvetica'")
      expect((vir.match(/doc\.setFont\('Roboto', 'bold'\)/g) || []).length, ime).toBe(bold)
      expect((vir.match(/doc\.setFont\('Roboto', 'normal'\)/g) || []).length, ime).toBe(normal)
      skupaj.bold += bold
      skupaj.normal += normal
    }
    expect(skupaj.bold + skupaj.normal).toBe(41)
  })

  it('vir: italic posebnost (reference-gallery) — brez tihega fallbacka, sprememba dokumentirana v viru', () => {
    expect(GALLERY).not.toContain("setFont('helvetica', 'italic')")
    expect(GALLERY).toContain('italic NI registriran')
    expect(GALLERY).toContain('sprememba iskreno')
    expect(GALLERY).toContain("doc.setFont('Roboto', 'normal')")
  })

  it('vir: zgodovina v komentarju po vseh 4 (R353 — slovenski glifi, kanon)', () => {
    for (const [ime, vir] of POTROŠNIKI) {
      expect(vir, ime).toContain('R353 — slovenski glifi')
      expect(vir, ime).toContain('registracija je idempotentna')
    }
  })

  it('vir: VERBATIM regresija — glave/izvozi vseh 4 ostanejo (ena vsebinska sprememba = samo fonti)', () => {
    expect(POST).toContain("'AUDIT TRAIL — PODPISI'")
    expect(POST).toContain('Roksal-audit-trail-')
    expect(FLOOR).toContain("'ROKSAL d.o.o. Kranj'")
    expect(FLOOR).toContain("'Tloris balkona z elementi'")
    expect(GALLERY).toContain("'Katalog realizacij'")
    expect(GALLERY).toContain("doc.save('Roksal-katalog-realizacij.pdf')")
    expect(SIGN).toContain("'PONUDBA S PODPISOM'")
    expect(SIGN).toContain("'Kranj · Ograje in terase po meri'")
  })

  it('ŽIV dokaz modula: registerSloPdfFonts → getFontList Roboto normal+bold + /FontFile2 v izhodu', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    registerSloPdfFonts(doc)
    doc.setFont('Roboto', 'bold')
    doc.text('ŠČŽ test', 10, 10)
    const bin = Buffer.from(doc.output('arraybuffer'))
    expect(bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(bin.toString('latin1')).toContain('/FontFile2')
    const fonti = doc.getFontList()
    expect(fonti['Roboto']).toEqual(expect.arrayContaining(['normal', 'bold']))
  })

  it('GLIFNA STABILNOST: registerSloPdfFonts je idempotenten — dvakrat na istem dokumentu, brez napak, /FontFile2 ostane', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    registerSloPdfFonts(doc)
    expect(() => registerSloPdfFonts(doc)).not.toThrow()
    doc.setFont('Roboto', 'normal')
    doc.text('drugi klic — isti VFS', 10, 20)
    expect(Buffer.from(doc.output('arraybuffer')).toString('latin1')).toContain('/FontFile2')
  })

  it('družinska konsistenznost: 7 potrošnikov ENEGA modula (teren r269 + seznam R351 + kalkulator R352 + 4 novi R353)', () => {
    const teren = readFileSync(join(process.cwd(), 'src/lib/meritve-teren-pdf.ts'), 'utf8')
    const seznam = readFileSync(join(process.cwd(), 'src/components/roksal/measurements/pdf-seznam.ts'), 'utf8')
    const kalkulator = readFileSync(join(process.cwd(), 'src/components/roksal/calculator/pdf-exports.ts'), 'utf8')
    for (const [ime, vir] of [
      ['teren', teren],
      ['seznam', seznam],
      ['kalkulator', kalkulator],
      ...POTROŠNIKI,
    ] as const) {
      expect(vir, ime).toContain('registerSloPdfFonts')
      expect(vir, ime).toContain("doc.setFont('Roboto'")
      expect(vir, ime).not.toContain("doc.setFont('helvetica'")
    }
  })

  it('smer odvisnosti: pdf-sl-font NE uvaža nobenega potrošnika (modul je list); rep brez preostalih helvetica setFont', () => {
    const modul = readFileSync(join(process.cwd(), 'src/lib/pdf-sl-font.ts'), 'utf8')
    for (const [ime] of POTROŠNIKI) {
      expect(modul, ime).not.toContain(`roksal/${ime}`)
    }
    // fetch-first sken (kanon R353): to so ZADNJI štirje — po R353 nobena
    // NEtestna vira več nosi setFont('helvetica'. Deterministična fs hoja
    // (brez podprocesa; __tests__ izključene — same nosijo negativne trditve).
    const nasli: string[] = []
    const hoj = (dir: string) => {
      for (const vnos of readdirSync(dir)) {
        const pot = `${dir}/${vnos}`
        if (vnos === '__tests__') continue
        if (!/\.(ts|tsx)$/.test(vnos)) {
          try {
            if (readdirSync(pot)) hoj(pot)
          } catch {
            /* datoteka, ne mapa */
          }
          continue
        }
        if (readFileSync(pot, 'utf8').includes("setFont('helvetica'")) nasli.push(pot)
      }
    }
    hoj(join(process.cwd(), 'src'))
    expect(nasli, 'preostali helvetica setFont').toEqual([])
  })
})
