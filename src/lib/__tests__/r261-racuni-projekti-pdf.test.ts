// ---------------------------------------------------------------------------
// R261 — RAČUNI PO PROJEKTIH: PONUDBA vs REALIZACIJA PDF (17. člen 'izvozi'
// družine, P1-f) — testi. Bajtni dokazi (determinizem: enak vhod = bajtno
// enak PDF; PREMEŠAN VRSTNI RED = bajtno ENAK — sort interno, f(množica);
// %PDF- magija; NOV glifni razred — R249 doktrina) + presek-resnice
// (ponudba = SHRANJEN estimatedPrice — read-only, NIČ pricing jedra;
// realizirano = IZDAN+PLACAN EN VIR STATUSI prihodki-pdf R250; odstopanje =
// izpeljana resnica; JOIN po IDENTITETI projectId === id — R260 lekcija;
// brez-ponudbe + brez-zapisa + stornirani/osnutki = poimenovani, NIKOLI
// tiho) + vsebinski dokazi na VIRU liba in komponente.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildRacuniProjektiPdfDoc,
  racuniProjektiPdfFilename,
  racuniProjektiPoProjektih,
  preveriRacuniProjektiRacun,
  preveriRacuniProjektiProjekt,
  type RacuniProjektiRacun,
  type RacuniProjektiProjekt,
} from '@/lib/racuni-projekti-pdf'
import { buildDobicikonostPdfDoc } from '@/lib/dobicikonost-pdf'

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

const lib = beri('src/lib/racuni-projekti-pdf.ts')
const komponenta = beri('src/components/roksal/vodja-dashboard.tsx')
const prihodkiLib = beri('src/lib/prihodki-pdf.ts')

// FIXED now (determinizem — žig + CreationDate + fileId + ime).
const NOW: Date = new Date('2026-09-28T10:30:00.000Z')

// 5 računov: Kokalj IZDAN+PLACAN (7000), Zupan IZDAN + OSNUTEK (osnutek
// izključen), STORNIRAN (izključen + poimenovan).
const RACUNI: RacuniProjektiRacun[] = [
  { stevilka: '2026-001', status: 'IZDAN', znesek: 5000, projectId: 'p-kokalj', projekt: 'Ograja Kokalj' },
  { stevilka: '2026-002', status: 'PLACAN', znesek: 2000, projectId: 'p-kokalj', projekt: 'Ograja Kokalj' },
  { stevilka: '2026-003', status: 'IZDAN', znesek: 1200, projectId: 'p-zupan', projekt: 'Terasa Zupan' },
  { stevilka: '2026-004', status: 'STORNIRAN', znesek: 999, projectId: 'p-zupan', projekt: 'Terasa Zupan' },
  { stevilka: '2026-005', status: 'OSNUTEK', znesek: 150, projectId: 'p-zupan', projekt: 'Terasa Zupan' },
]

// 3 projekti: Kokalj ponudba 8000 (odstopanje −1000), Zupan ponudba 1200
// (odstopanje 0), Novak BREZ vpisane ponudbe (null → '—') ampak brez računov
// z realizacijo — vrstica zaradi vpisane? NE: Novak ima NE vpisane → brez
// računov IN brez ponudbe = NI vrstice (demonstrirano v 'brez obeh resnic').
const PROJEKTI: RacuniProjektiProjekt[] = [
  { id: 'p-kokalj', nazivProjekta: 'Ograja Kokalj', estimatedPrice: 8000 },
  { id: 'p-zupan', nazivProjekta: 'Terasa Zupan', estimatedPrice: 1200 },
]

