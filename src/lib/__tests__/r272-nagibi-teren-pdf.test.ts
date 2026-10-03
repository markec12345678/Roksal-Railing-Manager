// ---------------------------------------------------------------------------
// R272 — NAGIBI — TERENSKI PREGLED PDF (28. člen 'izvozi' družine) — testi.
// Vzorec r271-punch-stanje-pdf / r270-inventura: bajtni dokazi (determinizem
// + glifni razred — R249 doktrina), ENA resnica, fail-closed, sklanjatev +
// filename, vsebinski dokazi na komponenti.
// EN VIR: smerLabel iz nagibi-csv R157 (R272 EXPORT — R262 kolicinaNiz
// precedens; VEDANJE 1:1 — CSV uporablja ISTO funkcijo); datum EN VIR
// cenikDatumIso + uraIso čista JS; soli 0xad–0xb0 unikatne.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildNagibiTerenPdfDoc,
  nagibiTerenPdfFilename,
  nagibiTerenPregled,
  preveriNagibVnos,
  sortirajNagibiTeren,
  nagibBeseda,
  uraIso,
  type NagibTerenVnos,
} from '@/lib/nagibi-teren-pdf'
import { smerLabel, buildNagibiCsv } from '@/lib/nagibi-csv'
import {
  buildMeritveTerenPdfDoc,
  type MeritveTerenVnos,
} from '@/lib/meritve-teren-pdf'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

// okno med markerjema (r207/…/r269/r270/r271 vzorec)
function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  const b = src.indexOf(do_, a)
  if (a === -1 || b === -1) return ''
  return src.slice(a, b)
}

const lib = beri('src/lib/nagibi-teren-pdf.ts')
const csvLib = beri('src/lib/nagibi-csv.ts')
const komponenta = beri('src/components/roksal/inclinometer-tab.tsx')

// FIXED now (determinizem — žig + CreationDate + fileId + ime).
const NOW: Date = new Date('2026-09-29T08:00:00.000Z')

// Osnovni nagib + nadgradbe.
function nagib(over: Partial<NagibTerenVnos> & Pick<NagibTerenVnos, 'id' | 'createdAt' | 'kotStopinje'>): NagibTerenVnos {
  return {
    smer: 'Y',
    lokacija: 'Talna plošča balkona',
    veljaven: true,
    ...over,
  }
}

// 5 odčitkov — VSE veje: Y pozitiven (n1 — največji kot), X negativen (n2 —
// znak je del resnice), brez lokacije (n3 → '—'), NEVELJAVEN (n4 — AMBER bold
// DB resnica, kondicionalni sklep), najnovejši (n5 — sort DESC na vrh).
const NAGIBI: NagibTerenVnos[] = [
  nagib({ id: 'n1', createdAt: '2026-09-01T08:30:00.000Z', kotStopinje: 2.35, smer: 'Y' }),
  nagib({ id: 'n2', createdAt: '2026-09-02T09:15:00.000Z', kotStopinje: -1.42, smer: 'X', lokacija: 'Rob balkona' }),
  nagib({ id: 'n3', createdAt: '2026-09-03T10:00:00.000Z', kotStopinje: 0.5, smer: null, lokacija: null }),
  nagib({ id: 'n4', createdAt: '2026-09-04T11:20:00.000Z', kotStopinje: 0.8, smer: 'X', veljaven: false }),
  nagib({ id: 'n5', createdAt: '2026-09-05T12:45:00.000Z', kotStopinje: 1.1, smer: 'Y', lokacija: 'Stopnišče' }),
]

