// ---------------------------------------------------------------------------
// R262 — ZALOGA — OSNUTEK POKRITOST PDF (18. člen 'izvozi' družine, P1-f) —
// testi. Bajtni dokazi (determinizem: enak vhod = bajtno enak PDF; PREMEŠAN
// VRSTNI RED = bajtno ENAK — sort interno, f(množica); %PDF- magija; NOV
// glifni razred — R249 doktrina) + presek-resnice (pokrito = Σ postavk
// OSNUTEK naročil po IDENTITETI inventoryId — R260/R261 lekcija; ne-OSNUTEK
// NIČ ne pokriva — obljuba ≠ nabava; manjkajoci = max(0, minimum − zaloga);
// % samo pri manjkajoci > 0; brez-zapisa + nad-minimumom-brez-osnutka =
// poimenovani, NIKOLI tiho) + vsebinski dokazi na VIRU liba in komponente.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildZalogaOsnutekPdfDoc,
  zalogaOsnutekPdfFilename,
  zalogaOsnutekPokritost,
  preveriZalogaOsnutekArtikel,
  preveriZalogaOsnutekNarocilo,
  type ZalogaOsnutekArtikel,
  type ZalogaOsnutekNarocilo,
} from '@/lib/zaloga-osnutek-pdf'
import { buildRacuniProjektiPdfDoc } from '@/lib/racuni-projekti-pdf'

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

const lib = beri('src/lib/zaloga-osnutek-pdf.ts')
const komponenta = beri('src/components/roksal/material-intelligence-tab.tsx')
const narocilaLib = beri('src/lib/narocila-pregled-pdf.ts')

// FIXED now (determinizem — žig + CreationDate + fileId + ime).
const NOW: Date = new Date('2026-09-28T11:00:00.000Z')

// 3 artikli: INOX pod minimumom (15/50 — deficit 35), WPC nad minimumom
// (450/100 — brez vrstice brez osnutka), ALU natančno na minimumu (120/120
// — manjkajoci 0 — mejni primer max(0,…)).
const ARTIKLI: ZalogaOsnutekArtikel[] = [
  { id: 'a-inox', sifraMateriala: 'INOX-M12-A4', naziv: 'Inox Vijak M12 A4', kolicinaZaloga: 15, enota: 'kos', minimalnaZaloga: 50 },
  { id: 'a-wpc', sifraMateriala: 'WPC-120-A', naziv: 'WPC Deska 120mm', kolicinaZaloga: 450, enota: 'm', minimalnaZaloga: 100 },
  { id: 'a-alu', sifraMateriala: 'ALU-PROF-40', naziv: 'Alu Profil 40x40', kolicinaZaloga: 120, enota: 'm', minimalnaZaloga: 120 },
]

// 3 naročila: o1 OSNUTEK pokriva INOX 40 (≥ 35 → POKRITO, 114.3 %) + ALU 100
// (nad minimumom → NAD MINIMUMOM, % '—'); o2 POSLAN 999 WPC — NE ŠTEJE
// (obljuba ≠ nabava — dokaz izključitve); o3 OSNUTEK z neznano postavko
// (brez-zapisa števec + vsota).
const NAROCILA: ZalogaOsnutekNarocilo[] = [
  { status: 'OSNUTEK', items: [ { inventoryId: 'a-inox', kolicina: 40 }, { inventoryId: 'a-alu', kolicina: 100 } ] },
  { status: 'POSLANO', items: [ { inventoryId: 'a-wpc', kolicina: 999 } ] },
  { status: 'OSNUTEK', items: [ { inventoryId: 'a-tuj', kolicina: 7 } ] },
]

