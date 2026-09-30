// ---------------------------------------------------------------------------
// R303 — VODJA TEDENSKI VOZNI RED PO EKIPAH PDF (33. člen 'izvozi' družine,
// P1) — testi. Bajtni dokazi (determinizem: enak vhod = bajtno enak PDF;
// PREMEŠAN VRSTNI RED = bajtno ENAK — pregled kanon f(množica); %PDF- magija;
// NOV glifni razred — R249 doktrina; soli 0xbd–0xc0 UNIKATNE) + DOMAIN pravilo
// (0 ekip NI vhod — mirror R299; brez-ekipe iskren števec) + fail-closed +
// EN VIR dokazi (ekipa seznam UVOŽEN iz R299; okno/povzetek/ureKpi UVOŽENI iz
// R256; sklep EN VIR) + STRAŽAR klientske čistosti + REALNIM logistics-tab
// (pill + guard + handler + legenda).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildTedenskiEkipaPdfDoc,
  generateTedenskiEkipaPdf,
  tedenskiEkipaPdfFilename,
  tedenskiEkipaPregled,
  tedenskiEkipaPdfSklep,
} from '../tedenski-vozni-red-ekipa-pdf'
import { tedenskiEkipaImena } from '../tedenski-vozni-red-ekipa-ics'
import {
  buildTedenskiVozniRedPdfDoc,
  tedenskiPregledPovzetek,
  tedenskiVozniRedPdfFilename,
} from '../tedenski-vozni-red-pdf'
import { buildKonfliktiPdfDoc } from '../konflikti-pdf'
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

/** Ekipa Alfa: 2 termini v oknu (EN VIR bratov — ISTI vzorec kot R302). */
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

/** Termin BREZ ekipe v oknu (iskren brez-ekipe števec — NI sekcija). */
function brezEkipeTermin(): VozniRedTermin {
  return termin({ datumZacetka: '2026-09-22T14:00:00Z', datumKonca: '2026-09-22T16:00:00Z', projekt: 'Projekt E' })
}

function zgradi(vnosi: readonly VozniRedTermin[] = [...ekipaAlfa(), ...ekipaBeta()], now: Date = NOW_UTC): Buffer {
  const doc = buildTedenskiEkipaPdfDoc(vnosi, { now })
  return Buffer.from(doc.output('arraybuffer'))
}

const lib = readFileSync(resolve(__dirname, '../tedenski-vozni-red-ekipa-pdf.ts'), 'utf8')
const komponenta = readFileSync(resolve(__dirname, '../../components/roksal/logistics-tab.tsx'), 'utf8')

describe('R303 — PDF bajtni dokazi (determinizem + glifni razred — R249 doktrina)', () => {
  it('determinizem: enak vhod = bajtno enak; PREMEŠAN VRSTNI RED = bajtno ENAK (pregled kanon f(množica)); drug now = drugačen', () => {
    const vnosi = [...ekipaAlfa(), ...ekipaBeta()]
    expect(zgradi(vnosi).equals(zgradi(vnosi))).toBe(true)
    expect(zgradi([...vnosi].reverse()).equals(zgradi(vnosi))).toBe(true)
    expect(zgradi(vnosi, new Date('2026-09-21T10:01:00.000Z')).equals(zgradi(vnosi))).toBe(false)
  })

  it('%PDF- magija + NOV glifni razred (≠ dveh znanih bratov R256/R302 — zgrajenih ŽIVO na ISTEM now) + ime Tedenski-po-ekipah-YYYY-MM-DD.pdf', () => {
    const bin = zgradi()
    expect(bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    const brat256 = Buffer.from(
      buildTedenskiVozniRedPdfDoc(ekipaAlfa(), { now: NOW_UTC }).output('arraybuffer'),
    )
    const brat302 = Buffer.from(
      buildKonfliktiPdfDoc(
        [
          termin({ datumZacetka: '2026-09-22T08:00:00Z', datumKonca: '2026-09-22T12:00:00Z', ekipa: 'Ekipa Alfa' }),
          termin({ datumZacetka: '2026-09-22T10:00:00Z', datumKonca: '2026-09-22T14:00:00Z', ekipa: 'Ekipa Alfa', status: 'V_TEKU' }),
        ],
        { now: NOW_UTC },
      ).output('arraybuffer'),
    )
    expect(bin.length).not.toBe(brat256.length)
    expect(bin.length).not.toBe(brat302.length)
    expect(tedenskiEkipaPdfFilename(NOW_UTC)).toBe('Tedenski-po-ekipah-2026-09-21.pdf')
    // brat R256 ima svoje ime (EN VIR dnevna resnica — vsak svoj vzorec)
    expect(tedenskiVozniRedPdfFilename(NOW_UTC)).toBe('Tedenski-vozni-red-2026-09-21.pdf')
  })

  it('soli 0xbd–0xc0 — UNIKATNE v družini (register: konflikti 0xb9–0xbc — bratje NE delijo semen)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0xbd)')
    expect(lib).toContain('fnv1aHex(seed, 0xc0)')
    expect(lib).not.toContain('fnv1aHex(seed, 0xb9)')
    expect(lib).not.toContain('fnv1aHex(seed, 0xb5)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x78)')
  })

  it('setCreationDate + setFileId determinizem: različen pregled = različen fileId seed (druga ekipa → drugačen bajtni odtis)', () => {
    const en = zgradi(ekipaAlfa())
    const dva = zgradi([...ekipaAlfa(), ...ekipaBeta()])
    expect(en.equals(dva)).toBe(false)
    expect(lib).toContain('doc.setCreationDate(now)')
    expect(lib).toContain('doc.setFileId(')
  })
})

