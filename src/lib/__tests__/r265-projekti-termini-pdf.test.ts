// ---------------------------------------------------------------------------
// R265 — PROJEKTI — TERMINI PREGLED PDF (21. člen 'izvozi' družine, P1-f) —
// testi. Bajtni dokazi (determinizem: enak vhod = bajtno enak PDF; PREMEŠAN
// VRSTNI RED = bajtno ENAK — sort interno + kanon seed, f(množica); %PDF-
// magija; NOV glifni razred — R249 doktrina) + presek-resnice (JOIN po
// IDENTITETI projectId — R260–R264 lekcija; tujec = poimenovan števec
// sirotTerminov, NIKOLI izmišljen projekt; preklicane ure IZKLJUČENE iz
// vsote — R257 vzorec; preložene V vsoti; brez-ure izključene — R168; vrstica
// brez vsote = '—'; planirana montaža brez termina = planska luknja) +
// vsebinski dokazi na VIRU liba in komponente.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildProjektiTerminiPdfDoc,
  projektiTerminiPdfFilename,
  projektiTerminiPregled,
  preveriTerminVnos,
  preveriProjektVnos,
  sortirajProjekteTermini,
  projektBeseda,
  type ProjektiTerminiProjektVnos,
  type ProjektiTerminiTerminVnos,
} from '@/lib/projekti-termini-pdf'
import { buildDobaviteljiPozicijaPdfDoc } from '@/lib/dobavitelji-pozicija-pdf'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

// okno med markerjema (r207/…/r257 vzorec)
function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  const b = src.indexOf(do_, a)
  if (a === -1 || b === -1) return ''
  return src.slice(a, b)
}

const lib = beri('src/lib/projekti-termini-pdf.ts')
const komponenta = beri('src/components/roksal/logistics-tab.tsx')

// FIXED now (determinizem — žig + CreationDate + fileId + ime).
const NOW: Date = new Date('2026-09-29T08:00:00.000Z')

// 3 projekti: p1 z 4 termini (zmes statusov + preklican), p2 planirana
// montaža BREZ termina (planska luknja — RED), p3 z 1 V_TEKU terminom.
const PROJEKTI: ProjektiTerminiProjektVnos[] = [
  { id: 'p1', nazivProjekta: 'Ograja Alenka', datumMontaze: '2026-10-02T08:00:00.000Z', stranka: 'Stranka Alenka' },
  { id: 'p2', nazivProjekta: 'Terasa Bernard', datumMontaze: '2026-10-10T08:00:00.000Z', stranka: null },
  { id: 'p3', nazivProjekta: 'Balustrada Cvetka', datumMontaze: null, stranka: 'Stranka Cvetka' },
]
const TERMINI: ProjektiTerminiTerminVnos[] = [
  { projectId: 'p1', status: 'ZAKLJUCENO', predvideneUre: 6, datumZacetka: '2026-09-20T08:00:00.000Z' },
  { projectId: 'p1', status: 'NAVRTENO', predvideneUre: 8, datumZacetka: '2026-10-05T08:00:00.000Z' },
  { projectId: 'p1', status: 'NAVRTENO', predvideneUre: 4, datumZacetka: '2026-10-06T08:00:00.000Z' },
  { projectId: 'p1', status: 'PREKlicANO', predvideneUre: 3, datumZacetka: '2026-10-07T08:00:00.000Z' },
  { projectId: 'p3', status: 'V_TEKU', predvideneUre: 5, datumZacetka: '2026-09-29T08:00:00.000Z' },
]

