// ---------------------------------------------------------------------------
// R333 — DOBAVITELJI — POZICIJA CEN CSV (60. člen issue #1 'izvozi' družine)
// — CSV brat PDF R264. Dokazi:
//  • glava = VERBATIM PDF autoTable head R264 (6 stolpcev);
//  • vrstice = preverba + JOIN + min-invarianta + agregat + sort EN VIR
//    (dobaviteljiPozicijaCen uvožena iz PDF brata — ISTA sekvenca kot
//    buildDobaviteljiPozicijaPdfDoc; odstotekNiz EN VIR — WYSIWYG po
//    konstrukciji: celice = ISTI izpisi kot PDF body, '—' iskren odpad pri
//    povprečnem odstotku vseh najnižjih, najširši razpon VEDNO definiran);
//  • meta vrstice (Obseg / KPI peterica ISTI izpisi kot PDF kpiBox / Sklep
//    VERBATIM / Izvoženo ob) — kanon R172→R296;
//  • ANTI-DIVERGENCA nad REALNIMA VIRI: CSV Sklep segmenti = dobesedno ISTI
//    segmenti kot PDF doc.text sklep + CSV glava = dobesedno ISTA polja kot
//    PDF autoTable head — tihe spremembe enega brata NE gredo skozi (vzorec
//    R330/R331/R332);
//  • determinizem: premešan vhod = bajtno isti CSV (f(MNOŽICA));
//  • fail-closed: prazen seznam cen / pokvaren vnos / JOIN / min-invarianta /
//    bestPrice 0 / pokvaren now / ne-polje → TypeError (podedovano iz EN
//    VIR);
//  • STRAŽAR nad REALNIM material-intelligence-tab: ENA izpeljava
//    pridobiPozicijo (×3 — definicija + OBA brata), pill, MIME resnica,
//    dvoklik guard, fail-closed toast, definicijski naslov — tihe
//    odstranitve NE gredo skozi.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  pozicijaDobaviteljevCsvVrstice,
  pozicijaDobaviteljevCsv,
  pozicijaDobaviteljevCsvFilename,
  pozicijaDobaviteljevCsvSklep,
  pozicijaDobaviteljevCsvVrstica,
  POZICIJA_DOBAVITELJEV_CSV_GLAVA,
} from '../dobavitelji-pozicija-csv'
import {
  dobaviteljiPozicijaCen,
  odstotekNiz,
  type PozicijaCenaVnos,
  type PozicijaBestVnos,
} from '../dobavitelji-pozicija-pdf'

const komponenta = readFileSync(
  resolve(__dirname, '../../../src/components/roksal/material-intelligence-tab.tsx'),
  'utf8',
)
const pdfVir = readFileSync(
  resolve(__dirname, '../dobavitelji-pozicija-pdf.ts'),
  'utf8',
)
const csvVir = readFileSync(
  resolve(__dirname, '../dobavitelji-pozicija-csv.ts'),
  'utf8',
)

/** FIXED now (determinizem — žig + ime; ISTI vzorec kot r330/r331/r332). */
const NOW: Date = new Date('2026-10-01T08:00:00.000Z')

