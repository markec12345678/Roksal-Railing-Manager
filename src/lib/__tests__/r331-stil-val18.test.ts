// ---------------------------------------------------------------------------
// R331 — MANDATORY STIL val 18 (r162/…/R330 vzorec): 58. člen CSV brat na
// CRM kartici Ponudbe — sledenje (isti pregled EN VIR kot Ponudbe PDF — NOVI
// detajli).
//
// val 17 je na logistiki dodal izvozna PAR pariteto + definicijski naslov
// medija; val 18 JIH OHRANI (obrnjena regresija — polzaporedje ne sme nazaj)
// IN doda na NOVI površini (quote-followup izvozna trojica):
//  • izvozna PAR = PDF (R267) + NOVI CSV (R331) z ISTIM žetonom (press-scale
//    + navy/40 ring + h-7 shrink-0 gap-1.5 text-[11px] — pariteta, nič
//    drugega občutka znotraj istega para);
//  • oči para: FileDown (PDF) + FileSpreadsheet (CSV) — ISTA h-3 w-3
//    (Loader2 spinner v vteku pariteta);
//  • 🆕 TROJICA press-scale pariteta: R161 'Izvozi CSV' gumb dobi press-scale
//    (do zdaj edini izvozni gumb brez njega — iskrena nekonsistentnost,
//    val 18 jo odpravlja; disabled pogoj NEPREMIKNJEN — R267 pin);
//  • definicijski naslov (MANDATORY STIL): CSV pill title izreče PRAVILA
//    (isti pregled EN VIR; prazen seznam → iskren toast) + vidno razliko
//    medija (PDF = tisk za vodjo, CSV = Excel za filtriranje) + iskreno
//    ločnico od prikazanega seznama (VSE ponudbe, ne prvih 12);
//  • legenda medija: 'PDF/CSV = VSE ponudbe … · prikazani seznam CSV = samo
//    odprte prvih 12' (iskrena ločnica obeh CSV resnic);
//  • obrnjena regresija: val 17 PAR pariteta ŽIVA na logistiki (Projekti
//    PDF+CSV ISTI className); val 16 alarm ŽIVA; zgodovina PAR bajtno;
//  • vodja val 11/12 register ×4/×4 se NE sme premakniti (novi gumb je na
//    CRM kartici — LEKCIJA R325 5; val 8 anti-stale PIN shifta SAMO v val8
//    registru — 64 po R331);
//  • globals anti-stale: .press-scale definicija ŽIVA; 0 surovih barv v
//    novem bloku (navy/40 ring + roksal tokena — 0-hex kanon val 15–17).
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const FOLLOWUP = join(process.cwd(), 'src/components/roksal/quote-followup.tsx')
const LOGISTIKA = join(process.cwd(), 'src/components/roksal/logistics-tab.tsx')
const DOBAV_PANEL = join(process.cwd(), 'src/components/roksal/cena-dobavitelji-panel.tsx')
const ZGOD_PANEL = join(process.cwd(), 'src/components/roksal/cena-zgodovina-panel.tsx')
const VODJA = join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx')
const GLOBALS = join(process.cwd(), 'src/app/globals.css')

const src = readFileSync(FOLLOWUP, 'utf8')
const logistika = readFileSync(LOGISTIKA, 'utf8')
const dobav = readFileSync(DOBAV_PANEL, 'utf8')
const zgod = readFileSync(ZGOD_PANEL, 'utf8')
const vodja = readFileSync(VODJA, 'utf8')
const globals = readFileSync(GLOBALS, 'utf8')

const BLOK_ZETON = 'transition-colors hover:border-roksal-amber/30'
const VRSTICA_ZETON = 'transition-colors hover:border-roksal-amber/40'
const RING_NAVY = 'focus-visible:ring-2 focus-visible:ring-roksal-navy/40'
const PAR_ZETON = 'h-7 shrink-0 gap-1.5 text-[11px] press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40'

/** Vrni okno N vrstic okoli prve vrstice, ki vsebuje marker (vzorec R324–R330). */
function oknoOkoli(vir: string, marker: string, okno = 10): string {
  const vrstice = vir.split('\n')
  const i = vrstice.findIndex((v) => v.includes(marker))
  expect(i).toBeGreaterThanOrEqual(0)
  return vrstice.slice(Math.max(0, i - okno), i + okno + 1).join('\n')
}

