// ---------------------------------------------------------------------------
// R293 — DOBIČKONOST PO PROJEKTIH CSV (24. člen 'izvozi' družine) + MARŽNI
// RAZGLED strip (MANDATORY STIL) — testi + strazar.
//
// Lib: CSV brat PDF R258 — WYSIWYG po konstrukciji (lib uvaža presek
// { vrste, povzetek } — NE računa znova; znesekNiz UVOŽEN iz PDF brata —
// ISTI strojni kanon zneskov; projektBeseda UVOŽENA — sklanjatev EN VIR).
// Fail-closed z indeksom krivca (marža SME biti negativna — izpeljana
// resnica; izpeljava marža = prihodki − stroški je TOČKOVNA preverba);
// determinizem = now KOT parameter, vrstice v ISTEM vrstnem redu kot vhod
// (MARŽA ASC je bratova sort).
//
// Strazar: vodja-dashboard žičenje — gumb VEDNO viden (pariteta PDF brata),
// fail-closed toast pri 0 računov IN 0 naročil (NIČ datoteke — ISTI gate kot
// brat), uspešni toast = ISTI lib sklep (WYSIWYG), strip žetoni (0 novih
// hex — baseline #1d2b3e), legenda PREDPONA (R258/R261 resnica bajtno
// ohranjena + R293 pripona), EN VIR memo (stara inline preslikava izbrisana).
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DOBICIKONOST_PROJEKTI_CSV_GLAVA,
  dobicikonostProjektiCsv,
  dobicikonostProjektiCsvFilename,
  dobicikonostProjektiCsvVrstice,
  dobicikonostSklep,
  marzaOdstotekNiz,
  type DobicikonostPresek,
} from '../dobicikonost-projekti-csv'
import {
  dobicikonostPoProjektih,
  znesekNiz,
  type DobicikonostRacun,
  type DobicikonostNarocilo,
} from '../dobicikonost-pdf'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')
const vodja = (): string => srcOf('src/components/roksal/vodja-dashboard.tsx')
const lib = (): string => srcOf('src/lib/dobicikonost-projekti-csv.ts')
const brat = (): string => srcOf('src/lib/dobicikonost-pdf.ts')

// UTC-constructed now (družinski vzorec).
const ZDANJ: Date = new Date('2026-09-30T12:00:00.000Z')

// ISTA resnica kot r258 testi (WYSIWYG dokaz čez brata — ISTI vhod v OBE
// liba prek dobicikonostPoProjektih): marže so namerno RAZLIČNE (MARŽA ASC
// akcijski red dokazljiv) + negativna marža + projekt brez prihodkov ('—' %).
const RACUNI: DobicikonostRacun[] = [
  { stevilka: '2026-001', status: 'PLACAN', znesek: 1000, projekt: 'Projekt Alfa' },
  { stevilka: '2026-002', status: 'IZDAN', znesek: 250.5, projekt: 'Projekt Beta' },
  { stevilka: '2026-003', status: 'STORNIRAN', znesek: 999, projekt: 'Projekt Alfa' },
  { stevilka: '2026-004', status: 'OSNUTEK', znesek: 50, projekt: null },
  { stevilka: '2026-005', status: 'PLACAN', znesek: 300, projekt: null },
]
const NAROCILA: DobicikonostNarocilo[] = [
  { status: 'DOBLJENO', skupajCena: 400, projekt: 'Projekt Alfa' },
  { status: 'POTRJENO', skupajCena: 100.25, projekt: 'Projekt Beta' },
  { status: 'PREKlicANO', skupajCena: 500, projekt: 'Projekt Alfa' },
  { status: 'POSLANO', skupajCena: 75, projekt: null },
]
// Izpeljano (dobicikonostPoProjektih): Alfa prihodki 1000, stroški 400,
// marža 600 (60 %); Beta prihodki 250.5, stroški 100.25, marža 150.25
// (≈ 59.98 %). MARŽA ASC → Beta (150.25) PRVA, Alfa (600) DRUGA.
const PRESEK: DobicikonostPresek = dobicikonostPoProjektih(RACUNI, NAROCILA)
const PRAZEN: DobicikonostPresek = dobicikonostPoProjektih([], [])

