// R323 — 51. člen (issue #1 IZVOZI družina): izvoz meritev zmogljivosti kot
// DETERMINISTIČNI CSV (Deliverable 6 kot prenosljiv artifact — družinska
// simetrija kanon: Del. 4 = CSV+PDF [R317/R318], Del. 7 = JSON+PDF
// [R316/R320], Del. 6 = PDF [R321] + CSV [R322]). CSV brat zaslona R312 in
// PDF brata R321: pregled = POSREDOVANA resnica (meritev se izvede ENKRAT
// v brskalniku — PDF/CSV NE merita znova, kanon R321); sklep VERBATIM
// (ČETRTI potrošnik ENEGA niza — zaslon + testi + PDF + CSV); formatirajMs
// + glave + validacija = EN VIR iz brata (zaslon, PDF in CSV ne moreta
// divergirati po konstrukciji, vzorec AUDIT_CSV_GLAVE R317).
// Dokazni plasti (r302/r318/r320/r321 kanon): BAJTNI dokazi (BOM + glava +
// determinizem + razlike po vhodu) + SOURCE-level EN VIR pini (uvozi, NIČ
// redefinicij).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildZmogljivostCsv, zmogljivostCsvFilename } from '@/lib/zmogljivost-pregled-csv'
import { ZMOGLJIVOST_VIR_NIZ, type ZmogljivostPregled } from '@/lib/zmogljivost-pregled'

const csvLib = readFileSync(resolve(__dirname, '../zmogljivost-pregled-csv.ts'), 'utf8')
const bratLib = readFileSync(resolve(__dirname, '../zmogljivost-pregled.ts'), 'utf8')
const pdfLib = readFileSync(resolve(__dirname, '../zmogljivost-pregled-pdf.ts'), 'utf8')
const komponenta = readFileSync(resolve(__dirname, '../../components/roksal/vodja-dashboard.tsx'), 'utf8')

/** Kraftan pregled — majhen, popolnoma kontrakt-nezdružljivosti prost
 *  (deterministični časi — bajtni razlike po vhodu NE odvisijo od ure). */
function kraftPregled(id = 'kraft.op', najmanj = 1.5, mediana = 2, najvec = 3, iteracij = 4): ZmogljivostPregled {
  return {
    meritve: [
      {
        id,
        opis: 'kraftan opis operacije',
        modul: 'src/lib/kraft.ts',
        iteracij,
        enota: 'ms',
        najmanj,
        mediana,
        najvec,
        preverjeno: true,
      },
    ],
    skupajIteracij: iteracij,
    sklep: 'kraftan sklep — EN VIR niz za zaslon + testi + PDF + CSV.',
  }
}

const BOM = '\uFEFF'