// 5 ponudb × 2 artikla × 3 dobavitelji — VSA iskrena resnica:
//  • a1: best 100 (3 ponudbe) — Alfa 100 najnižja, Beta 100 najnižja
//    (istocenovna = obadva najnižja, iskreno), Gama 120 višja 20,0 %;
//  • a2: best 100 (2 ponudbi) — Alfa 110 višja 10,0 %, Beta 100 najnižja.
// Agregati: Alfa 2/1/1 → povprečni 10,0 · najširši 10,0; Beta 2/2/0 →
// '—' · 0,0; Gama 1/0/1 → 20,0 · 20,0. Sort IME ASC: Alfa, Beta, Gama.
const CENY: PozicijaCenaVnos[] = [
  { inventoryId: 'a1', cena: 100, dobaviteljId: 'd2', dobavitelj: 'Dobavitelj Beta' },
  { inventoryId: 'a1', cena: 120, dobaviteljId: 'd3', dobavitelj: 'Dobavitelj Gama' },
  { inventoryId: 'a1', cena: 100, dobaviteljId: 'd1', dobavitelj: 'Dobavitelj Alfa' },
  { inventoryId: 'a2', cena: 110, dobaviteljId: 'd1', dobavitelj: 'Dobavitelj Alfa' },
  { inventoryId: 'a2', cena: 100, dobaviteljId: 'd2', dobavitelj: 'Dobavitelj Beta' },
]
const NAJBOLJSE: PozicijaBestVnos[] = [
  { inventoryId: 'a1', bestPrice: 100, suppliers: 3 },
  { inventoryId: 'a2', bestPrice: 100, suppliers: 2 },
]

describe('R333 — glava + struktura (VERBATIM)', () => {
  it('glava = VERBATIM PDF autoTable head R264 (6 stolpcev)', () => {
    expect(POZICIJA_DOBAVITELJEV_CSV_GLAVA).toEqual([
      'Dobavitelj', 'Ponudb', 'Najnižjih', 'Višjih', 'Povprečni odstopek (%)', 'Najširši razpon (%)',
    ])
  })

  it('ANTI-DIVERGENCA: PDF vir res nosi točno TO autoTable head (tiha glava-sprememba brata NE gre skozi)', () => {
    expect(pdfVir).toContain(
      "head: [['Dobavitelj', 'Ponudb', 'Najnižjih', 'Višjih', 'Povprečni odstopek (%)', 'Najširši razpon (%)']],",
    )
  })

  it('vrstice v referenčnem redu — ISTI sort EN VIR (IME ASC, izenačba id ASC; referenčni pregled, ne rangiranje)', () => {
    const vrstice = pozicijaDobaviteljevCsvVrstice(CENY, NAJBOLJSE, NOW)
    const podatkovne = vrstice.slice(1, 4)
    expect(podatkovne[0]).toContain('"Dobavitelj Alfa"')
    expect(podatkovne[1]).toContain('"Dobavitelj Beta"')
    expect(podatkovne[2]).toContain('"Dobavitelj Gama"')
    // sort identičen klicu PDF brata (EN VIR — vrste iz dobaviteljiPozicijaCen)
    expect(dobaviteljiPozicijaCen(CENY, NAJBOLJSE).vrste.map((v) => v.ime)).toEqual([
      'Dobavitelj Alfa', 'Dobavitelj Beta', 'Dobavitelj Gama',
    ])
  })

  it('determinizem: premešan vhod = bajtno isti CSV (f(MNOŽICA))', () => {
    const a = pozicijaDobaviteljevCsv(CENY, NAJBOLJSE, NOW).csv
    const premesano = [CENY[3], CENY[0], CENY[4], CENY[2], CENY[1]]
    const b = pozicijaDobaviteljevCsv(premesano, NAJBOLJSE, NOW).csv
    expect(b).toBe(a)
  })
})

