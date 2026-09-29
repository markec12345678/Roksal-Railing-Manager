// ---------------------------------------------------------------------------
// R295 — KOLEDAR PREGLEDOV CSV (25. člen 'izvozi' družine) — CSV brat PDF
// R253. Dokazi:
//  • glava = VERBATIM PDF autoTable head (7 stolpcev);
//  • celice = EN VIR izpeljave iz PDF brata (cenikDatumIso, koledarDniDo,
//    preveriKoledarVnos, sortirajKoledar, koledarPovzetek) — WYSIWYG po
//    konstrukciji (test dokazuje identične izpise kot klici PDF funkcij);
//  • sort = koledarski red (opomnikDatum ASC, izenačba ime ASC) —
//    f(MNOŽICA), ne f(vrstnega reda odgovora);
//  • meta vrstice (Obseg/Pregledov/V tem tednu/Poteklih/Sklep/Izvoženo ob) —
//    Sklep = VERBATIM PDF sklepni niz;
//  • fail-closed: prazen koledar / pokvaren vnos / pokvaren now → TypeError;
//  • format: BOM + '\n', citiranje, deterministično ime.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import {
  koledarPregledovCsvVrstice,
  koledarPregledovCsv,
  koledarPregledovCsvFilename,
  KOLEDAR_PREGLEDOV_CSV_GLAVA,
} from '../koledar-pregledov-csv'
import {
  sortirajKoledar,
  koledarDniDo,
  koledarPovzetek,
  type KoledarPregledVnos,
} from '../koledar-pregledov-pdf'
import { cenikDatumIso } from '../cenik-pdf'

const NOW = new Date(2026, 8, 21, 10, 0, 0) // 21. 9. 2026, 10:00 (lokalno)

const VHODI: KoledarPregledVnos[] = [
  {
    ime: 'Kokalj',
    naslov: 'Cesta 1, Kranj',
    telefon: '041 222 333',
    kontaktnaOseba: 'Marko',
    opomnikDatum: '2026-09-24',
    opomnikOpis: 'Letni pregled ograje',
    opomnikStatus: 'AKTIVEN',
  },
  {
    ime: 'Anže Test',
    naslov: 'Ulica 2, Ljubljana',
    telefon: null,
    kontaktnaOseba: null,
    opomnikDatum: '2026-09-14',
    opomnikOpis: null,
    opomnikStatus: 'POTEKEL',
  },
  {
    ime: 'Berta',
    naslov: 'Trg 3, Celje',
    telefon: '041 444 555',
    kontaktnaOseba: null,
    opomnikDatum: '2026-09-23',
    opomnikOpis: 'Pol leta kontrola',
    opomnikStatus: 'AKTIVEN',
  },
]

describe('R295 — glava + struktura', () => {
  it('glava = VERBATIM PDF autoTable head R253 (7 stolpcev)', () => {
    expect(KOLEDAR_PREGLEDOV_CSV_GLAVA).toEqual([
      'Stranka', 'Naslov', 'Telefon', 'Datum', 'Status', 'Dni do', 'Opis',
    ])
  })

  it('vrstice v koledarskem redu (f(množica) — ISTI sort kot PDF brat)', () => {
    // vhod namenoma NE sortiran (2026-09-24, 2026-09-14, 2026-09-23)
    const vrstice = koledarPregledovCsvVrstice(VHODI, NOW)
    const podatkovne = vrstice.slice(1, 4)
    expect(podatkovne[0]).toContain('"Anže Test"') // 2026-09-14 najprej
    expect(podatkovne[1]).toContain('"Berta"')     // 2026-09-23
    expect(podatkovne[2]).toContain('"Kokalj"')    // 2026-09-24
    // sort identičen klicu PDF brata
    const pdfSort = sortirajKoledar(VHODI)
    expect(pdfSort.map((p) => p.ime)).toEqual(['Anže Test', 'Berta', 'Kokalj'])
  })

  it('celice VERBATIM EN VIR izpeljave (Datum cenikDatumIso, Dni do koledarDniDo, null → —)', () => {
    const vrstice = koledarPregledovCsvVrstice(VHODI, NOW)
    const anze = vrstice[1] // prva podatkovna (2026-09-14)
    expect(anze).toBe(
      [
        'Anže Test',
        'Ulica 2, Ljubljana',
        '—', // telefon null → ISTI iskren null prikaz kot PDF
        cenikDatumIso('2026-09-14'),
        'POTEKEL',
        String(koledarDniDo({ opomnikDatum: '2026-09-14' }, NOW)),
        '—', // opis null → ISTI iskren null prikaz kot PDF
      ]
        .map((c) => `"${c.replace(/"/g, '""')}"`)
        .join(','),
    )
    expect(anze).toContain('"14.09.2026"') // cenikDatumIso EN VIR (DD.MM.YYYY)
    expect(anze).toContain('"-8"') // 2026-09-14T00Z − 2026-09-21T08Z (lokalno UTC+2) = −8 (prek)
  })

  it('narekovaj v besedilu se podvoji (citiraj kanon)', () => {
    const vrstice = koledarPregledovCsvVrstice(
      [{ ...VHODI[0], ime: 'Dvojni "Narekovaj" d.o.o.' }],
      NOW,
    )
    expect(vrstice[1]).toContain('"Dvojni ""Narekovaj"" d.o.o."')
  })
})

