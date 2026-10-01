// ---------------------------------------------------------------------------
// R330 — MANDATORY STIL val 17 (r162/…/R329 vzorec): 57. člen CSV brat na
// Logistiki (isti pregled EN VIR kot Projekti PDF — NOVI detajli).
//
// val 16 je na panelu Primerjava dobaviteljev dodal izvozni PAR + WYSIWYG
// alarm + tabelska glava border-b; val 17 JIH OHRANI (obrnjena regresija —
// polzaporedje ne sme nazaj) IN doda na NOVI površini (logistics izvozna
// vrsta):
//  • izvozna PAR = DVA gumba (Projekti PDF R265 + NOVI Projekti CSV R330 —
//    bratska simetrija z zgodovina PAR R327 in dobavitelji PAR R328/R329):
//    OBA nosita družinski navy/40 ring + press-scale + shrink-0 (pariteta,
//    nič drugega občutka znotraj istega para);
//  • oči para: ClipboardList (PDF) + FileSpreadsheet (CSV) — medija ikoni,
//    ISTA velikost/margins (h-4 w-4 mr-1, aria-hidden);
//  • definicijski naslov (MANDATORY STIL): CSV pill title izreče PRAVILA
//    (isti pregled EN VIR; prazen seznam → iskren toast, nikoli prazna
//    datoteka) + vidno razliko medija (PDF = tisk za vodjo, CSV = Excel za
//    filtriranje) — vzorec Ekipe CSV R299/R328;
//  • obrnjena regresija: val 16 alarm (text-roksal-red/green + font-medium)
//    ŽIVA na panelu dobaviteljev; val 15 hierarhija /40 > /30 ŽIVA; zgodovina
//    PAR bajtno nespremenjen (2× RING_NAVY + 2× press-scale);
//  • vodja val 11/12 register ×4/×4 se NE sme premakniti (novi gumb je na
//    logistics-tab — LEKCIJA R325 5; val 8 anti-stale PIN ostane 62 — brez
//    novega vodja amber gumba NI shifta, iskrena resnica);
//  • globals anti-stale: .press-scale definicija ŽIVA; 0 surovih barv v
//    novem bloku (navy/40 ring + roksal tokena — 0-hex kanon val 15/16).
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const LOGISTIKA = join(process.cwd(), 'src/components/roksal/logistics-tab.tsx')
const DOBAV_PANEL = join(process.cwd(), 'src/components/roksal/cena-dobavitelji-panel.tsx')
const ZGOD_PANEL = join(process.cwd(), 'src/components/roksal/cena-zgodovina-panel.tsx')
const VODJA = join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx')
const GLOBALS = join(process.cwd(), 'src/app/globals.css')

const src = readFileSync(LOGISTIKA, 'utf8')
const dobav = readFileSync(DOBAV_PANEL, 'utf8')
const zgod = readFileSync(ZGOD_PANEL, 'utf8')
const vodja = readFileSync(VODJA, 'utf8')
const globals = readFileSync(GLOBALS, 'utf8')

const BLOK_ZETON = 'transition-colors hover:border-roksal-amber/30'
const VRSTICA_ZETON = 'transition-colors hover:border-roksal-amber/40'
const RING_NAVY = 'focus-visible:ring-2 focus-visible:ring-roksal-navy/40'
const PAR_ZETON = 'shrink-0 press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40'

/** Vrni okno N vrstic okoli prve vrstice, ki vsebuje marker (vzorec R324/R326/R327/R328/R329). */
function oknoOkoli(vir: string, marker: string, okno = 8): string {
  const vrstice = vir.split('\n')
  const i = vrstice.findIndex((v) => v.includes(marker))
  expect(i).toBeGreaterThanOrEqual(0)
  return vrstice.slice(Math.max(0, i - okno), i + okno + 1).join('\n')
}

