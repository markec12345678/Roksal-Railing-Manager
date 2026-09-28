// ---------------------------------------------------------------------------
// R256 — TEDENSKI VOZNI RED MONTAŽ PDF (12. člen 'izvozi' družine, P1-f) —
// testi. Bajtni dokazi (determinizem: enak vhod = bajtno enak PDF; PREMEŠAN
// VRSTNI RED = bajtno ENAK — sort interno, f(množica); %PDF- magija; NOV
// glifni razred — R249 doktrina) + okno-resnica (danes..danes+6 UTC —
// determinizem čez pasove) + vsebinski dokazi na VIRU liba in komponente
// (PDF content stream je fontno kodiran — izvleka teksta iz bajtov NI
// resnična). WYSIWYG: vir = ISTI DTO kot vozni red R255 (vozniRedVnosi —
// normalizirajTermin); status = VERBATIM iz API-ja (preveriVozniRedTermin
// re-use — NIČ dvojnega preverjanja); ure = ISTI '≥' signal.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildTedenskiVozniRedPdfDoc,
  tedenskiDanIme,
  tedenskiOknoDnevi,
  tedenskiPregledPovzetek,
  tedenskiUreKpi,
  tedenskiVozniRedPdfFilename,
  type TedenskiPregledPovzetek,
} from '@/lib/tedenski-vozni-red-pdf'
import { vozniRedUreKpi, type VozniRedTermin } from '@/lib/logistika-vozni-red-pdf'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

// okno med dvema markerjema (r207/…/r255 vzorec)
function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  const b = src.indexOf(do_, a)
  if (a === -1 || b === -1) return ''
  return src.slice(a, b)
}

const lib = beri('src/lib/tedenski-vozni-red-pdf.ts')
const komponenta = beri('src/components/roksal/logistics-tab.tsx')
const vozniLib = beri('src/lib/logistika-vozni-red-pdf.ts')
const koledarLib = beri('src/lib/koledar-pregledov-pdf.ts')
const potekliLib = beri('src/lib/potekli-opomniki-pdf.ts')
const terminiLib = beri('src/lib/termini-prikaz.ts')

// UTC-constructed now — okno izpeljava bere UTC dele (getUTCFullYear/Month/
// Date), zato UTC konstrukcija = determinizem neodvisno od časovnega pasu
// testnega stroja. 2026-09-28 je PONEDELJEK.
const ZDANJ: Date = new Date('2026-09-28T15:00:00.000Z')
const OKNO = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']

// 6 terminov: 4 v oknu (t1 danes V_TEKU, t2 +2 NAVRTENO null-konec, t4 +3
// PREKLIČANO brez ure, t5 danes+6 23:59 = ZADNJI trenutek okna) + 2 ven
// (t3 včeraj ZAKLJUČENO, t6 danes+7 00:00 = prvi trenutek VEN). ŠČŽ niz za
// fontni dokaz; null ekipa/lokacija/projekt za '—' resnico.
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
    datumKonca: null, // konec ni vpisan → samo 'Od' v stolpcu Čas
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
    predvideneUre: null, // R168 — brez ure (izključena iz vsote, NIKOLI 0)
    projekt: null, // iskrena manjkajoča resnica
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

function zgradi(vnosi: readonly VozniRedTermin[] = TERMINI, now: Date = ZDANJ): Buffer {
  const doc = buildTedenskiVozniRedPdfDoc(vnosi, { now })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R256 — tedenskiOknoDnevi: 7 dni (danes..danes+6, UTC — determinizem čez pasove)', () => {
  it('okno = 7 ISO datumov ASC, mesec preklop je čista UTC aritmetika (2026-09-28 → …10-04)', () => {
    expect(tedenskiOknoDnevi(ZDANJ)).toEqual(OKNO)
  })

  it('leto preklop (2025-12-30 → 2026-01-05) + fail-closed: neveljaven now → TypeError', () => {
    expect(tedenskiOknoDnevi(new Date('2025-12-30T10:00:00.000Z'))).toEqual([
      '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05',
    ])
    expect(() => tedenskiOknoDnevi(new Date('ne-datumm'))).toThrow(TypeError)
    expect(() => tedenskiOknoDnevi('2026-09-28' as unknown as Date)).toThrow(TypeError)
  })
})

