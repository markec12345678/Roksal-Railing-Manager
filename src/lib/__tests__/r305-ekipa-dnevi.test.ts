// ---------------------------------------------------------------------------
// R305 — TEDENSKI PREGLED PO DNEVIH Z EKIPAMI (35. člen 'izvozi' družine,
// P1, bralni ZASLONSKI član) — testi. Pregrupacijski dokazi (7 dni = okno
// VERBATIM EN VIR; vrstice = ekipa ASC × ohranjen pregledov sort; prazni
// dnevi VIDNI — kanon R292; preklicani ŠTETI) + determinizem (razgled
// f(pregled), pregled kanon f(množica) — premešan vhod = ISTI razgled) +
// EN VIR dokazi (sklep UVOŽEN tedenskiEkipaPdfSklep R303 — PETI potrošnik
// ENEGA niza) + DOMAIN pravilo (brez-ekipe NISO vrstice — princip
// R299/R303/R304; pregled null NI vhod) + fail-closed (pokvaren pregled ×6)
// + STRAŽAR klientske čistosti + REALNIM logistics-tab (memo EN VIR + zaslon
// + prazna/sklep veja + preklicani rdeči).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { tedenskiEkipaDanRazgled } from '../tedenski-ekipa-dnevi'
import {
  tedenskiEkipaPregled,
  tedenskiEkipaPdfSklep,
  type TedenskiEkipaPregled,
} from '../tedenski-vozni-red-ekipa-pdf'
import { tedenskiDanIme } from '../tedenski-vozni-red-pdf'
import { vozniRedCasOkno } from '../logistika-vozni-red-pdf'
import { SCHEDULE_TERMINI_STATUS_LABELS } from '../termini-prikaz'
import type { VozniRedTermin } from '../logistika-vozni-red-pdf'

/** UTC referenčni trenutek — okno = 2026-09-21 .. 2026-09-27 (danes + 6, UTC).
 *  ISTA resnica kot R303/R304 brat testi (ENA družinska resnica). */
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

/** Ekipa Alfa: 2 termini v oknu (EN VIR bratov — ISTI vzorec kot R303/R304). */
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

/** EN VIR pregled (R303) — vhod razgleda (NIČ drugega). */
const pregledOsnova = (): TedenskiEkipaPregled => tedenskiEkipaPregled(osnova(), NOW_UTC)!

/** Pokvaren pregled — tampered kopija osnove (fail-closed dokazi). */
function pokvaren(over: Partial<TedenskiEkipaPregled>): TedenskiEkipaPregled {
  return { ...pregledOsnova(), ...over }
}

const lib = readFileSync(resolve(__dirname, '../tedenski-ekipa-dnevi.ts'), 'utf8')
const komponenta = readFileSync(resolve(__dirname, '../../components/roksal/logistics-tab.tsx'), 'utf8')

