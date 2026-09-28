// R259 (P1-f nadgradna, 'izvozi' družina) — DOBAVITELJI PDF NADGRADNA:
// KPI 3 → 5 škatel (+ Povprečni rok AMBER / Najhitrejši GREEN — ISTI signalni
// jezik kot naročila-pregled R257), ENA izpeljava `dobaviteljiRokPovzetek`
// (KPI + tabela WYSIWYG + sklep + komponentni toast), tabela WYSIWYG (vsak
// nosilec MIN roka zeleno bold), sklep z agregatno resnico, legenda izvozne
// skupine (F2 stil).
//
// Tehnika dokazov (družina r234–r258): bajtni dokazi na bufferju (%PDF
// magija, %%EOF, determinizem); vsebinski dokazi na VIRU liba/komponente
// (PDF content stream je fontno kodiran — izvleka teksta iz bajtov NI
// resnična). Izenačba = naziv ASC f(MNOŽICA) — premešan vhod da ISTI
// nosilec (R258 lekcija 1, R257 lekcija sort).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildDobaviteljiPdfDoc,
  dobaviteljiRokPovzetek,
  type DobaviteljPdfVnos,
} from '@/lib/dobavitelji-pdf'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

const lib = beri('src/lib/dobavitelji-pdf.ts')
const komponenta = beri('src/components/roksal/material-intelligence-tab.tsx')

function dob(naziv: string, rok: number, aktivna = true, popust = 0): DobaviteljPdfVnos {
  return { naziv, aktivna, kontakt: null, telefon: null, email: null, dobavniRok: rok, popust }
}

const ZDANJ = new Date('2026-09-28T12:00:00.000Z')

function pdfBajti(vhod: readonly DobaviteljPdfVnos[]): Buffer {
  return Buffer.from(buildDobaviteljiPdfDoc(vhod, { now: ZDANJ }).output('arraybuffer'))
}

describe('R259 — dobaviteljiRokPovzetek (ENA izpeljava dobavnega roka)', () => {
  it('agregatna resnica — 3 dobavitelji (rok 5/12/7): povprečni 8, najhitrejši 5 (Alu-Mont), najpočasnejši 12 (Plesk)', () => {
    const p = dobaviteljiRokPovzetek([
      dob('Alu-Mont', 5),
      dob('Plesk', 12),
      dob('Ceving', 7),
    ])
    expect(p.povprecni).toBe(8)
    expect(p.najhitrejsi).toBe(5)
    expect(p.najhitrejsiNaziv).toBe('Alu-Mont')
    expect(p.najpocasnejsi).toBe(12)
    expect(p.najpocasnejsiNaziv).toBe('Plesk')
  })

  it('fail-closed: prazen seznam → TypeError (ni dokumenta, komponenta pokaže iskren toast)', () => {
    expect(() => dobaviteljiRokPovzetek([])).toThrow(TypeError)
    expect(() => dobaviteljiRokPovzetek([])).toThrow(/prazen seznam ne nastaja dokumenta/)
    expect(() => dobaviteljiRokPovzetek(null as unknown as DobaviteljPdfVnos[])).toThrow(TypeError)
  })

  it('en sam dobavitelj — povprečni = najhitrejši = najpočasnejši (n ≥ 1 → povprečje VEDNO definirano)', () => {
    const p = dobaviteljiRokPovzetek([dob('Solo Dobavitelj', 9)])
    expect(p.povprecni).toBe(9)
    expect(p.najhitrejsi).toBe(9)
    expect(p.najpocasnejsi).toBe(9)
    expect(p.najhitrejsiNaziv).toBe('Solo Dobavitelj')
    expect(p.najpocasnejsiNaziv).toBe('Solo Dobavitelj')
  })

  it('izenačba min — naziv ASC nosilec (f(MNOŽICA)): premešan vhod = ISTI rezultat (R258 lekcija 1)', () => {
    const naravni = dobaviteljiRokPovzetek([dob('Zulu', 4), dob('Beta', 4), dob('Gamma', 10)])
    const premesan = dobaviteljiRokPovzetek([dob('Gamma', 10), dob('Beta', 4), dob('Zulu', 4)])
    expect(naravni.najhitrejsi).toBe(4)
    expect(naravni.najhitrejsiNaziv).toBe('Beta')
    expect(premesan.najhitrejsi).toBe(4)
    expect(premesan.najhitrejsiNaziv).toBe('Beta')
    expect(naravni).toEqual(premesan)
  })

  it('izenačba max — naziv ASC nosilec (isti pravilo kot min: Plesk pred Zupan)', () => {
    const p = dobaviteljiRokPovzetek([dob('Zupan', 14), dob('Plesk', 14), dob('Beta', 3)])
    expect(p.najpocasnejsi).toBe(14)
    expect(p.najpocasnejsiNaziv).toBe('Plesk')
  })

  it('ne-celo povprečje — 20 dni / 3 = 6.666… → dokumentni zapis toFixed(1) "6.7" (točka, ne izmišljen 0)', () => {
    const p = dobaviteljiRokPovzetek([dob('A', 5), dob('B', 7), dob('C', 8)])
    expect(p.povprecni).toBeCloseTo(6.666666, 5)
    expect(p.povprecni.toFixed(1)).toBe('6.7')
  })

  it('povzetek je čista f(vhoda) — brez now/brez API-ja (dva klica = isti rezultat)', () => {
    const vhod = [dob('Alu-Mont', 5), dob('Plesk', 12)]
    expect(dobaviteljiRokPovzetek(vhod)).toEqual(dobaviteljiRokPovzetek(vhod))
    expect(lib).not.toContain("from 'node:crypto'")
    expect(lib).not.toContain('Math.random')
  })
})

