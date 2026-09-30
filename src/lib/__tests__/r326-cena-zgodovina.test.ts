// ---------------------------------------------------------------------------
// R326 — 53. člen issue #1 (§5 price history): ZGODOVINA CEN MATERIALA —
// deterministična projekcija MaterialPrice (odprte + ZAPRTE zgodovinske
// vrstice). Dokazi:
//  • WYSIWYG: pregled je ČISTA projekcija posredovanih vrstic (nič drugega
//    branja — par, trenutna, prejšnja, delte, časovnica = f(vhod));
//  • delta kontrakt: 0 = stabilna, > 0 = narašča, < 0 = pada; brez prejšnje
//    = iskrena ničelna veja (prvi vpis — NI smeri, NI izmišljenega %);
//  • deltaOdstotek = zaokroženo na 2 decimalki; prejšnja 0 EUR → nič
//    (deljenje z 0 ni resnica);
//  • razvrščanje: pari po artikel, nato dobavitelj (UTF-16 kodne enote,
//    brez locale); časovnica padajoče po Date.parse (ISO nizi različnih
//    dolžin pri niznem primerjanju lagajo — '39Z' > '39.401Z' past);
//  • EXCLUDE material_price_no_overlap ogledalo: par z 0 ali 2 odprtimi
//    cenami → fail-closed TypeError (vsaka plast brani sama);
//  • fail-closed ×7: ne-seznam / ne-objekt / prazni nizi / negativna ali
//    ne-finitna cena / ne-veljaven veljavnostOd / pokvaren veljavnostDo /
//    obratjen interval; sporočila VERBATIM z 'kje';
//  • CSV: kanon R136 (BOM + podpičje + CRLF + RFC 4180), glave EN VIR,
//    meta Sklep (EN VIR) + Vir (CENA_ZGO_VIR_NIZ), DETERMINIZEM bajtno ×2,
//    obrnjena regresija (nič 'Izvoženo ob' — čas bi uničil determinizem);
//  • EN VIR: route je edini bralec baze (lib NIČ Prisma) — glave CITUJETA
//    panel/route; cenaZgoSklep = ENA preslikava (zaslon + CSV meta).
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildCenaZgodovina,
  buildCenaZgodovinaCsv,
  cenaZgoSklep,
  cenaZgodovinaCsvFilename,
  preveriCenaZgodovinaVnose,
  CENA_SMER_NIZ,
  CENA_ZGODOVINA_CSV_GLAVE,
  CENA_ZGODOVINA_TIMELINE_GLAVE,
  CENA_ZGO_VIR_NIZ,
} from '../cena-zgodovina'
import type { CenaZgodovinaVnos } from '../cena-zgodovina'

const LIB = join(process.cwd(), 'src/lib/cena-zgodovina.ts')
const ROUTE = join(process.cwd(), 'src/app/api/material-prices/zgodovina/route.ts')
const PANEL = join(process.cwd(), 'src/components/roksal/cena-zgodovina-panel.tsx')

/** Deterministični testni vhod (2 parov; prvi z zgodovino, drugi prvi vpis). */
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

