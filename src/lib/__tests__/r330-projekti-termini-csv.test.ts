// ---------------------------------------------------------------------------
// R330 — PROJEKTI — TERMINI CSV (57. člen issue #1 'izvozi' družine) — CSV
// brat PDF R265. Dokazi:
//  • glava = VERBATIM PDF autoTable head R265 (8 stolpcev);
//  • vrstice = projektiTerminiPregled EN VIR (preverba + JOIN + agregacija +
//    NAZIV ASC sort + izenačba id ASC + povzetek) — WYSIWYG po konstrukciji
//    (celice = ISTI izpisi kot PDF body: stranka '—', ure '—', obdobje po
//    cenikDatumIso EN VIR);
//  • meta vrstice (Obseg/števci ×10/Sklep VERBATIM/Izvoženo ob) — kanon
//    R172→R296;
//  • ANTI-DIVERGENCA nad REALNIMA VIRI: CSV Sklep segmenti = dobesedno ISTI
//    segmenti kot PDF doc.text sklep (projekti-termini-pdf.ts) + CSV glava =
//    dobesedno ISTA polja kot PDF autoTable head — tihe spremembe enega
//    brata NE gredo skozi (lekcija R295 — pini DEJANSKO vedenje virov);
//  • determinizem: premešan vhod = bajtno isti CSV (f(MNOŽICA));
//  • fail-closed: prazen projekti/termini / tujci / podvojen id / pokvaren
//    status / pokvaren now / ne-polje → TypeError (podedovano iz EN VIR);
//  • STRAŽAR nad REALNIM logistics-tab: ENA izpeljava vira
//    (pridobiProjektiTerminiVnosi ×2 — oba brata), pill, MIME resnica,
//    dvoklik guard, fail-closed toast, definicijski naslov — tihe
//    odstranitve NE gredo skozi.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  projektiTerminiCsvVrstice,
  projektiTerminiCsv,
  projektiTerminiCsvFilename,
  projektiTerminiCsvSklep,
  projektiTerminiCsvVrstica,
  PROJEKTI_TERMINI_CSV_GLAVA,
} from '../projekti-termini-csv'
import {
  projektiTerminiPregled,
  projektBeseda,
  type ProjektiTerminiProjektVnos,
  type ProjektiTerminiTerminVnos,
} from '../projekti-termini-pdf'
import { terminBeseda } from '../termini-prikaz'
import { cenikDatumIso } from '../cenik-pdf'

const komponenta = readFileSync(
  resolve(__dirname, '../../../src/components/roksal/logistics-tab.tsx'),
  'utf8',
)
const pdfVir = readFileSync(
  resolve(__dirname, '../projekti-termini-pdf.ts'),
  'utf8',
)

/** FIXED now (determinizem — žig + ime; ISTI vzorec kot r297/r265). */
const NOW: Date = new Date('2026-10-01T08:00:00.000Z')

const PROJEKTI: ProjektiTerminiProjektVnos[] = [
  { id: 'p1', nazivProjekta: 'Ograja Vizija', datumMontaze: '2026-03-10T00:00:00.000Z', stranka: 'Kraj d.o.o.' },
  { id: 'p2', nazivProjekta: 'Balustrada Ampèr', datumMontaze: null, stranka: null },
  { id: 'p3', nazivProjekta: 'Terasa Bled', datumMontaze: '2026-05-01T00:00:00.000Z', stranka: 'Turizem Bled' },
]

function termin(over: Partial<ProjektiTerminiTerminVnos> & Pick<ProjektiTerminiTerminVnos, 'projectId' | 'datumZacetka'>): ProjektiTerminiTerminVnos {
  return {
    status: 'NAVRTENO',
    predvideneUre: null,
    ...over,
  }
}

// 5 terminov — vse iskrene veje: PREKlicANO (ure izključene), PRELOZENO
// (ure v vsoti), brez ure (null — izključena, poimenovana), tujec (sirot).
const TERMINI: ProjektiTerminiTerminVnos[] = [
  termin({ projectId: 'p1', datumZacetka: '2026-02-01T07:00:00.000Z', status: 'ZAKLJUCENO', predvideneUre: 8 }),
  termin({ projectId: 'p1', datumZacetka: '2026-02-03T07:00:00.000Z', status: 'PREKlicANO', predvideneUre: 6 }),
  termin({ projectId: 'p2', datumZacetka: '2026-02-02T07:00:00.000Z', status: 'V_TEKU', predvideneUre: 5 }),
  termin({ projectId: 'p2', datumZacetka: '2026-02-04T07:00:00.000Z', status: 'PRELOZENO', predvideneUre: 3 }),
  termin({ projectId: 'p3', datumZacetka: '2026-02-02T07:00:00.000Z', status: 'NAVRTENO', predvideneUre: null }),
  termin({ projectId: 'sirota-x', datumZacetka: '2026-02-05T07:00:00.000Z', status: 'NAVRTENO', predvideneUre: 4 }),
]

