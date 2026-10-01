// ---------------------------------------------------------------------------
// R331 — PONUDBE — SPOMNIKI CSV (58. člen issue #1 'izvozi' družine) — CSV
// brat PDF R267. Dokazi:
//  • glava = VERBATIM PDF autoTable head R267 (8 stolpcev);
//  • vrstice = ponudbeSpomnikiPregled EN VIR (preverba + projekcija +
//    akcijski sort + povzetek) — WYSIWYG po konstrukciji (celice = ISTI
//    izpisi kot PDF body: status label R161, spomnik/montaža po
//    cenikDatumIso EN VIR, '—' iskren odpad, podpisano/odprto);
//  • meta vrstice (Obseg/števci ×12/Sklep VERBATIM/Izvoženo ob) — kanon
//    R172→R296;
//  • ANTI-DIVERGENCA nad REALNIMA VIRI: CSV Sklep segmenti = dobesedno ISTI
//    segmenti kot PDF doc.text sklep (stanjeSklep oznake + statusi R161) +
//    CSV glava = dobesedno ISTA polja kot PDF autoTable head — tihe
//    spremembe enega brata NE gredo skozi (vzorec R330);
//  • determinizem: premešan vhod = bajtno isti CSV (f(MNOŽICA));
//  • fail-closed: prazen seznam / pokvaren status / dealLocked / podvojen
//    id / pokvaren now / ne-polje → TypeError (podedovano iz EN VIR);
//  • STRAŽAR nad REALNIM quote-followup: ENA izpeljava vira
//    (pridobiPonudbeSpomnikiVnosi ×2 — oba brata), pill, MIME resnica,
//    dvoklik guard, fail-closed toast, definicijski naslov — tihe
//    odstranitve NE gredo skozi.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  ponudbeSpomnikiCsvVrstice,
  ponudbeSpomnikiCsv,
  ponudbeSpomnikiCsvFilename,
  ponudbeSpomnikiCsvSklep,
  ponudbeSpomnikiCsvVrstica,
  PONUDBE_SPOMNIKI_CSV_GLAVA,
} from '../ponudbe-spomniki-csv'
import {
  ponudbeSpomnikiPregled,
  type PonudbaSpomnikiVnos,
} from '../ponudbe-spomniki-pdf'
import { PONUDBE_STATUS_LABELS, ponudbeLabel } from '../ponudbe-csv'
import { cenikDatumIso } from '../cenik-pdf'

const komponenta = readFileSync(
  resolve(__dirname, '../../../src/components/roksal/quote-followup.tsx'),
  'utf8',
)
const pdfVir = readFileSync(
  resolve(__dirname, '../ponudbe-spomniki-pdf.ts'),
  'utf8',
)

/** FIXED now (determinizem — DANES za stanja spomnika + žig + ime; ISTI
 *  vzorec kot r330/r297/r267). */
const NOW: Date = new Date('2026-10-01T08:00:00.000Z')

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

// 6 ponudb — VSA iskrena stanja: Zapadel (o1, RED akcija), Danes (o2, NAVY),
// Kmalu (o3, AMBER), Planirano (o6, >3 dni), Brez spomnika (o4, sivo),
// podpisana (o5, zgodovinska cona — kljub Zapadel spomniku NE šteje v
// akcijske števce).
const PONUDBE: PonudbaSpomnikiVnos[] = [
  ponudba({ id: 'o1', nazivProjekta: 'Ponudba Alfa', stranka: 'Stranka A d.o.o.', followUpDate: '2026-09-01T00:00:00.000Z', followUpOpomba: 'Pokliči glede balustrade', datumMontaze: '2026-11-01T00:00:00.000Z' }),
  ponudba({ id: 'o2', nazivProjekta: 'Ponudba Beta', followUpDate: '2026-10-01T00:00:00.000Z' }),
  ponudba({ id: 'o3', nazivProjekta: 'Ponudba Gama', followUpDate: '2026-10-03T00:00:00.000Z', followUpOpomba: 'Sledenje +3' }),
  ponudba({ id: 'o4', nazivProjekta: 'Ponudba Delta' }),
  ponudba({ id: 'o5', nazivProjekta: 'Ponudba Epsilona', stranka: 'Stranka B', dealLocked: true, followUpDate: '2026-08-01T00:00:00.000Z', status: 'V_TEKU' }),
  ponudba({ id: 'o6', nazivProjekta: 'Ponudba Zeta', followUpDate: '2026-10-20T00:00:00.000Z' }),
]

