// ---------------------------------------------------------------------------
// R270 — INVENTURA — PREMOŽENJSKI PREGLED PDF (26. člen 'izvozi' družine,
// P1-f) — testi. Bajtni dokazi (determinizem: enak vhod = bajtno enak PDF;
// PREMEŠAN VRSTNI RED = bajtno ENAK — akcijski sort interno + kanon seed po
// id, f(množica); %PDF- magija; NOV glifni razred — R249 doktrina; brat R269
// bajtno zdrav) + ENA resnica (KPI + tabela + sklep + toast + mini-vrstica
// iz ENE izpeljave inventuraPregled; STATUSI EN VIR inventurniStatusOf —
// ISTA predikatna meja kot R219 čipa ≤/===; FORMAT EN VIR kolicinaNiz
// IMPORT iz zaloga-osnutek R262 — NI zasegane kopije; OBRAT = _count.
// movements — vsi zabeleženi premiki; POD MINIMUMOM = akcija RED, NA MEJI =
// pozornost AMBER, ZADOSTNO = zdrava GREEN) + fail-closed (podvojen id ALI
// šifra — @unique resnica, ne-prazni nizi, končno ne-negativne količine,
// premiki ne-negativno celo, prazen seznam) + vsebinski dokazi na VIRU liba
// in komponente (pill VEDNO viden, FRESH fetch /api/inventory — polna
// resnica skladišča ob kliku, mini-vrstica state-oka z R227 strogostjo,
// legenda pariteta, 0 novih hex).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildInventuraPregledPdfDoc,
  inventuraPregledPdfFilename,
  inventuraPregled,
  inventurniStatusOf,
  artikelBeseda,
  preveriInventuraArtikel,
  sortirajInventura,
  type InventuraArtikel,
} from '@/lib/inventura-pregled-pdf'
import { kolicinaNiz } from '@/lib/zaloga-osnutek-pdf'
import {
  buildMeritveTerenPdfDoc,
  type MeritveTerenVnos,
} from '@/lib/meritve-teren-pdf'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

// okno med markerjema (r207/…/r257/…/r269 vzorec)
function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  const b = src.indexOf(do_, a)
  if (a === -1 || b === -1) return ''
  return src.slice(a, b)
}

const lib = beri('src/lib/inventura-pregled-pdf.ts')
const komponenta = beri('src/components/roksal/inventory-tab.tsx')

// FIXED now (determinizem — žig + CreationDate + fileId + ime).
const NOW: Date = new Date('2026-09-29T08:00:00.000Z')

// Osnovni artikel + nadgradbe.
function art(over: Partial<InventuraArtikel> & Pick<InventuraArtikel, 'id' | 'sifraMateriala'>): InventuraArtikel {
  return {
    naziv: `Artikel ${over.sifraMateriala ?? over.id}`,
    tip: 'WPC',
    enota: 'kos',
    kolicinaZaloga: 10,
    minimalnaZaloga: 5,
    premiki: 0,
    ...over,
  }
}

