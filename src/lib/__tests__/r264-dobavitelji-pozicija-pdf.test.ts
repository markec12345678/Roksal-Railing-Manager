// ---------------------------------------------------------------------------
// R264 — DOBAVITELJI — POZICIJA CEN PDF (20. člen 'izvozi' družine, P1-f) —
// testi. Bajtni dokazi (determinizem: enak vhod = bajtno enak PDF; PREMEŠAN
// VRSTNI RED = bajtno ENAK — sort interno + kanon seed, f(množica); %PDF-
// magija; NOV glifni razred — R249 doktrina) + presek-resnice (JOIN po
// IDENTITETI inventoryId — R260–R263 lekcija; pozicija po VREDNOSTI —
// istocenovna = obadva najnižja; min-invarianta cena ≥ bestPrice fail-closed;
// bestPrice 0 → razlika % ne obstaja → TypeError NIKOLI Infinity; povprečni
// odstopek čez višje SAMO pri višjih > 0 sicer null; najširši razpon max čez
// vse — 0 = vse najnižje; brez-alternativa suppliers === 1) + vsebinski
// dokazi na VIRU liba in komponente.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildDobaviteljiPozicijaPdfDoc,
  dobaviteljiPozicijaPdfFilename,
  dobaviteljiPozicijaCen,
  preveriPozicijaCeno,
  preveriPozicijaBest,
  sortirajDobaviteljePozicija,
  ponudbaBeseda,
  type PozicijaCenaVnos,
  type PozicijaBestVnos,
} from '@/lib/dobavitelji-pozicija-pdf'
import { buildStrankePokritostPdfDoc } from '@/lib/stranke-pokritost-pdf'

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

const lib = beri('src/lib/dobavitelji-pozicija-pdf.ts')
const komponenta = beri('src/components/roksal/material-intelligence-tab.tsx')

// FIXED now (determinizem — žig + CreationDate + fileId + ime).
const NOW: Date = new Date('2026-09-28T11:00:00.000Z')

// 2 artikla: A best 100 (2 ponudbi), B best 80 (1 ponudba — brez alternative).
// 4 ponudbe: d1 × A 100 (NAJNIŽJA) + d1 × B 80 (NAJNIŽJA) → d1 vse najnižje
// (povprečni odstopek '—', najširši 0 GREEN); d2 × A 120 (VIŠJA 20 %) → d2
// povprečni 20,0 %; d3 × A 100 (NAJNIŽJA po vrednosti — istocenovna z d1!).
const CENE: PozicijaCenaVnos[] = [
  { inventoryId: 'a', cena: 100, dobaviteljId: 'd1', dobavitelj: 'Alu Dobavitelj' },
  { inventoryId: 'b', cena: 80, dobaviteljId: 'd1', dobavitelj: 'Alu Dobavitelj' },
  { inventoryId: 'a', cena: 120, dobaviteljId: 'd2', dobavitelj: 'Beton Center' },
  { inventoryId: 'a', cena: 100, dobaviteljId: 'd3', dobavitelj: 'Alu Dobavitelj' }, // isti naziv kot d1!
]
const BEST: PozicijaBestVnos[] = [
  { inventoryId: 'a', bestPrice: 100, suppliers: 3 },
  { inventoryId: 'b', bestPrice: 80, suppliers: 1 },
]