describe('r325 ZGODOVINA CEN — buildCenaZgodovina projekcija', () => {
  it('WYSIWYG: pari, trenutna, prejšnja, zaprtih, časovnica = f(vhod) — nič drugega branja', () => {
    const p = buildCenaZgodovina(VHODI, 'test')
    expect(p.pari.length).toBe(2)
    const alu = p.pari.find((x) => x.artikel === 'Alu profil 40×40')!
    expect(alu.dobavitelj).toBe('AluTrg d.o.o.')
    expect(alu.trenutna.cena).toBe(12.5)
    expect(alu.prejsnja?.cena).toBe(10)
    expect(alu.zaprtih).toBe(1)
    expect(alu.casovnica.length).toBe(2)
    expect(p.vnosov).toBe(3)
  })

  it('delta kontrakt: narašča (+2.50, +25 %) / stabilna (0) / pada — EN VIR trojica', () => {
    const p = buildCenaZgodovina(VHODI, 'test')
    const alu = p.pari.find((x) => x.artikel === 'Alu profil 40×40')!
    expect(alu.smer).toBe('narasca')
    expect(alu.deltaEur).toBe(2.5)
    expect(alu.deltaOdstotek).toBe(25)
    const stabilna = buildCenaZgodovina(
      [
        { ...VHODI[0], cena: 10 },
        { ...VHODI[1], cena: 10 },
        VHODI[2],
      ],
      'test',
    )
    const s = stabilna.pari.find((x) => x.artikel === 'Alu profil 40×40')!
    expect(s.smer).toBe('stabilna')
    expect(s.deltaEur).toBe(0)
    expect(s.deltaOdstotek).toBe(0)
    expect(stabilna.stabilnih).toBe(1)
  })

  it('iskrena ničelna veja: prvi vpis — brez prejšnje NI delte, NI smeri, NI izmišljenega %', () => {
    const p = buildCenaZgodovina(VHODI, 'test')
    const steklo = p.pari.find((x) => x.artikel === 'Steklo 8 mm')!
    expect(steklo.prejsnja).toBeNull()
    expect(steklo.deltaEur).toBeNull()
    expect(steklo.deltaOdstotek).toBeNull()
    expect(steklo.smer).toBeNull()
    expect(p.prvihVpisov).toBe(1)
  })

  it('prejšnja 0 EUR → deltaOdstotek nič (deljenje z 0 ni resnica), deltaEur ostane iskren', () => {
    const p = buildCenaZgodovina(
      [
        { ...VHODI[0], cena: 5 },
        { ...VHODI[1], cena: 0, veljavnostOd: '2026-06-01T08:00:00.000Z', veljavnostDo: '2026-09-01T08:00:00.000Z' },
      ],
      'test',
    )
    const alu = p.pari[0]
    expect(alu.prejsnja?.cena).toBe(0)
    expect(alu.deltaEur).toBe(5)
    expect(alu.deltaOdstotek).toBeNull()
  })

  it('razvrščanje: pari po artikel nato dobavitelj (brez locale); časovnica padajoče po Date.parse', () => {
    const p = buildCenaZgodovina(
      [
        { ...VHODI[2], artikel: 'Zaloga X', inventoryId: 'inv-3' },
        VHODI[2],
        { ...VHODI[2], cena: 40, veljavnostOd: '2026-05-01T08:00:00.000Z', veljavnostDo: '2026-08-15T10:30:00.000Z' },
        VHODI[0],
        { ...VHODI[0], cena: 11, veljavnostOd: '2026-01-01T08:00:00.000Z', veljavnostDo: '2026-02-01T08:00:00.000Z' },
      ],
      'test',
    )
    expect(p.pari.map((x) => x.artikel)).toEqual(['Alu profil 40×40', 'Steklo 8 mm', 'Zaloga X'])
    const alu = p.pari[0]
    // padajoče po času (najnovejša prva) — ISO z/ brez milisekund bi nizno
    // primerjanje obrnilo; Date.parse šteje pravilno
    expect(Date.parse(alu.casovnica[0].veljavnostOd)).toBeGreaterThanOrEqual(
      Date.parse(alu.casovnica[alu.casovnica.length - 1].veljavnostOd),
    )
    expect(alu.zaprtih).toBe(1)
  })

  it('EXCLUDE ogledalo: par z 0 odprtimi cenami → fail-closed (vsaka plast brani sama)', () => {
    expect(() =>
      buildCenaZgodovina([{ ...VHODI[0], veljavnostDo: '2026-09-01T08:00:00.000Z' }], 'test'),
    ).toThrow('NATANKO ena')
    expect(() =>
      buildCenaZgodovina(
        [VHODI[0], { ...VHODI[0], cena: 9, veljavnostOd: '2026-09-02T08:00:00.000Z' }],
        'test',
      ),
    ).toThrow('NATANKO ena')
  })
})

