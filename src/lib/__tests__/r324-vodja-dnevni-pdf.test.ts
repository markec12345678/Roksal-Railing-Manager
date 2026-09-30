// R324 — 52. člen (issue #1 IZVOZI družina): izvoz DNEVNEGA pregleda vodje
// kot DETERMINISTIČNI PDF. PDF brat dnevnemu CSV R163 (vzorec R318/R320/R321:
// LOČEN lib): vhod = POSREDOVANA resnica (EN VIR z CSV bratom — komponenta
// vodjaIzvozVhod), KPI vrstice + glave + validacija + ura + EUR + statusi =
// UVOŽENI iz brata (NIČ podvojenih pravil — vzorec preveriZmogljivostPregled-
// ZaIzvoz + ZMOGLJIVOST_IZVOZ_GLAVE R323); VODJA_VIR_NIZ = družinski kontrakt
// (CSV arhivska oblika ostaja BAJTNO nespremenjena). Determinizem kanon
// 46.–51. člen: vsebina brez časa, fiksni formatni žig VODJA_PDF_ZIG_FIKSNI,
// FNV fileId soli 0xcd–0xd0 → isti HEAD + isti vhod = bajtno identičen PDF.
// Dokazni plasti (r302/r318/r320/r321 kanon): BAJTNI dokazi (magija +
// determinizem + razlike po vhodu) + SOURCE-level EN VIR pini (uvozi, NIČ
// redefinicij) + CSV bajtna stabilnost (arhivska resnica).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildVodjaDnevniPdfDoc,
  generateVodjaDnevniPdf,
  vodjaDnevniPdfFilename,
  VODJA_PDF_ZIG_FIKSNI,
  type VodjaDnevniPdfOptions,
} from '@/lib/vodja-dnevni-pdf'
import {
  buildVodjaCsv,
  formatEurCsv,
  formatUraVodja,
  preveriVodjaIzvozVhod,
  preveriVodjaStevilo,
  preveriVodjaZnesek,
  terminStatusLabel,
  vodjaCsvFilename,
  vodjaKpiVrstice,
  VODJA_KPI_GLAVE,
  VODJA_TERMINI_GLAVE,
  VODJA_VIR_NIZ,
  type VodjaKpi,
  type VodjaPrihodekRow,
  type VodjaTerminCsvRow,
} from '@/lib/vodja-csv'

const lib = readFileSync(resolve(__dirname, '../vodja-dnevni-pdf.ts'), 'utf8')
const bratLib = readFileSync(resolve(__dirname, '../vodja-csv.ts'), 'utf8')
const komponenta = readFileSync(resolve(__dirname, '../../components/roksal/vodja-dashboard.tsx'), 'utf8')

function kpi(nad = 0): VodjaKpi {
  return {
    danasTermini: 3,
    danasZakljuceni: 1,
    danasVpripravi: 2,
    mesecnoProjektov: 5,
    mesecniPrihodek: 1234.5 + nad,
    mesecnaMarza: 308.6,
    mesecnoUr: 42,
    odprtoZnesek: 2500,
    zapadloZnesek: 700,
    zapadloSt: 2,
    potekliOpomniki: 1,
    nizkaZaloga: 4,
    odprtaNarocila: 6,
    brezDobavitelja: 0,
    zamujeneDobave: 3,
    skupajProjektov: 120,
    skupajStrank: 87,
    skupniLTV: 54321.4,
  }
}

const PRIHODKI: VodjaPrihodekRow[] = [
  { label: 'september', eur: 1234.5 },
  { label: 'avgust', eur: 999 },
]

const TERMINI: VodjaTerminCsvRow[] = [
  {
    datumZacetka: '2026-09-30T08:30:00.000Z',
    status: 'V_TEKU',
    project: { nazivProjekta: 'Parkirišče Kranj', customer: { ime: 'Jože Novak' } },
    crew: { naziv: 'Ekipa A' },
  },
  {
    datumZacetka: '2026-09-30T13:00:00.000Z',
    status: 'NEZNAN_PROJEKTNI',
    project: { nazivProjekta: 'Balkan Ljubljana', customer: null },
    crew: null,
  },
]