function zgradi(
  ceny: readonly PozicijaCenaVnos[] = CENE,
  najboljse: readonly PozicijaBestVnos[] = BEST,
  now: Date = NOW,
): Buffer {
  const doc = buildDobaviteljiPozicijaPdfDoc(ceny, najboljse, { now })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R264 — PDF bajtni dokazi (determinizem + glifni razred — R249 doktrina)', () => {
  it('determinizem: enak vhod = bajtno enak; PREMEŠAN VRSTNI RED = bajtno ENAK (sort interno + kanon seed); drug now = drugačen', () => {
    expect(zgradi().equals(zgradi())).toBe(true)
    const preskakljani = zgradi([CENE[2], CENE[0], CENE[3], CENE[1]], [BEST[1], BEST[0]])
    expect(preskakljani.equals(zgradi())).toBe(true)
    expect(zgradi(CENE, BEST, new Date('2026-09-28T11:01:00.000Z')).equals(zgradi())).toBe(false)
  })

  it('%PDF- magija + NOV glifni razred (≠ vseh 25 znanih družinskih razredov) + ime Pozicija-dobaviteljev-YYYY-MM-DD.pdf', () => {
    const bin = zgradi()
    expect(bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    const znani = [30057, 30119, 30191, 30253, 35565, 38753, 39927, 41519, 42798, 37709, 37771, 36788, 36656, 36532, 33958, 36555, 38631, 45508, 44828, 36260, 36583, 45127, 38565, 38909, 40261]
    expect(znani).not.toContain(bin.length)
    expect(dobaviteljiPozicijaPdfFilename(NOW)).toBe('Pozicija-dobaviteljev-2026-09-28.pdf')
  })

  it('soli 0x8d–0x90 — UNIKATNE v družini (register: stranke-pokritost 0x89–0x8c — bratje NE delijo semen)', () => {
    expect(lib).toContain('fnv1aHex(seed, 0x8d)')
    expect(lib).toContain('fnv1aHex(seed, 0x90)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x89)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x85)')
    expect(lib).not.toContain('fnv1aHex(seed, 0x81)')
  })
})

describe('R264 — presek-resnice (ENA resnica za KPI + tabelo + sklep + toast)', () => {
  it('pozicija po VREDNOSTI: istocenovna ponudba = NAJNIŽJA (d1 in d3 obadva na A 100); min-invarianta; višja = VIŠJA', () => {
    const { vrste, povzetek } = dobaviteljiPozicijaCen(CENE, BEST)
    expect(vrste).toHaveLength(3) // d1, d2, d3 (d3 = isti naziv, RAZLIČEN id)
    const d1 = vrste.find((v) => v.id === 'd1')!
    expect(d1.ponudb).toBe(2)
    expect(d1.najnizjih).toBe(2)
    expect(d1.visjih).toBe(0)
    expect(d1.povprecniOdstotek).toBeNull() // vse najnižje — NI povprečja
    expect(d1.najsirosiRazpon).toBe(0) // iskreno 0
    const d2 = vrste.find((v) => v.id === 'd2')!
    expect(d2.visjih).toBe(1)
    expect(d2.povprecniOdstotek).toBeCloseTo(20, 9) // (120−100)/100
    expect(d2.najsirosiRazpon).toBeCloseTo(20, 9)
    const d3 = vrste.find((v) => v.id === 'd3')!
    expect(d3.najnizjih).toBe(1) // istocenovna z d1 — OBADVA najnižja
    expect(povzetek.dobaviteljev).toBe(3)
    expect(povzetek.ponudb).toBe(4)
    expect(povzetek.artiklov).toBe(2)
    expect(povzetek.brezAlternative).toBe(1) // artikel b
    expect(povzetek.najnizjihPozicij).toBe(3)
    expect(povzetek.visjihPozicij).toBe(1)
    expect(povzetek.brezCeneN).toBe(0)
  })

  it('dva istonaslovna dobavitelja = RAZLIČNI resnici po id (identiteta — R260–R263 lekcija); sort IME ASC + id ASC izenačba', () => {
    const { vrste } = dobaviteljiPozicijaCen(CENE, BEST)
    expect(vrste.map((v) => v.id)).toEqual(['d1', 'd3', 'd2']) // Alu, Alu (id), Beton
    const obrnjeno = dobaviteljiPozicijaCen([...CENE].reverse(), BEST)
    expect(obrnjeno.vrste.map((v) => v.id)).toEqual(['d1', 'd3', 'd2']) // f(MNOŽICA)
    const enak = sortirajDobaviteljePozicija([
      { id: 'z', ime: 'X', ponudb: 1, najnizjih: 1, visjih: 0, povprecniOdstotek: null, najsirosiRazpon: 0 },
      { id: 'a', ime: 'X', ponudb: 1, najnizjih: 0, visjih: 1, povprecniOdstotek: 5, najsirosiRazpon: 5 },
    ])
    expect(enak.map((v) => v.id)).toEqual(['a', 'z']) // isti ime → id ASC
  })

  it('premešan vhod = ISTI povzetek (f(MNOŽICA)); najširši razpon max čez VSE vrstice', () => {
    const a = dobaviteljiPozicijaCen(CENE, BEST).povzetek
    const b = dobaviteljiPozicijaCen([CENE[3], CENE[1], CENE[2], CENE[0]], [BEST[1], BEST[0]]).povzetek
    expect(a).toEqual(b)
    const mešano = dobaviteljiPozicijaCen(
      [
        { inventoryId: 'a', cena: 150, dobaviteljId: 'd9', dobavitelj: 'Zadnji' },
        { inventoryId: 'a', cena: 110, dobaviteljId: 'd9', dobavitelj: 'Zadnji' },
      ],
      [{ inventoryId: 'a', bestPrice: 100, suppliers: 2 }],
    )
    expect(mešano.vrste[0].najsirosiRazpon).toBeCloseTo(50, 9) // max(50, 10)
    expect(mešano.vrste[0].povprecniOdstotek).toBeCloseTo(30, 9) // (50+10)/2
  })

  it('JOIN po IDENTITETI + brez-cene števec: best brez ujemajoče cene = poimenovano (race — R262 vzorec)', () => {
    const samoBest = dobaviteljiPozicijaCen(CENE, [...BEST, { inventoryId: 'x-tuj', bestPrice: 50, suppliers: 2 }])
    expect(samoBest.povzetek.brezCeneN).toBe(1)
    expect(samoBest.povzetek.artiklov).toBe(3)
  })
})