describe('R330 — glava + struktura (VERBATIM)', () => {
  it('glava = VERBATIM PDF autoTable head R265 (8 stolpcev)', () => {
    expect(PROJEKTI_TERMINI_CSV_GLAVA).toEqual([
      'Projekt', 'Stranka', 'Terminov', 'Načrtovano', 'V teku', 'Zaključeno', 'Ur', 'Obdobje',
    ])
  })

  it('ANTI-DIVERGENCA: PDF vir res nosi točno TO autoTable head (tiha glava-sprememba brata NE gre skozi)', () => {
    expect(pdfVir).toContain(
      "head: [['Projekt', 'Stranka', 'Terminov', 'Načrtovano', 'V teku', 'Zaključeno', 'Ur', 'Obdobje']],",
    )
  })

  it('vrstice v NAZIV ASC redu z izenačbo id — ISTA f(MNOŽICA) kot projektiTerminiPregled EN VIR', () => {
    const vrstice = projektiTerminiCsvVrstice(PROJEKTI, TERMINI, NOW)
    const podatkovne = vrstice.slice(1, 4)
    expect(podatkovne[0]).toContain('"Balustrada Ampèr"')
    expect(podatkovne[1]).toContain('"Ograja Vizija"')
    expect(podatkovne[2]).toContain('"Terasa Bled"')
    // sort identičen klicu PDF brata (EN VIR)
    expect(projektiTerminiPregled(PROJEKTI, TERMINI).vrste.map((v) => v.naziv)).toEqual([
      'Balustrada Ampèr', 'Ograja Vizija', 'Terasa Bled',
    ])
  })

  it('determinizem: premešan vhod = bajtno isti CSV (f(MNOŽICA))', () => {
    const a = projektiTerminiCsv(PROJEKTI, TERMINI, NOW).csv
    const premesaniTermini = [TERMINI[3], TERMINI[0], TERMINI[5], TERMINI[2], TERMINI[1], TERMINI[4]]
    const premesaniProjekti = [PROJEKTI[2], PROJEKTI[0], PROJEKTI[1]]
    const b = projektiTerminiCsv(premesaniProjekti, premesaniTermini, NOW).csv
    expect(b).toBe(a)
  })
})

