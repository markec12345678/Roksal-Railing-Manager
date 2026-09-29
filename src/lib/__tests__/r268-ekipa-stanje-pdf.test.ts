// ---------------------------------------------------------------------------
// R268 — EKIPA — STANJE EKIPE PDF (24. člen 'izvozi' družine, P1-f) — testi.
// Bajtni dokazi (determinizem: enak vhod = bajtno enak PDF; PREMEŠAN VRSTNI
// RED = bajtno ENAK — akcijski sort interno + kanon seed po id, f(množica);
// %PDF- magija; NOV glifni razred — R249 doktrina; bratje R266/R267 bajtno
// zdravi) + ENA resnica (KPI + tabela + sklep + toast + mini-vrstica iz ENE
// izpeljave ekipaStanjePregled; status EN VIR ekipaStatusOf R160 — ISTA
// prednost kot značka v UI in CSV; vloge EN VIR EKIPA_VLOGE; deaktiviran =
// zgodovinska cona, NE alarm) + fail-closed (podvojen id, neznana vloga,
// lifecycle ne-boolean ×4, ne-ISO datumi, prazen seznam) + vsebinski dokazi
// na VIRU liba in komponente (pill VEDNO viden, FRESH fetch /api/users —
// trenutna resnica ob kliku, mini-vrstica state-oka, legenda pariteta,
// 0 novih hex).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildEkipaStanjePdfDoc,
  clanBeseda,
  ekipaStanjePdfFilename,
  ekipaStanjePregled,
  preveriEkipaVnos,
  sortirajEkipaStanje,
  type EkipaStanjeVnos,
} from '@/lib/ekipa-stanje-pdf'
import { ekipaStatusOf } from '@/lib/ekipa-csv'
import {
  buildOpremaCikelPdfDoc,
  type OpremaCikelVnos,
} from '@/lib/oprema-cikel-pdf'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

// okno med markerjema (r207/…/r257/r265/r266/r267 vzorec)
function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  const b = src.indexOf(do_, a)
  if (a === -1 || b === -1) return ''
  return src.slice(a, b)
}

const lib = beri('src/lib/ekipa-stanje-pdf.ts')
const komponenta = beri('src/components/roksal/team-tab.tsx')

// FIXED now (determinizem — žig + CreationDate + fileId + ime).
const NOW: Date = new Date('2026-09-29T08:00:00.000Z')

// lifecycle gradnik (4 točno boolean — EkipaLifecycle R160).
function lc(deactivated: boolean, locked: boolean, invited: boolean, inviteExpired: boolean) {
  return { deactivated, locked, invited, inviteExpired }
}

// Osnovni član (aktiven monter) + nadgradbe.
function clan(over: Partial<EkipaStanjeVnos> & Pick<EkipaStanjeVnos, 'id' | 'ime' | 'email' | 'vloga' | 'lifecycle'>): EkipaStanjeVnos {
  return {
    telefon: null,
    lastActive: null,
    createdAt: '2025-03-15T10:00:00.000Z',
    ...over,
  }
}

// 6 članov — VSE veje: aktiven ×2 (a1/a2 — GREEN), čaka aktivacijo (c1 —
// AMBER akcija), povabilo poteklo (p1 — RED akcija), zaklenjen (z1 — RED
// akcija), deaktiviran (d1 — zgodovinska cona, NE alarm).
const CLANI: EkipaStanjeVnos[] = [
  clan({ id: 'a1', ime: 'Anka Aktivna', email: 'anka@roksal.si', vloga: 'MONTER', lifecycle: lc(false, false, false, false), telefon: '+386 41 111 111', lastActive: '2026-09-28T07:15:00.000Z' }),
  clan({ id: 'a2', ime: 'Erik Aktiven', email: 'erik@roksal.si', vloga: 'ADMIN', lifecycle: lc(false, false, false, false), lastActive: '2026-09-29T06:00:00.000Z' }),
  clan({ id: 'c1', ime: 'Bor Čaka', email: 'bor@roksal.si', vloga: 'VODJA', lifecycle: lc(false, false, true, false) }),
  clan({ id: 'p1', ime: 'Cene Poteče', email: 'cene@roksal.si', vloga: 'SKLADISCE', lifecycle: lc(false, false, true, true), createdAt: '2024-11-02T08:30:00.000Z' }),
  clan({ id: 'z1', ime: 'Dan Zaklep', email: 'dan@roksal.si', vloga: 'ADMIN', lifecycle: lc(false, true, false, false) }),
  clan({ id: 'd1', ime: 'Zora Deaktivirana', email: 'zora@roksal.si', vloga: 'MONTER', lifecycle: lc(true, false, false, false) }),
]