describe('R256 — tedenskiDanIme: fiksni slovenski seznam (NIKOLI toLocaleDateString — determinizem)', () => {
  it('2026-09-28 = Ponedeljek, 2026-10-04 = Nedelja; pokvaren niz → TypeError', () => {
    expect(tedenskiDanIme('2026-09-28')).toBe('Ponedeljek')
    expect(tedenskiDanIme('2026-10-04')).toBe('Nedelja')
    expect(tedenskiDanIme('2026-09-30')).toBe('Sreda')
    expect(() => tedenskiDanIme('28. 9. 2026')).toThrow(TypeError)
    // lib NE uporablja locale-odvisnih APIjev (bajtni determinizem družine)
    expect(lib).not.toContain('toLocaleDateString')
    expect(lib).not.toContain('toLocaleString')
  })
})

describe('R256 — tedenskiPregledPovzetek: okno izpeljava — ENA resnica za KPI, sklep IN toast', () => {
  it('agregati: okno 4 termini / 4 dni / 19 ur / 1 brez ure / 1 preklican; PREMEŠAN = ISTI povzetek (f(množica))', () => {
    const pov = tedenskiPregledPovzetek(TERMINI, ZDANJ)
    expect(pov).toEqual({ dniN: 4, terminovN: 4, nacrtovaneUre: 19, brezUre: 1, preklicanih: 1 })
    expect(tedenskiPregledPovzetek([...TERMINI].reverse(), ZDANJ)).toEqual(pov)
  })

  it('okno roba: danes+6 23:59 NOTER, danes+7 00:00 VEN, včeraj VEN (poimenovana resnica TEDENSKI — ne vsi)', () => {
    const pov = tedenskiPregledPovzetek(TERMINI, ZDANJ)
    expect(pov).not.toBeNull()
    // t3 (včeraj) in t6 (danes+7) nista v oknu — samo t1,t2,t4,t5
    expect(pov!.terminovN).toBe(4)
    // prazno polje ALI vse zunaj okna → null (iskren prazen razgled — toast)
    expect(tedenskiPregledPovzetek([], ZDANJ)).toBeNull()
    expect(tedenskiPregledPovzetek([TERMINI[2], TERMINI[5]], ZDANJ)).toBeNull()
  })

  it('fail-closed: pokvaren datumZacetka → TypeError z indeksom krivca (datum je jedro okna — NIKOLI tiho izpuščen)', () => {
    const zrusen = [{ ...TERMINI[0] }, { ...TERMINI[0], datumZacetka: '28. 9. 2026' } as unknown as VozniRedTermin]
    expect(() => tedenskiPregledPovzetek(zrusen, ZDANJ)).toThrow(TypeError)
    expect(() => tedenskiPregledPovzetek(zrusen, ZDANJ)).toThrow('(1)')
    expect(() => tedenskiPregledPovzetek('ni polje' as unknown as VozniRedTermin[], ZDANJ)).toThrow(TypeError)
  })
})

describe('R256 — tedenskiUreKpi: ISTI \'≥\' javni kontrakt kot vozniRedUreKpi R255', () => {
  it('brezUre > 0 → \'≥ 19\' (vsota je spodnja meja); brezUre = 0 → čista vsota — ISTI signal kot brat', () => {
    const pov = tedenskiPregledPovzetek(TERMINI, ZDANJ)!
    expect(tedenskiUreKpi(pov)).toBe('≥ 19')
    expect(tedenskiUreKpi({ nacrtovaneUre: 21, brezUre: 0 })).toBe('21')
    // javni kontrakt enoten: isti vhod, isti izhod kot vozniRedUreKpi (NIČ dvojnega jezika)
    expect(vozniRedUreKpi({ terminovN: 0, nacrtovaneUre: 19, brezUre: 1, ekipN: 0, zakljucenih: 0 })).toBe('≥ 19')
  })
})

