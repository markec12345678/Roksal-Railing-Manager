// ---------------------------------------------------------------------------
// R304 — VODJA TEDENSKI CSV PO EKIPAH (34. člen 'izvozi' družine, P1) —
// testi. Formatni dokazi (BOM + '\n' + citiranje + determinizem: premešan
// vhod = ISTI niz — pregled kanon f(množica)) + EN VIR dokazi (pregled +
// sklep UVOŽENA iz R303 brata; Čas uvožen vozniRedCasOkno R255; Dan/Dan v
// tednu uvožena iz R256; statusi VERBATIM; meta kanon R172→R296; ŠTIRI
// potrošniki ENEGA sklepa) + DOMAIN pravilo (0 ekip NI vhod — mirror
// R299/R303; brez-ekipe iskren števec) + fail-closed + STRAŽAR klientske
// čistosti + REALNIM logistics-tab (pill + guard + handler + legenda).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  EKIPA_CSV_GLAVA,
  tedenskiEkipaCsv,
  tedenskiEkipaCsvFilename,
  tedenskiEkipaCsvVrstice,
} from '../tedenski-vozni-red-ekipa-csv'
import {
  tedenskiEkipaPregled,
  tedenskiEkipaPdfSklep,
} from '../tedenski-vozni-red-ekipa-pdf'
import { tedenskiEkipaPdfFilename } from '../tedenski-vozni-red-ekipa-pdf'
import { tedenskiDanIme } from '../tedenski-vozni-red-pdf'
import { vozniRedCasOkno } from '../logistika-vozni-red-pdf'
import { SCHEDULE_TERMINI_STATUS_LABELS } from '../termini-prikaz'
import type { VozniRedTermin } from '../logistika-vozni-red-pdf'

/** UTC referenčni trenutek — okno = 2026-09-21 .. 2026-09-27 (danes + 6, UTC).
 *  ISTA resnica kot R303 brat testi (ENA družinska resnica). */
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

/** Ekipa Alfa: 2 termini v oknu (EN VIR bratov — ISTI vzorec kot R302/R303). */
function ekipaAlfa(): VozniRedTermin[] {
  return [
    termin({ datumZacetka: '2026-09-22T08:00:00Z', datumKonca: '2026-09-22T12:00:00Z', ekipa: 'Ekipa Alfa', projekt: 'Projekt A', stranka: 'Stranka A', predvideneUre: 4, lokacija: 'Kranj' }),
    termin({ datumZacetka: '2026-09-24T09:00:00Z', datumKonca: '2026-09-24T13:00:00Z', ekipa: 'Ekipa Alfa', projekt: 'Projekt B', status: 'V_TEKU', predvideneUre: 4 }),
  ]
}

/** Ekipa Beta: 1 termin v oknu + 1 PREKlicano (iskren vidni odpad — VIDNO). */
function ekipaBeta(): VozniRedTermin[] {
  return [
    termin({ datumZacetka: '2026-09-23T10:00:00Z', datumKonca: '2026-09-23T14:00:00Z', ekipa: 'Ekipa Beta', projekt: 'Projekt C', status: 'PREKlicANO', predvideneUre: 4 }),
    termin({ datumZacetka: '2026-09-25T08:00:00Z', datumKonca: '2026-09-25T12:00:00Z', ekipa: 'Ekipa Beta', projekt: 'Projekt D', predvideneUre: 4 }),
  ]
}

/** Termin BREZ ekipe v oknu (iskren brez-ekipe števec — NI vrstica). */
function brezEkipeTermin(): VozniRedTermin {
  return termin({ datumZacetka: '2026-09-22T14:00:00Z', datumKonca: '2026-09-22T16:00:00Z', projekt: 'Projekt E' })
}

const osnova = (): VozniRedTermin[] => [...ekipaAlfa(), ...ekipaBeta()]

function zgradiVrstice(vnosi: readonly VozniRedTermin[] = osnova(), now: Date = NOW_UTC): string[] {
  return tedenskiEkipaCsvVrstice(vnosi, now)
}