function zgradi(vhodi: readonly EkipaStanjeVnos[] = CLANI, now: Date = NOW): Buffer {
  const doc = buildEkipaStanjePdfDoc(vhodi, { now })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R268 — PDF bajtni dokazi (determinizem + glifni razred — R249 doktrina)', () => {
  it('determinizem: enak vhod = bajtno enak; PREMEŠAN VRSTNI RED = bajtno ENAK (akcijski sort interno + kanon seed po id, f(množica)); drug now = drugačen', () => {
    expect(zgradi().equals(zgradi())).toBe(true)
    const preskakljani = zgradi([CLANI[5], CLANI[3], CLANI[1], CLANI[4], CLANI[0], CLANI[2]])
    expect(preskakljani.equals(zgradi())).toBe(true)
    expect(zgradi(CLANI, new Date('2026-09-29T08:01:00.000Z')).equals(zgradi())).toBe(false)
  })

  it('%PDF- magija + NOV glifni razred (≠ vseh 33 znanih družinskih razredov IN ≠ bratja R266/R267) + ime Ekipa-stanje-YYYY-MM-DD.pdf', () => {
    const bin = zgradi()
    expect(bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    const znani = [30057, 30119, 30191, 30253, 35565, 38753, 39927, 41519, 42798, 37709, 37771, 36788, 36656, 36532, 33958, 36555, 38631, 45508, 44828, 36260, 36583, 45127, 38565, 38909, 40261, 35409, 37228, 39094, 41009, 37560, 38744, 43572, 51142]
    expect(znani).not.toContain(bin.length)
    // Brat R266 z ISTIMI vhodi kot njegov test — drug dokument = druga dolžina.
    const oprema: OpremaCikelVnos[] = [
      { id: 'e1', naziv: 'Laserni merilec', tip: 'Merska oprema', status: 'NA_VOLJO', lokacija: 'Delavnica', serijskaStevilka: 'SN-1', lastInspectionAt: '2026-01-01T00:00:00.000Z', inspectionIntervalDays: 180, nextInspectionAt: '2026-06-30T00:00:00.000Z', inspectionDue: true, inspectionUnknown: false, calibrationRequired: true, calibrationDueDate: '2026-08-01T00:00:00.000Z', calibrationCertificate: null, calibrationOverdue: true, calibrationMissing: false, zadnjiServis: null, assignmentsCount: 2 },
      { id: 'e2', naziv: 'Ladder A', tip: 'Ročno orodje', status: 'IZGUBLJENO', lokacija: null, serijskaStevilka: null, lastInspectionAt: null, inspectionIntervalDays: null, nextInspectionAt: null, inspectionDue: false, inspectionUnknown: false, calibrationRequired: false, calibrationDueDate: null, calibrationCertificate: null, calibrationOverdue: false, calibrationMissing: false, zadnjiServis: null, assignmentsCount: 0 },
    ]
    const r266Bin = Buffer.from(buildOpremaCikelPdfDoc(oprema, { now: NOW }).output('arraybuffer'))
    expect(r266Bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(bin.length).not.toBe(r266Bin.length)
    expect(ekipaStanjePdfFilename(NOW)).toBe('Ekipa-stanje-2026-09-29.pdf')
    expect(() => ekipaStanjePdfFilename('danes' as unknown as Date)).toThrow(TypeError)
  })

  it('soli 0x9d–0xa0 — UNIKATNE v družini (register: ponudbe-spomniki 0x99–0x9c — bratje NE delijo semen)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0x9d)')
    expect(lib).toContain('fnv1aHex(seed, 0xa0)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x99)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x95)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x91)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x8d)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x89)')
  })
})

