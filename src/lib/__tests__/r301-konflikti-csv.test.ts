// ---------------------------------------------------------------------------
// R301 — TEDENSKI KONFLIKTI CSV (31. člen 'izvozi' družine) — CSV brat
// pregledu R300 (vzorec R292/R297). Dokazi:
//  • glava ×10 VERBATIM; ENA vrstica = EN dokazani PAR (oba člena: projekt,
//    VERBATIM ISO začetek/konec, status label EN VIR SCHEDULE_TERMINI_STATUS_
//    LABELS — ISTI prikaz kot CSV brat R292);
//  • red vrstic = tedenskiKonflikti EN VIR (skupine ASC UTF-16 po ekipi,
//    pari po sortiranem času ASC — f(množica); premešan vhod = bajtno ISTI
//    CSV); čez-polnoč par nosi dan ZAČETKA prekrivanja (max začetek);
//  • meta (kanon R172→R296): Obseg okna (cenikDatumIso EN VIR) + Konfliktov
//    + Ekip z konflikti + Pregledanih terminov + Sklep (EN VIR konfliktiSklep
//    = ISTO besedilo kot rdeč žig mini-vrstice 30. člena) + 'Izvoženo ob';
//  • format: BOM + '\n' zaključki + citiranje; ime Konflikti-YYYY-MM-DD.csv
//    (F4 — now KOT parameter);
//  • DOMAIN pravilo (fail-closed mirror R266/R297): 0 konfliktov (zelen žig)
//    NI vhod — TypeError z razlogom (ni prazne datoteke; komponenta pokaže
//    iskren toast ŠE PRED klicem — lib dvakrat brani);
//  • fail-closed: ne-polje / pokvaren vnos (uvožen pregled — indeks krivca)
//    / pokvaren now → TypeError;
//  • STRAŽAR ×2: (1) klientska čistost — lib NE uvaža '@/lib/db' + EN VIR
//    uvoz tedenskiKonflikti (NE strežniške domene); (2) REALNIM logistics-tab
//    — pill (testid, label, definicijski naslov z izrečenimi pravili,
//    disabled guard), handler, zelen-žig toast, legenda.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  konfliktiCsvVrstice,
  konfliktiCsv,
  konfliktiCsvFilename,
  konfliktiSklep,
  KONFLIKTI_CSV_GLAVA,
} from '../konflikti-csv'
import { tedenskiKonflikti } from '../tedenski-konflikti'
import { cenikDatumIso } from '../cenik-pdf'
import { SCHEDULE_TERMINI_STATUS_LABELS } from '../termini-prikaz'
import type { VozniRedTermin } from '../logistika-vozni-red-pdf'

/** UTC referenčni trenutek — okno = 2026-09-21 .. 2026-09-27 (danes + 6, UTC). */
const NOW_UTC = new Date('2026-09-21T10:00:00Z')

function termin(p: Partial<VozniRedTermin> & { datumZacetka: string }): VozniRedTermin {
  return {
    datumKonca: null,
    status: 'NAVRTENO',
    predvideneUre: null,
    projekt: null,
    stranka: null,
    ekipa: null,
    lokacija: null,
    ...p,
  }
}

/** Dokazani par iste ekipe: A 08:00–12:00, B 10:00–14:00 → prekrivanje
 *  10:00–12:00, dan 2026-09-22. */
function parAlfa(ekipa = 'Ekipa Alfa'): VozniRedTermin[] {
  return [
    termin({ datumZacetka: '2026-09-22T08:00:00Z', datumKonca: '2026-09-22T12:00:00Z', ekipa, projekt: 'Projekt A' }),
    termin({ datumZacetka: '2026-09-22T10:00:00Z', datumKonca: '2026-09-22T14:00:00Z', ekipa, projekt: 'Projekt B', status: 'V_TEKU' }),
  ]
}

