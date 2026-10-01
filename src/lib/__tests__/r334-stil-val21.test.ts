// ---------------------------------------------------------------------------
// R334 — MANDATORY STIL val 21 (r162/…/R333 vzorec): 61. člen CSV brat na
// vodja končna-verifikacija blok glavi (isti EN VIR kot JSON R316 + PDF
// R320 — NOVI detajli).
//
// val 20 je na Material pregledu dodal izvozna PAR pariteto + definicijski
// naslov medija + legendo medija; val 21 JIH OHRANI (obrnjena regresija —
// polzaporedje ne sme nazaj) IN doda na NOVI površini (vodja končna
// verifikacija blok glava):
//  • izvozna TRIADA = JSON (R316) + PDF (R320) + NOVI CSV (R334) z ISTIM
//    žetonom (press-scale + navy/25 border + amber/50 ring + ring-offset-2
//    — pariteta bajtno, nič drugega občutka znotraj iste triade; vodja blok
//    glavni vzorec — amber/50 register ×8 → ×9 z obrnjeno regresijo);
//  • oči para: Download (JSON) + Download (PDF) + FileSpreadsheet (CSV) —
//    ISTA h-3 w-3 aria-hidden (triada je spinner-prosta — EN VIR graditelj
//    je sinhron in fail-closed, dvoklik guard ni potreben: vsak klik =
//    bajtno identična datoteka, kanon determinizma 46./47. člen);
//  • definicijski naslov (MANDATORY STIL): CSV pill title izreče PRAVILA
//    (isti pregled, plasti in sklep kot PDF; prazen/pokvaren audit →
//    iskren toast) + vidno razliko medija (PDF = tisk za pisarno, CSV =
//    Excel za filtriranje po območju/plasti);
//  • legenda medija: 'Končna verifikacija CSV = ista dokazna resnica kot
//    PDF in JSON (Excel — dve tabeli + sklep).' (nov podpis R334 —
//    starejši segmenti [sklep] NEPREMIKNJENI);
//  • obrnjena regresija: val 20 PAR ŽIVA (material pozicija) + val 19 PAR
//    ŽIVA (crm potekli) + val 18 PAR ŽIVA (quote-followup) + val 17 PAR
//    ŽIVA (logistika) + val 16 alarm ŽIVA + zgodovina PAR bajtno;
//  • vodja val 11/12 register ×4/×4 ostane (novi gumb je ZNOTRAJ obstoječe
//    sekcije končna-verifikacija — nič novih blokov/vrstic; amber/50
//    register ×9 — val 8 drevesni števec shifta v val8 registru: 67 po
//    R334);
//  • globals anti-stale: .press-scale definicija ŽIVA; 0 surovih barv v
//    novem bloku (amber/50 ring + roksal tokena — 0-hex kanon val 15–20).
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

const src = readFileSync(VODJA, 'utf8')
const material = readFileSync(MATERIAL, 'utf8')
const crm = readFileSync(CRM, 'utf8')
const followup = readFileSync(FOLLOWUP, 'utf8')
const logistika = readFileSync(LOGISTIKA, 'utf8')
const dobav = readFileSync(DOBAV_PANEL, 'utf8')
const zgod = readFileSync(ZGOD_PANEL, 'utf8')
const globals = readFileSync(GLOBALS, 'utf8')
const val8 = readFileSync(VAL8, 'utf8')

const BLOK_ZETON = 'transition-colors hover:border-roksal-amber/30'
const VRSTICA_ZETON = 'transition-colors hover:border-roksal-amber/40'
const RING_NAVY = 'focus-visible:ring-2 focus-visible:ring-roksal-navy/40'
// val 21 TRIADA žeton = vodja blok glavna družina (amber/50 + offset-2 —
// ISTI kot JSON/PDF brata; material par val 20 je navy/40 družina).
const TRIADA_ZETON = 'h-6 gap-1 border-roksal-navy/25 px-2 text-2xs text-roksal-ink press-scale transition-all hover:border-roksal-amber hover:bg-roksal-amber/10 hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2'

/** Vrni okno N vrstic okoli prve vrstice, ki vsebuje marker (vzorec R324–R333). */
function oknoOkoli(vir: string, marker: string, okno = 10): string {
  const vrstice = vir.split('\n')
  const i = vrstice.findIndex((v) => v.includes(marker))
  expect(i).toBeGreaterThanOrEqual(0)
  return vrstice.slice(Math.max(0, i - okno), i + okno + 1).join('\n')
}