describe('R259 — PDF nadgradna: KPI 5 škatel + WYSIWYG + sklep', () => {
  it('bajtni dokazi: %PDF- magija + %%EOF + zdrava dolžina (nadgradna ne uniči dokumenta)', () => {
    const b = pdfBajti([dob('Alu-Mont', 5), dob('Plesk', 12)])
    expect(b.length).toBeGreaterThan(1000)
    expect(b.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(b.subarray(-6).toString('ascii').trim()).toBe('%%EOF')
  })

  it('determinizem — enak vhod (in enak now) = bajtno enak dokument (KPI 5 škatel VKLJUČENO)', () => {
    const vhod = [dob('Alu-Mont', 5), dob('Plesk', 12), dob('Beta', 7, false, 3)]
    expect(pdfBajti(vhod).equals(pdfBajti(vhod))).toBe(true)
  })

  it('drugačen vhod → drugačen dokument (fileId seed kontrakt R236 nespremenjen)', () => {
    const a = pdfBajti([dob('Alu-Mont', 5)])
    const b = pdfBajti([dob('Alu-Mont', 6)])
    expect(a.equals(b)).toBe(false)
    expect(lib).toContain(
      '`${s.naziv.trim()}:${s.aktivna ? 1 : 0}/${s.dobavniRok}+${s.popust}`',
    )
  })

  it('soli 0x21–0x24 NESSPREMENJENE (družinski ID drv po libu — nadgradna ne meče kontraktov)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0x21)')
    expect(lib).toContain('fnv1aHex(seed, 0x24)')
  })

  it('KPI 5 škatel — Povprečni rok AMBER + Najhitrejši GREEN (isti signalni jezik kot R257)', () => {
    expect(lib).toContain("'Povprečni rok'")
    expect(lib).toContain('`${povzetek.povprecni.toFixed(1)} dni`')
    expect(lib).toContain('AMBER')
    expect(lib).toContain("'Najhitrejši'")
    expect(lib).toContain('`${povzetek.najhitrejsi} dni`')
    expect(lib).toContain('GREEN')
  })

  it('5-box razporeditev — bw 33 (naročila-pregled R257 pariteta: 5 × 33 + 4 × 4 = 181 mm)', () => {
    expect(lib).toContain('const bw = 33')
    expect(lib).toContain('kpiBox(doc, 14 + 3 * (bw + gap), y, bw, bh,')
    expect(lib).toContain('kpiBox(doc, 14 + 4 * (bw + gap), y, bw, bh,')
  })

  it('WYSIWYG tabela — vsak nosilec MIN roka zeleno bold (col 5; izenačba = VSI nosilci vidno)', () => {
    expect(lib).toContain('data.column.index === 5')
    expect(lib).toContain('data.cell.raw === String(povzetek.najhitrejsi)')
    expect(lib).toContain('data.cell.styles.textColor = GREEN')
    expect(lib).toContain("data.cell.styles.fontStyle = 'bold'")
  })

  it('ENA izpeljava — const povzetek = dobaviteljiRokPovzetek(dobavitelji) hrani KPI + tabela + sklep (ni izračuna drugje)', () => {
    expect(lib).toContain('const povzetek = dobaviteljiRokPovzetek(dobavitelji)')
    expect(lib.match(/povzetek\./g)?.length ?? 0).toBeGreaterThanOrEqual(6)
  })

  it('sklep nosi agregatno resnico — povprečni (1 decimalno mesto) + najhitrejši z nosilcem, splitTextToSize', () => {
    expect(lib).toContain('splitTextToSize')
    expect(lib).toContain('povprečni dobavni rok ${povzetek.povprecni.toFixed(1)} dni')
    expect(lib).toContain('najhitrejši ${povzetek.najhitrejsi} dni (${povzetek.najhitrejsiNaziv})')
  })

  it('lib NIČ localeCompare (R257 lekcija — code-unit < je determinističen čez runtimes)', () => {
    expect(lib).not.toContain('localeCompare')
  })
})

describe('R259 — komponenta: toast z realnim agregatom + legenda (F2 stil)', () => {
  it('toast nosi agregatno resnico dobavnega roka — ENA izpeljava + SI vejica (R248 lekcija)', () => {
    expect(komponenta).toContain('const roki = dobaviteljiRokPovzetek(suppliers)')
    expect(komponenta).toContain("roki.povprecni.toFixed(1).replace('.', ',')")
    expect(komponenta).toContain('povprečni dobavni rok ${roki.povprecni')
    expect(komponenta).toContain('najhitrejši ${roki.najhitrejsi} dni (${roki.najhitrejsiNaziv})')
  })

  it('legenda izvozne skupine (želona pariteta R256–R258) — aria + besedilo resnice', () => {
    expect(komponenta).toContain('aria-label="Legenda izvoza dobaviteljev"')
    expect(komponenta).toContain(
      'CSV = vrstica per dobavitelj · PDF = arhivski pregled z povprečnim in najhitrejšim dobavnim rokom',
    )
  })

  it('r236 kontrakti ostanejo — KPI osnovni trije + fail-closed toast komponente nespremenjen', () => {
    expect(lib).toContain("kpiBox(doc, 14, y, bw, bh, 'Dobavitelji', String(dobavitelji.length), NAVY)")
    expect(lib).toContain("kpiBox(doc, 14 + bw + gap, y, bw, bh, 'Aktivni', String(aktivnih)")
    expect(lib).toContain("kpiBox(doc, 14 + 2 * (bw + gap), y, bw, bh, 'Neaktivni', String(neaktivnih), NAVY)")
    expect(komponenta).toContain('if (loading) return')
    expect(komponenta).toContain('buildDobaviteljiPdfDoc(suppliers, { now })')
  })
})
