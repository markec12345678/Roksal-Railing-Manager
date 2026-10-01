// ---------------------------------------------------------------------------
// R332 — MANDATORY STIL val 19 (r162/…/R331 vzorec): 59. člen CSV brat na
// CRM tab izvozni coni (isti pregled EN VIR kot Potekli opomniki PDF R252 —
// NOVI detajli).
//
// val 18 je na quote-followup dodal izvozna PAR pariteto + TROJICA press-scale
// + definicijski naslov medija; val 19 JIH OHRANI (obrnjena regresija —
// polzaporedje ne sme nazaj) IN doda na NOVI površini (crm-tab izvozna cona):
//  • izvozna PAR = PDF (R252) + NOVI CSV (R332) z ISTIM žetonom (press-scale
//    + navy/40 ring + h-7 shrink-0 gap-1.5 text-[11px] — pariteta bajtno,
//    nič drugega občutka znotraj istega para);
//  • oči para: FileDown (PDF) + FileSpreadsheet (CSV) — ISTA h-3 w-3
//    aria-hidden (ta PAR je spinner-prosta — disabled žig je pariteta);
//  • definicijski naslov (MANDATORY STIL): CSV pill title izreče PRAVILA
//    (isti pregled EN VIR; prazen seznam → iskren toast) + vidno razliko
//    medija (PDF = tisk za pisarno, CSV = Excel za filtriranje);
//  • legenda medija: 'Potekli CSV = isti akcijski pregled kot PDF (Excel)'
//    (nov podpis R332 — starejši segmenti NEPREMIKNJENI);
//  • obrnjena regresija: val 18 PAR pariteta ŽIVA na quote-followup + val 17
//    PAR ŽIVA na logistiki + val 16 alarm ŽIVA + zgodovina PAR bajtno;
//  • vodja val 11/12 register ×4/×4 se NE sme premakniti (novi gumb je na
//    CRM tabu — LEKCIJA R325 5; val 8 anti-stale PIN shifta SAMO v val8
//    registru — 65 po R332);
//  • globals anti-stale: .press-scale definicija ŽIVA; 0 surovih barv v
//    novem bloku (navy/40 ring + roksal tokena — 0-hex kanon val 15–18).
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const CRM = join(process.cwd(), 'src/components/roksal/crm-tab.tsx')
const FOLLOWUP = join(process.cwd(), 'src/components/roksal/quote-followup.tsx')
const LOGISTIKA = join(process.cwd(), 'src/components/roksal/logistics-tab.tsx')
const DOBAV_PANEL = join(process.cwd(), 'src/components/roksal/cena-dobavitelji-panel.tsx')
const ZGOD_PANEL = join(process.cwd(), 'src/components/roksal/cena-zgodovina-panel.tsx')
const VODJA = join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx')
const GLOBALS = join(process.cwd(), 'src/app/globals.css')

const src = readFileSync(CRM, 'utf8')
const followup = readFileSync(FOLLOWUP, 'utf8')
const logistika = readFileSync(LOGISTIKA, 'utf8')
const dobav = readFileSync(DOBAV_PANEL, 'utf8')
const zgod = readFileSync(ZGOD_PANEL, 'utf8')
const vodja = readFileSync(VODJA, 'utf8')
const globals = readFileSync(GLOBALS, 'utf8')

const BLOK_ZETON = 'transition-colors hover:border-roksal-amber/30'
const VRSTICA_ZETON = 'transition-colors hover:border-roksal-amber/40'
const RING_NAVY = 'focus-visible:ring-2 focus-visible:ring-roksal-navy/40'
const PAR_ZETON = 'h-7 shrink-0 gap-1.5 text-[11px] press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40'

/** Vrni okno N vrstic okoli prve vrstice, ki vsebuje marker (vzorec R324–R331). */
function oknoOkoli(vir: string, marker: string, okno = 10): string {
  const vrstice = vir.split('\n')
  const i = vrstice.findIndex((v) => v.includes(marker))
  expect(i).toBeGreaterThanOrEqual(0)
  return vrstice.slice(Math.max(0, i - okno), i + okno + 1).join('\n')
}

