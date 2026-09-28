// ---------------------------------------------------------------------------
// R258 — DOBIČKONOST PO PROJEKTIH PDF (14. člen 'izvozi' družine, P1-f) —
// testi. Bajtni dokazi (determinizem: enak vhod = bajtno enak PDF; PREMEŠAN
// VRSTNI RED = bajtno ENAK — sort interno, f(množica); %PDF- magija; NOV
// glifni razred — R249 doktrina) + presek-resnice (prihodki = IZDAN+PLACAN EN
// VIR STATUSI prihodki-pdf R250; stroški = ne-preklicana naročila EN VIR
// STATUSI_NAROCIL narocila-pregled-pdf R257; marža = izpeljana resnica;
// brez-projektni + stornirani/osnutki = poimenovani, NIKOLI tiho) + vsebinski
// dokazi na VIRU liba in komponente.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildDobicikonostPdfDoc,
  dobicikonostPdfFilename,
  dobicikonostPoProjektih,
  preveriDobicikonostRacun,
  preveriDobicikonostNarocilo,
  type DobicikonostRacun,
  type DobicikonostNarocilo,
  type DobicikonostVrsta,
} from '@/lib/dobicikonost-pdf'

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

const lib = beri('src/lib/dobicikonost-pdf.ts')
const komponenta = beri('src/components/roksal/vodja-dashboard.tsx')
const prihodkiLib = beri('src/lib/prihodki-pdf.ts')
const narocilaLib = beri('src/lib/narocila-pregled-pdf.ts')

// FIXED now (determinizem — žig + CreationDate + fileId + ime).
const NOW: Date = new Date('2026-09-28T10:30:00.000Z')

// 6 računov: Kokalj IZDAN+PLACAN (7500), Zupan IZDAN + OSNUTEK (1200 — osnutek
// izključen), STORNIRAN (izključen + poimenovan), brez projekta (300 —
// izključen iz preseka, poimenovan).
const RACUNI: DobicikonostRacun[] = [
  { stevilka: '2026-001', status: 'IZDAN', znesek: 5000, projekt: 'Ograja Kokalj' },
  { stevilka: '2026-002', status: 'PLACAN', znesek: 2500, projekt: 'Ograja Kokalj' },
  { stevilka: '2026-003', status: 'IZDAN', znesek: 1200, projekt: 'Terasa Zupan' },
  { stevilka: '2026-004', status: 'STORNIRAN', znesek: 999, projekt: 'Terasa Zupan' },
  { stevilka: '2026-005', status: 'IZDAN', znesek: 300, projekt: null },
  { stevilka: '2026-006', status: 'OSNUTEK', znesek: 150, projekt: 'Terasa Zupan' },
]

// 6 naročil: Kokalj 2× ne-preklicani (8500) + 1× PREKlicANO (izključen),
// Zupan 1×, Novak samo stroški (prihodki 0 → % NI definiran → '—'),
// 1× brez projekta (izključen iz preseka, poimenovan).
const NAROCILA: DobicikonostNarocilo[] = [
  { status: 'OSNUTEK', skupajCena: 8000, projekt: 'Ograja Kokalj' },
  { status: 'DOBLJENO', skupajCena: 500, projekt: 'Ograja Kokalj' },
  { status: 'PREKlicANO', skupajCena: 4000, projekt: 'Ograja Kokalj' },
  { status: 'OSNUTEK', skupajCena: 600, projekt: 'Terasa Zupan' },
  { status: 'POSLANO', skupajCena: 700, projekt: null },
  { status: 'POTRJENO', skupajCena: 900, projekt: 'Ograja Novak' },
]