describe('R268 — ENA resnica (KPI + tabela + sklep + toast iz ENE izpeljave)', () => {
  it('povzetek: 6 članov, aktivnih 2, čaka aktivacijo 1, povabilo poteklo 1, zaklenjenih 1, deaktiviranih 1; vloge: admini 2, vodje 1, monterji 2, skladišča 1', () => {
    const { povzetek } = ekipaStanjePregled(CLANI)
    expect(povzetek.clanov).toBe(6)
    expect(povzetek.aktivnih).toBe(2)
    expect(povzetek.cakaAktivacijo).toBe(1)
    expect(povzetek.povabiloPoteklo).toBe(1)
    expect(povzetek.zaklenjenih).toBe(1)
    expect(povzetek.deaktiviranih).toBe(1)
    expect(povzetek.admini).toBe(2)
    expect(povzetek.vodje).toBe(1)
    expect(povzetek.monterji).toBe(2)
    expect(povzetek.skladisca).toBe(1)
  })

  it('sort akcijski red: povabilo poteklo → zaklenjen → čaka aktivacijo → aktivni (ime ASC) → deaktiviran; email izenačba; premešan vhod = ISTI povzetek (f(MNOŽICA))', () => {
    const { vrste } = ekipaStanjePregled(CLANI)
    expect(vrste.map((v) => v.id)).toEqual(['p1', 'z1', 'c1', 'a1', 'a2', 'd1'])
    const enak = sortirajEkipaStanje([
      { ...vrste[0], id: 'z9', ime: 'Enak Ime', email: 'isti@roksal.si' },
      { ...vrste[0], id: 'a1', ime: 'Enak Ime', email: 'isti@roksal.si' },
    ])
    expect(enak.map((v) => v.id)).toEqual(['a1', 'z9'])
    const premešan = ekipaStanjePregled([CLANI[5], CLANI[2], CLANI[0], CLANI[4], CLANI[1], CLANI[3]])
    expect(premešan.povzetek).toEqual(ekipaStanjePregled(CLANI).povzetek)
  })

  it('status EN VIR ekipaStatusOf (R160 — ISTA prednost deaktiviran > zaklenjen > povabilo > aktiven) + vloga oznake EKIPA_VLOGE + datumi cenikDatumIso + lastActive null = iskren null', () => {
    const { vrste } = ekipaStanjePregled(CLANI)
    const p1 = vrste.find((v) => v.id === 'p1')!
    expect(p1.status).toBe('Povabilo poteklo')
    expect(p1.vlogaKoda).toBe('SKLADISCE')
    expect(p1.vloga).toBe('Skladišče')
    expect(p1.createdAt).toBe('02.11.2024')
    const c1 = vrste.find((v) => v.id === 'c1')!
    expect(c1.status).toBe('Čaka aktivacijo')
    expect(c1.vloga).toBe('Vodja')
    const a1 = vrste.find((v) => v.id === 'a1')!
    expect(a1.status).toBe('Aktiven')
    expect(a1.lastActive).toBe('28.09.2026')
    const d1 = vrste.find((v) => v.id === 'd1')!
    expect(d1.status).toBe('Deaktiviran')
    expect(d1.lastActive).toBeNull()
    // EN VIR dokaz: ISTA funkcija R160 daje ISTO resnico (NI zasegane kopije).
    expect(ekipaStatusOf(lc(true, true, true, true))).toBe('Deaktiviran')
    expect(ekipaStatusOf(lc(false, true, true, true))).toBe('Zaklenjen')
    expect(ekipaStatusOf(lc(false, false, true, true))).toBe('Povabilo poteklo')
    expect(ekipaStatusOf(lc(false, false, true, false))).toBe('Čaka aktivacijo')
    expect(ekipaStatusOf(lc(false, false, false, false))).toBe('Aktiven')
  })

  it('akcijski red pokrit — VSEH 5 znanih statusov (AKCIJSKI_RED se ne prevede, če status manjka) + sklanjatev clanBeseda (1 član / 2 člana / 3-4 člani / 5+ članov; 11-14; 101 član)', () => {
    expect(lib).toContain("'Povabilo poteklo': 0")
    expect(lib).toContain('Zaklenjen: 1')
    expect(lib).toContain("'Čaka aktivacijo': 2")
    expect(lib).toContain('Aktiven: 3')
    expect(lib).toContain('Deaktiviran: 4')
    expect(clanBeseda(1)).toBe('1 član')
    expect(clanBeseda(2)).toBe('2 člana')
    expect(clanBeseda(3)).toBe('3 člani')
    expect(clanBeseda(4)).toBe('4 člani')
    expect(clanBeseda(5)).toBe('5 članov')
    expect(clanBeseda(11)).toBe('11 članov') // 11–14 = 'članov' (dvojinski izjemi)
    expect(clanBeseda(14)).toBe('14 članov')
    expect(clanBeseda(21)).toBe('21 član')
    expect(clanBeseda(101)).toBe('101 član') // singular po enicah (pariteta ponudbeLabel R161)
    expect(() => clanBeseda(1.5)).toThrow(TypeError)
    expect(() => clanBeseda(-1)).toThrow(TypeError)
  })
})