describe('r331 STIL val 18 — Ponudbe CSV PAR + trojica press-scale pariteta na CRM kartici', () => {
  it('izvozna PAR = PDF + CSV z ISTIM žetonom (press-scale + navy/40 + h-7) — bratska simetrija', () => {
    const pdfGumb = oknoOkoli(src, 'aria-label="Izvozi pregled spomnikov ponudb kot PDF"', 9)
    const csvGumb = oknoOkoli(src, 'aria-label="Izvozi pregled spomnikov ponudb kot CSV"', 9)
    expect(pdfGumb).toContain(PAR_ZETON)
    expect(csvGumb).toContain(PAR_ZETON)
    // pariteta: ISTA niz žetonov v ISTEM redu (nič drugega občutka znotraj istega para)
    const pdfRazred = pdfGumb.split('\n').find((v) => v.includes('className='))
    const csvRazred = csvGumb.split('\n').find((v) => v.includes('className='))
    expect(csvRazred).toBe(pdfRazred)
  })

  it('oči para: FileDown (PDF) + FileSpreadsheet (CSV) — ISTA h-3 w-3 + aria-hidden; Loader2 spinner v vteku pariteta', () => {
    const pdfGumb = oknoOkoli(src, 'aria-label="Izvozi pregled spomnikov ponudb kot PDF"', 11)
    const csvGumb = oknoOkoli(src, 'aria-label="Izvozi pregled spomnikov ponudb kot CSV"', 11)
    expect(pdfGumb).toContain('<FileDown className="h-3 w-3" aria-hidden="true" />')
    expect(csvGumb).toContain('<FileSpreadsheet className="h-3 w-3" aria-hidden="true" />')
    expect(pdfGumb).toContain('<Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />')
    expect(csvGumb).toContain('<Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />')
  })

  it('TROJICA press-scale pariteta: R161 Izvozi CSV dobi press-scale (edini izvozni gumb brez njega — iskrena nekonsistentnost odpravljena; disabled pogoj NEPREMIKNJEN)', () => {
    const r161Gumb = oknoOkoli(src, 'Izvozi prikazani seznam ponudb v CSV', 9)
    expect(r161Gumb).toContain('press-scale')
    // disabled pogoj R161 ostane bajtno nespremenjen (R267 pin)
    expect(src).toContain('disabled={pending.length === 0 || exporting || loading || error !== null}')
  })

  it('definicijski naslov izreče pravila + razliko medija + iskreno ločnico od prikazanega seznama', () => {
    const csvGumb = oknoOkoli(src, 'data-testid="ponudbe-spomniki-csv-pill"', 7)
    expect(csvGumb).toContain('isti pregled in vrstni red kot Ponudbe PDF')
    expect(csvGumb).toContain('prazen seznam → iskren toast, nikoli prazna datoteka')
    expect(csvGumb).toContain('Ponudbe PDF = tisk za vodjo, Ponudbe CSV = Excel za filtriranje')
    expect(csvGumb).toContain('VSE ponudbe (tudi podpisane), ne samo prikazanih prvih 12')
  })

  it('legenda medija: PDF/CSV = VSE ponudbe + iskrena ločnica prikazanega seznama (VEDNO vidna)', () => {
    const legenda = oknoOkoli(src, '<CardContent className="space-y-2">', 8)
    expect(legenda).toContain('PDF/CSV = VSE ponudbe (tudi podpisane — polna resnica) · prikazani seznam CSV = samo odprte prvih 12')
  })

  it('obrnjena regresija: val 17 PAR pariteta ŽIVA na logistiki (Projekti PDF+CSV ISTI className) + val 16 alarm ŽIVA + zgodovina PAR bajtno', () => {
    const logPdf = oknoOkoli(logistika, 'aria-label="Izvozi pregled projektov in terminov kot PDF"', 7)
    const logCsv = oknoOkoli(logistika, 'aria-label="Izvozi pregled projektov in terminov kot CSV"', 7)
    const pdfRazred = logPdf.split('\n').find((v) => v.includes('className='))
    const csvRazred = logCsv.split('\n').find((v) => v.includes('className='))
    expect(csvRazred).toBe(pdfRazred)
    // val 16 alarm ŽIVA
    expect(dobav).toContain("d.narasca > 0 ? 'py-1 pr-3 font-medium tabular-nums text-roksal-red'")
    expect(dobav).toContain("d.pada > 0 ? 'py-1 pr-3 font-medium tabular-nums text-roksal-green'")
    // zgodovina PAR bajtno NEPREMIKNJEN
    expect(zgod.split(RING_NAVY).length - 1).toBe(2)
    expect(zgod.split('press-scale').length - 1).toBe(2)
    expect(zgod).toContain(BLOK_ZETON)
    expect(zgod).toContain(VRSTICA_ZETON)
  })

  it('vodja val 11/12 register ostane ×4/×4 (novi gumb je na CRM kartici — LEKCIJA R325 5; val 8 anti-stale PIN shifta SAMO v val8 registru — 64 po R331)', () => {
    expect(vodja.split(BLOK_ZETON).length - 1).toBe(4)
    expect(vodja.split(VRSTICA_ZETON).length - 1).toBe(4)
  })

  it('globals anti-stale: .press-scale definicija ŽIVA + novi blok brez surovih barv (navy/40 = roksal token)', () => {
    expect(globals).toContain('.press-scale {')
    expect(globals).toContain('transform: scale(0.97)')
    // novi PAR blok: nič hex, nič surovih tailwind barvnih stopnja (0-hex kanon val 15–17)
    const csvGumb = oknoOkoli(src, 'data-testid="ponudbe-spomniki-csv-pill"', 7)
    expect(csvGumb).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(csvGumb).not.toMatch(/\b(?:bg|text|border|ring)-(?:amber|navy|red|green)-\d{2,3}\b/)
  })
})