function zgradi(
  racuni: readonly DobicikonostRacun[] = RACUNI,
  narocila: readonly DobicikonostNarocilo[] = NAROCILA,
  now: Date = NOW,
): Buffer {
  const doc = buildDobicikonostPdfDoc(racuni, narocila, { now })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R258 — PDF bajtni dokazi (determinizem + glifni razred minute — R249 doktrina)', () => {
  it('determinizem: enak vhod = bajtno enak; PREMEŠAN VRSTNI RED = bajtno ENAK (sort interno); drug now = drugačen', () => {
    expect(zgradi().equals(zgradi())).toBe(true)
    expect(zgradi([...RACUNI].reverse(), [...NAROCILA].reverse()).equals(zgradi(RACUNI, NAROCILA))).toBe(true)
    expect(zgradi(RACUNI, NAROCILA, NOW).equals(zgradi(RACUNI, NAROCILA, new Date('2026-09-28T10:31:00.000Z')))).toBe(false)
  })

  it('%PDF- magija + NOV glifni razred (≠ vseh 19 znanih družinskih razredov) + ime Dobicikonost-projektov-YYYY-MM-DD.pdf', () => {
    const buf = zgradi()
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
    // znani razredi (19): Osnutek ×4, primerjalni ×5, cenik ×2, prihodki,
    // opomnik ×2, potekli, koledar, vozni red (38631 R255), tedenski (45508
    // R256), naročila pregled (44828 R257) — dobičkonost je NOV
    const znani = [30057, 30119, 30191, 30253, 35565, 38753, 39927, 41519, 42798, 37709, 37771, 36788, 36656, 36532, 33958, 36555, 38631, 45508, 44828]
    expect(znani.includes(buf.length)).toBe(false)
    expect(dobicikonostPdfFilename(NOW)).toBe('Dobicikonost-projektov-2026-09-28.pdf')
    // fail-closed: pokvaren now → TypeError (nič NaN imen)
    expect(() => dobicikonostPdfFilename(new Date('ne'))).toThrow(TypeError)
  })

  it('soli 0x7d–0x80 — UNIKATNE v družini (register: naročila 0x79–0x7c, tedenski 0x75–0x78 — bratje NE delijo semen)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0x7d)')
    expect(lib).toContain('fnv1aHex(seed, 0x80)')
    // sorojenci NE smejo deliti 0x7d–0x80
    expect(prihodkiLib).not.toContain('0x7d')
    expect(narocilaLib).not.toContain('0x7d')
  })
})

