// ---------------------------------------------------------------------------
// R267 — PONUDBE — SPOMNIŠKI PREGLED PDF (23. člen 'izvozi' družine, P1-f) —
// testi. Bajtni dokazi (determinizem: enak vhod = bajtno enak PDF; PREMEŠAN
// VRSTNI RED = bajtno ENAK — akcijski sort interno + kanon seed po id,
// f(množica); %PDF- magija; NOV glifni razred — R249 doktrina; brat R266
// bajtno zdrav) + ENA resnica (KPI + tabela + sklep + toast iz ENE izpeljave
// ponudbeSpomnikiPregled; stanje spomnika EN VIR stanjeSpomnika R161 —
// Zapadel/Danes/Kmalu/Planirano/Brez spomnika; podpisana = zgodovinska cona,
// NE alarm) + fail-closed (podvojen id, neznan status, dealLocked ne-boolean,
// ne-ISO datum, prazen seznam) + vsebinski dokazi na VIRU liba in komponente
// (pill VEDNO viden, FRESH fetch /api/projects — polna resnica vloge,
// mini-vrstica state-oka, legenda pariteta, 0 novih hex).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildPonudbeSpomnikiPdfDoc,
  ponudbeSpomnikiPdfFilename,
  ponudbeSpomnikiPregled,
  preveriPonudboVnos,
  sortirajPonudbeSpomniki,
  type PonudbaSpomnikiVnos,
} from '@/lib/ponudbe-spomniki-pdf'
import { stanjeSpomnika, ponudbeLabel } from '@/lib/ponudbe-csv'
import {
  buildOpremaCikelPdfDoc,
  type OpremaCikelVnos,
} from '@/lib/oprema-cikel-pdf'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

// okno med markerjema (r207/…/r257/r265/r266 vzorec)
function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  const b = src.indexOf(do_, a)
  if (a === -1 || b === -1) return ''
  return src.slice(a, b)
}

const lib = beri('src/lib/ponudbe-spomniki-pdf.ts')
const komponenta = beri('src/components/roksal/quote-followup.tsx')

// FIXED now (determinizem — žig + CreationDate + fileId + ime + DANES za stanje).
const NOW: Date = new Date('2026-09-29T08:00:00.000Z')

// Osnovna ponudba (odprta, NACRTOVANO, brez spomnika) + nadgradbe.
function ponudba(over: Partial<PonudbaSpomnikiVnos> & Pick<PonudbaSpomnikiVnos, 'id' | 'nazivProjekta'>): PonudbaSpomnikiVnos {
  return {
    stranka: null,
    status: 'NACRTOVANO',
    dealLocked: false,
    followUpDate: null,
    followUpOpomba: null,
    datumMontaze: null,
    ...over,
  }
}

// 5 ponudb — VSE veje: zapadel spomnik (p1, RED akcija), spomnik danes (p2,
// NAVY akcija), kmalu 1–3 dni (p3, AMBER), brez spomnika (p5, AMBER akcija),
// podpisana z zapadelim spomnikom (p4 — zgodovinska cona, NE alarm).
const PONUDBE: PonudbaSpomnikiVnos[] = [
  ponudba({ id: 'p1', nazivProjekta: 'Ograja Alenka', stranka: 'Stranka Alenka', followUpDate: '2026-09-01T09:00:00.000Z', followUpOpomba: 'Pokliči stranko — sledenje ponudbe', datumMontaze: '2026-10-02T08:00:00.000Z' }),
  ponudba({ id: 'p2', nazivProjekta: 'Terasa Bernard', status: 'V_TEKU', followUpDate: '2026-09-29T09:00:00.000Z' }),
  ponudba({ id: 'p3', nazivProjekta: 'Balustrada Cvetka', stranka: 'Stranka Cvetka', followUpDate: '2026-10-01T09:00:00.000Z', datumMontaze: '2026-10-10T08:00:00.000Z' }),
  ponudba({ id: 'p4', nazivProjekta: 'Pergola Danica', stranka: 'Stranka Danica', status: 'ZAKLJUCENO', dealLocked: true, followUpDate: '2026-08-15T09:00:00.000Z' }),
  ponudba({ id: 'p5', nazivProjekta: 'Zunanji sistem Emila', stranka: 'Stranka Emila', status: 'V_TEKU' }),
]