describe('R303 — EN VIR resnice (ekipa seznam iz R299 + okno/povzetek iz R256 — nič dvojnega)', () => {
  it('pregled EN VIR: dve ekipi → 2 skupini ASC UTF-16; filter TOČEN (samo termini te ekipe v oknu); pov = uvožen tedenskiPregledPovzetek', () => {
    const vnosi = [...ekipaAlfa(), ...ekipaBeta()]
    const pregled = tedenskiEkipaPregled(vnosi, NOW_UTC)!
    expect(pregled.skupine.map((s) => s.ekipa)).toEqual(['Ekipa Alfa', 'Ekipa Beta'])
    expect(pregled.skupine[0]!.termini).toHaveLength(2)
    expect(pregled.skupine[0]!.termini.every((t) => t.ekipa === 'Ekipa Alfa')).toBe(true)
    expect(pregled.skupine[0]!.pov).toEqual(tedenskiPregledPovzetek(ekipaAlfa(), NOW_UTC))
    expect(pregled.skupine[1]!.pov).toEqual(tedenskiPregledPovzetek(ekipaBeta(), NOW_UTC))
    // ISTI ekipa seznam kot R299 brat (EN VIR dokaz)
    expect(pregled.skupine.map((s) => s.ekipa)).toEqual(tedenskiEkipaImena(vnosi, NOW_UTC))
  })

  it('iskren brez-ekipe števec: termin brez ekipe NI sekcija, ampak NI tiho izgubljen (brezEkipe + terminovSkupaj particija okna)', () => {
    const vnosi = [...ekipaAlfa(), brezEkipeTermin()]
    const pregled = tedenskiEkipaPregled(vnosi, NOW_UTC)!
    expect(pregled.skupine).toHaveLength(1)
    expect(pregled.brezEkipe).toBe(1)
    expect(pregled.terminovVEkipah).toBe(2)
    expect(pregled.terminovSkupaj).toBe(3)
    expect(pregled.terminovSkupaj).toBe(pregled.terminovVEkipah + pregled.brezEkipe)
    // sklep izreče iskren števec (vidni odpad — NIKOLI utišan)
    expect(tedenskiEkipaPdfSklep(pregled)).toContain('brez ekipe: 1 (brez sekcije)')
  })

  it('termini IZVEN okna izključeni (danes+7 ven — ISTA UTC aritmetika kot bratje); preklicani ostanejo VIDNI (iskren odpad R256)', () => {
    const vnosi = [
      ...ekipaAlfa(),
      termin({ datumZacetka: '2026-09-28T08:00:00Z', ekipa: 'Ekipa Alfa', projekt: 'Izven okna' }),
      termin({ datumZacetka: '2026-09-20T08:00:00Z', ekipa: 'Ekipa Alfa', projekt: 'Pretekli' }),
    ]
    const pregled = tedenskiEkipaPregled(vnosi, NOW_UTC)!
    expect(pregled.skupine[0]!.termini).toHaveLength(2)
    expect(pregled.terminovSkupaj).toBe(2)
    const preklicani = tedenskiEkipaPregled(
      [termin({ datumZacetka: '2026-09-22T08:00:00Z', ekipa: 'Ekipa Gamma', status: 'PREKlicANO' })],
      NOW_UTC,
    )!
    expect(preklicani.skupine).toHaveLength(1)
    expect(preklicani.preklicanih).toBe(1)
    expect(tedenskiEkipaPdfSklep(preklicani)).toContain('preklicanih 1')
  })

  it('okno + povzetek + ureKpi UVOŽENI iz R256 (lib NE redefinira — tedenska družina NE more divergirati)', () => {
    expect(lib).toContain("from './tedenski-vozni-red-pdf'")
    expect(lib).toContain('tedenskiOknoDnevi,')
    expect(lib).toContain('tedenskiPregledPovzetek,')
    expect(lib).toContain('tedenskiUreKpi,')
    expect(lib).not.toContain('export function tedenskiOknoDnevi')
    expect(lib).not.toContain('export function tedenskiPregledPovzetek')
    expect(lib).not.toContain("export const TEDEN_DNEVI")
  })

  it('sklep EN VIR: tedenskiEkipaPdfSklep = ISTO besedilo v PDF sklepni vrstici IN toastu (dva potrošnika ENEGA niza)', () => {
    const pregled = tedenskiEkipaPregled([...ekipaAlfa(), ...ekipaBeta()], NOW_UTC)!
    expect(tedenskiEkipaPdfSklep(pregled)).toBe(
      'Ekip: 2 · terminov po ekipah: 4 · 16 načrtovanih ur · preklicanih 1',
    )
    expect(lib).toContain('doc.text(tedenskiEkipaPdfSklep(pregled), 14, y + 4)')
    expect(lib).not.toContain("'Ekip: ${") // NI lastnega dvojnega niza v PDF
    // '≥' meja — uvožen tedenskiUreKpi kontrakt (brez ure = spodnja meja)
    const brezUre = tedenskiEkipaPregled(
      [termin({ datumZacetka: '2026-09-22T08:00:00Z', ekipa: 'Ekipa Alfa' })],
      NOW_UTC,
    )!
    expect(tedenskiEkipaPdfSklep(brezUre)).toContain('≥ 0 načrtovanih ur (1 brez ure)')
  })
})