describe('r330 STIL val 17 — Projekti CSV PAR na logistiki + definicijski naslov', () => {
  it('izvozna PAR = DVA gumba, OBA z ISTIM družinskim žetonom (navy/40 ring + press-scale + shrink-0) — bratska simetrija', () => {
    const pdfGumb = oknoOkoli(src, 'aria-label="Izvozi pregled projektov in terminov kot PDF"', 7)
    const csvGumb = oknoOkoli(src, 'aria-label="Izvozi pregled projektov in terminov kot CSV"', 7)
    expect(pdfGumb).toContain(PAR_ZETON)
    expect(csvGumb).toContain(PAR_ZETON)
    // pariteta: ISTA niz žetonov v ISTEM redu (nič drugega občutka znotraj istega para)
    const pdfRazred = pdfGumb.split('\n').find((v) => v.includes('className='))
    const csvRazred = csvGumb.split('\n').find((v) => v.includes('className='))
    expect(csvRazred).toBe(pdfRazred)
  })

  it('oči para: ClipboardList (PDF) + FileSpreadsheet (CSV) — ISTA velikost h-4 w-4 mr-1 + aria-hidden', () => {
    const pdfGumb = oknoOkoli(src, 'aria-label="Izvozi pregled projektov in terminov kot PDF"', 9)
    const csvGumb = oknoOkoli(src, 'aria-label="Izvozi pregled projektov in terminov kot CSV"', 9)
    expect(pdfGumb).toContain('<ClipboardList aria-hidden="true" className="h-4 w-4 mr-1" />')
    expect(csvGumb).toContain('<FileSpreadsheet aria-hidden="true" className="h-4 w-4 mr-1" />')
  })

  it('definicijski naslov izreče pravila + razliko medija (PDF = tisk za vodjo, CSV = Excel za filtriranje)', () => {
    const csvGumb = oknoOkoli(src, 'data-testid="projekti-termini-csv-pill"', 6)
    expect(csvGumb).toContain('isti pregled in vrstni red kot Projekti PDF')
    expect(csvGumb).toContain('prazen seznam → iskren toast, nikoli prazna datoteka')
    expect(csvGumb).toContain('Projekti PDF = tisk za vodjo, Projekti CSV = Excel za filtriranje')
  })

  it('dvoklik guard pariteta: ptVTeku (PDF) + ptCsvVTeku (CSV) — disabled state na OBAH', () => {
    const pdfGumb = oknoOkoli(src, 'aria-label="Izvozi pregled projektov in terminov kot PDF"', 7)
    const csvGumb = oknoOkoli(src, 'aria-label="Izvozi pregled projektov in terminov kot CSV"', 7)
    expect(pdfGumb).toContain('disabled={ptVTeku}')
    expect(csvGumb).toContain('disabled={ptCsvVTeku}')
  })

  it('obrnjena regresija: val 16 alarm ŽIVA na panelu dobaviteljev (text-roksal-red/green + font-medium)', () => {
    expect(dobav).toContain("d.narasca > 0 ? 'py-1 pr-3 font-medium tabular-nums text-roksal-red'")
    expect(dobav).toContain("d.pada > 0 ? 'py-1 pr-3 font-medium tabular-nums text-roksal-green'")
    // val 15 hierarhija ostane ŽIVA (hierarhija /40 > /30)
    expect(dobav).toContain(BLOK_ZETON)
    expect(dobav).toContain(VRSTICA_ZETON)
    const blokNivo = Number(BLOK_ZETON.match(/amber\/(\d+)/)?.[1])
    const vrsticaNivo = Number(VRSTICA_ZETON.match(/amber\/(\d+)/)?.[1])
    expect(vrsticaNivo).toBeGreaterThan(blokNivo)
    // tabelska glava border-b (val 16) ostane ŽIVA
    const glava = oknoOkoli(dobav, 'CENA_DOBAVITELJI_CSV_GLAVE.map', 4)
    expect(glava).toContain('border-b border-border/60')
  })

  it('obrnjena regresija: zgodovina PAR bajtno NEPREMIKNJEN (2× RING_NAVY + 2× press-scale) + val 15 žetoni ŽIVA', () => {
    expect(zgod.split(RING_NAVY).length - 1).toBe(2)
    expect(zgod.split('press-scale').length - 1).toBe(2)
    expect(zgod).toContain(BLOK_ZETON)
    expect(zgod).toContain(VRSTICA_ZETON)
  })

  it('vodja val 11/12 register ostane ×4/×4 (novi gumb je na logistics-tab — LEKCIJA R325 5; val 8 anti-stale PIN shifta SAMO v val8 registru — 63 po R330)', () => {
    expect(vodja.split(BLOK_ZETON).length - 1).toBe(4)
    expect(vodja.split(VRSTICA_ZETON).length - 1).toBe(4)
  })

  it('globals anti-stale: .press-scale definicija ŽIVA + novi blok brez surovih barv (navy/40 = roksal token)', () => {
    expect(globals).toContain('.press-scale {')
    expect(globals).toContain('transform: scale(0.97)')
    // novi PAR blok: nič hex, nič surovih tailwind barvnih stopnja (0-hex kanon val 15/16)
    const csvGumb = oknoOkoli(src, 'data-testid="projekti-termini-csv-pill"', 6)
    expect(csvGumb).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(csvGumb).not.toMatch(/\b(?:bg|text|border|ring)-(?:amber|navy|red|green)-\d{2,3}\b/)
  })
})
