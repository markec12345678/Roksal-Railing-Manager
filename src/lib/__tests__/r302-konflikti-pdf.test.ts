// ---------------------------------------------------------------------------
// R302 — TEDENSKI KONFLIKTI PDF (32. člen 'izvozi' družine, P1) — testi.
// Bajtni dokazi (determinizem: enak vhod = bajtno enak PDF; PREMEŠAN VRSTNI
// RED = bajtno ENAK — pregled že kanon f(množica); %PDF- magija; NOV glifni
// razred — R249 doktrina; soli 0xb9–0xbc UNIKATNE) + DOMAIN pravilo (0
// konfliktov NI vhod — mirror družine R266/R297/R301) + fail-closed + EN VIR
// dokazi (glava tabele + Sklep UVOŽENA iz CSV brata R301; STRAŽAR klientske
// čistosti) + REALNIM logistics-tab (pill + guard + handler + legenda).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildKonfliktiPdfDoc,
  generateKonfliktiPdf,
  konfliktiPdfFilename,
} from '../konflikti-pdf'
import { tedenskiKonflikti } from '../tedenski-konflikti'
import { KONFLIKTI_CSV_GLAVA, konfliktiSklep } from '../konflikti-csv'
import type { VozniRedTermin } from '../logistika-vozni-red-pdf'
import { buildDobicikonostPdfDoc } from '../dobicikonost-pdf'
import { buildStrankePokritostPdfDoc } from '../stranke-pokritost-pdf'

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
 *  10:00–12:00, dan 2026-09-22 (EN VIR brata R301/R300 — ISTI vzorec). */
function parAlfa(ekipa = 'Ekipa Alfa'): VozniRedTermin[] {
  return [
    termin({ datumZacetka: '2026-09-22T08:00:00Z', datumKonca: '2026-09-22T12:00:00Z', ekipa, projekt: 'Projekt A' }),
    termin({ datumZacetka: '2026-09-22T10:00:00Z', datumKonca: '2026-09-22T14:00:00Z', ekipa, projekt: 'Projekt B', status: 'V_TEKU' }),
  ]
}

/** Drug par druge ekipe (skupine ASC red + pregledanih resnica obsega):
 *  a 09:00–13:00, b 11:00–15:00, c 12:00–16:00 (ISTI dan!) → pari a-b, a-c,
 *  b-c (lekcija R301/R300: pričakovanja IZ koda — c mora OBA prekrivati). */
function parBeta(): VozniRedTermin[] {
  return [
    termin({ datumZacetka: '2026-09-23T09:00:00Z', datumKonca: '2026-09-23T13:00:00Z', ekipa: 'Ekipa Beta', projekt: 'Projekt C', status: 'PRELOZENO' }),
    termin({ datumZacetka: '2026-09-23T11:00:00Z', datumKonca: '2026-09-23T15:00:00Z', ekipa: 'Ekipa Beta', projekt: 'Projekt D' }),
    termin({ datumZacetka: '2026-09-23T12:00:00Z', datumKonca: '2026-09-23T16:00:00Z', ekipa: 'Ekipa Beta', projekt: 'Projekt E' }),
  ]
}

function zgradi(vnosi: readonly VozniRedTermin[] = parAlfa(), now: Date = NOW_UTC): Buffer {
  const doc = buildKonfliktiPdfDoc(vnosi, { now })
  return Buffer.from(doc.output('arraybuffer'))
}

const lib = readFileSync(resolve(__dirname, '../konflikti-pdf.ts'), 'utf8')
const csvLib = readFileSync(resolve(__dirname, '../konflikti-csv.ts'), 'utf8')
const komponenta = readFileSync(resolve(__dirname, '../../components/roksal/logistics-tab.tsx'), 'utf8')