// 8 artiklov — VSE veje: POD MINIMUMOM ×3 (w2 na NIČ — manjka 5; w1 necela
// zaloga 4.5 — manjka 5.5, kolicinaNiz resnica; k1 največji manjka 6),
// NA MEJI ×2 (i2 točno ===; x1 NEZNAN tip — verbatim fallback), ZADOSTNO ×3
// (a1 i1 IZENAČBA obrata 7 → največji obrat = prvi v sortiranem redu; w3
// necela zaloga 10.25).
const ARTIKLI: InventuraArtikel[] = [
  art({ id: 'w1', sifraMateriala: 'WPC-120-A', naziv: 'WPC deska 120', tip: 'WPC', enota: 'm', kolicinaZaloga: 4.5, minimalnaZaloga: 10, premiki: 2 }),
  art({ id: 'w2', sifraMateriala: 'WPC-090-B', naziv: 'WPC deska 90', kolicinaZaloga: 0, minimalnaZaloga: 5 }),
  art({ id: 'i1', sifraMateriala: 'INOX-A2-040', naziv: 'Inox vijak A2 4×40', tip: 'Inox', kolicinaZaloga: 250, minimalnaZaloga: 100, premiki: 7 }),
  art({ id: 'i2', sifraMateriala: 'INOX-A2-060', naziv: 'Inox vijak A2 6×60', tip: 'Inox', kolicinaZaloga: 100, minimalnaZaloga: 100, premiki: 3 }),
  art({ id: 'k1', sifraMateriala: 'KEM-5L', naziv: 'Kemično sidro 5 L', tip: 'Kemično', kolicinaZaloga: 2, minimalnaZaloga: 8 }),
  art({ id: 'a1', sifraMateriala: 'ALU-025-2M', naziv: 'Alu profil 25×2 m', tip: 'Aluminij', kolicinaZaloga: 12, minimalnaZaloga: 4, premiki: 7 }),
  art({ id: 'w3', sifraMateriala: 'WPC-150-T', naziv: 'WPC deska 150 terasa', enota: 'm', kolicinaZaloga: 10.25, minimalnaZaloga: 6, premiki: 1 }),
  art({ id: 'x1', sifraMateriala: 'PRS-001', naziv: 'Posebni pritrdilni komplet', tip: 'Nadomestni tip 47', kolicinaZaloga: 3, minimalnaZaloga: 3 }),
]

function zgradi(vhodi: readonly InventuraArtikel[] = ARTIKLI, now: Date = NOW): Buffer {
  const doc = buildInventuraPregledPdfDoc(vhodi, { now })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R270 — PDF bajtni dokazi (determinizem + glifni razred — R249 doktrina)', () => {
  it('determinizem: enak vhod = bajtno enak; PREMEŠAN VRSTNI RED = bajtno ENAK (akcijski sort interno + kanon seed po id, f(množica)); drug now = drugačen', () => {
    expect(zgradi().equals(zgradi())).toBe(true)
    const preskakljani = zgradi([ARTIKLI[5], ARTIKLI[2], ARTIKLI[7], ARTIKLI[0], ARTIKLI[4], ARTIKLI[1], ARTIKLI[6], ARTIKLI[3]])
    expect(preskakljani.equals(zgradi())).toBe(true)
    expect(zgradi(ARTIKLI, new Date('2026-09-29T08:01:00.000Z')).equals(zgradi())).toBe(false)
  })

  it('%PDF- magija + NOV glifni razred (≠ vseh 35 znanih družinskih razredov IN ≠ brat R269 z njegovim fixturejem) + ime Inventura-pregled-YYYY-MM-DD.pdf', () => {
    const bin = zgradi()
    expect(bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    const znani = [30057, 30119, 30191, 30253, 35565, 38753, 39927, 41519, 42798, 37709, 37771, 36788, 36656, 36532, 33958, 36555, 38631, 45508, 44828, 36260, 36583, 45127, 38565, 38909, 40261, 35409, 37228, 39094, 41009, 37560, 38744, 43572, 51142, 45074, 42769]
    expect(znani).not.toContain(bin.length)
    // Brat R269 z ISTIMI vhodi kot njegov test — drug dokument = druga dolžina.
    const meritve: MeritveTerenVnos[] = [
      { id: 'p1', createdAt: '2026-09-20T08:00:00.000Z', dolzinaMm: 1000, visinaMm: 1100, oznaka: 'Balkon — sever', status: 'POTRJENA', lokacija: 'Balkon' },
      { id: 'a1', createdAt: '2026-09-22T09:00:00.000Z', dolzinaMm: 800, visinaMm: 1400 },
    ]
    const r269Bin = Buffer.from(buildMeritveTerenPdfDoc(meritve, { now: NOW }).output('arraybuffer'))
    expect(r269Bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(bin.length).not.toBe(r269Bin.length)
    expect(inventuraPregledPdfFilename(NOW)).toBe('Inventura-pregled-2026-09-29.pdf')
    expect(() => inventuraPregledPdfFilename('danes' as unknown as Date)).toThrow(TypeError)
  })

  it('soli 0xa5–0xa8 — UNIKATNE v družini (register: meritve-teren 0xa1–0xa4, ekipa-stanje 0x9d–0xa0, ponudbe 0x99–0x9c, oprema 0x95–0x98, projekti 0x91–0x94, stranke 0x89–0x8c — bratje NE delijo semen)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0xa5)')
    expect(lib).toContain('fnv1aHex(seed, 0xa8)')
    expect(lib).not.toContain('fnv1aHex(seed, 0xa1)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x9d)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x99)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x95)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x91)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x8d)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x89)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x85)')
  })

  it('FORMAT EN VIR kolicinaNiz — IMPORT iz zaloga-osnutek R262 (NI zasegane kopije; necela količina 2 dec, cela brez dec — brez locale)', () => {
    expect(lib).toContain("import { kolicinaNiz } from './zaloga-osnutek-pdf'")
    expect(lib).not.toContain('function kolicinaNiz')
    expect(kolicinaNiz(4.5)).toBe('4.50')
    expect(kolicinaNiz(10.25)).toBe('10.25')
    expect(kolicinaNiz(6)).toBe('6')
    expect(kolicinaNiz(0)).toBe('0')
    expect(kolicinaNiz(250)).toBe('250')
  })
})