describe('R330 — celice = EN VIR izpeljava (WYSIWYG vs PDF R265)', () => {
  it('p1 Ograja Vizija: stranka + ure bez PREKlicanih + obdobje prvi → zadnji (cenikDatumIso EN VIR)', () => {
    const vrstice = projektiTerminiCsvVrstice(PROJEKTI, TERMINI, NOW)
    const p1 = vrstice.find((v) => v.includes('"Ograja Vizija"')) as string
    expect(p1).toContain('"Kraj d.o.o."')
    expect(p1).toContain('"2"') // terminov (preklican VIDEN v števcu)
    expect(p1).toContain('"1"') // zaključeno
    expect(p1).toContain('"8"') // ure (preklicanih 6 izključenih iz vsote)
    expect(p1).toContain(`"${cenikDatumIso('2026-02-01T07:00:00.000Z')} → ${cenikDatumIso('2026-02-03T07:00:00.000Z')}"`)
  })

  it('iskrene veje: stranka "—" (p2) · ure "—" kadar nič ne šteje · enodnevno obdobje brez puščice', () => {
    const p2 = { ...PROJEKTI[1] }
    const solo = [termin({ projectId: 'p2', datumZacetka: '2026-02-02T07:00:00.000Z', status: 'V_TEKU', predvideneUre: null })]
    const vrstice = projektiTerminiCsvVrstice([p2], solo, NOW)
    const vrsta = vrstice[1]
    expect(vrsta).toContain('"—"') // stranka null
    expect(vrsta).toContain('"—"') // ure null (brez ure — izključena iz vsote)
    expect(vrsta).toContain(`"${cenikDatumIso('2026-02-02T07:00:00.000Z')}"`) // enodnevno obdobje — brez puščice
    expect(vrsta).not.toContain('→')
  })

  it('projektiTerminiCsvVrstica fail-closed: ne-objekt vrsta → TypeError z imenom graditelja', () => {
    expect(() => projektiTerminiCsvVrstica(null as unknown as Parameters<typeof projektiTerminiCsvVrstica>[0])).toThrowError(TypeError)
    expect(() => projektiTerminiCsvVrstica(null as unknown as Parameters<typeof projektiTerminiCsvVrstica>[0])).toThrowError(/projektiTerminiCsvVrstica/)
  })

  it('meta vrstice: Obseg + števci ×10 = povzetek EN VIR + Izvoženo ob ISO', () => {
    const vrstice = projektiTerminiCsvVrstice(PROJEKTI, TERMINI, NOW)
    const { povzetek } = projektiTerminiPregled(PROJEKTI, TERMINI)
    expect(vrstice.some((v) => v.startsWith('"Obseg","Vsi projekti z vsaj enim ujemajočim terminom'))).toBe(true)
    expect(vrstice).toContain(`"Projektov","${povzetek.projektov}"`)
    expect(vrstice).toContain(`"Z termini","${povzetek.zTermini}"`)
    expect(vrstice).toContain(`"Brez termina","${povzetek.brezTermina}"`)
    expect(vrstice).toContain(`"Plan. brez termina","${povzetek.planBrezTermina}"`)
    expect(vrstice).toContain(`"Terminov","${povzetek.terminov}"`)
    expect(vrstice).toContain(`"Preklicanih","${povzetek.preklicanih}"`)
    expect(vrstice).toContain(`"Preloženih","${povzetek.prelozenih}"`)
    expect(vrstice).toContain(`"Brez ure","${povzetek.brezUre}"`)
    expect(vrstice).toContain(`"Predvidenih ur","${povzetek.ur}"`)
    expect(vrstice).toContain(`"Sirot terminov","${povzetek.sirotTerminov}"`)
    expect(vrstice[vrstice.length - 1]).toBe(`"Izvoženo ob","${NOW.toISOString()}"`)
  })

  it('Sklep = VERBATIM PDF sklepu (ISTI segmenti kot doc.text R265 — sirotec + preklicani + preloženi poimenovani)', () => {
    const { povzetek } = projektiTerminiPregled(PROJEKTI, TERMINI)
    const sklep = projektiTerminiCsvSklep(povzetek)
    expect(sklep).toContain(`${povzetek.zTermini} ${projektBeseda(povzetek.zTermini)} z vpisanimi termini od ${povzetek.projektov}`)
    expect(sklep).toContain(`brez termina ${povzetek.brezTermina} (od tega s planirano montažo ${povzetek.planBrezTermina})`)
    expect(sklep).toContain(`${povzetek.terminov} ${terminBeseda(povzetek.terminov)}`)
    expect(sklep).toContain(`predvidenih ur ${povzetek.ur} (brez ure ${povzetek.brezUre} — izključene iz vsote)`)
    expect(sklep).toContain(`preklicanih ${povzetek.preklicanih} (ure preklicanih izključene iz vsote)`)
    expect(sklep).toContain(`preloženih ${povzetek.prelozenih} (ure v vsoti)`)
    expect(sklep).toContain('obdobje = prvi → zadnji vpisani termin')
    expect(sklep).toContain(`terminov brez ujemajočega projekta ${povzetek.sirotTerminov} (poimenovano)`)
    expect(sklep.endsWith('vir = /api/schedules (vsi termini) × /api/projects.')).toBe(true)
  })

  it('ANTI-DIVERGENCA: Sklep dobesedni segmenti = ISTI kot PDF vir doc.text (tiha sprememba enega brata NE gre skozi)', () => {
    // PDF vir nosi sklepni niz — vsi dobesedni segmenti, ki jih pinamo v
    // CSV Sklepu, morajo biti dobesedno prisotni TUDI v PDF viru.
    const skelpSegmenti = [
      ' z vpisanimi termini od ',
      ' · brez termina ',
      ' (od tega s planirano montažo ',
      ' · predvidenih ur ',
      ' (brez ure ',
      ' — izključene iz vsote) · preklicanih ',
      ' (ure preklicanih izključene iz vsote) · preloženih ',
      ' (ure v vsoti) · obdobje = prvi → zadnji vpisani termin · terminov brez ujemajočega projekta ',
      ' (poimenovano) · vir = /api/schedules (vsi termini) × /api/projects.',
    ]
    for (const seg of skelpSegmenti) {
      expect(pdfVir).toContain(seg)
    }
  })

  it('format: BOM + \'\\n\' zaključki + vrstic = 1 glava + 3 podatkovne + 14 meta', () => {
    const { csv, vrstic } = projektiTerminiCsv(PROJEKTI, TERMINI, NOW)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    const vrstice = csv.slice(1).split('\n')
    expect(vrstic).toBe(18)
    // družina CSV: BREZ trailing '\n' (zadnja vrstica = 'Izvoženo ob')
    expect(vrstice).toHaveLength(18)
    expect(vrstice[vrstice.length - 1]).toBe(`"Izvoženo ob","${NOW.toISOString()}"`)
  })

  it('deterministično ime: Projekti-termini-YYYY-MM-DD.csv (bratska simetrija z PDF imenom R265)', () => {
    expect(projektiTerminiCsvFilename(NOW)).toBe('Projekti-termini-2026-10-01.csv')
  })
})

