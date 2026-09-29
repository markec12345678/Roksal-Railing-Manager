// ---------------------------------------------------------------------------
// R269 — MERITVE — TERENSKI PREGLED PDF (25. člen 'izvozi' družine, P1-f) —
// testi. Bajtni dokazi (determinizem: enak vhod = bajtno enak PDF; PREMEŠAN
// VRSTNI RED = bajtno ENAK — akcijski sort interno + kanon seed po id,
// f(množica); %PDF- magija; NOV glifni razred — R249 doktrina; brat R266
// bajtno zdrav) + ENA resnica (KPI + tabela + sklep + toast + mini-vrstica iz
// ENE izpeljave meritevTerenPregled; VRSTICE EN VIR meritevVrstica R186 —
// ISTI graditelj vrstic kot CSV arhiv, ISTI fallbacki status/tip; statusi EN
// VIR MEASUREMENT_STATUS_VALUES R154; sklanjatev EN VIR meritvePovzetekBeseda
// R203; OSNUTEK = akcija AMBER, ARHIVIRANA = zgodovinska cona NE alarm) +
// fail-closed (podvojen id, neznani status, ne-nizovna besedilna polja,
// fizikalne mere R186, prazen seznam) + vsebinski dokazi na VIRU liba in
// komponente (pill VEDNO viden ko je projekt izbran, FRESH fetch
// /api/measurements?projectId — polna resnica projekta ob kliku, mini-
// vrstica state-oka, legenda pariteta, 0 novih hex).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildMeritveTerenPdfDoc,
  meritveTerenPdfFilename,
  meritevTerenPregled,
  osnutekBeseda,
  preveriMeritevVnos,
  sortirajMeritveTeren,
  type MeritveTerenVnos,
} from '@/lib/meritve-teren-pdf'
import { MEASUREMENT_STATUS_VALUES } from '@/lib/measurement-status'
import { meritvePovzetekBeseda } from '@/lib/meritve-povzetek'
import {
  buildOpremaCikelPdfDoc,
  type OpremaCikelVnos,
} from '@/lib/oprema-cikel-pdf'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

// okno med markerjema (r207/…/r257/r265/r266/r267/r268 vzorec)
function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  const b = src.indexOf(do_, a)
  if (a === -1 || b === -1) return ''
  return src.slice(a, b)
}

const lib = beri('src/lib/meritve-teren-pdf.ts')
const komponenta = beri('src/components/roksal/measurements-tab.tsx')

// FIXED now (determinizem — žig + CreationDate + fileId + ime).
const NOW: Date = new Date('2026-09-29T08:00:00.000Z')

// Osnovna meritev (razdalja, brez oznake — fallbacki R186) + nadgradbe.
function mer(over: Partial<MeritveTerenVnos> & Pick<MeritveTerenVnos, 'id'>): MeritveTerenVnos {
  return {
    createdAt: '2026-09-20T08:00:00.000Z',
    dolzinaMm: 1000,
    visinaMm: 1100,
    ...over,
  }
}

// 6 meritev — VSE veje: OSNUTEK ×2 (a2 z oznako — AMBER akcija; a1 BREZ
// oznake = iskren odpad, status+tip IZOSTANJETA → fallback R186 OSNUTEK/
// RAZDALJA), POTRJENA ×3 (p3/p1 ISTE oznake → datum izenačba, p2 STEBR),
// ARHIVIRANA ×1 (h1 — zgodovinska cona, NE alarm).
const MERITVE: MeritveTerenVnos[] = [
  mer({ id: 'p1', oznaka: 'Balkon — sever', status: 'POTRJENA', lokacija: 'Balkon' }),
  mer({ id: 'a1', createdAt: '2026-09-22T09:00:00.000Z', dolzinaMm: 800, visinaMm: 1400 }),
  mer({ id: 'p2', createdAt: '2026-09-21T10:00:00.000Z', oznaka: 'Stebriček 1', tipMeritve: 'STEBR', dolzinaMm: 950, status: 'POTRJENA' }),
  mer({ id: 'h1', createdAt: '2026-09-10T07:00:00.000Z', oznaka: 'Stara fasada', dolzinaMm: 2000, visinaMm: 1200, status: 'ARHIVIRANA', opomba: 'Potrjeno po telefonu' }),
  mer({ id: 'a2', createdAt: '2026-09-23T11:00:00.000Z', oznaka: 'Kot vhod', tipMeritve: 'KOT', dolzinaMm: 640, visinaMm: 900, status: 'OSNUTEK' }),
  mer({ id: 'p3', createdAt: '2026-09-18T06:00:00.000Z', oznaka: 'Balkon — sever', dolzinaMm: 1250, status: 'POTRJENA' }),
]