function zgradi(
  artikli: readonly ZalogaOsnutekArtikel[] = ARTIKLI,
  narocila: readonly ZalogaOsnutekNarocilo[] = NAROCILA,
  now: Date = NOW,
): Buffer {
  const doc = buildZalogaOsnutekPdfDoc(artikli, narocila, { now })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R262 — PDF bajtni dokazi (determinizem + glifni razred minute — R249 doktrina)', () => {
  it('determinizem: enak vhod = bajtno enak; PREMEŠAN VRSTNI RED = bajtno ENAK (sort interno); drug now = drugačen', () => {
    expect(zgradi().equals(zgradi())).toBe(true)
    const preskakljani = zgradi(
      [ARTIKLI[2], ARTIKLI[0], ARTIKLI[1]],
      [NAROCILA[2], NAROCILA[0], NAROCILA[1]],
    )
    expect(preskakljani.equals(zgradi())).toBe(true)
    expect(zgradi(ARTIKLI, NAROCILA, new Date('2026-09-28T11:01:00.000Z')).equals(zgradi())).toBe(false)
  })

  it('%PDF- magija + NOV glifni razred (≠ vseh 25 znanih družinskih razredov) + ime Zaloga-osnutek-pokritost-YYYY-MM-DD.pdf', () => {
    const bin = zgradi()
    expect(bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    const znani = [30057, 30119, 30191, 30253, 35565, 38753, 39927, 41519, 42798, 37709, 37771, 36788, 36656, 36532, 33958, 36555, 38631, 45508, 44828, 36260, 36583, 45127, 38565, 38909, 40261]
    expect(znani).not.toContain(bin.length)
    expect(zalogaOsnutekPdfFilename(NOW)).toBe('Zaloga-osnutek-pokritost-2026-09-28.pdf')
  })

  it('soli 0x85–0x88 — UNIKATNE v družini (register: računi-po-projektih 0x81–0x84 — bratje NE delijo semen; isti seed različna liba = različen ID)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0x85)')
    expect(lib).toContain('fnv1aHex(seed, 0x88)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x81)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x7d)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x61)')
  })
})

describe('R262 — presek-resnice (ENA resnica za KPI + tabelo + sklep + mini-vrstico + toast)', () => {
  it('pokritost po IDENTITETI: SAMO OSNUTEK šteje (POSLANO 999 NIČ), manjkajoci = max(0, min − zaloga), statusi iskreni', () => {
    const { vrste, povzetek } = zalogaOsnutekPokritost(ARTIKLI, NAROCILA)
    expect(vrste).toHaveLength(2) // INOX (deficit) + ALU (pokrito > 0, nad min.)
    const inox = vrste.find((v) => v.sifra === 'INOX-M12-A4')!
    expect(inox.manjkajoci).toBe(35)
    expect(inox.pokrito).toBe(40) // OSNUTEK o1; POSLAN o2 NE ŠTEJE
    expect(inox.status).toBe('POKRITO')
    expect(inox.pokritostOdstotek).toBeCloseTo(114.2857142857, 9)
    const alu = vrste.find((v) => v.sifra === 'ALU-PROF-40')!
    expect(alu.manjkajoci).toBe(0) // 120/120 — mejni max(0,…)
    expect(alu.pokrito).toBe(100)
    expect(alu.status).toBe('NAD MINIMUMOM')
    expect(alu.pokritostOdstotek).toBeNull()
    expect(povzetek.osnutkov).toBe(2)
    expect(povzetek.podMinimumom).toBe(1)
    expect(povzetek.pokritihCeloti).toBe(1)
    expect(povzetek.nepokritih).toBe(0)
    expect(povzetek.pokritoEnot).toBe(140)
    expect(povzetek.manjkajociEnot).toBe(35)
    expect(povzetek.postavkBrezArtikla).toBe(1)
    expect(povzetek.enotBrezArtikla).toBe(7)
    // WPC (nad min., brez OSNUTEK pokritosti — o2 je POSLAN) = brez vrstice
    expect(povzetek.nadMinimumomBrezOsnutka).toBe(1)
  })

  it('NEPOKRITO + DELNO statusi: pod-minimum artikel brez osnutka = NEPOKRITO (0 % rdeče), delna pokritost = DELNO (AMBER)', () => {
    const brez = zalogaOsnutekPokritost([ARTIKLI[0]], [])
    expect(brez.vrste[0].status).toBe('NEPOKRITO')
    expect(brez.vrste[0].pokrito).toBe(0)
    expect(brez.vrste[0].pokritostOdstotek).toBe(0)
    const delno = zalogaOsnutekPokritost(
      [ARTIKLI[0]],
      [{ status: 'OSNUTEK', items: [{ inventoryId: 'a-inox', kolicina: 10 }] }],
    )
    expect(delno.vrste[0].status).toBe('DELNO')
    expect(delno.povzetek.delno).toBe(1)
    expect(delno.povzetek.pokritihCeloti).toBe(0)
  })

  it('premešan vhod = ISTI povzetek (f(MNOŽICA)); sort ŠIFRA ASC code-unit', () => {
    const a = zalogaOsnutekPokritost(ARTIKLI, NAROCILA).povzetek
    const b = zalogaOsnutekPokritost([ARTIKLI[1], ARTIKLI[2], ARTIKLI[0]], [NAROCILA[1], NAROCILA[2], NAROCILA[0]]).povzetek
    expect(a).toEqual(b)
    const { vrste } = zalogaOsnutekPokritost(ARTIKLI, NAROCILA)
    expect(vrste.map((v) => v.sifra)).toEqual(['ALU-PROF-40', 'INOX-M12-A4'])
  })

  it('EN ne-prazen vir ZADOVOLJI: samo artikli (deficit = NEPOKRITO) ALI samo naročila (vse brez-zapisa)', () => {
    const samoArtikli = zalogaOsnutekPokritost(ARTIKLI, [])
    expect(samoArtikli.povzetek.artiklov).toBe(1)
    expect(samoArtikli.povzetek.nepokritih).toBe(1)
    const samoNarocila = zalogaOsnutekPokritost([], NAROCILA)
    expect(samoNarocila.povzetek.artiklov).toBe(0)
    expect(samoNarocila.povzetek.postavkBrezArtikla).toBe(3) // o1 2× + o3 1× (o2 POSLAN izključen)
    expect(samoNarocila.povzetek.enotBrezArtikla).toBe(147)
    expect(samoNarocila.povzetek.osnutkov).toBe(2)
  })

  it('necel količine: kolicinaNiz — cela brez decimalk, necel z 2 (družinski deterministični niz)', () => {
    const necelo = zalogaOsnutekPokritost(
      [{ id: 'x', sifraMateriala: 'S-1', naziv: 'N', kolicinaZaloga: 1.5, enota: 'm', minimalnaZaloga: 2 }],
      [{ status: 'OSNUTEK', items: [{ inventoryId: 'x', kolicina: 0.25 }] }],
    )
    expect(necelo.vrste[0].manjkajoci).toBe(0.5)
    expect(necelo.vrste[0].pokritostOdstotek).toBeCloseTo(50, 9)
  })
})