describe('R333 — celice = EN VIR izpeljava (WYSIWYG vs PDF R264)', () => {
  it('Alfa: številke String + povprečni odstopek odstotekNiz EN VIR (10,0 — vejica) + najširši razpon 10,0', () => {
    const vrstice = pozicijaDobaviteljevCsvVrstice(CENY, NAJBOLJSE, NOW)
    const alfa = vrstice.find((v) => v.includes('"Dobavitelj Alfa"')) as string
    // pričakovanja IZ EN VIR funkcij (lekcija R295 — ne iz glave)
    expect(alfa).toBe('"Dobavitelj Alfa","2","1","1","10,0","10,0"')
    expect(odstotekNiz(10.0)).toBe('10,0')
  })

  it('iskrene veje: Beta vse najnižje → povprečni "—" (prazna množica, NIKOLI 0) + razpon "0,0" (iskrena resnica); Gama 20,0', () => {
    const vrstice = pozicijaDobaviteljevCsvVrstice(CENY, NAJBOLJSE, NOW)
    const beta = vrstice.find((v) => v.includes('"Dobavitelj Beta"')) as string
    expect(beta).toBe('"Dobavitelj Beta","2","2","0","—","0,0"')
    const gama = vrstice.find((v) => v.includes('"Dobavitelj Gama"')) as string
    expect(gama).toBe('"Dobavitelj Gama","1","0","1","20,0","20,0"')
  })

  it('pozicijaDobaviteljevCsvVrstica fail-closed: ne-objekt vrsta → TypeError z imenom graditelja', () => {
    expect(() => pozicijaDobaviteljevCsvVrstica(null as unknown as Parameters<typeof pozicijaDobaviteljevCsvVrstica>[0])).toThrowError(TypeError)
    expect(() => pozicijaDobaviteljevCsvVrstica(null as unknown as Parameters<typeof pozicijaDobaviteljevCsvVrstica>[0])).toThrowError(/pozicijaDobaviteljevCsvVrstica/)
  })

  it('meta vrstice: Obseg + KPI peterica = ISTI izpisi kot PDF kpiBox (Dobaviteljev / Ponudb / Brez alternative / Najnižjih pozicij / Višjih pozicij) + Izvoženo ob ISO', () => {
    const vrstice = pozicijaDobaviteljevCsvVrstice(CENY, NAJBOLJSE, NOW)
    const pov = dobaviteljiPozicijaCen(CENY, NAJBOLJSE).povzetek
    expect(vrstice.some((v) => v.startsWith('"Obseg","Vsi dobavitelji z vsaj eno veljavno ponudbo iz /api/material-prices'))).toBe(true)
    expect(vrstice).toContain(`"Dobaviteljev","${pov.dobaviteljev}"`)
    expect(vrstice).toContain(`"Ponudb","${pov.ponudb}"`)
    expect(vrstice).toContain(`"Brez alternative","${pov.brezAlternative}"`)
    expect(vrstice).toContain(`"Najnižjih pozicij","${pov.najnizjihPozicij}"`)
    expect(vrstice).toContain(`"Višjih pozicij","${pov.visjihPozicij}"`)
    // eksakt po konstrukciji: 3 dobavitelji, 5 ponudb, 3 najnižje, 2 višji
    expect(pov.dobaviteljev).toBe(3)
    expect(pov.ponudb).toBe(5)
    expect(pov.najnizjihPozicij).toBe(3)
    expect(pov.visjihPozicij).toBe(2)
    expect(vrstice[vrstice.length - 1]).toBe(`"Izvoženo ob","${NOW.toISOString()}"`)
  })

  it('Sklep = VERBATIM PDF sklepu (ISTI segmenti kot doc.text R264 — brez alternative/najnižjih/višjih/vir poimenovan)', () => {
    const pov = dobaviteljiPozicijaCen(CENY, NAJBOLJSE).povzetek
    const sklep = pozicijaDobaviteljevCsvSklep(pov)
    expect(sklep).toContain(`${pov.dobaviteljev} dobaviteljev · ${pov.ponudb} veljavnih ponudb za ${pov.artiklov} artiklov · brez alternative ${pov.brezAlternative}`)
    expect(sklep.endsWith("(poimenovano) · vir = /api/material-prices.")).toBe(true)
  })

  it('ANTI-DIVERGENCA: Sklep dobesedni segmenti = ISTI kot PDF vir doc.text (tiha sprememba enega brata NE gre skozi)', () => {
    const sklepSegmenti = [
      ' dobaviteljev · ',
      ' veljavnih ponudb za ',
      ' artiklov · brez alternative ',
      ' (samo ena ponudba — ni primerjave) · najnižjih pozicij ',
      " · povprečni odstopek = razlika % čez višje vrstice ('—' = vse najnižje) · najširši razpon = max razlika % čez vse vrstice · brez ujemajoče cene ",
      ' (poimenovano) · vir = /api/material-prices.',
    ]
    for (const seg of sklepSegmenti) {
      expect(pdfVir).toContain(seg)
    }
  })

  it('ANTI-DIVERGENCA: CSV lib res UVAŽA projekcijo PDF brata (odstotekNiz EN VIR — nič podvojenega formatiranja)', () => {
    expect(csvVir).toContain("from './dobavitelji-pozicija-pdf'")
    expect(csvVir).toContain('odstotekNiz,')
    expect(csvVir).toContain('odstotekNiz(v.povprecniOdstotek)')
    expect(csvVir).toContain('odstotekNiz(v.najsirosiRazpon)')
  })

  it('format: BOM + \'\\n\' zaključki + vrstic = 1 glava + 3 podatkovne + 9 meta (prazna ločnica + 8 poimenovanih)', () => {
    const { csv, vrstic } = pozicijaDobaviteljevCsv(CENY, NAJBOLJSE, NOW)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    const vrstice = csv.slice(1).split('\n')
    expect(vrstic).toBe(13)
    // družina CSV: BREZ trailing '\n' (zadnja vrstica = 'Izvoženo ob')
    expect(vrstice).toHaveLength(13)
    expect(vrstice[vrstice.length - 1]).toBe(`"Izvoženo ob","${NOW.toISOString()}"`)
  })

  it('deterministično ime: Pozicija-dobaviteljev-YYYY-MM-DD.csv (bratska simetrija z PDF imenom R264)', () => {
    expect(pozicijaDobaviteljevCsvFilename(NOW)).toBe('Pozicija-dobaviteljev-2026-10-01.csv')
    // ANTI-DIVERGENCA: PDF brat res nosi bratsko ime (isti prefix, .pdf)
    expect(pdfVir).toContain('`Pozicija-dobaviteljev-${todayStamp(now)}.pdf`')
  })

  it('brez-alternativa + brez-ujemajoče-cene resnica (best vrstica brez cene — race/vlogsko zožen, poimenovano v Sklepu)', () => {
    const najboljseRazsirjeno: PozicijaBestVnos[] = [...NAJBOLJSE, { inventoryId: 'a3', bestPrice: 50, suppliers: 1 }]
    const pov = dobaviteljiPozicijaCen(CENY, najboljseRazsirjeno).povzetek
    expect(pov.artiklov).toBe(3)
    expect(pov.brezAlternative).toBe(1)
    expect(pov.brezCeneN).toBe(1)
    const vrstice = pozicijaDobaviteljevCsvVrstice(CENY, najboljseRazsirjeno, NOW)
    expect(vrstice).toContain('"Brez alternative","1"')
    const sklepVrstica = vrstice.find((v) => v.startsWith('"Sklep"')) as string
    expect(sklepVrstica).toContain('brez alternative 1')
    expect(sklepVrstica).toContain('brez ujemajoče cene 1')
  })
})