function zgradi(vhodi: readonly MeritveTerenVnos[] = MERITVE, now: Date = NOW, projektIme?: string | null): Buffer {
  const doc = buildMeritveTerenPdfDoc(vhodi, { now, projektIme })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R269 — PDF bajtni dokazi (determinizem + glifni razred — R249 doktrina)', () => {
  it('determinizem: enak vhod = bajtno enak; PREMEŠAN VRSTNI RED = bajtno ENAK (akcijski sort interno + kanon seed po id, f(množica)); drug now = drugačen', () => {
    expect(zgradi().equals(zgradi())).toBe(true)
    const preskakljani = zgradi([MERITVE[5], MERITVE[3], MERITVE[1], MERITVE[4], MERITVE[0], MERITVE[2]])
    expect(preskakljani.equals(zgradi())).toBe(true)
    expect(zgradi(MERITVE, new Date('2026-09-29T08:01:00.000Z')).equals(zgradi())).toBe(false)
  })

  it('%PDF- magija + NOV glifni razred (≠ vseh 34 znanih družinskih razredov IN ≠ brat R266) + ime Meritve-teren-YYYY-MM-DD.pdf', () => {
    const bin = zgradi()
    expect(bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    const znani = [30057, 30119, 30191, 30253, 35565, 38753, 39927, 41519, 42798, 37709, 37771, 36788, 36656, 36532, 33958, 36555, 38631, 45508, 44828, 36260, 36583, 45127, 38565, 38909, 40261, 35409, 37228, 39094, 41009, 37560, 38744, 43572, 51142, 45074]
    expect(znani).not.toContain(bin.length)
    // Brat R266 z ISTIMI vhodi kot njegov test — drug dokument = druga dolžina.
    const oprema: OpremaCikelVnos[] = [
      { id: 'e1', naziv: 'Laserni merilec', tip: 'Merska oprema', status: 'NA_VOLJO', lokacija: 'Delavnica', serijskaStevilka: 'SN-1', lastInspectionAt: '2026-01-01T00:00:00.000Z', inspectionIntervalDays: 180, nextInspectionAt: '2026-06-30T00:00:00.000Z', inspectionDue: true, inspectionUnknown: false, calibrationRequired: true, calibrationDueDate: '2026-08-01T00:00:00.000Z', calibrationCertificate: null, calibrationOverdue: true, calibrationMissing: false, zadnjiServis: null, assignmentsCount: 2 },
      { id: 'e2', naziv: 'Ladder A', tip: 'Ročno orodje', status: 'IZGUBLJENO', lokacija: null, serijskaStevilka: null, lastInspectionAt: null, inspectionIntervalDays: null, nextInspectionAt: null, inspectionDue: false, inspectionUnknown: false, calibrationRequired: false, calibrationDueDate: null, calibrationCertificate: null, calibrationOverdue: false, calibrationMissing: false, zadnjiServis: null, assignmentsCount: 0 },
    ]
    const r266Bin = Buffer.from(buildOpremaCikelPdfDoc(oprema, { now: NOW }).output('arraybuffer'))
    expect(r266Bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(bin.length).not.toBe(r266Bin.length)
    expect(meritveTerenPdfFilename(NOW)).toBe('Meritve-teren-2026-09-29.pdf')
    expect(() => meritveTerenPdfFilename('danes' as unknown as Date)).toThrow(TypeError)
  })

  it('soli 0xa1–0xa4 — UNIKATNE v družini (register: ekipa-stanje 0x9d–0xa0 — bratje NE delijo semen)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0xa1)')
    expect(lib).toContain('fnv1aHex(seed, 0xa4)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x9d)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x99)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x95)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x91)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x8d)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x89)')
  })
})