describe('R262 — fail-closed v libu (družina R236/R250–R261)', () => {
  it('prazen presek (0 artiklov IN 0 naročil) ne nastaja dokumenta — TypeError s toast sporočilom komponente', () => {
    expect(() => buildZalogaOsnutekPdfDoc([], [], { now: NOW })).toThrow(TypeError)
    expect(() => buildZalogaOsnutekPdfDoc([], [], { now: NOW })).toThrow('prazen presek ne nastaja dokumenta')
  })

  it('fail-closed ×11: ne-polji, ne-options, pokvaren now, neznan status, ne-items polje, prazen inventoryId, negativna kolicina, prazni nizi artikla, negativna kolicinaZaloga — indeks krivca', () => {
    const now = { now: NOW }
    expect(() => buildZalogaOsnutekPdfDoc('ne-polje' as unknown as ZalogaOsnutekArtikel[], NAROCILA, now)).toThrow(TypeError)
    expect(() => buildZalogaOsnutekPdfDoc(ARTIKLI, 'ne-polje' as unknown as ZalogaOsnutekNarocilo[], now)).toThrow(TypeError)
    expect(() => buildZalogaOsnutekPdfDoc(ARTIKLI, NAROCILA, null as unknown as { now: Date })).toThrow(TypeError)
    expect(() => buildZalogaOsnutekPdfDoc(ARTIKLI, NAROCILA, { now: 'danes' as unknown as Date })).toThrow(TypeError)
    expect(() => buildZalogaOsnutekPdfDoc(ARTIKLI, NAROCILA, { now: new Date(NaN) })).toThrow(TypeError)
    expect(() => preveriZalogaOsnutekNarocilo({ status: 'TUPI', items: [] }, 3)).toThrow('status mora biti eden iz')
    expect(() => preveriZalogaOsnutekNarocilo({ status: 'OSNUTEK', items: 'ne' as unknown as readonly [] }, 3)).toThrow('items morajo biti polje')
    expect(() => preveriZalogaOsnutekNarocilo({ status: 'OSNUTEK', items: [{ inventoryId: '', kolicina: 1 }] }, 3)).toThrow('inventoryId mora biti ne-prazen niz')
    expect(() => preveriZalogaOsnutekNarocilo({ status: 'OSNUTEK', items: [{ inventoryId: 'a', kolicina: -1 }] }, 3)).toThrow('kolicina mora biti končno ne-negativno')
    expect(() => preveriZalogaOsnutekArtikel({ id: '', sifraMateriala: 'S', naziv: 'N', kolicinaZaloga: 1, enota: 'kos', minimalnaZaloga: 1 }, 3)).toThrow('id mora biti ne-prazen niz')
    expect(() => preveriZalogaOsnutekArtikel({ id: 'a', sifraMateriala: 'S', naziv: 'N', kolicinaZaloga: -1, enota: 'kos', minimalnaZaloga: 1 }, 3)).toThrow('kolicinaZaloga mora biti končno ne-negativno')
  })

  it('EN VIR import dokazi: STATUSI_NAROCIL iz narocila-pregled-pdf (R257) — nič dvojnega seznama; brat R261 NESPREMENJEN (soli)', () => {
    expect(lib).toContain("import { STATUSI_NAROCIL } from './narocila-pregled-pdf'")
    expect(narocilaLib).toContain("export const STATUSI_NAROCIL = ['OSNUTEK', 'POSLANO', 'POTRJENO', 'DOBLJENO', 'PREKlicANO'] as const")
    const r261Lib = beri('src/lib/racuni-projekti-pdf.ts')
    expect(r261Lib).toContain('fnv1aHex(seed, 0x81)')
    expect(r261Lib).not.toContain('fnv1aHex(seed, 0x85)')
    // brat R261 z ISTIMI vhodi = bajtno zdrav (dvojni bajtni dokaz — R260 vzorec)
    const doc = buildRacuniProjektiPdfDoc(
      [{ stevilka: '2026-001', status: 'IZDAN', znesek: 100, projectId: 'p' }],
      [{ id: 'p', nazivProjekta: 'P', estimatedPrice: null }],
      { now: NOW },
    )
    expect(Buffer.from(doc.output('arraybuffer')).subarray(0, 5).toString('ascii')).toBe('%PDF-')
  })
})