describe('R302 — PDF bajtni dokazi (determinizem + glifni razred — R249 doktrina)', () => {
  it('determinizem: enak vhod = bajtno enak; PREMEŠAN VRSTNI RED = bajtno ENAK (pregled kanon f(množica)); drug now = drugačen', () => {
    expect(zgradi().equals(zgradi())).toBe(true)
    const dvaEkipe = [...parAlfa(), ...parBeta()]
    const preskakljani = zgradi([...dvaEkipe].reverse())
    expect(preskakljani.equals(zgradi(dvaEkipe))).toBe(true)
    expect(zgradi(parAlfa(), new Date('2026-09-21T10:01:00.000Z')).equals(zgradi())).toBe(false)
  })

  it('%PDF- magija + NOV glifni razred (≠ znanih družinskih razredov — dva brata zgrajena ŽIVO) + ime Konflikti-YYYY-MM-DD.pdf', () => {
    const bin = zgradi()
    expect(bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    // NOV glifni razred: dolžina je RAZLIČNA od dveh znanih bratov (isti
    // trenutek now — različna vsebina → različen bajtni odtis).
    const dob = Buffer.from(
      buildDobicikonostPdfDoc(
        [{ stevilka: '2026-001', status: 'IZDAN', znesek: 100 }],
        [{ status: 'PREKlicANO', skupajCena: 0 }],
        { now: NOW_UTC },
      ).output('arraybuffer'),
    )
    const str = Buffer.from(
      buildStrankePokritostPdfDoc(
        [{ id: 's1', ime: 'A', naslov: 'B', status: 'AKTIVEN', kategorija: null, telefon: null, zadnjiKontakt: null, ltv: 1, opomnikStatus: 'NI' }],
        { now: NOW_UTC },
      ).output('arraybuffer'),
    )
    expect(bin.length).not.toBe(dob.length)
    expect(bin.length).not.toBe(str.length)
    expect(konfliktiPdfFilename(NOW_UTC)).toBe('Konflikti-2026-09-21.pdf')
  })

  it('soli 0xb9–0xbc — UNIKATNE v družini (register: terenski-zapisni 0xb5–0xb8 — bratje NE delijo semen)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0xb9)')
    expect(lib).toContain('fnv1aHex(seed, 0xbc)')
    expect(lib).not.toContain('fnv1aHex(seed, 0xb5)')
    expect(lib).not.toContain('fnv1aHex(seed, 0xb1)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x7d)')
  })

  it('setCreationDate + setFileId determinizem: različen pregled = različen fileId seed (drugi par → drugačen bajtni odtis)', () => {
    const en = zgradi(parAlfa())
    const dva = zgradi([...parAlfa(), ...parBeta()])
    expect(en.equals(dva)).toBe(false)
    expect(lib).toContain('doc.setCreationDate(now)')
    expect(lib).toContain('doc.setFileId(')
  })
})

describe('R302 — EN VIR resnice (glava tabele + Sklep iz CSV brata R301 — nič dvojnega)', () => {
  it('pregled = tedenskiKonflikti EN VIR: dve ekipi → 2 skupini, 3 pari (Beta: a-b, a-c, b-c — lekcija R301: b-c mora prekrivati)', () => {
    const pregled = tedenskiKonflikti([...parAlfa(), ...parBeta()], NOW_UTC)
    expect(pregled).not.toBeNull()
    expect(pregled!.skupine.map((s) => s.ekipa)).toEqual(['Ekipa Alfa', 'Ekipa Beta'])
    expect(pregled!.skupine[1]!.pari).toHaveLength(3)
    expect(pregled!.stPrekrivanj).toBe(4)
    expect(pregled!.pregledanih).toBe(5)
  })

  it('glava tabele = KONFLIKTI_CSV_GLAVA UVOŽENA (lib uvaža iz konflikti-csv, NE redefinira — PDF in CSV NE moreta divergirati)', () => {
    expect(lib).toContain("from './konflikti-csv'")
    expect(lib).toContain('KONFLIKTI_CSV_GLAVA, konfliktiSklep')
    expect(lib).not.toContain('export const KONFLIKTI_')
    expect(lib).toContain('head: [[...KONFLIKTI_CSV_GLAVA]]')
  })

  it('Sklep = konfliktiSklep UVOŽEN (ISTO besedilo kot rdeč žig + CSV meta + toast — ŠTIRI potrošniki ENEGA niza)', () => {
    const pregled = tedenskiKonflikti(parAlfa(), NOW_UTC)!
    const sklep = konfliktiSklep(pregled)
    expect(sklep).toBe(
      'Konflikti: 1 · ekipe: Ekipa Alfa — dvojne rezervacije v okviru (poli-odprto pravilo).',
    )
    expect(lib).toContain('konfliktiSklep(pregled)')
    expect(lib).not.toContain("'Konflikti: '") // NI lastnega dvojnega niza
    expect(csvLib).toContain('Konflikti: ${pregled.stPrekrivanj}') // EN VIR ostane v CSV bratu
  })

  it('statusi = SCHEDULE_TERMINI_STATUS_LABELS UVOŽENI (VERBATIM prikaz — par členi so po konstrukciji samo aktivni)', () => {
    expect(lib).toContain("SCHEDULE_TERMINI_STATUS_LABELS[par.a.status]")
    expect(lib).toContain("SCHEDULE_TERMINI_STATUS_LABELS[par.b.status]")
  })
})

