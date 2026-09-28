// ---------------------------------------------------------------------------
// R255 — VOZNI RED MONTAŽ PDF (11. člen 'izvozi' družine, P1-f) — testi.
// Bajtni dokazi (determinizem: enak vhod = bajtno enak PDF; PREMEŠAN VRSTNI
// RED = bajtno ENAK — sort interno, f(množica); %PDF- magija; glifni razred
// minute — R249 doktrina) + vsebinski dokazi na VIRU liba in komponente
// (PDF content stream je fontno kodiran — izvleka teksta iz bajtov NI
// resnična).
// WYSIWYG dokazi: vir = ISTI normalizirani termini kot seznam
// (normalizirajTermin — EN VIR RESNICE); status = VERBATIM iz API-ja (5
// znanih — EN VIR z SCHEDULE_TERMINI_STATUSI); ure = ISTI '≥' signal kot
// povzetek na zaslonu (brez ure = null, NIKOLI izmišljen 0 — R168);
// null imena = iskrena '—' resnica (NIKOLI izmišljeni podatki).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildVozniRedPdfDoc,
  preveriVozniRedTermin,
  sortirajVozniRed,
  vozniRedCas,
  vozniRedCasOkno,
  vozniRedPovzetek,
  vozniRedPdfFilename,
  vozniRedUreKpi,
  type VozniRedTermin,
} from '@/lib/logistika-vozni-red-pdf'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

// okno med dvema markerjema (r207/…/r253 vzorec)
function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  const b = src.indexOf(do_, a)
  if (a === -1 || b === -1) return ''
  return src.slice(a, b)
}

const lib = beri('src/lib/logistika-vozni-red-pdf.ts')
const komponenta = beri('src/components/roksal/logistics-tab.tsx')
const koledarLib = beri('src/lib/koledar-pregledov-pdf.ts')
const terminiLib = beri('src/lib/termini-prikaz.ts')

const ZDANJ: Date = new Date(2026, 8, 28, 15, 0, 0) // fiksen vhod — determinizem

// 4 termini: V_TEKU + NAVRTENO + ZAKLJUČENO + PREKLIČANO (iskrena resnica —
// preklicani VIDNO na vozno redu); ena vrstica brez ure (R168 null), brez
// ekipe/lokacije (null → '—') in brez projekta (null → '—' + sortira ZADNJI).
// ŠČŽ niz za fontni dokaz.
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
    ekipa: null, // iskrena '—' resnica (ekipa ni dodeljena)
    lokacija: null,
  },
  {
    datumZacetka: '2026-09-25T09:00:00.000Z',
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
    projekt: null, // iskrena manjkajoča resnica → sortira ZADNJI
    stranka: 'Alu Center d.o.o.',
    ekipa: 'Ekipa A',
    lokacija: null,
  },
]

function zgradi(vnosi: readonly VozniRedTermin[] = TERMINI, now: Date = ZDANJ): Buffer {
  const doc = buildVozniRedPdfDoc(vnosi, { now })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R255 — vozniRedCas + vozniRedCasOkno: UTC rez ISO niza (ISTI vir kot .ics — determinizem čez pasove)', () => {
  it('čas = nizovni rez HH:MM iz ISO (NE toLocaleTimeString — odvisen od časovnega pasu stroja)', () => {
    expect(vozniRedCas('2026-09-28T07:30:00.000Z')).toBe('07:30')
    expect(vozniRedCas('2026-12-31T23:05:00.000Z')).toBe('23:05')
    expect(vozniRedCas('2026-01-01T00:00:00.000Z')).toBe('00:00')
  })

  it('okno: datumKonca ≠ null → Od–Do; null → samo Od (iskrena resnica — NIKOLI izmišljen konec)', () => {
    expect(vozniRedCasOkno(TERMINI[0])).toBe('07:00–15:30')
    expect(vozniRedCasOkno(TERMINI[1])).toBe('08:00')
    expect(vozniRedCasOkno({ datumZacetka: '2026-10-01T07:30:00.000Z', datumKonca: null })).toBe('07:30')
  })
})