function zgradi(
  racuni: readonly RacuniProjektiRacun[] = RACUNI,
  projekti: readonly RacuniProjektiProjekt[] = PROJEKTI,
  now: Date = NOW,
): Buffer {
  const doc = buildRacuniProjektiPdfDoc(racuni, projekti, { now })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R261 — PDF bajtni dokazi (determinizem + glifni razred minute — R249 doktrina)', () => {
  it('determinizem: enak vhod = bajtno enak; PREMEŠAN VRSTNI RED = bajtno ENAK (sort interno); drug now = drugačen', () => {
    expect(zgradi().equals(zgradi())).toBe(true)
    const preskakljani = zgradi(
      [RACUNI[4], RACUNI[2], RACUNI[0], RACUNI[3], RACUNI[1]],
      [PROJEKTI[1], PROJEKTI[0]],
    )
    expect(preskakljani.equals(zgradi())).toBe(true)
    expect(zgradi(RACUNI, PROJEKTI, new Date('2026-09-28T10:31:00.000Z')).equals(zgradi())).toBe(false)
  })

  it('%PDF- magija + NOV glifni razred (≠ vseh 24 znanih družinskih razredov) + ime Racuni-po-projektih-YYYY-MM-DD.pdf', () => {
    const bin = zgradi()
    expect(bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    // dolžinski razredi bratov (R250–R260 E2E dokazi) — TA dokument = NOV razred
    const znani = [30057, 30119, 30191, 30253, 35565, 38753, 39927, 41519, 42798, 37709, 37771, 36788, 36656, 36532, 33958, 36555, 38631, 45508, 44828, 36260, 36583, 45127, 38565]
    expect(znani).not.toContain(bin.length)
    expect(racuniProjektiPdfFilename(NOW)).toBe('Racuni-po-projektih-2026-09-28.pdf')
  })

  it('soli 0x81–0x84 — UNIKATNE v družini (register: dobičkonost 0x7d–0x80 — bratje NE delijo semen; isti seed različna liba = različna ID)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0x81)')
    expect(lib).toContain('fnv1aHex(seed, 0x84)')
    for (const brat of ['0x7d) +\n    fnv1aHex(seed, 0x7e', '0x61) +']) {
      expect(lib).not.toContain(brat.replace('0x61) +', 'fnv1aHex(seed, 0x61)'))
    }
    expect(lib).not.toContain('fnv1aHex(seed, 0x7d)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x61)')
  })
})