function zgradiCsv(vnosi: readonly VozniRedTermin[] = osnova(), now: Date = NOW_UTC): { csv: string; vrstic: number } {
  return tedenskiEkipaCsv(vnosi, now)
}

const lib = readFileSync(resolve(__dirname, '../tedenski-vozni-red-ekipa-csv.ts'), 'utf8')
const komponenta = readFileSync(resolve(__dirname, '../../components/roksal/logistics-tab.tsx'), 'utf8')

describe('R304 — CSV formatni dokazi (BOM + vrstice + determinizem + citiranje)', () => {
  it('BOM + \\n zaključki + vrstic = glava 1 + podatkovne 4 + ločilna 1 + meta 8 = 14', () => {
    const { csv, vrstic } = zgradiCsv()
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.endsWith('\n')).toBe(false) // '\n' LOČILA med vrsticami, ne trailing
    expect(vrstic).toBe(14)
    expect(csv.slice(1).split('\n')).toHaveLength(14)
  })

  it('determinizem: enak vhod = ISTI niz; PREMEŠAN VRSTNI RED = ISTI niz (pregled kanon f(množica)); drug now = drugačen (Izvoženo ob)', () => {
    const vnosi = osnova()
    expect(zgradiCsv(vnosi).csv).toBe(zgradiCsv(vnosi).csv)
    expect(zgradiCsv([...vnosi].reverse()).csv).toBe(zgradiCsv(vnosi).csv)
    expect(zgradiCsv(vnosi, new Date('2026-09-21T10:01:00.000Z')).csv).not.toBe(zgradiCsv(vnosi).csv)
  })

  it('citiranje po RFC 4180: narekovaj podvojen; vejica v vrednosti varna (celica ostaja ENA)', () => {
    const { csv } = zgradiCsv([
      termin({ datumZacetka: '2026-09-22T08:00:00Z', ekipa: 'Ekipa "Alfa", oddel. 1', projekt: 'Projekt, A' }),
    ])
    expect(csv).toContain('"Ekipa ""Alfa"", oddel. 1"')
    expect(csv).toContain('"Projekt, A"')
  })

  it('ime brata: Tedenski-po-ekipah-YYYY-MM-DD.csv; PDF brat R303 nosi ISTO osnovo + .pdf (EN VIR dnevna resnica — vsak svoj vzorec)', () => {
    expect(tedenskiEkipaCsvFilename(NOW_UTC)).toBe('Tedenski-po-ekipah-2026-09-21.csv')
    expect(tedenskiEkipaPdfFilename(NOW_UTC)).toBe('Tedenski-po-ekipah-2026-09-21.pdf')
  })
})