function zgradi(
  projekti: readonly ProjektiTerminiProjektVnos[] = PROJEKTI,
  termini: readonly ProjektiTerminiTerminVnos[] = TERMINI,
  now: Date = NOW,
): Buffer {
  const doc = buildProjektiTerminiPdfDoc(projekti, termini, { now })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R265 — PDF bajtni dokazi (determinizem + glifni razred — R249 doktrina)', () => {
  it('determinizem: enak vhod = bajtno enak; PREMEŠAN VRSTNI RED = bajtno ENAK (sort interno + kanon seed); drug now = drugačen', () => {
    expect(zgradi().equals(zgradi())).toBe(true)
    const preskakljani = zgradi([PROJEKTI[2], PROJEKTI[0], PROJEKTI[1]], [TERMINI[4], TERMINI[2], TERMINI[0], TERMINI[3], TERMINI[1]])
    expect(preskakljani.equals(zgradi())).toBe(true)
    expect(zgradi(PROJEKTI, TERMINI, new Date('2026-09-29T08:01:00.000Z')).equals(zgradi())).toBe(false)
  })

  it('%PDF- magija + NOV glifni razred (≠ vseh 30 znanih družinskih razredov) + ime Projekti-termini-YYYY-MM-DD.pdf', () => {
    const bin = zgradi()
    expect(bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    const znani = [30057, 30119, 30191, 30253, 35565, 38753, 39927, 41519, 42798, 37709, 37771, 36788, 36656, 36532, 33958, 36555, 38631, 45508, 44828, 36260, 36583, 45127, 38565, 38909, 40261, 35409, 37228, 39094, 41009, 37560]
    expect(znani).not.toContain(bin.length)
    expect(projektiTerminiPdfFilename(NOW)).toBe('Projekti-termini-2026-09-29.pdf')
  })

  it('soli 0x91–0x94 — UNIKATNE v družini (register: dobavitelji-pozicija 0x8d–0x90 — bratje NE delijo semen)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0x91)')
    expect(lib).toContain('fnv1aHex(seed, 0x94)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x8d)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x89)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x85)')
  })
})

