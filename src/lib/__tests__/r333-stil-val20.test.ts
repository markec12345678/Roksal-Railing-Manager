// ---------------------------------------------------------------------------
// R333 — MANDATORY STIL val 20 (r162/…/R332 vzorec): 60. člen CSV brat na
// Material pregled izvozni coni (isti presek EN VIR kot Pozicija dobaviteljev
// PDF R264 — NOVI detajli).
//
// val 19 je na CRM tabu dodal izvozna PAR pariteto + definicijski naslov
// medija + legendo medija; val 20 JIH OHRANI (obrnjena regresija —
// polzaporedje ne sme nazaj) IN doda na NOVI površini (material-intelligence
// izvozna cona, podzavihek Cenik):
//  • izvozna PAR = PDF (R264) + NOVI CSV (R333) z ISTIM žetonom (press-scale
//    + navy/40 ring + h-6 gap-1 text-2xs + ring-offset-2 (val 49 normalizacija
//    R366; izvorno offset-1) — pariteta bajtno,
//    nič drugega občutka znotraj istega para; TA površina nosi h-6 žeton —
//    val 19 CRM par je h-7 — vsaka površina svoja družinska žetona);
//  • oči para: FileText (PDF) + FileSpreadsheet (CSV) — ISTA h-3 w-3
//    aria-hidden (ta PAR je spinner-prosta — disabled žig je pariteta:
//    loading || pozicijaVTeku / loading || pozicijaCsvVTeku);
//  • definicijski naslov (MANDATORY STIL): CSV pill title izreče PRAVILA
//    (isti pregled, vrstni red in odstotki kot PDF; prazen seznam → iskren
//    toast) + vidno razliko medija (PDF = tisk za pogajanja, CSV = Excel za
//    filtriranje po dobavitelju);
//  • legenda medija: '· Pozicija CSV = ista pozicijska resnica kot PDF
//    (Excel)' (nov podpis R333 — starejši segmenti NEPREMIKNJENI);
//  • obrnjena regresija: val 19 PAR ŽIVA (CRM potekli) + val 18 PAR ŽIVA
//    (quote-followup) + val 17 PAR ŽIVA (logistika) + val 16 alarm ŽIVA +
//    zgodovina PAR bajtno;
//  • vodja val 11/12 register ×4/×4 se NE sme premakniti (novi gumb je na
//    Material pregledu — LEKCIJA R325 5; amber/50 register ostane zaklenjen
//    v vodji ×8 — NOV gumb nosi navy/40, val 8 drevesni števec shifta v
//    val8 registru: 66 po R333);
//  • globals anti-stale: .press-scale definicija ŽIVA; 0 surovih barv v
//    novem bloku (navy/40 ring + roksal tokena — 0-hex kanon val 15–19).
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const MATERIAL = join(process.cwd(), 'src/components/roksal/material-intelligence-tab.tsx')
const CRM = join(process.cwd(), 'src/components/roksal/crm-tab.tsx')
const FOLLOWUP = join(process.cwd(), 'src/components/roksal/quote-followup.tsx')
const LOGISTIKA = join(process.cwd(), 'src/components/roksal/logistics-tab.tsx')
const DOBAV_PANEL = join(process.cwd(), 'src/components/roksal/cena-dobavitelji-panel.tsx')
const ZGOD_PANEL = join(process.cwd(), 'src/components/roksal/cena-zgodovina-panel.tsx')
const VODJA = join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx')
const GLOBALS = join(process.cwd(), 'src/app/globals.css')

const src = readFileSync(MATERIAL, 'utf8')
const crm = readFileSync(CRM, 'utf8')
const followup = readFileSync(FOLLOWUP, 'utf8')
const logistika = readFileSync(LOGISTIKA, 'utf8')
const dobav = readFileSync(DOBAV_PANEL, 'utf8')
const zgod = readFileSync(ZGOD_PANEL, 'utf8')
const vodja = readFileSync(VODJA, 'utf8')
const globals = readFileSync(GLOBALS, 'utf8')

const BLOK_ZETON = 'transition-colors hover:border-roksal-amber/30'
const VRSTICA_ZETON = 'transition-colors hover:border-roksal-amber/40'
const RING_NAVY = 'focus-visible:ring-2 focus-visible:ring-roksal-navy/40'
// val 20 PAR žeton = material-intelligence površinska družina (h-6 — ISTI
// kot cenik/primerjalni pilli na ISTI coni; CRM par val 19 je h-7 družina).
// val 49 (R366): ring-offset-1→2 normalizacija (precedens val 44/47) — žeton
// bajtno isti razen offseta; pariteta 26/26 navy/40 offset-2.
const PAR_ZETON_MATERIAL = 'h-6 gap-1 text-2xs press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'

/** Vrni okno N vrstic okoli prve vrstice, ki vsebuje marker (vzorec R324–R332). */
function oknoOkoli(vir: string, marker: string, okno = 10): string {
  const vrstice = vir.split('\n')
  const i = vrstice.findIndex((v) => v.includes(marker))
  expect(i).toBeGreaterThanOrEqual(0)
  return vrstice.slice(Math.max(0, i - okno), i + okno + 1).join('\n')
}