describe('R304 — EN VIR resnice (pregled + sklep iz R303 brata — nič dvojnega)', () => {
  it('glava ×9 točno; vrstice = tedenskiEkipaPregled EN VIR (skupine ASC UTF-16; vsaka vrstica nosi Ekipa stolpec; sort čas ASC znotraj ekipe)', () => {
    const vrstice = zgradiVrstice()
    expect(vrstice[0]).toBe(EKIPA_CSV_GLAVA.map((c) => `"${c}"`).join(','))
    expect(EKIPA_CSV_GLAVA).toEqual(['Ekipa', 'Dan', 'Dan v tednu', 'Čas', 'Projekt', 'Stranka', 'Status', 'Ure', 'Lokacija'])
    const podatkovne = vrstice.slice(1, 5).map((v) => v.split('","').map((c) => c.replaceAll('"', '')))
    expect(podatkovne.map((p) => p[0])).toEqual(['Ekipa Alfa', 'Ekipa Alfa', 'Ekipa Beta', 'Ekipa Beta'])
    expect(podatkovne.map((p) => p[1])).toEqual(['2026-09-22', '2026-09-24', '2026-09-23', '2026-09-25'])
    // EN VIR dokaz: ISTA množica (ekipa, dan) kot pregled skupine
    const pregled = tedenskiEkipaPregled(osnova(), NOW_UTC)!
    expect(pregled.skupine.map((s) => s.ekipa)).toEqual(['Ekipa Alfa', 'Ekipa Beta'])
  })

  it('celice VERBATIM: Dan v tednu = uvožen tedenskiDanIme; Čas = uvožen vozniRedCasOkno; statusi = SCHEDULE_TERMINI_STATUS_LABELS (preklicana vrstica OSTANE vidna — iskren odpad)', () => {
    const podatkovne = zgradiVrstice().slice(1, 5).map((v) => v.split('","').map((c) => c.replaceAll('"', '')))
    expect(podatkovne[0]![2]).toBe(tedenskiDanIme('2026-09-22'))
    expect(podatkovne[0]![3]).toBe(vozniRedCasOkno(ekipaAlfa()[0]!))
    expect(podatkovne[0]![3]).toBe('08:00–12:00')
    expect(podatkovne[1]![6]).toBe(SCHEDULE_TERMINI_STATUS_LABELS.V_TEKU)
    expect(podatkovne[2]![6]).toBe(SCHEDULE_TERMINI_STATUS_LABELS.PREKlicANO)
    expect(podatkovne[2]![0]).toBe('Ekipa Beta') // preklicani ostane v datoteki
  })

  it("null resnica '—' (projekt/stranka/ure/lokacija — ISTO kot PDF brat sekcije; R227 strogost)", () => {
    const podatkovne = zgradiVrstice([termin({ datumZacetka: '2026-09-22T08:00:00Z', ekipa: 'Ekipa Alfa' })])
      .slice(1, 2)
      .map((v) => v.split('","').map((c) => c.replaceAll('"', '')))
    expect(podatkovne[0]).toEqual(['Ekipa Alfa', '2026-09-22', tedenskiDanIme('2026-09-22'), '08:00', '—', '—', SCHEDULE_TERMINI_STATUS_LABELS.NAVRTENO, '—', '—'])
  })

  it('meta kanon R172→R296: ločilna + Obseg + Ekip + Terminov po ekipah + Načrtovane ure + pogojni Preklicani + Terminov skupaj v oknu + Sklep + Izvoženo ob (brez kondicionalnih pri 0)', () => {
    const vrstice = zgradiVrstice()
    const meta = vrstice.slice(5)
    expect(meta[0]).toBe('')
    expect(meta[1]).toContain('"Obseg"')
    expect(meta[1]).toContain('Okno naslednjih 7 dni:')
    expect(meta[2]).toBe('"Ekip","2"')
    expect(meta[3]).toBe('"Terminov po ekipah","4"')
    expect(meta[4]).toBe('"Načrtovane ure","16"')
    expect(meta[5]).toBe('"Preklicani (viden odpad)","1"')
    expect(meta[6]).toBe('"Terminov skupaj v oknu","4"')
    expect(meta[7]!.startsWith('"Sklep",')).toBe(true)
    expect(meta[8]!.startsWith('"Izvoženo ob","2026-09-21T10:00:00.000Z"')).toBe(true)
  })

  it('sklep EN VIR: meta Sklep = tedenskiEkipaPdfSklep(pregled) IDENTIČNO (ŠTIRI potrošniki ENEGA niza) + \'≥\' kontrakt + pogojna Brez ure vrstica', () => {
    const pregled = tedenskiEkipaPregled(osnova(), NOW_UTC)!
    const sklepVrstica = zgradiVrstice().find((v) => v.startsWith('"Sklep",'))
    expect(sklepVrstica).toBe(`"Sklep","${tedenskiEkipaPdfSklep(pregled)}"`)
    expect(tedenskiEkipaPdfSklep(pregled)).toBe('Ekip: 2 · terminov po ekipah: 4 · 16 načrtovanih ur · preklicanih 1')
    // '≥' meja — uvožen tedenskiUreKpi kontrakt + pogojna vrstica
    const brezUreVrstice = zgradiVrstice([termin({ datumZacetka: '2026-09-22T08:00:00Z', ekipa: 'Ekipa Alfa' })])
    expect(brezUreVrstice.find((v) => v.startsWith('"Načrtovane ure"'))).toBe('"Načrtovane ure","≥ 0"')
    expect(brezUreVrstice.find((v) => v.startsWith('"Brez ure (izključene iz vsote)"'))).toBe('"Brez ure (izključene iz vsote)","1"')
  })
})