describe('R265 — presek-resnice (ENA resnica za KPI + tabelo + sklep + toast)', () => {
  it('per projekt agregat: p1 zmes statusov (4 termini, načrt 2, zaklj 1, preklican 1, ure 18 — preklicana 3h IZKLJUČENA); p3 V_TEKU 5h; p2 brez termina', () => {
    const { vrste, povzetek } = projektiTerminiPregled(PROJEKTI, TERMINI)
    expect(vrste).toHaveLength(2)
    const p1 = vrste.find((v) => v.id === 'p1')!
    expect(p1.terminov).toBe(4)
    expect(p1.nacrtovano).toBe(2)
    expect(p1.vTeku).toBe(0)
    expect(p1.zakljuceno).toBe(1)
    expect(p1.ure).toBe(18) // 6+8+4 — preklicana 3h izključena (R257 vzorec)
    expect(p1.prvi).toBe('2026-09-20T08:00:00.000Z')
    expect(p1.zadnji).toBe('2026-10-07T08:00:00.000Z')
    const p3 = vrste.find((v) => v.id === 'p3')!
    expect(p3.terminov).toBe(1)
    expect(p3.vTeku).toBe(1)
    expect(p3.ure).toBe(5)
    expect(povzetek.projektov).toBe(3)
    expect(povzetek.zTermini).toBe(2)
    expect(povzetek.brezTermina).toBe(1)
    expect(povzetek.planBrezTermina).toBe(1) // p2: datumMontaze + 0 terminov
    expect(povzetek.terminov).toBe(5)
    expect(povzetek.preklicanih).toBe(1)
    expect(povzetek.prelozenih).toBe(0)
    expect(povzetek.brezUre).toBe(0)
    expect(povzetek.ur).toBe(23)
    expect(povzetek.sirotTerminov).toBe(0)
  })

  it('preložene ure V vsoti (delo še vedno planirano), preklicane IZ vsote; brez-ure (null) izključene + poimenovane', () => {
    const { vrste, povzetek } = projektiTerminiPregled(
      [
        { id: 'q1', nazivProjekta: 'Q', datumMontaze: null, stranka: null },
      ],
      [
        { projectId: 'q1', status: 'PRELOZENO', predvideneUre: 7, datumZacetka: '2026-10-01T08:00:00.000Z' },
        { projectId: 'q1', status: 'NAVRTENO', predvideneUre: null, datumZacetka: '2026-10-02T08:00:00.000Z' },
        { projectId: 'q1', status: 'PREKlicANO', predvideneUre: 9, datumZacetka: '2026-10-03T08:00:00.000Z' },
      ],
    )
    expect(vrste[0].ure).toBe(7) // preložena 7 v vsoti; brez-ure + preklicana 9 ven
    expect(povzetek.ur).toBe(7)
    expect(povzetek.brezUre).toBe(1)
    expect(povzetek.preklicanih).toBe(1)
    expect(povzetek.prelozenih).toBe(1)
  })

  it('vrstica, kjer NIČ ne šteje v vsoto (vsi preklicani) = ure null (\'—\' sivo); vrstica z vsako kombinacijo datumov skrči obdobje na EN datum', () => {
    const { vrste } = projektiTerminiPregled(
      [{ id: 'r1', nazivProjekta: 'R', datumMontaze: null, stranka: null }],
      [
        { projectId: 'r1', status: 'PREKlicANO', predvideneUre: 4, datumZacetka: '2026-10-05T08:00:00.000Z' },
      ],
    )
    expect(vrste[0].ure).toBeNull()
    expect(vrste[0].prvi).toBe('2026-10-05T08:00:00.000Z')
    expect(vrste[0].zadnji).toBe('2026-10-05T08:00:00.000Z')
  })

  it('dva istonaslovna projekta = RAZLIČNI resnici po id (identiteta — R260–R264 lekcija); sort NAZIV ASC + id ASC izenačba', () => {
    const { vrste } = projektiTerminiPregled(
      [
        { id: 'z9', nazivProjekta: 'Enak Naziv', datumMontaze: null, stranka: null },
        { id: 'a1', nazivProjekta: 'Enak Naziv', datumMontaze: null, stranka: null },
        { id: 'm5', nazivProjekta: 'Bolj Zgodnji', datumMontaze: null, stranka: null },
      ],
      [
        { projectId: 'z9', status: 'NAVRTENO', predvideneUre: 1, datumZacetka: '2026-10-05T08:00:00.000Z' },
        { projectId: 'a1', status: 'NAVRTENO', predvideneUre: 1, datumZacetka: '2026-10-06T08:00:00.000Z' },
        { projectId: 'm5', status: 'NAVRTENO', predvideneUre: 1, datumZacetka: '2026-10-07T08:00:00.000Z' },
      ],
    )
    expect(vrste.map((v) => v.id)).toEqual(['m5', 'a1', 'z9']) // Bolj Zgodnji, Enak Naziv (a1), Enak Naziv (z9)
    const obrnjeno = projektiTerminiPregled(
      [PROJEKTI[2], PROJEKTI[1], PROJEKTI[0]],
      [TERMINI[4], TERMINI[3], TERMINI[2], TERMINI[1], TERMINI[0]],
    )
    expect(obrnjeno.vrste.map((v) => v.id)).toEqual(['p3', 'p1']) // f(MNOŽICA)
    const enak = sortirajProjekteTermini([
      { id: 'z', naziv: 'X', stranka: null, terminov: 1, nacrtovano: 1, vTeku: 0, zakljuceno: 0, ure: 1, prvi: '2026-10-01T08:00:00.000Z', zadnji: '2026-10-01T08:00:00.000Z' },
      { id: 'a', naziv: 'X', stranka: null, terminov: 1, nacrtovano: 1, vTeku: 0, zakljuceno: 0, ure: 1, prvi: '2026-10-01T08:00:00.000Z', zadnji: '2026-10-01T08:00:00.000Z' },
    ])
    expect(enak.map((v) => v.id)).toEqual(['a', 'z']) // isti naziv → id ASC
  })

  it('premešan vhod = ISTI povzetek (f(MNOŽICA)); JOIN po IDENTITETI + tujec = poimenovan sirotTerminov (NI error, NIKOLI izmišljen projekt)', () => {
    const a = projektiTerminiPregled(PROJEKTI, TERMINI).povzetek
    const b = projektiTerminiPregled([PROJEKTI[1], PROJEKTI[2], PROJEKTI[0]], [TERMINI[3], TERMINI[0], TERMINI[4], TERMINI[2], TERMINI[1]]).povzetek
    expect(a).toEqual(b)
    const sTujci = projektiTerminiPregled(PROJEKTI, [...TERMINI, { projectId: 'tuj-id', status: 'NAVRTENO', predvideneUre: 2, datumZacetka: '2026-10-08T08:00:00.000Z' }])
    expect(sTujci.povzetek.sirotTerminov).toBe(1)
    expect(sTujci.povzetek.terminov).toBe(6)
    expect(sTujci.vrste).toHaveLength(2) // tujec NE nastaja vrstice
    expect(sTujci.povzetek.zTermini).toBe(2)
  })
})

