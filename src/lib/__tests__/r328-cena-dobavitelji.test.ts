// ---------------------------------------------------------------------------
// R328 — 55. člen (issue #1 §5 'supplier comparison'): PRIMERJAVA
// DOBAVITELJEV — deterministična projekcija ISTEGA pregleda zgodovine cen
// (R326) v drugo grupiranje. Dokazni plasti (kanon r302/r318/r320/r321/r324/
// r326/r327): PROJEKCIJA (števci + razpon + sort) + CSV kanon (BOM + podpičje
// + CRLF + meta Sklep/Vir) + DETERMINIZEM bajtno (×2 + permutacija vhoda) +
// fail-closed ×6 VERBATIM + EN VIR žičenje (lib NIČ Prisme/NIČ jsPDF/NIČ FNV,
// panel cituje glave, zgodovina panel montira pod panel) + ARHIVSKA
// stabilnost (zgodovina CSV R326 ostane bajtno nespremenjen — družina se
// ne more divergirati).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildCenaDobavitelje,
  buildCenaDobaviteljeCsv,
  cenaDobaviteljiVrstice,
  cenaDobaviteljiSklep,
  cenaDobaviteljiCsvFilename,
  preveriCenaDobaviteljePregled,
  CENA_DOBAVITELJI_CSV_GLAVE,
  CENA_DOBAVITELJI_VIR_NIZ,
} from '@/lib/cena-dobavitelji'
import {
  buildCenaZgodovina,
  buildCenaZgodovinaCsv,
  type CenaZgodovinaVnos,
} from '@/lib/cena-zgodovina'

const lib = readFileSync(resolve(__dirname, '../cena-dobavitelji.ts'), 'utf8')
const zgodovinaPanel = readFileSync(resolve(__dirname, '../../components/roksal/cena-zgodovina-panel.tsx'), 'utf8')
const dobaviteljiPanel = readFileSync(resolve(__dirname, '../../components/roksal/cena-dobavitelji-panel.tsx'), 'utf8')

/** Deterministični testni vhod (ISTI kot r326/r327-cena testi — ENA resnica). */
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
  return buildCenaZgodovina(vnosi, 'r328-test')
}

describe('r328 PRIMERJAVA DOBAVITELJEV — projekcija (števci + razpon + sort)', () => {
  it('grupira po dobavitelju: števci parov/vpisov iz NJEGOVIH parov', () => {
    const d = buildCenaDobavitelje(pregled(), 'test')
    expect(d.parov).toBe(2)
    expect(d.dobavitelji.length).toBe(2)
    const alu = d.dobavitelji.find((x) => x.supplierId === 'sup-a')
    expect(alu).toMatchObject({
      dobavitelj: 'AluTrg d.o.o.',
      materialov: 1,
      vpisov: 2, // 1 zaprta + 1 odprta
      najnizja: 12.5,
      najvisja: 12.5,
    })
  })

  it('iskren agregat smeri — ŠTEVCI, nič izmišljenega povprečnega trenda', () => {
    const d = buildCenaDobavitelje(pregled(), 'test')
    const alu = d.dobavitelji.find((x) => x.supplierId === 'sup-a')
    const steklo = d.dobavitelji.find((x) => x.supplierId === 'sup-b')
    expect(alu).toMatchObject({ narasca: 1, pada: 0, stabilna: 0, prvihVpisov: 0 })
    expect(steklo).toMatchObject({ narasca: 0, pada: 0, stabilna: 0, prvihVpisov: 1 })
  })

  it('razpon trenutnih cen = min/max (dva materiala istega dobavitelja)', () => {
    const bogatejsi = [
      ...VHODI,
      {
        inventoryId: 'inv-3',
        artikel: 'Vijak M8',
        supplierId: 'sup-a',
        dobavitelj: 'AluTrg d.o.o.',
        cena: 0.3,
        veljavnostOd: '2026-07-01T08:00:00.000Z',
        veljavnostDo: null,
        opomba: null,
      } as CenaZgodovinaVnos,
    ]
    const d = buildCenaDobavitelje(buildCenaZgodovina(bogatejsi, 'test'), 'test')
    const alu = d.dobavitelji.find((x) => x.supplierId === 'sup-a')
    expect(alu).toMatchObject({ materialov: 2, vpisov: 3, najnizja: 0.3, najvisja: 12.5 })
  })

  it('razvrščanje po dobavitelj nazivu (UTF-16 kodne enote, brez locale)', () => {
    const d = buildCenaDobavitelje(pregled(), 'test')
    expect(d.dobavitelji.map((x) => x.dobavitelj)).toEqual(['AluTrg d.o.o.', 'StekloServis'])
  })

  it('tie-break po supplierId (isti naziv — deterministični vrstni red)', () => {
    const bliznjici: CenaZgodovinaVnos[] = [
      { ...VHODI[2], supplierId: 'sup-z' },
      { ...VHODI[0], supplierId: 'sup-b', dobavitelj: 'StekloServis' },
      { ...VHODI[1], supplierId: 'sup-b', dobavitelj: 'StekloServis' },
    ]
    const d = buildCenaDobavitelje(buildCenaZgodovina(bliznjici, 'test'), 'test')
    expect(d.dobavitelji.map((x) => x.supplierId)).toEqual(['sup-b', 'sup-z'])
  })

  it('kontrolna vsota parov brani sama (vsota materialov == pregled.pari.length)', () => {
    // projekcija je čista — kontrolna vsota je notranja trditev; ta test
    // dokumentira kontrakt (kršitev = fail-closed throw v libu)
    const d = buildCenaDobavitelje(pregled(), 'test')
    const vsota = d.dobavitelji.reduce((v, x) => v + x.materialov, 0)
    expect(vsota).toBe(d.parov)
  })

  it('iskrena ničelna veja: prazen pregled = prazen seznam dobaviteljev', () => {
    const d = buildCenaDobavitelje(buildCenaZgodovina([], 'test'), 'test')
    expect(d.dobavitelji).toEqual([])
    expect(d.parov).toBe(0)
    expect(cenaDobaviteljiSklep(d)).toBe('0 dobaviteljev, 0 parov material × dobavitelj')
  })
})