function zgradi(vhodi: readonly PonudbaSpomnikiVnos[] = PONUDBE, now: Date = NOW): Buffer {
  const doc = buildPonudbeSpomnikiPdfDoc(vhodi, { now })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R267 — PDF bajtni dokazi (determinizem + glifni razred — R249 doktrina)', () => {
  it('determinizem: enak vhod = bajtno enak; PREMEŠAN VRSTNI RED = bajtno ENAK (akcijski sort interno + kanon seed po id, f(množica)); drug now = drugačen', () => {
    expect(zgradi().equals(zgradi())).toBe(true)
    const preskakljani = zgradi([PONUDBE[4], PONUDBE[2], PONUDBE[0], PONUDBE[3], PONUDBE[1]])
    expect(preskakljani.equals(zgradi())).toBe(true)
    expect(zgradi(PONUDBE, new Date('2026-09-29T08:01:00.000Z')).equals(zgradi())).toBe(false)
  })

  it('%PDF- magija + NOV glifni razred (≠ vseh 32 znanih družinskih razredov IN ≠ brat R266) + ime Ponudbe-spomniki-YYYY-MM-DD.pdf', () => {
    const bin = zgradi()
    expect(bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    const znani = [30057, 30119, 30191, 30253, 35565, 38753, 39927, 41519, 42798, 37709, 37771, 36788, 36656, 36532, 33958, 36555, 38631, 45508, 44828, 36260, 36583, 45127, 38565, 38909, 40261, 35409, 37228, 39094, 41009, 37560, 38744, 43572]
    expect(znani).not.toContain(bin.length)
    // Brat R266 z ISTIMI vhodi kot njegov test — drug dokument = druga dolžina.
    const oprema: OpremaCikelVnos[] = [
      { id: 'e1', naziv: 'Laserni merilec', tip: 'Merska oprema', status: 'NA_VOLJO', lokacija: 'Delavnica', serijskaStevilka: 'SN-1', lastInspectionAt: '2026-01-01T00:00:00.000Z', inspectionIntervalDays: 180, nextInspectionAt: '2026-06-30T00:00:00.000Z', inspectionDue: true, inspectionUnknown: false, calibrationRequired: true, calibrationDueDate: '2026-08-01T00:00:00.000Z', calibrationCertificate: null, calibrationOverdue: true, calibrationMissing: false, zadnjiServis: null, assignmentsCount: 2 },
      { id: 'e2', naziv: 'Ladder A', tip: 'Ročno orodje', status: 'IZGUBLJENO', lokacija: null, serijskaStevilka: null, lastInspectionAt: null, inspectionIntervalDays: null, nextInspectionAt: null, inspectionDue: false, inspectionUnknown: false, calibrationRequired: false, calibrationDueDate: null, calibrationCertificate: null, calibrationOverdue: false, calibrationMissing: false, zadnjiServis: null, assignmentsCount: 0 },
    ]
    const r266Bin = Buffer.from(buildOpremaCikelPdfDoc(oprema, { now: NOW }).output('arraybuffer'))
    expect(r266Bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(bin.length).not.toBe(r266Bin.length)
    expect(ponudbeSpomnikiPdfFilename(NOW)).toBe('Ponudbe-spomniki-2026-09-29.pdf')
    expect(() => ponudbeSpomnikiPdfFilename('danes' as unknown as Date)).toThrow(TypeError)
  })

  it('soli 0x99–0x9c — UNIKATNE v družini (register: oprema-cikel 0x95–0x98 — bratje NE delijo semen)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0x99)')
    expect(lib).toContain('fnv1aHex(seed, 0x9c)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x95)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x91)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x8d)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x89)')
  })
})