describe('R265 — fail-closed v libu (družina R236/R250–R264)', () => {
  it('prazen seznam terminov ne nastaja dokumenta — TypeError s toast sporočilom komponente; prazen seznam projektov prav tako', () => {
    expect(() => buildProjektiTerminiPdfDoc(PROJEKTI, [], { now: NOW })).toThrow(TypeError)
    expect(() => buildProjektiTerminiPdfDoc(PROJEKTI, [], { now: NOW })).toThrow('prazen seznam terminov ne nastaja dokumenta')
    expect(() => projektiTerminiPregled(PROJEKTI, [])).toThrow('prazen seznam terminov ne nastaja dokumenta — pregled se izvozi, ko je vpisan prvi termin')
    expect(() => buildProjektiTerminiPdfDoc([], TERMINI, { now: NOW })).toThrow('prazen seznam projektov ne nastaja dokumenta')
    expect(() => projektiTerminiPregled([], TERMINI)).toThrow('prazen seznam projektov')
  })

  it('fail-closed ×12: vsi tujci, podvojen projekt id, ne-polji, pokvaren now, ne-options, prazni nizi, neznan status, negativna/ne-cela ure, ne-ISO datum, null vnos — indeks krivca', () => {
    const now = { now: NOW }
    const tujci: ProjektiTerminiTerminVnos[] = [{ projectId: 'nikdar', status: 'NAVRTENO', predvideneUre: 1, datumZacetka: '2026-10-01T08:00:00.000Z' }]
    expect(() => projektiTerminiPregled(PROJEKTI, tujci)).toThrow('vsi termini tujci')
    expect(() => projektiTerminiPregled([PROJEKTI[0], { ...PROJEKTI[0] }], [{ projectId: 'p1', status: 'NAVRTENO', predvideneUre: 1, datumZacetka: '2026-10-01T08:00:00.000Z' }])).toThrow('podvojen projekt id p1')
    expect(() => buildProjektiTerminiPdfDoc('ne-polje' as unknown as ProjektiTerminiProjektVnos[], TERMINI, now)).toThrow(TypeError)
    expect(() => buildProjektiTerminiPdfDoc(PROJEKTI, 'ne-polje' as unknown as ProjektiTerminiTerminVnos[], now)).toThrow(TypeError)
    expect(() => buildProjektiTerminiPdfDoc(PROJEKTI, TERMINI, null as unknown as { now: Date })).toThrow(TypeError)
    expect(() => buildProjektiTerminiPdfDoc(PROJEKTI, TERMINI, { now: 'danes' as unknown as Date })).toThrow(TypeError)
    expect(() => buildProjektiTerminiPdfDoc(PROJEKTI, TERMINI, { now: new Date(NaN) })).toThrow(TypeError)
    expect(() => preveriTerminVnos(null as unknown as ProjektiTerminiTerminVnos, 2)).toThrow('pričakovan termin')
    expect(() => preveriTerminVnos({ projectId: '', status: 'NAVRTENO', predvideneUre: 1, datumZacetka: '2026-10-01T08:00:00.000Z' }, 2)).toThrow('projectId mora biti ne-prazen niz')
    expect(() => preveriTerminVnos({ projectId: 'p1', status: 'POKVAREN' as unknown as ProjektiTerminiTerminVnos['status'], predvideneUre: 1, datumZacetka: '2026-10-01T08:00:00.000Z' }, 2)).toThrow('status mora biti eden izmed 5 znanih')
    expect(() => preveriTerminVnos({ projectId: 'p1', status: 'NAVRTENO', predvideneUre: -1, datumZacetka: '2026-10-01T08:00:00.000Z' }, 2)).toThrow('predvideneUre mora biti končno celo ne-negativno')
    expect(() => preveriTerminVnos({ projectId: 'p1', status: 'NAVRTENO', predvideneUre: 1.5, datumZacetka: '2026-10-01T08:00:00.000Z' }, 2)).toThrow('predvideneUre mora biti končno celo ne-negativno')
    expect(() => preveriTerminVnos({ projectId: 'p1', status: 'NAVRTENO', predvideneUre: null, datumZacetka: 'ne-iso' }, 2)).toThrow('datumZacetka mora biti ISO niz')
    expect(() => preveriProjektVnos(null as unknown as ProjektiTerminiProjektVnos, 3)).toThrow('pričakovan projekt')
    expect(() => preveriProjektVnos({ id: 'p1', nazivProjekta: '  ', datumMontaze: null, stranka: null }, 3)).toThrow('nazivProjekta mora biti ne-prazen niz')
    expect(() => preveriProjektVnos({ id: 'p1', nazivProjekta: 'N', datumMontaze: '', stranka: null }, 3)).toThrow('datumMontaze mora biti ne-prazen niz ALI null')
    expect(() => preveriProjektVnos({ id: 'p1', nazivProjekta: 'N', datumMontaze: null, stranka: '' }, 3)).toThrow('stranka mora biti ne-prazen niz ALI null')
  })

  it('sklanjatev projektBeseda (slovenski razred — 2 projekta / 3-4 projekti / 5+ projektov / 11-14 projektov) + fail-closed ne-celo; terminBeseda EN VIR iz termini-prikaz (NI zasegane kopije)', () => {
    expect(projektBeseda(0)).toBe('projektov')
    expect(projektBeseda(1)).toBe('projekt')
    expect(projektBeseda(2)).toBe('projekta')
    expect(projektBeseda(3)).toBe('projekti')
    expect(projektBeseda(4)).toBe('projekti')
    expect(projektBeseda(5)).toBe('projektov')
    expect(projektBeseda(11)).toBe('projektov')
    expect(projektBeseda(12)).toBe('projektov')
    expect(projektBeseda(21)).toBe('projekt')
    expect(projektBeseda(22)).toBe('projekta')
    // 101 = 'sto EN projekt' (singular po enicah — R168 kanon terminBeseda);
    // 111 = 'sto enajst projektov' (zadnji dve 11)
    expect(projektBeseda(101)).toBe('projekt')
    expect(projektBeseda(111)).toBe('projektov')
    expect(() => projektBeseda(1.5)).toThrow(TypeError)
    expect(() => projektBeseda(-1)).toThrow(TypeError)
    expect(lib).toContain("from './termini-prikaz'")
    expect(lib).toContain('terminBeseda')
    expect(lib).not.toContain('function terminBeseda') // EN VIR — import, ne kopija
  })

  it('brat R264 NESPREMENJEN (soli 0x8d–0x90 + bajtno zdrav)', () => {
    const r264Lib = beri('src/lib/dobavitelji-pozicija-pdf.ts')
    expect(r264Lib).toContain('fnv1aHex(seed, 0x8d)')
    expect(r264Lib).not.toContain('fnv1aHex(seed, 0x91)')
    const doc = buildDobaviteljiPozicijaPdfDoc(
      [
        { inventoryId: 'a', cena: 100, dobaviteljId: 'd1', dobavitelj: 'D1' },
        { inventoryId: 'a', cena: 120, dobaviteljId: 'd2', dobavitelj: 'D2' },
      ],
      [{ inventoryId: 'a', bestPrice: 100, suppliers: 2 }],
      { now: NOW },
    )
    expect(Buffer.from(doc.output('arraybuffer')).subarray(0, 5).toString('ascii')).toBe('%PDF-')
  })
})