describe('R302 DOMAIN pravilo — 0 konfliktov NI vhod (fail-closed mirror R266/R297/R301)', () => {
  it('nazaj-na-nazaj (zelen žig) → TypeError z razlogom (ni prazne datoteke)', () => {
    const vnosi = [
      termin({ datumZacetka: '2026-09-22T08:00:00Z', datumKonca: '2026-09-22T12:00:00Z', ekipa: 'Ekipa Alfa' }),
      termin({ datumZacetka: '2026-09-22T12:00:00Z', datumKonca: '2026-09-22T16:00:00Z', ekipa: 'Ekipa Alfa' }),
    ]
    expect(tedenskiKonflikti(vnosi, NOW_UTC)).toBeNull()
    expect(() => buildKonfliktiPdfDoc(vnosi, { now: NOW_UTC })).toThrow(TypeError)
    expect(() => buildKonfliktiPdfDoc(vnosi, { now: NOW_UTC })).toThrow(/ni dokazanih konfliktov/)
  })

  it('prazno polje → TypeError (tedenskiKonflikti = null iskrena čistost — lib dvakrat brani)', () => {
    expect(() => buildKonfliktiPdfDoc([], { now: NOW_UTC })).toThrow(/ni dokazanih konfliktov/)
  })

  it('PREKlicano ne zasede → brez para → TypeError (zrcalo R142 EN VIR)', () => {
    const vnosi = [
      termin({ datumZacetka: '2026-09-22T08:00:00Z', datumKonca: '2026-09-22T12:00:00Z', ekipa: 'Ekipa Alfa' }),
      termin({ datumZacetka: '2026-09-22T10:00:00Z', datumKonca: '2026-09-22T14:00:00Z', ekipa: 'Ekipa Alfa', status: 'PREKlicANO' }),
    ]
    expect(() => buildKonfliktiPdfDoc(vnosi, { now: NOW_UTC })).toThrow(/ni dokazanih konfliktov/)
  })
})

describe('R302 fail-closed (družinska pravila)', () => {
  it('pokvaren now → TypeError (build / filename — F4)', () => {
    const vnosi = parAlfa()
    expect(() => buildKonfliktiPdfDoc(vnosi, { now: new Date('ne-date') })).toThrow(TypeError)
    expect(() => buildKonfliktiPdfDoc(vnosi, { now: '2026-09-21' as unknown as Date })).toThrow(TypeError)
    expect(() => buildKonfliktiPdfDoc(vnosi, {} as never)).toThrow(TypeError)
    expect(() => konfliktiPdfFilename(new Date('ne-date'))).toThrow(TypeError)
  })

  it('ne-polje → TypeError (nikoli tiho spregledano)', () => {
    expect(() => buildKonfliktiPdfDoc(null as unknown as readonly VozniRedTermin[], { now: NOW_UTC })).toThrow(TypeError)
  })

  it('pokvaren vnos → TypeError z indeksom krivca (uvožen preveriVozniRedTermin — EN VIR brata R300)', () => {
    const vnosi = [
      ...parAlfa(),
      termin({ datumZacetka: '2026-09-23T08:00:00Z', datumKonca: '2026-09-23T12:00:00Z', ekipa: 'Ekipa Alfa', status: 'NEZNAN' as unknown as VozniRedTermin['status'] }),
    ]
    expect(() => buildKonfliktiPdfDoc(vnosi, { now: NOW_UTC })).toThrow(/\(2\)/)
  })

  it('generateKonfliktiPdf = build + save (dokaz vira — obstaja in je vezan na EN now)', () => {
    expect(typeof generateKonfliktiPdf).toBe('function')
    expect(lib).toContain('doc.save(konfliktiPdfFilename(options.now))')
  })
})

describe('R302 STRAŽAR ×2', () => {
  it('klientska čistost: lib NE uvaža @/lib/db + EN VIR uvoz tedenskiKonflikti (NE strežniške domene) + uvoz iz CSV brata', () => {
    expect(lib.includes('@/lib/db')).toBe(false)
    expect(lib.includes("from './tedenski-konflikti'")).toBe(true)
    expect(lib.includes("from './schedule-conflicts'")).toBe(false)
    expect(lib.includes("from './konflikti-csv'")).toBe(true)
  })

  it('REALNIM logistics-tab: pill (testid + label + definicijski naslov + disabled guard) + handler + zelen-žig toast + legenda + EN now', () => {
    expect(komponenta.includes("from '@/lib/konflikti-pdf'")).toBe(true)
    expect(komponenta.includes('generateKonfliktiPdf')).toBe(true)
    expect(komponenta.includes('konfliktiPdfFilename')).toBe(true)
    expect(komponenta.includes('handleKonfliktiPdf')).toBe(true)
    expect(komponenta.includes('data-testid="konflikti-pdf-pill"')).toBe(true)
    expect(komponenta.includes('disabled={konfliktiPdfVTeku}')).toBe(true)
    expect(komponenta.includes('Konflikti PDF')).toBe(true)
    expect(komponenta.includes('Konflikti tedenskega pregleda kot PDF')).toBe(true)
    expect(komponenta.includes('Konflikti prenešeni v PDF')).toBe(true)
    expect(komponenta.includes('Konflikti PDF = isti pregled kot CSV, tisk za pisarno')).toBe(true)
    expect(komponenta.includes('const now = tedenskiRazgledNow')).toBe(true)
  })
})
