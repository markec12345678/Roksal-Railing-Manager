// ---------------------------------------------------------------------------
// R292 — TEDENSKI VOZNI RED CSV (23. člen 'izvozi' družine) + TEDENSKI
// RAZGLED strip (MANDATORY STIL) — testi + strazar.
//
// Lib: CSV brat PDF R256 — WYSIWYG po konstrukciji (vse primitivne izpeljave
// UVOŽENE iz PDF brata: okno, ime dneva, validacija, sort, vsote, '≥'
// signal, sklanjatev, datum izpis). Fail-closed z indeksom krivca;
// determinizem = now KOT parameter, f(množica) — premešan vhod = bajtno
// ISTI CSV (ISTI red kot PDF sekcije).
//
// Strazar: logistics-tab žičenje — gumb VEDNO viden (pariteta PDF brata),
// fail-closed toast pri praznem oknu (NIČ datoteke), uspešni toast = ISTI
// lib sklep (WYSIWYG), razgled strip žetoni (0 novih hex — baseline),
// legenda PREDPONA (R255/R256 resnica bajtno ohranjena).
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  TEDENSKI_VOZNI_RED_CSV_GLAVA,
  tedenskiRazgled,
  tedenskiRazgledSklep,
  tedenskiVozniRedCsv,
  tedenskiVozniRedCsvFilename,
  tedenskiVozniRedCsvVrstice,
  type TedenskiRazgled,
} from '../tedenski-vozni-red-csv'
import {
  sortirajVozniRed,
  vozniRedCasOkno,
  type VozniRedTermin,
} from '../logistika-vozni-red-pdf'
import { SCHEDULE_TERMINI_STATUS_LABELS } from '../termini-prikaz'

// UTC-constructed now (ISTI vzorec kot r256 testi — okno bere UTC dele).
// 2026-09-28 je PONEDELJEK; okno = 2026-09-28..2026-10-04.
const ZDANJ: Date = new Date('2026-09-28T15:00:00.000Z')
const OKNO = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']

// ISTA resnica terminov kot r256 (WYSIWYG dokaz čez brata — ISTI vhod v
// OBE liba): t1 danes V_TEKU, t2 +2 NAVRTENO null-konec, t3 včeraj ven,
// t4 +3 PREKlicANO brez ure + null projekt, t5 danes+6 23:59 = ZADNJI
// trenutek okna, t6 danes+7 ven.
const TERMINI: VozniRedTermin[] = [
  {
    datumZacetka: '2026-09-28T07:00:00.000Z',
    datumKonca: '2026-09-28T15:30:00.000Z',
    status: 'V_TEKU',
    predvideneUre: 8,
    projekt: 'ŠČŽ Balkon — Kranj',
    stranka: 'ŠČŽ Gradnja d.o.o.',
    ekipa: 'Ekipa A',
    lokacija: 'Cesta Republike 14, Kranj',
  },
  {
    datumZacetka: '2026-09-30T08:00:00.000Z',
    datumKonca: null,
    status: 'NAVRTENO',
    predvideneUre: 6,
    projekt: 'Alu ograja — Ljubljana',
    stranka: 'Alu Center d.o.o.',
    ekipa: null,
    lokacija: null,
  },
  {
    datumZacetka: '2026-09-25T09:00:00.000Z', // včeraj — ZUNAJ okna
    datumKonca: '2026-09-25T13:00:00.000Z',
    status: 'ZAKLJUCENO',
    predvideneUre: 4,
    projekt: 'Balustrada — Bled',
    stranka: 'Bratovšina Kovač s.p.',
    ekipa: 'Ekipa B',
    lokacija: 'Kranjska 12, Bled',
  },
  {
    datumZacetka: '2026-10-01T07:30:00.000Z',
    datumKonca: '2026-10-01T15:30:00.000Z',
    status: 'PREKlicANO',
    predvideneUre: null,
    projekt: null,
    stranka: 'Alu Center d.o.o.',
    ekipa: 'Ekipa A',
    lokacija: null,
  },
  {
    datumZacetka: '2026-10-04T23:59:00.000Z', // danes+6 23:59 UTC — ZADNJI trenutek okna
    datumKonca: null,
    status: 'V_TEKU',
    predvideneUre: 5,
    projekt: 'Terasa — Bovec',
    stranka: 'Posebnež d.o.o.',
    ekipa: 'Ekipa C',
    lokacija: 'Trg 1, Bovec',
  },
  {
    datumZacetka: '2026-10-05T00:00:00.000Z', // danes+7 — ZUNAJ okna
    datumKonca: null,
    status: 'NAVRTENO',
    predvideneUre: 7,
    projekt: 'Nova ograja — Celje',
    stranka: 'Celje Gradnje d.o.o.',
    ekipa: 'Ekipa A',
    lokacija: null,
  },
]