describe('R269 — ENA resnica (KPI + tabela + sklep + toast iz ENE izpeljave)', () => {
  it('povzetek: 6 meritev, osnutkov 2, potrjenih 3, arhiviranih 1, skupna dolžina 6640 mm, tipov 3', () => {
    const { povzetek } = meritevTerenPregled(MERITVE)
    expect(povzetek).toEqual({
      meritev: 6,
      osnutkov: 2,
      potrjenih: 3,
      arhiviranih: 1,
      skupnaDolzinaMm: 6640,
      tipov: 3,
    })
  })

  it('sort akcijski red: OSNUTEK (oznaka ASC, brez oznake ZADNJA) → POTRJENA (ista oznaka → datum ASC) → ARHIVIRANA; premešan vhod = ISTI povzetek (f(MNOŽICA))', () => {
    const { vrste } = meritevTerenPregled(MERITVE)
    expect(vrste.map((v) => v.id)).toEqual(['a2', 'a1', 'p3', 'p1', 'p2', 'h1'])
    // sort IZVOŽEN — klic na sortirajMeritveTeren z istim poljem je idempotenten.
    const kopija = meritevTerenPregled(MERITVE).vrste
    expect(sortirajMeritveTeren([...kopija]).map((v) => v.id)).toEqual(['a2', 'a1', 'p3', 'p1', 'p2', 'h1'])
  })

  it('status+tip EN VIR meritevVrstica R186 (izostanek = OSNUTEK/RAZDALJA — ISTI fallback kot CSV arhiv) + datum DD.MM.YYYY + brez oznake/lokacije = iskren null', () => {
    const { vrste } = meritevTerenPregled(MERITVE)
    const a1 = vrste.find((v) => v.id === 'a1')
    expect(a1?.status).toBe('OSNUTEK')
    expect(a1?.tip).toBe('RAZDALJA')
    expect(a1?.oznaka).toBeNull()
    const p1 = vrste.find((v) => v.id === 'p1')
    expect(p1?.datum).toBe('20.09.2026')
    expect(p1?.tip).toBe('RAZDALJA')
    expect(p1?.lokacija).toBe('Balkon')
    expect(p1?.opomba).toBeNull()
    const h1 = vrste.find((v) => v.id === 'h1')
    expect(h1?.opomba).toBe('Potrjeno po telefonu')
    expect(h1?.datum).toBe('10.09.2026')
  })

  it('sklanjatev EN VIR: meritvePovzetekBeseda R203 (meritev / meritvi / meritve / 5+ — vraca SAMO besedo, klicalec zlaga števec; 101 meritev) + NOVA osnutekBeseda (1 osnutek / 2 osnutka / 3-4 osnutki / 5+ osnutkov; 11-14; 101 osnutek)', () => {
    expect(meritvePovzetekBeseda(1)).toBe('meritev')
    expect(meritvePovzetekBeseda(2)).toBe('meritvi')
    expect(meritvePovzetekBeseda(4)).toBe('meritve')
    expect(meritvePovzetekBeseda(5)).toBe('meritev')
    expect(meritvePovzetekBeseda(101)).toBe('meritev')
    expect(`1 ${meritvePovzetekBeseda(1)}`).toBe('1 meritev')
    expect(`101 ${meritvePovzetekBeseda(101)}`).toBe('101 meritev')
    expect(osnutekBeseda(0)).toBe('0 osnutkov')
    expect(osnutekBeseda(1)).toBe('1 osnutek')
    expect(osnutekBeseda(2)).toBe('2 osnutka')
    expect(osnutekBeseda(4)).toBe('4 osnutki')
    expect(osnutekBeseda(5)).toBe('5 osnutkov')
    expect(osnutekBeseda(12)).toBe('12 osnutkov')
    expect(osnutekBeseda(101)).toBe('101 osnutek')
    expect(() => osnutekBeseda(-1)).toThrow(TypeError)
    expect(() => osnutekBeseda(1.5)).toThrow(TypeError)
  })

  it('akcijski red pokrit — VSEH 3 znanih statusov (AKCIJSKI_RED se ne prevede, če status manjka — EN VIR MEASUREMENT_STATUS_VALUES R154); neznani status → TypeError', () => {
    expect(MEASUREMENT_STATUS_VALUES).toEqual(['OSNUTEK', 'POTRJENA', 'ARHIVIRANA'])
    const vse = MEASUREMENT_STATUS_VALUES.map((s, i) =>
      mer({ id: `s${i}`, status: s, oznaka: `m-${s}` }),
    )
    const { vrste } = meritevTerenPregled(vse)
    expect(vrste.map((v) => v.status)).toEqual(['OSNUTEK', 'POTRJENA', 'ARHIVIRANA'])
    expect(() => meritevTerenPregled([mer({ id: 'x1', status: 'NEZNAN' })])).toThrow(
      'status mora biti eden izmed 3 znanih (OSNUTEK/POTRJENA/ARHIVIRANA), ne NEZNAN',
    )
  })
})