describe('R295 — meta vrstice (kanon R172/R291/R292/R293)', () => {
  it('Obseg + trikot + Sklep VERBATIM PDF niz + Izvoženo ob ISO', () => {
    const vrstice = koledarPregledovCsvVrstice(VHODI, NOW)
    const pov = koledarPovzetek(VHODI)
    expect(vrstice[4]).toBe('') // prazna ločilna vrstica (kanon)
    expect(vrstice[5]).toBe('"Obseg","Vse stranke z vpisanim datumom pregleda (AKTIVEN + POTEKEL) — koledarski red"')
    expect(vrstice[6]).toBe(`"Pregledov","${pov.preglediN}"`)
    expect(vrstice[7]).toBe(`"V tem tednu","${pov.vTemTednu}"`)
    expect(vrstice[8]).toBe(`"Poteklih","${pov.poteklih}"`)
    expect(vrstice[9]).toContain('"Sklep","')
    expect(vrstice[9]).toContain('vpisanih pregledov · ')
    expect(vrstice[9]).toContain(' · koledarski red (najbližji pregled prvi) · vir = opomnikStatus iz CRM.')
    expect(vrstice[10]).toBe('"Izvoženo ob","' + NOW.toISOString() + '"')
  })
})

describe('R295 — celoten niz + ime datoteke', () => {
  it('BOM + \\n zaključki + vrstic števec', () => {
    const { csv, vrstic } = koledarPregledovCsv(VHODI, NOW)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv.endsWith('\n')).toBe(false)
    expect(csv.split('\n')).toHaveLength(vrstic)
    expect(vrstic).toBe(1 + 3 + 7) // glava + 3 podatkovne + 7 meta (ločilna + Obseg + trikot + Sklep + Izvoženo ob)
  })

  it('deterministično ime: Koledar-pregledov-YYYY-MM-DD.csv (brat PDF R253)', () => {
    expect(koledarPregledovCsvFilename(NOW)).toBe('Koledar-pregledov-2026-09-21.csv')
    expect(koledarPregledovCsvFilename(new Date(2027, 0, 2))).toBe('Koledar-pregledov-2027-01-02.csv')
  })
})

describe('R295 — fail-closed (NIČ tihega spregleda)', () => {
  it('PRAZEN koledar ne nastaja datoteke (družinsko pravilo R253 — TypeError)', () => {
    expect(() => koledarPregledovCsvVrstice([], NOW)).toThrow(TypeError)
    expect(() => koledarPregledovCsvVrstice([], NOW)).toThrow(/prazen koledar/)
  })

  it("'NI' vnos = pokvaren vir → TypeError z indeksom krivca (EN VIR preveriKoledarVnos)", () => {
    const pokvaren = [{ ...VHODI[0], opomnikStatus: 'NI' as unknown as 'AKTIVEN' | 'POTEKEL' }]
    expect(() => koledarPregledovCsvVrstice(pokvaren, NOW)).toThrow(/preveriKoledarVnos \(0\)/)
  })

  it('pokvaren opomnikDatum → TypeError (EN VIR preveriKoledarVnos)', () => {
    const pokvaren = [{ ...VHODI[0], opomnikDatum: 'neveljaven' }]
    expect(() => koledarPregledovCsvVrstice(pokvaren, NOW)).toThrow(/opomnikDatum/)
  })

  it('pokvaren now → TypeError (vseh treh funkcij)', () => {
    const slabNow = 'ne-datum' as unknown as Date
    expect(() => koledarPregledovCsvVrstice(VHODI, slabNow)).toThrow(TypeError)
    expect(() => koledarPregledovCsv(VHODI, slabNow)).toThrow(TypeError)
    expect(() => koledarPregledovCsvFilename(slabNow)).toThrow(TypeError)
    expect(() => koledarPregledovCsvVrstice(VHODI, new Date(NaN))).toThrow(TypeError)
  })

  it('ne-polje vhoda → TypeError', () => {
    expect(() => koledarPregledovCsvVrstice({} as unknown as KoledarPregledVnos[], NOW)).toThrow(TypeError)
    expect(() => koledarPregledovCsvVrstice(null as unknown as KoledarPregledVnos[], NOW)).toThrow(TypeError)
  })
})