describe('R265 — WYSIWYG vir (tabela + KPI + sklep)', () => {
  it('tabela 8 stolpcev (Projekt, Stranka, Terminov, Načrtovano, V teku, Zaključeno, Ur, Obdobje) — head dobesedno', () => {
    expect(lib).toContain("['Projekt', 'Stranka', 'Terminov', 'Načrtovano', 'V teku', 'Zaključeno', 'Ur', 'Obdobje']")
  })

  it('barvna resnica: V teku AMBER bold (delo poteka), Zaključeno GREEN bold (narejeno), \'—\' Ur sivo; NIKOLI utišan alarm', () => {
    const okno = oknoMed(lib, 'didParseCell:', '})\n  y =')
    expect(okno).toContain('textColor = AMBER')
    expect(okno).toContain('textColor = GREEN')
    expect(okno).toContain('textColor = GRAY')
  })

  it('KPI 5 boxov z signalnim jezikom (Brez termina RED>0, Plan. brez termina RED>0, Z termini GREEN)', () => {
    expect(lib).toContain("'Projektov'")
    expect(lib).toContain("'Z termini'")
    expect(lib).toContain("'Brez termina'")
    expect(lib).toContain("'Plan. brez termina'")
    expect(lib).toContain("'Predvidenih ur'")
    expect(lib).toContain('povzetek.zTermini > 0 ? GREEN : NAVY')
    expect(lib).toContain('povzetek.brezTermina > 0 ? RED : NAVY')
    expect(lib).toContain('povzetek.planBrezTermina > 0 ? RED : NAVY')
  })

  it('sklep: izključitve/resnice poimenovane (planirana montaža brez termina; preklicane ure izključene; preložene v vsoti; brez ure; tujci; vir)', () => {
    expect(lib).toContain('od tega s planirano montažo')
    expect(lib).toContain('(ure preklicanih izključene iz vsote)')
    expect(lib).toContain('(ure v vsoti)')
    expect(lib).toContain('(brez ure')
    expect(lib).toContain('terminov brez ujemajočega projekta')
    expect(lib).toContain('vir = /api/schedules (vsi termini) × /api/projects')
  })

  it('glava PROJEKTI — TERMINI PREGLED + osveženo + noge Stran i/N', () => {
    expect(lib).toContain("'PROJEKTI — TERMINI PREGLED'")
    expect(lib).toContain('osveženo ${zalogaPovzetekCasOznaka(now)}')
    expect(lib).toContain('Stran ${i}/${strani}')
  })

  it('brez locale-odvisnih APIjev (determinizem čez pasove/stroje)', () => {
    expect(lib).not.toContain('localeCompare')
    expect(lib).not.toContain('toLocaleString')
    expect(lib).not.toContain('toLocaleDateString')
  })

  it('NIČ mreže v libu (client-only resnica; route NIČ; R259 lekcija 2 — ne-lovi komentarjev)', () => {
    expect(lib).not.toContain('fetch(')
    expect(lib).not.toContain("from 'node:crypto'")
    expect(lib).not.toContain("require('node:crypto')")
  })
})

