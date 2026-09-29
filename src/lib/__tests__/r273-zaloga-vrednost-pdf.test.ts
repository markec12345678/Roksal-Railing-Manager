// ---------------------------------------------------------------------------
// R273 — ZALOGA — PREMOŽENJSKA VREDNOST PDF (29. člen 'izvozi' družine) —
// testi. Vzorec r272-nagibi-teren-pdf / r270-inventura: bajtni dokazi
// (determinizem + glifni razred — R249 doktrina), ENA resnica, fail-closed,
// EN VIR importi + filename, vsebinski dokazi na komponenti.
// SEMANTIČNA ODLOČITEV (R273, zapisana PRED razvojem): trenutna cena = API
// resnica veljavnostDo null; tri iskrene veje (OK / 'pretečena' / '—');
// Σ = Σ nad veja 1 SAMO; akcijske cone vrednost DESC → pretečena → brez cene.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildZalogaVrednostPdfDoc,
  generateZalogaVrednostPdf,
  zalogaVrednostPdfFilename,
  zalogaVrednostPregled,
  preveriVrednostArtikel,
  preveriVrednostBest,
  sortirajZalogaVrednost,
  type ZalogaVrednostArtikel,
  type ZalogaVrednostBest,
} from '@/lib/zaloga-vrednost-pdf'
import { artikelBeseda } from '@/lib/inventura-pregled-pdf'
import { kolicinaNiz } from '@/lib/zaloga-osnutek-pdf'
import {
  buildNagibiTerenPdfDoc,
  type NagibTerenVnos,
} from '@/lib/nagibi-teren-pdf'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

// okno med markerjema (r207/…/r272 vzorec)
function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  const b = src.indexOf(do_, a)
  if (a === -1 || b === -1) return ''
  return src.slice(a, b)
}

const lib = beri('src/lib/zaloga-vrednost-pdf.ts')
const inventuraLib = beri('src/lib/inventura-pregled-pdf.ts')
const osnutekLib = beri('src/lib/zaloga-osnutek-pdf.ts')
const komponenta = beri('src/components/roksal/inventory-tab.tsx')

// FIXED now (determinizem — žig + CreationDate + fileId + ime).
const NOW: Date = new Date('2026-09-29T10:00:00.000Z')

// Osnovni artikel + nadgradbe.
function artikel(
  over: Partial<ZalogaVrednostArtikel> & Pick<ZalogaVrednostArtikel, 'id' | 'sifraMateriala' | 'naziv'>,
): ZalogaVrednostArtikel {
  return {
    kolicinaZaloga: 10,
    enota: 'kos',
    stevecCen: 1,
    ...over,
  }
}

function best(over: Partial<ZalogaVrednostBest> & Pick<ZalogaVrednostBest, 'inventoryId' | 'bestPrice'>): ZalogaVrednostBest {
  return {
    bestSupplier: 'Les Pribor d.o.o.',
    ...over,
  }
}

// 5 artiklov — VSE tri veje: z veljavno ceno (a1/a2/a5), PRETEČENA (a3 —
// stevecCen > 0, brez best vnosa), BREZ CENE (a4 — stevecCen === 0 dobesedno).
const ARTIKLI: ZalogaVrednostArtikel[] = [
  artikel({ id: 'a1', sifraMateriala: 'WPC-120-A', naziv: 'WPC deska 120', kolicinaZaloga: 10, stevecCen: 2 }),
  artikel({ id: 'a2', sifraMateriala: 'WPC-140-B', naziv: 'WPC deska 140', kolicinaZaloga: 4.5 }),
  artikel({ id: 'a3', sifraMateriala: 'INOX-VIJAK-M8', naziv: 'Inox vijak M8', kolicinaZaloga: 200, stevecCen: 3 }),
  artikel({ id: 'a4', sifraMateriala: 'KEM-SIDRO-75', naziv: 'Kemično sidro 75', kolicinaZaloga: 0, stevecCen: 0 }),
  artikel({ id: 'a5', sifraMateriala: 'ALU-PROFIL-2M', naziv: 'Alu profil 2m', kolicinaZaloga: 25 }),
]
const BEST: ZalogaVrednostBest[] = [
  best({ inventoryId: 'a1', bestPrice: 12.5, bestSupplier: 'Grenat d.o.o.' }),
  best({ inventoryId: 'a2', bestPrice: 8.3 }),
  best({ inventoryId: 'a5', bestPrice: 3.1 }),
]

