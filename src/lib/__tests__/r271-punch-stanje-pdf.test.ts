// ---------------------------------------------------------------------------
// R271 — ZAPISNIK — STANJE PRED PREDAJO PDF (27. člen 'izvozi' družine) —
// testi. Vzorec r270-inventura-pregled-pdf / r269-meritve-teren: bajtni
// dokazi (determinizem + glifni razred — R249 doktrina), ENA resnica,
// fail-closed, sklanjatev + filename, vsebinski dokazi na komponenti.
// EN VIR: PUNCH_STATUS_LABELS iz punch-csv R158 (IMPORT — NI zasegane
// kopije); datum EN VIR cenikDatumIso; soli 0xa9–0xac unikatne.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildZapisnikStanjePdfDoc,
  zapisnikStanjePdfFilename,
  punchZapisnikPregled,
  preveriPunchVnos,
  sortirajPunchZapisnik,
  tockaBeseda,
  napakaBeseda,
  odprtaBeseda,
  resenostOdstotek,
  type PunchZapisnikVnos,
} from '@/lib/punch-stanje-pdf'
import { PUNCH_STATUS_LABELS } from '@/lib/punch-csv'
import {
  buildMeritveTerenPdfDoc,
  type MeritveTerenVnos,
} from '@/lib/meritve-teren-pdf'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

// okno med markerjema (r207/…/r269/r270 vzorec)
function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  const b = src.indexOf(do_, a)
  if (a === -1 || b === -1) return ''
  return src.slice(a, b)
}

const lib = beri('src/lib/punch-stanje-pdf.ts')
const komponenta = beri('src/components/roksal/punch-list.tsx')

// FIXED now (determinizem — žig + CreationDate + fileId + ime).
const NOW: Date = new Date('2026-09-29T08:00:00.000Z')

// Osnovna točka + nadgradbe.
function tocka(over: Partial<PunchZapisnikVnos> & Pick<PunchZapisnikVnos, 'id' | 'createdAt'>): PunchZapisnikVnos {
  return {
    naslov: `Točka ${over.id}`,
    status: 'open',
    opomba: null,
    ...over,
  }
}

// 6 točk — VSE veje: NAPAKA ×1 (t1 — blokira predajo), ODPRTA ×2 (t3 brez
// opombe → '—'; t2 z opombo; t3 starejša od t2 → kronološki red znotraj cone),
// REŠENA ×3 (t5 srednja; t4 IN t6 ISTI datum → id tiebreak t4 < t6).
const TOCKE: PunchZapisnikVnos[] = [
  tocka({ id: 't1', createdAt: '2026-09-01T08:00:00.000Z', naslov: 'Urejena meja z sosedom', status: 'issue', opomba: 'Zaznam meje manjka' }),
  tocka({ id: 't2', createdAt: '2026-09-03T08:00:00.000Z', naslov: 'Dostop do parcele urejen', status: 'open', opomba: 'Ključi pri stranki' }),
  tocka({ id: 't3', createdAt: '2026-09-01T12:00:00.000Z', naslov: 'Preverjena lokacija inštalacij' }),
  tocka({ id: 't4', createdAt: '2026-09-05T08:00:00.000Z', naslov: 'Montaža zaključena po priklopu', status: 'done' }),
  tocka({ id: 't5', createdAt: '2026-09-02T08:00:00.000Z', naslov: 'Kontrola mer in vodnosti', status: 'done', opomba: 'Vodnost OK' }),
  tocka({ id: 't6', createdAt: '2026-09-05T16:00:00.000Z', naslov: 'Predaja ključev', status: 'done' }),
]

