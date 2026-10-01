// ---------------------------------------------------------------------------
// R329 — 56. člen (issue #1 IZVOZI družina): izvoz PRIMERJAVE DOBAVITELJEV
// kot DETERMINISTIČNI PDF. PDF brat CSV-ju R328 (vzorec R318/R320/R321/R324/
// R327: LOČEN lib): vhod = POSREDOVANA resnica (EN VIR z CSV bratom — panel
// EN pregled, TRIje potrošniki: zaslon + CSV + PDF), podatkovne vrstice =
// cenaDobaviteljiVrstice (UVOŽENE — ISTA preslikava kot CSV strojne
// vrstice), glave + sklep + VIR_NIZ = UVOŽENI iz brata (NIČ podvojenih
// pravil — vzorec vodja-dnevni-pdf R324 / cena-zgodovina-pdf R327);
// CENA_DOBAVITELJI_VIR_NIZ = družinski kontrakt (CSV arhivska oblika ostaja
// BAJTNO nespremenjena). Determinizem kanon 46.–56. člen: vsebina brez časa
// (primerjava NIMA referenčnega dneva — filename brez datuma), fiksni
// formatni žig DOBAVITELJI_PDF_ZIG_FIKSNI, FNV fileId soli 0xd5–0xd8 → isti
// HEAD + isti vhod = bajtno identičen PDF. Dokazni plasti (r302/r318/r320/
// r321/r324/r327 kanon): BAJTNI dokazi (magija + determinizem + razlike po
// vhodu) + SOURCE-level EN VIR pini (uvozi, NIČ redefinicij) + CSV bajtna
// stabilnost (arhivska resnica — družina se ne more divergirati).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildCenaDobaviteljePdfDoc,
  generateCenaDobaviteljePdf,
  cenaDobaviteljiPdfFilename,
  DOBAVITELJI_PDF_ZIG_FIKSNI,
  type CenaDobaviteljiPdfOptions,
} from '@/lib/cena-dobavitelji-pdf'
import {
  buildCenaDobavitelje,
  buildCenaDobaviteljeCsv,
  cenaDobaviteljiSklep,
  cenaDobaviteljiVrstice,
  cenaDobaviteljiCsvFilename,
  CENA_DOBAVITELJI_CSV_GLAVE,
  CENA_DOBAVITELJI_VIR_NIZ,
} from '@/lib/cena-dobavitelji'
import { buildCenaZgodovina, type CenaZgodovinaVnos } from '@/lib/cena-zgodovina'

const lib = readFileSync(resolve(__dirname, '../cena-dobavitelji-pdf.ts'), 'utf8')
const bratLib = readFileSync(resolve(__dirname, '../cena-dobavitelji.ts'), 'utf8')
const komponenta = readFileSync(resolve(__dirname, '../../components/roksal/cena-dobavitelji-panel.tsx'), 'utf8')

/** Deterministični testni vhod (ISTI kot r328-cena-dobavitelji.test.ts). */
const VHODI: CenaZgodovinaVnos[] = [
  {
    inventoryId: 'inv-1',
    artikel: 'Alu profil 40×40',
    supplierId: 'sup-a',
    dobavitelj: 'AluTrg d.o.o.',
    cena: 12.5,
    veljavnostOd: '2026-09-01T08:00:00.000Z',
    veljavnostDo: null,
    opomba: 'nov seznam',
  },
  {
    inventoryId: 'inv-1',
    artikel: 'Alu profil 40×40',
    supplierId: 'sup-a',
    dobavitelj: 'AluTrg d.o.o.',
    cena: 10,
    veljavnostOd: '2026-06-01T08:00:00.000Z',
    veljavnostDo: '2026-09-01T08:00:00.000Z',
    opomba: null,
  },
  {
    inventoryId: 'inv-2',
    artikel: 'Steklo 8 mm',
    supplierId: 'sup-b',
    dobavitelj: 'StekloServis',
    cena: 45.2,
    veljavnostOd: '2026-08-15T10:30:00.000Z',
    veljavnostDo: null,
    opomba: null,
  },
]

function pregled(vnosi: CenaZgodovinaVnos[] = VHODI) {
  return buildCenaZgodovina(vnosi, 'r329-test')
}

function zgradi(p: ReturnType<typeof pregled>, now?: Date): Buffer {
  const doc =
    now === undefined
      ? buildCenaDobaviteljePdfDoc(p)
      : buildCenaDobaviteljePdfDoc(p, { now } satisfies CenaDobaviteljiPdfOptions)
  return Buffer.from(doc.output('arraybuffer') as ArrayBuffer)
}