describe('R265 — komponenta (logistics-tab) — pill, legenda, handler', () => {
  it('pill VEDNO viden (bralni dokument, P1-k precedens; NI gated na schedules.length — CSV/ICS disabled števec ostaja 2) + disabled={ptVTeku} dvoklik guard + press-scale + ClipboardList aria-hidden', () => {
    expect(komponenta).toContain('aria-label="Izvozi pregled projektov in terminov kot PDF"')
    expect(komponenta).toContain('title="Pregled projektov in terminov kot pravi PDF — kateri projekti imajo termine in koliko dela je še pred nami"')
    const pil = oknoMed(komponenta, 'Izvozi pregled projektov in terminov kot PDF', '<ClipboardList aria-hidden="true"')
    expect(pil).toContain('disabled={ptVTeku}')
    expect(pil).not.toContain('disabled={schedules.length === 0}')
    expect(pil).toContain('press-scale')
    expect(komponenta).toContain('<ClipboardList aria-hidden="true"')
    // CSV/ICS ostajata edina z disabled={schedules.length === 0} (obstoječi kontrakt — R255/R256 resnica)
    expect(komponenta.match(/disabled=\{schedules\.length === 0\}/g)).toHaveLength(2)
  })

  it('legenda substring-parna nadgradna (R260 lekcija 3): stara R255/R256 resnica dobesedno + nova R265 append — NIČ starega pina zlomljenega', () => {
    expect(komponenta).toContain('CSV = prikazani termini · ICS = koledar v telefonu · PDF = vozni red (kronološki) · Tedenski = naslednjih 7 dni (po dnevih)')
    expect(komponenta).toContain('· Projekti = projekti × termini (pokritost po projektih)')
  })

  it('handler: FRESH fetch VSEH terminov ISTEGA endpointa (R264 precedens — portfeljska resnica, NE glede na projekt-filter) + dvoklik guard + fail-closed PREJ (Ni vpisanih terminov) → ENA izpeljava → generate; EN now; TypeError viden razlog', () => {
    const okno = oknoMed(komponenta, 'const handleProjektiTerminiPdf', 'return (')
    expect(okno).toContain('if (ptVTeku) return')
    expect(okno).toContain("fetch('/api/schedules', { credentials: 'same-origin' })")
    expect(okno).toContain('GET /api/schedules → HTTP ${res.status}')
    expect(okno).toContain('Odgovora /api/schedules ni mogoče prebrati (ni polja).')
    expect(okno).toContain("title: 'Ni vpisanih terminov'")
    expect(okno).toContain("'Pregled projektov in terminov se izvozi, ko je vpisan prvi termin montaže.'")
    const prazen = okno.indexOf('termini.length === 0')
    const generiraj = okno.indexOf('generateProjektiTerminiPdf(')
    expect(prazen).toBeGreaterThanOrEqual(0)
    expect(generiraj).toBeGreaterThan(prazen)
    expect(okno).toContain('const { povzetek } = projektiTerminiPregled(projekti, termini)')
    expect(okno).toContain('generateProjektiTerminiPdf(projekti, termini, { now: new Date() })')
    expect(okno).toContain("title: 'Pregled projektov in terminov prenešen v PDF'")
    expect(okno).toContain("variant: 'destructive'")
    expect(okno).toContain('${povzetek.zTermini} ${projektBeseda(povzetek.zTermini)} z termini')
    expect(okno).toContain('${povzetek.terminov} ${terminBeseda(povzetek.terminov)}')
    expect(okno).toContain('setPtVTeku(false)')
  })

  it('fail-verbose DTO pruning: termin brez project.id → TypeError; projekt brez id/nazivProjekta → TypeError — nič tihe degradacije', () => {
    const okno = oknoMed(komponenta, 'const handleProjektiTerminiPdf', 'return (')
    expect(okno).toContain('manjkajoč project.id v odgovoru API-ja')
    expect(okno).toContain('manjkajoč id/nazivProjekta v odgovoru API-ja')
    expect(okno).toContain('(data as Array<Record<string, unknown>>).map((s, i) => {')
    expect(okno).toContain('projects.map((p, i) => {')
  })

  it('0 novih hex (žetoni samo — družinsko pravilo R224–R264)', () => {
    const hexi = komponenta.match(/#[0-9a-fA-F]{6}\b/g) ?? []
    const znani = new Set(['2a3f5f', '1d2b3e'])
    for (const h of hexi) expect(znani.has(h.slice(1).toLowerCase())).toBe(true)
  })
})