describe('R255 — sortirajVozniRed: kronološki red + izenačba + null projekt ZADNJI', () => {
  it('premešan vhod = ISTI sortiran red: datumZacetka ASC, izenačba projekt ASC, null projekt sortira ZADNJI (determinizem = f(množica))', () => {
    const prvic = sortirajVozniRed(TERMINI)
    const drugic = sortirajVozniRed([...TERMINI].reverse())
    expect(prvic.map((t) => t.datumZacetka)).toEqual([
      '2026-09-25T09:00:00.000Z', // ZAKLJUČENO — najstarejši (kronološko prvi)
      '2026-09-28T07:00:00.000Z', // V_TEKU
      '2026-09-30T08:00:00.000Z', // NAVRTENO
      '2026-10-01T07:30:00.000Z', // PREKLIČANO + null projekt — ZADNJI
    ])
    expect(prvic.map((t) => t.projekt)).toEqual([
      'Balustrada — Bled',
      'ŠČŽ Balkon — Kranj',
      'Alu ograja — Ljubljana',
      null,
    ])
    expect(drugic.map((t) => t.datumZacetka)).toEqual(prvic.map((t) => t.datumZacetka))
  })
})

describe('R255 — vozniRedPovzetek + vozniRedUreKpi: ENA resnica za KPI, sklep IN toast', () => {
  it('agregati: ure vsota SAMO po znanih (8+6+4=18, brez-ura izključena — NIKOLI 0), brezUre=1, ekip distinct=2, zaključenih=1; premešan = ISTI povzetek', () => {
    const pov = vozniRedPovzetek(TERMINI)
    expect(pov).toEqual({ terminovN: 4, nacrtovaneUre: 18, brezUre: 1, ekipN: 2, zakljucenih: 1 })
    expect(vozniRedPovzetek([...TERMINI].reverse())).toEqual(pov)
  })

  it('KPI ure: brezUre > 0 → \'≥ 18\' (ISTI \'≥\' signal kot povzetek na zaslonu — vsota je spodnja meja); brezUre = 0 → čista vsota', () => {
    expect(vozniRedUreKpi(vozniRedPovzetek(TERMINI))).toBe('≥ 18')
    expect(vozniRedUreKpi({ terminovN: 2, nacrtovaneUre: 8, brezUre: 0, ekipN: 1, zakljucenih: 0 })).toBe('8')
  })

  it('fail-closed: prazen vozni red ne nastaja dokumenta (TypeError — komponenta pokaže iskren toast)', () => {
    expect(() => vozniRedPovzetek([])).toThrow(TypeError)
    expect(() => vozniRedPovzetek([])).toThrow('prazen vozni red nima terminov')
  })
})

describe('R255 — preveriVozniRedTermin: fail-closed z indeksom krivca (družina R236/R250–R253)', () => {
  it('neznan status → TypeError (VERBATIM 5 znanih — EN VIR z SCHEDULE_TERMINI_STATUSI)', () => {
    const zrusen = { ...TERMINI[0], status: 'PAKETNO' as unknown as VozniRedTermin['status'] }
    expect(() => preveriVozniRedTermin(zrusen, 3)).toThrow(TypeError)
    expect(() => preveriVozniRedTermin(zrusen, 3)).toThrow('(3)')
    expect(() => preveriVozniRedTermin(zrusen, 3)).toThrow('VERBATIM iz API-ja')
  })

  it('ne-ISO datumZacetka / datumKonca → TypeError (rez časa potrebuje obliko YYYY-MM-DDTHH:MM)', () => {
    expect(() => preveriVozniRedTermin({ ...TERMINI[0], datumZacetka: '28. 9. 2026' }, 0)).toThrow(TypeError)
    expect(() => preveriVozniRedTermin({ ...TERMINI[0], datumKonca: 'jutri' }, 1)).toThrow(TypeError)
    // null konec je VELJAVEN (iskrena resnica)
    expect(() => preveriVozniRedTermin({ ...TERMINI[1] }, 2)).not.toThrow()
  })

  it('pokvarena ura → TypeError; null ura = VELJAVNA (R168 brez-ure resnica — NIKOLI izmišljen 0)', () => {
    expect(() => preveriVozniRedTermin({ ...TERMINI[0], predvideneUre: -2 }, 0)).toThrow(TypeError)
    expect(() => preveriVozniRedTermin({ ...TERMINI[0], predvideneUre: 4.5 }, 0)).toThrow(TypeError)
    expect(() => preveriVozniRedTermin({ ...TERMINI[0], predvideneUre: 'osem' as unknown as number }, 0)).toThrow(TypeError)
    expect(() => preveriVozniRedTermin({ ...TERMINI[3] }, 0)).not.toThrow() // null ure OK
  })

  it('prazen niz za projekt/stranko/ekipo/lokacijo → TypeError; null = VELJAVEN (iskrena manjkajoča resnica)', () => {
    expect(() => preveriVozniRedTermin({ ...TERMINI[0], projekt: '  ' }, 0)).toThrow(TypeError)
    expect(() => preveriVozniRedTermin({ ...TERMINI[0], ekipa: '' }, 0)).toThrow(TypeError)
    expect(() => preveriVozniRedTermin({ ...TERMINI[1] }, 0)).not.toThrow() // null ekipa/lokacija OK
    expect(() => preveriVozniRedTermin({ ...TERMINI[3] }, 0)).not.toThrow() // null projekt OK
  })

  it('ne-objekt → TypeError z indeksom krivca', () => {
    expect(() => preveriVozniRedTermin(null as unknown as VozniRedTermin, 7)).toThrow(TypeError)
    expect(() => preveriVozniRedTermin(null as unknown as VozniRedTermin, 7)).toThrow('(7)')
  })
})