describe('r329 primerjava-dobaviteljev PDF izvoz (56. člen — IZVOZI družina)', () => {
  it('oblika: %PDF- magija + vsebina NIČ prazna + filename bratska simetrija (oba brez datuma — primerjava NIMA referenčnega dneva)', () => {
    const bin = zgradi(pregled())
    expect(bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(bin.length).toBeGreaterThan(1000)
    expect(cenaDobaviteljiPdfFilename()).toBe('primerjava-dobaviteljev.pdf')
    expect(cenaDobaviteljiCsvFilename()).toBe('primerjava-dobaviteljev.csv')
  })

  it('DETERMINIZEM: dva builda istega vhoda = bajtno identična; drug now = drugačen (formatni žig); fiksni privzeti žig', () => {
    const p = pregled()
    expect(zgradi(p).equals(zgradi(p))).toBe(true)
    expect(zgradi(p, new Date('2026-06-01T12:00:00.000Z')).equals(zgradi(p))).toBe(false)
    expect(DOBAVITELJI_PDF_ZIG_FIKSNI.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(zgradi(p).equals(zgradi(p, DOBAVITELJI_PDF_ZIG_FIKSNI))).toBe(true)
  })

  it('vsebina WYSIWYG po vhodu: drug pregled (dodatni par / druga smer / druga cena) → RAZLIČEN bajtni odtis (vsebina sledi resnici)', () => {
    const a = zgradi(pregled())
    // dodatni par pri STE istem dobavitelju = druga projekcija (materialov 2, drug razpon)
    const bogatejsi = zgradi(
      pregled([
        ...VHODI,
        {
          inventoryId: 'inv-3',
          artikel: 'Vijak M8',
          supplierId: 'sup-a',
          dobavitelj: 'AluTrg d.o.o.',
          cena: 0.4,
          veljavnostOd: '2026-07-01T08:00:00.000Z',
          veljavnostDo: null,
          opomba: null,
        },
      ]),
    )
    expect(bogatejsi.equals(a)).toBe(false)
    // padajoča smer (cena padla 12.5 → 10) = druga resnica
    expect(zgradi(pregled([{ ...VHODI[0], cena: 9.5 }, VHODI[1], VHODI[2]])).equals(a)).toBe(false)
  })

  it('EN VIR: vhod POSREDOVAN + vse primitivne izpeljave UVOŽENE iz brata + NIČ redefinicij glav/sklepa/vira/validacije', () => {
    expect(lib).toMatch(
      /import \{[^}]*buildCenaDobavitelje[^}]*cenaDobaviteljiSklep[^}]*cenaDobaviteljiVrstice[^}]*CENA_DOBAVITELJI_CSV_GLAVE[^}]*CENA_DOBAVITELJI_VIR_NIZ[^}]*\} from '\.\/cena-dobavitelji'/,
    )
    // NI lastnih definicij (EN VIR ostane v bratu)
    expect(lib).not.toContain('export function cenaDobaviteljiSklep')
    expect(lib).not.toContain('export const CENA_DOBAVITELJI_CSV_GLAVE')
    expect(lib).not.toContain('export function cenaDobaviteljiVrstice')
    expect(lib).not.toContain('export function preveriCenaDobaviteljePregled')
    expect(lib).not.toContain("'narašča'")
    // obrnjena regresija: PDF funkcij NI v bratu (cikel in duplikat tiran —
    // r318 lekcija 1: ena definicija, EN lib)
    expect(bratLib).not.toContain('jspdf')
    expect(bratLib).not.toContain('buildCenaDobaviteljePdfDoc')
    expect(bratLib).not.toContain('cenaDobaviteljiPdfFilename')
    expect(bratLib).not.toContain('generateCenaDobaviteljePdf')
  })

  it('WYSIWYG EN VIR: PDF podatkovne vrstice = cenaDobaviteljiVrstice = ISTA preslikava kot CSV strojne vrstice (bajtno dokazljivo)', () => {
    const projekcija = buildCenaDobavitelje(pregled(), 'test')
    const { csv } = buildCenaDobaviteljeCsv(projekcija, 'test')
    const vrstice = cenaDobaviteljiVrstice(projekcija, 'test')
    // vsaka dobavitelj vrstica citirana = CSV strojna vrstica (ISTI vrstni
    // red; toCsv kanon R136 = podpičje ločilo, brez narekovajev ko jih polja
    // ne potrebujejo — vzorec r326/r328 verbatim vrstic)
    const strojne = vrstice.map((v) => v.join(';'))
    for (const s of strojne) expect(csv).toContain(s)
    // glava EN VIR: ISTI niz kot CSV glava (in tabelska resnica na zaslonu)
    expect(csv).toContain([...CENA_DOBAVITELJI_CSV_GLAVE].join(';'))
    // sklep EN VIR: ISTA preslikava kot CSV meta
    expect(csv).toContain(`Sklep;${cenaDobaviteljiSklep(projekcija)}`)
    // PDF lib source: body = vrstice (ENA preslikava — nič drugega prepravljanja)
    expect(lib).toContain('body: vrstice')
    expect(lib).toContain('head: [[...CENA_DOBAVITELJI_CSV_GLAVE]]')
  })

  it('kje VERBATIM (lift kanon R323): pokvaren pregled odklonjen v OBEH bratih z RAZLIČNIM kje (CSV brani projekcijo ravnino, PDF brani vir ×6 skupin — iskrena družinska resnica)', () => {
    const pokvaren = null as unknown as Parameters<typeof buildCenaDobaviteljePdfDoc>[0]
    expect(() =>
      buildCenaDobaviteljeCsv(pokvaren as unknown as Parameters<typeof buildCenaDobaviteljeCsv>[0], 'KJE-CSV'),
    ).toThrow('pregled mora nositi seznam dobavitelji (KJE-CSV)')
    expect(() => buildCenaDobaviteljePdfDoc(pokvaren)).toThrow(
      'pregled mora biti objekt (buildCenaDobaviteljePdfDoc)',
    )
    expect(() => buildCenaDobaviteljePdfDoc({} as never)).toThrow(
      'pregled mora nositi seznam pari (buildCenaDobaviteljePdfDoc)',
    )
  })

  it('fail-closed: pokvaren now / pokvaren options → TypeError z imenom graditelja (null NE undefined — lekcija R317 4)', () => {
    expect(() => buildCenaDobaviteljePdfDoc(pregled(), { now: 'ne-date' as unknown as Date })).toThrow(
      'buildCenaDobaviteljePdfDoc: pričakovan veljaven now: Date',
    )
    expect(() =>
      buildCenaDobaviteljePdfDoc(pregled(), null as unknown as CenaDobaviteljiPdfOptions),
    ).toThrow('buildCenaDobaviteljePdfDoc: pričakovane opcije (CenaDobaviteljiPdfOptions)')
  })

  it('determinizem v libu: brez volatilnega časa v vsebini + setCreationDate/setFileId + seed nosi celotno projekcijo', () => {
    expect(lib).not.toContain('Izvoženo ob')
    expect(lib).not.toContain('toLocaleDateString')
    expect(lib).toContain('doc.setCreationDate(now)')
    expect(lib).toContain('doc.setFileId(')
    expect(lib).toContain('resnicaSeed(pregled)')
    // soli 0xd5–0xd8 (register: 0xc1–0xc4 R318, 0xc5–0xc8 R320, 0xc9–0xcc R321, 0xcd–0xd0 R324, 0xd1–0xd4 R327)
    expect(lib).toContain('0xd5')
    expect(lib).toContain('0xd8')
    // seed nosi vse števce projekcije (celotna resnica — nič skritega)
    expect(lib).toContain('d.materialov')
    expect(lib).toContain('d.vpisov')
    expect(lib).toContain('d.prvihVpisov')
    expect(lib).toContain('pregled.parov')
  })

  it('panel žičenje: PDF gumb + aria + title + handler + EN pregled TRIje potrošniki + fail-verbose toast ×2', () => {
    expect(komponenta).toContain('aria-label="Izvozi primerjavo dobaviteljev kot PDF"')
    expect(komponenta).toContain('title="Izvozi primerjavo dobaviteljev kot deterministični PDF"')
    expect(komponenta).toContain('onClick={izvoziPdf}')
    expect(komponenta).toContain("from '@/lib/cena-dobavitelji-pdf'")
    expect(komponenta).toContain('generateCenaDobaviteljePdf(pregled)')
    expect(komponenta).toContain('cenaDobaviteljiPdfFilename()')
    // fail-verbose: razlog vidno, ne tiho (kanon r203) — CSV + PDF handlerja
    expect(komponenta.match(/Izvoz ni uspel/g)?.length).toBe(2)
  })

  it('CSV bajtno nespremenjen (arhivska stabilnost R328 — PDF brat NE sme premakniti bajta)', () => {
    const p = pregled()
    const projekcija = buildCenaDobavitelje(p, 'test')
    const { csv, vrstic } = buildCenaDobaviteljeCsv(projekcija, 'test')
    expect(vrstic).toBe(2)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const vrstice = csv.split('\r\n')
    expect(vrstice[0]).toBe('\uFEFF' + [...CENA_DOBAVITELJI_CSV_GLAVE].join(';'))
    expect(vrstice[1]).toBe('AluTrg d.o.o.;1;2;1;0;0;0;12.50;12.50')
    expect(vrstice[2]).toBe('StekloServis;1;1;0;0;0;1;45.20;45.20')
    expect(csv).toContain(`Vir;${CENA_DOBAVITELJI_VIR_NIZ}`)
    // kontrakt Vir niz nespremenjen (družinska resnica)
    expect(CENA_DOBAVITELJI_VIR_NIZ).toBe('PRIMERJAVA_DOBAVITELJEV — isti HEAD = bajtno identičen izvoz')
  })

  it('generateCenaDobaviteljePdf: shrani pod bratskim imenom (primerjava-dobaviteljev.pdf) — pokvaren vhod odklonjen PREJ', () => {
    expect(() => generateCenaDobaviteljePdf(null as never)).toThrow(
      'pregled mora biti objekt (buildCenaDobaviteljePdfDoc)',
    )
  })

  it('E2E wire kontrakt: vir niz EN VIR v bratu — PDF lib ga CITUJE (vzorec CENA_ZGO_VIR_NIZ R327)', () => {
    expect(lib).toContain('`Vir: ${CENA_DOBAVITELJI_VIR_NIZ}`')
    expect(bratLib).toContain('export const CENA_DOBAVITELJI_VIR_NIZ')
  })
})
