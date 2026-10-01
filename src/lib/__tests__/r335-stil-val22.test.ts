// ---------------------------------------------------------------------------
// R335 — MANDATORY STIL val 22 (r162/…/R334 vzorec): 62. člen CSV brat na
// vodja blok glavi (mesečno poročilo — EN VIR mesecniPregledData kot PDF
// brat runda M — NOVI detajli).
//
// val 21 je na končni verifikaciji dodal izvozno TRIADO (amber/50 + offset-2
// pariteta bajtno) + definicijski naslov medija + legendo medija; val 22 JIH
// OHRANI (obrnjena regresija — polzaporedje ne sme nazaj) IN doda na NOVI
// površini (vodja blok glava — mesečno poročilo):
//  • izvozna PAR = Poročilo PDF (runda M) + NOVI Poročilo CSV (R335) z ISTIM
//    h-8 žetonom (press-scale + navy/25 border + amber/50 ring + offset-2 —
//    pariteta bajtno, nič drugega občutka znotraj para; precedens dnevni
//    CSV/PDF par R163/R324);
//  • oči para: FileDown (PDF brat, spinner ob reportLoading) + FileSpreadsheet
//    (CSV) — CSV spinner-prosta (EN VIR sinhron + fail-closed, vzorec TRIADA
//    R334: vsak klik = ista resnica);
//  • definicijski naslov (MANDATORY STIL): CSV pill title izreče PRAVILA
//    (isti KPI, prihodki, računi in projekti kot PDF; prazen/pokvaren vnos →
//    iskren toast) + vidno razliko medija (PDF = tisk za pisarno, CSV =
//    Excel za filtriranje po mesecu/statusu);
//  • legenda medija: 'Poročilo CSV = ista resnica kot Poročilo PDF (KPI,
//    prihodki po mesecih, plačani in zapadli računi, projekti po statusu —
//    Excel za filtriranje).' (nov podpis R335, vidna pod 'Ta mesec' karticami);
//  • obrnjena regresija: val 21 TRIADA ŽIVA (končna verifikacija bajtno) +
//    val 20 PAR ŽIVA (material pozicija) + val 19 PAR ŽIVA (crm potekli) +
//    val 18 PAR ŽIVA (quote-followup) + val 17 PAR ŽIVA (logistika) + val 16
//    alarm ŽIVA + zgodovina PAR bajtno;
//  • vodja val 11/12 register ×4/×4 ostane (R336 novi gumb je v sestavljeni
//    kartici SistemZdravjeCard, ne v blok glavi — nič novih blokov/vrstic);
//    amber/50 register ×10 (val 8 drevesni števec 69 po R336; val 9 taktilni 17);
//  • globals anti-stale: .press-scale definicija ŽIVA; 0 surovih barv v
//    novem bloku (amber/50 ring + roksal tokena — 0-hex kanon val 15–21).
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const VODJA = join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx')
const MATERIAL = join(process.cwd(), 'src/components/roksal/material-intelligence-tab.tsx')
const CRM = join(process.cwd(), 'src/components/roksal/crm-tab.tsx')
const FOLLOWUP = join(process.cwd(), 'src/components/roksal/quote-followup.tsx')
const LOGISTIKA = join(process.cwd(), 'src/components/roksal/logistics-tab.tsx')
const DOBAV_PANEL = join(process.cwd(), 'src/components/roksal/cena-dobavitelji-panel.tsx')
const ZGOD_PANEL = join(process.cwd(), 'src/components/roksal/cena-zgodovina-panel.tsx')
const GLOBALS = join(process.cwd(), 'src/app/globals.css')
const VAL8 = join(process.cwd(), 'src/lib/__tests__/r317-stil-val8.test.ts')
const VAL9 = join(process.cwd(), 'src/lib/__tests__/r318-stil-val9.test.ts')

const src = readFileSync(VODJA, 'utf8')
const material = readFileSync(MATERIAL, 'utf8')
const crm = readFileSync(CRM, 'utf8')
const followup = readFileSync(FOLLOWUP, 'utf8')
const logistika = readFileSync(LOGISTIKA, 'utf8')
const dobav = readFileSync(DOBAV_PANEL, 'utf8')
const zgod = readFileSync(ZGOD_PANEL, 'utf8')
const globals = readFileSync(GLOBALS, 'utf8')
const val8 = readFileSync(VAL8, 'utf8')
const val9 = readFileSync(VAL9, 'utf8')