describe('r328 PRIMERJAVA DOBAVITELJEV — CSV kanon (BOM + podpičje + CRLF + meta)', () => {
  const ZNANI_CSV =
    '\uFEFFDobavitelj;Materialov;Cenovnih vpisov;Narašča;Pada;Stabilna;Prvi vpis;Najnižja trenutna cena EUR;Najvišja trenutna cena EUR\r\n' +
    'AluTrg d.o.o.;1;2;1;0;0;0;12.50;12.50\r\n' +
    'StekloServis;1;1;0;0;0;1;45.20;45.20\r\n' +
    '\r\n' +
    'Sklep;2 dobaviteljev, 2 parov material × dobavitelj, 1 narašča, 1 prvi vpis\r\n' +
    'Vir;PRIMERJAVA_DOBAVITELJEV — isti HEAD = bajtno identičen izvoz\r\n'

  it('bajtno točen znani CSV (deterministična arhivska oblika od rojstva)', () => {
    const { csv, vrstic } = buildCenaDobaviteljeCsv(buildCenaDobavitelje(pregled(), 'test'), 'test')
    expect(csv).toBe(ZNANI_CSV)
    expect(vrstic).toBe(2)
  })

  it('glave CITUJE konstanto (EN VIR — nič podvojenih glav)', () => {
    expect(CENA_DOBAVITELJI_CSV_GLAVE).toEqual([
      'Dobavitelj',
      'Materialov',
      'Cenovnih vpisov',
      'Narašča',
      'Pada',
      'Stabilna',
      'Prvi vpis',
      'Najnižja trenutna cena EUR',
      'Najvišja trenutna cena EUR',
    ])
  })

  it('podatkovne vrstice = cenaDobaviteljiVrstice (EN VIR — nič druge preslikave)', () => {
    const d = buildCenaDobavitelje(pregled(), 'test')
    const vrstice = cenaDobaviteljiVrstice(d, 'test')
    const { csv } = buildCenaDobaviteljeCsv(d, 'test')
    for (const vrstica of vrstice) {
      expect(csv).toContain(vrstica.join(';') + '\r\n')
    }
  })

  it('meta: prazna ločilna + Sklep (EN VIR) + Vir (CENA_DOBAVITELJI_VIR_NIZ)', () => {
    const { csv } = buildCenaDobaviteljeCsv(buildCenaDobavitelje(pregled(), 'test'), 'test')
    expect(csv).toContain('\r\n\r\nSklep;' + cenaDobaviteljiSklep(buildCenaDobavitelje(pregled(), 'test')))
    expect(csv).toContain('Vir;' + CENA_DOBAVITELJI_VIR_NIZ)
  })

  it('filename brez datuma — primerjava NIMA referenčnega dneva', () => {
    expect(cenaDobaviteljiCsvFilename()).toBe('primerjava-dobaviteljev.csv')
  })
})