describe('R262 — WYSIWYG vir (tabela + KPI + sklep)', () => {
  it('tabela 7 stolpcev (Šifra, Artikel, Zaloga, Minimum, Manjkajoče, V osnutku, Pokritost (%)) — head dobesedno', () => {
    expect(lib).toContain("['Šifra', 'Artikel', 'Zaloga', 'Minimum', 'Manjkajoče', 'V osnutku', 'Pokritost (%)']")
  })

  it('pokritost barvna resnica: NEPOKRITO 0 % RDEČE bold (NIKOLI utišano), delno AMBER bold, ≥100 ZELENO bold, \'—\' sivo; manjkajoci > 0 AMBER', () => {
    const okno = oknoMed(lib, 'didParseCell:', '})\n  y =')
    expect(okno).toContain('textColor = RED')
    expect(okno).toContain('textColor = GREEN')
    expect(okno).toContain('textColor = AMBER')
    expect(okno).toContain('textColor = GRAY')
  })

  it('KPI 5 boxov z signalnim jezikom (Pod minimumom rdeče pri > 0, Pokrito zeleno, Manjkajoče amber, Osnutkov navy)', () => {
    expect(lib).toContain("'Artiklov'")
    expect(lib).toContain("'Pod minimumom'")
    expect(lib).toContain("'Pokrito enot'")
    expect(lib).toContain("'Manjkajoče'")
    expect(lib).toContain("'Osnutkov'")
  })

  it('sklep: izključitve poimenovane (nad minimumom brez osnutka; postavk brez artikla) — iskren podpis', () => {
    expect(lib).toContain('nad minimumom brez osnutka')
    expect(lib).toContain('postavk osnutkov brez artikla')
    expect(lib).toContain('pokritih v celoti')
  })

  it('glava ZALOGA — OSNUTEK POKRITOST + osveženo + noge Stran i/N', () => {
    expect(lib).toContain("'ZALOGA — OSNUTEK POKRITOST'")
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

describe('R262 — komponenta (material-intelligence-tab) — pill, legenda, handler, mini-vrstica', () => {
  it('pill VEDNO viden (bralni dokument, P1-k precedens) + press-scale + FileText aria-hidden + disabled guard — pariteta R257', () => {
    const okno = oknoMed(komponenta, 'onClick={handlePokritostPdf}', '</Button>')
    expect(okno).toContain('press-scale')
    expect(okno).toContain('FileText')
    expect(okno).toContain('aria-hidden="true"')
    expect(okno).toContain('disabled={loading || pokritostVTeku}')
    expect(okno).toContain('focus-visible:ring-2')
  })

  it('legenda substring-parna nadgradna (R260 lekcija 3): stara R257 resnica dobesedno + nova R262 append — NIČ starega pina zlomljenega', () => {
    expect(komponenta).toContain('CSV = vrstica per postavka · PDF = vrstica per naročilo · Pretekel rok = pretekljena obljuba, status še odprt')
    expect(komponenta).toContain('· Pokritost = zaloga × osnutki (OSNUTEK) po identiteti artikla')
  })

  it('handler: ENA izpeljava zalogaOsnutekPokritost za toast, EN now, fail-closed toast pri praznem preseku, TypeError viden razlog, dvoklik guard', () => {
    const okno = oknoMed(komponenta, 'const handlePokritostPdf', 'const handleNarocilaPdf')
    expect(okno).toContain('if (pokritostVTeku || loading) return')
    expect(okno).toContain('setPokritostVTeku(true)')
    expect(okno).toContain("title: 'Ni podatkov za pokritost'")
    expect(okno).toContain("'PDF se izvozi, ko je vpisan prvi artikel ali osnutek naročila.'")
    expect(okno).toContain('buildZalogaOsnutekPdfDoc(pokritostVhodi.artikli, pokritostVhodi.narocila, { now })')
    expect(okno).toContain('zalogaOsnutekPdfFilename(now)')
    expect(okno).toContain("title: 'Pokritost prenešena v PDF'")
    expect(okno).toContain("variant: 'destructive'")
  })

  it('MaterialOrder items nosijo inventoryId (IDENTITETA joina) + vhodi iz ISTIH state-ov (NIČ nove mreže) + memo', () => {
    expect(komponenta).toContain('inventoryId: string')
    expect(komponenta).toContain('inventoryId: p.inventoryId')
    expect(komponenta).toContain('minimalnaZaloga: a.minimalnaZaloga')
    expect(komponenta).toContain('useMemo')
  })

  it('F2 mini-vrstica Pokritost osnutka: WYSIWYG ISTA izpeljava (≥ 2 klici zalogaOsnutekPokritost v komponenti) + kondicionalni žig nepokritih (R256 lekcija)', () => {
    expect(komponenta).toContain('Pokritost osnutka:')
    expect(komponenta).toContain('nepokritih pod minimumom')
    expect((komponenta.match(/zalogaOsnutekPokritost\(/g) ?? []).length).toBeGreaterThanOrEqual(2)
    const okno = oknoMed(komponenta, 'R262 — F2 pokritostna mini-vrstica', '</div>\n          {/* R242')
    expect(okno).toContain("pokritostPovzetek.nepokritih > 0 ? 'bg-roksal-red' : 'bg-roksal-green'")
    expect(okno).toContain('border-roksal-red/40')
  })

  it('0 novih hex (žetoni samo — družinsko pravilo R224–R261)', () => {
    const hexi = komponenta.match(/#[0-9a-fA-F]{6}\b/g) ?? []
    const znani = new Set(['2a3f5f', '1d2b3e'])
    for (const h of hexi) expect(znani.has(h.slice(1).toLowerCase())).toBe(true)
  })
})