function vhod(k: VodjaKpi = kpi(), termini: VodjaTerminCsvRow[] = TERMINI) {
  return { kpi: k, termini, prihodki: PRIHODKI, danesIso: '2026-09-30' }
}

function zgradi(v: ReturnType<typeof vhod>, now?: Date): Buffer {
  const doc =
    now === undefined
      ? buildVodjaDnevniPdfDoc(v)
      : buildVodjaDnevniPdfDoc(v, { now } satisfies VodjaDnevniPdfOptions)
  return Buffer.from(doc.output('arraybuffer') as ArrayBuffer)
}

describe('r324 vodja-dnevni PDF izvoz (52. člen — IZVOZI družina)', () => {
  it('oblika: %PDF- magija + vsebina NIČ prazna + filename bratska simetrija z CSV + fail-closed', () => {
    const bin = zgradi(vhod())
    expect(bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(bin.length).toBeGreaterThan(1000)
    expect(vodjaDnevniPdfFilename('2026-09-30')).toBe('pregled-vodje_2026-09-30.pdf')
    expect(vodjaCsvFilename('2026-09-30')).toBe('pregled-vodje_2026-09-30.csv')
    expect(() => vodjaDnevniPdfFilename('2026-13-99')).toThrow(TypeError)
    expect(() => vodjaDnevniPdfFilename('abc')).toThrow(TypeError)
  })

  it('DETERMINIZEM: dva builda istega vhoda = bajtno identična; drug now = drugačen (formatni žig); fiksni privzeti žig', () => {
    const v = vhod()
    expect(zgradi(v).equals(zgradi(v))).toBe(true)
    expect(zgradi(v, new Date('2026-06-01T12:00:00.000Z')).equals(zgradi(v))).toBe(false)
    expect(VODJA_PDF_ZIG_FIKSNI.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(zgradi(v).equals(zgradi(v, VODJA_PDF_ZIG_FIKSNI))).toBe(true)
  })

  it('vsebina WYSIWYG po vhodu: drug KPI / drugi termini → RAZLIČEN bajtni odtis (vsebina sledi resnici)', () => {
    const a = zgradi(vhod())
    expect(zgradi(vhod(kpi(100))).equals(a)).toBe(false)
    expect(
      zgradi(
        vhod(kpi(), [
          {
            datumZacetka: '2026-09-30T09:00:00.000Z',
            status: 'ZAKLJUCENO',
            project: { nazivProjekta: 'Drug projekt', customer: null },
            crew: null,
          },
        ]),
      ).equals(a),
    ).toBe(false)
  })

  it('EN VIR: vhod POSREDOVAN + vse primitivne izpeljave UVOŽENE iz brata + NIČ redefinicij glav/formatov', () => {
    expect(lib).toMatch(
      /import \{[^}]*formatEurCsv[^}]*formatUraVodja[^}]*preveriVodjaIzvozVhod[^}]*terminStatusLabel[^}]*vodjaKpiVrstice[^}]*\} from '\.\/vodja-csv'/s,
    )
    expect(lib).toContain('VODJA_KPI_GLAVE')
    expect(lib).toContain('VODJA_TERMINI_GLAVE')
    expect(lib).toContain('VODJA_VIR_NIZ')
    // NI lastnih definicij (EN VIR ostane v bratu)
    expect(lib).not.toContain('export function formatEurCsv')
    expect(lib).not.toContain('export function terminStatusLabel')
    expect(lib).not.toContain("['Čas', 'Projekt'")
    expect(lib).not.toContain("['Sekcija'")
    // obrnjena regresija: PDF funkcij NI v bratu (cikel in duplikat tiran —
    // r318 lekcija 1: ena definicija, EN lib)
    expect(bratLib).not.toContain('jspdf')
    expect(bratLib).not.toContain('buildVodjaDnevniPdfDoc')
    expect(bratLib).not.toContain('vodjaDnevniPdfFilename')
    expect(bratLib).not.toContain('generateVodjaDnevniPdf')
  })

  it('CSV bajtno nespremenjen (arhivska stabilnost R163): fiksni vhod → točen znani niz + NIČ vir meta vrstice', () => {
    const v = vhod(kpi(), [])
    const { csv, vrstic } = buildVodjaCsv(v)
    const priakovano = [
      '\uFEFF"Pregled za vodjo — dnevni izvoz","30.09.2026"',
      '"Sekcija","Kazalnik","Vrednost"',
      '"Danes","Termini","3"',
      '"Danes","V teku","2"',
      '"Danes","Zaključeni","1"',
      '"Ta mesec","Prihodek (plačano)","1.235 €"',
      '"Ta mesec","Marža (25%)","309 €"',
      '"Ta mesec","Projektov","5"',
      '"Ta mesec","Ure","42"',
      '"Ta mesec","Odprto (izdano)","2.500 €"',
      '"Ta mesec","Zapadlo","700 € (2)"',
      '"Opozorila","Potekli opomniki","1"',
      '"Opozorila","Nizka zaloga","4"',
      '"Opozorila","Odprta naročila","6"',
      '"Opozorila","Brez dobavitelja","0"',
      '"Opozorila","Zamujena dobava","3"',
      '"Skupno","Projektov","120"',
      '"Skupno","Strank","87"',
      '"Skupno","Skupni LTV","54.321 €"',
      '"Prihodki","september","1.235 €"',
      '"Prihodki","avgust","999 €"',
    ].join('\n')
    expect(csv).toBe(priakovano)
    expect(vrstic).toBe(21)
    // arhivska stabilnost: CSV NE nosi novega vir niza (kontrakt R324 nosi PDF)
    expect(csv).not.toContain('DNEVNI_PREGLED_VODJE')
  })

  it('WYSIWYG EN VIR: KPI vrstice (vodjaKpiVrstice) so ISTA ravnina kot CSV vrstice + glave EN VIR + termini fallback', () => {
    const v = vhod()
    const { csv } = buildVodjaCsv(v)
    const vrstice = vodjaKpiVrstice(v.kpi, v.prihodki, 'test')
    // vsaka KPI vrstica citirana = CSV strojna vrstica (ISTI vrstni red)
    const strojne = vrstice.map((x) => [x.sekcija, x.kazalnik, x.vrednost].map((f) => `"${f}"`).join(','))
    for (const s of strojne) expect(csv).toContain(s)
    // glave EN VIR: ISTI nizi kot CSV glava
    expect(csv).toContain(VODJA_KPI_GLAVE.map((g) => `"${g}"`).join(','))
    expect(csv).toContain(VODJA_TERMINI_GLAVE.map((g) => `"${g}"`).join(','))
    // termini: ura EN VIR + status fallback ISTO kot značka na zaslonu
    expect(csv).toContain('"08:30","Parkirišče Kranj","Jože Novak","Ekipa A","V teku"')
    expect(csv).toContain('"13:00","Balkan Ljubljana",,,"Načrtovano"')
    expect(formatUraVodja('2026-09-30T08:30:00.000Z', 't')).toBe('08:30')
    expect(terminStatusLabel('NEZNAN_PROJEKTNI')).toBe('Načrtovano')
    expect(formatEurCsv(1234.5)).toBe('1.235 €')
  })

  it('kje VERBATIM (lift kanon R323): sporočila nosijo ime graditelja — CSV in PDF ISTA pravila, RAZLIČEN kje', () => {
    const pokvaren = { kpi: null, termini: [], prihodki: [], danesIso: '2026-09-30' } as unknown as Parameters<typeof buildVodjaCsv>[0]
    expect(() => buildVodjaCsv(pokvaren)).toThrow('buildVodjaCsv: pričakovan objekt kpi')
    expect(() => buildVodjaDnevniPdfDoc(pokvaren as never)).toThrow(
      'buildVodjaDnevniPdfDoc: pričakovan objekt kpi',
    )
    const nemogoč = { kpi: kpi(), termini: [], prihodki: [], danesIso: '2026-13-99' }
    expect(() => buildVodjaCsv(nemogoč)).toThrow('buildVodjaCsv: nemogoč referenčni datum: 2026-13-99')
    expect(() => buildVodjaDnevniPdfDoc(nemogoč as never)).toThrow(
      'buildVodjaDnevniPdfDoc: nemogoč referenčni datum: 2026-13-99',
    )
  })

  it('fail-closed: negativen števec / ne-končen znesek / pokvaren termin / now / options / vhod → TypeError z imenom graditelja', () => {
    const neg = vhod(kpi())
    neg.kpi.potekliOpomniki = -1
    expect(() => buildVodjaDnevniPdfDoc(neg)).toThrow(
      'buildVodjaDnevniPdfDoc: pričakovano ne-negativno celo število za potekliOpomniki: -1',
    )
    const znesek = vhod(kpi())
    znesek.kpi.mesecniPrihodek = Number.NaN
    expect(() => buildVodjaDnevniPdfDoc(znesek)).toThrow(
      'buildVodjaDnevniPdfDoc: pričakovano končen znesek za mesecniPrihodek: NaN',
    )
    const pokvarenTermin = vhod(kpi(), [
      {
        datumZacetka: 'ni datum',
        status: 'V_TEKU',
        project: { nazivProjekta: 'X', customer: null },
        crew: null,
      },
    ])
    expect(() => buildVodjaDnevniPdfDoc(pokvarenTermin)).toThrow(
      'buildVodjaDnevniPdfDoc: neveljaven datumZacetek termina: ni datum',
    )
    expect(() => buildVodjaDnevniPdfDoc(vhod(), { now: 'ne-date' as unknown as Date })).toThrow(
      'buildVodjaDnevniPdfDoc: pričakovan veljaven now: Date',
    )
    expect(() =>
      buildVodjaDnevniPdfDoc(vhod(), null as unknown as VodjaDnevniPdfOptions),
    ).toThrow('buildVodjaDnevniPdfDoc: pričakovane opcije (VodjaDnevniPdfOptions)')
    expect(() => buildVodjaDnevniPdfDoc(null as never)).toThrow(
      'buildVodjaDnevniPdfDoc: pričakovan vhod (kpi, termini, prihodki, danesIso)',
    )
  })

  it('EN VIR validacijska družina: preveriVodjaStevilo/Znesek + preveriVodjaIzvozVhod javno izvožena (dvig kanon R323)', () => {
    expect(() => preveriVodjaStevilo(-1, 'x', 'kje')).toThrow('kje: pričakovano ne-negativno celo število za x: -1')
    expect(() => preveriVodjaZnesek(Number.POSITIVE_INFINITY, 'y', 'kje')).toThrow('kje: pričakovano končen znesek za y: Infinity')
    expect(() => preveriVodjaIzvozVhod({ kpi: kpi(), termini: 'x' as never, prihodki: [], danesIso: '2026-09-30' }, 'kje')).toThrow(
      'kje: pričakovano polje terminov',
    )
    expect(preveriVodjaStevilo(3, 'x', 'kje')).toBe(3)
  })

  it('VODJA_VIR_NIZ: družinski kontrakt (vzorec AUDIT_VIR_NIZ R318) — PDF lib ga nosi v sklepni vrstici', () => {
    expect(VODJA_VIR_NIZ).toBe('DNEVNI_PREGLED_VODJE — isti HEAD = bajtno identičen izvoz')
    expect(lib).toContain('`Vir: ${VODJA_VIR_NIZ}`')
    expect(bratLib).toContain("export const VODJA_VIR_NIZ = 'DNEVNI_PREGLED_VODJE")
  })

  it('determinizem v libu: brez volatilnega časa v vsebini + setCreationDate/setFileId + seed nosi celotno resnico', () => {
    expect(lib).not.toContain('Izvoženo ob')
    expect(lib).not.toContain('toLocaleDateString')
    expect(lib).toContain('doc.setCreationDate(now)')
    expect(lib).toContain('doc.setFileId(')
    expect(lib).toContain('resnicaSeed(input)')
    // soli 0xcd–0xd0 (register: 0xc1–0xc4 R318, 0xc5–0xc8 R320, 0xc9–0xcc R321)
    expect(lib).toContain('0xcd')
    expect(lib).toContain('0xd0')
    // seed nosi danesIso + KPI + prihodke + termine (vse je del resnice)
    expect(lib).toContain('D:${input.danesIso}')
    expect(lib).toContain('input.prihodki.map')
    expect(lib).toContain('input.termini')
  })

  it('vodja žičenje: gumb + aria + title + handler z EN VIR vhodom + iskreno ničelno vejo + fail-verbose toast', () => {
    expect(komponenta).toContain('aria-label="Izvozi dnevni pregled vodje kot PDF"')
    expect(komponenta).toContain('title="Izvozi dnevni pregled (KPI, opozorila in današnji termini) kot deterministični PDF"')
    expect(komponenta).toContain('onClick={exportDailyPdf}')
    expect(komponenta).toContain("from '@/lib/vodja-dnevni-pdf'")
    expect(komponenta).toContain('generateVodjaDnevniPdf(vhod)')
    expect(komponenta).toContain('vodjaDnevniPdfFilename(vhod.danesIso)')
    // iskrena ničelna veja (statistika še ni prišla — nič izmišljenega izvoza)
    expect(komponenta.match(/if \(!vhod\) return/g)?.length).toBe(2)
    // fail-verbose: razlog vidno, ne tiho (kanon r203)
    expect(komponenta.match(/Izvoz ni uspel/g)?.length).toBeGreaterThan(1)
  })

  it('komponenta EN VIR: vodjaIzvozVhod = ENA preslikava vhoda, DVA potrošnika (CSV + PDF) — NIČ podvojenega KPI preslikave', () => {
    // 3 pojavitve: 1 definicija + 2 klica (exportDailyCsv + exportDailyPdf)
    expect(komponenta.match(/vodjaIzvozVhod\(\)/g)?.length).toBe(3)
    expect(komponenta).toContain('function vodjaIzvozVhod()')
    // preslikava KPI je ENA (obrnjena regresija duplikata)
    expect(komponenta.match(/danasTermini: stats\.danasTermini/g)?.length).toBe(1)
    // CSV brat ŠE VEDNO žičen (obrnjena regresija R163)
    expect(komponenta).toContain('buildVodjaCsv(vhod)')
    expect(komponenta).toContain('aria-label="Izvozi dnevni pregled vodje kot CSV"')
  })

  it('generateVodjaDnevniPdf: shrani pod bratskim imenom (pregled-vodje_<datum>.pdf)', () => {
    // kanon pregled: generate = build + save z EN VIR imenom (tudi pokvaren
    // vhod je odklonjen PREJ — fail-closed brezplačno; validacija: kpi prvi,
    // zato kje-nemogoč datum testiramo z veljavnim kpi)
    expect(() => generateVodjaDnevniPdf({ kpi: kpi(), termini: [], prihodki: [], danesIso: '2026-13-99' })).toThrow(
      'buildVodjaDnevniPdfDoc: nemogoč referenčni datum: 2026-13-99',
    )
  })
})