describe('R258 — presek-resnice (ENA resnica za KPI + tabelo + sklep + toast)', () => {
  it('vrste po projektih: prihodki IZDAN+PLACAN, stroški ne-preklicanih, marža izpeljava, % definiran samo pri prihodkih', () => {
    const { vrste } = dobicikonostPoProjektih(RACUNI, NAROCILA)
    const poImenu = new Map(vrste.map((v) => [v.projekt, v]))
    const kokalj = poImenu.get('Ograja Kokalj')!
    expect(kokalj.prihodki).toBe(7500) // 5000 + 2500
    expect(kokalj.stroski).toBe(8500) // 8000 + 500 (PREKlicANO 4000 izključen)
    expect(kokalj.marza).toBe(-1000) // izpeljana resnica — negativna VIDOVA
    expect(kokalj.marzaOdstotek).toBeCloseTo(-13.3333333, 6)
    expect(kokalj.racunov).toBe(2)
    expect(kokalj.narocil).toBe(2)
    const zupan = poImenu.get('Terasa Zupan')!
    expect(zupan.prihodki).toBe(1200) // OSNUTEK + STORNIRAN izključeni
    expect(zupan.stroski).toBe(600)
    expect(zupan.marzaOdstotek).toBeCloseTo(50, 10)
    expect(zupan.racunov).toBe(1)
    expect(zupan.narocil).toBe(1)
    const novak = poImenu.get('Ograja Novak')!
    expect(novak.prihodki).toBe(0) // resnica prazne vsote
    expect(novak.stroski).toBe(900)
    expect(novak.marzaOdstotek).toBeNull() // % NI definiran → '—' (NIKOLI 0 %)
  })

  it('povzetek agregati + brez-projektni + stornirani/osnutki poimenovani; premešan vhod = ISTI povzetek (f(MNOŽICA))', () => {
    const { povzetek } = dobicikonostPoProjektih(RACUNI, NAROCILA)
    expect(povzetek.projektov).toBe(3)
    expect(povzetek.prihodki).toBe(8700)
    expect(povzetek.stroski).toBe(10000)
    expect(povzetek.marza).toBe(-1300)
    expect(povzetek.negativnih).toBe(2)
    expect(povzetek.racunovBrezProjekta).toBe(1)
    expect(povzetek.prihodkiBrezProjekta).toBe(300)
    expect(povzetek.narocilBrezProjekta).toBe(1)
    expect(povzetek.stroskiBrezProjekta).toBe(700)
    expect(povzetek.storniranih).toBe(1)
    expect(povzetek.osnutkiRacunov).toBe(1)
    const premesan = dobicikonostPoProjektih([...RACUNI].reverse(), [...NAROCILA].reverse()).povzetek
    expect(premesan).toEqual(dobicikonostPoProjektih(RACUNI, NAROCILA).povzetek)
  })

  it('sort IZVOŽEN: MARŽA ASC (najslabša prva = akcijski red, R252 vzorec), izenačba projekt ASC', () => {
    const { vrste } = dobicikonostPoProjektih(RACUNI, NAROCILA)
    expect(vrste.map((v) => `${v.marza}/${v.projekt}`)).toEqual([
      '-1000/Ograja Kokalj',
      '-900/Ograja Novak',
      '600/Terasa Zupan',
    ])
    const sortiraj = (xs: DobicikonostVrsta[]) => [...xs].sort((a, b) => a.marza - b.marza)
    expect(sortiraj(vrste)[0].projekt).toBe('Ograja Kokalj') // neodvisen dokaz istega reda
  })

  it('EN ne-prazen vir ZADOVOLJI: samo računi (stroški 0) ALI samo naročila (prihodki 0) — obe poimenovani resnici', () => {
    const samoRacuni = buildDobicikonostPdfDoc(RACUNI, [], { now: NOW })
    expect(Buffer.from(samoRacuni.output('arraybuffer')).subarray(0, 5).toString()).toBe('%PDF-')
    const samoNarocila = buildDobicikonostPdfDoc([], NAROCILA, { now: NOW })
    const { povzetek } = dobicikonostPoProjektih([], NAROCILA)
    expect(povzetek.prihodki).toBe(0) // resnica prazne vsote — dokument NE laže
    expect(povzetek.projektov).toBe(3)
    expect(Buffer.from(samoNarocila.output('arraybuffer')).subarray(0, 5).toString()).toBe('%PDF-')
  })
})

describe('R258 — fail-closed v libu (družina R236/R250–R257)', () => {
  it('prazen presek (0 računov IN 0 naročil) ne nastaja dokumenta — TypeError s toast sporočilom komponente', () => {
    expect(lib).toContain('prazen presek ne nastaja dokumenta')
    expect(lib).toContain('(Ni podatkov za dobičkonost.)')
    expect(() => buildDobicikonostPdfDoc([], [], { now: NOW })).toThrow(TypeError)
  })

  it('fail-closed ×9: ne-polji, ne-options, pokvaren now, neznan status (račun + naročilo), negativen znesek, prazna številka, pokvaren projekt, negativen skupajCena — indeks krivca', () => {
    expect(() => buildDobicikonostPdfDoc('racuni' as unknown as DobicikonostRacun[], NAROCILA, { now: NOW })).toThrow(TypeError)
    expect(() => buildDobicikonostPdfDoc(RACUNI, 'narocila' as unknown as DobicikonostNarocilo[], { now: NOW })).toThrow(TypeError)
    expect(() => buildDobicikonostPdfDoc(RACUNI, NAROCILA, null as unknown as { now: Date })).toThrow(TypeError)
    expect(() => buildDobicikonostPdfDoc(RACUNI, NAROCILA, { now: new Date('ne') })).toThrow(/now/)
    expect(() => buildDobicikonostPdfDoc([{ ...RACUNI[0], status: 'PLACANO?' }], NAROCILA, { now: NOW })).toThrow(/preveriDobicikonostRacun \(0\)/)
    expect(() => buildDobicikonostPdfDoc(RACUNI, [{ ...NAROCILA[0], status: 'ZAKLJUCENO' }], { now: NOW })).toThrow(/preveriDobicikonostNarocilo \(0\)/)
    expect(() => buildDobicikonostPdfDoc([{ ...RACUNI[0], znesek: -1 }], NAROCILA, { now: NOW })).toThrow(/znesek/)
    expect(() => buildDobicikonostPdfDoc([{ ...RACUNI[0], stevilka: '  ' }], NAROCILA, { now: NOW })).toThrow(/stevilka/)
    expect(() => preveriDobicikonostRacun({ ...RACUNI[0], projekt: '' }, 3)).toThrow(/preveriDobicikonostRacun \(3\)/)
    expect(() => preveriDobicikonostNarocilo({ ...NAROCILA[0], skupajCena: Number.NaN }, 2)).toThrow(/preveriDobicikonostNarocilo \(2\)/)
  })

  it('EN VIR import dokazi: STATUSI iz prihodki-pdf (R250) + STATUSI_NAROCIL iz narocila-pregled-pdf (R257) — nič dvojnih seznamov', () => {
    expect(lib).toContain("import { STATUSI as STATUSI_RACUNOV } from './prihodki-pdf'")
    expect(lib).toContain("import { STATUSI_NAROCIL } from './narocila-pregled-pdf'")
    expect(lib).not.toContain("'OSNUTEK', 'IZDAN', 'PLACAN', 'STORNIRAN'") // re-use, nič dvojnega
    expect(lib).not.toContain("'OSNUTEK', 'POSLANO', 'POTRJENO', 'DOBLJENO', 'PREKlicANO'")
  })
})