describe('R331 — glava + struktura (VERBATIM)', () => {
  it('glava = VERBATIM PDF autoTable head R267 (8 stolpcev)', () => {
    expect(PONUDBE_SPOMNIKI_CSV_GLAVA).toEqual([
      'Projekt', 'Stranka', 'Status', 'Spomnik', 'Stanje', 'Opomba', 'Montaža', 'Podpis',
    ])
  })

  it('ANTI-DIVERGENCA: PDF vir res nosi točno TO autoTable head (tiha glava-sprememba brata NE gre skozi)', () => {
    expect(pdfVir).toContain(
      "head: [['Projekt', 'Stranka', 'Status', 'Spomnik', 'Stanje', 'Opomba', 'Montaža', 'Podpis']],",
    )
  })

  it('vrstice v akcijskem redu — ISTA f(MNOŽICA) kot ponudbeSpomnikiPregled EN VIR (odprte najstarejši spomnik prvi, podpisana zgodovina na dnu)', () => {
    const vrstice = ponudbeSpomnikiCsvVrstice(PONUDBE, NOW)
    const podatkovne = vrstice.slice(1, 7)
    // odprte: spomnik ASC (o1 09-01, o2 10-01, o3 10-03, o6 10-20, o4 null ZADNJI), podpisana o5 ZADNJA
    expect(podatkovne[0]).toContain('"Ponudba Alfa"')
    expect(podatkovne[1]).toContain('"Ponudba Beta"')
    expect(podatkovne[2]).toContain('"Ponudba Gama"')
    expect(podatkovne[3]).toContain('"Ponudba Zeta"')
    expect(podatkovne[4]).toContain('"Ponudba Delta"')
    expect(podatkovne[5]).toContain('"Ponudba Epsilona"')
    // sort identičen klicu PDF brata (EN VIR)
    expect(ponudbeSpomnikiPregled(PONUDBE, NOW).vrste.map((v) => v.naziv)).toEqual([
      'Ponudba Alfa', 'Ponudba Beta', 'Ponudba Gama', 'Ponudba Zeta', 'Ponudba Delta', 'Ponudba Epsilona',
    ])
  })

  it('determinizem: premešan vhod = bajtno isti CSV (f(MNOŽICA))', () => {
    const a = ponudbeSpomnikiCsv(PONUDBE, NOW).csv
    const premesano = [PONUDBE[3], PONUDBE[0], PONUDBE[4], PONUDBE[2], PONUDBE[1], PONUDBE[5]]
    const b = ponudbeSpomnikiCsv(premesano, NOW).csv
    expect(b).toBe(a)
  })
})