function zgradi(
  artikliVhodi: readonly ZalogaVrednostArtikel[] = ARTIKLI,
  bestVhodi: readonly ZalogaVrednostBest[] = BEST,
  now: Date = NOW,
): Buffer {
  const doc = buildZalogaVrednostPdfDoc(artikliVhodi, bestVhodi, { now })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R273 — PDF bajtni dokazi (determinizem + glifni razred — R249 doktrina)', () => {
  it('determinizem: enak vhod = bajtno enak; PREMEŠAN VRSTNI RED obeh virov = bajtno ENAK (sort interno + kanon seed po id/inventoryId, f(množica)); drug now = drugačen', () => {
    expect(zgradi().equals(zgradi())).toBe(true)
    const preskakljani = zgradi(
      [ARTIKLI[4], ARTIKLI[1], ARTIKLI[0], ARTIKLI[3], ARTIKLI[2]],
      [BEST[2], BEST[0], BEST[1]],
    )
    expect(preskakljani.equals(zgradi())).toBe(true)
    expect(zgradi(ARTIKLI, BEST, new Date('2026-09-29T10:01:00.000Z')).equals(zgradi())).toBe(false)
  })

  it('%PDF- magija + NOV glifni razred (≠ vseh 38 znanih družinskih razredov IN ≠ brat R272 z njegovim fixturejem) + ime Zaloga-vrednost-YYYY-MM-DD.pdf', () => {
    const bin = zgradi()
    expect(bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    const znani = [30057, 30119, 30191, 30253, 35565, 38753, 39927, 41519, 42798, 37709, 37771, 36788, 36656, 36532, 33958, 36555, 38631, 45508, 44828, 36260, 36583, 45127, 38565, 38909, 40261, 35409, 37228, 39094, 41009, 37560, 38744, 43572, 51142, 45074, 42769, 66653, 37934, 40181]
    expect(znani).not.toContain(bin.length)
    // Brat R272 z ISTIMI vhodi kot njegov test — drug dokument = druga dolžina.
    const nagibi: NagibTerenVnos[] = [
      { id: 'n1', createdAt: '2026-09-01T08:30:00.000Z', kotStopinje: 2.35, smer: 'Y', lokacija: 'Talna plošča balkona', veljaven: true },
      { id: 'n2', createdAt: '2026-09-02T09:15:00.000Z', kotStopinje: -1.42, smer: 'X', lokacija: 'Rob balkona', veljaven: true },
      { id: 'n3', createdAt: '2026-09-03T10:00:00.000Z', kotStopinje: 0.5, smer: null, lokacija: null, veljaven: true },
      { id: 'n4', createdAt: '2026-09-04T11:20:00.000Z', kotStopinje: 0.8, smer: 'X', veljaven: false },
      { id: 'n5', createdAt: '2026-09-05T12:45:00.000Z', kotStopinje: 1.1, smer: 'Y', lokacija: 'Stopnišče', veljaven: true },
    ]
    const r272Bin = Buffer.from(buildNagibiTerenPdfDoc(nagibi, { now: NOW }).output('arraybuffer'))
    expect(r272Bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(bin.length).not.toBe(r272Bin.length)
    expect(zalogaVrednostPdfFilename(NOW)).toBe('Zaloga-vrednost-2026-09-29.pdf')
    expect(() => zalogaVrednostPdfFilename('danes' as unknown as Date)).toThrow(TypeError)
  })

  it('soli 0xb1–0xb4 — UNIKATNE v družini (register: nagibi-teren 0xad–0xb0, punch-stanje 0xa9–0xac, inventura 0xa5–0xa8, meritve-teren 0xa1–0xa4, ekipa-stanje 0x9d–0xa0 — bratje NE delijo semen)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0xb1)')
    expect(lib).toContain('fnv1aHex(seed, 0xb4)')
    expect(lib).not.toContain('fnv1aHex(seed, 0xad)')
    expect(lib).not.toContain('fnv1aHex(seed, 0xa9)')
    expect(lib).not.toContain('fnv1aHex(seed, 0xa5)')
    expect(lib).not.toContain('fnv1aHex(seed, 0xa1)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x9d)')
  })

  it('EN VIR — IMPORT artikelBeseda iz inventura-pregled-pdf + kolicinaNiz iz zaloga-osnutek-pdf (R262/R270 precedens — NI zasegane kopije; ISTA funkcija = ISTA sklanjatev/format)', () => {
    expect(lib).toContain("import { artikelBeseda } from './inventura-pregled-pdf'")
    expect(lib).toContain("import { kolicinaNiz } from './zaloga-osnutek-pdf'")
    expect(lib).not.toContain('function artikelBeseda')
    expect(lib).not.toContain('function kolicinaNiz')
    // 1:1 vrednosti (ISTA funkcija)
    expect(artikelBeseda(1)).toBe('1 artikel')
    expect(artikelBeseda(101)).toBe('101 artikel')
    expect(kolicinaNiz(4.5)).toBe('4.50')
    const { vrste } = zalogaVrednostPregled(ARTIKLI, BEST)
    expect(vrste.find((v) => v.id === 'a2')?.zaloga).toBe('4.50')
    // obrambni dokaz: viri NE vsebujeta zasegane kopije sklanjatev logike
    expect(osnutekLib).toContain('export function kolicinaNiz')
    expect(inventuraLib).toContain('export function artikelBeseda')
  })
})