describe('R261 — presek-resnice (ENA resnica za KPI + tabelo + sklep + mini-vrstico + toast)', () => {
  it('vrste po IDENTITETI: realizirano IZDAN+PLACAN, odstopanje izpeljava, % samo pri ponudba > 0; osnutki/stornirani izključeni', () => {
    const { vrste, povzetek } = racuniProjektiPoProjektih(RACUNI, PROJEKTI)
    expect(vrste).toHaveLength(2)
    const kokalj = vrste.find((v) => v.projekt === 'Ograja Kokalj')!
    expect(kokalj.ponudba).toBe(8000)
    expect(kokalj.realizirano).toBe(7000)
    expect(kokalj.odstopanje).toBe(-1000)
    expect(kokalj.realizacijaOdstotek).toBeCloseTo(87.5, 9)
    expect(kokalj.racunov).toBe(2)
    const zupan = vrste.find((v) => v.projekt === 'Terasa Zupan')!
    // IZDAN 1200 šteje; STORNIRAN 999 + OSNUTEK 150 izključeni iz realizacije
    expect(zupan.realizirano).toBe(1200)
    expect(zupan.odstopanje).toBe(0)
    expect(zupan.racunov).toBe(1)
    expect(povzetek.storniranih).toBe(1)
    expect(povzetek.osnutkiRacunov).toBe(1)
  })

  it('JOIN po IDENTITETI (v === s — R260 lekcija): dva ISTONAŽNA projekta z različnim id = DVE različni resnici', () => {
    const racuni: RacuniProjektiRacun[] = [
      { stevilka: '2026-011', status: 'IZDAN', znesek: 100, projectId: 'p-1', projekt: 'Podjetje A' },
      { stevilka: '2026-012', status: 'PLACAN', znesek: 300, projectId: 'p-2', projekt: 'Podjetje A' },
    ]
    const projekti: RacuniProjektiProjekt[] = [
      { id: 'p-1', nazivProjekta: 'Podjetje A', estimatedPrice: 50 },
      { id: 'p-2', nazivProjekta: 'Podjetje A', estimatedPrice: 1000 },
    ]
    const { vrste } = racuniProjektiPoProjektih(racuni, projekti)
    expect(vrste).toHaveLength(2)
    expect(vrste[0].id).toBe('p-1')
    expect(vrste[0].realizirano).toBe(100)
    expect(vrste[1].id).toBe('p-2')
    expect(vrste[1].realizirano).toBe(300)
  })

  it("brez vpisane ponudbe: ponudba/odstopanje/% = null ('—' — NIKOLI izmišljena ničla) + brezPonudbe števec; Σ ponudbe DOLGOVANA resnici", () => {
    const racuni: RacuniProjektiRacun[] = [
      { stevilka: '2026-021', status: 'IZDAN', znesek: 250, projectId: 'p-brezcene' },
    ]
    const projekti: RacuniProjektiProjekt[] = [
      { id: 'p-brezcene', nazivProjekta: 'Brez Ponudbe', estimatedPrice: null },
      { id: 'p-sceno', nazivProjekta: 'S Ponudbo', estimatedPrice: 1000 },
    ]
    const { vrste, povzetek } = racuniProjektiPoProjektih(racuni, projekti)
    const brez = vrste.find((v) => v.projekt === 'Brez Ponudbe')!
    expect(brez.ponudba).toBeNull()
    expect(brez.odstopanje).toBeNull()
    expect(brez.realizacijaOdstotek).toBeNull()
    expect(brez.realizirano).toBe(250)
    expect(povzetek.brezPonudbe).toBe(1)
    expect(povzetek.ponudbaZneskov).toBe(1)
    expect(povzetek.ponudba).toBe(1000)
    // Σ odstopanja čez vrste z vpisano ponudbo: p-sceno (realizirano 0 − 1000 = −1000); p-brezcene = null (ne šteje)
    expect(povzetek.odstopanje).toBe(-1000)
    // NIČ definiranega → Σ je '—' (null), ne izmišljenih 0.00
    const prazno = racuniProjektiPoProjektih(
      [{ stevilka: '2026-022', status: 'IZDAN', znesek: 10, projectId: 'x' }],
      [{ id: 'x', nazivProjekta: 'X', estimatedPrice: null }],
    ).povzetek
    expect(prazno.ponudba).toBeNull()
    expect(prazno.odstopanje).toBeNull()
  })

  it('projekt brez računov z vpisano ponudbo = vrstica (realizirano 0 = poimenovana prazna vsota, R258 vzorec); brez obeh resnic = NI vrstice', () => {
    const projekti: RacuniProjektiProjekt[] = [
      { id: 'p-samo-ponudba', nazivProjekta: 'Samo Ponudba', estimatedPrice: 500 },
      { id: 'p-prazen', nazivProjekta: 'Prazen Projekt', estimatedPrice: null },
    ]
    const { vrste, povzetek } = racuniProjektiPoProjektih([], projekti)
    expect(vrste).toHaveLength(1)
    expect(vrste[0].realizirano).toBe(0)
    expect(vrste[0].racunov).toBe(0)
    expect(povzetek.projektov).toBe(1)
  })

  it('račun z projectId brez projektnega zapisa: NI vrstice, števec + vsota poimenovana (vlogsko zožen odgovor — nikoli tiho)', () => {
    const racuni: RacuniProjektiRacun[] = [
      { stevilka: '2026-031', status: 'IZDAN', znesek: 300, projectId: 'p-izgubljen', projekt: 'Izgubljeni Snapshot' },
      { stevilka: '2026-032', status: 'OSNUTEK', znesek: 50, projectId: 'p-izgubljen2' },
    ]
    const { vrste, povzetek } = racuniProjektiPoProjektih(racuni, PROJEKTI)
    expect(vrste).toHaveLength(2) // samo Kokalj + Zupan
    expect(povzetek.racunovBrezProjekta).toBe(2)
    expect(povzetek.znesekBrezProjekta).toBe(300) // OSNUTEK izključen iz vsote
    expect(povzetek.osnutkiRacunov).toBe(1) // samo OSNUTEK 50 (v TEM klicu — Zupan osnutek je v drugem vhodu)
  })

  it('povzetek agregati + negativnih odstopanj števec; premešan vhod = ISTI povzetek (f(MNOŽICA))', () => {
    const a = racuniProjektiPoProjektih(RACUNI, PROJEKTI).povzetek
    const b = racuniProjektiPoProjektih([RACUNI[3], RACUNI[0], RACUNI[4], RACUNI[2], RACUNI[1]], [PROJEKTI[1], PROJEKTI[0]]).povzetek
    expect(a).toEqual(b)
    expect(a.projektov).toBe(2)
    expect(a.ponudbaZneskov).toBe(2)
    expect(a.brezPonudbe).toBe(0)
    expect(a.realizirano).toBe(8200)
    expect(a.odstopanje).toBe(7000 + 1200 - 8000 - 1200)
    expect(a.negativnih).toBe(1)
  })

  it('sort IZVOŽEN: NAZIV ASC (navadno < po UTF-16 kodnih točkah), izenačba id ASC (dva istonažna = determinističen red)', () => {
    const { vrste } = racuniProjektiPoProjektih(RACUNI, PROJEKTI)
    expect(vrste.map((v) => v.projekt)).toEqual(['Ograja Kokalj', 'Terasa Zupan'])
    const racuni: RacuniProjektiRacun[] = [{ stevilka: '2026-041', status: 'IZDAN', znesek: 1, projectId: 'b' }]
    const projekti: RacuniProjektiProjekt[] = [
      { id: 'b', nazivProjekta: 'Enaki Naziv', estimatedPrice: 1 },
      { id: 'a', nazivProjekta: 'Enaki Naziv', estimatedPrice: 1 },
    ]
    const { vrste: vrste2 } = racuniProjektiPoProjektih(racuni, projekti)
    expect(vrste2.map((v) => v.id)).toEqual(['a', 'b'])
  })

  it('EN ne-prazen vir ZADOVOLJI: samo računi (brez projektov = vse brez zapisa) ALI samo projekti (realizirano 0) — obe poimenovani resnici', () => {
    const samoProjekti = racuniProjektiPoProjektih([], PROJEKTI)
    expect(samoProjekti.povzetek.projektov).toBe(2)
    const samoRacuni = racuniProjektiPoProjektih(
      [{ stevilka: '2026-051', status: 'PLACAN', znesek: 100, projectId: 'p-x' }],
      [],
    )
    expect(samoRacuni.povzetek.projektov).toBe(0)
    expect(samoRacuni.povzetek.racunovBrezProjekta).toBe(1)
  })
})