describe('R331 — celice = EN VIR izpeljava (WYSIWYG vs PDF R267)', () => {
  it('o1 Alfa: status label EN VIR + spomnik cenikDatumIso + stanje Zapadel + opomba + montaža', () => {
    const vrstice = ponudbeSpomnikiCsvVrstice(PONUDBE, NOW)
    const o1 = vrstice.find((v) => v.includes('"Ponudba Alfa"')) as string
    // pričakovanja IZ EN VIR funkcij (lekcija R295 — ne iz glave)
    expect(o1).toContain(`"${PONUDBE_STATUS_LABELS.NACRTOVANO}"`)
    expect(o1).toContain(`"${cenikDatumIso('2026-09-01T00:00:00.000Z')}"`)
    expect(o1).toContain('"Zapadel"')
    expect(o1).toContain('"Pokliči glede balustrade"')
    expect(o1).toContain(`"${cenikDatumIso('2026-11-01T00:00:00.000Z')}"`)
    expect(o1).toContain('"odprto"')
  })

  it('iskrene veje: stranka "—" (o2) · opomba "—" (o2) · montaža "—" (o2) · Danes/Kmalu (o2/o3) · podpisano (o5)', () => {
    const vrstice = ponudbeSpomnikiCsvVrstice(PONUDBE, NOW)
    const o2 = vrstice.find((v) => v.includes('"Ponudba Beta"')) as string
    expect(o2).toContain('"—"') // stranka null
    expect(o2).toContain('"Danes"') // spomnik = danes (NOW)
    const o3 = vrstice.find((v) => v.includes('"Ponudba Gama"')) as string
    expect(o3).toContain('"Kmalu"')
    const o5 = vrstice.find((v) => v.includes('"Ponudba Epsilona"')) as string
    expect(o5).toContain('"podpisano"')
    expect(o5).toContain(`"${PONUDBE_STATUS_LABELS.V_TEKU}"`)
  })

  it('ponudbeSpomnikiCsvVrstica fail-closed: ne-objekt vrsta → TypeError z imenom graditelja', () => {
    expect(() => ponudbeSpomnikiCsvVrstica(null as unknown as Parameters<typeof ponudbeSpomnikiCsvVrstica>[0])).toThrowError(TypeError)
    expect(() => ponudbeSpomnikiCsvVrstica(null as unknown as Parameters<typeof ponudbeSpomnikiCsvVrstica>[0])).toThrowError(/ponudbeSpomnikiCsvVrstica/)
  })

  it('meta vrstice: Obseg + števci ×12 = povzetek EN VIR (podpisana NE šteje v akcijske števce) + Izvoženo ob ISO', () => {
    const vrstice = ponudbeSpomnikiCsvVrstice(PONUDBE, NOW)
    const { povzetek } = ponudbeSpomnikiPregled(PONUDBE, NOW)
    expect(vrstice.some((v) => v.startsWith('"Obseg","Vse ponudbe iz /api/projects'))).toBe(true)
    expect(vrstice).toContain(`"Ponudb","${povzetek.ponudb}"`)
    expect(vrstice).toContain(`"Odprtih","${povzetek.odprtih}"`)
    expect(vrstice).toContain(`"Podpisanih","${povzetek.podpisanih}"`)
    expect(vrstice).toContain(`"Zapadel spomnik (odprte)","${povzetek.zapadelOprtih}"`)
    expect(vrstice).toContain(`"Spomnik danes (odprte)","${povzetek.danesOprtih}"`)
    expect(vrstice).toContain(`"Kmalu 1–3 dni (odprte)","${povzetek.kmaluOprtih}"`)
    expect(vrstice).toContain(`"Odprtih brez spomnika","${povzetek.brezSpomnikaOprtih}"`)
    expect(vrstice).toContain(`"Načrtovano","${povzetek.nacrtovanih}"`)
    expect(vrstice).toContain(`"V teku","${povzetek.vTeku}"`)
    expect(vrstice).toContain(`"Zaključeno","${povzetek.zakljucenih}"`)
    expect(vrstice).toContain(`"Ustavljeno","${povzetek.ustavljenih}"`)
    // iskrena resnica: podpisana o5 z zapadelim spomnikom NE šteje v zapadelOprtih
    expect(povzetek.zapadelOprtih).toBe(1)
    expect(povzetek.podpisanih).toBe(1)
    expect(vrstice[vrstice.length - 1]).toBe(`"Izvoženo ob","${NOW.toISOString()}"`)
  })

  it('Sklep = VERBATIM PDF sklepu (ISTI segmenti kot doc.text R267 — cone + stanja + statusi poimenovani)', () => {
    const { vrste, povzetek } = ponudbeSpomnikiPregled(PONUDBE, NOW)
    const sklep = ponudbeSpomnikiCsvSklep(vrste, povzetek)
    expect(sklep).toContain(`${povzetek.ponudb} ${ponudbeLabel(povzetek.ponudb)} · odprtih ${povzetek.odprtih} (akcijska cona) · podpisanih ${povzetek.podpisanih} (zgodovinska cona)`)
    expect(sklep).toContain('Zapadel spomnik (akcija) 1')
    expect(sklep).toContain('spomnik danes (akcija) 1')
    expect(sklep).toContain('kmalu (1–3 dni) 1')
    expect(sklep).toContain('planirano 1')
    expect(sklep).toContain('brez spomnika (iskren odpad — akcija) 1')
    expect(sklep).toContain(`statusi: ${PONUDBE_STATUS_LABELS.NACRTOVANO} ${povzetek.nacrtovanih} / ${PONUDBE_STATUS_LABELS.V_TEKU} ${povzetek.vTeku} / ${PONUDBE_STATUS_LABELS.ZAKLJUCENO} ${povzetek.zakljucenih} / ${PONUDBE_STATUS_LABELS.USTAVLJENO} ${povzetek.ustavljenih}`)
    expect(sklep.endsWith('(referenčni pregled — VSE ponudbe, tudi podpisane) · vir = /api/projects (resnica vloge — polna resnica, ne samo viden seznam).')).toBe(true)
  })

  it('ANTI-DIVERGENCA: Sklep dobesedni segmenti = ISTI kot PDF vir doc.text (tiha sprememba enega brata NE gre skozi)', () => {
    const sklepSegmenti = [
      ' (akcijska cona) · podpisanih ',
      ' (zgodovinska cona) · odprte: ',
      "return 'Zapadel spomnik (akcija)'",
      "return 'spomnik danes (akcija)'",
      "return 'kmalu (1–3 dni)'",
      "return 'planirano'",
      "return 'brez spomnika (iskren odpad — akcija)'",
      ' (referenčni pregled — VSE ponudbe, tudi podpisane) · vir = /api/projects (resnica vloge — polna resnica, ne samo viden seznam).',
    ]
    for (const seg of sklepSegmenti) {
      expect(pdfVir).toContain(seg)
    }
  })

  it('format: BOM + \'\\n\' zaključki + vrstic = 1 glava + 6 podatkovnih + 15 meta', () => {
    const { csv, vrstic } = ponudbeSpomnikiCsv(PONUDBE, NOW)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    const vrstice = csv.slice(1).split('\n')
    expect(vrstic).toBe(22)
    // družina CSV: BREZ trailing '\n' (zadnja vrstica = 'Izvoženo ob')
    expect(vrstice).toHaveLength(22)
    expect(vrstice[vrstice.length - 1]).toBe(`"Izvoženo ob","${NOW.toISOString()}"`)
  })

  it('deterministično ime: Ponudbe-spomniki-YYYY-MM-DD.csv (bratska simetrija z PDF imenom R267)', () => {
    expect(ponudbeSpomnikiCsvFilename(NOW)).toBe('Ponudbe-spomniki-2026-10-01.csv')
  })
})