function zgradi(vhodi: readonly NagibTerenVnos[] = NAGIBI, now: Date = NOW): Buffer {
  const doc = buildNagibiTerenPdfDoc(vhodi, { now })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R272 — PDF bajtni dokazi (determinizem + glifni razred — R249 doktrina)', () => {
  it('determinizem: enak vhod = bajtno enak; PREMEŠAN VRSTNI RED = bajtno ENAK (sort interno + kanon seed po id, f(množica)); drug now = drugačen', () => {
    expect(zgradi().equals(zgradi())).toBe(true)
    const preskakljani = zgradi([NAGIBI[4], NAGIBI[1], NAGIBI[0], NAGIBI[3], NAGIBI[2]])
    expect(preskakljani.equals(zgradi())).toBe(true)
    expect(zgradi(NAGIBI, new Date('2026-09-29T08:01:00.000Z')).equals(zgradi())).toBe(false)
  })

  it('%PDF- magija + NOV glifni razred (≠ vseh 37 znanih družinskih razredov IN ≠ brat R269 z njegovim fixturejem) + ime Nagibi-teren-YYYY-MM-DD.pdf', () => {
    const bin = zgradi()
    expect(bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    const znani = [30057, 30119, 30191, 30253, 35565, 38753, 39927, 41519, 42798, 37709, 37771, 36788, 36656, 36532, 33958, 36555, 38631, 45508, 44828, 36260, 36583, 45127, 38565, 38909, 40261, 35409, 37228, 39094, 41009, 37560, 38744, 43572, 51142, 45074, 42769, 66653, 37934]
    expect(znani).not.toContain(bin.length)
    // Brat R269 z ISTIMI vhodi kot njegov test — drug dokument = druga dolžina.
    const meritve: MeritveTerenVnos[] = [
      { id: 'p1', createdAt: '2026-09-20T08:00:00.000Z', dolzinaMm: 1000, visinaMm: 1100, oznaka: 'Balkon — sever', status: 'POTRJENA', lokacija: 'Balkon' },
      { id: 'a1', createdAt: '2026-09-22T09:00:00.000Z', dolzinaMm: 800, visinaMm: 1400 },
    ]
    const r269Bin = Buffer.from(buildMeritveTerenPdfDoc(meritve, { now: NOW }).output('arraybuffer'))
    expect(r269Bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(bin.length).not.toBe(r269Bin.length)
    expect(nagibiTerenPdfFilename(NOW)).toBe('Nagibi-teren-2026-09-29.pdf')
    expect(() => nagibiTerenPdfFilename('danes' as unknown as Date)).toThrow(TypeError)
  })

  it('soli 0xad–0xb0 — UNIKATNE v družini (register: punch-stanje 0xa9–0xac, inventura 0xa5–0xa8, meritve-teren 0xa1–0xa4, ekipa-stanje 0x9d–0xa0 — bratje NE delijo semen)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0xad)')
    expect(lib).toContain('fnv1aHex(seed, 0xb0)')
    expect(lib).not.toContain('fnv1aHex(seed, 0xa9)')
    expect(lib).not.toContain('fnv1aHex(seed, 0xa5)')
    expect(lib).not.toContain('fnv1aHex(seed, 0xa1)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x9d)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x99)')
  })

  it('SMER EN VIR — IMPORT smerLabel iz nagibi-csv R157 (R272 EXPORT — R262 precedens; VEDANJE 1:1: CSV buildNagibiCsv uporablja ISTO funkcijo, NI zasegane kopije)', () => {
    expect(lib).toContain("import { smerLabel } from './nagibi-csv'")
    expect(lib).not.toContain("function smerLabel")
    // CSV lib: smerLabel IZVOŽEN + uporabljen v buildNagibiCsv (NI več inline ternarja)
    expect(csvLib).toContain('export function smerLabel')
    expect(csvLib).toContain('const smer = smerLabel(r.smer)')
    // buildNagibiCsv NE več vsebuje inline ternar preslikave (samo smerLabel telo)
    const csvFn = oknoMed(csvLib, "export function buildNagibiCsv", "export function nagibiCsvFilename")
    expect(csvFn).toContain("smerLabel(r.smer)")
    expect(csvFn).not.toContain("? 'Levo-desno'")
    // ISTA preslikava kot CSV arhiv (R157 kanon)
    expect(smerLabel('X')).toBe('Naprej-nazaj')
    expect(smerLabel('Y')).toBe('Levo-desno')
    expect(smerLabel(null)).toBe('')
    expect(smerLabel(undefined)).toBe('')
    expect(smerLabel('Z')).toBe('')
    // EN VIR dokaz: CSV vrstica in PDF vrsta za ISTI odčitek = ISTA smer
    const csvIzvoz = buildNagibiCsv([{ kotStopinje: 1.5, smer: 'Y', lokacija: 'Terasa', createdAt: '2026-09-01T08:30:00.000Z' }])
    expect(csvIzvoz.csv).toContain('"Levo-desno"')
  })
})