describe('R268 — fail-closed v libu (družina R236/R250–R267)', () => {
  it('prazen seznam članov ne nastaja dokumenta — TypeError s toast sporočilom komponente (obe vrati: build IN pregled)', () => {
    expect(() => buildEkipaStanjePdfDoc([], { now: NOW })).toThrow(TypeError)
    expect(() => buildEkipaStanjePdfDoc([], { now: NOW })).toThrow('prazen seznam članov ne nastaja dokumenta')
    expect(() => ekipaStanjePregled([])).toThrow('prazen seznam članov ne nastaja dokumenta — pregled se izvozi, ko je vpisan prvi član ekipe')
  })

  it('fail-closed ×13: podvojen id, ne-polje, ne-options, pokvaren now, null vnos, prazni id/ime/email, neznana vloga, lifecycle manjkajoč + 4×ne-boolean, telefon ne-niz-null, ne-ISO lastActive, ne-ISO/manjkajoč createdAt — indeks krivca', () => {
    expect(() => ekipaStanjePregled([CLANI[0], { ...CLANI[0] }])).toThrow('podvojen id člana a1')
    expect(() => buildEkipaStanjePdfDoc('ne-polje' as unknown as EkipaStanjeVnos[], { now: NOW })).toThrow(TypeError)
    expect(() => buildEkipaStanjePdfDoc(CLANI, null as unknown as { now: Date })).toThrow(TypeError)
    expect(() => buildEkipaStanjePdfDoc(CLANI, { now: 'danes' as unknown as Date })).toThrow(TypeError)
    expect(() => buildEkipaStanjePdfDoc(CLANI, { now: new Date(NaN) })).toThrow(TypeError)
    expect(() => preveriEkipaVnos(null as unknown as EkipaStanjeVnos, 2)).toThrow('pričakovan član ekipe')
    expect(() => preveriEkipaVnos({ ...CLANI[0], id: '' }, 2)).toThrow('id mora biti ne-prazen niz')
    expect(() => preveriEkipaVnos({ ...CLANI[0], ime: '  ' }, 2)).toThrow('ime mora biti ne-prazen niz')
    expect(() => preveriEkipaVnos({ ...CLANI[0], email: '' }, 2)).toThrow('email mora biti ne-prazen niz')
    expect(() => preveriEkipaVnos({ ...CLANI[0], vloga: 'POKVARENA' }, 2)).toThrow('vloga mora biti eden izmed 4 znanih')
    expect(() => preveriEkipaVnos({ ...CLANI[0], lifecycle: null as unknown as EkipaStanjeVnos['lifecycle'] }, 2)).toThrow('manjkajoč lifecycle')
    expect(() => preveriEkipaVnos({ ...CLANI[0], lifecycle: lc('ne' as unknown as boolean, false, false, false) }, 2)).toThrow('lifecycle.deactivated mora biti točno boolean')
    expect(() => preveriEkipaVnos({ ...CLANI[0], lifecycle: lc(false, 1 as unknown as boolean, false, false) }, 2)).toThrow('lifecycle.locked mora biti točno boolean')
    expect(() => preveriEkipaVnos({ ...CLANI[0], lifecycle: lc(false, false, null as unknown as boolean, false) }, 2)).toThrow('lifecycle.invited mora biti točno boolean')
    expect(() => preveriEkipaVnos({ ...CLANI[0], lifecycle: lc(false, false, false, undefined as unknown as boolean) }, 2)).toThrow('lifecycle.inviteExpired mora biti točno boolean')
    expect(() => preveriEkipaVnos({ ...CLANI[0], telefon: 42 as unknown as string | null }, 2)).toThrow('telefon mora biti niz ALI null')
    expect(() => preveriEkipaVnos({ ...CLANI[0], lastActive: 'ne-iso' }, 2)).toThrow('lastActive mora biti ISO niz')
    expect(() => preveriEkipaVnos({ ...CLANI[0], createdAt: 'ne-iso' }, 2)).toThrow('createdAt mora biti ISO niz')
  })

  it('ne-polje odgovora / manjkajoča identiteta gre v handler kot imenovan TypeError (fail-verbose DTO pruning — pred libom)', () => {
    // Handler del: preverjanja na komponenti (spodaj) — tu lib pogodba:
    // pregled NIKOLI ne zgradi iz ne-polja in nikoli tiho ugiba.
    expect(() => ekipaStanjePregled(undefined as unknown as EkipaStanjeVnos[])).toThrow(TypeError)
  })
})