describe('R303 DOMAIN pravilo — 0 ekip NI vhod (fail-closed mirror R299)', () => {
  it('prazno okno → pregled null + TypeError z razlogom (ni prazne datoteke)', () => {
    expect(tedenskiEkipaPregled([], NOW_UTC)).toBeNull()
    expect(() => buildTedenskiEkipaPdfDoc([], { now: NOW_UTC })).toThrow(TypeError)
    expect(() => buildTedenskiEkipaPdfDoc([], { now: NOW_UTC })).toThrow(/ni ekip z termini/)
  })

  it('samo termini brez ekipe v oknu → TypeError (ekipa \u2014\u2019 ne obstaja — ISTI princip kot R299 čipi)', () => {
    const vnosi = [brezEkipeTermin()]
    expect(tedenskiEkipaPregled(vnosi, NOW_UTC)).toBeNull()
    expect(() => buildTedenskiEkipaPdfDoc(vnosi, { now: NOW_UTC })).toThrow(/ni ekip z termini/)
  })

  it('termini IZVEN okna ne ustvarijo ekip (okno = danes..danes+6 UTC) → TypeError', () => {
    const vnosi = [termin({ datumZacetka: '2026-09-28T08:00:00Z', ekipa: 'Ekipa Alfa' })]
    expect(tedenskiEkipaImena(vnosi, NOW_UTC)).toEqual([])
    expect(() => buildTedenskiEkipaPdfDoc(vnosi, { now: NOW_UTC })).toThrow(/ni ekip z termini/)
  })
})