describe('R269 — fail-closed v libu (družina R236/R250–R268)', () => {
  it('prazen seznam meritev ne nastaja dokumenta — TypeError s toast sporočilom komponente (obe vrati: build IN pregled)', () => {
    expect(() => buildMeritveTerenPdfDoc([], { now: NOW })).toThrow(TypeError)
    expect(() => buildMeritveTerenPdfDoc([], { now: NOW })).toThrow('prazen seznam meritev ne nastaja dokumenta')
    expect(() => meritevTerenPregled([])).toThrow('prazen seznam meritev ne nastaja dokumenta — terenski pregled se izvozi, ko je vpisana prva meritev projekta')
  })

  it('fail-closed: podvojen id, ne-polje, ne-options, pokvaren now, null vnos, ne-nizovna besedilna polja, fizikalne mere R186 (negativna mm, pokvaren createdAt, prazen id) — indeks krivca', () => {
    expect(() => meritevTerenPregled([MERITVE[0], { ...MERITVE[0] }])).toThrow('podvojen id meritve p1')
    expect(() => buildMeritveTerenPdfDoc('ne-polje' as unknown as MeritveTerenVnos[], { now: NOW })).toThrow(TypeError)
    expect(() => buildMeritveTerenPdfDoc(MERITVE, null as unknown as { now: Date })).toThrow(TypeError)
    expect(() => buildMeritveTerenPdfDoc(MERITVE, { now: 'danes' as unknown as Date })).toThrow(TypeError)
    expect(() => buildMeritveTerenPdfDoc(MERITVE, { now: new Date(NaN) })).toThrow(TypeError)
    expect(() => preveriMeritevVnos(null as unknown as MeritveTerenVnos, 2)).toThrow('pričakovana meritev')
    // ne-nizovna besedilna polja — pokvaren vir NE sme tiho priti na list.
    expect(() => preveriMeritevVnos({ ...MERITVE[0], oznaka: 42 as unknown as string }, 2)).toThrow('oznaka mora biti niz ALI null')
    expect(() => preveriMeritevVnos({ ...MERITVE[0], lokacija: true as unknown as string }, 2)).toThrow('lokacija mora biti niz ALI null')
    expect(() => preveriMeritevVnos({ ...MERITVE[0], opomba: 7 as unknown as string }, 2)).toThrow('opomba mora biti niz ALI null')
    expect(() => preveriMeritevVnos({ ...MERITVE[0], tipMeritve: 3 as unknown as string }, 2)).toThrow('tipMeritve mora biti niz ALI null')
    expect(() => preveriMeritevVnos({ ...MERITVE[0], tipPodlage: {} as unknown as string }, 2)).toThrow('tipPodlage mora biti niz ALI null')
    // fizikalne mere + identiteta + datum — EN VIR meritevVrstica R186 (indeks ovit).
    expect(() => meritevTerenPregled([{ ...MERITVE[0], dolzinaMm: -5 }])).toThrow('meritev 0:')
    expect(() => meritevTerenPregled([{ ...MERITVE[0], visinaMm: Number.POSITIVE_INFINITY }])).toThrow('meritev 0:')
    expect(() => meritevTerenPregled([{ ...MERITVE[0], createdAt: 'ne-iso' }])).toThrow('meritev 0:')
    expect(() => meritevTerenPregled([{ ...MERITVE[0], id: '' }])).toThrow('meritev 0:')
  })

  it('projektIme: niz ALI null (ne-niz → TypeError); prazno/izostanjeno = iskren \'Brez imena projekta\' (R203 pariteta — glava nosi ime)', () => {
    expect(() => buildMeritveTerenPdfDoc(MERITVE, { now: NOW, projektIme: 42 as unknown as string })).toThrow('projektIme mora biti niz ALI null')
    const brez = zgradi(MERITVE, NOW, null)
    const prazen = zgradi(MERITVE, NOW, '')
    const izostanjeno = zgradi(MERITVE, NOW, undefined)
    expect(brez.equals(prazen)).toBe(true)
    expect(brez.equals(izostanjeno)).toBe(true)
    const zImenom = zgradi(MERITVE, NOW, 'Balkon — Novak')
    expect(zImenom.equals(brez)).toBe(false)
  })
})