describe('r333 STIL val 20 — Pozicija CSV PAR pariteta na Material izvozni coni', () => {
  it('izvozna PAR = PDF + CSV z ISTIM žetonom (press-scale + navy/40 + h-6 + ring-offset-2 po val 49) — bratska simetrija bajtno', () => {
    const pdfGumb = oknoOkoli(src, 'aria-label="Izvozi pozicijo dobaviteljev kot PDF"', 9)
    const csvGumb = oknoOkoli(src, 'aria-label="Izvozi pozicijo dobaviteljev kot CSV"', 9)
    expect(pdfGumb).toContain(PAR_ZETON_MATERIAL)
    expect(csvGumb).toContain(PAR_ZETON_MATERIAL)
    // pariteta: ISTA niz žetonov v ISTEM redu (nič drugega občutka znotraj istega para)
    // ('press-scale' diskriminator: icon vrstice VSEBUJAJO tudi 'className=' —
    // le gumb lastna className vrstica nosi PAR žeton, vzorec LEKCIJA R333)
    const pdfRazred = pdfGumb.split('\n').find((v) => v.includes('className=') && v.includes('press-scale'))
    const csvRazred = csvGumb.split('\n').find((v) => v.includes('className=') && v.includes('press-scale'))
    expect(csvRazred).toBe(pdfRazred)
  })

  it('oči para: FileSpreadsheet (CSV) + FileText (PDF) — ISTA h-3 w-3 + aria-hidden; PAR je spinner-prosta (disabled žig pariteta)', () => {
    const csvGumb = oknoOkoli(src, 'aria-label="Izvozi pozicijo dobaviteljev kot CSV"', 11)
    const pdfGumb = oknoOkoli(src, 'aria-label="Izvozi pozicijo dobaviteljev kot PDF"', 11)
    expect(csvGumb).toContain('<FileSpreadsheet className="h-3 w-3" aria-hidden="true" />')
    expect(pdfGumb).toContain('<FileText className="h-3 w-3" aria-hidden="true" />')
    // bratska pariteta: NITI eden nima Loader2 (izkrena resnica — vsak brat
    // svoj dvoklik guard, disabled žig pove vteku)
    expect(csvGumb).not.toContain('<Loader2')
    expect(pdfGumb).not.toContain('<Loader2')
    // disabled žigi = ISTI vzorec (loading + svoj state — pariteta oblike)
    expect(src).toContain('disabled={loading || pozicijaVTeku}')
    expect(src).toContain('disabled={loading || pozicijaCsvVTeku}')
  })

  it('definicijski naslov izreče pravila + razliko medija + iskren fail-closed', () => {
    const csvGumb = oknoOkoli(src, 'data-testid="pozicija-dobaviteljev-csv-pill"', 7)
    expect(csvGumb).toContain('isti pregled, vrstni red in odstotki kot PDF')
    expect(csvGumb).toContain('prazen seznam → iskren toast, nikoli prazna datoteka')
    expect(csvGumb).toContain('PDF = tisk za pogajanja, CSV = Excel za filtriranje po dobavitelju')
  })

  it('legenda medija: Pozicija CSV imenovana ob PDF bratu + starejši segmenti NEPREMIKNJENI (VEDNO vidna)', () => {
    expect(src).toContain('· Pozicija = dobavitelji × najnižja per artikel · Brez alternative = samo ena ponudba · Pozicija CSV = ista pozicijska resnica kot PDF (Excel)')
    expect(src).toContain('Cenik = vse ponudbe · Primerjalni = najnižja per artikel · % = razpon do najvišje')
  })

  it('obrnjena regresija: val 19 PAR ŽIVA (CRM potekli) + val 18 PAR ŽIVA (quote-followup) + val 17 PAR ŽIVA (logistika) + val 16 alarm ŽIVA + zgodovina PAR bajtno', () => {
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

  it('vodja val 11/12 register ostane ×4/×4 (novi gumb je na Material pregledu — LEKCIJA R325 5; amber/50 register zaklenjen ×8 — NOV gumb nosi navy/40, val 8 drevesni števec 66 po R333)', () => {
    expect(vodja.split(BLOK_ZETON).length - 1).toBe(4)
    expect(vodja.split(VRSTICA_ZETON).length - 1).toBe(4)
  })

  it('globals anti-stale: .press-scale definicija ŽIVA + novi PAR blok brez surovih barv (navy/40 = roksal token)', () => {
    expect(globals).toContain('.press-scale {')
    expect(globals).toContain('transform: scale(0.97)')
    const csvGumb = oknoOkoli(src, 'data-testid="pozicija-dobaviteljev-csv-pill"', 7)
    expect(csvGumb).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(csvGumb).not.toMatch(/\b(?:bg|text|border|ring)-(?:amber|navy|red|green)-\d{2,3}\b/)
  })

  it('RING_NAVY družinski kanon: NOVI CSV pill nosi navy/40 (ne generične baze, ne amber/50) + ISTA press-scale pariteta z PDF bratom', () => {
    const csvGumb = oknoOkoli(src, 'data-testid="pozicija-dobaviteljev-csv-pill"', 9)
    expect(csvGumb).toContain(RING_NAVY)
    expect(csvGumb).not.toContain('ring-roksal-amber/50')
    // ISTA press-scale pariteta z PDF bratom (R161 družina — vsi izvozni gumbi)
    expect(csvGumb).toContain('press-scale')
  })
})