describe('R305 — dnevna pregrupacija (EN VIR okno + ohranjen sort + prazni dnevi vidni)', () => {
  it('dnevi = pregled.okno VERBATIM ×7 ASC (EN VIR — NIČ drugega okna); ime = uvožen tedenskiDanIme (fiksni slovenski seznam)', () => {
    const pregled = pregledOsnova()
    const razgled = tedenskiEkipaDanRazgled(pregled)
    expect(razgled.dnevi).toHaveLength(7)
    expect(razgled.dnevi.map((d) => d.dan)).toEqual(pregled.okno)
    expect(razgled.dnevi.map((d) => d.dan)).toEqual([
      '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27',
    ])
    expect(razgled.dnevi.map((d) => d.ime)).toEqual(pregled.okno.map((d) => tedenskiDanIme(d)))
    expect(razgled.dnevi[1]!.ime).toBe('Torek') // fiksni slovenski seznam R256 — pasovno varno
  })

  it('vrstice = pregrupacija pregleda: vsak termin pade NATANKO v svoj dan (ekipa VERBATIM + termin = pregledov normaliziran zapisa — NIČ pretvorbe vira)', () => {
    const pregled = pregledOsnova()
    const razgled = tedenskiEkipaDanRazgled(pregled)
    const poDanu = new Map(razgled.dnevi.map((d) => [d.dan, d]))
    expect(poDanu.get('2026-09-22')!.vrstice.map((v) => v.ekipa)).toEqual(['Ekipa Alfa'])
    expect(poDanu.get('2026-09-22')!.vrstice[0]!.termin).toEqual(pregled.skupine[0]!.termini[0]) // pregledov normaliziran zapisa — EN VIR
    expect(poDanu.get('2026-09-23')!.vrstice.map((v) => v.ekipa)).toEqual(['Ekipa Beta'])
    expect(poDanu.get('2026-09-24')!.vrstice.map((v) => v.ekipa)).toEqual(['Ekipa Alfa'])
    expect(poDanu.get('2026-09-25')!.vrstice.map((v) => v.ekipa)).toEqual(['Ekipa Beta'])
  })

  it('števci: terminov per dan + preklicani per dan; terminovSkupaj = pregled.terminovVEkipah; preklicaniSkupaj = pregled.preklicanih (iskren odpad)', () => {
    const pregled = pregledOsnova()
    const razgled = tedenskiEkipaDanRazgled(pregled)
    expect(razgled.dnevi.find((d) => d.dan === '2026-09-23')).toMatchObject({ terminov: 1, preklicani: 1 })
    expect(razgled.dnevi.find((d) => d.dan === '2026-09-22')).toMatchObject({ terminov: 1, preklicani: 0 })
    expect(razgled.terminovSkupaj).toBe(pregled.terminovVEkipah)
    expect(razgled.terminovSkupaj).toBe(4)
    expect(razgled.preklicaniSkupaj).toBe(pregled.preklicanih)
    expect(razgled.preklicaniSkupaj).toBe(1)
  })

  it('prazni dnevi VIDNI (nikoli skriti — kanon R292): 09-21/26/27 = terminov 0 + preklicani 0 + vrstice []', () => {
    const razgled = tedenskiEkipaDanRazgled(pregledOsnova())
    for (const dan of ['2026-09-21', '2026-09-26', '2026-09-27']) {
      const d = razgled.dnevi.find((x) => x.dan === dan)!
      expect(d.terminov).toBe(0)
      expect(d.preklicani).toBe(0)
      expect(d.vrstice).toEqual([])
    }
  })

  it('determinizem: isti pregled = ISTI razgled; PREMEŠAN vhod (pregled kanon f(množica)) = ISTI razgled — f(pregled), ne f(vrstni red odgovora)', () => {
    const razgledA = tedenskiEkipaDanRazgled(pregledOsnova())
    expect(tedenskiEkipaDanRazgled(pregledOsnova())).toEqual(razgledA)
    const premesan = tedenskiEkipaPregled([...osnova()].reverse(), NOW_UTC)!
    expect(tedenskiEkipaDanRazgled(premesan)).toEqual(razgledA)
  })

  it('čas znotraj vrstice = uvožen vozniRedCasOkno R255 + status label VERBATIM (preklicana vrstica OSTANE vidna)', () => {
    const razgled = tedenskiEkipaDanRazgled(pregledOsnova())
    const preklicana = razgled.dnevi.find((d) => d.dan === '2026-09-23')!.vrstice[0]!
    expect(vozniRedCasOkno(preklicana.termin)).toBe('10:00–14:00')
    expect(SCHEDULE_TERMINI_STATUS_LABELS[preklicana.termin.status]).toBe(SCHEDULE_TERMINI_STATUS_LABELS.PREKlicANO)
    expect(preklicana.termin.status).toBe('PREKlicANO')
  })
})

describe('R305 — EN VIR sklep (PETI potrošnik ENEGA niza — WYSIWYG po konstrukciji)', () => {
  it('sklep = tedenskiEkipaPdfSklep(pregled) IDENTIČNO (PDF sklep + PDF/toast + CSV meta + CSV/toast → ZASLON)', () => {
    const pregled = pregledOsnova()
    const razgled = tedenskiEkipaDanRazgled(pregled)
    expect(razgled.sklep).toBe(tedenskiEkipaPdfSklep(pregled))
    expect(razgled.sklep).toBe('Ekip: 2 · terminov po ekipah: 4 · 16 načrtovanih ur · preklicanih 1')
  })

  it('particija dokaz: vsota dnevih × ekip pokrije NATANKO pregled skupine terminov (dan × ekipa — NIČ podvojenega, NIČ izgubljenega)', () => {
    const pregled = pregledOsnova()
    const razgled = tedenskiEkipaDanRazgled(pregled)
    const razgledPar = razgled.dnevi.flatMap((d) => d.vrstice.map((v) => `${v.ekipa}|${v.termin.datumZacetka}`))
    const pregledPar = pregled.skupine.flatMap((s) => s.termini.map((t) => `${s.ekipa}|${t.datumZacetka}`))
    expect([...razgledPar].sort()).toEqual([...pregledPar].sort())
    expect(razgledPar).toHaveLength(pregledPar.length)
  })
})