describe('R269 — WYSIWYG vir (tabela + KPI + sklep)', () => {
  it('tabela 8 stolpcev (Datum, Oznaka, Tip, Dolžina (mm), Višina (mm), Status, Lokacija, Opomba) — head dobesedno', () => {
    expect(lib).toContain("['Datum', 'Oznaka', 'Tip', 'Dolžina (mm)', 'Višina (mm)', 'Status', 'Lokacija', 'Opomba']")
  })

  it('barvna resnica: OSNUTEK AMBER bold (akcija — čaka potrditev), POTRJENA GREEN, ARHIVIRANA sivo (zgodovina), \'—\' sivo; NIKOLI utišan alarm', () => {
    const okno = oknoMed(lib, 'didParseCell:', '})\n  y =')
    expect(okno).toContain("v.status === 'OSNUTEK'")
    expect(okno).toContain("v.status === 'POTRJENA'")
    expect(okno).toContain("v.status === 'ARHIVIRANA'")
    expect(okno).toContain('textColor = AMBER')
    expect(okno).toContain('textColor = GREEN')
    expect(okno).toContain('textColor = GRAY')
    expect(okno).toContain("fontStyle = 'bold'")
    expect(okno).toContain("raw === '—'")
  })

  it('KPI 5 boxov z signalnim jezikom (meritev NAVY, osnutki AMBER>0, potrjenih GREEN, arhiviranih NAVY, skupna dolžina m)', () => {
    expect(lib).toContain("'Meritev'")
    expect(lib).toContain("'Osnutki'")
    expect(lib).toContain("'Potrjenih'")
    expect(lib).toContain("'Arhiviranih'")
    expect(lib).toContain("'Skupna dolžina'")
    expect(lib).toContain('povzetek.osnutkov > 0 ? AMBER : GREEN')
    expect(lib).toContain('(povzetek.skupnaDolzinaMm / 1000).toFixed(2)} m`')
  })

  it('sklep: akcija + cone poimenovane + kode VERBATIM (CSV pariteta) + referenčni pregled — VSE meritve, tudi arhivirane + vir resnica dostopa', () => {
    expect(lib).toContain('(akcija — pregled in potrditev)')
    expect(lib).toContain('(pripravljeno za pripravo izdelave)')
    expect(lib).toContain('(zgodovinska cona)')
    expect(lib).toContain('(Σ vseh meritev — kanonične enote mm)')
    expect(lib).toContain('statusi in tipi = kode VERBATIM (ista resnica kot CSV izvoz)')
    expect(lib).toContain('(referenčni pregled — VSE meritve projekta, tudi arhivirane)')
    expect(lib).toContain('vir = /api/measurements?projectId (resnica dostopa do projekta)')
  })

  it('glava MERITVE — TERENSKI PREGLED + projekt: ime + osveženo + noge Stran i/N + NOVI datotečni kontrakt Meritve-teren- + brez locale + NIČ mreže v libu', () => {
    expect(lib).toContain("'MERITVE — TERENSKI PREGLED'")
    expect(lib).toContain('projekt: ${imeProjekta}')
    expect(lib).toContain('Brez imena projekta')
    expect(lib).toContain('osveženo ${zalogaPovzetekCasOznaka(now)}')
    expect(lib).toContain('Stran ${i}/${strani}')
    expect(lib).toContain("`Meritve-teren-${todayStamp(now)}.pdf`")
    expect(lib).not.toContain('localeCompare')
    expect(lib).not.toContain('toLocaleString')
    expect(lib).not.toContain('toLocaleDateString')
    expect(lib).not.toContain('fetch(')
    expect(lib).not.toContain("from 'node:crypto'")
  })
})