/** Podatkovne vrstice brez meta (za čitljive trditve). */
function podatkovne(vnosi: readonly VozniRedTermin[] = TERMINI, now: Date = ZDANJ): string[][] {
  const vse = tedenskiVozniRedCsvVrstice(vnosi, now)
  const prviMeta = vse.indexOf('')
  return vse.slice(1, prviMeta).map((l) => {
    // preprost CSV rez (citirane celice — ŠČŽ vrednosti NE vsebujejo narekovajev)
    return l.slice(1, -1).split('","')
  })
}

describe('R292 — tedenski-vozni-red-csv lib (EN VIR + WYSIWYG po konstrukciji)', () => {
  it('glava: 9 stolpcev dobesedno (PDF stolpci + Dan/Dan v tednu)', () => {
    expect(TEDENSKI_VOZNI_RED_CSV_GLAVA).toEqual([
      'Dan', 'Dan v tednu', 'Čas', 'Projekt', 'Stranka', 'Ekipa', 'Status', 'Ure', 'Lokacija',
    ])
    const vse = tedenskiVozniRedCsvVrstice(TERMINI, ZDANJ)
    expect(vse[0]).toBe(TEDENSKI_VOZNI_RED_CSV_GLAVA.map((c) => `"${c}"`).join(','))
  })

  it('okno rez = PDF okno: danes+6 23:59 noter, danes+7 ven, včeraj ven (uvoženo tedenskiOknoDnevi)', () => {
    const d = podatkovne()
    const dani = [...new Set(d.map((r) => r[0]))]
    expect(dani).toEqual(['2026-09-28', '2026-09-30', '2026-10-01', '2026-10-04'])
    expect(dani).not.toContain('2026-09-25') // včeraj
    expect(dani).not.toContain('2026-10-05') // danes+7
  })

  it('vrstni red: dnevi = okno ASC (lib NE preureja okna), znotraj dneva sortirajVozniRed (UVOŽEN)', () => {
    const razgled = tedenskiRazgled(TERMINI, ZDANJ)
    expect(razgled.dnevi.map((x) => x.dan)).toEqual(OKNO)
    for (const de of razgled.dnevi) {
      expect(de.vrstice).toEqual(sortirajVozniRed(de.vrstice))
    }
    // istonaslovna izenačba: t1 (07:00) pred katerim koli kasnejšim istega dne
    const danes = podatkovne().filter((r) => r[0] === '2026-09-28')
    expect(danes[0][2]).toBe('07:00–15:30')
  })

  it('resnica vrstice: status VERBATIM label, null → \'—\' (iskrena manjkajoča resnica, NIKOLI 0)', () => {
    const d = podatkovne()
    const t4 = d.find((r) => r[0] === '2026-10-01')!
    expect(t4[6]).toBe(SCHEDULE_TERMINI_STATUS_LABELS.PREKlicANO)
    expect(t4[3]).toBe('—') // null projekt
    expect(t4[7]).toBe('—') // null ure (R168 — NIKOLI izmišljena 0)
    const t2 = d.find((r) => r[0] === '2026-09-30')!
    expect(t2[5]).toBe('—') // null ekipa
    expect(t2[8]).toBe('—') // null lokacija
    expect(t2[4]).toBe('Alu Center d.o.o.') // stranka je znana — resnica
    expect(t2[6]).toBe(SCHEDULE_TERMINI_STATUS_LABELS.NAVRTENO)
  })

  it('čas = vozniRedCasOkno (EN VIR — brez konca samo Od, s koncem Od–Do)', () => {
    const d = podatkovne()
    const t2 = d.find((r) => r[0] === '2026-09-30')!
    expect(t2[2]).toBe(vozniRedCasOkno({ datumZacetka: '2026-09-30T08:00:00.000Z', datumKonca: null }))
    expect(t2[2]).toBe('08:00')
    const t4 = d.find((r) => r[0] === '2026-10-01')!
    expect(t4[2]).toBe('07:30–15:30')
  })

  it('format: BOM + \'\\n\' zaključki + brez CR (vzorec R186/R285/R286/R291)', () => {
    const { csv, vrstic } = tedenskiVozniRedCsv(TERMINI, ZDANJ)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).not.toContain('\r')
    const lines = csv.slice(1).split('\n')
    expect(lines[lines.length - 1]).not.toBe('') // '\n' zaključki — brez prazne zadnje
    // 1 glava + 4 podatkovne + 1 ločilna + 4 meta (Obseg/Dni/Terminov/Ure) + 1 pogojna Brez ure? ne: brezUre=1 → pogojna + pogojna Preklicani + Izvoženo ob
    expect(vrstic).toBe(lines.length)
  })

  it('meta vrstice (kanon R172/R291): Obseg okno (cenikDatumIso EN VIR) + Dni z delom + Terminov + Načrtovane ure (uvoženi tedenskiPregledPovzetek)', () => {
    const vse = tedenskiVozniRedCsvVrstice(TERMINI, ZDANJ)
    const meta = vse.slice(vse.indexOf(''))
    expect(meta.some((l) => l.includes('"Obseg","Naslednjih 7 dni: 28.09.2026 – 04.10.2026 (danes + 6 dni, UTC)"'))).toBe(true)
    expect(meta.some((l) => l.includes('"Dni z delom","4"'))).toBe(true)
    expect(meta.some((l) => l.includes('"Terminov","4"'))).toBe(true)
    // 8 + 6 + 5 = 19 ur, t4 brez ure izključena → tedenskiUreKpi uvožen: '≥ 19' (iskren ≥ signal)
    expect(meta.some((l) => l.includes('"Načrtovane ure","≥ 19"'))).toBe(true)
  })

  it('pogojne meta vrstice samo pri > 0 (Brez ure, Preklicani) — iskren odpad, PDF RED pariteta', () => {
    const vse = tedenskiVozniRedCsvVrstice(TERMINI, ZDANJ)
    expect(vse.some((l) => l.includes('"Brez ure (izključene iz vsote)","1"'))).toBe(true)
    expect(vse.some((l) => l.includes('"Preklicani (viden odpad)","1"'))).toBe(true)
    // brez preklicanih/brez ure → pogojne vrstice NISO prisotne
    const brezOdpada = tedenskiVozniRedCsvVrstice(
      TERMINI.filter((t) => t.status !== 'PREKlicANO'),
      ZDANJ,
    )
    expect(brezOdpada.some((l) => l.includes('Brez ure'))).toBe(false)
    expect(brezOdpada.some((l) => l.includes('Preklicani'))).toBe(false)
  })

  it('Izvoženo ob = kanonični ISO 8601 iz now (vzorec R286/R291)', () => {
    const vse = tedenskiVozniRedCsvVrstice(TERMINI, ZDANJ)
    expect(vse.some((l) => l.includes('"Izvoženo ob","2026-09-28T15:00:00.000Z"'))).toBe(true)
  })

  it('PRAZNO OKNO = veljaven CSV (glava + meta z iskrnimi ničlami — brez lažnih 0-vrstic; komponenta NEOBJAVLJA datoteke)', () => {
    const ven = TERMINI.filter((t) => !OKNO.includes(t.datumZacetka.slice(0, 10)))
    const { csv } = tedenskiVozniRedCsv(ven, ZDANJ)
    const lines = csv.slice(1).split('\n')
    expect(lines[0]).toBe(TEDENSKI_VOZNI_RED_CSV_GLAVA.map((c) => `"${c}"`).join(','))
    expect(lines.some((l) => l.includes('"Dni z delom","0"'))).toBe(true)
    expect(lines.some((l) => l.includes('"Terminov","0"'))).toBe(true)
    expect(lines.some((l) => l.includes('"Načrtovane ure","0"'))).toBe(true)
    expect(lines.some((l) => l.includes('Brez ure'))).toBe(false)
    expect(lines.some((l) => l.includes('Preklicani'))).toBe(false)
    // brez podatkovnih vrstic (glava → ločilna direktno)
    expect(lines[1]).toBe('')
  })

  it('determinizem: isti vhod + isti now = bajtno identičen; drug now = drugačen (žig + okno)', () => {
    const a = tedenskiVozniRedCsv(TERMINI, ZDANJ).csv
    const b = tedenskiVozniRedCsv(TERMINI, ZDANJ).csv
    expect(a).toBe(b)
    const jutri = tedenskiVozniRedCsv(TERMINI, new Date('2026-09-29T15:00:00.000Z')).csv
    expect(jutri).not.toBe(a)
  })

  it('f(množica): premešan vhod = bajtno ISTI CSV (sortirajVozniRed UVOŽEN — R248/R250/R252/R253 vzorec)', () => {
    const premesan = [...TERMINI].reverse()
    expect(tedenskiVozniRedCsv(premesan, ZDANJ).csv).toBe(tedenskiVozniRedCsv(TERMINI, ZDANJ).csv)
  })

  it('tedenskiRazgled: VSEH 7 dni (prazni = 0 — iskrena resnica razgleda) + maxTerminov merilo + preklicani števec', () => {
    const razgled: TedenskiRazgled = tedenskiRazgled(TERMINI, ZDANJ)
    expect(razgled.okno).toEqual(OKNO)
    expect(razgled.dnevi).toHaveLength(7)
    const t1 = razgled.dnevi.find((d) => d.dan === '2026-09-28')!
    expect(t1.terminov).toBe(1)
    expect(t1.preklicani).toBe(0)
    expect(t1.ime).toBe('Ponedeljek') // uvoženo tedenskiDanIme — fiksni seznam
    const t4 = razgled.dnevi.find((d) => d.dan === '2026-10-01')!
    expect(t4.preklicani).toBe(1)
    const t3 = razgled.dnevi.find((d) => d.dan === '2026-09-29')!
    expect(t3.terminov).toBe(0) // iskreno prazen dan
    expect(t3.vrstice).toEqual([])
    expect(razgled.maxTerminov).toBe(1)
    expect(razgled.pov).not.toBeNull()
    expect(razgled.pov!.terminovN).toBe(4)
  })

  it('tedenskiRazgledSklep: sklanjatev EN VIR (terminBeseda R168) + ≥ signal + pogojni deli (WYSIWYG z razgledom IN toastom)', () => {
    // ≥ signal: t4 brez ure → '≥ 19 h'; 4 različna dneva (28/30/01/04) → '4 dni z delom'
    const sk = tedenskiRazgledSklep(tedenskiRazgled(TERMINI, ZDANJ).pov!)
    expect(sk).toBe('4 dni z delom · 4 termini · ≥ 19 h · 1 brez ure · preklicanih 1')
    // sklanjatev: 1 termin / 2 termina / 3-4 termini / 5+ terminov
    const baza: Array<[number, string]> = [[1, '1 termin'], [2, '2 termina'], [3, '3 termini'], [5, '5 terminov']]
    for (const [n, pričakovano] of baza) {
      const pov = { dniN: 1, terminovN: n, nacrtovaneUre: 4, brezUre: 0, preklicanih: 0 }
      expect(tedenskiRazgledSklep(pov)).toContain(pričakovano)
      expect(tedenskiRazgledSklep(pov)).not.toContain('brez ure')
      expect(tedenskiRazgledSklep(pov)).not.toContain('preklicanih')
    }
  })

  it('fail-closed: ne-polje / pokvaren vnos z indeksom krivca / neznan status / pokvaren now (×3 vrstice) — TypeError', () => {
    expect(() => tedenskiRazgled(null as unknown as VozniRedTermin[], ZDANJ)).toThrow(TypeError)
    expect(() => tedenskiRazgled('ne' as unknown as VozniRedTermin[], ZDANJ)).toThrow(TypeError)
    // pokvaren vnos na indeksu 2 (uvožen preveriVozniRedTermin — indeks krivca VEDNO v sporočilu)
    const pokvaren = [...TERMINI]
    pokvaren[2] = { ...pokvaren[2], datumZacetka: 'ni-iso' } as unknown as VozniRedTermin
    expect(() => tedenskiRazgled(pokvaren, ZDANJ)).toThrow(/preveriVozniRedTermin \(2\)/)
    // pokvaren vnos ZUNAJ okna je VSEEN pokvaren vir — NIKOLI tiho spregledan
    const pokvarenVen = [{ ...TERMINI[5], status: 'NEZNAN' } as unknown as VozniRedTermin]
    expect(() => tedenskiRazgled(pokvarenVen, ZDANJ)).toThrow(/status/)
    expect(() => tedenskiVozniRedCsvVrstice(TERMINI, 'ni-date' as unknown as Date)).toThrow(TypeError)
    expect(() => tedenskiVozniRedCsv(TERMINI, Number.NaN as unknown as Date)).toThrow(TypeError)
    expect(() => tedenskiVozniRedCsvFilename(Number.NaN as unknown as Date)).toThrow(TypeError)
  })

  it('filename = Tedenski-vozni-red-<YYYY-MM-DD>.csv (družinski vzorec, brat PDF imena R256)', () => {
    expect(tedenskiVozniRedCsvFilename(ZDANJ)).toBe('Tedenski-vozni-red-2026-09-28.csv')
  })
})