describe('R267 — ENA resnica (KPI + tabela + sklep + toast iz ENE izpeljave)', () => {
  it('povzetek: 5 ponudb, 4 odprtih, 1 podpisanih, zapadel 1 (p1; podpisana p4 NE alarm), danes 1 (p2), kmalu 1 (p3), brez spomnika 1 (p5), statusi 2/2/1/0', () => {
    const { povzetek } = ponudbeSpomnikiPregled(PONUDBE, NOW)
    expect(povzetek.ponudb).toBe(5)
    expect(povzetek.odprtih).toBe(4)
    expect(povzetek.podpisanih).toBe(1)
    expect(povzetek.zapadelOprtih).toBe(1)
    expect(povzetek.danesOprtih).toBe(1)
    expect(povzetek.kmaluOprtih).toBe(1)
    expect(povzetek.brezSpomnikaOprtih).toBe(1)
    expect(povzetek.nacrtovanih).toBe(2)
    expect(povzetek.vTeku).toBe(2)
    expect(povzetek.zakljucenih).toBe(1)
    expect(povzetek.ustavljenih).toBe(0)
  })

  it('sort akcijski red: odprte prve (podpisana ASC), spomnik ASC z null ZADNJI (najstarejši zapadel prvi — brez spomnika iskren konec), naziv ASC, id izenačba; premešan vhod = ISTI povzetek (f(MNOŽICA))', () => {
    const { vrste } = ponudbeSpomnikiPregled(PONUDBE, NOW)
    expect(vrste.map((v) => v.id)).toEqual(['p1', 'p2', 'p3', 'p5', 'p4'])
    const enak = sortirajPonudbeSpomniki([
      { ...vrste[0], id: 'z9', naziv: 'Enak Naziv' },
      { ...vrste[0], id: 'a1', naziv: 'Enak Naziv' },
    ])
    expect(enak.map((v) => v.id)).toEqual(['a1', 'z9'])
    const premešan = ponudbeSpomnikiPregled([PONUDBE[4], PONUDBE[1], PONUDBE[0], PONUDBE[3], PONUDBE[2]], NOW)
    expect(premešan.povzetek).toEqual(ponudbeSpomnikiPregled(PONUDBE, NOW).povzetek)
  })

  it('stanje spomnika EN VIR stanjeSpomnika (R161 — dnevna ravni, čisto stringovno) + status oznake iz PONUDBE_STATUS_LABELS; podpisana ohrani resnico stanja (zgodovina, ne alarm)', () => {
    const { vrste } = ponudbeSpomnikiPregled(PONUDBE, NOW)
    const p1 = vrste.find((v) => v.id === 'p1')!
    expect(p1.stanje).toBe('Zapadel')
    expect(p1.status).toBe('Načrtovano')
    expect(p1.statusKoda).toBe('NACRTOVANO')
    expect(p1.spomnik).toBe('2026-09-01T09:00:00.000Z')
    expect(p1.podpisano).toBe(false)
    const p2 = vrste.find((v) => v.id === 'p2')!
    expect(p2.stanje).toBe('Danes')
    expect(p2.status).toBe('V teku')
    const p3 = vrste.find((v) => v.id === 'p3')!
    expect(p3.stanje).toBe('Kmalu')
    const p5 = vrste.find((v) => v.id === 'p5')!
    expect(p5.stanje).toBe('Brez spomnika')
    const p4 = vrste.find((v) => v.id === 'p4')!
    expect(p4.stanje).toBe('Zapadel')
    expect(p4.podpisano).toBe(true)
    expect(p4.status).toBe('Zaključeno')
    // EN VIR dokaz: ISTA funkcija R161 daje ISTO resnico (NI zasegane kopije).
    expect(stanjeSpomnika('2026-09-01T09:00:00.000Z', '2026-09-29')).toBe('Zapadel')
    expect(stanjeSpomnika('2026-09-29T09:00:00.000Z', '2026-09-29')).toBe('Danes')
    expect(stanjeSpomnika(null, '2026-09-29')).toBe('Brez spomnika')
  })

  it('planirano veja (> 3 dni) + USTAVLJENO status + sklanjatev ponudbeLabel EN VIR (1 ponudba / 2 ponudbi / 3-4 ponudbe / 5+ ponudb)', () => {
    const planirana = ponudba({ id: 'q1', nazivProjekta: 'Planirana', followUpDate: '2026-10-05T09:00:00.000Z', status: 'USTAVLJENO' })
    const { vrste, povzetek } = ponudbeSpomnikiPregled([planirana], NOW)
    expect(vrste[0].stanje).toBe('Planirano')
    expect(povzetek.ustavljenih).toBe(1)
    expect(povzetek.zapadelOprtih).toBe(0)
    expect(ponudbeLabel(1)).toBe('1 ponudba')
    expect(ponudbeLabel(2)).toBe('2 ponudbi')
    expect(ponudbeLabel(4)).toBe('4 ponudbe')
    expect(ponudbeLabel(5)).toBe('5 ponudb')
    expect(ponudbeLabel(11)).toBe('11 ponudb') // 11–14 = 'ponudb' (dvojinski izjemi R161)
    expect(ponudbeLabel(21)).toBe('21 ponudba')
    expect(ponudbeLabel(101)).toBe('101 ponudba') // singular po enicah (dejansko vedenje R161 vira)
    expect(() => ponudbeLabel(1.5)).toThrow(TypeError)
    expect(() => ponudbeLabel(-1)).toThrow(TypeError)
  })
})

