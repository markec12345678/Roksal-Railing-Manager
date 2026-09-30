// ---------------------------------------------------------------------------
// R327 — 54. člen (issue #1 IZVOZI družina): izvoz ZGODOVINE CEN MATERIALA
// kot DETERMINISTIČNI PDF. PDF brat CSV-ju R326 (vzorec R318/R320/R321/R324:
// LOČEN lib): vhod = POSREDOVANA resnica (EN VIR z CSV bratom — panel EN
// pregled, DVA potrošnika), podatkovne vrstice = cenaParVrstice (UVOŽENE —
// ISTA preslikava kot CSV strojne vrstice), glave + smer + sklep + VIR_NIZ =
// UVOŽENI iz brata (NIČ podvojenih pravil — vzorec vodja-dnevni-pdf R324);
// CENA_ZGO_VIR_NIZ = družinski kontrakt (CSV arhivska oblika ostaja BAJTNO
// nespremenjena). Determinizem kanon 46.–53. člen: vsebina brez časa
// (zgodovina cen NIMA referenčnega dneva — filename brez datuma), fiksni
// formatni žig CENA_PDF_ZIG_FIKSNI, FNV fileId soli 0xd1–0xd4 → isti HEAD +
// isti vhod = bajtno identičen PDF. Dokazni plasti (r302/r318/r320/r321/r324
// kanon): BAJTNI dokazi (magija + determinizem + razlike po vhodu) +
// SOURCE-level EN VIR pini (uvozi, NIČ redefinicij) + CSV bajtna stabilnost
// (arhivska resnica — refactor cenaParVrstice NE sme premakniti bajta).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildCenaZgodovinaPdfDoc,
  generateCenaZgodovinaPdf,
  cenaZgodovinaPdfFilename,
  CENA_PDF_ZIG_FIKSNI,
  type CenaZgodovinaPdfOptions,
} from '@/lib/cena-zgodovina-pdf'
import {
  buildCenaZgodovina,
  buildCenaZgodovinaCsv,
  cenaParVrstice,
  cenaZgoSklep,
  cenaZgodovinaCsvFilename,
  preveriCenaZgodovinaVnose,
  CENA_SMER_NIZ,
  CENA_ZGODOVINA_CSV_GLAVE,
  CENA_ZGODOVINA_TIMELINE_GLAVE,
  CENA_ZGO_VIR_NIZ,
  type CenaZgodovinaVnos,
} from '@/lib/cena-zgodovina'

const lib = readFileSync(resolve(__dirname, '../cena-zgodovina-pdf.ts'), 'utf8')
const bratLib = readFileSync(resolve(__dirname, '../cena-zgodovina.ts'), 'utf8')
const komponenta = readFileSync(resolve(__dirname, '../../components/roksal/cena-zgodovina-panel.tsx'), 'utf8')

/** Deterministični testni vhod (ISTI kot r326-cena-zgodovina.test.ts). */
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
  return buildCenaZgodovina(vnosi, 'r327-test')
}

function zgradi(p: ReturnType<typeof pregled>, now?: Date): Buffer {
  const doc =
    now === undefined
      ? buildCenaZgodovinaPdfDoc(p)
      : buildCenaZgodovinaPdfDoc(p, { now } satisfies CenaZgodovinaPdfOptions)
  return Buffer.from(doc.output('arraybuffer') as ArrayBuffer)
}