describe('R270 — ENA resnica (KPI + tabela + sklep + toast iz ENE izpeljave)', () => {
  it('povzetek: 8 artiklov, pod minimumom 3, na meji 2, zadostno 3, tipov 5, premikov 20; največji manjka KEM-5L 6 kos; največji obrat IZENAČBA a1/i1 → prvi v sortiranem redu (ALU-025-2M)', () => {
    const { povzetek } = inventuraPregled(ARTIKLI)
    expect(povzetek.artiklov).toBe(8)
    expect(povzetek.podMinimumom).toBe(3)
    expect(povzetek.naMeji).toBe(2)
    expect(povzetek.zadostno).toBe(3)
    expect(povzetek.tipov).toBe(5)
    expect(povzetek.premikiSkupaj).toBe(20)
    expect(povzetek.najvecjiManjka).toEqual({ sifra: 'KEM-5L', naziv: 'Kemično sidro 5 L', enota: 'kos', vrednost: 6 })
    // Izenačba obrata 7 (a1 v ZADOSTNO cone pred i1 po šifri) → a1 zmaga.
    expect(povzetek.najvecjiObrat).toEqual({ sifra: 'ALU-025-2M', naziv: 'Alu profil 25×2 m', premiki: 7 })
  })

  it('sort: akcijski red (POD MINIMUMOM → NA MEJI → ZADOSTNO) + šifra ASC znotraj cone (računovodski red — R262 pariteta) + id tiebreak; manjka izpeljan (necel 5.50)', () => {
    const { vrste } = inventuraPregled(ARTIKLI)
    expect(vrste.map((v) => v.sifra)).toEqual(['KEM-5L', 'WPC-090-B', 'WPC-120-A', 'INOX-A2-060', 'PRS-001', 'ALU-025-2M', 'INOX-A2-040', 'WPC-150-T'])
    expect(vrste[0].status).toBe('POD MINIMUMOM')
    expect(vrste[0].manjka).toBe(6)
    expect(vrste[2].manjka).toBe(5.5) // necela količina — kolicinaNiz resnica
    expect(vrste[3].status).toBe('NA MEJI')
    expect(vrste[3].manjka).toBe(0)
    expect(vrste[5].status).toBe('ZADOSTNO')
    expect(vrste[5].manjka).toBe(0)
    // sortirajInventura = ISTA funkcija (IN-PLACE sort — f(množica)).
    const kopija = [...vrste].reverse()
    sortirajInventura(kopija)
    expect(kopija.map((v) => v.sifra)).toEqual(vrste.map((v) => v.sifra))
  })

  it('inventurniStatusOf — ISTA predikatna meja kot R219 čipa (≤ / ===): (0,0) → NA MEJI (robni primer — dokumentiran), (3,5) POD, (5,5) MEJI, (6,5) ZADOSTNO; fail-closed NaN/negativno', () => {
    expect(inventurniStatusOf(0, 0)).toBe('NA MEJI')
    expect(inventurniStatusOf(3, 5)).toBe('POD MINIMUMOM')
    expect(inventurniStatusOf(5, 5)).toBe('NA MEJI')
    expect(inventurniStatusOf(6, 5)).toBe('ZADOSTNO')
    expect(inventurniStatusOf(0, 5)).toBe('POD MINIMUMOM')
    expect(inventurniStatusOf(5, 0)).toBe('ZADOSTNO')
    expect(() => inventurniStatusOf(Number.NaN, 5)).toThrow(TypeError)
    expect(() => inventurniStatusOf(5, Number.POSITIVE_INFINITY)).toThrow(TypeError)
    expect(() => inventurniStatusOf(-1, 5)).toThrow(TypeError)
    expect(() => inventurniStatusOf(5, -0.5)).toThrow(TypeError)
    // predikata v libu — R219 pariteta (≤ in ===, NIKOLI druga meja)
    expect(lib).toContain("if (kolicinaZaloga < minimalnaZaloga) return 'POD MINIMUMOM'")
    expect(lib).toContain("if (kolicinaZaloga === minimalnaZaloga) return 'NA MEJI'")
  })

  it('tabela: WYSIWYG didParseCell (POD MINIMUMOM RED bold — akcija; NA MEJI AMBER bold; ZADOSTNO GREEN; manjka 0 = \'—\' sivo — brez izmišljenih ničel) + glava 8 stolpcev', () => {
    const autoTable = oknoMed(lib, 'autoTable(doc, {', 'didParseCell')
    expect(autoTable).toContain("head: [['Šifra', 'Naziv', 'Tip', 'Zaloga', 'Enota', 'Minimum', 'Manjka', 'Status']]")
    const wysiwyg = oknoMed(lib, 'didParseCell', '})')
    expect(wysiwyg).toContain("v.status === 'POD MINIMUMOM'")
    expect(wysiwyg).toContain('data.cell.styles.textColor = RED')
    expect(wysiwyg).toContain("v.status === 'NA MEJI'")
    expect(wysiwyg).toContain('data.cell.styles.textColor = AMBER')
    expect(wysiwyg).toContain("v.status === 'ZADOSTNO'")
    expect(wysiwyg).toContain('data.cell.styles.textColor = GREEN')
    expect(wysiwyg).toContain("raw === '—'")
    expect(wysiwyg).toContain('data.cell.styles.textColor = GRAY')
    // '—' na listu za manjka 0 (iskren odpad — brez izmišljenih ničel)
    expect(lib).toContain("v.manjka > 0 ? kolicinaNiz(v.manjka) : '—'")
  })

  it('sklep: cone + akcije poimenovane + nizka (≤ minimum — čip zaloge) + premikov z največjim obratom poimenovanim + referenčni pregled + vir resnica (lib template — RESOLVED prek artikelBeseda)', () => {
    const { povzetek } = inventuraPregled(ARTIKLI)
    // lib template literal (EN VIR sklepa) — resolved vrednosti prek izpeljave
    // (gnezdeni narekovaji → razdeljeno na tri okna):
    expect(lib).toContain('${artikelBeseda(povzetek.artiklov)} · pod minimumom ${povzetek.podMinimumom} (akcija — naroči pred naslednjo porabo) · na meji ${povzetek.naMeji} (točno na meji — naslednja poraba pusti pod) · zadostno ${povzetek.zadostno} (zdrava zaloga) · nizka zaloga (≤ minimum — čip zaloge) ${povzetek.podMinimumom + povzetek.naMeji} · tipov ${povzetek.tipov} · premikov ${povzetek.premikiSkupaj} (vsi zabeleženi premiki — obrat skozi skladišče${povzetek.najvecjiObrat ?')
    expect(lib).toContain('; največji obrat: ${povzetek.najvecjiObrat.sifra} (${povzetek.najvecjiObrat.naziv}) z ${povzetek.najvecjiObrat.premiki} premiki')
    expect(lib).toContain(" — iskreno nič'}) · manjka izražen samo pri POD MINIMUMOM (drugi '—' — brez izmišljenih ničel) · (referenčni pregled — VSA zalogovna premoženja, tudi artikli brez premikov) · vir = /api/inventory (resnica zaloge — FRESH ob kliku, ne viden seznam filtrov).`")
    // resolved resnica čez izpeljavo (ISTE vrednosti kot KPI IN toast):
    expect(povzetek.podMinimumom + povzetek.naMeji).toBe(5)
    expect(povzetek.najvecjiObrat?.sifra).toBe('ALU-025-2M')
    expect(povzetek.najvecjiObrat?.premiki).toBe(7)
  })

  it('KPI 5: Artiklov/Pod minimumom/Na meji/Tipov/Največji manjka — RED samo kadar > 0 (akcija), AMBER samo kadar > 0, največji manjka = kolicinaNiz + enota', () => {
    const kpi = oknoMed(lib, 'Povzetek premoženja', 'y += bh + 8')
    expect(kpi).toContain("kpiBox(doc, 14, y, bw, bh, 'Artiklov', String(povzetek.artiklov), NAVY)")
    expect(kpi).toContain("povzetek.podMinimumom > 0 ? RED : GREEN")
    expect(kpi).toContain("povzetek.naMeji > 0 ? AMBER : GREEN")
    expect(kpi).toContain("'Največji manjka'")
    expect(kpi).toContain('kolicinaNiz(povzetek.najvecjiManjka.vrednost)')
    expect(kpi).toContain('povzetek.najvecjiManjka ? RED : GREEN')
    // KPI 5 boxev × 33 + 4 gap × 4 = 181 (14 → 195 — ISTI vzorec kot R269)
    expect(kpi).toContain('const bw = 33')
  })
})