describe('R269 — komponenta (measurements-tab) — pill, mini-vrstica, handler, legenda', () => {
  it('pill VEDNO viden, ko je projekt izbran (NI gated na filteredMeasurements.length — pariteta R263–R268) + disabled={pdfVteku} dvoklik guard + press-scale + FileDown aria-hidden', () => {
    expect(komponenta).toContain('aria-label="Izvozi terenski pregled meritev kot PDF"')
    expect(komponenta).toContain('title="Terenski pregled meritev kot pravi PDF — VSE meritve projekta (tudi arhivirane)"')
    const pil = oknoMed(komponenta, "R269 — terenski pregled PDF (25. člen 'izvozi' družine): VEDNO", '<FileDown aria-hidden="true" className="h-3 w-3"')
    expect(pil).toContain('disabled={pdfVteku}')
    expect(pil).not.toContain('filteredMeasurements.length')
    expect(pil).toContain('selectedProject &&')
    expect(komponenta).toContain('<FileDown aria-hidden="true" className="h-3 w-3" />')
    expect(komponenta).toContain('<Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />')
    // press-scale = pariteta žetona z družino (na točno tisto vrsto, ki jo ima
    // SAMO PDF gumb — sorojeniki CSV/Povzetek imajo brez).
    expect(komponenta).toContain('press-scale active:scale-[0.96] hover:text-roksal-ink')
  })

  it('F2 mini-vrstica (state-oka — kar uporabnik vidi): dot roksal-amber/green, kondicionalni žeton ŽIVO samo kadar akcija (R256 lekcija 4), tabular-nums, ISTA izpeljava meritevTerenPregled', () => {
    const mini = oknoMed(komponenta, 'R269 — F2 mini-vrstica stanja meritev', '{/* Bulk toolbar')
    expect(mini).toContain('Meritve (viden seznam):')
    expect(mini).toContain("bg-roksal-amber' : 'bg-roksal-green'")
    expect(mini).toContain('{terenPovzetek.osnutkov > 0 && (')
    expect(mini).toContain('border-roksal-amber/40 bg-roksal-amber/10')
    expect(mini).toContain('{osnutekBeseda(terenPovzetek.osnutkov)}')
    expect(mini).toContain('tabular-nums')
    expect(mini).toContain('{terenPovzetek.meritev} {meritvePovzetekBeseda(terenPovzetek.meritev)}')
  })

  it('dve okni, ENA matemtika: mini (state) IN PDF (fresh) = ISTA funkcija meritevTerenPregled (import + memo + handler) — NIKOLI zasegana kopija; lib EN VIR ×3 (meritve-csv R186 + measurement-status R154 + meritve-povzetek R203)', () => {
    expect(komponenta).toContain('meritevTerenPregled,\n  generateMeritveTerenPdf,')
    expect(komponenta).toContain('meritevTerenPregled(\n      filteredMeasurements.map')
    expect(komponenta).toContain('const { povzetek } = meritevTerenPregled(vnosi)')
    expect(lib).toContain("from './meritve-csv'")
    expect(lib).toContain('meritevVrstica(o)')
    expect(lib).toContain("from './measurement-status'")
    expect(lib).toContain("from './meritve-povzetek'")
  })

  it('handler: FRESH fetch /api/measurements?projectId (polna resnica projekta ob kliku — nič state-a) + HTTP razlog + ne-polje → TypeError + brez projekta guard + dvoklik guard + fail-closed PREJ (Ni vpisanih meritev) → ENA izpeljava → generate + projektIme; razlog viden', () => {
    const okno = oknoMed(komponenta, 'const handleTerenPdf', '// ── Primerjava')
    expect(okno).toContain('if (pdfVteku) return')
    expect(okno).toContain("if (!selectedProject) {")
    expect(okno).toContain("'Ni izbranega projekta'")
    expect(okno).toContain('fetch(`/api/measurements?projectId=${selectedProject}`, {')
    expect(okno).toContain('GET /api/measurements → HTTP ${res.status}')
    expect(okno).toContain('Odgovora /api/measurements ni mogoče prebrati (ni polja).')
    expect(okno).toContain("toast.error('Ni vpisanih meritev'")
    expect(okno).toContain("'Terenski pregled se izvozi, ko je vpisana prva meritev projekta.'")
    const prazen = okno.indexOf('vnosi.length === 0')
    const generiraj = okno.indexOf('generateMeritveTerenPdf(')
    expect(prazen).toBeGreaterThanOrEqual(0)
    expect(generiraj).toBeGreaterThan(prazen)
    expect(okno).toContain('generateMeritveTerenPdf(vnosi, { now: new Date(), projektIme })')
    expect(okno).toContain("projects.find((p) => p.id === selectedProject)?.nazivProjekta || null")
    expect(okno).toContain("toast.success('Terenski pregled meritev prenešen v PDF'")
    expect(okno).toContain('Meritve-teren-…pdf — ${povzetek.meritev} ${meritvePovzetekBeseda(povzetek.meritev)}, osnutki ${povzetek.osnutkov}, potrjenih ${povzetek.potrjenih}, arhiviranih ${povzetek.arhiviranih}.')
    expect(okno).toContain('setPdfVteku(false)')
  })

  it('fail-verbose DTO pruning: vrstica brez id/createdAt, ne-fizikalne mere ALI pokvaren arMetadata → TypeError z imenovanim krivcem (R264–R268 vzorec; UI parser toleranten — dokument resnice NIČ tihega preskočevanja)', () => {
    const okno = oknoMed(komponenta, 'const vrstice = data as Array<Record<string, unknown>>', 'if (vnosi.length === 0)')
    expect(okno).toContain('manjkajoč id v odgovoru API-ja')
    expect(okno).toContain('manjkajoč createdAt v odgovoru API-ja')
    expect(okno).toContain('dolzinaMm mora biti ne-negativno končno število')
    expect(okno).toContain('visinaMm mora biti ne-negativno končno število')
    expect(okno).toContain('arMetadata mora biti niz ALI null')
    expect(okno).toContain('arMetadata ni razumljen kot JSON objekt (pokvaren vir)')
  })

  it('legenda pill pariteta (družina): PDF = VSE meritve projekta — polna resnica, ne samo viden seznam filtrov; VEDNO vidna, ko je projekt izbran (tudi pri praznem seznamu)', () => {
    expect(komponenta).toContain('PDF = VSE meritve projekta (tudi arhivirane — polna resnica, ne samo viden seznam filtrov)')
    const legenda = oknoMed(komponenta, 'R269 — legenda pill pariteta', '{/* R269 — F2 mini-vrstica')
    expect(legenda).toContain('selectedProject &&')
    expect(legenda).not.toContain('filteredMeasurements.length')
  })

  it('brata R266/R267/R268 NESPREMENJENA (soli pri bratih ostajajo — bajtno zdravi tudi po R269) + CSV izvoz R186 NESPREMENJEN (viden seznam + fail-closed ostajata)', () => {
    const r268 = beri('src/lib/ekipa-stanje-pdf.ts')
    expect(r268).toContain('fnv1aHex(seed, 0x9d)')
    expect(r268).toContain('fnv1aHex(seed, 0xa0)')
    const r267 = beri('src/lib/ponudbe-spomniki-pdf.ts')
    expect(r267).toContain('fnv1aHex(seed, 0x99)')
    expect(r267).toContain('fnv1aHex(seed, 0x9c)')
    const r186 = beri('src/lib/meritve-csv.ts')
    expect(r186).toContain('export function meritevVrstica')
    expect(r186).toContain('export function meritveCsv')
    expect(komponenta).toContain('function izvoziMeritveCsv()')
    expect(komponenta).toContain("aria-label=\"Izvozi vidne meritve kot CSV\"")
  })

  it('0 novih hex (žetoni samo — družinsko pravilo R224–R268)', () => {
    const mini = oknoMed(komponenta, 'R269 — F2 mini-vrstica stanja meritev', '{/* Bulk toolbar')
    expect(mini).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(mini).not.toContain('bg-[#')
    expect(mini).not.toContain('text-[#')
    expect(mini).not.toContain('border-[#')
  })
})