describe('R273 — ENA resnica (KPI + tabela + sklep + toast iz ENE izpeljave)', () => {
  it('povzetek: 5 artiklov, Σ 239.85 EUR (samo veja 1 — z ceno 3), pretečenih 1, brez cene 1, največja 125.00 EUR (WPC deska 120)', () => {
    const { povzetek } = zalogaVrednostPregled(ARTIKLI, BEST)
    expect(povzetek.artiklov).toBe(5)
    expect(povzetek.vsotaEur).toBeCloseTo(239.85, 10)
    expect(povzetek.zCeno).toBe(3)
    expect(povzetek.pretecenih).toBe(1)
    expect(povzetek.brezCene).toBe(1)
    expect(povzetek.najvecjaEur).toBeCloseTo(125, 10)
    expect(povzetek.najvecjaNaziv).toBe('WPC deska 120')
  })

  it('sort: akcijske cone — z vrednostjo vrednost DESC (a1 125 → a5 77.5 → a2 37.35) → pretečena (a3) → brez cene (a4); obrnjen vhod = ISTI red (determinizem = f(množica))', () => {
    const { vrste } = zalogaVrednostPregled(ARTIKLI, BEST)
    expect(vrste.map((v) => v.id)).toEqual(['a1', 'a5', 'a2', 'a3', 'a4'])
    const obrnjene = zalogaVrednostPregled([...ARTIKLI].reverse(), [...BEST].reverse()).vrste
    expect(obrnjene.map((v) => v.id)).toEqual(['a1', 'a5', 'a2', 'a3', 'a4'])
    // sortirajZalogaVrednost je IZVOŽEN
    expect(sortirajZalogaVrednost([...vrste]).map((v) => v.id)).toEqual(['a1', 'a5', 'a2', 'a3', 'a4'])
  })

  it('izenačba vrednosti znotraj cone → naziv ASC → id ASC (identiteta — isto ime = RAZLIČNA resnica)', () => {
    const enaka: ZalogaVrednostArtikel[] = [
      artikel({ id: 'x2', sifraMateriala: 'B-2', naziv: 'Beta profil', kolicinaZaloga: 5 }),
      artikel({ id: 'x1', sifraMateriala: 'A-1', naziv: 'Alfa profil', kolicinaZaloga: 10 }),
      artikel({ id: 'x3', sifraMateriala: 'A-0', naziv: 'Alfa profil', kolicinaZaloga: 25 }),
    ]
    const bestEnaka: ZalogaVrednostBest[] = [
      best({ inventoryId: 'x2', bestPrice: 10 }), // 5 × 10 = 50
      best({ inventoryId: 'x1', bestPrice: 5 }), // 10 × 5 = 50
      best({ inventoryId: 'x3', bestPrice: 2 }), // 25 × 2 = 50
    ]
    const { vrste } = zalogaVrednostPregled(enaka, bestEnaka)
    // vsi 50 → naziv ASC: 'Alfa profil' (x1 pred x3 — id ASC) → 'Beta profil'
    expect(vrste.map((v) => v.id)).toEqual(['x1', 'x3', 'x2'])
  })

  it('tri iskrene veje vrstic: OK (cena + dobavitelj + vrednost toFixed(2)), PRETECENA (vrednostPrikaz \'pretečena\', cena/dobavitelj null), BREZ_CENE (vse null — R227 žig); kolicinaNiz necela 4.5 → \'4.50\'', () => {
    const { vrste } = zalogaVrednostPregled(ARTIKLI, BEST)
    const a1 = vrste.find((v) => v.id === 'a1')
    expect(a1?.stanje).toBe('OK')
    expect(a1?.cena).toBeCloseTo(12.5, 10)
    expect(a1?.dobavitelj).toBe('Grenat d.o.o.')
    expect(a1?.vrednostPrikaz).toBe('125.00')
    const a3 = vrste.find((v) => v.id === 'a3')
    expect(a3?.stanje).toBe('PRETECENA')
    expect(a3?.cena).toBeNull()
    expect(a3?.dobavitelj).toBeNull()
    expect(a3?.vrednost).toBeNull()
    expect(a3?.vrednostPrikaz).toBe('pretečena')
    const a4 = vrste.find((v) => v.id === 'a4')
    expect(a4?.stanje).toBe('BREZ_CENE')
    expect(a4?.vrednostPrikaz).toBeNull()
    expect(a4?.zaloga).toBe('0')
  })

  it('tabela 7 stolpcev (Šifra, Artikel, Zaloga, Enota, Cena (EUR/enota), Dobavitelj, Vrednost (EUR)) — head dobesedno', () => {
    expect(lib).toContain("['Šifra', 'Artikel', 'Zaloga', 'Enota', 'Cena (EUR/enota)', 'Dobavitelj', 'Vrednost (EUR)']")
  })

  it('barvna resnica: PRETECENA = AMBER bold vrstica (akcija re-price — iskren signal); \'—\' = sivo (iskren odpad — stolpci 4/5/6)', () => {
    const okno = oknoMed(lib, 'didParseCell:', '})\n  y =')
    expect(okno).toContain("v.stanje === 'PRETECENA'")
    expect(okno).toContain('textColor = AMBER')
    expect(okno).toContain('textColor = GRAY')
    expect(okno).toContain("fontStyle = 'bold'")
    expect(okno).toContain("raw === '—'")
    expect(okno).toContain('data.column.index === 4 || data.column.index === 5 || data.column.index === 6')
  })

  it('KPI 5 boxov z signalnim jezikom (Artiklov/Σ vrednost/Največja NAVY; Pretečenih + Brez cene AMBER samo > 0, drugače GREEN) + sklep: resnice poimenovane + EN VIR + referenčni pregled + vir', () => {
    expect(lib).toContain("'Artiklov'")
    expect(lib).toContain("'Σ vrednost'")
    expect(lib).toContain("'Največja'")
    expect(lib).toContain("'Pretečenih'")
    expect(lib).toContain("'Brez cene'")
    expect(lib).toContain('povzetek.pretecenih > 0 ? AMBER : GREEN')
    expect(lib).toContain('povzetek.brezCene > 0 ? AMBER : GREEN')
    // sklep — resnice poimenovane
    expect(lib).toContain('(samo artikli z veljavno trenutno ceno — z ceno ${povzetek.zCeno})')
    expect(lib).toContain("'Σ vrednost zaloge — (ni artikla z veljavno trenutno ceno)'")
    expect(lib).toContain('(vse vpisane cene pretečene — vpisati novo veljavno ceno)')
    expect(lib).toContain('(vrednost NI ocenjena — iskrena resnica)')
    expect(lib).toContain('(samo trenutno veljavne cene — API resnica veljavnostDo null; pretečene NISO vključene)')
    expect(lib).toContain('(referenčni pregled — VSA zalogovna premoženja, tudi artikli brez veljavne cene)')
    expect(lib).toContain('vir = /api/inventory + /api/material-prices (resnica zaloge IN cen)')
  })

  it('sklep kondicionalna resnica bajtno: pretečena/brez-cene clause SAMO > 0 (iskrena praznina) — čisti vsi z ceno = drugačen dokument', () => {
    // vsi z veljavno ceno → sklep brez pretečena/brez-cene clause
    const vsiZCeno: ZalogaVrednostArtikel[] = [
      artikel({ id: 'c1', sifraMateriala: 'S-1', naziv: 'Prvi', kolicinaZaloga: 2, stevecCen: 1 }),
      artikel({ id: 'c2', sifraMateriala: 'S-2', naziv: 'Drugi', kolicinaZaloga: 3, stevecCen: 1 }),
    ]
    const bestZCeno: ZalogaVrednostBest[] = [
      best({ inventoryId: 'c1', bestPrice: 4 }),
      best({ inventoryId: 'c2', bestPrice: 6 }),
    ]
    const binCisti = zgradi(vsiZCeno, bestZCeno)
    const binMesano = zgradi(ARTIKLI, BEST)
    expect(binCisti.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(binMesano.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(binCisti.length).not.toBe(binMesano.length)
    // strukturni dokaz v libu: sklepi so KONDICIONALNI (samo > 0 — R256 lekcija 4)
    expect(lib).toContain('const preteceniSklep =')
    expect(lib).toContain('const brezCeneSklep =')
    expect(lib).toContain('povzetek.pretecenih > 0')
    expect(lib).toContain('povzetek.brezCene > 0')
  })

  it('zCeno 0 → Σ KPI \'—\' + največja \'—\' + iskren sklep (NIKOLI lažna 0.00 vrednost) — bajtno drugačen dokument', () => {
    const vsiBrezCene: ZalogaVrednostArtikel[] = [
      artikel({ id: 'd1', sifraMateriala: 'S-1', naziv: 'Prvi', kolicinaZaloga: 2, stevecCen: 0 }),
      artikel({ id: 'd2', sifraMateriala: 'S-2', naziv: 'Drugi', kolicinaZaloga: 3, stevecCen: 0 }),
    ]
    const { povzetek } = zalogaVrednostPregled(vsiBrezCene, [])
    expect(povzetek.zCeno).toBe(0)
    expect(povzetek.vsotaEur).toBe(0)
    expect(povzetek.najvecjaEur).toBeNull()
    expect(povzetek.najvecjaNaziv).toBeNull()
    const binBrez = zgradi(vsiBrezCene, [])
    expect(binBrez.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(binBrez.length).not.toBe(zgradi(ARTIKLI, BEST).length)
    // KPI conditional: Σ '—' pri zCeno 0 (NIKOLI '0.00' lažna vrednost)
    expect(lib).toContain("povzetek.zCeno > 0 ? `${povzetek.vsotaEur.toFixed(2)}` : '—'")
    expect(lib).toContain("povzetek.najvecjaEur !== null ? `${povzetek.najvecjaEur.toFixed(2)}` : '—'")
  })
})

describe('R273 — fail-closed (pokvaren vir → TypeError z indeksom krivca)', () => {
  it('prazen seznam ne nastaja dokumenta (pregled IN build) — iskren toast v komponenti, NI prazne datoteke', () => {
    expect(() => zalogaVrednostPregled([], [])).toThrow(TypeError)
    expect(() => zalogaVrednostPregled([], [])).toThrow(/prazen seznam artiklov/)
    expect(() => buildZalogaVrednostPdfDoc([], [], { now: NOW })).toThrow(TypeError)
    expect(() => buildZalogaVrednostPdfDoc([], [], { now: NOW })).toThrow(/Ni vpisanih artiklov/)
  })

  it('podvojen artikel id + podvojen best inventoryId + ORPHAN best (best brez ujemajočega artikla) = pokvaren vir — NIKOLI tiho združevanje/izmišljena vrstica (R264 precedens)', () => {
    const podvojeniArtikel = [ARTIKLI[0], { ...ARTIKLI[1], id: 'a1' }]
    expect(() => zalogaVrednostPregled(podvojeniArtikel, [])).toThrow(TypeError)
    expect(() => zalogaVrednostPregled(podvojeniArtikel, [])).toThrow(/podvojen id artikla a1/)
    const podvojenBest = [best({ inventoryId: 'a1', bestPrice: 5 }), best({ inventoryId: 'a1', bestPrice: 7 })]
    expect(() => zalogaVrednostPregled([ARTIKLI[0]], podvojenBest)).toThrow(TypeError)
    expect(() => zalogaVrednostPregled([ARTIKLI[0]], podvojenBest)).toThrow(/podvojen best inventoryId a1/)
    const orphanBest = [best({ inventoryId: 'neznani-id', bestPrice: 9 })]
    expect(() => zalogaVrednostPregled([ARTIKLI[0]], orphanBest)).toThrow(TypeError)
    expect(() => zalogaVrednostPregled([ARTIKLI[0]], orphanBest)).toThrow(/best cena brez ujemajočega artikla neznani-id/)
  })

  it('preveriVrednostArtikel: ne-finite/negativna količina + pokvaren stevecCen (manjkajoč NIKOLI tiho 0 — R227 strogost) + prazna besedilna polja — indeks krivca VEDNO v sporočilu', () => {
    expect(() => preveriVrednostArtikel(artikel({ id: 'x1', sifraMateriala: 'S', naziv: 'N', kolicinaZaloga: NaN }), 2)).toThrow(/kolicinaZaloga/)
    expect(() => preveriVrednostArtikel(artikel({ id: 'x1', sifraMateriala: 'S', naziv: 'N', kolicinaZaloga: Infinity }), 3)).toThrow(/kolicinaZaloga/)
    expect(() => preveriVrednostArtikel(artikel({ id: 'x1', sifraMateriala: 'S', naziv: 'N', kolicinaZaloga: -1 }), 4)).toThrow(/kolicinaZaloga/)
    expect(() => preveriVrednostArtikel(artikel({ id: 'x1', sifraMateriala: 'S', naziv: 'N', stevecCen: 1.5 }), 5)).toThrow(/stevecCen/)
    expect(() => preveriVrednostArtikel(artikel({ id: 'x1', sifraMateriala: 'S', naziv: 'N', stevecCen: -1 }), 6)).toThrow(/stevecCen/)
    expect(() => preveriVrednostArtikel(artikel({ id: 'x1', sifraMateriala: '', naziv: 'N' }), 7)).toThrow(/sifraMateriala/)
    expect(() => preveriVrednostArtikel(artikel({ id: 'x1', sifraMateriala: 'S', naziv: '  ' }), 8)).toThrow(/naziv/)
    expect(() => preveriVrednostArtikel(artikel({ id: 'x1', sifraMateriala: 'S', naziv: 'N', enota: '' }), 9)).toThrow(/enota/)
    expect(() => preveriVrednostArtikel(artikel({ id: '', sifraMateriala: 'S', naziv: 'N' }), 10)).toThrow(/id mora biti/)
    // ne-objekt / polje
    expect(() => preveriVrednostArtikel(null as unknown as ZalogaVrednostArtikel, 11)).toThrow(TypeError)
    expect(() => preveriVrednostArtikel([1] as unknown as ZalogaVrednostArtikel, 12)).toThrow(TypeError)
    // preverba se poganja v pregledu (fail-verbose VSEH vnosov)
    expect(() => zalogaVrednostPregled([ARTIKLI[0], artikel({ id: 'x9', sifraMateriala: 'S', naziv: 'N', kolicinaZaloga: '3' as unknown as number })], [])).toThrow(TypeError)
  })

  it('preveriVrednostBest: negativen/ne-finite bestPrice + prazen bestSupplier/inventoryId — indeks krivca VEDNO v sporočilu', () => {
    expect(() => preveriVrednostBest(best({ inventoryId: 'x1', bestPrice: -0.5 }), 1)).toThrow(/bestPrice/)
    expect(() => preveriVrednostBest(best({ inventoryId: 'x1', bestPrice: NaN }), 2)).toThrow(/bestPrice/)
    expect(() => preveriVrednostBest(best({ inventoryId: 'x1', bestPrice: 5, bestSupplier: ' ' }), 3)).toThrow(/bestSupplier/)
    expect(() => preveriVrednostBest(best({ inventoryId: '', bestPrice: 5 }), 4)).toThrow(/inventoryId/)
    expect(() => preveriVrednostBest(null as unknown as ZalogaVrednostBest, 5)).toThrow(TypeError)
    // preverba se poganja v pregledu
    expect(() => zalogaVrednostPregled([ARTIKLI[0]], [best({ inventoryId: 'a1', bestPrice: '5' as unknown as number })])).toThrow(TypeError)
  })

  it('build z ne-Date now / ne-objekt opcije / ne-polja virov → TypeError', () => {
    expect(() => buildZalogaVrednostPdfDoc(ARTIKLI, BEST, 'now' as unknown as { now: Date })).toThrow(TypeError)
    expect(() => buildZalogaVrednostPdfDoc(ARTIKLI, BEST, { now: 'ne-date' as unknown as Date })).toThrow(TypeError)
    expect(() => buildZalogaVrednostPdfDoc('ne-polje' as unknown as ZalogaVrednostArtikel[], BEST, { now: NOW })).toThrow(TypeError)
    expect(() => buildZalogaVrednostPdfDoc(ARTIKLI, 'ne-polje' as unknown as ZalogaVrednostBest[], { now: NOW })).toThrow(TypeError)
  })
})

describe('R273 — sklanjatev + filename + družinska anatomija', () => {
  it('filename kontrakt Zaloga-vrednost-YYYY-MM-DD + fail-closed + generate (doc.save prek filename); ločeno od Inventura-pregled-… IN zaloga CSV', () => {
    expect(zalogaVrednostPdfFilename(new Date('2027-01-02T10:00:00.000Z'))).toBe('Zaloga-vrednost-2027-01-02.pdf')
    expect(lib).toContain('`Zaloga-vrednost-${todayStamp(now)}.pdf`')
    expect(lib).toContain('generateZalogaVrednostPdf')
    expect(lib).toContain('doc.save(zalogaVrednostPdfFilename(options.now))')
  })

  it('družinska anatomija: glava ZALOGA — PREMOŽENJSKA VREDNOST + zaloga: celotno skladišče + osveženo + noge Stran i/N + determinizem (setCreationDate + setFileId) + brez locale + NIČ mreže', () => {
    expect(lib).toContain("'ZALOGA — PREMOŽENJSKA VREDNOST'")
    expect(lib).toContain('zaloga: celotno skladišče')
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

describe('R273 — vsebinski dokazi na komponenti (inventory-tab.tsx)', () => {
  it('pill ŽIVO: aria + press-scale + disabled={valPdfVteku} + guard + Loader2/FileDown aria-hidden + VEDNO viden (NI gated na filtered.length)', () => {
    expect(komponenta).toContain('aria-label="Izvozi pregled vrednosti zaloge kot PDF"')
    const pill = oknoMed(komponenta, '{/* R273 — pregled vrednosti zaloge PDF (29. člen', '</Button>')
    expect(pill).toContain('onClick={() => void handleVrednostPdf()}')
    expect(pill).toContain('disabled={valPdfVteku}')
    expect(pill).toContain('press-scale')
    expect(pill).toContain('<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />')
    expect(pill).toContain('<FileDown className="h-3.5 w-3.5" aria-hidden="true" />')
    expect(pill).toContain('Vrednost')
    // handler guard (dvoklik)
    expect(komponenta).toContain('if (valPdfVteku) return')
  })

  it('FRESH fetch OBEH virov ob kliku (Promise.all /api/inventory + /api/material-prices — polna resnica) + fail-verbose DTO pruning (HTTP razlogi, Array.isArray, bestPerMaterial polje, id/količina/števec cen strict)', () => {
    const handler = oknoMed(komponenta, 'const handleVrednostPdf = async () => {', '  // R219 (P1-f) — dvostopenjsko filtriranje:')
    expect(handler).toContain("fetch('/api/inventory', { credentials: 'same-origin' })")
    expect(handler).toContain("fetch('/api/material-prices', { credentials: 'same-origin' })")
    expect(handler).toContain('GET /api/inventory → HTTP ${resInv.status}')
    expect(handler).toContain('GET /api/material-prices → HTTP ${resCene.status}')
    expect(handler).toContain("throw new TypeError('Odgovora /api/inventory ni mogoče prebrati (ni polja).')")
    expect(handler).toContain('(bestPerMaterial ni polje)')
    expect(handler).toContain('manjkajoč id v odgovoru API-ja')
    expect(handler).toContain('števec cen (_count.prices) mora biti ne-negativno celo število')
    expect(handler).toContain('bestPrice mora biti končno ne-negativno število')
  })

  it('fail-closed toast (Ni vpisanih artiklov + iskren opis) + fail-verbose (Izvoz ni uspel) + ENA izpeljava (zalogaVrednostPregled pred generate + agregat toast)', () => {
    const handler = oknoMed(komponenta, 'const handleVrednostPdf = async () => {', '  // R219 (P1-f) — dvostopenjsko filtriranje:')
    expect(handler).toContain("toast.error('Ni vpisanih artiklov', {")
    expect(handler).toContain('Pregled vrednosti zaloge se izvozi, ko je vpisan prvi artikel zaloge.')
    expect(handler).toContain("toast.error('Izvoz ni uspel', {")
    expect(handler).toContain('const { povzetek } = zalogaVrednostPregled(vnosi, best)')
    expect(handler).toContain('generateZalogaVrednostPdf(vnosi, best, { now: new Date() })')
    expect(handler).toContain('Zaloga-vrednost-…pdf — ${artikelBeseda(povzetek.artiklov)}, Σ ${povzetek.zCeno > 0 ? `${povzetek.vsotaEur.toFixed(2)} EUR` : \'—\'}, pretečena ${povzetek.pretecenih}, brez cene ${povzetek.brezCene}.')
    expect(handler).toContain("toast.success('Pregled vrednosti zaloge prenešen v PDF', {")
  })

  it('mini-vrstica: \'Vrednost (viden seznam):\' + dot prioritetni RED/AMBER/GREEN + kondicionalna žetona samo > 0 + ENA izpeljava memo ([filtered, bestCene]) + bestCene null → iskrena odsotnost', () => {
    const mini = oknoMed(komponenta, '{vrednostVidenPregled !== null && (', '{/* Inventory List */}')
    expect(mini).toContain('Vrednost (viden seznam):')
    expect(mini).toContain('{artikelBeseda(vrednostVidenPregled.artiklov)}')
    expect(mini).toContain("'bg-roksal-red'")
    expect(mini).toContain("'bg-roksal-amber'")
    expect(mini).toContain("'bg-roksal-green'")
    expect(mini).toContain('pretečena {vrednostVidenPregled.pretecenih}')
    expect(mini).toContain('brez cene {vrednostVidenPregled.brezCene}')
    // R271 lekcija 2 kanon: beseda = število+beseda — klicalec NE doda še
    // števca ('13 13 artiklov' dvojni števec = BUG — E2E r273 ujel tudi v
    // R270 inventura mini; popravljeno OBE mini + r270 E2E pričakovanje).
    expect(mini).not.toContain('{vrednostVidenPregled.artiklov} {artikelBeseda')
    expect(komponenta).not.toContain('{inventuraVidenPregled.artiklov} {artikelBeseda')
    // ENA izpeljava: ISTI zalogaVrednostPregled čez filtered + bestCene (WYSIWYG — dve okni, ENA matemtika)
    const memo = oknoMed(komponenta, 'const vrednostVidenPregled = useMemo(() => {', '}, [filtered, bestCene])')
    expect(memo).toContain('bestCene === null')
    expect(memo).toContain('zalogaVrednostPregled(vnosi, bestCene)')
    expect(memo).toContain('cnt.prices')
    // mount fetch — cen-vir za mini (pokvaren = null, mini iskreno odsotna)
    const mount = oknoMed(komponenta, "  // R273 — FRESH best cene", '  // R273 — F2 mini-vrstica')
    expect(mount).toContain("fetch('/api/material-prices', { credentials: 'same-origin' })")
    expect(mount).toContain('setBestCene(null)')
  })

  it('legenda VEDNO vidna + 29. člen dokumentiran (lib IN komponenta) + 0 novih hex + glava NI duplicirana v komponenti + Inventura/CSV/Naročilnica ostanejo', () => {
    expect(komponenta).toContain('PDF = polna denarna resnica skladišča (FRESH /api/inventory + /api/material-prices ob kliku — samo trenutno veljavne cene; ne zastarel state)')
    expect(komponenta).not.toMatch(/#[0-9a-fA-F]{6}/)
    expect(lib).not.toMatch(/#[0-9a-fA-F]{6}/)
    // 29. člen družine — dokumentirano v obeh virih
    expect(lib).toContain('29. člen')
    expect(komponenta).toContain('29. člen')
    // R249 doktrina: naslovni needleji v komponenti NE duplicirajo glave (glava = lib resnica)
    expect(komponenta).not.toContain('ZALOGA — PREMOŽENJSKA VREDNOST')
    // obstoječi izvozi NISO pokvarjeni (pariteta)
    expect(komponenta).toContain("aria-label=\"Izvozi inventurni pregled premoženja kot PDF\"")
    expect(komponenta).toContain("aria-label=\"Izvozi vidno zalogo kot PDF\"")
  })
})
