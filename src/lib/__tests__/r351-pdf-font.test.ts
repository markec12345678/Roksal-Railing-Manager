// R351 — pdf-seznam GLIFNI POPRAVEK: helvetica (WinAnsi — č/š/ž NE
// renderirata) → registerSloPdfFonts (Roboto subset latin-ext, r269 vzorec).
// ---------------------------------------------------------------------------
//  • ENA vsebinska sprememba izvoza — iskreno dokumentirana (R350 head
//    komentar je jo je naznanil kot kandidata): izvoženi PDF se SPROTI
//    spremeni (vgrajeni fonti + pravilni šumniki), determinizem ostane čist;
//  • dokaz glifne zmogljivosti: /FontFile2 (vgrajen TrueType) v izhodu —
//    standard-14 helvetica PDF NIMA vgrajenih tokov;
//  • regresa R350: VERBATIM literali + determinističen fileId (soli
//    0xd9–0xdc) + wrapper IME=klicatelj ostanejo.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildSeznamPdfDoc, exportSeznamPdf, type SeznamPdfMeritev } from '@/components/roksal/measurements/pdf-seznam'

const MOD = join(process.cwd(), 'src/components/roksal/measurements/pdf-seznam.ts')
const TEREN = join(process.cwd(), 'src/lib/meritve-teren-pdf.ts')
const mod = readFileSync(MOD, 'utf8')
const teren = readFileSync(TEREN, 'utf8')

const meritev = (over: Partial<SeznamPdfMeritev> = {}): SeznamPdfMeritev => ({
  id: 'm-1',
  oznaka: 'M-1',
  lokacija: 'Severna fasada',
  tipMeritve: 'RAZDALJA',
  status: 'POTRJENA',
  segmentId: 'seg-1',
  dolzinaMm: 1234,
  visinaMm: 1100,
  kot: 45,
  createdAt: '2026-10-01T12:00:00.000Z',
  ...over,
})
const args = () => ({
  measurements: [meritev()],
  // Šumniki v imenu projekta — glifni popravek jih sedaj NOSI (prej WinAnsi
  // pokvari). Ime gre v glavo dokumenta VERBATIM.
  projectName: 'Šmartno pri Črnomlju — Žalec',
  totalLength: 12340,
  avgHeight: 1100,
  stSegmentov: 3,
  najdalsaDolzinaMm: 5678,
  totalArea: 12_340_000,
  statusCounts: { OSNUTEK: 2, POTRJENA: 5, ARHIVIRANA: 1 },
  izvozenoOb: new Date('2026-10-01T12:00:00.000Z'),
})

describe('r351 pdf-seznam — registerSloPdfFonts (glifni popravek, r269 vzorec)', () => {
  it('vir: import + klic registerSloPdfFonts pred prvo setFont (kanon r269)', () => {
    expect(mod).toContain("import { registerSloPdfFonts } from '@/lib/pdf-sl-font'")
    expect((mod.match(/registerSloPdfFonts\(doc\)/g) || []).length).toBe(1)
    // klic je PO new jsPDF in PRED prvo setFont
    const iNew = mod.indexOf('new jsPDF(')
    const iReg = mod.indexOf('registerSloPdfFonts(doc)')
    const iFont = mod.indexOf("doc.setFont('Roboto'")
    expect(iNew).toBeGreaterThanOrEqual(0)
    expect(iReg).toBeGreaterThan(iNew)
    expect(iFont).toBeGreaterThan(iReg)
  })

  it('vir: 4 × setFont Roboto (glava bold/normal + povzetek bold/normal), 0 × helvetica setFont', () => {
    expect((mod.match(/doc\.setFont\('Roboto', 'bold'\)/g) || []).length).toBe(2)
    expect((mod.match(/doc\.setFont\('Roboto', 'normal'\)/g) || []).length).toBe(2)
    expect(mod).not.toContain("doc.setFont('helvetica'")
  })

  it('vir: komentarji nosijo R351 glifni popravek zgodovino (iskrena dokumentacija)', () => {
    expect(mod).toContain('R351 — GLIFNI POPRAVEK')
    expect(mod).toContain('registerSloPdfFonts')
  })

  it('determinizem ostane čist z Roboto: enak vhod = bajtno enak dokument', () => {
    const a = Buffer.from(buildSeznamPdfDoc(args()).output('arraybuffer'))
    const b = Buffer.from(buildSeznamPdfDoc(args()).output('arraybuffer'))
    expect(a.equals(b)).toBe(true)
  })

  it('drugi izvozenoOb = drugačen dokument (noga + CreationDate vhodni resnici)', () => {
    const drugi = { ...args(), izvozenoOb: new Date('2026-09-29T08:01:00.000Z') }
    const a = Buffer.from(buildSeznamPdfDoc(args()).output('arraybuffer'))
    const b = Buffer.from(buildSeznamPdfDoc(drugi).output('arraybuffer'))
    expect(a.equals(b)).toBe(false)
  })

  it('GLIFNA ZMOGLJIVOST: /FontFile2 v izhodu (vgrajen TrueType subset — helvetica standard-14 ga NIMA)', () => {
    const bin = Buffer.from(buildSeznamPdfDoc(args()).output('arraybuffer'))
    expect(bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(bin.toString('latin1')).toContain('/FontFile2')
  })

  it('%PDF- magija + prazen seznam dovoljen v gradniku (guard = klicateljeva resnica)', () => {
    const prazen = buildSeznamPdfDoc({ ...args(), measurements: [] })
    expect(Buffer.from(prazen.output('arraybuffer')).subarray(0, 5).toString('ascii')).toBe('%PDF-')
  })

  it('wrapper exportSeznamPdf: doc.save(filename) + brez toastov (UI resnica = klicatelj)', () => {
    expect(mod).toContain('export function exportSeznamPdf(args: SeznamPdfArgs & { filename: string }): void')
    expect(mod).toContain('doc.save(args.filename)')
    expect(mod).not.toContain('toast.')
  })

  it('VERBATIM literali ostanejo (R350 regresija): glava/povzetek/tabela/noga + FNV soli 0xd9–0xdc', () => {
    expect(mod).toContain("'ROKSAL — Seznam meritev'")
    expect(mod).toContain("doc.text('Povzetek', 14, 32)")
    expect(mod).toContain('startY: 56')
    expect(mod).toContain('headStyles: { fillColor: [29, 43, 62], textColor: 255, fontSize: 8 }')
    expect(mod).toContain('Izvozeno ')
    expect(mod).toContain('0xd9')
    expect(mod).toContain('0xdc')
  })

  it('družinska konsistenznost: meritve-teren (r269) uporablja ISTI registerSloPdfFonts — dva potrošnika ENEGA modula', () => {
    expect(teren).toContain("registerSloPdfFonts(doc)")
    expect(teren).toContain("from './pdf-sl-font'")
    expect(teren).toContain("doc.setFont('Roboto'")
  })
})
