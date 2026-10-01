// ---------------------------------------------------------------------------
// R332 — POTEKLI OPOMNIKI CSV (59. člen issue #1 'izvozi' družine) — CSV brat
// PDF R252. Dokazi:
//  • glava = VERBATIM PDF autoTable head R252 (6 stolpcev);
//  • vrstice = preverba + akcijski sort + agregat EN VIR (preveriPotekliVnos
//    + sortirajPotekle + potekliPovzetek uvoženi iz PDF brata — ISTA sekvenca
//    kot buildPotekliOpomnikiPdfDoc) — WYSIWYG po konstrukciji (celice = ISTI
//    izpisi kot PDF body: trim, '—' iskren odpad, cenikDatumIso EN VIR,
//    potekelDniPrek EN VIR — ≥ 1 monotona);
//  • meta vrstice (Obseg / KPI trio ISTI izpisi / Sklep VERBATIM / Izvoženo
//    ob) — kanon R172→R296;
//  • ANTI-DIVERGENCA nad REALNIMA VIRI: CSV Sklep segmenti = dobesedno ISTI
//    segmenti kot PDF doc.text sklep + CSV glava = dobesedno ISTA polja kot
//    PDF autoTable head — tihe spremembe enega brata NE gredo skozi (vzorec
//    R330/R331);
//  • determinizem: premešan vhod = bajtno isti CSV (f(MNOŽICA));
//  • fail-closed: prazen seznam / pokvaren vnos / nepotečen status / pokvaren
//    ISO / pokvaren now / ne-polje → TypeError (podedovano iz EN VIR);
//  • STRAŽAR nad REALNIM crm-tab: ENA izpeljava izbora (potekliVnosiIzCustomers
//    ×3 — definicija + OBA brata), pill, MIME resnica, dvoklik guard,
//    fail-closed toast, definicijski naslov — tihe odstranitve NE gredo skozi.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  potekliOpomnikiCsvVrstice,
  potekliOpomnikiCsv,
  potekliOpomnikiCsvFilename,
  potekliOpomnikiCsvSklep,
  potekliOpomnikiCsvVrstica,
  POTEKLI_OPOMNIKI_CSV_GLAVA,
} from '../potekli-opomniki-csv'
import {
  sortirajPotekle,
  potekliPovzetek,
  potekelDniPrek,
  type PotekelOpomnikVnos,
} from '../potekli-opomniki-pdf'
import { cenikDatumIso } from '../cenik-pdf'

const komponenta = readFileSync(
  resolve(__dirname, '../../../src/components/roksal/crm-tab.tsx'),
  'utf8',
)
const pdfVir = readFileSync(
  resolve(__dirname, '../potekli-opomniki-pdf.ts'),
  'utf8',
)

/** FIXED now (determinizem — žig + ime + DNI resnica; ISTI vzorec kot
 *  r330/r331/r297). */
const NOW: Date = new Date('2026-10-01T08:00:00.000Z')

function vnos(over: Partial<PotekelOpomnikVnos> & Pick<PotekelOpomnikVnos, 'ime'>): PotekelOpomnikVnos {
  return {
    naslov: 'E2E cesta 1',
    telefon: null,
    kontaktnaOseba: null,
    opomnikDatum: '2026-09-01T08:00:00.000Z',
    opomnikOpis: null,
    opomnikStatus: 'POTEKEL',
    ...over,
  }
}

// 4 potekli — VSA iskrena resnica: najstarejši 30 dni prek (eksakt — NOW −
// 30 dni), izenačba po imenu (Alfa/Gama ISTI datum), '—' odpadi (telefon/
// opis), najnovejši nazadnje.
const POTEKLI: PotekelOpomnikVnos[] = [
  vnos({ ime: 'Stranka Alfa', naslov: 'Cesta alfa 1', opomnikDatum: '2026-09-01T08:00:00.000Z', opomnikOpis: 'Pokliči glede balustrade' }),
  vnos({ ime: 'Stranka Beta', naslov: 'Cesta beta 2', telefon: '041 123 456', opomnikDatum: '2026-09-15T00:00:00.000Z' }),
  vnos({ ime: 'Stranka Gama', naslov: 'Cesta gama 3', telefon: '041 999 888', opomnikDatum: '2026-09-01T08:00:00.000Z', opomnikOpis: 'Letni pregled' }),
  vnos({ ime: 'Stranka Delta', naslov: 'Cesta delta 4', opomnikDatum: '2026-09-20T00:00:00.000Z' }),
]