function zgradi(vhodi: readonly PunchZapisnikVnos[] = TOCKE, now: Date = NOW): Buffer {
  const doc = buildZapisnikStanjePdfDoc(vhodi, { now })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R271 — PDF bajtni dokazi (determinizem + glifni razred — R249 doktrina)', () => {
  it('determinizem: enak vhod = bajtno enak; PREMEŠAN VRSTNI RED = bajtno ENAK (akcijski sort interno + kanon seed po id, f(množica)); drug now = drugačen', () => {
    expect(zgradi().equals(zgradi())).toBe(true)
    const preskakljani = zgradi([TOCKE[5], TOCKE[2], TOCKE[0], TOCKE[4], TOCKE[1], TOCKE[3]])
    expect(preskakljani.equals(zgradi())).toBe(true)
    expect(zgradi(TOCKE, new Date('2026-09-29T08:01:00.000Z')).equals(zgradi())).toBe(false)
  })

  it('%PDF- magija + NOV glifni razred (≠ vseh 36 znanih družinskih razredov IN ≠ brat R269 z njegovim fixturejem) + ime Zapisnik-stanje-YYYY-MM-DD.pdf', () => {
    const bin = zgradi()
    expect(bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    const znani = [30057, 30119, 30191, 30253, 35565, 38753, 39927, 41519, 42798, 37709, 37771, 36788, 36656, 36532, 33958, 36555, 38631, 45508, 44828, 36260, 36583, 45127, 38565, 38909, 40261, 35409, 37228, 39094, 41009, 37560, 38744, 43572, 51142, 45074, 42769, 66653]
    expect(znani).not.toContain(bin.length)
    // Brat R269 z ISTIMI vhodi kot njegov test — drug dokument = druga dolžina.
    const meritve: MeritveTerenVnos[] = [
      { id: 'p1', createdAt: '2026-09-20T08:00:00.000Z', dolzinaMm: 1000, visinaMm: 1100, oznaka: 'Balkon — sever', status: 'POTRJENA', lokacija: 'Balkon' },
      { id: 'a1', createdAt: '2026-09-22T09:00:00.000Z', dolzinaMm: 800, visinaMm: 1400 },
    ]
    const r269Bin = Buffer.from(buildMeritveTerenPdfDoc(meritve, { now: NOW }).output('arraybuffer'))
    expect(r269Bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(bin.length).not.toBe(r269Bin.length)
    expect(zapisnikStanjePdfFilename(NOW)).toBe('Zapisnik-stanje-2026-09-29.pdf')
    expect(() => zapisnikStanjePdfFilename('danes' as unknown as Date)).toThrow(TypeError)
  })

  it('soli 0xa9–0xac — UNIKATNE v družini (register: inventura 0xa5–0xa8, meritve-teren 0xa1–0xa4, ekipa-stanje 0x9d–0xa0, ponudbe 0x99–0x9c, oprema 0x95–0x98 — bratje NE delijo semen)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0xa9)')
    expect(lib).toContain('fnv1aHex(seed, 0xac)')
    expect(lib).not.toContain('fnv1aHex(seed, 0xa5)')
    expect(lib).not.toContain('fnv1aHex(seed, 0xa1)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x9d)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x99)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x95)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x91)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x8d)')
  })

  it('STATUS EN VIR — IMPORT PUNCH_STATUS_LABELS iz punch-csv R158 (NI zasegane kopije; ISTA besedila kot CSV izvoz IN UI značke)', () => {
    expect(lib).toContain("import { PUNCH_STATUS_LABELS, type PunchStatus } from './punch-csv'")
    expect(lib).not.toContain("const PUNCH_STATUS_LABELS")
    expect(lib).not.toContain('function PUNCH_STATUS_LABELS')
    // ISTA besedila kot CSV arhiv (R158 kanon)
    expect(PUNCH_STATUS_LABELS.open).toBe('Odprto')
    expect(PUNCH_STATUS_LABELS.done).toBe('Rešeno')
    expect(PUNCH_STATUS_LABELS.issue).toBe('Napaka')
    // statusLabel na vrsti = lookup ISTEGA vira (WYSIWYG)
    const { vrste } = punchZapisnikPregled(TOCKE)
    expect(vrste.find((v) => v.id === 't1')?.statusLabel).toBe('Napaka')
    expect(vrste.find((v) => v.id === 't3')?.statusLabel).toBe('Odprto')
    expect(vrste.find((v) => v.id === 't5')?.statusLabel).toBe('Rešeno')
  })
})

