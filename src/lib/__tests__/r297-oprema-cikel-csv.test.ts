// ---------------------------------------------------------------------------
// R297 — OPREMA CIKEL CSV (27. člen 'izvozi' družine) — CSV brat PDF R266.
// Dokazi:
//  • glava = VERBATIM PDF autoTable head R266 (8 stolpcev);
//  • vrstice = opremaCikelPregled EN VIR (preverba + projekcija + NAZIV ASC
//    sort + povzetek) — WYSIWYG po konstrukciji (celice = ISTI izpisi kot
//    klici PDF funkcij: cenikDatumIso, OPREMA_STATUS_LABELI, kosBeseda);
//  • meta vrstice (Obseg/KPI/Sklep VERBATIM/Izvoženo ob) — kanon R172→R296;
//  • determinizem: premešan vhod = bajtno isti CSV (f(MNOŽICA));
//  • fail-closed: prazen seznam / ne-polje / pokvaren now / podvojen id /
//    pokvaren status → TypeError;
//  • STRAŽAR nad REALNIM logistics-tab: ENA izpeljava vira (pridobiOpremoVnosi
//    ×2 — oba brata), pill, MIME resnica, dvoklik guard, fail-closed toast,
//    F2 definicijski naslovi — tihe odstranitve NE gredo skozi.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  opremaCikelCsvVrstice,
  opremaCikelCsv,
  opremaCikelCsvFilename,
  OPREMA_CIKEL_CSV_GLAVA,
} from '../oprema-cikel-csv'
import {
  opremaCikelPregled,
  kosBeseda,
  OPREMA_STATUS_LABELI,
  type OpremaCikelVnos,
} from '../oprema-cikel-pdf'
import { cenikDatumIso } from '../cenik-pdf'

const komponenta = readFileSync(
  resolve(__dirname, '../../../src/components/roksal/logistics-tab.tsx'),
  'utf8',
)

/** FIXED now (determinizem — žig + ime; ISTI vzorec kot r266). */
const NOW: Date = new Date('2026-09-29T08:00:00.000Z')

function kos(over: Partial<OpremaCikelVnos> & Pick<OpremaCikelVnos, 'id' | 'naziv'>): OpremaCikelVnos {
  return {
    tip: 'Ročno orodje',
    status: 'NA_VOLJO',
    lokacija: null,
    serijskaStevilka: null,
    lastInspectionAt: null,
    inspectionIntervalDays: null,
    nextInspectionAt: null,
    inspectionDue: false,
    inspectionUnknown: false,
    calibrationRequired: false,
    calibrationDueDate: null,
    calibrationCertificate: null,
    calibrationOverdue: false,
    calibrationMissing: false,
    zadnjiServis: null,
    assignmentsCount: 0,
    ...over,
  }
}

// 6 kosov — VSE kalibracijske veje: potečena (e1, RED akcija), manjka rok
// (e3, AMBER), 'do … · potrdilo' (e6), 'ne zahteva' (e2/e4/e5 — nemerska) +
// nezabeležen pregled (e3) + zapadel pregled (e1) + brez lokacije (e2/e5/e6).
const OPREMA: OpremaCikelVnos[] = [
  kos({ id: 'e1', naziv: 'Laserni merilec', tip: 'Merska oprema', lokacija: 'Delavnica', serijskaStevilka: 'SN-1', lastInspectionAt: '2026-01-01T00:00:00.000Z', inspectionIntervalDays: 180, nextInspectionAt: '2026-06-30T00:00:00.000Z', inspectionDue: true, calibrationRequired: true, calibrationDueDate: '2026-08-01T00:00:00.000Z', calibrationOverdue: true, calibrationCertificate: 'CAL-01', assignmentsCount: 2 }),
  kos({ id: 'e2', naziv: 'Ladder A', status: 'IZGUBLJENO' }),
  kos({ id: 'e3', naziv: 'Blinker Set', status: 'V_UPORABI', tip: 'Merska oprema', inspectionIntervalDays: 90, inspectionUnknown: true, calibrationRequired: true, calibrationMissing: true, assignmentsCount: 1 }),
  kos({ id: 'e4', naziv: 'Viličar', status: 'V_SERVISU', tip: 'Prevoz', lokacija: 'Skladišče', lastInspectionAt: '2026-03-01T00:00:00.000Z', inspectionIntervalDays: 365, nextInspectionAt: '2027-03-01T00:00:00.000Z' }),
  kos({ id: 'e5', naziv: 'Stari kolesek', status: 'UPOKOJENO' }),
  kos({ id: 'e6', naziv: 'Ampèrmer', tip: 'Merska oprema', calibrationRequired: true, calibrationDueDate: '2026-12-01T00:00:00.000Z', calibrationCertificate: 'CAL-77' }),
]