describe('R332 — glava + struktura (VERBATIM)', () => {
  it('glava = VERBATIM PDF autoTable head R252 (6 stolpcev)', () => {
    expect(POTEKLI_OPOMNIKI_CSV_GLAVA).toEqual([
      'Stranka', 'Naslov', 'Telefon', 'Opomnik', 'Dni prek', 'Opis',
    ])
  })

  it('ANTI-DIVERGENCA: PDF vir res nosi točno TO autoTable head (tiha glava-sprememba brata NE gre skozi)', () => {
    expect(pdfVir).toContain(
      "head: [['Stranka', 'Naslov', 'Telefon', 'Opomnik', 'Dni prek', 'Opis']],",
    )
  })

  it('vrstice v akcijskem redu — ISTA f(MNOŽICA) kot sortirajPotekle EN VIR (datum ASC, izenačba ime ASC)', () => {
    const vrstice = potekliOpomnikiCsvVrstice(POTEKLI, NOW)
    const podatkovne = vrstice.slice(1, 5)
    // datum ASC: 09-01 (Alfa+Gama — ime ASC Alfa < Gama), 09-15 (Beta), 09-20 (Delta)
    expect(podatkovne[0]).toContain('"Stranka Alfa"')
    expect(podatkovne[1]).toContain('"Stranka Gama"')
    expect(podatkovne[2]).toContain('"Stranka Beta"')
    expect(podatkovne[3]).toContain('"Stranka Delta"')
    // sort identičen klicu PDF brata (EN VIR)
    expect(sortirajPotekle(POTEKLI).map((p) => p.ime)).toEqual([
      'Stranka Alfa', 'Stranka Gama', 'Stranka Beta', 'Stranka Delta',
    ])
  })

  it('determinizem: premešan vhod = bajtno isti CSV (f(MNOŽICA))', () => {
    const a = potekliOpomnikiCsv(POTEKLI, NOW).csv
    const premesano = [POTEKLI[3], POTEKLI[0], POTEKLI[2], POTEKLI[1]]
    const b = potekliOpomnikiCsv(premesano, NOW).csv
    expect(b).toBe(a)
  })
})