describe('R264 — fail-closed v libu (družina R236/R250–R263)', () => {
  it('prazen seznam cen ne nastaja dokumenta — TypeError s toast sporočilom komponente', () => {
    expect(() => buildDobaviteljiPozicijaPdfDoc([], BEST, { now: NOW })).toThrow(TypeError)
    expect(() => buildDobaviteljiPozicijaPdfDoc([], BEST, { now: NOW })).toThrow('prazen seznam cen ne nastaja dokumenta')
    expect(() => dobaviteljiPozicijaCen([], BEST)).toThrow('prazen seznam cen nima pozicij')
  })

  it('fail-closed ×12: JOIN brez best, min-invarianta (cena < best), bestPrice 0 (NIKOLI Infinity), ne-polji, ne-options, pokvaren now, prazni nizi, negativna cena, suppliers < 1 — indeks krivca', () => {
    const now = { now: NOW }
    expect(() => buildDobaviteljiPozicijaPdfDoc('ne-polje' as unknown as PozicijaCenaVnos[], BEST, now)).toThrow(TypeError)
    expect(() => buildDobaviteljiPozicijaPdfDoc(CENE, 'ne-polje' as unknown as PozicijaBestVnos[], now)).toThrow(TypeError)
    expect(() => buildDobaviteljiPozicijaPdfDoc(CENE, BEST, null as unknown as { now: Date })).toThrow(TypeError)
    expect(() => buildDobaviteljiPozicijaPdfDoc(CENE, BEST, { now: 'danes' as unknown as Date })).toThrow(TypeError)
    expect(() => buildDobaviteljiPozicijaPdfDoc(CENE, BEST, { now: new Date(NaN) })).toThrow(TypeError)
    expect(() => dobaviteljiPozicijaCen([{ inventoryId: 'tuj', cena: 10, dobaviteljId: 'd', dobavitelj: 'D' }], BEST)).toThrow('ponudba brez ujemajoče best vrstice')
    expect(() => dobaviteljiPozicijaCen([{ inventoryId: 'a', cena: 90, dobaviteljId: 'd', dobavitelj: 'D' }], BEST)).toThrow('bestPrice je MIN po konstrukciji')
    expect(() => dobaviteljiPozicijaCen([{ inventoryId: 'a', cena: 100, dobaviteljId: 'd', dobavitelj: 'D' }], [{ inventoryId: 'a', bestPrice: 0, suppliers: 1 }])).toThrow('razlika % ne obstaja')
    expect(() => preveriPozicijaCeno(null as unknown as PozicijaCenaVnos, 2)).toThrow('pričakovana ponudba')
    expect(() => preveriPozicijaCeno({ inventoryId: '', cena: 1, dobaviteljId: 'd', dobavitelj: 'D' }, 2)).toThrow('inventoryId mora biti ne-prazen niz')
    expect(() => preveriPozicijaCeno({ inventoryId: 'a', cena: -1, dobaviteljId: 'd', dobavitelj: 'D' }, 2)).toThrow('cena mora biti končno ne-negativno')
    expect(() => preveriPozicijaBest({ inventoryId: 'a', bestPrice: 1, suppliers: 0 }, 2)).toThrow('suppliers mora biti končno število ≥ 1')
    expect(() => preveriPozicijaBest({ inventoryId: 'a', bestPrice: NaN, suppliers: 1 }, 2)).toThrow('bestPrice mora biti končno ne-negativno')
    expect(() => preveriPozicijaCeno({ inventoryId: 'a', cena: 1, dobaviteljId: 'd', dobavitelj: '  ' }, 2)).toThrow('dobavitelj mora biti ne-prazen niz')
  })

  it('sklanjatev ponudbaBeseda (EN VIR — ISTI vzorec kot dobaviteljBeseda R248) + fail-closed ne-celo', () => {
    expect(ponudbaBeseda(0)).toBe('ponudb')
    expect(ponudbaBeseda(1)).toBe('ponudba')
    expect(ponudbaBeseda(2)).toBe('ponudbi')
    expect(ponudbaBeseda(3)).toBe('ponudbe')
    expect(ponudbaBeseda(4)).toBe('ponudbe')
    expect(ponudbaBeseda(5)).toBe('ponudb')
    expect(ponudbaBeseda(101)).toBe('ponudb')
    expect(() => ponudbaBeseda(1.5)).toThrow(TypeError)
    expect(() => ponudbaBeseda(-1)).toThrow(TypeError)
  })

  it('brat R263 NESPREMENJEN (soli 0x89–0x8c + bajtno zdrav)', () => {
    const r263Lib = beri('src/lib/stranke-pokritost-pdf.ts')
    expect(r263Lib).toContain('fnv1aHex(seed, 0x89)')
    expect(r263Lib).not.toContain('fnv1aHex(seed, 0x8d)')
    const doc = buildStrankePokritostPdfDoc(
      [{ id: 's', ime: 'S', naslov: 'N', status: 'AKTIVEN', kategorija: null, telefon: null, zadnjiKontakt: null, ltv: 1, opomnikStatus: 'NI' }],
      { now: NOW },
    )
    expect(Buffer.from(doc.output('arraybuffer')).subarray(0, 5).toString('ascii')).toBe('%PDF-')
  })
})