describe('R255 — PDF bajtni dokazi (determinizem + glifni razred minute — R249 doktrina)', () => {
  it('determinizem: enak vhod = bajtno enak; PREMEŠAN VRSTNI RED = bajtno ENAK (sort interno — f(množica), vzorec R250/R252/R253); drug now = drugačen', () => {
    expect(zgradi().equals(zgradi())).toBe(true)
    expect(zgradi([...TERMINI].reverse()).equals(zgradi(TERMINI))).toBe(true)
    expect(zgradi(TERMINI, ZDANJ).equals(zgradi(TERMINI, new Date(2026, 8, 28, 15, 1, 0)))).toBe(false)
  })

  it('%PDF- magija + NOV glifni razred (≠ vseh 16 znanih družinskih razredov) + ime datoteke Vozni-red-montaz-YYYY-MM-DD.pdf', () => {
    const buf = zgradi()
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
    // znani razredi (16): Osnutek ×4, primerjalni ×5, cenik ×2, prihodki,
    // opomnik ×2 (živi + POTEKEL variant), potekli, koledar — vozni red je
    // NOV dokument
    const znani = [30057, 30119, 30191, 30253, 35565, 38753, 39927, 41519, 42798, 37709, 37771, 36788, 36656, 36532, 33958, 36555]
    expect(znani.includes(buf.length)).toBe(false)
    expect(vozniRedPdfFilename(ZDANJ)).toBe('Vozni-red-montaz-2026-09-28.pdf')
  })

  it('soli 0x71–0x74 — UNIKATNE v družini (isti seed v dveh libih NE sme dati isti ID — register)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0x71)')
    expect(lib).toContain('fnv1aHex(seed, 0x74)')
    // sorojenci NE smejo deliti 0x71–0x74 (koledar 0x6d–0x70 je najbližji brat)
    expect(koledarLib).not.toContain('0x71')
    expect(koledarLib).not.toContain('0x74')
  })
})