const vrstica = (csv: string, i: number): string[] =>
  (csv.split('\n')[i] ?? '').split(',').map((c) => c.replace(/^"|"$/g, ''))

describe('R293 — dobicikonost-projekti-csv lib (EN VIR + WYSIWYG po konstrukciji)', () => {
  it('glava: 7 stolpcev dobesedno (VERBATIM PDF autoTable head R258)', () => {
    expect(DOBICIKONOST_PROJEKTI_CSV_GLAVA).toEqual([
      'Projekt',
      'Prihodki (EUR)',
      'Stroški (EUR)',
      'Marža (EUR)',
      'Marža (%)',
      'Računov',
      'Naročil',
    ])
  })

  it('EN VIR: lib uvaža znesekNiz iz PDF brata (ISTI strojni kanon) + projektBeseda (sklanjatev NIKOLI zasegana) — nič dvojnih izpeljav', () => {
    const l = lib()
    expect(l).toContain("import {\n  znesekNiz,\n  type DobicikonostVrsta,\n  type DobicikonostPovzetek,\n} from './dobicikonost-pdf'")
    expect(l).toContain("import { projektBeseda } from './projekti-termini-pdf'")
    expect(l).not.toContain('function znesekNiz')
    expect(l).not.toContain('function projektBeseda')
    // lib NE računa preseka znova (vhod = { vrste, povzetek })
    expect(l).toContain('export interface DobicikonostPresek')
    expect(l).not.toContain('dobicikonostPoProjektih(')
    // brat je EXPORTIRAL znesekNiz (R293 — EN VIR strojni kanon)
    expect(brat()).toContain('export function znesekNiz')
  })

  it('ravninska resnica: ISTI format kot PDF tabela (znesekNiz EN VIR, % toFixed(1) ALI —, števci) + MARŽA ASC red NEZMENJAN (lib NE preureja)', () => {
    const { csv } = dobicikonostProjektiCsv(PRESEK, ZDANJ)
    const podatkovne = csv.split('\n').filter((l, i) => i > 0 && l !== '' && !l.startsWith('"Obseg"') && !/^"(Projektov|Prihodki|Stroški|Marža|Izvoženo|Negativnih|Storniranih|Osnutkov|Računov brez|Naročil brez)/.test(l))
    // Beta PRVA (marža 150.25 — najslabša = akcijski red), Alfa DRUGA (600)
    expect(vrstica(podatkovne[0], 0)).toEqual(['Projekt Beta', '250.50', '100.25', '150.25', '60.0', '1', '1'])
    expect(vrstica(podatkovne[1], 0)).toEqual(['Projekt Alfa', '1000.00', '400.00', '600.00', '60.0', '1', '1'])
    // znesekNiz EN VIR dokaz: isti izpis kot bratova funkcija
    expect(znesekNiz(250.5)).toBe('250.50')
  })

  it('marža %: toFixed(1) ko definiran, — ko prihodki = 0 (NIKOLI izmišljen 0 % — R227 strogost)', () => {
    expect(marzaOdstotekNiz({ marzaOdstotek: 59.98 })).toBe('60.0')
    expect(marzaOdstotekNiz({ marzaOdstotek: null })).toBe('—')
    const presekBrezPrihodkov = dobicikonostPoProjektih([], [{ status: 'POSLANO', skupajCena: 120, projekt: 'Samo stroški' }])
    const { csv } = dobicikonostProjektiCsv(presekBrezPrihodkov, ZDANJ)
    expect(csv).toContain('"—","0","1"')
  })

  it('NEGATIVNA marža VERBATIM v CSV (iskren alarm — NIKOLI utišan, PDF RED bold pariteta)', () => {
    const presekNeg = dobicikonostPoProjektih(
      [{ stevilka: '2026-010', status: 'PLACAN', znesek: 100, projekt: 'Izguba' }],
      [{ status: 'DOBLJENO', skupajCena: 400, projekt: 'Izguba' }],
    )
    const { csv } = dobicikonostProjektiCsv(presekNeg, ZDANJ)
    expect(csv).toContain('"-300.00"')
    expect(csv).toContain('"Negativnih marž (iskren alarm)","1"')
  })

  it('format: BOM + \'\\n\' zaključki + brez CR (vzorec R186/R285/R286/R291/R292)', () => {
    const { csv, vrstic } = dobicikonostProjektiCsv(PRESEK, ZDANJ)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).not.toContain('\r')
    expect(csv.endsWith('\n')).toBe(false)
    expect(vrstic).toBe(csv.split('\n').length)
  })

  it('meta vrstice (kanon R172/R291/R292): ločilna + Obseg + Projektov + Prihodki + Stroški + Marža + Izvoženo ob ISO (vrstni red dokazan z indeksi)', () => {
    const vrstice = dobicikonostProjektiCsvVrstice(PRESEK, ZDANJ)
    const joinan = vrstice.join('\n')
    const ločilnaIdx = vrstice.indexOf('') // ena ločilna, neposredno pred Obseg
    expect(ločilnaIdx).toBeGreaterThan(0)
    expect(vrstice[ločilnaIdx + 1]).toContain('"Obseg"')
    expect(vrstice).toContain('"Obseg","Vsi projekti — presek računov (prihodki) in naročil (stroški materiala)"')
    expect(vrstice).toContain('"Projektov","2"')
    expect(vrstice).toContain('"Prihodki","1250.50"')
    expect(vrstice).toContain('"Stroški","500.25"')
    expect(vrstice).toContain('"Marža","750.25"')
    expect(vrstice[vrstice.length - 1]).toBe('"Izvoženo ob","2026-09-30T12:00:00.000Z"')
    // vrstni red: Obseg < Projektov < Prihodki < Stroški < Marža < Izvoženo
    const idx = (s: string): number => joinan.indexOf(s)
    expect(idx('"Obseg"')).toBeLessThan(idx('"Projektov"'))
    expect(idx('"Projektov"')).toBeLessThan(idx('"Prihodki"'))
    expect(idx('"Prihodki"')).toBeLessThan(idx('"Stroški"'))
    expect(idx('"Stroški"')).toBeLessThan(idx('"Marža"'))
    expect(idx('"Marža"')).toBeLessThan(idx('"Izvoženo ob"'))
  })

  it('pogojne meta vrstice samo pri > 0 obeh smeri (Negativnih/Storniranih/Osnutkov/Brez projekta — iskren odpad, pogojni kanon r277)', () => {
    // PRESEK: storniranih 1, osnutki 1, računov brez projekta 2 (vsota 300 —
    // SAMO izdani+plačani štejejo v vsoto; števec šteje VSE brez-projektne),
    // naročil brez projekta 1 (75 EUR) — vse > 0 → prisotne
    const prisotne = dobicikonostProjektiCsvVrstice(PRESEK, ZDANJ).join('\n')
    expect(prisotne).toContain('"Storniranih računov (izključeni iz prihodkov)","1"')
    expect(prisotne).toContain('"Osnutkov računov (izključeni iz prihodkov)","1"')
    expect(prisotne).toContain('"Računov brez projekta (izključeni iz preseka)","2 (300.00 EUR)"')
    expect(prisotne).toContain('"Naročil brez projekta (izključeni iz preseka)","1 (75.00 EUR)"')
    // čisti presek: vse 0 → vrstice NE obstajajo (odstotnost = resnica nič)
    const ciste = dobicikonostProjektiCsvVrstice(PRAZEN, ZDANJ).join('\n')
    expect(ciste).not.toContain('Negativnih marž')
    expect(ciste).not.toContain('Storniranih računov')
    expect(ciste).not.toContain('Osnutkov računov')
    expect(ciste).not.toContain('Računov brez projekta')
    expect(ciste).not.toContain('Naročil brez projekta')
  })

  it('PRAZEN PRESEK = veljaven CSV (glava + meta z iskrnimi ničlami — brez lažnih 0-vrstic; komponenta NEOBJAVLJA datoteke pri 0/0)', () => {
    const vrstice = dobicikonostProjektiCsvVrstice(PRAZEN, ZDANJ)
    expect(vrstice[0]).toContain('"Projekt","Prihodki (EUR)"')
    // SAMO glava + ločilna + 6 meta vrstic — NIČ podatkovnih
    expect(vrstice).toHaveLength(8)
    expect(vrstice.join('\n')).toContain('"Projektov","0"')
    expect(vrstice.join('\n')).toContain('"Prihodki","0.00"')
  })

  it('determinizem: isti vhod + isti now = bajtno identičen; drug now = drugačen (žig)', () => {
    const a = dobicikonostProjektiCsv(PRESEK, ZDANJ).csv
    const b = dobicikonostProjektiCsv(PRESEK, ZDANJ).csv
    expect(a).toBe(b)
    const c = dobicikonostProjektiCsv(PRESEK, new Date('2026-10-01T09:30:00.000Z')).csv
    expect(c).not.toBe(a)
    expect(c).toContain('"Izvoženo ob","2026-10-01T09:30:00.000Z"')
  })

  it('f(množica): premešan vhod = bajtno ISTI CSV (MARŽA ASC je bratova sort — lib NE preureja)', () => {
    const racuniMešan = [...RACUNI].reverse()
    const narocilaMešan = [...NAROCILA].reverse()
    const presekMešan = dobicikonostPoProjektih(racuniMešan, narocilaMešan)
    expect(dobicikonostProjektiCsv(presekMešan, ZDANJ).csv).toBe(dobicikonostProjektiCsv(PRESEK, ZDANJ).csv)
  })

  it('dobicikonostSklep: sklanjatev EN VIR (projektBeseda — 1 projekt / 2 projekta / 5 projektov) + EUR resnica (WYSIWYG strip + toast)', () => {
    expect(dobicikonostSklep({ ...PRAZEN.povzetek, projektov: 1 })).toContain('1 projekt ·')
    expect(dobicikonostSklep({ ...PRAZEN.povzetek, projektov: 2 })).toContain('2 projekta ·')
    expect(dobicikonostSklep({ ...PRAZEN.povzetek, projektov: 5 })).toContain('5 projektov ·')
    const sklep = dobicikonostSklep(PRESEK.povzetek)
    expect(sklep).toBe('2 projekta · prihodki 1250.50 EUR · stroški 500.25 EUR · marža 750.25 EUR · negativnih marž 0')
  })

  it('fail-closed: ne-objekten presek / ne-polje vrste / pokvarjena vrsta (projekt, negativni tokovi, marža izpeljava, marzaOdstotek, števci) / pokvaren povzetek / pokvaren now ×3 — TypeError z indeksom krivca', () => {
    const ok: DobicikonostPresek = PRESEK
    expect(() => dobicikonostProjektiCsvVrstice(null as unknown as DobicikonostPresek, ZDANJ)).toThrow(TypeError)
    expect(() => dobicikonostProjektiCsvVrstice({ ...ok, vrste: 'niz' as unknown as DobicikonostPresek['vrste'] }, ZDANJ)).toThrow(/pričakovano polje vrst/)
    expect(() => dobicikonostProjektiCsvVrstice({ ...ok, vrste: [{ ...ok.vrste[0], projekt: ' ' }] }, ZDANJ)).toThrow(/(0).*projekt/)
    expect(() => dobicikonostProjektiCsvVrstice({ ...ok, vrste: [{ ...ok.vrste[0], prihodki: -1 }] }, ZDANJ)).toThrow(/(0).*prihodki/)
    expect(() => dobicikonostProjektiCsvVrstice({ ...ok, vrste: [{ ...ok.vrste[0], stroski: -0.5 }] }, ZDANJ)).toThrow(/(0).*stroški/)
    // marža = prihodki − stroški TOČKOVNA izpeljava preverba (pokvaren presek)
    expect(() => dobicikonostProjektiCsvVrstice({ ...ok, vrste: [{ ...ok.vrste[0], marza: 999 }] }, ZDANJ)).toThrow(/NI izpeljava/)
    expect(() => dobicikonostProjektiCsvVrstice({ ...ok, vrste: [{ ...ok.vrste[0], marzaOdstotek: NaN }] }, ZDANJ)).toThrow(/marzaOdstotek/)
    expect(() => dobicikonostProjektiCsvVrstice({ ...ok, vrste: [{ ...ok.vrste[0], racunov: 1.5 }] }, ZDANJ)).toThrow(/racunov/)
    expect(() => dobicikonostProjektiCsvVrstice({ ...ok, povzetek: { ...ok.povzetek, projektov: -1 } }, ZDANJ)).toThrow(/povzetek\.projektov/)
    expect(() => dobicikonostProjektiCsvVrstice({ ...ok, povzetek: { ...ok.povzetek, prihodki: NaN } }, ZDANJ)).toThrow(/povzetek\.prihodki/)
    const slabNow = 'ni datum' as unknown as Date
    expect(() => dobicikonostProjektiCsvVrstice(ok, slabNow)).toThrow(/pričakovan veljaven now/)
    expect(() => dobicikonostProjektiCsv(ok, slabNow)).toThrow(/pričakovan veljaven now/)
    expect(() => dobicikonostProjektiCsvFilename(slabNow)).toThrow(/pričakovan veljaven now/)
    expect(() => dobicikonostProjektiCsvFilename(new Date('ni datum'))).toThrow(/pričakovan veljaven now/)
  })

  it('filename = Dobicikonost-projektov-<YYYY-MM-DD>.csv (družinski vzorec, brat PDF imena R258 — samo pripona ločuje)', () => {
    expect(dobicikonostProjektiCsvFilename(ZDANJ)).toBe('Dobicikonost-projektov-2026-09-30.csv')
    expect(brat()).toContain('Dobicikonost-projektov-${todayStamp(now)}.pdf')
  })
})