describe('R305 DOMAIN pravilo — brez-ekipe NISO vrstice (princip R299/R303/R304) + pregled null NI vhod', () => {
  it('termin brez ekipe v oknu: NI vrstica (vsota dnevih = terminovVEkipah, NE terminovSkupaj); NI tiho izgubljen (sklep nosi iskren števec)', () => {
    const pregled = tedenskiEkipaPregled([...ekipaAlfa(), brezEkipeTermin()], NOW_UTC)!
    expect(pregled.brezEkipe).toBe(1)
    const razgled = tedenskiEkipaDanRazgled(pregled)
    expect(razgled.terminovSkupaj).toBe(pregled.terminovVEkipah)
    expect(razgled.terminovSkupaj).toBe(2)
    expect(razgled.dnevi.flatMap((d) => d.vrstice).every((v) => v.ekipa === 'Ekipa Alfa')).toBe(true)
    expect(razgled.sklep).toContain('brez ekipe: 1 (brez sekcije)') // vidni odpad — EN VIR sklep
  })

  it('pregled null (0 ekip — samo brez-ekipe / prazno okno) NI vhod liba → TypeError (komponenta ima ISKREN prazen pogled PREJ — particija dokaz)', () => {
    expect(tedenskiEkipaPregled([brezEkipeTermin()], NOW_UTC)).toBeNull()
    expect(() => tedenskiEkipaDanRazgled(null as unknown as TedenskiEkipaPregled)).toThrow(TypeError)
    expect(() => tedenskiEkipaDanRazgled(null as unknown as TedenskiEkipaPregled)).toThrow(/pričakovan pregled/)
  })
})

describe('R305 fail-closed (družinska pravila — pokvaren pregled, abort ne lažna resnica)', () => {
  it('ne-objekt / ne-polje okno / prazno okno / ne-polje skupine → TypeError ×4', () => {
    expect(() => tedenskiEkipaDanRazgled('ne-objekt' as unknown as TedenskiEkipaPregled)).toThrow(TypeError)
    expect(() => tedenskiEkipaDanRazgled(pokvaren({ okno: [] }))).toThrow(/okno mora biti ne-prazno polje/)
    expect(() => tedenskiEkipaDanRazgled(pokvaren({ okno: 'ne-polje' as unknown as string[] }))).toThrow(TypeError)
    expect(() => tedenskiEkipaDanRazgled(pokvaren({ skupine: 'ne-polje' as unknown as TedenskiEkipaPregled['skupine'] }))).toThrow(/skupine mora biti polje/)
  })

  it('pokvarjena ekipa sekcija (ne-objekt / brez ekipa / brez termini) → TypeError', () => {
    expect(() => tedenskiEkipaDanRazgled(pokvaren({ skupine: [null as unknown as TedenskiEkipaPregled['skupine'][number]] }))).toThrow(TypeError)
    expect(() => tedenskiEkipaDanRazgled(pokvaren({ skupine: [{ ekipa: 42 as unknown as string, termini: [] } as unknown as TedenskiEkipaPregled['skupine'][number]] }))).toThrow(TypeError)
    expect(() => tedenskiEkipaDanRazgled(pokvaren({ skupine: [{ ekipa: 'Ekipa Alfa', termini: 'ne-polje' as unknown as VozniRedTermin[] } as unknown as TedenskiEkipaPregled['skupine'][number]] }))).toThrow(TypeError)
  })

  it('termin izven okna pregleda (particija kršena) → TypeError z ekipa + dan krivca', () => {
    const pregled = pregledOsnova()
    const pokvarenPregled: TedenskiEkipaPregled = {
      ...pregled,
      skupine: pregled.skupine.map((s, i) =>
        i === 0
          ? { ...s, termini: [...s.termini, termin({ datumZacetka: '2026-09-28T08:00:00Z', ekipa: 'Ekipa Alfa' })] }
          : s,
      ),
      terminovVEkipah: pregled.terminovVEkipah + 1, // dosleden števec — okno gate pade PREJ
    }
    expect(() => tedenskiEkipaDanRazgled(pokvarenPregled)).toThrow(/izven okna pregleda/)
    expect(() => tedenskiEkipaDanRazgled(pokvarenPregled)).toThrow(/Ekipa Alfa/)
    expect(() => tedenskiEkipaDanRazgled(pokvarenPregled)).toThrow(/2026-09-28/)
  })

  it('neusklajena particija (vsota dnevih ≠ terminovVEkipah) → TypeError; neusklajeni preklicani (vsota ≠ preklicanih) → TypeError', () => {
    expect(() => tedenskiEkipaDanRazgled(pokvaren({ terminovVEkipah: 5 }))).toThrow(/particija dnevov/)
    expect(() => tedenskiEkipaDanRazgled(pokvaren({ preklicanih: 2 }))).toThrow(/preklicani/)
  })
})