describe('R255 — PDF telesu skozi izpeljavo (KPI + tabela + sklep iz ISTEGA vira)', () => {
  it('KPI trio: Terminov < Načrtovane ure (vozniRedUreKpi — \'≥\' signal) < Zaključenih + signal barve (NAVY/AMBER/GREEN — ISTI jezik kot značke na zaslonu; 0 novih hex)', () => {
    const kpi = oknoMed(lib, "kpiBox(doc, 14, y, bw, bh, 'Terminov'", 'y += bh + 8')
    expect(kpi).toContain("'Načrtovane ure'")
    expect(kpi).toContain("'Zaključenih'")
    expect(kpi.indexOf('NAVY')).toBeLessThan(kpi.indexOf('AMBER'))
    expect(kpi.indexOf('AMBER')).toBeLessThan(kpi.indexOf('GREEN'))
    expect(lib).toContain("String(pov.terminovN), NAVY)")
    expect(lib).toContain('vozniRedUreKpi(pov), AMBER)')
    expect(lib).toContain("String(pov.zakljucenih), GREEN)")
  })

  it('tabela 8 stolpcev (Datum, Čas, Projekt, Stranka, Ekipa, Status, Ure, Lokacija) + status WYSIWYG (5 znanih — ISTI signal kot značka) + \'—\' sivo v vseh null stolpcih', () => {
    expect(lib).toContain("['Datum', 'Čas', 'Projekt', 'Stranka', 'Ekipa', 'Status', 'Ure', 'Lokacija']")
    const didParse = oknoMed(lib, 'didParseCell:', 'lastAutoTable')
    expect(didParse).toContain('data.column.index === 5')
    expect(didParse).toContain('SCHEDULE_TERMINI_STATUS_LABELS.V_TEKU')
    expect(didParse).toContain('SCHEDULE_TERMINI_STATUS_LABELS.ZAKLJUCENO')
    expect(didParse).toContain('SCHEDULE_TERMINI_STATUS_LABELS.PREKlicANO')
    expect(didParse).toContain('SCHEDULE_TERMINI_STATUS_LABELS.PRELOZENO')
    expect(didParse).toContain('SCHEDULE_TERMINI_STATUS_LABELS.NAVRTENO')
    expect(didParse).toContain('textColor = RED')
    expect(didParse).toContain('fontStyle = \'bold\'')
    expect(didParse).toContain("=== '—'")
    expect(didParse).toContain('textColor = GRAY')
    // null ure → '—' (NE 0 — R168 resnica); null imena → '—'
    expect(lib).toContain("t.predvideneUre === null ? '—' : String(t.predvideneUre)")
    expect(lib).toContain("t.projekt ?? '—'")
    expect(lib).toContain("t.stranka ?? '—'")
    expect(lib).toContain("t.ekipa ?? '—'")
    expect(lib).toContain("t.lokacija ?? '—'")
  })

  it('status labels = EN VIR RESNICE (import SCHEDULE_TERMINI_STATUS_LABELS — NIČ dvojnih besedil) + glava/sklep/vir resnica', () => {
    expect(lib).toContain("from './termini-prikaz'")
    expect(lib).toContain('SCHEDULE_TERMINI_STATUS_LABELS[t.status]')
    expect(lib).toContain("'VOZNI RED MONTAŽ'")
    expect(lib).toContain('kronološki red (najbližji termin prvi)')
    expect(lib).toContain('vir = vidni termini logistike.')
    // izenačba null projekt ZADNJI — dokumentirana deterministična resnica
    expect(lib).toContain('if (a.projekt === null) return 1')
  })

  it('fail-closed v libu: prazen vozni red ne nastaja dokumenta (TypeError s toast sporočilom komponente)', () => {
    expect(lib).toContain('prazen vozni red ne nastaja dokumenta')
    expect(lib).toContain("(Ni vidnih terminov montaže.)")
    expect(() => buildVozniRedPdfDoc([], { now: ZDANJ })).toThrow(TypeError)
  })
})