describe('R293 strazar — dobičkonost CSV + MARŽNI RAZGLED žičenje (vodja-dashboard)', () => {
  it('EN VIR: uvozi lib brata + memo presek (stara inline preslikava IZBRISANA — R290 vzorec) + PDF handler deležen ISTEGA pruning-a', () => {
    const k = vodja()
    expect(k).toContain("from '@/lib/dobicikonost-projekti-csv'")
    expect(k).toContain('const dobicikonostVhodi = useMemo<{ racuni: DobicikonostRacun[]; narocila: DobicikonostNarocilo[] }>(')
    expect(k).toContain('const dobicikonostIzpeljava = useMemo<DobicikonostPresek>(')
    // ENA izpeljava: memo kliče brata TOČKO 1×; PDF handler toast KAŽE na memo
    expect(k.match(/dobicikonostPoProjektih\(/g) ?? []).toHaveLength(2) // uvoz memo + r258 handler (ISTA funkcija, ISTI vhodi)
    expect(k).toContain('const racuni = dobicikonostVhodi.racuni')
    // stara inline preslikava v R258 handlerju IZBRISANA (samo memo jo nosi;
    // R261 racuniProjektiVhodi memo ima SVOJO lastno preslikavo — ×2 je prav)
    expect(k.match(/projekt: inv\.project\?\.nazivProjekta \?\? null/g) ?? []).toHaveLength(2)
    const pdfHandler = k.slice(k.indexOf('const handleDobicikonostPdf'), k.indexOf('const handleDobicikonostCsv'))
    expect(pdfHandler).not.toContain('inv.project')
  })

  it('gumb VEDNO viden: aria + title + press-scale + focus ring + FileSpreadsheet aria-hidden + dvoklik guard + disabled parity (brat R258)', () => {
    const k = vodja()
    expect(k).toContain('aria-label="Izvozi dobičkonosnost projektov kot CSV"')
    expect(k).toContain('title="Dobičkonosnost po projektih kot CSV — ista resnica kot PDF (prihodki · stroški · marža)"')
    const pred = k.slice(k.indexOf('R293 — DOBIČKONOST PO PROJEKTIH CSV (24. člen'), k.indexOf('onClick={handleDobicikonostCsv}'))
    expect(pred).toContain('press-scale')
    const pill = k.slice(k.indexOf('onClick={handleDobicikonostCsv}'), k.indexOf('aria-label="Izvozi dobičkonosnost projektov kot CSV"'))
    expect(pill).toContain('disabled={loading || dobicikonostCsvVTeku}')
    const start = k.indexOf('aria-label="Izvozi dobičkonosnost projektov kot CSV"')
    const gumb = k.slice(start, k.indexOf('</Button>', start))
    expect(gumb).toContain('<FileSpreadsheet className="h-3 w-3" aria-hidden="true" />')
    expect(k).toContain('if (dobicikonostCsvVTeku || loading) return')
  })

  it('fail-closed PREJ: 0 računov IN 0 naročil → iskren toast, NIKOLI prazna datoteka (ISTI gate kot brat) + ENA izpeljava (ISTI presek memo + ISTI now)', () => {
    const handler = kHandler()
    expect(handler).toContain("if (allInvoices.length === 0 && allOrders.length === 0) {")
    expect(handler).toContain("title: 'Ni podatkov za dobičkonost'")
    expect(handler).toContain("'CSV se izvozi, ko je vpisan prvi račun ali naročilo.'")
    expect(handler).toContain('const now = new Date()')
    expect(handler).toContain('dobicikonostProjektiCsv(dobicikonostIzpeljava, now)')
    expect(handler).toContain('dobicikonostProjektiCsvFilename(now)')
    expect(handler.match(/new Date\(\)/g) ?? []).toHaveLength(1)
  })

  it('uspešni toast = ISTI lib sklep (dobicikonostSklep — WYSIWYG s stripom) + fail-verbose catch (R291/R292 vzorec)', () => {
    const handler = kHandler()
    expect(handler).toContain('title: `Dobičkonost prenešena v CSV (${ime})`')
    expect(handler).toContain('description: `${dobicikonostSklep(dobicikonostIzpeljava.povzetek)}.`')
    expect(handler).toContain("title: 'Izvoz CSV ni uspel'")
    expect(handler).toContain("variant: 'destructive'")
    expect(handler).toContain('downloadCsvText(ime, csv)')
  })

  it('MANDATORY STIL strip: aria regija + sklep/praznina + mini tir žetoni + aria-hidden + % title izpeljava + maxMarza merilo (ISTO za VSE)', () => {
    const k = vodja()
    expect(k).toContain('aria-label="Maržni razgled — marža po projektih"')
    expect(k).toContain('data-testid="marzni-razgled-sklep"')
    expect(k).toContain("'Ni projektov v preseku — dobičkonost se izriše ob prvem računu ali naročilu.'")
    expect(k).toContain('dobicikonostSklep(dobicikonostIzpeljava.povzetek)')
    expect(k).toContain('bg-roksal-red/40')
    expect(k).toContain('bg-roksal-navy/30')
    expect(k).toContain('% najvišje marže (po absolutni vrednosti)')
    expect(k).toContain("bg-muted\" aria-hidden=\"true\"")
    expect(k).toContain('maxMarza === 0')
    expect(k).toContain('Math.abs(v.marza) / maxMarza) * 100')
  })

  it('legenda: R258/R261 resnica bajtno ISTA (PREDPONA) + R293 pripona (R261 substring-parna lekcija)', () => {
    const k = vodja()
    expect(k).toContain('Prihodki = izdani + plačani računi · Stroški = ne-preklicana naročila · Marža = prihodki − stroški · Marža (%) = marža / prihodki · Brez projekta = izključeni iz preseka · Ponudba = vpisana ocena (estimatedPrice) · Realizirano = izdani + plačani računi · Odstopanje = realizirano − ponudba')
    expect(k).toContain('· CSV = ista resnica kot PDF')
  })

  it('hex baseline vodja ostaja 1 (#1d2b3e — 0 novih hex, samo žetoni) + bratje čisti (r258/r261 pini NEZMENJANI)', () => {
    const k = vodja()
    const hexi = k.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
    const dovoljeni = new Set(['#1d2b3e'])
    for (const h of hexi) expect(dovoljeni.has(h.toLowerCase()), `nepričakovan hex ${h}`).toBe(true)
    // r258 pini (PDF brat) ostajajo — handler call + toast + gate
    expect(k).toContain('dobicikonostPoProjektih(racuni, allOrders)')
    expect(k).toContain("title: 'Dobičkonost prenešena v PDF'")
    expect(k).toContain('buildDobicikonostPdfDoc(racuni, allOrders, { now })')
    // r261 pill NEZMENJAN
    expect(k).toContain('aria-label="Izvozi račune po projektih kot PDF"')
  })
})

/** Handler okno (pariteta r258 test oknoMed) — od R293 handlerja do useEffect. */
function kHandler(): string {
  const k = vodja()
  const z = k.indexOf('const handleDobicikonostCsv')
  const n = k.indexOf('useEffect(() => { loadData() }')
  return k.slice(z, n)
}