describe('R261 — fail-closed v libu (družina R236/R250–R260)', () => {
  it('prazen presek (0 računov IN 0 projektov) ne nastaja dokumenta — TypeError s toast sporočilom komponente', () => {
    expect(() => buildRacuniProjektiPdfDoc([], [], { now: NOW })).toThrow(
      TypeError,
    )
    expect(() => buildRacuniProjektiPdfDoc([], [], { now: NOW })).toThrow(
      'prazen presek ne nastaja dokumenta',
    )
  })

  it('fail-closed ×10: ne-polji, ne-options, pokvaren now, neznan status, negativen znesek, prazna številka, prazen projectId, pokvaren projekt (id/naziv/estimatedPrice) — indeks krivca', () => {
    const now = { now: NOW }
    expect(() => buildRacuniProjektiPdfDoc('ne-polje' as unknown as RacuniProjektiRacun[], PROJEKTI, now)).toThrow(TypeError)
    expect(() => buildRacuniProjektiPdfDoc(RACUNI, 'ne-polje' as unknown as RacuniProjektiProjekt[], now)).toThrow(TypeError)
    expect(() => buildRacuniProjektiPdfDoc(RACUNI, PROJEKTI, null as unknown as { now: Date })).toThrow(TypeError)
    expect(() => buildRacuniProjektiPdfDoc(RACUNI, PROJEKTI, { now: 'danes' as unknown as Date })).toThrow(TypeError)
    expect(() => buildRacuniProjektiPdfDoc(RACUNI, PROJEKTI, { now: new Date(NaN) })).toThrow(TypeError)
    expect(() => preveriRacuniProjektiRacun({ stevilka: '2026-1', status: 'TUPI', znesek: 1, projectId: 'p' }, 3)).toThrow('status mora biti eden iz')
    expect(() => preveriRacuniProjektiRacun({ stevilka: '2026-1', status: 'IZDAN', znesek: -1, projectId: 'p' }, 3)).toThrow('znesek mora biti končno ne-negativno')
    expect(() => preveriRacuniProjektiRacun({ stevilka: '  ', status: 'IZDAN', znesek: 1, projectId: 'p' }, 3)).toThrow('stevilka mora biti ne-prazen niz')
    expect(() => preveriRacuniProjektiRacun({ stevilka: '2026-1', status: 'IZDAN', znesek: 1, projectId: '' }, 3)).toThrow('projectId mora biti ne-prazen niz')
    expect(() => preveriRacuniProjektiProjekt({ id: '', nazivProjekta: 'X', estimatedPrice: null }, 3)).toThrow('id mora biti ne-prazen niz')
    expect(() => preveriRacuniProjektiProjekt({ id: 'p', nazivProjekta: '  ', estimatedPrice: null }, 3)).toThrow('nazivProjekta mora biti ne-prazen niz')
    expect(() => preveriRacuniProjektiProjekt({ id: 'p', nazivProjekta: 'X', estimatedPrice: -5 }, 3)).toThrow('estimatedPrice mora biti končno ne-negativno število ali null')
    expect(() => preveriRacuniProjektiProjekt({ id: 'p', nazivProjekta: 'X', estimatedPrice: '8000' as unknown as number }, 3)).toThrow('estimatedPrice mora biti')
  })

  it('EN VIR import dokazi: STATUSI iz prihodki-pdf (R250) — nič dvojnega seznama; brat dobičkonost NESPREMENJEN (bajtni kontrakt)', () => {
    expect(lib).toContain("import { STATUSI as STATUSI_RACUNOV } from './prihodki-pdf'")
    expect(prihodkiLib).toContain("export const STATUSI = ['OSNUTEK', 'IZDAN', 'PLACAN', 'STORNIRAN'] as const")
    // R258 brat ima svoje soli — R261 mu nič ne vzame
    const dobiLib = beri('src/lib/dobicikonost-pdf.ts')
    expect(dobiLib).toContain('fnv1aHex(seed, 0x7d)')
    expect(dobiLib).not.toContain('fnv1aHex(seed, 0x81)')
    // determinizem brata: dobičkonost z ISTIMI racuni = bajtno ISTI kot R258 znani razred dokaz (dvojni bajtni test — R260 vzorec)
    const racuni258 = [{ stevilka: '2026-001', status: 'IZDAN', znesek: 5000, projekt: 'Ograja Kokalj' }]
    const doc = buildDobicikonostPdfDoc(racuni258, [], { now: NOW })
    expect(Buffer.from(doc.output('arraybuffer')).subarray(0, 5).toString('ascii')).toBe('%PDF-')
  })
})