describe('R267 — fail-closed v libu (družina R236/R250–R266)', () => {
  it('prazen seznam ponudb ne nastaja dokumenta — TypeError s toast sporočilom komponente (obe vrati: build IN pregled)', () => {
    expect(() => buildPonudbeSpomnikiPdfDoc([], { now: NOW })).toThrow(TypeError)
    expect(() => buildPonudbeSpomnikiPdfDoc([], { now: NOW })).toThrow('prazen seznam ponudb ne nastaja dokumenta')
    expect(() => ponudbeSpomnikiPregled([], NOW)).toThrow('prazen seznam ponudb ne nastaja dokumenta — pregled se izvozi, ko je vpisana prva ponudba')
  })

  it('fail-closed ×11: podvojen id, ne-polje, ne-options, pokvaren now, null vnos, prazni id/naziv, neznan status, dealLocked ne-boolean, ne-ISO datum, stranka/opomba ne-niz-null — indeks krivca', () => {
    expect(() => ponudbeSpomnikiPregled([PONUDBE[0], { ...PONUDBE[0] }], NOW)).toThrow('podvojen id ponudbe p1')
    expect(() => buildPonudbeSpomnikiPdfDoc('ne-polje' as unknown as PonudbaSpomnikiVnos[], { now: NOW })).toThrow(TypeError)
    expect(() => buildPonudbeSpomnikiPdfDoc(PONUDBE, null as unknown as { now: Date })).toThrow(TypeError)
    expect(() => buildPonudbeSpomnikiPdfDoc(PONUDBE, { now: 'danes' as unknown as Date })).toThrow(TypeError)
    expect(() => buildPonudbeSpomnikiPdfDoc(PONUDBE, { now: new Date(NaN) })).toThrow(TypeError)
    expect(() => preveriPonudboVnos(null as unknown as PonudbaSpomnikiVnos, 2)).toThrow('pričakovana ponudba')
    expect(() => preveriPonudboVnos({ ...ponudba({ id: 'x', nazivProjekta: 'N' }), id: '' }, 2)).toThrow('id mora biti ne-prazen niz')
    expect(() => preveriPonudboVnos(ponudba({ id: 'x', nazivProjekta: '  ' }), 2)).toThrow('nazivProjekta mora biti ne-prazen niz')
    expect(() => preveriPonudboVnos({ ...ponudba({ id: 'x', nazivProjekta: 'N' }), status: 'POKVAREN' as unknown as PonudbaSpomnikiVnos['status'] }, 2)).toThrow('status mora biti eden izmed 4 znanih')
    expect(() => preveriPonudboVnos({ ...ponudba({ id: 'x', nazivProjekta: 'N' }), dealLocked: 'da' as unknown as boolean }, 2)).toThrow('dealLocked mora biti boolean')
    expect(() => preveriPonudboVnos({ ...ponudba({ id: 'x', nazivProjekta: 'N' }), followUpDate: 'ne-iso' }, 2)).toThrow('followUpDate mora biti ISO niz')
    expect(() => preveriPonudboVnos({ ...ponudba({ id: 'x', nazivProjekta: 'N' }), datumMontaze: 'ne-iso' }, 2)).toThrow('datumMontaze mora biti ISO niz')
    expect(() => preveriPonudboVnos({ ...ponudba({ id: 'x', nazivProjekta: 'N' }), stranka: 42 as unknown as string | null }, 2)).toThrow('stranka mora biti niz ALI null')
    expect(() => preveriPonudboVnos({ ...ponudba({ id: 'x', nazivProjekta: 'N' }), followUpOpomba: 7 as unknown as string | null }, 2)).toThrow('followUpOpomba mora biti niz ALI null')
  })

  it('nemogoč datum (2026-13-99) preide regex preverbo, a stanjeSpomnika (EN VIR R161) ga fail-closed zavrne — NIKOLI tiho ugibanje', () => {
    const pokvarena = [{ ...ponudba({ id: 'x', nazivProjekta: 'N' }), followUpDate: '2026-13-99T09:00:00.000Z' }]
    expect(() => ponudbeSpomnikiPregled(pokvarena, NOW)).toThrow(TypeError)
  })
})