describe('R331 — fail-closed (podedovano iz EN VIR ponudbeSpomnikiPregled + now)', () => {
  it('fail-closed ×6: prazen / ne-polje / pokvaren now / podvojen id / pokvaren status / pokvaren dealLocked', () => {
    expect(() => ponudbeSpomnikiCsv([], NOW)).toThrowError(/prazen seznam ponudb/)
    expect(() => ponudbeSpomnikiCsv('ne-polje' as unknown as PonudbaSpomnikiVnos[], NOW)).toThrowError(TypeError)
    expect(() => ponudbeSpomnikiCsv(PONUDBE, new Date('neveljaven'))).toThrowError(TypeError)
    const podvojen = [...PONUDBE, { ...PONUDBE[4] }]
    expect(() => ponudbeSpomnikiCsv(podvojen, NOW)).toThrowError(/podvojen id ponudbe/)
    const pokvarenStatus = [ponudba({ id: 'x', nazivProjekta: 'N', status: 'POKVAREN' as unknown as PonudbaSpomnikiVnos['status'] })]
    expect(() => ponudbeSpomnikiCsv(pokvarenStatus, NOW)).toThrowError(/status mora biti eden izmed 4 znanih/)
    const pokvarenLock = [ponudba({ id: 'y', nazivProjekta: 'N', dealLocked: 'ne-boolean' as unknown as boolean })]
    expect(() => ponudbeSpomnikiCsv(pokvarenLock, NOW)).toThrowError(/dealLocked mora biti boolean/)
  })
})

describe('R331 — STRAŽAR: CSV povezava v quote-followup (tihe odstranitve NE gredo skozi)', () => {
  it('quote-followup uvaža CSV brata + ENA izpeljava vira (pridobiPonudbeSpomnikiVnosi ×2 — oba brata)', () => {
    expect(komponenta).toContain("from '@/lib/ponudbe-spomniki-csv'")
    expect(komponenta).toContain('ponudbeSpomnikiCsv(vnosi, now)')
    expect(komponenta).toContain('ponudbeSpomnikiCsvFilename(now)')
    expect((komponenta.match(/pridobiPonudbeSpomnikiVnosi\(\)/g) ?? []).length).toBe(2)
  })

  it('pill + MIME resnica (downloadCsvText) + dvoklik guard + fail-closed toast', () => {
    expect(komponenta).toContain('aria-label="Izvozi pregled spomnikov ponudb kot CSV"')
    expect(komponenta).toContain('data-testid="ponudbe-spomniki-csv-pill"')
    expect(komponenta).toContain('csvVteku')
    expect(komponenta).toContain("title: 'Ni vpisanih ponudb', description: 'CSV se izvozi, ko je vpisana prva ponudba.'")
    expect(komponenta).toContain('title: `Pregled ponudb prenešen v CSV (${ime})`')
  })

  it('definicijski naslov (MANDATORY STIL): izrečena pravila + razlika medija + ločnica od prikazanega seznama', () => {
    expect(komponenta).toContain(
      'title="Pregled spomnikov ponudb kot CSV — isti pregled in vrstni red kot Ponudbe PDF (prazen seznam → iskren toast, nikoli prazna datoteka). Ponudbe PDF = tisk za vodjo, Ponudbe CSV = Excel za filtriranje po statusu/stanju — VSE ponudbe (tudi podpisane), ne samo prikazanih prvih 12"',
    )
  })
})