describe('R272 — ENA resnica (KPI + tabela + sklep + toast iz ENE izpeljave)', () => {
  it('povzetek: 5 nagibov, največji |kot| 2.4° (n1 2.35 → toFixed(1)), povprečni |kot| 1.2°, veljavnih 4, neveljavnih 1 (n4 — DB resnica)', () => {
    const { povzetek } = nagibiTerenPregled(NAGIBI)
    expect(povzetek.nagibov).toBe(5)
    expect(povzetek.najvecjiKot).toBe('2.4')
    expect(povzetek.povprecniKot).toBe('1.2')
    expect(povzetek.veljavnih).toBe(4)
    expect(povzetek.neveljavnih).toBe(1)
  })

  it('sort: kronološko NARJUJOČE (najnovejši odčitek na vrhu — ISTI red kot API orderBy desc) + id tiebreak', () => {
    const { vrste } = nagibiTerenPregled(NAGIBI)
    expect(vrste.map((v) => v.id)).toEqual(['n5', 'n4', 'n3', 'n2', 'n1'])
    // sortirajNagibiTeren je IZVOŽEN (determinizem = f(množica))
    const obrnjene = nagibiTerenPregled([...NAGIBI].reverse()).vrste
    expect(obrnjene.map((v) => v.id)).toEqual(['n5', 'n4', 'n3', 'n2', 'n1'])
  })

  it('datum/ura EN VIR: cenikDatumIso DD.MM.YYYY + uraIso HH:MM (čista JS — NIKOLI toLocaleTimeString); kot toFixed(1) = ISTI format kot CSV IN UI; znak = del resnice', () => {
    const { vrste } = nagibiTerenPregled(NAGIBI)
    expect(vrste.find((v) => v.id === 'n1')?.datum).toBe('01.09.2026')
    expect(vrste.find((v) => v.id === 'n1')?.ura).toBe('08:30')
    expect(vrste.find((v) => v.id === 'n1')?.kot).toBe('2.4')
    expect(vrste.find((v) => v.id === 'n2')?.kot).toBe('-1.4')
    expect(vrste.find((v) => v.id === 'n2')?.smer).toBe('Naprej-nazaj')
    expect(vrste.find((v) => v.id === 'n3')?.smer).toBeNull()
    expect(vrste.find((v) => v.id === 'n3')?.lokacija).toBeNull()
    expect(uraIso('2026-09-05T12:45:00.000Z')).toBe('12:45')
    expect(() => uraIso('2026-09-05 12:45')).toThrow(TypeError)
  })

  it('tabela 5 stolpcev (Datum, Ura, Kot (stopinje), Smer, Lokacija) — head dobesedno = CSV glava pariteta (Datum,Ura,Kot (stopinje),Smer,Lokacija)', () => {
    expect(lib).toContain("['Datum', 'Ura', 'Kot (stopinje)', 'Smer', 'Lokacija']")
    const csvGlava = 'Datum,Ura,Kot (stopinje),Smer,Lokacija'
    expect(csvLib).toContain(`'${csvGlava}'`)
  })

  it('barvna resnica: neveljaven = AMBER bold vrstica (DB resnica — iskren signal, NIKOLI lažni alarm); smer/lokacija null = \'—\' sivo', () => {
    const okno = oknoMed(lib, 'didParseCell:', '})\n  y =')
    expect(okno).toContain('!v.veljaven')
    expect(okno).toContain('textColor = AMBER')
    expect(okno).toContain('textColor = GRAY')
    expect(okno).toContain("fontStyle = 'bold'")
    expect(okno).toContain("raw === '—'")
  })

  it('KPI 5 boxov z signalnim jezikom (Nagibov NAVY, Največji kot NAVY, Povprečni kot NAVY, Veljavnih GREEN, Neveljavnih AMBER samo > 0) + sklep: resnice poimenovane + EN VIR + referenčni pregled + vir dostopa', () => {
    expect(lib).toContain("'Nagibov'")
    expect(lib).toContain("'Največji kot'")
    expect(lib).toContain("'Povprečni kot'")
    expect(lib).toContain("'Veljavnih'")
    expect(lib).toContain("'Neveljavnih'")
    expect(lib).toContain('povzetek.neveljavnih > 0 ? AMBER : GREEN')
    // sklep — kondicionalna neveljavni resnica (žeton samo > 0 — R256 lekcija 4)
    expect(lib).toContain('(obseg odstopanja — absolutna vrednost)')
    expect(lib).toContain('(Σ |kot| / št. odčitkov)')
    expect(lib).toContain('(DB resnica)')
    expect(lib).toContain('(označeni sumljivi odčitki — DB resnica)')
    expect(lib).toContain("smer = ISTA preslikava kot CSV izvoz (smerLabel EN VIR — 'X' naprej-nazaj, 'Y' levo-desno)")
    expect(lib).toContain('(referenčni pregled — VSI nagibi projekta, tudi označeni neveljavni)')
    expect(lib).toContain('vir = /api/slopes?projectId (resnica dostopa do projekta)')
  })

  it('sklep kondicionalna resnica bajtno: neveljavnih 0 = dokument brez neveljavni clause (iskrena praznina); > 0 = clause ŽIVO — dva različna dokumenta (žeton samo > 0 — R256 lekcija 4)', () => {
    // vsi veljavni → sklep brez neveljavni clause
    const vsiVeljavni = NAGIBI.map((n) => ({ ...n, veljaven: true }))
    const binCisti = zgradi(vsiVeljavni)
    // en neveljaven → sklep z clause + AMBER vrstica → drugačen dokument
    const zNeveljavnim = NAGIBI.map((n) => ({ ...n, veljaven: n.id === 'n4' ? false : true }))
    const binOznaceni = zgradi(zNeveljavnim)
    expect(binCisti.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(binOznaceni.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(binCisti.length).not.toBe(binOznaceni.length)
    // strukturni dokaz v libu: neveljavniSklep je KONDICIONALNI (samo > 0)
    expect(lib).toContain('const neveljavniSklep =')
    expect(lib).toContain('povzetek.neveljavnih > 0')
    // povzetek resnica v obeh vejah
    const cisti = nagibiTerenPregled(vsiVeljavni).povzetek
    expect(cisti.neveljavnih).toBe(0)
    expect(cisti.veljavnih).toBe(5)
    const oznaceni = nagibiTerenPregled(zNeveljavnim).povzetek
    expect(oznaceni.neveljavnih).toBe(1)
    expect(oznaceni.veljavnih).toBe(4)
  })
})

describe('R272 — fail-closed (pokvaren vir → TypeError z indeksom krivca)', () => {
  it('prazen seznam ne nastaja dokumenta (lib IN build) — iskren toast v komponenti, NI prazne datoteke', () => {
    expect(() => nagibiTerenPregled([])).toThrow(TypeError)
    expect(() => nagibiTerenPregled([])).toThrow(/prazen seznam nagibov/)
    expect(() => buildNagibiTerenPdfDoc([], { now: NOW })).toThrow(TypeError)
    expect(() => buildNagibiTerenPdfDoc([], { now: NOW })).toThrow(/Ni vpisanih nagibov/)
  })

  it('podvojen id = pokvaren vir (identiteta mora biti edinstvena — NIKOLI tiho združevanje)', () => {
    const podvojeni = [NAGIBI[0], { ...NAGIBI[1], id: 'n1' }]
    expect(() => nagibiTerenPregled(podvojeni)).toThrow(TypeError)
    expect(() => nagibiTerenPregled(podvojeni)).toThrow(/podvojen id nagiba n1/)
  })

  it('neznana NE-null smer → TypeError (smerLabel preslikava — CSV bi kodo zapisal prazno, dokument resnice NE ugiba); null/izostanek = iskren odpad', () => {
    expect(() => nagibiTerenPregled([nagib({ id: 'x1', createdAt: '2026-09-01T08:00:00.000Z', kotStopinje: 1, smer: 'Z' })])).toThrow(TypeError)
    expect(() => nagibiTerenPregled([nagib({ id: 'x1', createdAt: '2026-09-01T08:00:00.000Z', kotStopinje: 1, smer: 'Z' })])).toThrow(/neznana smer: Z/)
    // null smer = iskren odpad ('—' na listu) — NE gaže
    const { vrste } = nagibiTerenPregled([nagib({ id: 'x2', createdAt: '2026-09-01T08:00:00.000Z', kotStopinje: 1, smer: null })])
    expect(vrste[0].smer).toBeNull()
  })

  it('preveriNagibVnos: ne-finite kot (NaN/∞) + ne-ISO createdAt + ne-nizovna polja + veljaven ne-boolean (R227 strogost — DB resnica) — indeks krivca VEDNO v sporočilu', () => {
    expect(() => preveriNagibVnos(nagib({ id: 'x1', createdAt: '2026-09-01T08:00:00.000Z', kotStopinje: NaN }), 2)).toThrow(/kotStopinje/)
    expect(() => preveriNagibVnos(nagib({ id: 'x1', createdAt: '2026-09-01T08:00:00.000Z', kotStopinje: Infinity }), 3)).toThrow(/kotStopinje/)
    expect(() => preveriNagibVnos(nagib({ id: '', createdAt: '2026-09-01T08:00:00.000Z', kotStopinje: 1 }), 4)).toThrow(/\(4\)/)
    expect(() => preveriNagibVnos(nagib({ id: 'x1', createdAt: '', kotStopinje: 1 }), 5)).toThrow(/createdAt/)
    expect(() => preveriNagibVnos(nagib({ id: 'x1', createdAt: '2026-09-01T08:00:00.000Z', kotStopinje: 1, lokacija: 42 as unknown as string }), 6)).toThrow(/lokacija/)
    expect(() => preveriNagibVnos(nagib({ id: 'x1', createdAt: '2026-09-01T08:00:00.000Z', kotStopinje: 1, veljaven: 'da' as unknown as boolean }), 7)).toThrow(/veljaven/)
    expect(() => preveriNagibVnos(nagib({ id: 'x1', createdAt: '2026-09-01T08:00:00.000Z', kotStopinje: 1, veljaven: undefined }), 8)).toThrow(/veljaven/)
    // ne-objekt / polje
    expect(() => preveriNagibVnos(null as unknown as NagibTerenVnos, 9)).toThrow(TypeError)
    expect(() => preveriNagibVnos([1] as unknown as NagibTerenVnos, 10)).toThrow(TypeError)
    // preverba se poganja v pregledu (fail-verbose VSEH vnosov)
    expect(() => nagibiTerenPregled([NAGIBI[0], nagib({ id: 'x9', createdAt: '2026-09-01T08:00:00.000Z', kotStopinje: '1.5' as unknown as number })])).toThrow(TypeError)
  })

  it('build z ne-Date now / ne-objekt opcije / ne-niz projektIme → TypeError', () => {
    expect(() => buildNagibiTerenPdfDoc(NAGIBI, 'now' as unknown as { now: Date })).toThrow(TypeError)
    expect(() => buildNagibiTerenPdfDoc(NAGIBI, { now: 'ne-date' as unknown as Date })).toThrow(TypeError)
    expect(() => buildNagibiTerenPdfDoc(NAGIBI, { now: NOW, projektIme: 5 as unknown as string })).toThrow(TypeError)
  })
})

describe('R272 — sklanjatev + filename + družinska anatomija', () => {
  it('nagibBeseda: 0/1/2/3/4/5/11/21/22/101/111 — dvojinski razred (101 = sto EN nagib — R168 kanon, pariteta tockaBeseda/clanBeseda)', () => {
    expect(nagibBeseda(0)).toBe('0 nagibov')
    expect(nagibBeseda(1)).toBe('1 nagib')
    expect(nagibBeseda(2)).toBe('2 nagiba')
    expect(nagibBeseda(3)).toBe('3 nagibi')
    expect(nagibBeseda(4)).toBe('4 nagibi')
    expect(nagibBeseda(5)).toBe('5 nagibov')
    expect(nagibBeseda(11)).toBe('11 nagibov')
    expect(nagibBeseda(21)).toBe('21 nagib')
    expect(nagibBeseda(22)).toBe('22 nagiba')
    expect(nagibBeseda(101)).toBe('101 nagib')
    expect(nagibBeseda(111)).toBe('111 nagibov')
    expect(() => nagibBeseda(-1)).toThrow(TypeError)
    expect(() => nagibBeseda(1.5)).toThrow(TypeError)
  })

  it('filename kontrakt Nagibi-teren-YYYY-MM-DD + fail-closed; ločeno od CSV nagibi_<projectId>_…', () => {
    expect(nagibiTerenPdfFilename(new Date('2027-01-02T10:00:00.000Z'))).toBe('Nagibi-teren-2027-01-02.pdf')
    expect(lib).toContain('`Nagibi-teren-${todayStamp(now)}.pdf`')
    expect(lib).toContain('generateNagibiTerenPdf')
    expect(lib).toContain('doc.save(nagibiTerenPdfFilename(options.now))')
  })

  it('družinska anatomija: glava NAGIBI — TERENSKI PREGLED + ROKSAL + projekt ime + osveženo + noge Stran i/N + determinizem (setCreationDate + setFileId) + brez locale + NIČ mreže', () => {
    expect(lib).toContain("'NAGIBI — TERENSKI PREGLED'")
    expect(lib).toContain('projekt: ${imeProjekta}')
    expect(lib).toContain('Brez imena projekta')
    expect(lib).toContain('osveženo ${zalogaPovzetekCasOznaka(now)}')
    expect(lib).toContain('Stran ${i}/${strani}')
    expect(lib).toContain('Roksal Field Manager v2.5')
    expect(lib).toContain('doc.setCreationDate(now)')
    expect(lib).toContain('doc.setFileId(')
    expect(lib).not.toContain('localeCompare')
    expect(lib).not.toContain('toLocaleString(')
    expect(lib).not.toContain('toLocaleTimeString(')
    expect(lib).not.toContain('toLocaleDateString(')
    expect(lib).not.toContain('fetch(')
    expect(lib).not.toContain("from 'node:crypto'")
  })
})

describe('R272 — vsebinski dokazi na komponenti (inclinometer-tab.tsx)', () => {
  it('pill ŽIVO: aria + active:scale + disabled={pdfNagibiVteku} + guard + Loader2/FileDown aria-hidden + VEDNO viden pri projektu (NI gated na saved.length)', () => {
    expect(komponenta).toContain('aria-label="Izvozi terenski pregled nagibov kot PDF"')
    const pill = oknoMed(komponenta, '{/* R272 — terenski pregled nagibov PDF (28. člen', '</button>')
    expect(pill).toContain('onClick={() => void handleNagibiPdf()}')
    expect(pill).toContain('disabled={pdfNagibiVteku}')
    expect(pill).toContain('active:scale-[0.96]') // [EVOLVED R390 val 68: dual mehanizem razrešen — utility scale ostane]
    expect(pill).toContain('<Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />')
    expect(pill).toContain('<FileDown aria-hidden="true" className="h-3 w-3" />')
    expect(pill).toContain('PDF')
    expect(pill).toContain('{projectId && (')
    // handler guard (dvoklik)
    expect(komponenta).toContain('if (pdfNagibiVteku) return')
  })

  it('FRESH fetch /api/slopes?projectId ob kliku (polna resnica zgodovine — state je lahko zastarel) + fail-verbose DTO pruning (GET HTTP razlog, Array.isArray, id/createdAt/kotStopinje strict)', () => {
    const handler = oknoMed(komponenta, 'const handleNagibiPdf = async () => {', "  // R157 — izvoz zgodovine nagibov v CSV")
    expect(handler).toContain('fetch(`/api/slopes?projectId=${projectId}`')
    expect(handler).toContain('GET /api/slopes → HTTP ${res.status}')
    expect(handler).toContain("throw new TypeError('Odgovora /api/slopes ni mogoče prebrati (ni polja).')")
    expect(handler).toContain('manjkajoč id v odgovoru API-ja')
    expect(handler).toContain('manjkajoč createdAt v odgovoru API-ja')
    expect(handler).toContain('kotStopinje mora biti končno število')
  })

  it('fail-closed toast (Ni vpisanih nagibov + iskren opis) + fail-verbose (Izvoz ni uspel) + ENA izpeljava (nagibiTerenPregled(vnosi) pred generate + agregat toast)', () => {
    const handler = oknoMed(komponenta, 'const handleNagibiPdf = async () => {', "  // R157 — izvoz zgodovine nagibov v CSV")
    expect(handler).toContain("title: 'Ni vpisanih nagibov',")
    expect(handler).toContain('Terenski pregled nagibov se izvozi, ko je vpisan prvi odčitek projekta.')
    expect(handler).toContain("title: 'Izvoz ni uspel',")
    expect(handler).toContain('const { povzetek } = nagibiTerenPregled(vnosi)')
    expect(handler).toContain('generateNagibiTerenPdf(vnosi, { now: new Date(), projektIme: projektIme ?? null })')
    expect(handler).toContain('Nagibi-teren-…pdf — ${nagibBeseda(povzetek.nagibov)}, največji |kot| ${povzetek.najvecjiKot}°, povprečni ${povzetek.povprecniKot}°.')
    expect(handler).toContain("title: 'Terenski pregled nagibov prenešen v PDF',")
  })

  it('mini-vrstica: \'Nagibi (viden seznam):\' + nagibBeseda + dot prioritetni AMBER/GREEN + kondicionalni žeton samo > 0 + ENA izpeljava memo', () => {
    const mini = oknoMed(komponenta, '{projectId && nagibiStanjePovzetek !== null && (', '          {/* Libela — krožna')
    expect(mini).toContain('Nagibi (viden seznam):')
    expect(mini).toContain('{nagibBeseda(nagibiStanjePovzetek.nagibov)}')
    expect(mini).toContain('· največji {nagibiStanjePovzetek.najvecjiKot}° · povprečni {nagibiStanjePovzetek.povprecniKot}°')
    expect(mini).toContain("'bg-roksal-amber'")
    expect(mini).toContain("'bg-roksal-green'")
    expect(mini).toContain('{nagibiStanjePovzetek.neveljavnih} neveljavnih')
    // ENA izpeljava: ISTI nagibiTerenPregled čez saved (WYSIWYG — dve okni, ENA matemtika)
    const memo = oknoMed(komponenta, 'const nagibiStanjePovzetek = useMemo(() => {', '}, [saved, projectId])')
    expect(memo).toContain('return null')
    expect(memo).toContain('nagibiTerenPregled(')
    expect(memo).toContain('saved.map')
  })

  it('legenda VEDNO vidna pri projektu + glava NAGIBI — TERENSKI PREGLED (NI duplicirana v komponenti) + 28. člen + 0 novih hex (lib IN komponenta)', () => {
    expect(komponenta).toContain('PDF = VSI nagibi projekta (tudi označeni neveljavni — polna resnica, ne samo viden seznam)')
    expect(komponenta).not.toMatch(/#[0-9a-fA-F]{6}/)
    expect(lib).toContain("'NAGIBI — TERENSKI PREGLED'")
    expect(lib).toContain('Nagibi-teren-${todayStamp(now)}.pdf')
    expect(lib).not.toMatch(/#[0-9a-fA-F]{6}/)
    // 28. člen družine — dokumentirano v obeh virih
    expect(lib).toContain("28. člen")
    expect(komponenta).toContain('28. člen')
    // R249 doktrina: naslovni needleji v komponenti NE duplicirajo glave (glava = lib resnica)
    expect(komponenta).not.toContain('NAGIBI — TERENSKI PREGLED')
    // obstoječi izvoz NISO pokvarjeni (CSV ostaja)
    expect(komponenta).toContain('buildNagibiCsv, nagibiCsvFilename')
    expect(komponenta).toContain('Izvozi CSV')
  })
})