describe('R256 — PDF bajtni dokazi (determinizem + glifni razred minute — R249 doktrina)', () => {
  it('determinizem: enak vhod = bajtno enak; PREMEŠAN VRSTNI RED = bajtno ENAK (sort interno); drug now = drugačen', () => {
    expect(zgradi().equals(zgradi())).toBe(true)
    expect(zgradi([...TERMINI].reverse()).equals(zgradi(TERMINI))).toBe(true)
    expect(zgradi(TERMINI, ZDANJ).equals(zgradi(TERMINI, new Date('2026-09-28T15:01:00.000Z')))).toBe(false)
  })

  it('%PDF- magija + NOV glifni razred (≠ vseh 17 znanih družinskih razredov) + ime Tedenski-vozni-red-YYYY-MM-DD.pdf', () => {
    const buf = zgradi()
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
    // znani razredi (17): Osnutek ×4, primerjalni ×5, cenik ×2, prihodki,
    // opomnik ×2, potekli, koledar, vozni red (38631 R255) — tedenski je NOV
    const znani = [30057, 30119, 30191, 30253, 35565, 38753, 39927, 41519, 42798, 37709, 37771, 36788, 36656, 36532, 33958, 36555, 38631]
    expect(znani.includes(buf.length)).toBe(false)
    expect(tedenskiVozniRedPdfFilename(ZDANJ)).toBe('Tedenski-vozni-red-2026-09-28.pdf')
  })

  it('soli 0x75–0x78 — UNIKATNE v družini (register: vozni red 0x71–0x74, koledar 0x6d–0x70 — bratje NE delijo semen)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0x75)')
    expect(lib).toContain('fnv1aHex(seed, 0x78)')
    // sorojenci NE smejo deliti 0x75–0x78
    expect(vozniLib).not.toContain('0x75')
    expect(vozniLib).not.toContain('0x78')
    expect(koledarLib).not.toContain('0x75')
    expect(potekliLib).not.toContain('0x75')
  })
})

describe('R256 — fail-closed v libu (družina R236/R250–R255)', () => {
  it('prazno okno (prazno polje ALI vse zunaj okna) ne nastaja dokumenta — TypeError s toast sporočilom komponente', () => {
    expect(lib).toContain('prazno okno (naslednjih 7 dni) ne nastaja dokumenta')
    expect(lib).toContain('(Ni terminov v naslednjih 7 dneh.)')
    expect(() => buildTedenskiVozniRedPdfDoc([], { now: ZDANJ })).toThrow(TypeError)
    expect(() => buildTedenskiVozniRedPdfDoc([TERMINI[2], TERMINI[5]], { now: ZDANJ })).toThrow(TypeError)
  })

  it('pokvaren vnos → TypeError z indeksom krivca (preveriVozniRedTermin re-use — VSEH vhodov, ne samo okna)', () => {
    expect(lib).toContain('vnosi.forEach((t, i) => preveriVozniRedTermin(t, i))')
    const zrusen = { ...TERMINI[0], status: 'PAKETNO' as unknown as VozniRedTermin['status'] }
    expect(() => buildTedenskiVozniRedPdfDoc([zrusen], { now: ZDANJ })).toThrow(TypeError)
    expect(() => buildTedenskiVozniRedPdfDoc([zrusen], { now: ZDANJ })).toThrow('VERBATIM iz API-ja')
    // pokvaren vnos ZUNAJ okna = VENAKO pokvaren vir (fail-closed, NIKOLI tiho)
    const zrusenVceraj = { ...TERMINI[2], status: 'PAKETNO' as unknown as VozniRedTermin['status'] }
    expect(() => buildTedenskiVozniRedPdfDoc([zrusenVceraj], { now: ZDANJ })).toThrow(TypeError)
  })

  it('ne-polje / ne-opcije / ne-veljaven now → TypeError (obvezna preverba vhodov — družinski recept)', () => {
    expect(() => buildTedenskiVozniRedPdfDoc('ni polje' as unknown as VozniRedTermin[], { now: ZDANJ })).toThrow(TypeError)
    expect(() => buildTedenskiVozniRedPdfDoc(TERMINI, undefined as unknown as { now: Date })).toThrow(TypeError)
    expect(() => buildTedenskiVozniRedPdfDoc(TERMINI, { now: 'danes' as unknown as Date })).toThrow(TypeError)
  })
})