describe('R258 — WYSIWYG vir (tabela + KPI + sklep)', () => {
  it('tabela 7 stolpcev (Projekt, Prihodki, Stroški, Marža, Marža (%), Računov, Naročil) — head dobesedno', () => {
    expect(lib).toContain("['Projekt', 'Prihodki (EUR)', 'Stroški (EUR)', 'Marža (EUR)', 'Marža (%)', 'Računov', 'Naročil']")
  })

  it('marža barvna resnica: negativna RDEČA bold (NIKOLI utišana), pozitivna ZELENA bold, \'—\' % sivo', () => {
    expect(oknoMed(lib, "data.column.index === 3", 'data.column.index === 4')).toContain('RED')
    expect(oknoMed(lib, "data.column.index === 3", 'data.column.index === 4')).toContain('GREEN')
    expect(oknoMed(lib, "data.column.index === 4 && data.cell.raw === '—'", 'return doc')).toContain('GRAY')
  })

  it('KPI 5 boxov z signalnim jezikom (prihodki zeleno, stroški amber, marža po predznaku, negativnih rdeče)', () => {
    const kpiOkno = oknoMed(lib, "kpiBox(doc, 14, y, bw, bh, 'Projektov'", "y += bh + 8")
    expect(kpiOkno).toContain("'Prihodki'")
    expect(kpiOkno).toContain('povzetek.prihodki > 0 ? GREEN : NAVY')
    expect(kpiOkno).toContain('povzetek.stroski > 0 ? AMBER : NAVY')
    expect(kpiOkno).toContain('povzetek.marza > 0 ? GREEN : povzetek.marza < 0 ? RED : NAVY')
    expect(kpiOkno).toContain('povzetek.negativnih > 0 ? RED : NAVY')
  })

  it('sklep: izključitve poimenovane (stornirani/osnutki iz prihodkov; brez projekta iz preseka) — iskren podpis', () => {
    const sklep = oknoMed(lib, 'sklepna vrstica', 'noge na vseh straneh')
    expect(sklep).toContain('projektov · prihodki')
    expect(sklep).toContain('(izključeni iz prihodkov)')
    expect(sklep).toContain('izključeni iz preseka)')
    expect(sklep).toContain('negativnih marž')
  })

  it('glava DOBIČKONOST PO PROJEKTIH + osveženo + noge Stran i/N', () => {
    expect(lib).toContain("'DOBIČKONOST PO PROJEKTIH'")
    expect(lib).toContain('osveženo ${zalogaPovzetekCasOznaka(now)}')
    expect(lib).toContain('Stran ${i}/${strani}')
  })

  it('brez locale-odvisnih APIjev (determinizem čez pasove/stroje)', () => {
    expect(lib).not.toContain('toLocaleDateString')
    expect(lib).not.toContain('toLocaleString')
    expect(lib).not.toContain('localeCompare')
  })
})