describe('R255 — komponenta (logistics-tab): pill + fail-closed toast + EN VIR RESNICE + legenda', () => {
  it('pill: aria + title + VEDNO viden (NI disabled — P1-k precedens R251–R253; CSV/ICS ostaneta z disabled) + press-scale žeton + Truck aria-hidden', () => {
    expect(komponenta).toContain('aria-label="Izvozi vozni red montaž kot PDF"')
    expect(komponenta).toContain('title="Vozni red montaž kot terenski list (kronološki red)"')
    const pil = oknoMed(komponenta, 'Izvozi vozni red montaž kot PDF', '<Truck aria-hidden="true"')
    expect(pil).not.toContain('disabled=')
    expect(pil).toContain('press-scale')
    expect(komponenta).toContain('<Truck aria-hidden="true"')
    // CSV/ICS ostajata z disabled (obstoječi kontrakt — vrstični pregled/koledar):
    // točno 2 pojavitvi v celem tabu (CSV + ICS; PDF jima je edini dodan brez —
    // pil okno zgoraj že dokazuje 'disabled=' ODSOTEN na vozno redu, P1-k)
    expect(komponenta.match(/disabled=\{schedules\.length === 0\}/g)).toHaveLength(2)
  })

  it('fail-closed PREJ, potem izpeljava: prazen seznam → iskren toast (NIKOLI prazna datoteka); agregat v toastu = ISTI lib povzetek kot KPI/sklep (WYSIWYG)', () => {
    const klik = oknoMed(komponenta, 'Izvozi vozni red montaž kot PDF', '</Button>')
    const prazen = klik.indexOf('vozniRedVnosi.length === 0')
    const generiraj = klik.indexOf('generateVozniRedPdf(')
    expect(prazen).toBeGreaterThanOrEqual(0)
    expect(generiraj).toBeGreaterThan(prazen)
    expect(komponenta).toContain("title: 'Ni vidnih terminov montaže'")
    expect(komponenta).toContain('PDF se izvozi, ko je vpisan prvi termin montaže.')
    expect(komponenta).toContain('title: \'Vozni red prenešen v PDF\'')
    expect(komponenta).toContain('vozniRedPovzetek(vozniRedVnosi)')
    expect(komponenta).toContain('vozniRedUreKpi(pov)')
    expect(komponenta).toContain('{ now: new Date() }')
  })

  it('EN VIR RESNICE: vozni red DTO iz ISTEGA normaliziranega vira (urPovzetek.prikazne — normalizirajTermin) + datumKonca po id + legenda izvozne skupine', () => {
    expect(komponenta).toContain('urPovzetek.prikazne.map((v) => {')
    expect(komponenta).toContain('normalizirajTermin')
    expect(komponenta).toContain('CSV = prikazani termini · ICS = koledar v telefonu · PDF = vozni red (kronološki)')
    // press-scale žeton tudi na CSV/ICS (F2 konsistenca izvozne skupine)
    // (unikaten marker = title, NE aria — aria se konča znotraj niza, R252 lekcija)
    const csvPil = oknoMed(komponenta, 'title="Termine kot preglednico (Excel)"', '</Button>')
    expect(csvPil).toContain('press-scale')
    const icsPil = oknoMed(komponenta, 'title="Termine odpri v Google/Apple/Outlook koledarju"', '</Button>')
    expect(icsPil).toContain('press-scale')
  })

  it('bratje čisti: CSV/ICS kontrakt NEspremenjen (glava + meta vrstice R173) + termini-prikaz lib brez vozno reda (ločen dokument)', () => {
    expect(komponenta).toContain("['Datum', 'Od', 'Do', 'Projekt', 'Stranka', 'Ekipa', 'Status', 'Lokacija', 'Ure']")
    expect(komponenta).toContain('export function buildIcs(schedules: Schedule[]): string')
    expect(komponenta).toContain("'BEGIN:VCALENDAR'")
    expect(terminiLib).not.toContain('VozniRedTermin')
    expect(koledarLib).not.toContain('VozniRedTermin')
  })
})

describe('R255 — F2 stil: žetonska migracija to-[#2a3f5f] → to-roksal-navy-soft (EXACT vrednost — NIČ vizualno, 1 arbitrary hex manj)', () => {
  it('gradient žeton: top-bar + floor-plan CardHeader na to-roksal-navy-soft; literal izrinjen; globals.css definira EXACT #2a3f5f', () => {
    const topBar = beri('src/components/roksal/top-bar.tsx')
    const floorPlan = beri('src/components/roksal/floor-plan-tab.tsx')
    const css = beri('src/app/globals.css')
    expect(topBar).toContain('from-roksal-navy to-roksal-navy-soft')
    expect(floorPlan).toContain('from-roksal-navy to-roksal-navy-soft')
    expect(topBar).not.toContain('to-[#2a3f5f]')
    expect(floorPlan).not.toContain('to-[#2a3f5f]')
    expect(css).toContain('--color-roksal-navy-soft: #2a3f5f;')
    // press-scale žeton tudi na CSV/ICS pillih (F2 konsistenca izvozne skupine — dokaz že v komponentnem testu zgoraj)
  })
})