describe('R264 — WYSIWYG vir (tabela + KPI + sklep)', () => {
  it('tabela 6 stolpcev (Dobavitelj, Ponudb, Najnižjih, Višjih, Povprečni odstopek (%), Najširši razpon (%)) — head dobesedno', () => {
    expect(lib).toContain("['Dobavitelj', 'Ponudb', 'Najnižjih', 'Višjih', 'Povprečni odstopek (%)', 'Najširši razpon (%)']")
  })

  it('barvna resnica: višja pozicija AMBER bold (normalno stanje), najširši 0 % GREEN bold (vse najnižje), \'—\' sivo; NIKOLI utišan alarm', () => {
    const okno = oknoMed(lib, 'didParseCell:', '})\n  y =')
    expect(okno).toContain('textColor = AMBER')
    expect(okno).toContain('textColor = GREEN')
    expect(okno).toContain('textColor = GRAY')
  })

  it('KPI 5 boxov z signalnim jezikom (Brez alternative RED>0, Najnižjih GREEN, Višjih AMBER)', () => {
    expect(lib).toContain("'Dobaviteljev'")
    expect(lib).toContain("'Ponudb'")
    expect(lib).toContain("'Brez alternative'")
    expect(lib).toContain("'Najnižjih pozicij'")
    expect(lib).toContain("'Višjih pozicij'")
    expect(lib).toContain('povzetek.brezAlternative > 0 ? RED : NAVY')
    expect(lib).toContain('povzetek.visjihPozicij > 0 ? AMBER : NAVY')
  })

  it('sklep: izključitve/resnice poimenovane (brez alternative — ni primerjave; brez ujemajoče cene; formule)', () => {
    expect(lib).toContain('brez alternative')
    expect(lib).toContain('samo ena ponudba — ni primerjave')
    expect(lib).toContain('brez ujemajoče cene')
    expect(lib).toContain("('—' = vse najnižje)")
  })

  it('glava DOBAVITELJI — POZICIJA CEN + osveženo + noge Stran i/N', () => {
    expect(lib).toContain("'DOBAVITELJI — POZICIJA CEN'")
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

describe('R264 — komponenta (material-intelligence-tab) — pill, legenda, handler', () => {
  it('pill VEDNO viden (bralni dokument, P1-k precedens) + press-scale + FileText aria-hidden + dvoklik guard — pariteta R244/R245', () => {
    const okno = oknoMed(komponenta, 'onClick={handlePozicijaPdf}', '</Button>')
    expect(okno).toContain('press-scale')
    expect(okno).toContain('FileText')
    expect(okno).toContain('aria-hidden="true"')
    expect(okno).toContain('disabled={loading || pozicijaVTeku}')
    expect(okno).toContain('focus-visible:ring-2')
  })

  it('legenda substring-parna nadgradna (R260 lekcija 3): stara R245 resnica dobesedno + nova R264 append — NIČ starega pina zlomljenega', () => {
    expect(komponenta).toContain('Cenik = vse ponudbe · Primerjalni = najnižja per artikel · % = razpon do najvišje · Povprečni razpon = vsota razlik / vsota najboljših · Največji razpon = najširši % med artikli')
    expect(komponenta).toContain('· Pozicija = dobavitelji × najnižja per artikel · Brez alternative = samo ena ponudba')
  })

  it('handler: ENA izpeljava dobaviteljiPozicijaCen nad ISTIMI vhodi kot PDF build (WYSIWYG — fresh fetch, ni state-a), EN now, fail-closed toast pri 0 cen, TypeError viden razlog, dvoklik guard, FRESH fetch ISTEGA endpointa (NIČ nove mreže)', () => {
    const okno = oknoMed(komponenta, 'const handlePozicijaPdf', 'return (')
    expect(okno).toContain('if (pozicijaVTeku) return')
    expect(okno).toContain("title: 'Ni vpisanih cen'")
    expect(okno).toContain("'Pozicija dobaviteljev se izvozi, ko je vpisana prva nabavna cena.'")
    expect(okno).toContain('buildDobaviteljiPozicijaPdfDoc(ceny, najboljse, { now })')
    expect(okno).toContain('const { povzetek } = dobaviteljiPozicijaCen(ceny, najboljse)')
    expect(okno).toContain('dobaviteljiPozicijaPdfFilename(now)')
    expect(okno).toContain("title: 'Pozicija dobaviteljev prenešena v PDF'")
    expect(okno).toContain("variant: 'destructive'")
    expect((komponenta.match(/dobaviteljiPozicijaCen\(/g) ?? []).length).toBeGreaterThanOrEqual(1)
  })

  it('pridobiPozicijo: DTO pruning z fail-verbose preverbo (prices vrstica brez supplier/inventoryId/cena → TypeError; bestPerMaterial brez polj → TypeError) — nič tihe degradacije', () => {
    const okno = oknoMed(komponenta, 'const pridobiPozicijo', 'const handlePozicijaPdf')
    expect(okno).toContain('manjkajoč dobavitelj (supplier.id/naziv) v odgovoru API-ja')
    expect(okno).toContain('manjkajoči inventoryId/cena v odgovoru API-ja')
    expect(okno).toContain('manjkajoči inventoryId/bestPrice/suppliers v odgovoru API-ja')
    expect(okno).toContain("GET /api/material-prices → HTTP ${res.status}")
    expect(okno).toContain("fetch('/api/material-prices')")
  })

  it('0 novih hex (žetoni samo — družinsko pravilo R224–R263)', () => {
    const hexi = komponenta.match(/#[0-9a-fA-F]{6}\b/g) ?? []
    const znani = new Set(['2a3f5f', '1d2b3e'])
    for (const h of hexi) expect(znani.has(h.slice(1).toLowerCase())).toBe(true)
  })
})