describe('R333 — fail-closed (podedovano iz EN VIR preverba/JOIN/invarianta + now)', () => {
  it('fail-closed ×8: prazen ceny / ne-polje ceny / ne-polje najboljse / pokvaren now ×2 / JOIN brez best / cena < best / bestPrice 0', () => {
    expect(() => pozicijaDobaviteljevCsv([], NAJBOLJSE, NOW)).toThrowError(/prazen seznam cen nima pozicij/)
    expect(() => pozicijaDobaviteljevCsv('ne-polje' as unknown as PozicijaCenaVnos[], NAJBOLJSE, NOW)).toThrowError(TypeError)
    expect(() => pozicijaDobaviteljevCsv(CENY, 'ne-polje' as unknown as PozicijaBestVnos[], NOW)).toThrowError(TypeError)
    expect(() => pozicijaDobaviteljevCsv(CENY, NAJBOLJSE, new Date('neveljaven'))).toThrowError(TypeError)
    expect(() => pozicijaDobaviteljevCsvVrstice(CENY, NAJBOLJSE, new Date('neveljaven'))).toThrowError(TypeError)
    const brezBest = [{ inventoryId: 'aX', cena: 100, dobaviteljId: 'd1', dobavitelj: 'Dobavitelj Alfa' }]
    expect(() => pozicijaDobaviteljevCsv(brezBest, NAJBOLJSE, NOW)).toThrowError(/ponudba brez ujemajoče best vrstice/)
    const podBest = [{ inventoryId: 'a1', cena: 90, dobaviteljId: 'd1', dobavitelj: 'Dobavitelj Alfa' }]
    expect(() => pozicijaDobaviteljevCsv(podBest, NAJBOLJSE, NOW)).toThrowError(/bestPrice je MIN po konstrukciji/)
    const bestNula: PozicijaBestVnos[] = [{ inventoryId: 'a1', bestPrice: 0, suppliers: 1 }]
    const cenaNula = [{ inventoryId: 'a1', cena: 0, dobaviteljId: 'd1', dobavitelj: 'Dobavitelj Alfa' }]
    expect(() => pozicijaDobaviteljevCsv(cenaNula, bestNula, NOW)).toThrowError(/razlika % ne obstaja/)
  })
})