describe('R304 — iskren brez-ekipe števec + kondicionalnost odpadkov', () => {
  it('brezEkipe: termin brez ekipe NI podatkovna vrstica (ekipa — ne obstaja, princip R299/R303), ampak NI tiho izgubljen (pogojna meta vrstica + particija okna)', () => {
    const vnosi = [...ekipaAlfa(), brezEkipeTermin()]
    const vrstice = zgradiVrstice(vnosi)
    const podatkovne = vrstice.slice(1, 3)
    expect(podatkovne.every((v) => v.includes('"Ekipa Alfa"'))).toBe(true)
    expect(vrstice.find((v) => v.startsWith('"Brez ekipe (brez sekcije'))).toBe('"Brez ekipe (brez sekcije — viden odpad)","1"')
    const pregled = tedenskiEkipaPregled(vnosi, NOW_UTC)!
    expect(pregled.terminovSkupaj).toBe(pregled.terminovVEkipah + pregled.brezEkipe)
    expect(vrstice.find((v) => v.startsWith('"Terminov skupaj v oknu"'))).toBe('"Terminov skupaj v oknu","3"')
    expect(vrstice.find((v) => v.startsWith('"Sklep"'))).toContain('brez ekipe: 1 (brez sekcije)')
  })

  it('kondicionalnost: brez preklicanih/brez-ure/brez-ekipe → NIČ od treh pogojnih vrstic (nikoli lažne ničle)', () => {
    const vrstice = zgradiVrstice([
      termin({ datumZacetka: '2026-09-22T08:00:00Z', datumKonca: '2026-09-22T12:00:00Z', ekipa: 'Ekipa Alfa', predvideneUre: 4 }),
      termin({ datumZacetka: '2026-09-23T08:00:00Z', datumKonca: '2026-09-23T12:00:00Z', ekipa: 'Ekipa Beta', predvideneUre: 4 }),
    ])
    expect(vrstice.find((v) => v.startsWith('"Preklicani'))).toBeUndefined()
    expect(vrstice.find((v) => v.startsWith('"Brez ure'))).toBeUndefined()
    expect(vrstice.find((v) => v.startsWith('"Brez ekipe'))).toBeUndefined()
  })
})

describe('R304 DOMAIN pravilo — 0 ekip NI vhod (fail-closed mirror R299/R303)', () => {
  it('prazno polje → TypeError z razlogom (ni prazne datoteke — družina R266/R297/R301/R302/R303)', () => {
    expect(tedenskiEkipaPregled([], NOW_UTC)).toBeNull()
    expect(() => tedenskiEkipaCsvVrstice([], NOW_UTC)).toThrow(TypeError)
    expect(() => tedenskiEkipaCsvVrstice([], NOW_UTC)).toThrow(/ni ekip z termini/)
    expect(() => tedenskiEkipaCsv([], NOW_UTC)).toThrow(/ni ekip z termini/)
  })

  it('samo termini brez ekipe v oknu → TypeError (ekipa — ne obstaja — ISTI princip kot R299 čipi/R303 sekcije)', () => {
    const vnosi = [brezEkipeTermin()]
    expect(tedenskiEkipaPregled(vnosi, NOW_UTC)).toBeNull()
    expect(() => tedenskiEkipaCsv(vnosi, NOW_UTC)).toThrow(/ni ekip z termini/)
  })

  it('termini IZVEN okna ne ustvarijo ekip (okno = danes..danes+6 UTC) → TypeError', () => {
    const vnosi = [termin({ datumZacetka: '2026-09-28T08:00:00Z', ekipa: 'Ekipa Alfa' })]
    expect(tedenskiEkipaPregled(vnosi, NOW_UTC)).toBeNull()
    expect(() => tedenskiEkipaCsvVrstice(vnosi, NOW_UTC)).toThrow(/ni ekip z termini/)
  })
})