describe('R305 STRAŽAR ×2', () => {
  it('klientska čistost: lib NE uvaža @/lib/db + NE strežniške domene + EN VIR uvoz (sklep+pregled iz R303 brata, Dan ime iz R256) + NIČ lastnega sorta/ure/FNV (ČISTA pregrupacija)', () => {
    expect(lib.includes('@/lib/db')).toBe(false)
    expect(lib.includes("from './schedule-conflicts'")).toBe(false)
    expect(lib).toContain("import { tedenskiDanIme } from './tedenski-vozni-red-pdf'")
    expect(lib).toContain("from './tedenski-vozni-red-ekipa-pdf'")
    expect(lib).not.toContain('export function tedenskiEkipaPdfSklep')
    expect(lib).not.toContain('export function tedenskiDanIme')
    expect(lib).not.toContain('export function tedenskiEkipaPregled')
    // ČISTA pregrupacija: NIČ lastnega sorta (ohranjen pregledov), NIČ lastne ure, NIČ FNV (zaslon nima datoteke)
    expect(lib.includes('.sort(')).toBe(false)
    expect(lib.includes('new Date(')).toBe(false)
    expect(lib.includes('fnv1a')).toBe(false)
    expect(lib.includes('fnv')).toBe(false)
  })

  it('REALNIM logistics-tab: memo EN VIR (izpeljan IZ memo ekipaPregled — NIČ drugega vhoda) + zaslon blok (testid + aria + definicijski naslov pravila + prazna/sklep veja) + preklicani rdeči + null guard', () => {
    expect(komponenta.includes("from '@/lib/tedenski-ekipa-dnevi'")).toBe(true)
    expect(komponenta.includes('tedenskiEkipaDanRazgled(ekipaPregled)')).toBe(true)
    expect(komponenta.includes('data-testid="tedenski-ekipa-dnevi"')).toBe(true)
    expect(komponenta.includes('data-testid="tedenski-ekipa-dnevi-prazno"')).toBe(true)
    expect(komponenta.includes('data-testid="tedenski-ekipa-dnevi-sklep"')).toBe(true)
    expect(komponenta.includes('aria-label="Teden po dnevih in ekipah — naslednjih 7 dni"')).toBe(true)
    expect(komponenta.includes('Teden po dnevih in ekipah')).toBe(true)
    expect(komponenta.includes('ISTI pregled in vrstni red kot Ekipe PDF in Ekipe CSV')).toBe(true) // definicijski naslov izreče PRAVILA
    expect(komponenta.includes('prazni dnevi vidni')).toBe(true)
    expect(komponenta.includes('Brez ekip z termini v okviru')).toBe(true) // iskrena praznina — particija dokaz
    expect(komponenta.includes("razgled.pov !== null && (")).toBe(true) // null guard
    expect(komponenta.includes("d.preklicani > 0 ? 'text-roksal-red'")).toBe(true) // preklicani rdeči bold — pariteta PDF R303
    expect(komponenta.includes("d.terminov === 0 ? '—'")).toBe(true) // prazen dan — iskren '—'
  })
})