describe('r327 cena-zgodovina PDF izvoz (54. člen — IZVOZI družina)', () => {
  it('oblika: %PDF- magija + vsebina NIČ prazna + filename bratska simetrija (obe brez datuma — zgodovina NIMA referenčnega dneva)', () => {
    const bin = zgradi(pregled())
    expect(bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(bin.length).toBeGreaterThan(1000)
    expect(cenaZgodovinaPdfFilename()).toBe('zgodovina-cen.pdf')
    expect(cenaZgodovinaCsvFilename()).toBe('zgodovina-cen.csv')
  })

  it('DETERMINIZEM: dva builda istega vhoda = bajtno identična; drug now = drugačen (formatni žig); fiksni privzeti žig', () => {
    const p = pregled()
    expect(zgradi(p).equals(zgradi(p))).toBe(true)
    expect(zgradi(p, new Date('2026-06-01T12:00:00.000Z')).equals(zgradi(p))).toBe(false)
    expect(CENA_PDF_ZIG_FIKSNI.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(zgradi(p).equals(zgradi(p, CENA_PDF_ZIG_FIKSNI))).toBe(true)
  })

  it('vsebina WYSIWYG po vhodu: drug pregled (dodatna zaprta cena / druga smer) → RAZLIČEN bajtni odtis (vsebina sledi resnici)', () => {
    const a = zgradi(pregled())
    // dodaten zaprt vpis = druga časovnica = druga resnica
    const bogatejsi = zgradi(
      pregled([
        ...VHODI,
        {
          inventoryId: 'inv-2',
          artikel: 'Steklo 8 mm',
          supplierId: 'sup-b',
          dobavitelj: 'StekloServis',
          cena: 44,
          veljavnostOd: '2026-05-01T10:30:00.000Z',
          veljavnostDo: '2026-08-15T10:30:00.000Z',
          opomba: null,
        },
      ]),
    )
    expect(bogatejsi.equals(a)).toBe(false)
    // padajoča smer (cena padla 12.5 → 10) = druga resnica
    expect(zgradi(pregled([{ ...VHODI[0], cena: 9.5 }, VHODI[1], VHODI[2]])).equals(a)).toBe(false)
  })

  it('EN VIR: vhod POSREDOVAN + vse primitivne izpeljave UVOŽENE iz brata + NIČ redefinicij glav/smeri/sklepa/vira', () => {
    expect(lib).toMatch(
      /import \{[^}]*cenaParVrstice[^}]*cenaZgoSklep[^}]*CENA_SMER_NIZ[^}]*CENA_ZGODOVINA_CSV_GLAVE[^}]*CENA_ZGODOVINA_TIMELINE_GLAVE[^}]*CENA_ZGO_VIR_NIZ[^}]*\} from '\.\/cena-zgodovina'/,
    )
    // NI lastnih definicij (EN VIR ostane v bratu)
    expect(lib).not.toContain('export function cenaZgoSklep')
    expect(lib).not.toContain('export const CENA_SMER_NIZ')
    expect(lib).not.toContain("export const CENA_ZGODOVINA_CSV_GLAVE")
    expect(lib).not.toContain('export function cenaParVrstice')
    expect(lib).not.toContain("'narašča'")
    expect(lib).not.toContain("'prvi vpis'")
    // obrnjena regresija: PDF funkcij NI v bratu (cikel in duplikat tiran —
    // r318 lekcija 1: ena definicija, EN lib)
    expect(bratLib).not.toContain('jspdf')
    expect(bratLib).not.toContain('buildCenaZgodovinaPdfDoc')
    expect(bratLib).not.toContain('cenaZgodovinaPdfFilename')
    expect(bratLib).not.toContain('generateCenaZgodovinaPdf')
  })

  it('WYSIWYG EN VIR: PDF podatkovne vrstice = cenaParVrstice = ISTA preslikava kot CSV strojne vrstice (bajtno dokazljivo)', () => {
    const p = pregled()
    const { csv } = buildCenaZgodovinaCsv(p, 'test')
    const vrstice = cenaParVrstice(p, 'test')
    // vsaka par vrstica citirana = CSV strojna vrstica (ISTI vrstni red;
    // toCsv kanon R136 = podpičje ločilo, brez narekovajev ko jih polja ne
    // potrebujejo — vzorec r326 verbatim vrstic)
    const strojne = vrstice.map((v) => v.join(';'))
    for (const s of strojne) expect(csv).toContain(s)
    // glavi EN VIR: ISTI nizi kot CSV glava (in časovna tabela na zaslonu)
    expect(csv).toContain([...CENA_ZGODOVINA_CSV_GLAVE].join(';'))
    expect([...CENA_ZGODOVINA_TIMELINE_GLAVE]).toEqual(['Cena EUR', 'Od', 'Do', 'Opomba'])
    // smer EN VIR: besedilo pride iz CENA_SMER_NIZ (ista celica kot CSV,
    // podpična ovojnica — vzorec r326 verbatim vrstic)
    expect(csv).toContain(';' + CENA_SMER_NIZ.narasca + ';')
    // sklep EN VIR: ISTA preslikava kot CSV meta
    expect(csv).toContain(`Sklep;${cenaZgoSklep(p)}`)
  })

  it('kje VERBATIM (lift kanon R323): pokvaren pregled odklonjen na ISTI način v CSV in PDF — RAZLIČEN kje', () => {
    const pokvaren = null as unknown as Parameters<typeof buildCenaZgodovinaPdfDoc>[0]
    expect(() => buildCenaZgodovinaCsv(pokvaren, 'KJE-CSV')).toThrow('pregled mora nositi seznam pari (KJE-CSV)')
    expect(() => buildCenaZgodovinaPdfDoc(pokvaren)).toThrow(
      'pregled mora nositi seznam pari (buildCenaZgodovinaPdfDoc)',
    )
    expect(() => buildCenaZgodovinaPdfDoc({} as never)).toThrow(
      'pregled mora nositi seznam pari (buildCenaZgodovinaPdfDoc)',
    )
  })

  it('fail-closed: pokvaren now / pokvaren options → TypeError z imenom graditelja (null NE undefined — lekcija R317 4)', () => {
    expect(() => buildCenaZgodovinaPdfDoc(pregled(), { now: 'ne-date' as unknown as Date })).toThrow(
      'buildCenaZgodovinaPdfDoc: pričakovan veljaven now: Date',
    )
    expect(() =>
      buildCenaZgodovinaPdfDoc(pregled(), null as unknown as CenaZgodovinaPdfOptions),
    ).toThrow('buildCenaZgodovinaPdfDoc: pričakovane opcije (CenaZgodovinaPdfOptions)')
  })

  it('determinizem v libu: brez volatilnega časa v vsebini + setCreationDate/setFileId + seed nosi celotno resnico', () => {
    expect(lib).not.toContain('Izvoženo ob')
    expect(lib).not.toContain('toLocaleDateString')
    expect(lib).toContain('doc.setCreationDate(now)')
    expect(lib).toContain('doc.setFileId(')
    expect(lib).toContain('resnicaSeed(pregled)')
    // soli 0xd1–0xd4 (register: 0xc1–0xc4 R318, 0xc5–0xc8 R320, 0xc9–0xcc R321, 0xcd–0xd0 R324)
    expect(lib).toContain('0xd1')
    expect(lib).toContain('0xd4')
    // seed nosi vse pare z vsemi časovniškimi vrsticami + vse števce pregleda
    expect(lib).toContain('p.casovnica')
    expect(lib).toContain('pregled.vnosov')
    expect(lib).toContain('pregled.narascajo')
    expect(lib).toContain('pregled.prvihVpisov')
  })

  it('panel žičenje: PDF gumb + aria + title + handler + EN pregled DVA potrošnika + iskrena ničelna veja (OBA gumba skrita) + fail-verbose toast ×2', () => {
    expect(komponenta).toContain('aria-label="Izvozi zgodovino cen materiala kot PDF"')
    expect(komponenta).toContain('title="Izvozi zgodovino cen materiala kot deterministični PDF"')
    expect(komponenta).toContain('onClick={izvoziPdf}')
    expect(komponenta).toContain("from '@/lib/cena-zgodovina-pdf'")
    expect(komponenta).toContain('generateCenaZgodovinaPdf(pregled)')
    expect(komponenta).toContain('cenaZgodovinaPdfFilename()')
    // iskrena ničelna veja: OBA izvozna gumba pod ISTIM pogojem (brez podatkov
    // NI izvoza) — trije potrošniki iste resnice: gumbi-div + sklep + seznam
    expect(komponenta.match(/pregled\.pari\.length > 0 &&/g)?.length).toBe(3)
    // fail-verbose: razlog vidno, ne tiho (kanon r203) — CSV + PDF handlerja
    expect(komponenta.match(/Izvoz ni uspel/g)?.length).toBe(2)
  })

  it('CSV bajtno nespremenjen (arhivska stabilnost R326 — refactor cenaParVrstice NE sme premakniti bajta)', () => {
    const p = pregled()
    const { csv, vrstic } = buildCenaZgodovinaCsv(p, 'test')
    expect(vrstic).toBe(2)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const vrstice = csv.split('\r\n')
    expect(vrstice[0]).toBe('\uFEFF' + [...CENA_ZGODOVINA_CSV_GLAVE].join(';'))
    expect(vrstice[1]).toBe('Alu profil 40×40;AluTrg d.o.o.;10.00;12.50;2.50;25.00;narašča;1')
    expect(vrstice[2]).toBe('Steklo 8 mm;StekloServis;;45.20;;;prvi vpis;0')
    expect(csv).toContain(`Vir;${CENA_ZGO_VIR_NIZ}`)
  })

  it('fail-closed vhodna validacija EN VIR ostane v bratu: preveriCenaZgodovinaVnose javno izvožena (nič podvojenih pravil)', () => {
    expect(() => preveriCenaZgodovinaVnose([null], 'KJE-X')).toThrow('ni objekt (KJE-X)')
    // globlja validacija = ENA v bratu (buildCenaZgodovina); PDF brat jo
    // podeduje prek pregleda — NIČ revalidacije v PDF libu
    expect(lib).not.toContain('preveriCenaZgodovinaVnose')
  })

  it('generateCenaZgodovinaPdf: shrani pod bratskim imenom (zgodovina-cen.pdf) — pokvaren vhod odklonjen PREJ', () => {
    expect(() => generateCenaZgodovinaPdf(null as never)).toThrow(
      'pregled mora nositi seznam pari (buildCenaZgodovinaPdfDoc)',
    )
  })

  it('E2E wire kontrakt: vir niz EN VIR v bratu — PDF lib ga CITUJE (vzorec VODJA_VIR_NIZ R324)', () => {
    expect(CENA_ZGO_VIR_NIZ).toBe('ZGODOVINA_CEN — isti HEAD = bajtno identičen izvoz')
    expect(lib).toContain('`Vir: ${CENA_ZGO_VIR_NIZ}`')
    // bratova definicija je prelomljena čez dve vrstici (kanon R326) —
    // obe polovici sta del EN VIR resnice
    expect(bratLib).toContain('export const CENA_ZGO_VIR_NIZ')
    expect(bratLib).toContain("'ZGODOVINA_CEN — isti HEAD = bajtno identičen izvoz'")
  })
})