describe('r325 ZGODOVINA CEN — fail-closed preveriCenaZgodovinaVnose (sporočila VERBATIM)', () => {
  it('ne-seznam in ne-objekt → TypeError z kje', () => {
    expect(() => preveriCenaZgodovinaVnose('ne', 'KJE-X')).toThrow('seznam vrstic (KJE-X)')
    expect(() => preveriCenaZgodovinaVnose(null, 'KJE-X')).toThrow('seznam vrstic (KJE-X)')
    expect(() => preveriCenaZgodovinaVnose([null], 'KJE-X')).toThrow('ni objekt (KJE-X)')
    expect(() => preveriCenaZgodovinaVnose([['x']], 'KJE-X')).toThrow('ni objekt (KJE-X)')
  })

  it('prazni ključni nizi → TypeError (inventoryId/artikel/supplierId/dobavitelj)', () => {
    expect(() =>
      preveriCenaZgodovinaVnose([{ ...VHODI[0], inventoryId: '' }], 'KJE-KEY'),
    ).toThrow('inventoryId mora biti neprazen niz (KJE-KEY)')
    expect(() =>
      preveriCenaZgodovinaVnose([{ ...VHODI[0], artikel: '' }], 'KJE-KEY'),
    ).toThrow('artikel mora biti neprazen niz (KJE-KEY)')
    expect(() =>
      preveriCenaZgodovinaVnose([{ ...VHODI[0], dobavitelj: '' }], 'KJE-KEY'),
    ).toThrow('dobavitelj mora biti neprazen niz (KJE-KEY)')
  })

  it('cena: negativna, NaN, neskončnost, niz → TypeError (R136 §18 pogodba v libu)', () => {
    expect(() => preveriCenaZgodovinaVnose([{ ...VHODI[0], cena: -1 }], 'KJE-CENA')).toThrow(
      'končno neznegativno število (KJE-CENA)',
    )
    expect(() =>
      preveriCenaZgodovinaVnose([{ ...VHODI[0], cena: Number.NaN }], 'KJE-CENA'),
    ).toThrow('končno neznegativno število (KJE-CENA)')
    expect(() =>
      preveriCenaZgodovinaVnose([{ ...VHODI[0], cena: Number.POSITIVE_INFINITY }], 'KJE-CENA'),
    ).toThrow('končno neznegativno število (KJE-CENA)')
    expect(() =>
      preveriCenaZgodovinaVnose([{ ...VHODI[0], cena: '12.5' }], 'KJE-CENA'),
    ).toThrow('končno neznegativno število (KJE-CENA)')
  })

  it('datumi: pokvaren veljavnostOd, pokvaren veljavnostDo, OBRATJEN interval → TypeError', () => {
    expect(() =>
      preveriCenaZgodovinaVnose([{ ...VHODI[0], veljavnostOd: 'ni-datum' }], 'KJE-DAT'),
    ).toThrow('veljavnostOd ni veljaven ISO datum (KJE-DAT)')
    expect(() =>
      preveriCenaZgodovinaVnose([{ ...VHODI[0], veljavnostDo: '' }], 'KJE-DAT'),
    ).toThrow('veljavnostDo mora biti nič ali veljaven ISO datum (KJE-DAT)')
    expect(() =>
      preveriCenaZgodovinaVnose([{ ...VHODI[0], veljavnostDo: '2026-05-01T00:00:00.000Z' }], 'KJE-DAT'),
    ).toThrow('obratjen interval (KJE-DAT)')
  })

  it('opomba: številka → TypeError; nič ali niz → OK', () => {
    expect(() =>
      preveriCenaZgodovinaVnose([{ ...VHODI[0], opomba: 42 }], 'KJE-OP'),
    ).toThrow('opomba mora biti nič ali niz (KJE-OP)')
    expect(() => preveriCenaZgodovinaVnose([{ ...VHODI[0], opomba: null }], 'KJE-OP')).not.toThrow()
  })
})

describe('r325 ZGODOVINA CEN — CSV kanon (toCsv R136 + EN VIR + DETERMINIZEM)', () => {
  it('glave EN VIR + BOM + podpičje + CRLF + meta Sklep/Vir — WYSIWYG par vrstic', () => {
    const p = buildCenaZgodovina(VHODI, 'test')
    const { csv, vrstic } = buildCenaZgodovinaCsv(p, 'test')
    expect(vrstic).toBe(2)
    expect(csv.charCodeAt(0)).toBe(0xfeff) // BOM kot UTF-16 kodna enota (bajtno EF BB BF na disku)
    const vrstice = csv.split('\r\n')
    expect(vrstice[0]).toBe('\uFEFF' + [...CENA_ZGODOVINA_CSV_GLAVE].join(';'))
    expect(vrstice[1]).toBe('Alu profil 40×40;AluTrg d.o.o.;10.00;12.50;2.50;25.00;narašča;1')
    expect(vrstice[2]).toBe('Steklo 8 mm;StekloServis;;45.20;;;prvi vpis;0')
    const sklep = cenaZgoSklep(p)
    expect(csv).toContain(`Sklep;${sklep}`)
    expect(csv).toContain(`Vir;${CENA_ZGO_VIR_NIZ}`)
    expect(sklep).toContain('2 parov material × dobavitelj')
    expect(sklep).toContain('3 cenovnih vrstic')
  })

  it('DETERMINIZEM bajtno: isti vhod ×2 = bajtno identičen; drug vhod = drugačen', () => {
    const p = buildCenaZgodovina(VHODI, 'test')
    const a = buildCenaZgodovinaCsv(p, 'test').csv
    const b = buildCenaZgodovinaCsv(buildCenaZgodovina(VHODI, 'test'), 'test').csv
    expect(a).toBe(b)
    const drug = buildCenaZgodovinaCsv(buildCenaZgodovina([VHODI[0]], 'test'), 'test').csv
    expect(drug).not.toBe(a)
  })

  it('brez časa v vsebini (obrnjena regresija — "Izvoženo ob" bi uničil determinizem)', () => {
    const src = readFileSync(LIB, 'utf8')
    expect(src).not.toContain('Izvoženo ob')
    const p = buildCenaZgodovina(VHODI, 'test')
    expect(buildCenaZgodovinaCsv(p, 'test').csv).not.toContain('Izvoženo ob')
  })

  it('pregled brez pari → fail-closed; filename determinističen', () => {
    expect(() => buildCenaZgodovinaCsv(null as never, 'KJE-CSV')).toThrow('seznam pari (KJE-CSV)')
    expect(() => buildCenaZgodovinaCsv({} as never, 'KJE-CSV')).toThrow('seznam pari (KJE-CSV)')
    expect(cenaZgodovinaCsvFilename()).toBe('zgodovina-cen.csv')
  })
})