describe('R267 — WYSIWYG vir (tabela + KPI + sklep)', () => {
  it('tabela 8 stolpcev (Projekt, Stranka, Status, Spomnik, Stanje, Opomba, Montaža, Podpis) — head dobesedno', () => {
    expect(lib).toContain("['Projekt', 'Stranka', 'Status', 'Spomnik', 'Stanje', 'Opomba', 'Montaža', 'Podpis']")
  })

  it('barvna resnica: zapadel RED bold (akcija), danes NAVY bold (akcija), kmalu AMBER, brez spomnika sivo, podpisano GREEN, \'—\' sivo; NIKOLI utišan alarm', () => {
    const okno = oknoMed(lib, 'didParseCell:', '})\n  y =')
    expect(okno).toContain("v.stanje === 'Zapadel'")
    expect(okno).toContain("v.stanje === 'Danes'")
    expect(okno).toContain("v.stanje === 'Kmalu'")
    expect(okno).toContain("v.stanje === 'Brez spomnika'")
    expect(okno).toContain('textColor = RED')
    expect(okno).toContain('textColor = NAVY')
    expect(okno).toContain('textColor = AMBER')
    expect(okno).toContain('textColor = GRAY')
    expect(okno).toContain('textColor = GREEN')
    expect(okno).toContain("fontStyle = 'bold'")
  })

  it('KPI 5 boxov z signalnim jezikom (ponudb NAVY, zapadel RED>0, spomnik danes NAVY, podpisanih GREEN, odprtih brez spomnika AMBER>0)', () => {
    expect(lib).toContain("'Ponudb'")
    expect(lib).toContain("'Zapadel spomnik'")
    expect(lib).toContain("'Spomnik danes'")
    expect(lib).toContain("'Podpisanih'")
    expect(lib).toContain("'Odprtih brez spomnika'")
    expect(lib).toContain('povzetek.zapadelOprtih > 0 ? RED : GREEN')
    expect(lib).toContain('povzetek.brezSpomnikaOprtih > 0 ? AMBER : GREEN')
  })

  it('sklep: cone + akcije poimenovane (akcijska cona / zgodovinska cona / akcija / 1–3 dni / iskren odpad; VSE ponudbe — referenčni pregled; vir = resnica vloge)', () => {
    expect(lib).toContain('(akcijska cona)')
    expect(lib).toContain('(zgodovinska cona)')
    expect(lib).toContain('Zapadel spomnik (akcija)')
    expect(lib).toContain('spomnik danes (akcija)')
    expect(lib).toContain('kmalu (1–3 dni)')
    expect(lib).toContain('brez spomnika (iskren odpad — akcija)')
    expect(lib).toContain('(referenčni pregled — VSE ponudbe, tudi podpisane)')
    expect(lib).toContain('vir = /api/projects (resnica vloge — polna resnica, ne samo viden seznam)')
  })

  it('glava PONUDBE — SPOMNIŠKI PREGLED + osveženo + noge Stran i/N + NOVI datotečni kontrakt Ponudbe-spomniki-', () => {
    expect(lib).toContain("'PONUDBE — SPOMNIŠKI PREGLED'")
    expect(lib).toContain('osveženo ${zalogaPovzetekCasOznaka(now)}')
    expect(lib).toContain('Stran ${i}/${strani}')
    expect(lib).toContain("`Ponudbe-spomniki-${todayStamp(now)}.pdf`")
  })

  it('brez locale-odvisnih APIjev + NIČ mreže v libu (client-only resnica; route NIČ; R259 lekcija 2 — ne-lovi komentarjev)', () => {
    expect(lib).not.toContain('localeCompare')
    expect(lib).not.toContain('toLocaleString')
    expect(lib).not.toContain('toLocaleDateString')
    expect(lib).not.toContain('fetch(')
    expect(lib).not.toContain("from 'node:crypto'")
    expect(lib).not.toContain("require('node:crypto')")
  })
})