describe('R268 — WYSIWYG vir (tabela + KPI + sklep)', () => {
  it('tabela 7 stolpcev (Ime, E-pošta, Vloga, Status, Telefon, Zadnja aktivnost, Ustvarjen) — head dobesedno', () => {
    expect(lib).toContain("['Ime', 'E-pošta', 'Vloga', 'Status', 'Telefon', 'Zadnja aktivnost', 'Ustvarjen']")
  })

  it('barvna resnica: povabilo poteklo + zaklenjen RED bold (akcija), čaka aktivacijo AMBER, aktiven GREEN, deaktiviran sivo (zgodovina), \'—\' sivo; NIKOLI utišan alarm', () => {
    const okno = oknoMed(lib, 'didParseCell:', '})\n  y =')
    expect(okno).toContain("v.status === 'Povabilo poteklo'")
    expect(okno).toContain("v.status === 'Zaklenjen'")
    expect(okno).toContain("v.status === 'Čaka aktivacijo'")
    expect(okno).toContain("v.status === 'Aktiven'")
    expect(okno).toContain("v.status === 'Deaktiviran'")
    expect(okno).toContain('textColor = RED')
    expect(okno).toContain('textColor = AMBER')
    expect(okno).toContain('textColor = GRAY')
    expect(okno).toContain('textColor = GREEN')
    expect(okno).toContain("fontStyle = 'bold'")
  })

  it('KPI 5 boxov z signalnim jezikom (članov NAVY, aktivnih GREEN, povabilo poteklo RED>0, zaklenjenih RED>0, čaka aktivacijo AMBER>0)', () => {
    expect(lib).toContain("'Članov'")
    expect(lib).toContain("'Aktivnih'")
    expect(lib).toContain("'Povabilo poteklo'")
    expect(lib).toContain("'Zaklenjenih'")
    expect(lib).toContain("'Čaka aktivacijo'")
    expect(lib).toContain('povzetek.povabiloPoteklo > 0 ? RED : GREEN')
    expect(lib).toContain('povzetek.zaklenjenih > 0 ? RED : GREEN')
    expect(lib).toContain('povzetek.cakaAktivacijo > 0 ? AMBER : GREEN')
  })

  it('sklep: cone + akcije poimenovane (povabila v zraku / pošlji novo povezavo / varnostni pregled / zgodovinska cona; CELA ekipa — referenčni pregled; vir = resnica pravic)', () => {
    expect(lib).toContain('(akcija — povabila v zraku)')
    expect(lib).toContain('(akcija — pošlji novo aktivacijsko povezavo)')
    expect(lib).toContain('(akcija — varnostni pregled)')
    expect(lib).toContain('(zgodovinska cona — offboarding zaključen)')
    expect(lib).toContain('(referenčni pregled — celotna ekipa, tudi deaktivirani računi)')
    expect(lib).toContain('vir = /api/users (resnica pravic users.read)')
  })

  it('glava EKIPA — STANJE EKIPE + osveženo + noge Stran i/N + NOVI datotečni kontrakt Ekipa-stanje-', () => {
    expect(lib).toContain("'EKIPA — STANJE EKIPE'")
    expect(lib).toContain('osveženo ${zalogaPovzetekCasOznaka(now)}')
    expect(lib).toContain('Stran ${i}/${strani}')
    expect(lib).toContain("`Ekipa-stanje-${todayStamp(now)}.pdf`")
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

describe('R268 — komponenta (team-tab) — pill, mini-vrstica, handler, legenda', () => {
  it('pill VEDNO viden znotraj površine canRead (NI gated na users.length — pariteta R263–R267) + disabled={pdfVteku} dvoklik guard + press-scale + FileDown aria-hidden', () => {
    expect(komponenta).toContain('aria-label="Izvozi pregled stanja ekipe kot PDF"')
    expect(komponenta).toContain('title="Pregled stanja ekipe kot pravi PDF — statusi računov, vloge, življenjski cikl (celotna ekipa)"')
    const pil = oknoMed(komponenta, 'void handleStanjePdf()', '<FileDown className="mr-1 h-3.5 w-3.5" aria-hidden="true"')
    expect(pil).toContain('disabled={pdfVteku}')
    expect(pil).not.toContain('disabled={users.length')
    // press-scale = pariteta žetona z družino (className je pred onClick v JSX —
    // ločena preverba na točno tisto vrsto, ki jo ima SAMO PDF gumb).
    expect(komponenta).toContain('className="h-8 px-2.5 press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40"')
    expect(komponenta).toContain('<FileDown className="mr-1 h-3.5 w-3.5" aria-hidden="true"')
  })

  it('F2 mini-vrstica (state-oka — kar uporabnik vidi): dot roksal-red/green, kondicionalni žetoni ŽIVO samo kadar akcija (R256 lekcija 4), tabular-nums, ISTA izpeljava ekipaStanjePregled', () => {
    const mini = oknoMed(komponenta, 'R268 — F2 mini-vrstica stanja ekipe', '{/* R141')
    expect(mini).toContain('Ekipa (viden seznam):')
    expect(mini).toContain("bg-roksal-red' : 'bg-roksal-green'")
    expect(mini).toContain('{ekipaPovzetek.povabiloPoteklo > 0 && (')
    expect(mini).toContain('{ekipaPovzetek.zaklenjenih > 0 && (')
    expect(mini).toContain('{ekipaPovzetek.cakaAktivacijo > 0 && (')
    expect(mini).toContain('border-roksal-red/40 bg-roksal-red/10')
    expect(mini).toContain('border-roksal-amber/40 bg-roksal-amber/10')
    expect(mini).toContain('tabular-nums')
    expect(mini).toContain('{clanBeseda(ekipaPovzetek.clanov)}')
  })

  it('dve okni, ENA matemtika: mini (state) IN PDF (fresh) = ISTA funkcija ekipaStanjePregled (import + memo + handler) — NIKOLI zasegana kopija; lib EN VIR ×3 ekipa-csv R160', () => {
    expect(komponenta).toContain("ekipaStanjePregled,\n  generateEkipaStanjePdf,")
    expect(komponenta).toContain('ekipaStanjePregled(\n      users.map')
    expect(komponenta).toContain('const { povzetek } = ekipaStanjePregled(vnosi)')
    expect(lib).toContain("from './ekipa-csv'")
    expect(lib).toContain('ekipaStatusOf(o.lifecycle)')
    expect(lib).toContain('EKIPA_VLOGE[o.vloga]')
  })

  it('handler: FRESH fetch /api/users (trenutna resnica ob kliku — nič state-a) + HTTP razlog + ne-polje → TypeError + dvoklik guard + fail-closed PREJ (Ni vpisanih članov ekipe) → ENA izpeljava → generate; razlog viden', () => {
    const okno = oknoMed(komponenta, 'const handleStanjePdf', 'async function copyText')
    expect(okno).toContain('if (pdfVteku) return')
    expect(okno).toContain("fetch('/api/users', { credentials: 'same-origin' })")
    expect(okno).toContain('GET /api/users → HTTP ${res.status}')
    expect(okno).toContain('Odgovora /api/users ni mogoče prebrati (ni polja).')
    expect(okno).toContain("toast.error('Ni vpisanih članov ekipe'")
    expect(okno).toContain("'Pregled stanja se izvozi, ko je vpisan prvi član ekipe.'")
    const prazen = okno.indexOf('vnosi.length === 0')
    const generiraj = okno.indexOf('generateEkipaStanjePdf(')
    expect(prazen).toBeGreaterThanOrEqual(0)
    expect(generiraj).toBeGreaterThan(prazen)
    expect(okno).toContain('generateEkipaStanjePdf(vnosi, { now: new Date() })')
    expect(okno).toContain("toast.success('Pregled stanja ekipe prenešen v PDF'")
    expect(okno).toContain('Ekipa-stanje-…pdf — ${clanBeseda(povzetek.clanov)}, aktivnih ${povzetek.aktivnih}, čaka aktivacijo ${povzetek.cakaAktivacijo}, povabilo poteklo ${povzetek.povabiloPoteklo}, zaklenjenih ${povzetek.zaklenjenih}.')
    expect(okno).toContain('setPdfVteku(false)')
  })

  it('fail-verbose DTO pruning: vrstica brez id ALI lifecycle → TypeError z imenovanim krivcem (R264–R267 vzorec)', () => {
    const okno = oknoMed(komponenta, 'const handleStanjePdf', 'async function copyText')
    expect(okno).toContain('manjkajoč id v odgovoru API-ja')
    expect(okno).toContain('manjkajoč lifecycle v odgovoru API-ja')
    expect(okno).toContain('const vrstice = data as Array<Record<string, unknown>>')
  })

  it('legenda pill pariteta (družina): PDF = celotna ekipa — trenutna resnica ob kliku (FRESH /api/users, ne zastarel state); VEDNO vidna (tudi pri praznem seznamu)', () => {
    expect(komponenta).toContain('PDF = celotna ekipa (trenutna resnica ob kliku — FRESH /api/users, ne zastarel state)')
    const legenda = oknoMed(komponenta, 'R268 — legenda pill pariteta', '{!canManage && canRead && (')
    expect(legenda).toContain('PDF = celotna ekipa')
    expect(legenda).toContain('{canRead && (')
  })

  it('brata R266/R267 NESPREMENJENA (soli 0x95–0x9c pri bratih — bajtno zdravi tudi po R268) + CSV izvoz R160 NESPREMENJEN (disabled pogoj + klasična sklanjatev ostajata)', () => {
    const r266Lib = beri('src/lib/oprema-cikel-pdf.ts')
    expect(r266Lib).toContain('fnv1aHex(seed, 0x95)')
    expect(r266Lib).not.toContain('fnv1aHex(seed, 0x9d)')
    const r267Lib = beri('src/lib/ponudbe-spomniki-pdf.ts')
    expect(r267Lib).toContain('fnv1aHex(seed, 0x99)')
    expect(r267Lib).not.toContain('fnv1aHex(seed, 0x9d)')
    expect(komponenta).toContain('{canRead && users.length > 0 && (')
    expect(komponenta).toContain('CSV izvožen — ${vrstic} ${vrstic === 1 ? \'član\' : \'članov\'} v datoteko ${filename}')
  })

  it('0 novih hex (žetoni samo — družinsko pravilo R224–R267)', () => {
    const hexi = komponenta.match(/#[0-9a-fA-F]{6}\b/g) ?? []
    expect(hexi).toEqual([])
    const hexiLib = lib.match(/#[0-9a-fA-F]{6}\b/g) ?? []
    expect(hexiLib).toEqual([])
  })
})