describe('R270 — fail-closed (pokvaren vir → TypeError z indeksom krivca)', () => {
  it('prazen seznam ne nastaja dokumenta (lib IN build) — iskren toast v komponenti, NI prazne datoteke', () => {
    expect(() => inventuraPregled([])).toThrow(TypeError)
    expect(() => inventuraPregled([])).toThrow(/prazen seznam artiklov ne nastaja dokumenta/)
    expect(() => buildInventuraPregledPdfDoc([], { now: NOW })).toThrow(TypeError)
    expect(() => buildInventuraPregledPdfDoc([], { now: NOW })).toThrow(/Ni vpisanih artiklov/)
  })

  it('podvojen id = pokvaren vir (identiteta mora biti edinstvena)', () => {
    const d = ARTIKLI.map((a) => ({ ...a }))
    d[1] = { ...d[1], id: d[0].id }
    expect(() => inventuraPregled(d)).toThrow(TypeError)
    expect(() => inventuraPregled(d)).toThrow(/podvojen id artikla/)
  })

  it('podvojena šifra = pokvaren vir (šifra je @unique v shemi — NIKOLI tiho združevanje)', () => {
    const d = ARTIKLI.map((a) => ({ ...a }))
    d[3] = { ...d[3], sifraMateriala: d[2].sifraMateriala }
    expect(() => inventuraPregled(d)).toThrow(TypeError)
    expect(() => inventuraPregled(d)).toThrow(/podvojena šifra materiala/)
  })

  it('ne-prazni nizi (id/sifra/naziv/tip/enota) → TypeError z indeksom krivca; preveriInventuraArtikel nosi indeks', () => {
    expect(() => inventuraPregled([art({ id: 'x', sifraMateriala: 'S-1', naziv: '' })])).toThrow(TypeError)
    expect(() => inventuraPregled([art({ id: 'x', sifraMateriala: '   ' })])).toThrow(/0\): sifraMateriala mora biti ne-prazen niz/)
    expect(() => inventuraPregled([art({ id: 'x', sifraMateriala: 'S-1', tip: '' })])).toThrow(/tip mora biti ne-prazen niz/)
    expect(() => inventuraPregled([art({ id: 'x', sifraMateriala: 'S-1', enota: '' })])).toThrow(/enota mora biti ne-prazen niz/)
    expect(() => preveriInventuraArtikel(null as unknown as InventuraArtikel, 3)).toThrow(/preveriInventuraArtikel \(3\)/)
    expect(() => preveriInventuraArtikel([] as unknown as InventuraArtikel, 2)).toThrow(TypeError)
  })

  it('premiki: ne-negativno CELO število (necel 2.5 / negativen −1 / undefined = pokvaren vir — R227 strogost, NIKOLI tiho 0)', () => {
    expect(() => inventuraPregled([art({ id: 'x', sifraMateriala: 'S-1', premiki: 2.5 })])).toThrow(/premiki morajo biti ne-negativno celo število/)
    expect(() => inventuraPregled([art({ id: 'x', sifraMateriala: 'S-1', premiki: -1 })])).toThrow(TypeError)
    const manjka = art({ id: 'x', sifraMateriala: 'S-1' }) as unknown as Record<string, unknown>
    delete manjka.premiki
    expect(() => inventuraPregled([manjka as unknown as InventuraArtikel])).toThrow(TypeError)
    // komponenta: FRESH handler fail-verbose (cnt strict — brez ?? 0)
    expect(komponenta).toContain("!Number.isInteger(cnt.movements)")
  })

  it('količine: končno ne-negativno število (NaN/Infinity/negativno — kolicinaZaloga IN minimalnaZaloga)', () => {
    expect(() => inventuraPregled([art({ id: 'x', sifraMateriala: 'S-1', kolicinaZaloga: Number.NaN })])).toThrow(/kolicinaZaloga mora biti končno ne-negativno/)
    expect(() => inventuraPregled([art({ id: 'x', sifraMateriala: 'S-1', kolicinaZaloga: Number.POSITIVE_INFINITY })])).toThrow(TypeError)
    expect(() => inventuraPregled([art({ id: 'x', sifraMateriala: 'S-1', kolicinaZaloga: -0.1 })])).toThrow(TypeError)
    expect(() => inventuraPregled([art({ id: 'x', sifraMateriala: 'S-1', minimalnaZaloga: -5 })])).toThrow(/minimalnaZaloga mora biti končno ne-negativno/)
    // build validira opcije (now)
    expect(() => buildInventuraPregledPdfDoc(ARTIKLI, { now: 'danes' as unknown as Date })).toThrow(TypeError)
    expect(() => buildInventuraPregledPdfDoc(ARTIKLI, null as unknown as { now: Date })).toThrow(TypeError)
  })
})