describe('R297 — glava + struktura (VERBATIM)', () => {
  it('glava = VERBATIM PDF autoTable head R266 (8 stolpcev)', () => {
    expect(OPREMA_CIKEL_CSV_GLAVA).toEqual([
      'Oprema', 'Tip', 'Status', 'Lokacija', 'Zadnji pregled', 'Naslednji pregled', 'Kalibracija', 'Rezervacije',
    ])
  })

  it('vrstice v NAZIV ASC redu — ISTA f(MNOŽICA) kot opremaCikelPregled EN VIR', () => {
    const vrstice = opremaCikelCsvVrstice(OPREMA, NOW)
    const podatkovne = vrstice.slice(1, 7)
    expect(podatkovne[0]).toContain('"Ampèrmer"')
    expect(podatkovne[1]).toContain('"Blinker Set"')
    expect(podatkovne[2]).toContain('"Ladder A"')
    expect(podatkovne[3]).toContain('"Laserni merilec"')
    expect(podatkovne[4]).toContain('"Stari kolesek"')
    expect(podatkovne[5]).toContain('"Viličar"')
    // sort identičen klicu PDF brata
    expect(opremaCikelPregled(OPREMA).vrste.map((v) => v.naziv)).toEqual([
      'Ampèrmer', 'Blinker Set', 'Ladder A', 'Laserni merilec', 'Stari kolesek', 'Viličar',
    ])
  })

  it('determinizem: premešan vhod = bajtno isti CSV', () => {
    const a = opremaCikelCsv(OPREMA, NOW).csv
    const premesano = [OPREMA[3], OPREMA[0], OPREMA[5], OPREMA[2], OPREMA[1], OPREMA[4]]
    const b = opremaCikelCsv(premesano, NOW).csv
    expect(b).toBe(a)
  })
})

describe('R297 — celice = EN VIR izpeljava (WYSIWYG vs PDF R266)', () => {
  it('e1 Laserni merilec: status label EN VIR + datumi cenikDatumIso EN VIR + kalibracija "potečena …" (RED akcija)', () => {
    const vrstice = opremaCikelCsvVrstice(OPREMA, NOW)
    const e1 = vrstice.find((v) => v.includes('"Laserni merilec"')) as string
    // pričakovanja IZ EN VIR funkcij (lekcija R295 — ne iz glave)
    expect(e1).toContain(`"${OPREMA_STATUS_LABELI.NA_VOLJO}"`)
    expect(e1).toContain(`"${cenikDatumIso('2026-01-01T00:00:00.000Z')}"`)
    expect(e1).toContain(`"potečena ${cenikDatumIso('2026-08-01T00:00:00.000Z')}"`)
    expect(e1).toContain('"Delavnica"')
    expect(e1).toContain('"2"')
  })

  it('iskrene veje: "ni zabeležen" (e3) · "—" (e2/e5) · "manjka rok" (e3) · "ne zahteva" (e2/e4) · "do … · potrdilo" (e6)', () => {
    const vrstice = opremaCikelCsvVrstice(OPREMA, NOW)
    const e3 = vrstice.find((v) => v.includes('"Blinker Set"')) as string
    expect(e3).toContain('"ni zabeležen"')
    expect(e3).toContain('"manjka rok"')
    expect(e3).toContain('"—"')
    const e2 = vrstice.find((v) => v.includes('"Ladder A"')) as string
    expect(e2).toContain('"ne zahteva"')
    expect(e2).toContain('"—"')
    const e4 = vrstice.find((v) => v.includes('"Viličar"')) as string
    expect(e4).toContain(`"${cenikDatumIso('2027-03-01T00:00:00.000Z')}"`)
    expect(e4).toContain('"ne zahteva"')
    const e6 = vrstice.find((v) => v.includes('"Ampèrmer"')) as string
    expect(e6).toContain(`"do ${cenikDatumIso('2026-12-01T00:00:00.000Z')} · CAL-77"`)
  })

  it('meta vrstice: Obseg + KPI števci = povzetek EN VIR + Sklep VERBATIM PDF sklep + Izvoženo ob ISO', () => {
    const vrstice = opremaCikelCsvVrstice(OPREMA, NOW)
    const { povzetek } = opremaCikelPregled(OPREMA)
    expect(vrstice.some((v) => v.startsWith('"Obseg","Vsa oprema iz /api/equipment'))).toBe(true)
    expect(vrstice).toContain(`"Kosov","${povzetek.oprem}"`)
    expect(vrstice).toContain(`"Pregled zapadel","${povzetek.pregledZapadel}"`)
    expect(vrstice).toContain(`"Pregled nezabeležen","${povzetek.pregledNezabelezen}"`)
    expect(vrstice).toContain(`"Kalibracija potečena","${povzetek.kalPotecena}"`)
    expect(vrstice).toContain(`"Manjka kal. rok","${povzetek.kalManjkaRok}"`)
    // Sklep = VERBATIM PDF sklepni niz (ISTI segmenti kot R266 doc.text)
    const sklep = vrstice.find((v) => v.startsWith('"Sklep","')) as string
    expect(sklep).toContain(`${povzetek.oprem} ${kosBeseda(povzetek.oprem)} · merskih ${povzetek.merskih} (kalibracija pogoj)`)
    expect(sklep).toContain('statusi: na voljo ' + povzetek.naVoljo + ' / v uporabi ' + povzetek.vUporabi + ' / v servisu ' + povzetek.vServisu + ' / izgubljeno ' + povzetek.izgubljeno + ' / upokojeno ' + povzetek.upokojeno)
    expect(sklep.endsWith('(polna resnica, paginacija do 10.000 kosov)."'))
    expect(vrstice[vrstice.length - 1]).toBe(`"Izvoženo ob","${NOW.toISOString()}"`)
  })

  it('format: BOM + \'\\n\' zaključki + vrstic = 1 glava + 6 podatkovnih + 9 meta', () => {
    const { csv, vrstic } = opremaCikelCsv(OPREMA, NOW)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    const vrstice = csv.slice(1).split('\n')
    expect(vrstic).toBe(16)
    // družina CSV: BREZ trailing '\n' (zadnja vrstica = 'Izvoženo ob')
    expect(vrstice).toHaveLength(16)
    expect(vrstice[vrstice.length - 1]).toBe(`"Izvoženo ob","${NOW.toISOString()}"`)
  })

  it('deterministično ime: Oprema-cikel-YYYY-MM-DD.csv (družinski vzorec, brat PDF R266)', () => {
    expect(opremaCikelCsvFilename(NOW)).toBe('Oprema-cikel-2026-09-29.csv')
  })
})