describe('R301 glava + celice', () => {
  it('glava ×10 VERBATIM (Ekipa · Dan prekrivanja · 2× sklop Termin A/B)', () => {
    expect([...KONFLIKTI_CSV_GLAVA]).toEqual([
      'Ekipa',
      'Dan prekrivanja',
      'Termin A projekt',
      'Termin A začetek (UTC)',
      'Termin A konec (UTC)',
      'Termin A status',
      'Termin B projekt',
      'Termin B začetek (UTC)',
      'Termin B konec (UTC)',
      'Termin B status',
    ])
  })

  it('en par = ena vrstica: ekipa, dan prekrivanja, VERBATIM projekti + ISO časa + status labeli', () => {
    const vrstice = konfliktiCsvVrstice(parAlfa(), NOW_UTC)
    expect(vrstice).toHaveLength(9) // glava + podatkovna + ločilna + Obseg/Konfliktov/Ekip/Pregledanih/Sklep/Izvoženo
    const podatkovna = vrstice[1]!
    expect(podatkovna).toBe(
      [
        'Ekipa Alfa',
        '2026-09-22',
        'Projekt A',
        '2026-09-22T08:00:00Z',
        '2026-09-22T12:00:00Z',
        SCHEDULE_TERMINI_STATUS_LABELS.NAVRTENO,
        'Projekt B',
        '2026-09-22T10:00:00Z',
        '2026-09-22T14:00:00Z',
        SCHEDULE_TERMINI_STATUS_LABELS.V_TEKU,
      ]
        .map((c) => `"${c}"`)
        .join(','),
    )
  })

  it('dve ekipi = skupine ASC UTF-16 → vrstice v ISTEM redu (kanon R245/R250 EN VIR)', () => {
    const vnosi = [...parAlfa('Ekipa Žiga'), ...parAlfa('Ekipa Alfa')]
    const pregled = tedenskiKonflikti(vnosi, NOW_UTC)
    expect(pregled).not.toBeNull()
    const vrstice = konfliktiCsvVrstice(vnosi, NOW_UTC)
    const vrste = vrstice.slice(1, 1 + pregled!.stPrekrivanj)
    expect(vrste).toHaveLength(2)
    expect(vrste[0]!.startsWith('"Ekipa Alfa"')).toBe(true)
    expect(vrste[1]!.startsWith('"Ekipa Žiga"')).toBe(true)
  })

  it('trije hkratni = 3 pari po času ASC (a-b, a-c, b-c — EN VIR tedenskiKonflikti)', () => {
    const vnosi = [
      termin({ datumZacetka: '2026-09-22T08:00:00Z', datumKonca: '2026-09-22T16:00:00Z', ekipa: 'Ekipa Alfa' }),
      termin({ datumZacetka: '2026-09-22T09:00:00Z', datumKonca: '2026-09-22T12:00:00Z', ekipa: 'Ekipa Alfa', projekt: 'Drugi' }),
      termin({ datumZacetka: '2026-09-22T11:00:00Z', datumKonca: '2026-09-22T15:00:00Z', ekipa: 'Ekipa Alfa', projekt: 'Tretji' }),
    ]
    const vrstice = konfliktiCsvVrstice(vnosi, NOW_UTC)
    const vrste = vrstice.slice(1, 4)
    expect(vrste).toHaveLength(3)
    // red = (i,j) leksikografski nad časovno sortiranimi vrsticami — f(množica):
    // a-b (08/09), a-c (08/11), b-c (09/11) — unikatne začetne pare.
    expect(vrste[0]).toContain('"2026-09-22T08:00:00Z"')
    expect(vrste[0]).toContain('"2026-09-22T09:00:00Z"')
    expect(vrste[1]).toContain('"2026-09-22T08:00:00Z"')
    expect(vrste[1]).toContain('"2026-09-22T11:00:00Z"')
    expect(vrste[2]).toContain('"2026-09-22T09:00:00Z"')
    expect(vrste[2]).toContain('"2026-09-22T11:00:00Z"')
  })

  it('čez-polnoč par nosi dan ZAČETKA prekrivanja (max začetek — resnica brata R300)', () => {
    const vnosi = [
      termin({ datumZacetka: '2026-09-22T20:00:00Z', datumKonca: '2026-09-23T04:00:00Z', ekipa: 'Ekipa Alfa' }),
      termin({ datumZacetka: '2026-09-22T23:00:00Z', datumKonca: '2026-09-23T02:00:00Z', ekipa: 'Ekipa Alfa', projekt: 'Nočni' }),
    ]
    const vrstice = konfliktiCsvVrstice(vnosi, NOW_UTC)
    expect(vrstice[1]!.startsWith('"Ekipa Alfa","2026-09-22"')).toBe(true)
  })

  it('f(množica): premešan vhod = bajtno ISTI CSV (determinizem — kanon R245/R250)', () => {
    const urejeni = parAlfa()
    const pomesani = [urejeni[1]!, urejeni[0]!]
    expect(konfliktiCsvVrstice(pomesani, NOW_UTC)).toEqual(konfliktiCsvVrstice(urejeni, NOW_UTC))
  })

  it('projekt null = poštena celica — (izkren prostor namesto izmišljenega naziva)', () => {
    const vnosi = [
      termin({ datumZacetka: '2026-09-22T08:00:00Z', datumKonca: '2026-09-22T12:00:00Z', ekipa: 'Ekipa Alfa', projekt: null }),
      termin({ datumZacetka: '2026-09-22T10:00:00Z', datumKonca: '2026-09-22T14:00:00Z', ekipa: 'Ekipa Alfa' }),
    ]
    const vrstice = konfliktiCsvVrstice(vnosi, NOW_UTC)
    expect(vrstice[1]).toContain('"—"')
  })
})