describe('R333 — STRAŽAR: CSV povezava v material-intelligence-tab (tihe odstranitve NE gredo skozi)', () => {
  it('tab uvaža CSV brata + ENA izpeljava preseka (pridobiPozicijo EN VIR — definicija ×1 + OBA brata ×2)', () => {
    expect(komponenta).toContain("from '@/lib/dobavitelji-pozicija-csv'")
    expect(komponenta).toContain('pozicijaDobaviteljevCsv(ceny, najboljse, now)')
    expect(komponenta).toContain('pozicijaDobaviteljevCsvFilename(now)')
    // EN VIR: ENA definicija izpeljave + DVA klica (PDF brat + CSV brat) —
    // NIČ dvojnega preseka (NIČ dvojnega fetcha / preslikave odgovora).
    expect((komponenta.match(/const pridobiPozicijo = useCallback\(/g) ?? []).length).toBe(1)
    expect((komponenta.match(/await pridobiPozicijo\(\)/g) ?? []).length).toBe(2)
  })

  it('pill + MIME resnica (downloadCsvText) + dvoklik guard + fail-closed toast', () => {
    expect(komponenta).toContain('aria-label="Izvozi pozicijo dobaviteljev kot CSV"')
    expect(komponenta).toContain('data-testid="pozicija-dobaviteljev-csv-pill"')
    expect(komponenta).toContain('pozicijaCsvVTeku')
    expect(komponenta).toContain("title: 'Ni vpisanih cen', description: 'CSV se izvozi, ko je vpisana prva nabavna cena.'")
    expect(komponenta).toContain("title: 'Pozicija dobaviteljev prenešena v CSV'")
  })

  it('definicijski naslov (MANDATORY STIL): izrečena pravila + razlika medija + iskren fail-closed', () => {
    expect(komponenta).toContain(
      'title="Pozicija dobaviteljev kot CSV — isti pregled, vrstni red in odstotki kot PDF (prazen seznam → iskren toast, nikoli prazna datoteka). PDF = tisk za pogajanja, CSV = Excel za filtriranje po dobavitelju"',
    )
  })

  it('legenda medija (nov podpis R333): Pozicija CSV imenovana ob PDF bratu + starejši segmenti NEPREMIKNJENI', () => {
    expect(komponenta).toContain('· Brez alternative = samo ena ponudba · Pozicija CSV = ista pozicijska resnica kot PDF (Excel)')
    expect(komponenta).toContain('Cenik = vse ponudbe · Primerjalni = najnižja per artikel')
  })
})