describe('R297 — fail-closed (družinska pravila)', () => {
  it('fail-closed ×5: prazno / ne-polje / pokvaren now / podvojen id / pokvaren status', () => {
    expect(() => opremaCikelCsv([], NOW)).toThrowError(TypeError)
    expect(() => opremaCikelCsv([], NOW)).toThrowError(/prazen seznam opreme/)
    expect(() => opremaCikelCsv('ne-polje' as unknown as OpremaCikelVnos[], NOW)).toThrowError(TypeError)
    expect(() => opremaCikelCsv(OPREMA, new Date('neveljaven'))).toThrowError(TypeError)
    const podvojen = [OPREMA[0], { ...OPREMA[1], id: OPREMA[0].id }]
    expect(() => opremaCikelCsv(podvojen, NOW)).toThrowError(/podvojen id opreme/)
    const pokvarenStatus = [kos({ id: 'x', naziv: 'N', status: 'POKVAREN' as unknown as OpremaCikelVnos['status'] })]
    expect(() => opremaCikelCsv(pokvarenStatus, NOW)).toThrowError(/status mora biti eden izmed 5 znanih/)
  })
})

describe('R297 — STRAŽAR: CSV povezava v logistics-tab (tihe odstranitve NE gredo skozi)', () => {
  it('logistics-tab uvaža CSV brata + ENA izpeljava vira (pridobiOpremoVnosi ×2 — oba brata)', () => {
    expect(komponenta).toContain("from '@/lib/oprema-cikel-csv'")
    expect(komponenta).toContain('opremaCikelCsv(vnosi, now)')
    expect(komponenta).toContain('opremaCikelCsvFilename(now)')
    expect((komponenta.match(/pridobiOpremoVnosi\(\)/g) ?? []).length).toBe(2)
  })

  it('pill + MIME resnica (downloadCsvText) + dvoklik guard + fail-closed toast', () => {
    expect(komponenta).toContain('aria-label="Izvozi pregled življenjskega cikla opreme kot CSV"')
    expect(komponenta).toContain('title="Življenjski cikl opreme kot CSV (isti stolpci kot PDF — za Excel/revizijo)"')
    expect(komponenta).toContain('Cikel CSV')
    expect(komponenta).toContain('ocCsvVTeku')
    expect(komponenta).toContain("title: 'Ni vpisane opreme', description: 'CSV se izvozi, ko je vpisan prvi kos opreme.'")
    expect(komponenta).toContain('title: `Pregled opreme prenešen v CSV (${ime})`')
  })

  it('R297 STIL — F2 ciklov definicijski naslovi (izrečena resnica — hover pove izpeljavo)', () => {
    expect(komponenta).toContain(
      'title="Cikl videnega seznama opreme — polna resnica prihaja s FRESH fetch izvozom (PDF/CSV — VSA oprema)"',
    )
    expect(komponenta).toContain(
      'title="Interval + zadnji pregled znana in rok je pretekel (R145 jedro) — akcija"',
    )
    expect(komponenta).toContain(
      'title="Merska oprema z kalibracijskim rokom, ki je že pretekel — akcija"',
    )
  })
})