describe('R301 meta vrstice (kanon R172→R296)', () => {
  it('ločilna + Obseg okna (cenikDatumIso EN VIR) + Konfliktov + Ekip z konflikti + Pregledanih terminov + Sklep + Izvoženo ob', () => {
    const vnosi = parAlfa()
    const pregled = tedenskiKonflikti(vnosi, NOW_UTC)!
    const vrstice = konfliktiCsvVrstice(vnosi, NOW_UTC)
    expect(vrstice[2]).toBe('')
    const okno = ['2026-09-21', '2026-09-27']
    expect(vrstice[3]).toBe(`"Obseg","Okno naslednjih 7 dni: ${cenikDatumIso(okno[0])} – ${cenikDatumIso(okno[1])} (danes + 6 dni, UTC) — vir = ISTI pregled kot žig na zaslonu (tedenskiKonflikti)."`)
    expect(vrstice[4]).toBe('"Konfliktov","1"')
    expect(vrstice[5]).toBe('"Ekip z konflikti","1"')
    expect(vrstice[6]).toBe(`"Pregledanih terminov","${pregled.pregledanih}"`)
    expect(vrstice[7]).toBe(`"Sklep","${konfliktiSklep(pregled)}"`)
    expect(vrstice[8]).toBe(`"Izvoženo ob","${NOW_UTC.toISOString()}"`)
  })

  it('Pregledanih terminov = resnica obsega pregleda (aktivni + ekipo + konec; preklicani/ekipa-null/ brez konca izključeni)', () => {
    const vnosi = [
      ...parAlfa(),
      termin({ datumZacetka: '2026-09-23T08:00:00Z', datumKonca: '2026-09-23T12:00:00Z', ekipa: 'Ekipa Alfa', status: 'PREKlicANO' }),
      termin({ datumZacetka: '2026-09-23T08:00:00Z', datumKonca: null, ekipa: 'Ekipa Alfa' }),
      termin({ datumZacetka: '2026-09-23T08:00:00Z', datumKonca: '2026-09-23T12:00:00Z', ekipa: null }),
    ]
    const vrstice = konfliktiCsvVrstice(vnosi, NOW_UTC)
    expect(vrstice[6]).toBe('"Pregledanih terminov","2"')
  })

  it('Sklep = EN VIR konfliktiSklep = ISTO besedilo kot rdeč žig mini-vrstice 30. člena (WYSIWYG)', () => {
    const pregled = tedenskiKonflikti(parAlfa(), NOW_UTC)!
    expect(konfliktiSklep(pregled)).toBe(
      'Konflikti: 1 · ekipe: Ekipa Alfa — dvojne rezervacije v okviru (poli-odprto pravilo).',
    )
  })

  it('konfliktiSklep fail-closed: null pregled → TypeError (nikoli izmišljen sklep)', () => {
    expect(() => konfliktiSklep(null as unknown as Parameters<typeof konfliktiSklep>[0])).toThrow(TypeError)
  })
})

describe('R301 format + ime (F4)', () => {
  it('BOM prepona + \\n zaključki + vrstic števec (vzorec R186/R292/R297)', () => {
    const { csv, vrstic } = konfliktiCsv(parAlfa(), NOW_UTC)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv.endsWith(NOW_UTC.toISOString() + '"')).toBe(true)
    expect(vrstic).toBe(9)
    expect(csv.split('\n').length).toBe(9) // 9 vrstic = 8 '\n' ločil (CSV brez trailing '\n' — lekcija R297)
  })

  it('ime Konflikti-YYYY-MM-DD.csv iz now (F4 — referenčni datum KOT parameter)', () => {
    expect(konfliktiCsvFilename(NOW_UTC)).toBe('Konflikti-2026-09-21.csv')
    expect(konfliktiCsvFilename(new Date('2026-12-31T23:59:59Z'))).toBe('Konflikti-2026-12-31.csv')
  })
})