describe('R256 — PDF telesu skozi izpeljavo (KPI + sekcije + sklep iz ISTEGA vira)', () => {
  it('KPI trio: Terminov < Načrtovane ure (tedenskiUreKpi — \'≥\') < Dni z delom + barvni jezik NAVY/AMBER/GREEN (0 novih hex)', () => {
    const kpi = oknoMed(lib, "kpiBox(doc, 14, y, bw, bh, 'Terminov'", 'y += bh + 8')
    expect(kpi).toContain("'Načrtovane ure'")
    expect(kpi).toContain("'Dni z delom'")
    expect(kpi.indexOf('NAVY')).toBeLessThan(kpi.indexOf('AMBER'))
    expect(kpi.indexOf('AMBER')).toBeLessThan(kpi.indexOf('GREEN'))
    expect(lib).toContain("String(pov.terminovN), NAVY)")
    expect(lib).toContain('tedenskiUreKpi(pov), AMBER)')
    expect(lib).toContain("String(pov.dniN), GREEN)")
  })

  it('sekcije po dnevih: dan ASC kronološki (okno.map — filter na UTC dan), znotraj dneva sortirajVozniRed (re-use R255 — NIČ dvojnega sortiranja) + prelom strani', () => {
    // okno vodi red skupin (danes..danes+6 ASC — kronološki razgled)
    expect(lib).toContain('.map((dan) => [dan, sortirajVozniRed(vnosi.filter((t) => t.datumZacetka.slice(0, 10) === dan))])')
    // sekcija naslov = dan ime + datum + števec (iskrena resnica per dan)
    expect(lib).toContain('tedenskiDanIme(dan)')
    expect(lib).toContain('cenikDatumIso(dan)')
    expect(lib).toContain('${vrstice.length} terminov')
    // prelom strani PRED vsako sekcijo (dolgi tedni — 7 tabel na razgledu)
    expect(lib).toContain('if (y > 240)')
    expect(lib).toContain('doc.addPage()')
  })

  it('tabela 7 stolpcev (Čas, Projekt, Stranka, Ekipa, Status, Ure, Lokacija — Datum v sekciji naslovu) + status WYSIWYG (5 znanih) + \'—\' sivo + null ure \'—\'', () => {
    expect(lib).toContain("head: [['Čas', 'Projekt', 'Stranka', 'Ekipa', 'Status', 'Ure', 'Lokacija']]")
    const didParse = oknoMed(lib, 'didParseCell:', 'lastAutoTable')
    expect(didParse).toContain('data.column.index === 4')
    expect(didParse).toContain('SCHEDULE_TERMINI_STATUS_LABELS.V_TEKU')
    expect(didParse).toContain('SCHEDULE_TERMINI_STATUS_LABELS.ZAKLJUCENO')
    expect(didParse).toContain('SCHEDULE_TERMINI_STATUS_LABELS.PREKlicANO')
    expect(didParse).toContain('SCHEDULE_TERMINI_STATUS_LABELS.PRELOZENO')
    expect(didParse).toContain('SCHEDULE_TERMINI_STATUS_LABELS.NAVRTENO')
    expect(didParse).toContain('textColor = RED')
    expect(didParse).toContain('fontStyle = \'bold\'')
    expect(didParse).toContain("=== '—'")
    expect(didParse).toContain('textColor = GRAY')
    expect(lib).toContain("t.predvideneUre === null ? '—' : String(t.predvideneUre)")
    expect(lib).toContain("t.projekt ?? '—'")
    expect(lib).toContain("t.stranka ?? '—'")
    expect(lib).toContain("t.ekipa ?? '—'")
    expect(lib).toContain("t.lokacija ?? '—'")
  })

  it('EN VIR RESNICE: import brata R255 (preveriVozniRedTermin + sortirajVozniRed + labels + type) — NIČ dvojnih besedil/preverb + glava/sklep/vir resnica', () => {
    expect(lib).toContain("from './logistika-vozni-red-pdf'")
    expect(lib).toContain('preveriVozniRedTermin,')
    expect(lib).toContain('sortirajVozniRed,')
    expect(lib).toContain("import { SCHEDULE_TERMINI_STATUS_LABELS } from './termini-prikaz'")
    expect(lib).toContain('type VozniRedTermin,')
    expect(lib).toContain("'TEDENSKI VOZNI RED MONTAŽ'")
    expect(lib).toContain('okno = danes + 6 dni (UTC)')
    expect(lib).toContain('po dnevih (razgled)')
    expect(lib).toContain('vir = vidni termini logistike.')
  })
})