describe('r323 — 51. člen: meritve zmogljivosti CSV (oblika + WYSIWYG)', () => {
  it('oblika: BOM + glave EN VIR verbatim + CRLF + filename determinističen (brez datuma)', () => {
    const { csv, vrstic } = buildZmogljivostCsv(kraftPregled())
    expect(csv.startsWith(BOM)).toBe(true)
    // Glave = ZMOGLJIVOST_IZVOZ_GLAVE verbatim (podpičje ločilo — kanon R136).
    expect(csv.slice(BOM.length)).toMatch(/^Operacija;Opis;Modul;Iteracij;Najmanj;Mediana;Najvec\r\n/)
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(vrstic).toBe(1)
    expect(zmogljivostCsvFilename()).toBe('zmogljivost-pregled.csv')
  })

  it('WYSIWYG vrstica: id;opis;modul;iteracij;časi po formatirajMs — ISTA ravnina kot zaslon vrstica in PDF tabela', () => {
    const { csv } = buildZmogljivostCsv(kraftPregled())
    const vrstice = csv.split('\r\n')
    expect(vrstice[1]).toBe('kraft.op;kraftan opis operacije;src/lib/kraft.ts;4;1.50;2.00;3.00')
  })

  it('formatirajMs pariteta: < 100 ms = dve decimalki z TOČKO, ≥ 100 = celo (ISTA izraz kot zaslon + PDF)', () => {
    const { csv } = buildZmogljivostCsv(kraftPregled('kraft.op', 12.34, 99.999, 123))
    const vrstica = csv.split('\r\n')[1]!
    expect(vrstica).toBe('kraft.op;kraftan opis operacije;src/lib/kraft.ts;4;12.34;100.00;123')
  })

  it('vrstni red vrstic = ISTI vrstni red kot pregled.meritve (nič re-sorta — kanon pregleda)', () => {
    const pregled = kraftPregled()
    const { csv } = buildZmogljivostCsv(pregled)
    const indeksi = pregled.meritve.map((m) => csv.indexOf(m.id))
    for (let i = 1; i < indeksi.length; i++) {
      expect(indeksi[i]!).toBeGreaterThan(indeksi[i - 1]!)
    }
  })

  it('meta: sklep EN VIR verbatim (ČETRTI potrošnik) + Vir niz + prazna ločilna vrstica', () => {
    const { csv } = buildZmogljivostCsv(kraftPregled())
    const vrstice = csv.split('\r\n')
    expect(vrstice[2]).toBe('')
    expect(vrstice[3]).toBe('Sklep;kraftan sklep — EN VIR niz za zaslon + testi + PDF + CSV.')
    expect(vrstice[4]).toBe(`Vir;${ZMOGLJIVOST_VIR_NIZ}`)
  })

  it('DETERMINIZEM: dve gradnji ISTEGA pregleda = bajtno identična CSV (brez časa v vsebini)', () => {
    const a = buildZmogljivostCsv(kraftPregled()).csv
    const b = buildZmogljivostCsv(kraftPregled()).csv
    expect(a).toBe(b)
    // drug pregled (drugi časi) = drugačen CSV (resnica je posredovana)
    const c = buildZmogljivostCsv(kraftPregled('kraft.op', 5, 6, 7)).csv
    expect(c).not.toBe(a)
  })
})

describe('r323 — EN VIR pini (source-level — NIČ redefinicij)', () => {
  it('CSV lib UVAŽA formatirajMs + validacijo + glave + vir niz iz brata (NIČ lokalnih redefinicij)', () => {
    expect(csvLib).toContain("formatirajMs,\n  preveriZmogljivostPregledZaIzvoz,\n  ZMOGLJIVOST_IZVOZ_GLAVE,\n  ZMOGLJIVOST_VIR_NIZ,\n} from './zmogljivost-pregled'")
    expect(csvLib).toContain("import { toCsv } from '@/lib/csv-export'")
    // NIČ lokalne validacijske kopije (pravila živijo SAMO v bratu)
    expect(csvLib).not.toContain('function preveriMeritev')
    expect(csvLib).not.toContain('pričakovana enota')
  })

  it('PDF brat uvaža ISTI glavi niz — stolpci PDF/CSV ne moreta divergirati po konstrukciji', () => {
    expect(pdfLib).toContain('ZMOGLJIVOST_IZVOZ_GLAVE')
    // obrnjena regresija: inline glavni literali IZ PDF tabele ODSTRANJENI
    expect(pdfLib).not.toContain("['Operacija', 'Opis', 'Modul', 'Iteracij', 'Najmanj', 'Mediana', 'Najvec']")
  })

  it('obrnjena regresija: CSV funkcij NI v merilnem bratu IN NI v PDF libu (ena definicija, EN lib)', () => {
    expect(bratLib).not.toContain('buildZmogljivostCsv')
    expect(pdfLib).not.toContain('buildZmogljivostCsv')
    expect(bratLib).not.toContain('zmogljivostCsvFilename')
  })
})