describe('R303 fail-closed (družinska pravila)', () => {
  it('pokvaren now → TypeError (build / pregled / filename — F4)', () => {
    const vnosi = ekipaAlfa()
    expect(() => buildTedenskiEkipaPdfDoc(vnosi, { now: new Date('ne-date') })).toThrow(TypeError)
    expect(() => buildTedenskiEkipaPdfDoc(vnosi, { now: '2026-09-21' as unknown as Date })).toThrow(TypeError)
    expect(() => buildTedenskiEkipaPdfDoc(vnosi, {} as never)).toThrow(TypeError)
    expect(() => tedenskiEkipaPregled(vnosi, new Date('ne-date'))).toThrow(TypeError)
    expect(() => tedenskiEkipaPdfFilename(new Date('ne-date'))).toThrow(TypeError)
  })

  it('ne-polje → TypeError (nikoli tiho spregledano)', () => {
    expect(() => buildTedenskiEkipaPdfDoc(null as unknown as readonly VozniRedTermin[], { now: NOW_UTC })).toThrow(TypeError)
    expect(() => tedenskiEkipaPregled('ne-polje' as unknown as readonly VozniRedTermin[], NOW_UTC)).toThrow(TypeError)
  })

  it('pokvaren vnos → TypeError z indeksom krivca (uvožen pregled R299 — ENA preverba)', () => {
    const vnosi = [
      ...ekipaAlfa(),
      termin({ datumZacetka: '2026-09-23T08:00:00Z', ekipa: 'Ekipa Alfa', status: 'NEZNAN' as unknown as VozniRedTermin['status'] }),
    ]
    expect(() => tedenskiEkipaPregled(vnosi, NOW_UTC)).toThrow(/\(2\)/)
    expect(() => buildTedenskiEkipaPdfDoc(vnosi, { now: NOW_UTC })).toThrow(/\(2\)/)
  })

  it('generateTedenskiEkipaPdf = build + save (dokaz vira — obstaja in je vezan na EN now)', () => {
    expect(typeof generateTedenskiEkipaPdf).toBe('function')
    expect(lib).toContain('doc.save(tedenskiEkipaPdfFilename(options.now))')
  })
})

describe('R303 STRAŽAR ×2', () => {
  it('klientska čistost: lib NE uvaža @/lib/db + NE strežniške domene + EN VIR uvoz iz R299/R256 bratov', () => {
    expect(lib.includes('@/lib/db')).toBe(false)
    expect(lib.includes("from './schedule-conflicts'")).toBe(false)
    expect(lib.includes("from './tedenski-vozni-red-ekipa-ics'")).toBe(true)
    expect(lib).toContain("import { tedenskiEkipaImena } from './tedenski-vozni-red-ekipa-ics'")
    expect(lib.includes("from './tedenski-vozni-red-pdf'")).toBe(true)
  })

  it('REALNIM logistics-tab: pill (testid + label + definicijski naslov + disabled guard) + handler + WYSIWYG toast + legenda + EN now', () => {
    expect(komponenta.includes("from '@/lib/tedenski-vozni-red-ekipa-pdf'")).toBe(true)
    expect(komponenta.includes('generateTedenskiEkipaPdf')).toBe(true)
    expect(komponenta.includes('tedenskiEkipaPdfFilename')).toBe(true)
    expect(komponenta.includes('tedenskiEkipaPdfSklep')).toBe(true)
    expect(komponenta.includes('handleTedenskiEkipaPdf')).toBe(true)
    expect(komponenta.includes('ekipaPdfVTeku')).toBe(true)
    expect(komponenta.includes('data-testid="ekipe-pdf-pill"')).toBe(true)
    expect(komponenta.includes('disabled={ekipaPdfVTeku}')).toBe(true)
    expect(komponenta.includes('Ekipe PDF')).toBe(true)
    expect(komponenta.includes('Tedenski vozni red po ekipah kot PDF')).toBe(true)
    expect(komponenta.includes('Tedenski vozni red po ekipah prenešen')).toBe(true)
    expect(komponenta.includes('Ni ekip z termini v naslednjih 7 dneh')).toBe(true)
    expect(komponenta.includes('Ekipe PDF = ENA sekcija na ekipo')).toBe(true)
    expect(komponenta.includes('const now = tedenskiRazgledNow')).toBe(true)
  })
})