describe('R258 — komponenta (vodja-dashboard) — pill, legenda, handler, state', () => {
  it('pill VEDNO viden (bralni dokument, P1-k precedens) + press-scale + FileText aria-hidden + disabled števec', () => {
    expect(komponenta).toContain('aria-label="Izvozi dobičkonosnost projektov kot PDF"')
    const pill = oknoMed(komponenta, 'aria-label="Izvozi dobičkonosnost projektov kot PDF"', '</Button>')
    expect(pill).toContain('aria-hidden="true"')
    // className (press-scale) + disabled sta PRED aria-label v JSX vrstnem redu
    const pred = oknoMed(komponenta, 'R258 — DOBIČKONOST PO PROJEKTIH PDF (14. člen', 'onClick={handleDobicikonostPdf}')
    expect(pred).toContain('press-scale')
    expect(oknoMed(komponenta, 'onClick={handleDobicikonostPdf}', 'aria-label="Izvozi dobičkonosnost projektov kot PDF"')).toContain('disabled={loading || dobicikonostVTeku}')
  })

  it('legenda dobičkonostne resnice dobesedno (želona pariteta — vsaka izpeljava pove svojo definicijo)', () => {
    expect(komponenta).toContain('Prihodki = izdani + plačani računi · Stroški = ne-preklicana naročila · Marža = prihodki − stroški · Marža (%) = marža / prihodki · Brez projekta = izključeni iz preseka')
  })

  it('handler: EN now, ISTA izpeljava dobicikonostPoProjektih za toast, fail-closed toast pri praznem preseku, TypeError vidni razlog, dvoklik guard', () => {
    const handler = oknoMed(komponenta, 'const handleDobicikonostPdf', 'useEffect(() => { loadData() }')
    expect(handler).toContain('const now = new Date()')
    expect(handler).toContain('dobicikonostPoProjektih(racuni, allOrders)')
    expect(handler).toContain("title: 'Dobičkonost prenešena v PDF'")
    expect(handler).toContain("${povzetek.projektov} projektov, prihodki ${povzetek.prihodki.toFixed(2)} €")
    expect(handler).toContain("title: 'Ni podatkov za dobičkonost'")
    expect(handler).toContain('Dobičkonost PDF ni mogoče sestaviti iz teh podatkov')
    expect(handler).toContain('if (dobicikonostVTeku || loading) return')
    expect(handler).toContain('setDobicikonostVTeku(false)')
  })

  it('allOrders state: minimalni prerez ISTEGA fetcha (route NIČ) + clearOnFail počisti (fail-closed družina R163)', () => {
    expect(komponenta).toContain('const [allOrders, setAllOrders] = useState<DobicikonostNarocilo[]>([])')
    expect(komponenta).toContain('projekt: o.project?.nazivProjekta ?? null')
    expect(komponenta).toContain('setAllOrders([])')
    // vodja ŽE fetcha oba vira (presek brez nove mreže)
    expect(komponenta).toContain("fetch('/api/material-orders', { credentials: 'same-origin' })")
    expect(komponenta).toContain("fetch('/api/invoices', { credentials: 'same-origin' })")
  })
})

describe('R258 — bratje čisti (ločeni dokumenti, nič dvojnega)', () => {
  it('prihodki/narocila liba NE vsebujeta dobičkonost resnic; izvozne množice so EXPORTIRANE iz primarnih virov', () => {
    expect(prihodkiLib).not.toContain('Dobicikonost')
    expect(narocilaLib).not.toContain('Dobicikonost')
    // R258 izvoz = EN VIR (družina se širi brez duplikacije)
    expect(prihodkiLib).toContain('export const STATUSI')
    expect(narocilaLib).toContain('export const STATUSI_NAROCIL')
    // dobičkonost lib NE redefinira sklona besede 'naročilo'/'dobavitelj'
    expect(lib).not.toContain('function narociloBeseda')
    expect(lib).not.toContain('function dobaviteljBeseda')
  })
})