describe('R304 fail-closed (družinska pravila)', () => {
  it('pokvaren now → TypeError (vrstice / csv / filename — F4)', () => {
    const vnosi = ekipaAlfa()
    expect(() => tedenskiEkipaCsvVrstice(vnosi, new Date('ne-date'))).toThrow(TypeError)
    expect(() => tedenskiEkipaCsvVrstice(vnosi, '2026-09-21' as unknown as Date)).toThrow(TypeError)
    expect(() => tedenskiEkipaCsv(vnosi, new Date('ne-date'))).toThrow(TypeError)
    expect(() => tedenskiEkipaCsvFilename(new Date('ne-date'))).toThrow(TypeError)
  })

  it('ne-polje → TypeError ×2 (nikoli tiho spregledano); pokvaren vnos → TypeError z indeksom krivca (uvožen pregled R299/R303 — ENA preverba)', () => {
    expect(() => tedenskiEkipaCsvVrstice(null as unknown as readonly VozniRedTermin[], NOW_UTC)).toThrow(TypeError)
    expect(() => tedenskiEkipaCsv('ne-polje' as unknown as readonly VozniRedTermin[], NOW_UTC)).toThrow(TypeError)
    const vnosi = [
      ...ekipaAlfa(),
      termin({ datumZacetka: '2026-09-23T08:00:00Z', ekipa: 'Ekipa Alfa', status: 'NEZNAN' as unknown as VozniRedTermin['status'] }),
    ]
    expect(() => tedenskiEkipaCsvVrstice(vnosi, NOW_UTC)).toThrow(/\(2\)/)
    expect(() => tedenskiEkipaCsv(vnosi, NOW_UTC)).toThrow(/\(2\)/)
  })
})

describe('R304 STRAŽAR ×2', () => {
  it('klientska čistost: lib NE uvaža @/lib/db + NE strežniške domene + EN VIR uvoz iz R303 brata (pregled + sklep) + R256 (Dan + ureKpi)', () => {
    expect(lib.includes('@/lib/db')).toBe(false)
    expect(lib.includes("from './schedule-conflicts'")).toBe(false)
    expect(lib).toContain("import {\n  tedenskiEkipaPregled,\n  tedenskiEkipaPdfSklep,\n} from './tedenski-vozni-red-ekipa-pdf'")
    expect(lib).toContain("from './tedenski-vozni-red-pdf'")
    expect(lib).not.toContain('export function tedenskiEkipaPregled')
    expect(lib).not.toContain('export function tedenskiEkipaPdfSklep')
    expect(lib).not.toContain("export function tedenskiDanIme")
    // NIČ lastnega FNV/sol (CSV nima fileId-ja — brez dvojnega determinizma)
    expect(lib.includes('fnv1a')).toBe(false)
  })

  it('REALNIM logistics-tab: pill (testid + aria + definicijski naslov + disabled guard) + handler + WYSIWYG toast + legenda + EN now', () => {
    expect(komponenta.includes("from '@/lib/tedenski-vozni-red-ekipa-csv'")).toBe(true)
    expect(komponenta.includes('tedenskiEkipaCsv(')).toBe(true)
    expect(komponenta.includes('tedenskiEkipaCsvFilename')).toBe(true)
    expect(komponenta.includes('handleTedenskiEkipaCsv')).toBe(true)
    expect(komponenta.includes('ekipaCsvVTeku')).toBe(true)
    expect(komponenta.includes('data-testid="ekipe-csv-pill"')).toBe(true)
    expect(komponenta.includes('disabled={ekipaCsvVTeku}')).toBe(true)
    expect(komponenta.includes('Ekipe CSV')).toBe(true)
    expect(komponenta.includes('Tedenski vozni red po ekipah kot CSV')).toBe(true)
    expect(komponenta.includes('Tedenski vozni red po ekipah prenešen v CSV')).toBe(true)
    expect(komponenta.includes('Izvoz CSV po ekipah ni uspel')).toBe(true)
    expect(komponenta.includes('CSV po ekipah se izvozi, ko je vpisan termin')).toBe(true)
    expect(komponenta.includes('CSV po ekipah se izvozi, ko ima ekipa vpisan termin')).toBe(true)
    expect(komponenta.includes('Excel filtriranje po ekipi')).toBe(true)
    expect(komponenta.includes('const now = tedenskiRazgledNow')).toBe(true)
  })
})