describe('R271 — ENA resnica (KPI + tabela + sklep + toast iz ENE izpeljave)', () => {
  it('povzetek: 6 točk, napak 1, odprtih 2, rešenih 3, rešenost 50.0 % (Σ resnica — rešenih/vseh × 100, 1 dec)', () => {
    const { povzetek } = punchZapisnikPregled(TOCKE)
    expect(povzetek.tock).toBe(6)
    expect(povzetek.napak).toBe(1)
    expect(povzetek.odprtih).toBe(2)
    expect(povzetek.resenih).toBe(3)
    expect(povzetek.resenostOdstotek).toBe('50.0')
  })

  it('sort: akcijski red (NAPAKA → ODPRTA → REŠENA) + createdAt ASC znotraj cone (kronološko branje zapisnika — ISTI red kot API orderBy) + id tiebreak (t4 < t6 isti datum)', () => {
    const { vrste } = punchZapisnikPregled(TOCKE)
    expect(vrste.map((v) => v.id)).toEqual(['t1', 't3', 't2', 't5', 't4', 't6'])
    // sortirajPunchZapisnik je IZVOŽEN (determinizem = f(množica))
    const kopija = [...TOCKE].reverse().map((t) => ({ ...t }))
    const { vrste: obrnjene } = punchZapisnikPregled(kopija)
    expect(obrnjene.map((v) => v.id)).toEqual(['t1', 't3', 't2', 't5', 't4', 't6'])
  })

  it('datum EN VIR cenikDatumIso (ISO → DD.MM.YYYY deterministično, brez locale) + fail-closed ne-ISO z indeksom krivca', () => {
    const { vrste } = punchZapisnikPregled(TOCKE)
    expect(vrste.find((v) => v.id === 't1')?.datum).toBe('01.09.2026')
    expect(vrste.find((v) => v.id === 't5')?.datum).toBe('02.09.2026')
    expect(() => punchZapisnikPregled([tocka({ id: 'x1', createdAt: 'ne-iso' })])).toThrow(TypeError)
    expect(() => punchZapisnikPregled([tocka({ id: 'x1', createdAt: 'ne-iso' })])).toThrow(/x1/)
  })

  it('tabela 4 stolpce (Datum, Točka kontrole, Status, Opomba) — head dobesedno = CSV glava pariteta (Datum,Naslov,Status,Opomba)', () => {
    expect(lib).toContain("['Datum', 'Točka kontrole', 'Status', 'Opomba']")
    // opomba null → '—' (iskren odpad); naslov VERBATIM
    const { vrste } = punchZapisnikPregled(TOCKE)
    expect(vrste.find((v) => v.id === 't3')?.opomba).toBeNull()
    expect(vrste.find((v) => v.id === 't2')?.opomba).toBe('Ključi pri stranki')
    expect(vrste.find((v) => v.id === 't1')?.naslov).toBe('Urejena meja z sosedom')
  })

  it('barvna resnica: Napaka RED bold (akcija — blokira predajo), Odprto AMBER bold (akcija), Rešeno GREEN (zgodovina), \'—\' sivo; NIKOLI utišan alarm', () => {
    const okno = oknoMed(lib, 'didParseCell:', '})\n  y =')
    expect(okno).toContain("v.status === 'issue'")
    expect(okno).toContain("v.status === 'open'")
    expect(okno).toContain("v.status === 'done'")
    expect(okno).toContain('textColor = RED')
    expect(okno).toContain('textColor = AMBER')
    expect(okno).toContain('textColor = GREEN')
    expect(okno).toContain('textColor = GRAY')
    expect(okno).toContain("fontStyle = 'bold'")
    expect(okno).toContain("raw === '—'")
  })

  it('KPI 5 boxov z signalnim jezikom (Točk NAVY, Napak RED>0, Odprtih AMBER>0, Rešenih GREEN, Rešenost % NAVY) + sklep: cone + akcije poimenovane + referenčni pregled + vir resnica', () => {
    expect(lib).toContain("'Točk'")
    expect(lib).toContain("'Napak'")
    expect(lib).toContain("'Odprtih'")
    expect(lib).toContain("'Rešenih'")
    expect(lib).toContain("'Rešenost'")
    expect(lib).toContain('povzetek.napak > 0 ? RED : GREEN')
    expect(lib).toContain('povzetek.odprtih > 0 ? AMBER : GREEN')
    // sklep — cone + akcije + resnice
    expect(lib).toContain('(akcija — predaja ne more potekti z odprto napako)')
    expect(lib).toContain('(akcija — čaka rešitev)')
    expect(lib).toContain('(zgodovinska cona)')
    expect(lib).toContain('(Σ rešenih / vseh točk)')
    expect(lib).toContain('statusi = ISTA besedila kot CSV izvoz (PUNCH_STATUS_LABELS EN VIR)')
    expect(lib).toContain('(referenčni pregled — VSE točke zapisnika, tudi rešene)')
    expect(lib).toContain('vir = /api/punch?projectId (resnica dostopa do projekta)')
  })
})