describe('R330 — fail-closed (podedovano iz EN VIR projektiTerminiPregled + now)', () => {
  it('fail-closed ×6: prazen projekti / prazen termini / tujec sam / podvojen id / pokvaren status / pokvaren now', () => {
    expect(() => projektiTerminiCsv([], TERMINI, NOW)).toThrowError(/prazen seznam projektov/)
    expect(() => projektiTerminiCsv(PROJEKTI, [], NOW)).toThrowError(/prazen seznam terminov/)
    expect(() => projektiTerminiCsv([PROJEKTI[0]], [termin({ projectId: 'tujec', datumZacetka: '2026-02-01T07:00:00.000Z' })], NOW)).toThrowError(/vsi termini tujci/)
    const podvojen = [...PROJEKTI, { ...PROJEKTI[2] }]
    expect(() => projektiTerminiCsv(podvojen, TERMINI, NOW)).toThrowError(/podvojen projekt id/)
    const pokvarenStatus = [termin({ projectId: 'p1', datumZacetka: '2026-02-01T07:00:00.000Z', status: 'POKVAREN' as unknown as ProjektiTerminiTerminVnos['status'] })]
    expect(() => projektiTerminiCsv(PROJEKTI, pokvarenStatus, NOW)).toThrowError(/status mora biti eden izmed 5 znanih/)
    expect(() => projektiTerminiCsv(PROJEKTI, TERMINI, new Date('neveljaven'))).toThrowError(TypeError)
  })

  it('ne-polje vhodov → TypeError (pregled fail-closed — nič tihe degradacije)', () => {
    expect(() => projektiTerminiCsv('ne-polje' as unknown as ProjektiTerminiProjektVnos[], TERMINI, NOW)).toThrowError(TypeError)
    expect(() => projektiTerminiCsv(PROJEKTI, 'ne-polje' as unknown as ProjektiTerminiTerminVnos[], NOW)).toThrowError(TypeError)
  })
})

describe('R330 — STRAŽAR: CSV povezava v logistics-tab (tihe odstranitve NE gredo skozi)', () => {
  it('logistics-tab uvaža CSV brata + ENA izpeljava vira (pridobiProjektiTerminiVnosi ×2 — oba brata)', () => {
    expect(komponenta).toContain("from '@/lib/projekti-termini-csv'")
    expect(komponenta).toContain('projektiTerminiCsv(projekti, termini, now)')
    expect(komponenta).toContain('projektiTerminiCsvFilename(now)')
    expect((komponenta.match(/pridobiProjektiTerminiVnosi\(\)/g) ?? []).length).toBe(2)
  })

  it('pill + MIME resnica (downloadCsvText) + dvoklik guard + fail-closed toast', () => {
    expect(komponenta).toContain('aria-label="Izvozi pregled projektov in terminov kot CSV"')
    expect(komponenta).toContain('data-testid="projekti-termini-csv-pill"')
    expect(komponenta).toContain('Projekti CSV')
    expect(komponenta).toContain('ptCsvVTeku')
    expect(komponenta).toContain("title: 'Ni vpisanih terminov', description: 'CSV se izvozi, ko je vpisan prvi termin montaže.'")
    expect(komponenta).toContain('title: `Pregled projektov in terminov prenešen v CSV (${ime})`')
  })

  it('definicijski naslov (MANDATORY STIL): izrečena pravila + razlika medija (PDF = tisk, CSV = Excel)', () => {
    expect(komponenta).toContain(
      'title="Pregled projektov in terminov kot CSV — isti pregled in vrstni red kot Projekti PDF (prazen seznam → iskren toast, nikoli prazna datoteka). Projekti PDF = tisk za vodjo, Projekti CSV = Excel za filtriranje po projektu/stranki"',
    )
  })
})