describe('r332 STIL val 19 — Potekli CSV PAR pariteta na CRM izvozni coni', () => {
  it('izvozna PAR = PDF + CSV z ISTIM žetonom (press-scale + navy/40 + h-7) — bratska simetrija bajtno', () => {
    const pdfGumb = oknoOkoli(src, 'aria-label="Izvozi potekle opomnike kot PDF"', 9)
    const csvGumb = oknoOkoli(src, 'aria-label="Izvozi potekle opomnike kot CSV"', 9)
    expect(pdfGumb).toContain(PAR_ZETON)
    expect(csvGumb).toContain(PAR_ZETON)
    // pariteta: ISTA niz žetonov v ISTEM redu (nič drugega občutka znotraj istega para)
    const pdfRazred = pdfGumb.split('\n').find((v) => v.includes('className='))
    const csvRazred = csvGumb.split('\n').find((v) => v.includes('className='))
    expect(csvRazred).toBe(pdfRazred)
  })

  it('oči para: FileDown (PDF) + FileSpreadsheet (CSV) — ISTA h-3 w-3 + aria-hidden; PAR je spinner-prosta (disabled žig pariteta)', () => {
    const pdfGumb = oknoOkoli(src, 'aria-label="Izvozi potekle opomnike kot PDF"', 11)
    const csvGumb = oknoOkoli(src, 'aria-label="Izvozi potekle opomnike kot CSV"', 11)
    expect(pdfGumb).toContain('<FileDown className="h-3 w-3" aria-hidden="true" />')
    expect(csvGumb).toContain('<FileSpreadsheet className="h-3 w-3" aria-hidden="true" />')
    // bratska pariteta: NITI eden nima Loader2 (izkrena resnica — vsak brat
    // svoj dvoklik guard, disabled žig pove vteku)
    expect(pdfGumb).not.toContain('<Loader2')
    expect(csvGumb).not.toContain('<Loader2')
    // disabled žigi = ISTI vzorec (vsak svoj state — pariteta oblike)
    expect(src).toContain('disabled={potekliVTeku}')
    expect(src).toContain('disabled={potekliCsvVTeku}')
  })

  it('definicijski naslov izreče pravila + razliko medija + iskren fail-closed', () => {
    const csvGumb = oknoOkoli(src, 'data-testid="potekli-opomniki-csv-pill"', 7)
    expect(csvGumb).toContain('isti akcijski pregled in vrstni red kot PDF')
    expect(csvGumb).toContain('prazen seznam → iskren toast, nikoli prazna datoteka')
    expect(csvGumb).toContain('PDF = tisk za pisarno, CSV = Excel za filtriranje')
  })

  it('legenda medija: Potekli CSV imenovan ob PDF bratu + starejši segmenti NEPREMIKNJENI (VEDNO vidna)', () => {
    expect(src).toContain('CSV = prikazani seznam · PDF = potekli opomniki (akcija) · Potekli CSV = isti akcijski pregled kot PDF (Excel)')
    expect(src).toContain('· Potekel = prek datuma · Koledar = vsi vpisani pregledi (časovna vrsta) · Pokritost = stranke × opomnikStatus (slepe pike = brez datuma)')
  })

  it('obrnjena regresija: val 18 PAR ŽIVA na quote-followup + val 17 PAR ŽIVA na logistiki + val 16 alarm ŽIVA + zgodovina PAR bajtno', () => {
    // val 18: Ponudbe PDF+CSV ISTI className (quote-followup)
    const fupPdf = oknoOkoli(followup, 'aria-label="Izvozi pregled spomnikov ponudb kot PDF"', 7)
    const fupCsv = oknoOkoli(followup, 'aria-label="Izvozi pregled spomnikov ponudb kot CSV"', 7)
    expect(fupCsv.split('\n').find((v) => v.includes('className='))).toBe(
      fupPdf.split('\n').find((v) => v.includes('className=')),
    )
    // val 17: Projekti PDF+CSV ISTI className (logistika)
    const logPdf = oknoOkoli(logistika, 'aria-label="Izvozi pregled projektov in terminov kot PDF"', 7)
    const logCsv = oknoOkoli(logistika, 'aria-label="Izvozi pregled projektov in terminov kot CSV"', 7)
    expect(logCsv.split('\n').find((v) => v.includes('className='))).toBe(
      logPdf.split('\n').find((v) => v.includes('className=')),
    )
    // val 16 alarm ŽIVA
    expect(dobav).toContain("d.narasca > 0 ? 'py-1 pr-3 font-medium tabular-nums text-roksal-red'")
    expect(dobav).toContain("d.pada > 0 ? 'py-1 pr-3 font-medium tabular-nums text-roksal-green'")
    // zgodovina PAR bajtno NEPREMIKNJEN
    expect(zgod.split(RING_NAVY).length - 1).toBe(2)
    expect(zgod.split('press-scale').length - 1).toBe(2)
    expect(zgod).toContain(BLOK_ZETON)
    expect(zgod).toContain(VRSTICA_ZETON)
  })

  it('vodja val 11/12 register ostane ×4/×4 (novi gumb je na CRM tabu — LEKCIJA R325 5; val 8 anti-stale PIN shifta SAMO v val8 registru — 65 po R332)', () => {
    expect(vodja.split(BLOK_ZETON).length - 1).toBe(4)
    expect(vodja.split(VRSTICA_ZETON).length - 1).toBe(4)
  })

  it('globals anti-stale: .press-scale definicija ŽIVA + novi PAR blok brez surovih barv (navy/40 = roksal token)', () => {
    expect(globals).toContain('.press-scale {')
    expect(globals).toContain('transform: scale(0.97)')
    const csvGumb = oknoOkoli(src, 'data-testid="potekli-opomniki-csv-pill"', 7)
    expect(csvGumb).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(csvGumb).not.toMatch(/\b(?:bg|text|border|ring)-(?:amber|navy|red|green)-\d{2,3}\b/)
  })

  it('RING_NAVY družinski kanon: NOVI CSV pill nosi navy/40 (ne generične baze, ne amber/50)', () => {
    const csvGumb = oknoOkoli(src, 'data-testid="potekli-opomniki-csv-pill"', 9)
    expect(csvGumb).toContain(RING_NAVY)
    expect(csvGumb).not.toContain('ring-roksal-amber/50')
    // ISTA press-scale pariteta z PDF bratom (R161 družina — vsi izvozni gumbi)
    expect(csvGumb).toContain('press-scale')
  })
})