describe('r323 — fail-closed (kanon R299/R302/R306 — sporočila nosijo graditelja)', () => {
  it('ne-objekt pregled / prazne meritve / brez sklepa / pokvaren skupajIteracij → TypeError', () => {
    expect(() => buildZmogljivostCsv(null as unknown as ZmogljivostPregled)).toThrow(
      /buildZmogljivostCsv: pričakovan pregled/,
    )
    expect(() =>
      buildZmogljivostCsv({ ...kraftPregled(), meritve: [] } as unknown as ZmogljivostPregled),
    ).toThrow(/pregled brez meritev — brez izvedene meritve ni izmišljenih števil/)
    expect(() =>
      buildZmogljivostCsv({ ...kraftPregled(), sklep: '' } as unknown as ZmogljivostPregled),
    ).toThrow(/pričakovan sklep/)
    expect(() =>
      buildZmogljivostCsv({ ...kraftPregled(), skupajIteracij: 0 } as unknown as ZmogljivostPregled),
    ).toThrow(/pričakovan pozitiven skupajIteracij/)
  })

  it('meritev brez kontrakta: prazen id / iteracij < 3 / ne-ms enota / preverjeno !== true → TypeError', () => {
    expect(() => buildZmogljivostCsv(kraftPregled(''))).toThrow(/pričakovan id/)
    expect(() => buildZmogljivostCsv(kraftPregled('kraft.op', 1, 2, 3, 2))).toThrow(/≥ 3 iteracij/)
    expect(() =>
      buildZmogljivostCsv({
        ...kraftPregled(),
        meritve: [{ ...kraftPregled().meritve[0]!, enota: 'µs' as never }],
      } as unknown as ZmogljivostPregled),
    ).toThrow(/pričakovana enota 'ms'/)
    const nepreverjena = {
      ...kraftPregled(),
      meritve: [{ ...kraftPregled().meritve[0]!, preverjeno: false }],
    } as unknown as ZmogljivostPregled
    expect(() => buildZmogljivostCsv(nepreverjena)).toThrow(/meritev NI preverjena/)
  })

  it('notranja neskladja časov + zip usklajenost (vsota iteracij) → TypeError', () => {
    expect(() => buildZmogljivostCsv(kraftPregled('kraft.op', 3, 2, 1))).toThrow(/notranja neskladja časov/)
    expect(() => buildZmogljivostCsv({ ...kraftPregled(), skupajIteracij: 999 })).toThrow(
      /notranja neskladja skupajIteracij/,
    )
  })
})

describe('r323 — vodja žičenje (a11y izvozne družine — R291/R293 + ničelna veja)', () => {
  it('CSV gumb: aria + title + handler + import pair (žeton ISTI kot PDF brat)', () => {
    expect(komponenta).toContain('aria-label="Izvozi meritve zmogljivosti kot CSV"')
    expect(komponenta).toContain('onClick={exportZmogljivostCsv}')
    expect(komponenta).toContain("buildZmogljivostCsv, zmogljivostCsvFilename } from '@/lib/zmogljivost-pregled-csv'")
    expect(komponenta).toContain('kot deterministični CSV')
  })

  it('iskrena ničelna veja + fail-verbose toast (NIČ izmišljenih števil, razlog vidno)', () => {
    const handler = komponenta.slice(
      komponenta.indexOf('function exportZmogljivostCsv'),
      komponenta.indexOf('if (loading)'),
    )
    expect(handler).toContain('Meritve še niso izvedene')
    expect(handler).toContain('CSV se izvozi, ko je merjenje zaključeno v brskalniku.')
    expect(handler).toContain("variant: 'destructive'")
    expect(handler).toContain('downloadCsvText(zmogljivostCsvFilename(), csv)')
  })

  it('CSV gumb nosi izvozno-družinski žeton (press-scale + amber hover + focus ring — taktilna pariteta)', () => {
    const gumbI = komponenta.indexOf('aria-label="Izvozi meritve zmogljivosti kot CSV"')
    const gumbRazred = komponenta.slice(gumbI - 900, gumbI)
    expect(gumbRazred).toContain('press-scale')
    expect(gumbRazred).toContain('hover:border-roksal-amber')
    expect(gumbRazred).toContain('focus-visible:ring-roksal-amber/50')
  })
})