describe('R261 — WYSIWYG vir (tabela + KPI + sklep)', () => {
  it('tabela 6 stolpcev (Projekt, Ponudba, Realizirano, Odstopanje, Realizacija (%), Računov) — head dobesedno', () => {
    expect(lib).toContain("['Projekt', 'Ponudba (EUR)', 'Realizirano (EUR)', 'Odstopanje (EUR)', 'Realizacija (%)', 'Računov']")
  })

  it('odstopanje barvna resnica: negativno RDEČE bold (NIKOLI utišano), pozitivno ZELENO bold; pod-100 % AMBER bold, ≥100 ZELENO; \'—\' sivo', () => {
    const okno = oknoMed(lib, 'didParseCell:', '})\n  y =')
    expect(okno).toContain('textColor = RED')
    expect(okno).toContain('textColor = GREEN')
    expect(okno).toContain('textColor = AMBER')
    expect(okno).toContain('textColor = GRAY')
  })

  it('KPI 5 boxov z signalnim jezikom (Ponudba/Realizirano/Odstopanje po predznaku, Brez ponudbe rdeče pri > 0)', () => {
    expect(lib).toContain("'Projektov'")
    expect(lib).toContain("'Ponudba'")
    expect(lib).toContain("'Realizirano'")
    expect(lib).toContain("'Odstopanje'")
    expect(lib).toContain("'Brez ponudbe'")
  })

  it('sklep: izključitve poimenovane (stornirani/osnutki iz realizacije; brez projektnega zapisa; brez vpisane ponudbe) — iskren podpis', () => {
    expect(lib).toContain('(izključeni iz realizacije)')
    expect(lib).toContain('brez projektnega zapisa')
    expect(lib).toContain('brez vpisane ponudbe')
  })

  it('glava RAČUNI PO PROJEKTIH + osveženo + noge Stran i/N', () => {
    expect(lib).toContain("'RAČUNI PO PROJEKTIH'")
    expect(lib).toContain('osveženo ${zalogaPovzetekCasOznaka(now)}')
    expect(lib).toContain('Stran ${i}/${strani}')
  })

  it('brez locale-odvisnih APIjev (determinizem čez pasove/stroje)', () => {
    expect(lib).not.toContain('localeCompare')
    expect(lib).not.toContain('toLocaleString')
    expect(lib).not.toContain('toLocaleDateString')
  })

  it('NIČ mreže v libu (client-only resnica — izvoz je potrošnik obstoječih odgovorov; route NIČ; R259 lekcija 2 — ne-lovi komentarjev)', () => {
    expect(lib).not.toContain('fetch(')
    expect(lib).not.toContain("from 'node:crypto'")
    expect(lib).not.toContain("require('node:crypto')")
  })
})