describe('R270 — sklanjatev + filename (iskrene oznake — pariteta clanBeseda/kosBeseda/osnutekBeseda)', () => {
  it('artikelBeseda: 0/1/2/3/4/5/11/21/22/101/111 — dvojinski razred (101 = sto EN artikel — R168 kanon)', () => {
    expect(artikelBeseda(0)).toBe('0 artiklov')
    expect(artikelBeseda(1)).toBe('1 artikel')
    expect(artikelBeseda(2)).toBe('2 artikla')
    expect(artikelBeseda(3)).toBe('3 artikli')
    expect(artikelBeseda(4)).toBe('4 artikli')
    expect(artikelBeseda(5)).toBe('5 artiklov')
    expect(artikelBeseda(11)).toBe('11 artiklov')
    expect(artikelBeseda(21)).toBe('21 artikel')
    expect(artikelBeseda(22)).toBe('22 artikla')
    expect(artikelBeseda(101)).toBe('101 artikel')
    expect(artikelBeseda(111)).toBe('111 artiklov')
    expect(() => artikelBeseda(-1)).toThrow(TypeError)
    expect(() => artikelBeseda(1.5)).toThrow(TypeError)
  })

  it('neznana vrsta = VERBATIM (iskren fallback — NI izmišljenega preslikavanja v libu; preslikava je komponentna resnica typeLabels R136/R234)', () => {
    const { vrste } = inventuraPregled(ARTIKLI)
    const x1 = vrste.find((v) => v.sifra === 'PRS-001')
    expect(x1?.tip).toBe('Nadomestni tip 47')
    // lib NE vsebuje preslikave tipov (tip pride kot label iz komponente — EN VIR R136/R234)
    expect(lib).not.toContain('WPC_deska')
    expect(lib).not.toContain('Kemično_sidro')
    // inventuraPregled z ne-poljem → TypeError
    expect(() => inventuraPregled('zaloga' as unknown as InventuraArtikel[])).toThrow(/pričakovano polje artiklov/)
    expect(() => inventuraPregled(null as unknown as InventuraArtikel[])).toThrow(TypeError)
  })

  it('družinska anatomija: ROKSAL glava + naslov podjetja + noge (Stran i/N + Generirano) + determinizem vira (setCreationDate + setFileId) + varovala preloma strani', () => {
    expect(lib).toContain("doc.text('ROKSAL', 14, 12)")
    expect(lib).toContain("'Roksal d.o.o. — ograje in balustrade'")
    expect(lib).toContain("'Cesta Republike 14, 4000 Kranj'")
    expect(lib).toContain('Stran ${i}/${strani}')
    expect(lib).toContain('Generirano ${zalogaPovzetekCasOznaka(now)}')
    expect(lib).toContain('doc.setCreationDate(now)')
    expect(lib).toContain('doc.setFileId(')
    expect(lib).toContain('if (y > 255) {')
    expect(lib).toContain('doc.addPage()')
    // oznaka cone akcije v naslovu sekcije (akcijska cona = tabela artiklov)
    expect(lib).toContain('`Artikli (${vrste.length})`')
  })
})