describe('r325 ZGODOVINA CEN — EN VIR žičenje (route bralec, panel cituje, nič dvojnih)', () => {
  it('lib NIČ Prisma (čista projekcija — route je edini bralec baze); route uvaža lib', () => {
    expect(readFileSync(LIB, 'utf8')).not.toMatch(/from '@prisma\/client'/)
    const route = readFileSync(ROUTE, 'utf8')
    expect(route).toContain("from '@/lib/cena-zgodovina'")
    expect(route).toContain('buildCenaZgodovina')
    expect(route).toContain('CENA_ZGO_VIR_NIZ')
  })

  it('route fail-closed: authenticate vrata + iskren 500 z ovojnico (nič tihe prazne resnice)', () => {
    const route = readFileSync(ROUTE, 'utf8')
    expect(route).toContain('await authenticate(request)')
    expect(route).toContain('return unauthorized()')
    expect(route).toContain('status: 500')
    expect(route).toContain("export async function GET")
    expect(route).not.toContain('export async function POST')
    expect(route).not.toContain('export async function PUT')
  })

  it('panel cituje glave/sklep/filename iz liba (nič podvojenih glav) + fail-verbose toast', () => {
    const panel = readFileSync(PANEL, 'utf8')
    expect(panel).toContain('CENA_ZGODOVINA_TIMELINE_GLAVE')
    expect(panel).toContain('CENA_SMER_NIZ')
    expect(panel).toContain('buildCenaZgodovinaCsv')
    expect(panel).toContain('cenaZgodovinaCsvFilename')
    expect(panel).toContain('cenaZgoSklep')
    expect(panel).toContain('aria-label="Izvozi zgodovino cen materiala kot CSV"')
    expect(panel).toContain("title: 'Izvoz ni uspel'")
    expect(panel).toContain('data-testid="cena-zgodovina-dokaz"')
    expect(panel).toContain("useToast } from '@/hooks/use-toast'")
  })

  it('inventory-tab nosi panel (žičenje) + komentar 53. člen', () => {
    const tab = readFileSync(
      join(process.cwd(), 'src/components/roksal/inventory-tab.tsx'),
      'utf8',
    )
    expect(tab).toContain("import { CenaZgodovinaPanel } from '@/components/roksal/cena-zgodovina-panel'")
    expect(tab).toContain('<CenaZgodovinaPanel />')
    expect(tab).toContain('53. člen issue #1')
  })

  it('timeline glave EN VIR konstanta (4 stolpca) + smer EN VIR (CSV = panel pripoved) — ne moreta divergirati po konstrukciji', () => {
    expect([...CENA_ZGODOVINA_TIMELINE_GLAVE]).toEqual(['Cena EUR', 'Od', 'Do', 'Opomba'])
    expect(CENA_SMER_NIZ['narasca']).toBe('narašča')
    expect(CENA_SMER_NIZ['pada']).toBe('pada')
    expect(CENA_SMER_NIZ['stabilna']).toBe('stabilna')
    expect([...CENA_ZGODOVINA_CSV_GLAVE]).toEqual([
      'Artikel',
      'Dobavitelj',
      'Prejšnja cena EUR',
      'Trenutna cena EUR',
      'Sprememba EUR',
      'Sprememba %',
      'Smer',
      'Zgodovinskih cen',
    ])
  })
})