describe('R301 DOMAIN pravilo — 0 konfliktov NI vhod (fail-closed mirror R266/R297)', () => {
  it('nazaj-na-nazaj (zelen žig) → TypeError z razlogom (ni prazne datoteke)', () => {
    const vnosi = [
      termin({ datumZacetka: '2026-09-22T08:00:00Z', datumKonca: '2026-09-22T12:00:00Z', ekipa: 'Ekipa Alfa' }),
      termin({ datumZacetka: '2026-09-22T12:00:00Z', datumKonca: '2026-09-22T16:00:00Z', ekipa: 'Ekipa Alfa' }),
    ]
    expect(tedenskiKonflikti(vnosi, NOW_UTC)).toBeNull()
    expect(() => konfliktiCsvVrstice(vnosi, NOW_UTC)).toThrow(TypeError)
    expect(() => konfliktiCsvVrstice(vnosi, NOW_UTC)).toThrow(/ni dokazanih konfliktov/)
  })

  it('prazno polje → TypeError (tedenskiKonflikti = null iskrena čistost — lib dvakrat brani)', () => {
    expect(() => konfliktiCsvVrstice([], NOW_UTC)).toThrow(/ni dokazanih konfliktov/)
  })

  it('PREKlicano/Zaključeno ne zasede → brez para → TypeError (zrcalo R142 EN VIR)', () => {
    const vnosi = [
      termin({ datumZacetka: '2026-09-22T08:00:00Z', datumKonca: '2026-09-22T12:00:00Z', ekipa: 'Ekipa Alfa' }),
      termin({ datumZacetka: '2026-09-22T10:00:00Z', datumKonca: '2026-09-22T14:00:00Z', ekipa: 'Ekipa Alfa', status: 'PREKlicANO' }),
    ]
    expect(() => konfliktiCsvVrstice(vnosi, NOW_UTC)).toThrow(/ni dokazanih konfliktov/)
  })
})

describe('R301 fail-closed (družinska pravila)', () => {
  it('pokvaren now → TypeError (vrstice / csv / filename — F4)', () => {
    const vnosi = parAlfa()
    expect(() => konfliktiCsvVrstice(vnosi, new Date('ne-date'))).toThrow(TypeError)
    expect(() => konfliktiCsvVrstice(vnosi, '2026-09-21' as unknown as Date)).toThrow(TypeError)
    expect(() => konfliktiCsv(vnosi, new Date('ne-date'))).toThrow(TypeError)
    expect(() => konfliktiCsvFilename(new Date('ne-date'))).toThrow(TypeError)
  })

  it('ne-polje → TypeError (nikoli tiho spregledano)', () => {
    expect(() => konfliktiCsvVrstice(null as unknown as readonly VozniRedTermin[], NOW_UTC)).toThrow(TypeError)
  })

  it('pokvaren vnos → TypeError z indeksom krivca (uvožen preveriVozniRedTermin — EN VIR brata R300)', () => {
    const vnosi = [
      ...parAlfa(),
      termin({ datumZacetka: '2026-09-23T08:00:00Z', datumKonca: '2026-09-23T12:00:00Z', ekipa: 'Ekipa Alfa', status: 'NEZNAN' as unknown as VozniRedTermin['status'] }),
    ]
    expect(() => konfliktiCsvVrstice(vnosi, NOW_UTC)).toThrow(/\(2\)/)
  })
})

describe('R301 STRAŽAR ×2', () => {
  it('klientska čistost: lib NE uvaža @/lib/db + EN VIR uvoz tedenskiKonflikti (NE strežniške domene)', () => {
    const src = readFileSync(resolve(__dirname, '../konflikti-csv.ts'), 'utf8')
    expect(src.includes('@/lib/db')).toBe(false)
    expect(src.includes("from './tedenski-konflikti'")).toBe(true)
    expect(src.includes("from './schedule-conflicts'")).toBe(false)
  })

  it('REALNIM logistics-tab: pill (testid + label + definicijski naslov + disabled guard) + handler + zelen-žig toast + legenda', () => {
    const src = readFileSync(resolve(__dirname, '../../components/roksal/logistics-tab.tsx'), 'utf8')
    expect(src.includes("from '@/lib/konflikti-csv'")).toBe(true)
    expect(src.includes('konfliktiCsvFilename')).toBe(true)
    expect(src.includes('konfliktiSklep')).toBe(true)
    expect(src.includes('handleKonfliktiCsv')).toBe(true)
    expect(src.includes('data-testid="konflikti-csv-pill"')).toBe(true)
    expect(src.includes('disabled={konfliktiCsvVTeku}')).toBe(true)
    expect(src.includes('Konflikti CSV')).toBe(true)
    expect(src.includes('isti poli-odprto pregled kot žig')).toBe(true)
    expect(src.includes('Ni dokazanih konfliktov v okviru')).toBe(true)
    expect(src.includes('dokazani pari prekrivanj ekipe (isti pregled kot žig)')).toBe(true)
    expect(src.includes('const now = tedenskiRazgledNow')).toBe(true)
  })
})