describe('R270 — vsebinski dokazi na komponenti (inventory-tab.tsx)', () => {
  it('pill ŽIVO: aria + press-scale + disabled={invPdfVteku} + guard + Loader2/FileDown aria-hidden + VEDNO viden (NI gated na filtered.length)', () => {
    expect(komponenta).toContain('aria-label="Izvozi inventurni pregled premoženja kot PDF"')
    const pill = oknoMed(komponenta, '{/* R270 — inventurni pregled PDF (26. člen', '</Button>')
    expect(pill).toContain('onClick={() => void handleInventuraPdf()}')
    expect(pill).toContain('disabled={invPdfVteku}')
    expect(pill).toContain('press-scale')
    expect(pill).toContain('<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />')
    expect(pill).toContain('<FileDown className="h-3.5 w-3.5" aria-hidden="true" />')
    expect(pill).toContain('Inventura')
    // handler guard (dvoklik)
    expect(komponenta).toContain('if (invPdfVteku) return')
  })

  it('FRESH fetch /api/inventory ob kliku (polna resnica skladišča — R234 je namenoma viden seznam) + fail-verbose DTO pruning (GET HTTP razlog, Array.isArray, _count.movements strict)', () => {
    const handler = oknoMed(komponenta, 'const handleInventuraPdf = async () => {', '  // R219 (P1-f) — dvostopenjsko filtriranje')
    expect(handler).toContain("fetch('/api/inventory', { credentials: 'same-origin' })")
    expect(handler).toContain('GET /api/inventory → HTTP ${res.status}')
    expect(handler).toContain("throw new TypeError('Odgovora /api/inventory ni mogoče prebrati (ni polja).')")
    expect(handler).toContain("!cnt || typeof cnt.movements !== 'number' || !Number.isInteger(cnt.movements) || cnt.movements < 0")
    expect(handler).toContain('premiki (_count.movements) morajo biti ne-negativno celo število')
    // ISTA preslikava tipa kot CSV R136 / PDF R234 (WYSIWYG — tip label)
    expect(handler).toContain('typeLabels[item.tip as string] || (item.tip as string)')
  })

  it('fail-closed toast (Ni vpisanih artiklov + iskren opis) + fail-verbose (Izvoz ni uspel) + ENA izpeljava (inventuraPregled(vnosi) pred generate + agregat toast)', () => {
    const handler = oknoMed(komponenta, 'const handleInventuraPdf = async () => {', '  // R219 (P1-f) — dvostopenjsko filtriranje')
    expect(handler).toContain("toast.error('Ni vpisanih artiklov', {")
    expect(handler).toContain('Inventurni pregled se izvozi, ko je vpisan prvi artikel zaloge.')
    expect(handler).toContain("toast.error('Izvoz ni uspel', {")
    expect(handler).toContain('const { povzetek } = inventuraPregled(vnosi)')
    expect(handler).toContain('generateInventuraPregledPdf(vnosi, { now: new Date() })')
    expect(handler).toContain('Inventura-pregled-…pdf — ${artikelBeseda(povzetek.artiklov)}, pod minimumom ${povzetek.podMinimumom}, na meji ${povzetek.naMeji}.')
    expect(handler).toContain("toast.success('Inventurni pregled premoženja prenešen v PDF', {")
  })

  it('mini-vrstica: \'Inventura (viden seznam):\' + artikelBeseda + dot RED/AMBER/GREEN + kondicionalna žetona ŽIVO samo kadar > 0 + R227 strogost (pokvaren števec = brez mini)', () => {
    const mini = oknoMed(komponenta, 'inventuraVidenPregled !== null && (', '{/* Inventory List */}')
    expect(mini).toContain('Inventura (viden seznam):')
    expect(mini).toContain('artikelBeseda(inventuraVidenPregled.artiklov)')
    expect(mini).toContain('· pod minimumom {inventuraVidenPregled.podMinimumom} · na meji {inventuraVidenPregled.naMeji} · premiki {inventuraVidenPregled.premikiSkupaj}')
    expect(mini).toContain("'bg-roksal-red'")
    expect(mini).toContain("'bg-roksal-amber'")
    expect(mini).toContain("'bg-roksal-green'")
    expect(mini).toContain('manjka {kolicinaNiz(inventuraVidenPregled.najvecjiManjka.vrednost)} {inventuraVidenPregled.najvecjiManjka.enota}')
    expect(mini).toContain('na meji {inventuraVidenPregled.naMeji}')
    // R227 strogost: manjkajoč/pokvaren števec = brez mini (iskrena praznina)
    const memo = oknoMed(komponenta, 'const inventuraVidenPregled = useMemo(() => {', '}, [filtered])')
    expect(memo).toContain('return null')
    expect(memo).toContain("!Number.isInteger(cnt.movements)")
    expect(memo).toContain('premiki: cnt.movements')
  })

  it('legenda VEDNO vidna + glava INVENTURA — PREMOŽENJSKI PREGLED + 26. člen + 0 novih hex (lib IN komponenta)', () => {
    expect(komponenta).toContain('PDF = VSA zalogovna premoženja (tudi artikli brez premikov — polna resnica, ne samo viden seznam filtrov)')
    expect(komponenta).not.toMatch(/#[0-9a-fA-F]{6}/)
    expect(lib).toContain("'INVENTURA — PREMOŽENJSKI PREGLED'")
    expect(lib).toContain("Roksal Field Manager v2.5")
    expect(lib).toContain('Inventura-pregled-${todayStamp(now)}.pdf')
    expect(lib).not.toMatch(/#[0-9a-fA-F]{6}/)
    // 26. člen družine — dokumentirano v obeh virih
    expect(lib).toContain("26. člen")
    expect(komponenta).toContain('26. člen')
    // R249 doktrina: naslovni needleji v komponenti NE duplicirajo glave (glava = lib resnica)
    expect(komponenta).not.toContain('INVENTURA — PREMOŽENJSKI PREGLED')
  })
})