describe('R271 — fail-closed (pokvaren vir → TypeError z indeksom krivca)', () => {
  it('prazen zapisnik ne nastaja dokumenta (lib IN build) — iskren toast v komponenti, NI prazne datoteke', () => {
    expect(() => punchZapisnikPregled([])).toThrow(TypeError)
    expect(() => punchZapisnikPregled([])).toThrow(/prazen zapisnik/)
    expect(() => buildZapisnikStanjePdfDoc([], { now: NOW })).toThrow(TypeError)
    expect(() => buildZapisnikStanjePdfDoc([], { now: NOW })).toThrow(/Ni točk prejemnega zapisnika/)
  })

  it('podvojen id = pokvaren vir (identiteta mora biti edinstvena — NIKOLI tiho združevanje)', () => {
    const podvojeni = [TOCKE[0], { ...TOCKE[1], id: 't1' }]
    expect(() => punchZapisnikPregled(podvojeni)).toThrow(TypeError)
    expect(() => punchZapisnikPregled(podvojeni)).toThrow(/podvojen id točke t1/)
  })

  it('neznani status → TypeError (PUNCH_STATUS_LABELS lookup — CSV bi kodo zapisal verbatim, dokument resnice pa je NE izvozi)', () => {
    expect(() => punchZapisnikPregled([tocka({ id: 'x1', createdAt: '2026-09-01T08:00:00.000Z', status: 'arhivirana' })])).toThrow(TypeError)
    expect(() => punchZapisnikPregled([tocka({ id: 'x1', createdAt: '2026-09-01T08:00:00.000Z', status: 'arhivirana' })])).toThrow(/neznani status: arhivirana/)
  })

  it('preveriPunchVnos: ne-prazen id + ne-prazen naslov (trim) + niz ALI null opomba + ISO createdAt — indeks krivca VEDNO v sporočilu', () => {
    expect(() => preveriPunchVnos(tocka({ id: '', createdAt: '2026-09-01T08:00:00.000Z' }), 2)).toThrow(/\(2\)/)
    expect(() => preveriPunchVnos(tocka({ id: 'x1', createdAt: '2026-09-01T08:00:00.000Z', naslov: '   ' }), 3)).toThrow(/naslov/)
    expect(() => preveriPunchVnos(tocka({ id: 'x1', createdAt: '2026-09-01T08:00:00.000Z', opomba: 42 as unknown as string }), 4)).toThrow(/opomba/)
    expect(() => preveriPunchVnos(tocka({ id: 'x1', createdAt: '' }), 5)).toThrow(/createdAt/)
    // ne-objekt / polje
    expect(() => preveriPunchVnos(null as unknown as PunchZapisnikVnos, 6)).toThrow(TypeError)
    expect(() => preveriPunchVnos([1] as unknown as PunchZapisnikVnos, 7)).toThrow(TypeError)
    // preverba se poganja v pregledu (fail-verbose VSEH vnosov)
    expect(() => punchZapisnikPregled([TOCKE[0], tocka({ id: 'x9', createdAt: '2026-09-01T08:00:00.000Z', naslov: 5 as unknown as string })])).toThrow(TypeError)
  })

  it('resenostOdstotek fail-closed: vseh 0 / rešenih > vseh / necelo / negativno → TypeError; build z ne-Date now / ne-objekt opcije → TypeError', () => {
    expect(() => resenostOdstotek(3, 0)).toThrow(TypeError)
    expect(() => resenostOdstotek(4, 3)).toThrow(TypeError)
    expect(() => resenostOdstotek(1.5, 3)).toThrow(TypeError)
    expect(() => resenostOdstotek(-1, 3)).toThrow(TypeError)
    expect(() => buildZapisnikStanjePdfDoc(TOCKE, 'now' as unknown as { now: Date })).toThrow(TypeError)
    expect(() => buildZapisnikStanjePdfDoc(TOCKE, { now: 'ne-date' as unknown as Date })).toThrow(TypeError)
    expect(() => buildZapisnikStanjePdfDoc(TOCKE, { now: NOW, projektIme: 5 as unknown as string })).toThrow(TypeError)
  })
})