describe('r328 PRIMERJAVA DOBAVITELJEV — DETERMINIZEM bajtno', () => {
  it('isti pregled = bajtno identičen CSV (dva klica)', () => {
    const a = buildCenaDobaviteljeCsv(buildCenaDobavitelje(pregled(), 'test'), 'test')
    const b = buildCenaDobaviteljeCsv(buildCenaDobavitelje(pregled(), 'test'), 'test')
    expect(a.csv).toBe(b.csv)
  })

  it('permutacija vrstnega reda vhodnih vrstic = ISTI CSV (razvrščanje kanonizira)', () => {
    const obrnjeno = [...VHODI].reverse()
    const a = buildCenaDobaviteljeCsv(buildCenaDobavitelje(buildCenaZgodovina(VHODI, 'test'), 'test'), 'test')
    const b = buildCenaDobaviteljeCsv(buildCenaDobavitelje(buildCenaZgodovina(obrnjeno, 'test'), 'test'), 'test')
    expect(b.csv).toBe(a.csv)
  })
})

describe('r328 PRIMERJAVA DOBAVITELJEV — fail-closed ×6 (sporočila VERBATIM z kje)', () => {
  const KJE = 'r328-test-graditelj'

  it('ne-objekt pregled → fail-closed', () => {
    expect(() => preveriCenaDobaviteljePregled(null, KJE)).toThrow(
      `CenaDobavitelji: pregled mora biti objekt (${KJE}).`,
    )
    expect(() => preveriCenaDobaviteljePregled([1, 2], KJE)).toThrow(
      `CenaDobavitelji: pregled mora biti objekt (${KJE}).`,
    )
  })

  it('pregled brez pari / pari ne seznam → fail-closed', () => {
    expect(() => preveriCenaDobaviteljePregled({}, KJE)).toThrow(
      `CenaDobavitelji: pregled mora nositi seznam pari (${KJE}).`,
    )
    expect(() => preveriCenaDobaviteljePregled({ pari: 'ne' }, KJE)).toThrow(
      `CenaDobavitelji: pregled mora nositi seznam pari (${KJE}).`,
    )
  })

  it('par ni objekt → fail-closed', () => {
    expect(() => preveriCenaDobaviteljePregled({ pari: [42] }, KJE)).toThrow(
      `CenaDobavitelji: par ni objekt (${KJE}).`,
    )
  })

  it('prazni supplierId/dobavitelj → fail-closed', () => {
    const par = { ...pregled().pari[0] }
    expect(() =>
      preveriCenaDobaviteljePregled({ pari: [{ ...par, supplierId: '' }] }, KJE),
    ).toThrow(`CenaDobavitelji: polje supplierId mora biti neprazen niz (${KJE}).`)
    expect(() =>
      preveriCenaDobaviteljePregled({ pari: [{ ...par, dobavitelj: '' }] }, KJE),
    ).toThrow(`CenaDobavitelji: polje dobavitelj mora biti neprazen niz (${KJE}).`)
  })

  it('ne-finitna ali negativna trenutna cena → fail-closed (R136 §18 pogodba v libu)', () => {
    const par = pregled().pari[0]
    const klon = (cena: unknown) =>
      preveriCenaDobaviteljePregled(
        { pari: [{ ...par, trenutna: { ...par.trenutna, cena } }] },
        KJE,
      )
    expect(() => klon(Number.NaN)).toThrow(
      `CenaDobavitelji: trenutna cena mora biti končno neznegativno število (${KJE}).`,
    )
    expect(() => klon(-1)).toThrow(
      `CenaDobavitelji: trenutna cena mora biti končno neznegativno število (${KJE}).`,
    )
    expect(() =>
      preveriCenaDobaviteljePregled({ pari: [{ ...par, trenutna: null }] }, KJE),
    ).toThrow(`CenaDobavitelji: par mora nositi trenutno ceno (${KJE}).`)
  })

  it('neznana smer → fail-closed (trojica kanona — nič tretjih smeri)', () => {
    const par = pregled().pari[0]
    expect(() =>
      preveriCenaDobaviteljePregled({ pari: [{ ...par, smer: 'upada' }] }, KJE),
    ).toThrow(`CenaDobavitelji: smer mora biti nič ali znana trojica (${KJE}).`)
    // nič = iskren prvi vpis — dovoljen
    expect(() =>
      preveriCenaDobaviteljePregled({ pari: [{ ...par, smer: null }] }, KJE),
    ).not.toThrow()
  })

  it('zaprtih neznegativno celo število → fail-closed', () => {
    const par = pregled().pari[0]
    expect(() =>
      preveriCenaDobaviteljePregled({ pari: [{ ...par, zaprtih: -1 }] }, KJE),
    ).toThrow(`CenaDobavitelji: zaprtih mora biti neznegativno celo število (${KJE}).`)
  })
})