const BLOK_ZETON = 'transition-colors hover:border-roksal-amber/30'
const VRSTICA_ZETON = 'transition-colors hover:border-roksal-amber/40'
const RING_NAVY = 'focus-visible:ring-2 focus-visible:ring-roksal-navy/40'
// val 22 PAR žeton = vodja blok glavna družina (h-8 — ISTI kot Poročilo PDF
// brat + dnevni par; končna TRIADA val 21 je h-6 svoja družina in ostane).
const PAR_ZETON =
  'h-8 gap-1.5 border-roksal-navy/25 dark:border-roksal-ink/25 text-xs text-roksal-ink press-scale transition-all hover:border-roksal-amber hover:bg-roksal-amber/10 hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2'

/** Vrni okno N vrstic okoli prve vrstice, ki vsebuje marker (vzorec R324–R334). */
function oknoOkoli(vir: string, marker: string, okno = 10): string {
  const vrstice = vir.split('\n')
  const i = vrstice.findIndex((v) => v.includes(marker))
  expect(i).toBeGreaterThanOrEqual(0)
  return vrstice.slice(Math.max(0, i - okno), i + okno + 1).join('\n')
}

describe('r335 STIL val 22 — Mesečno poročilo CSV PAR pariteta na vodja blok glavi', () => {
  it('izvozna PAR = Poročilo PDF (runda M) + Poročilo CSV (R335) z ISTIM h-8 žetonom (press-scale + amber/50 + offset-2) — bratska simetrija bajtno', () => {
    const pdfGumb = oknoOkoli(src, 'aria-label="Prenesi mesečno PDF poročilo"', 9)
    const csvGumb = oknoOkoli(src, 'aria-label="Izvozi mesečno poročilo vodje kot CSV"', 9)
    expect(csvGumb).toContain(PAR_ZETON)
    expect(pdfGumb).toContain(PAR_ZETON)
    // pariteta: ISTA niz žetonov v ISTEM redu (nič drugega občutka znotraj
    // istega para) ('press-scale' diskriminator: icon vrstice VSEBUJAJO tudi
    // 'className=' — LE gumb lastna className vrstica nosi PAR žeton, vzorec
    // LEKCIJA R333)
    const pdfRazred = pdfGumb.split('\n').find((v) => v.includes('className=') && v.includes('press-scale'))
    const csvRazred = csvGumb.split('\n').find((v) => v.includes('className=') && v.includes('press-scale'))
    // 'ml-auto' = LAYOUT žeton (PDF brat je prvi desnega klastra — nosi ml-auto;
    // CSV sedi ZGORAJ njega, brez avtomarjine) — stil žetoni morajo biti
    // bajtno ENAKI ŠELE po odstranitvi layout žetona (iskrena pariteta)
    expect(csvRazred).toBe((pdfRazred ?? '').replace('ml-auto ', ''))
    // dnevni par (R163 CSV + R324 PDF) = ISTA družina (obrnjena regresija — h-8 register)
    const danCsv = oknoOkoli(src, 'aria-label="Izvozi dnevni pregled vodje kot CSV"', 9)
    expect(danCsv).toContain(PAR_ZETON)
  })

  it('oči para: FileDown (PDF, spinner ob reportLoading) + FileSpreadsheet (CSV) aria-hidden; CSV je spinner-prosta (EN VIR sinhron + fail-closed)', () => {
    const csvGumb = oknoOkoli(src, 'data-testid="vodja-mesecni-csv-pill"', 11)
    const pdfGumb = oknoOkoli(src, 'aria-label="Prenesi mesečno PDF poročilo"', 11)
    expect(csvGumb).toContain('<FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />')
    expect(pdfGumb).toContain('FileDown')
    // bratska resnica: CSV NIMA Loader2 (sinhron graditelj — vsak klik ista
    // resnica, vzorec TRIADA R334); PDF brat NOSI Loader2 (reportLoading veja
    // rundi M — nespremenjena)
    expect(csvGumb).not.toContain('<Loader2')
    expect(pdfGumb).toContain('<Loader2')
  })

  it('definicijski naslov izreče pravila + razliko medija + iskren fail-closed', () => {
    const csvGumb = oknoOkoli(src, 'data-testid="vodja-mesecni-csv-pill"', 7)
    expect(csvGumb).toContain('isti KPI, prihodki, računi in projekti kot PDF')
    expect(csvGumb).toContain('prazen/pokvaren vnos → iskren toast')
    expect(csvGumb).toContain('PDF = tisk za pisarno, CSV = Excel za filtriranje po mesecu/statusu')
  })

  it('legenda medija: Poročilo CSV imenovana ob PDF bratu (VEDNO vidna, pod Ta mesec karticami)', () => {
    expect(src).toContain(
      'Poročilo CSV = ista resnica kot Poročilo PDF (KPI, prihodki po mesecih, plačani in zapadli računi, projekti po statusu — Excel za filtriranje).',
    )
    // starejši podpisi NEPREMIKNJENI: končna legenda (R334) + dobičkonost legenda (R258/R293)
    expect(src).toContain('Končna verifikacija CSV = ista dokazna resnica kot PDF in JSON (Excel — dve tabeli + sklep).')
    expect(src).toContain('CSV = ista resnica kot PDF')
  })

  it('obrnjena regresija: val 21 TRIADA ŽIVA (končna bajtno) + val 20/19/18/17 PAR ŽIVA + val 16 alarm ŽIVA + zgodovina PAR bajtno', () => {
    // val 21: končna verifikacija TRIADA (JSON + PDF + CSV) ISTI className
    const konJson = oknoOkoli(src, 'aria-label="Izvozi poročilo končne verifikacije kot JSON"', 9)
    const konPdf = oknoOkoli(src, 'aria-label="Izvozi poročilo končne verifikacije kot PDF"', 9)
    const konCsv = oknoOkoli(src, 'aria-label="Izvozi poročilo končne verifikacije kot CSV"', 9)
    const konRazred = (okno: string) => okno.split('\n').find((v) => v.includes('className=') && v.includes('press-scale'))
    expect(konRazred(konCsv)).toBe(konRazred(konPdf))
    expect(konRazred(konPdf)).toBe(konRazred(konJson))
    // val 20: Pozicija PDF+CSV ISTI className (material-intelligence)
    const matPdf = oknoOkoli(material, 'aria-label="Izvozi pozicijo dobaviteljev kot PDF"', 9)
    const matCsv = oknoOkoli(material, 'aria-label="Izvozi pozicijo dobaviteljev kot CSV"', 9)
    expect(matCsv.split('\n').find((v) => v.includes('className=') && v.includes('press-scale'))).toBe(
      matPdf.split('\n').find((v) => v.includes('className=') && v.includes('press-scale')),
    )
    // val 19: Potekli PDF+CSV ISTI className (crm-tab)
    const crmPdf = oknoOkoli(crm, 'aria-label="Izvozi potekle opomnike kot PDF"', 7)
    const crmCsv = oknoOkoli(crm, 'aria-label="Izvozi potekle opomnike kot CSV"', 7)
    expect(crmCsv.split('\n').find((v) => v.includes('className='))).toBe(
      crmPdf.split('\n').find((v) => v.includes('className=')),
    )
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

  it('vodja val 11/12 register ostane ×4/×4 (novi gumb je v sestavljeni kartici, ne v blok glavi — nič novih blokov/vrstic; amber/50 register ×11 — val 8 drevo 70 po R337)', () => {
    expect(src.split(BLOK_ZETON).length - 1).toBe(4)
    expect(src.split(VRSTICA_ZETON).length - 1).toBe(4)
  })

  it('globals anti-stale: .press-scale definicija ŽIVA + novi PAR brez surovih barv (amber/50 = roksal token)', () => {
    expect(globals).toContain('.press-scale {')
    expect(globals).toContain('transform: scale(0.97)')
    const csvGumb = oknoOkoli(src, 'data-testid="vodja-mesecni-csv-pill"', 7)
    expect(csvGumb).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(csvGumb).not.toMatch(/\b(?:bg|text|border|ring)-(?:amber|navy|red|green)-\d{2,3}\b/)
  })

  it('register sodelovanje: R335 zapisek + R336/R337 PIN SHIFTI zapisana v val8 (70 + amber ×11) IN val9 (19 taktilnih [R355]) registrih — register resnica čez valove (LEKCIJA R334 5: vsi pini shiftani V ENI rundi)', () => {
    expect(val8).toContain('R335 PIN SHIFT 67 → 68')
    expect(val8).toContain('R336 PIN SHIFT 68 → 69')
    expect(val8).toContain('R337 PIN SHIFT 69 → 70')
    expect(val8).toContain('R355 PIN SHIFT 70 → 71')
    expect(val8).toContain('expect(gumbi.length).toBeGreaterThanOrEqual(71)') // R355 70 → 71
    expect(val8).toContain("expect(ariaVseh).toContain('Izvozi mesečno poročilo vodje kot CSV')")
    expect(val8).toContain('vodjaAmber.length).toBe(12)') // R355 11 → 12
    expect(val9).toContain('R335 PIN SHIFT (62. člen)')
    expect(val9).toContain('expect(pojavitve).toBe(19)') // R355 18 → 19
    expect(val9).toContain("'aria-label=\"Izvozi mesečno poročilo vodje kot CSV\"'")
  })
})