describe('R256 — komponenta (logistics-tab): pill + fail-closed toast + EN VIR + legenda', () => {
  it('pill: aria + title + VEDNO viden (NI disabled — P1-k precedens; CSV/ICS disabled števec ostaja 2) + press-scale + CalendarRange aria-hidden', () => {
    expect(komponenta).toContain('aria-label="Izvozi tedenski pregled montaž kot PDF"')
    expect(komponenta).toContain('title="Tedenski pregled montaž — naslednjih 7 dni (razgled po dnevih)"')
    const pil = oknoMed(komponenta, 'Izvozi tedenski pregled montaž kot PDF', '<CalendarRange aria-hidden="true"')
    expect(pil).not.toContain('disabled=')
    expect(pil).toContain('press-scale')
    expect(komponenta).toContain('<CalendarRange aria-hidden="true"')
    // CSV/ICS ostajata edina z disabled (obstoječi kontrakt — R255 resnica)
    expect(komponenta.match(/disabled=\{schedules\.length === 0\}/g)).toHaveLength(2)
  })

  it('fail-closed PREJ, potem izpeljava: tedenskiPregledPovzetek === null → iskren toast (NIKOLI prazna datoteka); agregat v toastu = ISTI lib povzetek (WYSIWYG)', () => {
    const klik = oknoMed(komponenta, 'Izvozi tedenski pregled montaž kot PDF', '</Button>')
    const prazen = klik.indexOf('tedenskiPregledPovzetek(vozniRedVnosi, new Date())')
    const generiraj = klik.indexOf('generateTedenskiVozniRedPdf(')
    expect(prazen).toBeGreaterThanOrEqual(0)
    expect(generiraj).toBeGreaterThan(prazen)
    expect(komponenta).toContain("title: 'Ni terminov v naslednjih 7 dneh'")
    expect(komponenta).toContain('Tedenski pregled se izvozi, ko je vpisan termin v prihajajočem tednu.')
    expect(komponenta).toContain('title: \'Tedenski pregled prenešen v PDF\'')
    expect(komponenta).toContain('${pov.dniN} dni, ${pov.terminovN} terminov, ${tedenskiUreKpi(pov)} h.')
    expect(komponenta).toContain('{ now: new Date() }')
  })

  it('legenda: R256 dodan kot PREDPONA — R255 resnica bajtno ISTA (needle dobesedno ohranjen) + ISTI vir DTO (vozniRedVnosi)', () => {
    expect(komponenta).toContain('CSV = prikazani termini · ICS = koledar v telefonu · PDF = vozni red (kronološki) · Tedenski = naslednjih 7 dni (po dnevih)')
    expect(komponenta).toContain('tedenskiPregledPovzetek(vozniRedVnosi, new Date())')
  })

  it('bratje čisti: tedenski NI ponorjen v sorojence (ločen dokument — ločen lib); vozni red R255 lib NE pozna tedenskega', () => {
    expect(vozniLib).not.toContain('Tedenski')
    expect(koledarLib).not.toContain('TedenskiPregled')
    expect(potekliLib).not.toContain('TedenskiPregled')
    expect(terminiLib).not.toContain('TedenskiPregled')
  })
})

describe('R256 — TedenskiPregledPovzetek tip + javna API resnica', () => {
  it('tip nosi 5 iskrenih agregatov (dniN, terminovN, nacrtovaneUre, brezUre, preklicanih) — NIKOLI izmišljenih polj', () => {
    const src = lib
    const iface = oknoMed(src, 'export interface TedenskiPregledPovzetek {', '}')
    for (const polje of ['dniN', 'terminovN', 'nacrtovaneUre', 'brezUre', 'preklicanih']) {
      expect(iface).toContain(polje)
    }
    const vrednosti: TedenskiPregledPovzetek = { dniN: 1, terminovN: 1, nacrtovaneUre: 1, brezUre: 0, preklicanih: 0 }
    expect(vrednosti.dniN).toBe(1)
  })
})