describe('R261 — komponenta (vodja-dashboard) — pill, legenda, handler, mini-vrstica', () => {
  it('pill VEDNO viden (bralni dokument, P1-k precedens) + press-scale + FileText aria-hidden + disabled guard — pariteta R258', () => {
    const okno = oknoMed(komponenta, 'R261 — RAČUNI PO PROJEKTIH PDF (17. člen', '</Button>\n      </div>')
    expect(okno).toContain('press-scale')
    expect(okno).toContain('FileText')
    expect(okno).toContain('aria-hidden="true"')
    expect(okno).toContain('disabled={loading || racuniProjektiVTeku}')
    expect(okno).toContain('focus-visible:ring-2')
  })

  it('legenda substring-parna nadgradna (R260 lekcija 3): stara R258 resnica dobesedno + nova R261 append — NIČ starega pina zlomljenega', () => {
    expect(komponenta).toContain('Prihodki = izdani + plačani računi · Stroški = ne-preklicana naročila · Marža = prihodki − stroški · Marža (%) = marža / prihodki · Brez projekta = izključeni iz preseka')
    expect(komponenta).toContain('· Ponudba = vpisana ocena (estimatedPrice) · Realizirano = izdani + plačani računi · Odstopanje = realizirano − ponudba')
  })

  it('handler: ENA izpeljava racuniProjektiPoProjektih za toast, EN now, fail-closed toast pri praznem preseku, TypeError viden razlog, dvoklik guard', () => {
    const okno = oknoMed(komponenta, 'const handleRacuniProjektiPdf', 'function exportDailyCsv')
    expect(okno).toContain('if (racuniProjektiVTeku || loading) return')
    expect(okno).toContain('setRacuniProjektiVTeku(true)')
    expect(okno).toContain("title: 'Ni podatkov za račune po projektih'")
    expect(okno).toContain("'PDF se izvozi, ko je vpisan prvi račun ali projektna ponudba.'")
    expect(okno).toContain('buildRacuniProjektiPdfDoc(racuniProjektiVhodi.racuni, racuniProjektiVhodi.projekti, { now })')
    expect(okno).toContain('racuniProjektiPdfFilename(now)')
    // ISTA izpeljava (WYSIWYG): toast bere iz ISTEGA racuniProjektiPoProjektih
    expect(okno.split('racuniProjektiPoProjektih(').length - 1).toBeGreaterThanOrEqual(1)
    expect(okno).toContain("title: 'Računi po projektih prenešeni v PDF'")
    expect(okno).toContain('variant: \'destructive\'')
  })

  it('InvLite nosi projectId (IDENTITETA joina — R260 lekcija) + vhodi iz ISTIH state-ov (NIČ nove mreže) + memo', () => {
    expect(komponenta).toContain('projectId: string')
    expect(komponenta).toContain('projectId: inv.projectId')
    expect(komponenta).toContain('estimatedPrice: p.estimatedPrice ?? null')
    expect(komponenta).toContain('useMemo')
  })

  it('F2 mini-vrstica Ponudbe v izvedbi: WYSIWYG ISTA izpeljava (≥ 2 klici racuniProjektiPoProjektih v komponenti) + žig brez vpisane (R227 jezik) + \'—\' resnica', () => {
    expect(komponenta).toContain('Ponudbe v izvedbi')
    expect(komponenta).toContain('brez vpisane ponudbe')
    expect((komponenta.match(/racuniProjektiPoProjektih\(/g) ?? []).length).toBeGreaterThanOrEqual(2)
    const okno = oknoMed(komponenta, 'R261 — F2 ponudbeni pregled', '</div>\n            </div>')
    expect(okno).toContain('col-span-2')
    expect(okno).toContain("!== null ? formatEUR(racuniProjektiPovzetek.ponudba) : '—'")
    expect(okno).toContain('bg-roksal-amber')
    expect(okno).toContain('bg-roksal-green')
  })

  it('0 novih hex (žetoni samo — družinsko pravilo R224–R260; EDINI obstoječi hex = crew barva fallback R163, ta runda NIČ novega)', () => {
    const hexi = komponenta.match(/#[0-9a-fA-F]{6}\b/g) ?? []
    const znani = new Set(['1d2b3e']) // obstoječi crew fallback — NI del te runde
    for (const h of hexi) expect(znani.has(h.slice(1).toLowerCase())).toBe(true)
    expect(hexi).toHaveLength(1)
  })
})