describe('R267 — komponenta (quote-followup) — pill, mini-vrstica, handler, legenda', () => {
  it('pill VEDNO viden (P1-k precedens; NI gated na pending.length) + disabled={pdfVteku} dvoklik guard + press-scale + FileDown aria-hidden', () => {
    expect(komponenta).toContain('aria-label="Izvozi pregled spomnikov ponudb kot PDF"')
    expect(komponenta).toContain('title="Spomniški pregled ponudb kot pravi PDF — stanja spomnikov, podpisi (vse ponudbe, tudi podpisane)"')
    const pil = oknoMed(komponenta, 'void handleSpomnikiPdf()', '<FileDown className="h-3 w-3" aria-hidden="true"')
    expect(pil).toContain('disabled={pdfVteku}')
    expect(pil).not.toContain('disabled={pending.length === 0}')
    // press-scale = pariteta žetona z družino (className je pred onClick v JSX —
    // ločena preverba na točno tisto vrsto, ki jo ima SAMO PDF gumb; CSV gumb
    // iste klase NIMA press-scale).
    expect(komponenta).toContain('className="h-7 shrink-0 gap-1.5 text-[11px] press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40"')
    expect(komponenta).toContain('<FileDown className="h-3 w-3" aria-hidden="true"')
  })

  it('F2 mini-vrstica (state-oka — kar uporabnik vidi): dot roksal-red/green, kondicionalna žetona ŽIVO samo kadar je akcija (R256 lekcija 4), tabular-nums, ISTA izpeljava stanjeSpomnika', () => {
    const mini = oknoMed(komponenta, 'R267 — F2 spomniška mini-vrstica', '</CardContent>')
    expect(mini).toContain('Spomniki (viden seznam):')
    expect(mini).toContain("bg-roksal-red' : 'bg-roksal-green'")
    expect(mini).toContain('{spomnikiPovzetek.zapadel > 0 && (')
    expect(mini).toContain('{spomnikiPovzetek.brez > 0 && (')
    expect(mini).toContain('border-roksal-red/40 bg-roksal-red/10')
    expect(mini).toContain('tabular-nums')
    expect(mini).toContain('{ponudbeLabel(spomnikiPovzetek.viden)}')
  })

  it('dve okni, ENA matemtika: mini (state) IN PDF (fresh) = ISTA funkcija stanjeSpomnika R161 (import + memo + handler) — NIKOLI zasegana kopija', () => {
    expect(komponenta).toContain('stanjeSpomnika } from \'@/lib/ponudbe-csv\'')
    expect(komponenta).toContain('stanjeSpomnika(p.followUpDate, danesIso)')
    expect(lib).toContain("import { PONUDBE_STATUS_LABELS, ponudbeLabel, stanjeSpomnika, type PonudbaStatus } from './ponudbe-csv'")
    expect(lib).toContain('stanjeSpomnika(o.followUpDate, danesIso)')
  })

  it('handler: FRESH fetch /api/projects (polna resnica vloge — nič state-a) + HTTP razlog + ne-polje → TypeError + dvoklik guard + fail-closed PREJ (Ni vpisanih ponudb) → ENA izpeljava → generate; TypeError viden razlog', () => {
    const okno = oknoMed(komponenta, 'const handleSpomnikiPdf', 'const handleExportCsv')
    expect(okno).toContain('if (pdfVteku) return')
    expect(okno).toContain("fetch('/api/projects', { credentials: 'same-origin' })")
    expect(okno).toContain('GET /api/projects → HTTP ${res.status}')
    expect(okno).toContain('Odgovora /api/projects ni mogoče prebrati (ni polja).')
    expect(okno).toContain("title: 'Ni vpisanih ponudb'")
    expect(okno).toContain("'Pregled spomnikov se izvozi, ko je vpisana prva ponudba.'")
    const prazen = okno.indexOf('vnosi.length === 0')
    const generiraj = okno.indexOf('generatePonudbeSpomnikiPdf(')
    expect(prazen).toBeGreaterThanOrEqual(0)
    expect(generiraj).toBeGreaterThan(prazen)
    expect(okno).toContain('const { povzetek } = ponudbeSpomnikiPregled(vnosi, new Date())')
    expect(okno).toContain('generatePonudbeSpomnikiPdf(vnosi, { now: new Date() })')
    expect(okno).toContain("title: 'Pregled ponudb prenešen v PDF'")
    expect(okno).toContain('Ponudbe-spomniki-…pdf — ${ponudbeLabel(povzetek.ponudb)}, zapadel spomnik ${povzetek.zapadelOprtih}, podpisanih ${povzetek.podpisanih}.')
    expect(okno).toContain("variant: 'destructive'")
    expect(okno).toContain('setPdfVteku(false)')
  })

  it('fail-verbose DTO pruning: vrstica brez id/nazivProjekta → TypeError (IDENTITETE pred libom — R264/R265/R266 vzorec)', () => {
    const okno = oknoMed(komponenta, 'const handleSpomnikiPdf', 'const handleExportCsv')
    expect(okno).toContain('manjkajoč id/nazivProjekta v odgovoru API-ja')
    expect(okno).toContain('const vrstice = data as Array<Record<string, unknown>>')
  })

  it('legenda pill pariteta (družina): PDF = VSE ponudbe, tudi podpisane — polna resnica, ne samo viden seznam; VEDNO vidna (tudi pri praznem seznamu)', () => {
    expect(komponenta).toContain('PDF = VSE ponudbe (tudi podpisane — polna resnica, ne samo viden seznam)')
    const legenda = oknoMed(komponenta, '<CardContent className="space-y-2">', '{loading ? (')
    expect(legenda).toContain('PDF = VSE ponudbe')
  })

  it('brat R266 NESPREMENJEN (soli 0x95–0x98 pri bratu — bajtno zdrav tudi po R267) + CSV izvoz R161 NESPREMENJEN (disabled pogoj ostaja)', () => {
    const r266Lib = beri('src/lib/oprema-cikel-pdf.ts')
    expect(r266Lib).toContain('fnv1aHex(seed, 0x95)')
    expect(r266Lib).not.toContain('fnv1aHex(seed, 0x99)')
    expect(komponenta).toContain('disabled={pending.length === 0 || exporting || loading || error !== null}')
  })

  it('0 novih hex (žetoni samo — družinsko pravilo R224–R266)', () => {
    const hexi = komponenta.match(/#[0-9a-fA-F]{6}\b/g) ?? []
    const znani = new Set(['2a3f5f', '1d2b3e'])
    for (const h of hexi) expect(znani.has(h.slice(1).toLowerCase())).toBe(true)
  })
})