describe('r328 PRIMERJAVA DOBAVITELJEV — EN VIR žičenje + arhivska stabilnost', () => {
  it('lib NE uvaža Prisme, NE nosi jsPDF teže, NE drži FNV semena', () => {
    expect(lib).not.toMatch(/from ['"]@\/lib\/db['"]/)
    expect(lib).not.toContain('jsPDF')
    expect(lib).not.toContain('FNV')
    // tipi prihajajo type-only (nič runtime cikla, nič podvojenih pravil)
    expect(lib).toContain("import type { CenaZgodovinaPregled } from '@/lib/cena-zgodovina'")
  })

  it('pod panel dobaviteljev je montiran iz zgodovine panela (EN VIR — isti pregled, nič drugega fetcha)', () => {
    expect(zgodovinaPanel).toContain("import { CenaDobaviteljiPanel } from '@/components/roksal/cena-dobavitelji-panel'")
    expect(zgodovinaPanel).toContain('<CenaDobaviteljiPanel pregled={pregled} />')
    // nič drugega fetcha: dobavitelji panel NE fetcha (nič own useEffect za podatke)
    expect(dobaviteljiPanel).not.toContain('useEffect')
    expect(dobaviteljiPanel).not.toContain("fetch(")
  })

  it('dobavitelji panel cituje glave konstanto (nič podvojenih glav na zaslonu)', () => {
    expect(dobaviteljiPanel).toContain('CENA_DOBAVITELJI_CSV_GLAVE.map')
    // sklep na zaslonu = EN VIR iz liba (nič prepisovanja)
    expect(dobaviteljiPanel).toContain('cenaDobaviteljiSklep(prikaz)')
  })

  it('testid + aria novih površin (a11y izvozne družine R291/R293)', () => {
    expect(dobaviteljiPanel).toContain('data-testid="cena-dobavitelji-dokaz"')
    expect(dobaviteljiPanel).toContain('aria-label="Primerjava dobaviteljev"')
    expect(dobaviteljiPanel).toContain('aria-label="Izvozi primerjavo dobaviteljev kot CSV"')
  })

  it('ARHIVSKA stabilnost: zgodovina CSV R326 ostane bajtno nespremenjen (družina se ne more divergirati)', () => {
    const ZNANI_CSV_R326 =
      '\uFEFFArtikel;Dobavitelj;Prejšnja cena EUR;Trenutna cena EUR;Sprememba EUR;Sprememba %;Smer;Zgodovinskih cen\r\n' +
      'Alu profil 40×40;AluTrg d.o.o.;10.00;12.50;2.50;25.00;narašča;1\r\n' +
      'Steklo 8 mm;StekloServis;;45.20;;;prvi vpis;0\r\n' +
      '\r\n' +
      'Sklep;2 parov material × dobavitelj, 3 cenovnih vrstic, 1 narašča, 1 prvi vpis\r\n' +
      'Vir;ZGODOVINA_CEN — isti HEAD = bajtno identičen izvoz\r\n'
    const { csv } = buildCenaZgodovinaCsv(pregled(), 'test')
    expect(csv).toBe(ZNANI_CSV_R326)
  })

  it('izvozna callback fail-verbose: projekcija + CSV skupaj v try, toast destructive v catch', () => {
    expect(dobaviteljiPanel).toContain("title: 'Izvoz ni uspel'")
    expect(dobaviteljiPanel).toContain("variant: 'destructive'")
    expect(dobaviteljiPanel).toContain("buildCenaDobavitelje(pregled, 'CenaDobaviteljiPanel.izvoziCsv')")
  })
})