describe('R332 — celice = EN VIR izpeljava (WYSIWYG vs PDF R252)', () => {
  it('Alfa: trim + telefon "—" iskren odpad + opomnik cenikDatumIso EN VIR + EKSAKT 30 dni prek (NOW − 30 dni) + opis', () => {
    const vrstice = potekliOpomnikiCsvVrstice(POTEKLI, NOW)
    const alfa = vrstice.find((v) => v.includes('"Stranka Alfa"')) as string
    // pričakovanja IZ EN VIR funkcij (lekcija R295 — ne iz glave)
    expect(alfa).toContain('"Cesta alfa 1"')
    expect(alfa).toContain('"—"') // telefon null
    expect(alfa).toContain(`"${cenikDatumIso('2026-09-01T08:00:00.000Z')}"`)
    expect(alfa).toContain(`"${potekelDniPrek(POTEKLI[0], NOW)}"`)
    // eksakt po konstrukciji: opomnikDatum = NOW − 30 dni → točno 30 (NIKOLI
    // 'prek 0 dni' — monotona potekelDniPrek)
    expect(potekelDniPrek(POTEKLI[0], NOW)).toBe(30)
    expect(alfa).toContain('"30"')
    expect(alfa).toContain('"Pokliči glede balustrade"')
  })

  it('iskrene veje: opis "—" (Beta) + telefoni ŽIVO (Beta/Gama) + trim resnica (naslov brez obrobe)', () => {
    const vrstice = potekliOpomnikiCsvVrstice(POTEKLI, NOW)
    const beta = vrstice.find((v) => v.includes('"Stranka Beta"')) as string
    expect(beta).toContain('"—"') // opis null
    expect(beta).toContain('"041 123 456"')
    const gama = vrstice.find((v) => v.includes('"Stranka Gama"')) as string
    expect(gama).toContain('"041 999 888"')
    expect(gama).toContain('"Letni pregled"')
  })

  it('potekliOpomnikiCsvVrstica fail-closed: ne-objekt vrsta ALI pokvaren now → TypeError z imenom graditelja', () => {
    expect(() => potekliOpomnikiCsvVrstica(null as unknown as PotekelOpomnikVnos, NOW)).toThrowError(TypeError)
    expect(() => potekliOpomnikiCsvVrstica(null as unknown as PotekelOpomnikVnos, NOW)).toThrowError(/potekliOpomnikiCsvVrstica/)
    expect(() => potekliOpomnikiCsvVrstica(POTEKLI[0], new Date('neveljaven'))).toThrowError(TypeError)
  })

  it('meta vrstice: Obseg + KPI trio = ISTI izpisi kot PDF KPI (Poteklih / Najstarejši (dni) / Povprečno (dni)) + Izvoženo ob ISO', () => {
    const vrstice = potekliOpomnikiCsvVrstice(POTEKLI, NOW)
    const pov = potekliPovzetek(POTEKLI, NOW)
    expect(vrstice.some((v) => v.startsWith('"Obseg","Vse stranke s poteklim opomnikom iz /api/crm'))).toBe(true)
    expect(vrstice).toContain(`"Poteklih","${pov.potekliN}"`)
    expect(vrstice).toContain(`"Najstarejši (dni)","${pov.najstarejsi}"`)
    expect(vrstice).toContain(`"Povprečno (dni)","${pov.povprecjeNiz}"`)
    // eksakt po konstrukciji: najstarejši = 30 dni (Alfa/Gama), 4 potekli
    expect(pov.potekliN).toBe(4)
    expect(pov.najstarejsi).toBe(30)
    expect(vrstice[vrstice.length - 1]).toBe(`"Izvoženo ob","${NOW.toISOString()}"`)
  })

  it('Sklep = VERBATIM PDF sklepu (ISTI segmenti kot doc.text R252 — akcijski red + vir poimenovan)', () => {
    const pov = potekliPovzetek(POTEKLI, NOW)
    const sklep = potekliOpomnikiCsvSklep(pov)
    expect(sklep).toContain(`${pov.potekliN} poteklih opomnikov · najstarejši ${pov.najstarejsi} dni prek · povprečno ${pov.povprecjeNiz} dni prek`)
    expect(sklep.endsWith('akcijski seznam za pisarno (najstarejši prvi) · vir = opomnikStatus iz CRM.')).toBe(true)
  })

  it('ANTI-DIVERGENCA: Sklep dobesedni segmenti = ISTI kot PDF vir doc.text (tiha sprememba enega brata NE gre skozi)', () => {
    const sklepSegmenti = [
      ' poteklih opomnikov · najstarejši ',
      ' dni prek · povprečno ',
      ' dni prek · akcijski seznam za pisarno (najstarejši prvi) · vir = opomnikStatus iz CRM.',
    ]
    for (const seg of sklepSegmenti) {
      expect(pdfVir).toContain(seg)
    }
  })

  it('format: BOM + \'\\n\' zaključki + vrstic = 1 glava + 4 podatkovne + 7 meta (prazna ločnica + 6 poimenovanih)', () => {
    const { csv, vrstic } = potekliOpomnikiCsv(POTEKLI, NOW)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    const vrstice = csv.slice(1).split('\n')
    expect(vrstic).toBe(12)
    // družina CSV: BREZ trailing '\n' (zadnja vrstica = 'Izvoženo ob')
    expect(vrstice).toHaveLength(12)
    expect(vrstice[vrstice.length - 1]).toBe(`"Izvoženo ob","${NOW.toISOString()}"`)
  })

  it('deterministično ime: Potekli-opomniki-YYYY-MM-DD.csv (bratska simetrija z PDF imenom R252)', () => {
    expect(potekliOpomnikiCsvFilename(NOW)).toBe('Potekli-opomniki-2026-10-01.csv')
    // ANTI-DIVERGENCA: PDF brat res nosi bratsko ime (isti prefix, .pdf)
    expect(pdfVir).toContain('`Potekli-opomniki-${todayStamp(now)}.pdf`')
  })

  it('Dni prek NIKOLI 0 ALI negativno (monotona potekelDniPrek — POTEKEL pomeni fetch days < 0 → klik ≥ 1)', () => {
    const vrstice = potekliOpomnikiCsvVrstice(POTEKLI, NOW)
    const podatkovne = vrstice.slice(1, 5)
    for (const v of podatkovne) {
      const celice = v.split(',')
      const dni = Number(celice[4].replace(/"/g, ''))
      expect(Number.isFinite(dni)).toBe(true)
      expect(dni).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('R332 — fail-closed (podedovano iz EN VIR preverba/sort/povzetek + now)', () => {
  it('fail-closed ×6: prazen / ne-polje / pokvaren now ×2 / nepotečen status / pokvaren ISO + prazno ime', () => {
    expect(() => potekliOpomnikiCsv([], NOW)).toThrowError(/prazen seznam nima najstarejšega opomnika/)
    expect(() => potekliOpomnikiCsv('ne-polje' as unknown as PotekelOpomnikVnos[], NOW)).toThrowError(TypeError)
    expect(() => potekliOpomnikiCsv(POTEKLI, new Date('neveljaven'))).toThrowError(TypeError)
    expect(() => potekliOpomnikiCsvVrstice(POTEKLI, new Date('neveljaven'))).toThrowError(TypeError)
    const nepotečen = [vnos({ ime: 'N', opomnikStatus: 'AKTIVEN' as unknown as PotekelOpomnikVnos['opomnikStatus'] })]
    expect(() => potekliOpomnikiCsv(nepotečen, NOW)).toThrowError(/vnos ni POTEKEL/)
    const pokvarenIso = [vnos({ ime: 'N', opomnikDatum: 'ne-iso' })]
    expect(() => potekliOpomnikiCsv(pokvarenIso, NOW)).toThrowError(/opomnikDatum mora biti ISO/)
    const praznoIme = [vnos({ ime: '   ' })]
    expect(() => potekliOpomnikiCsv(praznoIme, NOW)).toThrowError(/ime mora biti ne-prazen niz/)
  })
})

describe('R332 — STRAŽAR: CSV povezava v crm-tab (tihe odstranitve NE gredo skozi)', () => {
  it('crm-tab uvaža CSV brata + ENA izpeljava izbora (potekliVnosiIzCustomers ×3 — definicija + OBA brata)', () => {
    expect(komponenta).toContain("from '@/lib/potekli-opomniki-csv'")
    expect(komponenta).toContain('potekliOpomnikiCsv(vnosi, now)')
    expect(komponenta).toContain('potekliOpomnikiCsvFilename(now)')
    expect((komponenta.match(/potekliVnosiIzCustomers\(/g) ?? []).length).toBe(3)
  })

  it('pill + MIME resnica (downloadCsvText) + dvoklik guard + fail-closed toast', () => {
    expect(komponenta).toContain('aria-label="Izvozi potekle opomnike kot CSV"')
    expect(komponenta).toContain('data-testid="potekli-opomniki-csv-pill"')
    expect(komponenta).toContain('potekliCsvVTeku')
    expect(komponenta).toContain("title: 'Ni poteklih opomnikov', description: 'CSV se izvozi, ko opomnik preteče.'")
    expect(komponenta).toContain("title: 'Potekli opomniki prenešeni v CSV'")
  })

  it('definicijski naslov (MANDATORY STIL): izrečena pravila + razlika medija + iskren fail-closed', () => {
    expect(komponenta).toContain(
      'title="Potekli opomniki kot CSV — isti akcijski pregled in vrstni red kot PDF (prazen seznam → iskren toast, nikoli prazna datoteka). PDF = tisk za pisarno, CSV = Excel za filtriranje po stranki/dni"',
    )
  })

  it('legenda medija (nov podpis R332): Potekli CSV imenovan ob PDF bratu — VEDNO vidna', () => {
    expect(komponenta).toContain('Potekli CSV = isti akcijski pregled kot PDF (Excel)')
  })
})