describe('R271 — sklanjatev + filename + družinska anatomija', () => {
  it('tockaBeseda/napakaBeseda/odprtaBeseda: 0/1/2/3/4/5/11/21/22/101/111 — dvojinski razred (101 = sto EN točka/napaka/odprta — R168 kanon, pariteta clanBeseda/osnutekBeseda)', () => {
    expect(tockaBeseda(0)).toBe('0 točk')
    expect(tockaBeseda(1)).toBe('1 točka')
    expect(tockaBeseda(2)).toBe('2 točki')
    expect(tockaBeseda(3)).toBe('3 točke')
    expect(tockaBeseda(4)).toBe('4 točke')
    expect(tockaBeseda(5)).toBe('5 točk')
    expect(tockaBeseda(11)).toBe('11 točk')
    expect(tockaBeseda(21)).toBe('21 točka')
    expect(tockaBeseda(22)).toBe('22 točki')
    expect(tockaBeseda(101)).toBe('101 točka')
    expect(tockaBeseda(111)).toBe('111 točk')
    expect(napakaBeseda(1)).toBe('1 napaka')
    expect(napakaBeseda(2)).toBe('2 napaki')
    expect(napakaBeseda(5)).toBe('5 napak')
    expect(napakaBeseda(101)).toBe('101 napaka')
    expect(odprtaBeseda(1)).toBe('1 odprta')
    expect(odprtaBeseda(2)).toBe('2 odprti')
    expect(odprtaBeseda(5)).toBe('5 odprtih')
    expect(odprtaBeseda(101)).toBe('101 odprta')
    expect(() => tockaBeseda(-1)).toThrow(TypeError)
    expect(() => tockaBeseda(1.5)).toThrow(TypeError)
    expect(() => napakaBeseda(-2)).toThrow(TypeError)
    expect(() => odprtaBeseda(2.5)).toThrow(TypeError)
  })

  it('resenostOdstotek: 0.0 / 50.0 / 100.0 — iskren Σ (rešenih 0 = NIKOLI lažni 100)', () => {
    expect(resenostOdstotek(0, 6)).toBe('0.0')
    expect(resenostOdstotek(3, 6)).toBe('50.0')
    expect(resenostOdstotek(6, 6)).toBe('100.0')
    expect(resenostOdstotek(1, 3)).toBe('33.3')
  })

  it('filename kontrakt Zapisnik-stanje-YYYY-MM-DD + fail-closed; ločeno od predajnega zapisnika IN CSV zapisnik_<projectId>_…', () => {
    expect(zapisnikStanjePdfFilename(new Date('2027-01-02T10:00:00.000Z'))).toBe('Zapisnik-stanje-2027-01-02.pdf')
    expect(lib).toContain('`Zapisnik-stanje-${todayStamp(now)}.pdf`')
    // EN now za žig IN ime (lekcija R121/R235): klicatelj poda ISTO now
    expect(lib).toContain('generateZapisnikStanjePdf')
    expect(lib).toContain('doc.save(zapisnikStanjePdfFilename(options.now))')
  })

  it('družinska anatomija: glava ZAPISNIK — STANJE PRED PREDAJO + ROKSAL + projekt ime + osveženo + noge Stran i/N + determinizem (setCreationDate + setFileId) + brez locale + NIČ mreže', () => {
    expect(lib).toContain("'ZAPISNIK — STANJE PRED PREDAJO'")
    expect(lib).toContain('projekt: ${imeProjekta}')
    expect(lib).toContain('Brez imena projekta')
    expect(lib).toContain('osveženo ${zalogaPovzetekCasOznaka(now)}')
    expect(lib).toContain('Stran ${i}/${strani}')
    expect(lib).toContain('Roksal Field Manager v2.5')
    expect(lib).toContain('doc.setCreationDate(now)')
    expect(lib).toContain('doc.setFileId(')
    expect(lib).not.toContain('localeCompare')
    expect(lib).not.toContain('toLocaleString')
    expect(lib).not.toContain('toLocaleDateString')
    expect(lib).not.toContain('fetch(')
    expect(lib).not.toContain("from 'node:crypto'")
    // glava projektna resnica: null/izostanek → iskren 'Brez imena projekta'
    const bin = zgradi([TOCKE[0]], NOW)
    expect(bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    const { vrste } = punchZapisnikPregled([TOCKE[0]])
    expect(vrste).toHaveLength(1)
  })
})

describe('R271 — vsebinski dokazi na komponenti (punch-list.tsx)', () => {
  it('pill ŽIVO: aria + active:scale + disabled={stanjeVteku} + guard + Loader2/FileDown aria-hidden + VEDNO viden pri projektu (NI gated na items.length)', () => {
    expect(komponenta).toContain('aria-label="Izvozi pregled stanja zapisnika kot PDF"')
    const pill = oknoMed(komponenta, '{/* R271 — pregled stanja zapisnika PDF (27. člen', '</button>')
    expect(pill).toContain('onClick={() => void handleStanjePdf()}')
    expect(pill).toContain('disabled={stanjeVteku}')
    expect(pill).toContain('active:scale-[0.96]') // [EVOLVED R391 val 68: dual mehanizem razrešen — utility scale ostane]
    expect(pill).toContain('<Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />')
    expect(pill).toContain('<FileDown aria-hidden="true" className="h-3 w-3" />')
    expect(pill).toContain('PDF stanje')
    expect(pill).toContain('{project && (')
    // handler guard (dvoklik)
    expect(komponenta).toContain('if (stanjeVteku) return')
  })

  it('FRESH fetch /api/punch?projectId ob kliku (polna resnica zapisnika — state je lahko zastarel) + fail-verbose DTO pruning (GET HTTP razlog, Array.isArray, id/createdAt)', () => {
    const handler = oknoMed(komponenta, 'const handleStanjePdf = async () => {', '  async function addItem')
    expect(handler).toContain('fetch(`/api/punch?projectId=${project.id}`')
    expect(handler).toContain('GET /api/punch → HTTP ${res.status}')
    expect(handler).toContain("throw new TypeError('Odgovora /api/punch ni mogoče prebrati (ni polja).')")
    expect(handler).toContain('manjkajoč id v odgovoru API-ja')
    expect(handler).toContain('manjkajoč createdAt v odgovoru API-ja')
  })

  it('fail-closed toast (Ni točk prejemnega zapisnika + iskren opis) + fail-verbose (Izvoz ni uspel) + ENA izpeljava (punchZapisnikPregled(vnosi) pred generate + agregat toast)', () => {
    const handler = oknoMed(komponenta, 'const handleStanjePdf = async () => {', '  async function addItem')
    expect(handler).toContain("title: 'Ni točk prejemnega zapisnika',")
    expect(handler).toContain('Stanje zapisnika se izvozi, ko je vpisana prva točka projekta.')
    expect(handler).toContain("title: 'Izvoz ni uspel',")
    expect(handler).toContain('const { povzetek } = punchZapisnikPregled(vnosi)')
    expect(handler).toContain('generateZapisnikStanjePdf(vnosi, { now: new Date(), projektIme })')
    expect(handler).toContain('Zapisnik-stanje-…pdf — ${tockaBeseda(povzetek.tock)}, napak ${povzetek.napak}, odprtih ${povzetek.odprtih}, rešenost ${povzetek.resenostOdstotek} %.')
    expect(handler).toContain("title: 'Stanje zapisnika prenešeno v PDF',")
  })

  it('mini-vrstica: \'Zapisnik (viden seznam):\' + tockaBeseda + dot prioritetni RED/AMBER/GREEN + kondicionalna žetona ŽIVO samo kadar > 0 + ENA izpeljava memo', () => {
    const mini = oknoMed(komponenta, '{project && zapisnikStanjePovzetek !== null && (', '{/* R155: vidna napaka nalaganja')
    expect(mini).toContain('Zapisnik (viden seznam):')
    expect(mini).toContain('{tockaBeseda(zapisnikStanjePovzetek.tock)}')
    expect(mini).toContain('· napak {zapisnikStanjePovzetek.napak} · odprtih {zapisnikStanjePovzetek.odprtih} · rešenost {zapisnikStanjePovzetek.resenostOdstotek} %')
    expect(mini).toContain("'bg-roksal-red'")
    expect(mini).toContain("'bg-roksal-amber'")
    expect(mini).toContain("'bg-roksal-green'")
    expect(mini).toContain('{napakaBeseda(zapisnikStanjePovzetek.napak)}')
    expect(mini).toContain('{odprtaBeseda(zapisnikStanjePovzetek.odprtih)}')
    // ENA izpeljava: ISTI punchZapisnikPregled čez items (WYSIWYG — dve okni, ENA matemtika)
    const memo = oknoMed(komponenta, 'const zapisnikStanjePovzetek = useMemo(() => {', '}, [items, project])')
    expect(memo).toContain('return null')
    expect(memo).toContain('punchZapisnikPregled(')
    expect(memo).toContain('items.map')
  })

  it('legenda VEDNO vidna pri projektu + glava ZAPISNIK — STANJE PRED PREDAJO (NI duplicirana v komponenti) + 27. člen + 0 novih hex (lib IN komponenta)', () => {
    expect(komponenta).toContain('PDF = VSE točke zapisnika (tudi rešene — polna resnica, ne samo viden seznam)')
    expect(komponenta).not.toMatch(/#[0-9a-fA-F]{6}/)
    expect(lib).toContain("'ZAPISNIK — STANJE PRED PREDAJO'")
    expect(lib).toContain('Zapisnik-stanje-${todayStamp(now)}.pdf')
    expect(lib).not.toMatch(/#[0-9a-fA-F]{6}/)
    // 27. člen družine — dokumentirano v obeh virih
    expect(lib).toContain("27. člen")
    expect(komponenta).toContain('27. člen')
    // R249 doktrina: naslovni needleji v komponenti NE duplicirajo glave (glava = lib resnica)
    expect(komponenta).not.toContain('ZAPISNIK — STANJE PRED PREDAJO')
    // obstoječi izvozi NISO pokvarjeni (CSV + predajni zapisnik ostajata)
    expect(komponenta).toContain('buildPunchCsv, punchCsvFilename')
    expect(komponenta).toContain('PDF zapisnik')
    expect(komponenta).toContain('Izvozi CSV')
  })
})