// ---------------------------------------------------------------------------
// STRAŽAR — logistics-tab žičenje (statika)
// ---------------------------------------------------------------------------

const log = readFileSync(join(process.cwd(), 'src', 'components', 'roksal', 'logistics-tab.tsx'), 'utf8')
const csvLib = readFileSync(join(process.cwd(), 'src', 'lib', 'tedenski-vozni-red-csv.ts'), 'utf8')
const pdfLib = readFileSync(join(process.cwd(), 'src', 'lib', 'tedenski-vozni-red-pdf.ts'), 'utf8')

describe('R292 strazar — tedenski CSV + razgled žičenje (logistics-tab)', () => {
  it('EN VIR: uvozi tedenskiRazgled/tedenskiRazgledSklep/tedenskiVozniRedCsv/Filename iz NOVEGA liba + cenikDatumIso; lib uvaža primitivne iz PDF brata (nič dvojnega)', () => {
    expect(log).toContain("from '@/lib/tedenski-vozni-red-csv'")
    expect(log).toContain('tedenskiRazgled(')
    expect(log).toContain('cenikDatumIso')
    expect(csvLib).toContain("from './tedenski-vozni-red-pdf'")
    expect(csvLib).toContain('tedenskiOknoDnevi')
    expect(csvLib).toContain('tedenskiDanIme')
    expect(csvLib).toContain('tedenskiPregledPovzetek')
    expect(csvLib).toContain('tedenskiUreKpi')
    expect(csvLib).toContain("from './logistika-vozni-red-pdf'")
    expect(csvLib).toContain('preveriVozniRedTermin')
    expect(csvLib).toContain('sortirajVozniRed')
    expect(csvLib).toContain('vozniRedCasOkno')
    expect(csvLib).toContain("from './termini-prikaz'")
    expect(csvLib).toContain('SCHEDULE_TERMINI_STATUS_LABELS')
    expect(csvLib).toContain('terminBeseda')
    // PDF brat NE uvaža CSV liba (sorojenci čisti — bratje vzorec r256)
    expect(pdfLib).not.toContain('tedenski-vozni-red-csv')
  })

  it('gumb VEDNO viden: aria + title + press-scale + focus ring + FileSpreadsheet aria-hidden + dvoklik guard (pariteta ptVTeku/ocVTeku)', () => {
    expect(log).toContain('aria-label="Izvozi tedenski pregled montaž kot CSV"')
    expect(log).toContain('Tedenski pregled montaž kot CSV — ista resnica kot PDF (dnevi · termini · ure)')
    const pil = log.slice(log.indexOf('Izvozi tedenski pregled montaž kot CSV'), log.indexOf('<FileSpreadsheet aria-hidden="true" className="h-4 w-4 mr-1" /> CSV'))
    expect(pil).toContain('press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40')
    expect(pil).toContain('disabled={tedenskiCsvVTeku}')
    expect(log).toContain('FileSpreadsheet aria-hidden="true" className="h-4 w-4 mr-1" /> CSV')
    // r256 kontrakt: disabled={schedules.length === 0} ostane NATANČNO 2 (CSV/ICS)
    expect(log.match(/disabled=\{schedules\.length === 0\}/g)).toHaveLength(2)
  })

  it('fail-closed PREJ: prazno okno → iskren toast, NIKOLI prazna datoteka (R250/R291 vzorec) + ENA izpeljava (ISTI now)', () => {
    const klik = log.slice(log.indexOf('const handleTedenskiCsv = () => {'), log.indexOf('const handleTedenskiCsv = () => {') + 1400)
    const prazen = klik.indexOf('tedenskiPregledPovzetek(vozniRedVnosi, now)')
    const csvKlic = klik.indexOf('tedenskiVozniRedCsv(vozniRedVnosi, now)')
    expect(prazen).toBeGreaterThan(-1)
    expect(csvKlic).toBeGreaterThan(prazen)
    expect(klik).toContain("title: 'Ni terminov v naslednjih 7 dneh'")
    expect(klik).toContain('CSV se izvozi, ko je vpisan termin v prihajajočem tednu.')
    expect(klik).toContain("const now = new Date()")
  })

  it('uspešni toast = ISTI lib sklep (tedenskiRazgledSklep — WYSIWYG z razgledom) + fail-verbose catch (R291 vzorec)', () => {
    expect(log).toContain('Tedenski pregled prenešen v CSV (${ime})')
    expect(log).toContain('${tedenskiRazgledSklep(pov)}.')
    expect(log).toContain("title: 'Izvoz CSV ni uspel'")
    expect(log).toContain("if (tedenskiCsvVTeku) return")
  })

  it('MANDATORY STIL razgled: aria regija + 7 dni grid + mini tir žetoni (R291 vzorec) + aria-hidden + % title izpeljava + iskrena praznina', () => {
    expect(log).toContain('aria-label="Tedenski razgled — naslednjih 7 dni"')
    expect(log).toContain('Naslednjih 7 dni brez vpisanih terminov.')
    expect(log).toContain('% najbolj obremenjenega dne')
    expect(log).toContain('razgled.maxTerminov === 0')
    expect(log).toContain('h-1 rounded-full bg-muted')
    expect(log).toContain('bg-roksal-navy/30')
    expect(log).toContain('d.ime.slice(0, 3)')
    expect(log).toContain('text-roksal-red') // preklicani iskren odpad (obstoječi žeton — R257)
    expect(log).toContain('grid grid-cols-7 gap-1')
  })

  it('legenda: R255/R256 resnica bajtno ISTA (PREDPONA) + R292 pripona', () => {
    expect(log).toContain('CSV = prikazani termini · ICS = koledar v telefonu · PDF = vozni red (kronološki) · Tedenski = naslednjih 7 dni (po dnevih)')
    expect(log).toContain('· Tedenski CSV = ista resnica kot PDF')
  })

  it('hex baseline logistics-tab ostaja 1 (0 novih hex — samo žetoni)', () => {
    const hexi = log.match(/#[0-9a-fA-F]{6}/g) ?? []
    expect(hexi).toHaveLength(1)
  })
})