describe('r334 STIL val 21 — Končna verifikacija CSV TRIADA pariteta na vodja blok glavi', () => {
  it('izvozna TRIADA = JSON + PDF + CSV z ISTIM žetonom (press-scale + amber/50 + offset-2) — bratska simetrija bajtno', () => {
    const jsonGumb = oknoOkoli(src, 'aria-label="Izvozi poročilo končne verifikacije kot JSON"', 9)
    const pdfGumb = oknoOkoli(src, 'aria-label="Izvozi poročilo končne verifikacije kot PDF"', 9)
    const csvGumb = oknoOkoli(src, 'aria-label="Izvozi poročilo končne verifikacije kot CSV"', 9)
    expect(jsonGumb).toContain(TRIADA_ZETON)
    expect(pdfGumb).toContain(TRIADA_ZETON)
    expect(csvGumb).toContain(TRIADA_ZETON)
    // pariteta: ISTA niz žetonov v ISTEM redu (nič drugega občutka znotraj
    // iste triade) ('press-scale' diskriminator: icon vrstice VSEBUJAJO
    // tudi 'className=' — LE gumb lastna className vrstica nosi TRIADO
    // žeton, vzorec LEKCIJA R333)
    const jsonRazred = jsonGumb.split('\n').find((v) => v.includes('className=') && v.includes('press-scale'))
    const pdfRazred = pdfGumb.split('\n').find((v) => v.includes('className=') && v.includes('press-scale'))
    const csvRazred = csvGumb.split('\n').find((v) => v.includes('className=') && v.includes('press-scale'))
    expect(csvRazred).toBe(pdfRazred)
    expect(pdfRazred).toBe(jsonRazred)
  })

  it('oči para: Download (JSON) + Download (PDF) + FileSpreadsheet (CSV) — ISTA h-3 w-3 + aria-hidden; TRIADA je spinner-prosta (EN VIR sinhron + fail-closed — vsak klik bajtno identičen)', () => {
    const csvGumb = oknoOkoli(src, 'aria-label="Izvozi poročilo končne verifikacije kot CSV"', 11)
    const jsonGumb = oknoOkoli(src, 'aria-label="Izvozi poročilo končne verifikacije kot JSON"', 11)
    const pdfGumb = oknoOkoli(src, 'aria-label="Izvozi poročilo končne verifikacije kot PDF"', 11)
    expect(csvGumb).toContain('<FileSpreadsheet className="h-3 w-3" aria-hidden="true" />')
    expect(jsonGumb).toContain('<Download className="h-3 w-3" aria-hidden="true" />')
    expect(pdfGumb).toContain('<Download className="h-3 w-3" aria-hidden="true" />')
    // bratska pariteta: NITI eden nima Loader2 (iskrena resnica — EN VIR
    // graditelj je sinhron in fail-closed; determinizem = vsak klik
    // bajtno identična datoteka)
    expect(csvGumb).not.toContain('<Loader2')
    expect(jsonGumb).not.toContain('<Loader2')
    expect(pdfGumb).not.toContain('<Loader2')
  })

  it('definicijski naslov izreče pravila + razliko medija + iskren fail-closed', () => {
    const csvGumb = oknoOkoli(src, 'data-testid="koncna-verifikacija-csv-pill"', 7)
    expect(csvGumb).toContain('isti pregled, plasti in sklep kot PDF')
    expect(csvGumb).toContain('prazen/pokvaren audit → iskren toast')
    expect(csvGumb).toContain('PDF = tisk za pisarno, CSV = Excel za filtriranje po območju/plasti')
  })

  it('legenda medija: Končna CSV imenovana ob PDF + JSON bratih + starejši segmenti (sklep) NEPREMIKNJENI (VEDNO vidna)', () => {
    expect(src).toContain('Končna verifikacija CSV = ista dokazna resnica kot PDF in JSON (Excel — dve tabeli + sklep).')
    // starejši segment NEPREMIKNJEN: sklep podpis (R315 WYSIWYG — EN VIR)
    expect(src).toContain('data-testid="koncna-verifikacija-sklep"')
  })

  it('obrnjena regresija: val 20 PAR ŽIVA (material pozicija) + val 19 PAR ŽIVA (crm potekli) + val 18 PAR ŽIVA (quote-followup) + val 17 PAR ŽIVA (logistika) + val 16 alarm ŽIVA + zgodovina PAR bajtno', () => {
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

  it('vodja val 11/12 register ostane ×4/×4 (novi gumb je ZNOTRAJ obstoječe sekcije — nič novih blokov/vrstic; amber/50 register ×9 — val 8 drevesni števec 67 po R334)', () => {
    expect(src.split(BLOK_ZETON).length - 1).toBe(4)
    expect(src.split(VRSTICA_ZETON).length - 1).toBe(4)
  })

  it('globals anti-stale: .press-scale definicija ŽIVA + nova TRIADA brez surovih barv (amber/50 = roksal token)', () => {
    expect(globals).toContain('.press-scale {')
    expect(globals).toContain('transform: scale(0.97)')
    const csvGumb = oknoOkoli(src, 'data-testid="koncna-verifikacija-csv-pill"', 7)
    expect(csvGumb).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(csvGumb).not.toMatch(/\b(?:bg|text|border|ring)-(?:amber|navy|red|green)-\d{2,3}\b/)
  })

  it('val 8 register sodelovanje: R334 zapisek (61. člen) ostane v val8 registru + R335 PIN SHIFT 67 → 68 + NOVI aria pin + vodja amber ×10 (register resnica čez valove — LEKCIJA R334 5: vsi pini shiftani V ENI rundi)', () => {
    // R334 zgodovinski zapisek ostane v val8 headerju (anti-stale zgodovina)
    expect(val8).toContain('R334 PIN SHIFT (61. člen)')
    // R335: trenutna resnica registra (62. člen — mesečno poročilo CSV)
    expect(val8).toContain('R335 PIN SHIFT 67 → 68')
    expect(val8).toContain('expect(gumbi.length).toBeGreaterThanOrEqual(68)')
    expect(val8).toContain("expect(ariaVseh).toContain('Izvozi poročilo končne verifikacije kot CSV')")
    expect(val8).toContain('vodjaAmber.length).toBe(10)')
  })
})
