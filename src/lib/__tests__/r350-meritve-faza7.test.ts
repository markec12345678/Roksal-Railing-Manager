// R350 — dekompozicija measurements-tab FAZA 7: ostanki starejše izvozne
// družine EN VIR (vzorec FAZA 5/R348 + FAZA 6/R349 + kalkulator FAZA
// 2/R325 pdf-exports + r269 build/generate razcep).
// ---------------------------------------------------------------------------
//  • measurements/izvoz-csv.ts razširjen: STEBRI_CSV_HEADER +
//    zgradiStebriVrstice (8-stolpčni per-segment kontrakt R156) +
//    ZGODOVINA_CSV_HEADER + zgradiZgodovinaVrstice (6-stolpčni lokalni
//    zgodovina kontrakt) — VERBATIM iz taba; izvožene datoteke bajtno iste;
//  • measurements/pdf-seznam.ts NOV: buildSeznamPdfDoc (čist gradnik) +
//    exportSeznamPdf (tanki wrapper z doc.save) — 85-vrstični inline jsPDF
//    blok izluščen iz taba; ENA eksplicitna odstopka (setCreationDate(
//    izvozenoOb) — kanon r269 determinizem); izvoženi PDF vsebinsko bajtno
//    enak;
//  • kolizije preverjene: lib/audit-csv.ts = SISTEMSKA revizijska sled
//    (user/IP/Vloga kontrakt R162) — NI kolizija z lokalno zgodovino meritev;
//  • stale kopije IZGINILE: inline vrstični gradniki (stebri ×8 polj +
//    zgodovina ×6 polj) + 85-vrstični PDF blok ne dihajo več v tabu;
//  • determinizem: enak vhod = bajtno enak izhod (CSV + PDF);
//  • 0 novih hex (FAZA 7 = premik teles; barve nedotaknjene).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MERITVE_CSV_HEADER,
  STEBRI_CSV_HEADER,
  ZGODOVINA_CSV_HEADER,
  zgradiMeritveVrstice,
  zgradiStebriVrstice,
  zgradiZgodovinaVrstice,
  type StebriVrsticaVhod,
  type ZgodovinaVrsticaVhod,
} from '@/components/roksal/measurements/izvoz-csv'
import {
  buildSeznamPdfDoc,
  exportSeznamPdf,
  type SeznamPdfMeritev,
} from '@/components/roksal/measurements/pdf-seznam'

const TAB = join(process.cwd(), 'src/components/roksal/measurements-tab.tsx')
const MOD = join(process.cwd(), 'src/components/roksal/measurements/izvoz-csv.ts')
const PDF = join(process.cwd(), 'src/components/roksal/measurements/pdf-seznam.ts')

const tab = readFileSync(TAB, 'utf8')
const mod = readFileSync(MOD, 'utf8')
const pdfMod = readFileSync(PDF, 'utf8')

/** Realni fixture (LEKCIJA R347 4: kanonske vrednosti iz shared.ts labels —
 *  tipStebraLabels.VMESNI = 'Vmesni', materialStebraLabels.ALU = 'ALU',
 *  statusLabels.POTRJENA = 'Potrjena'). */
function steber(over: Partial<StebriVrsticaVhod> = {}): StebriVrsticaVhod {
  return {
    steberOznaka: 'S1',
    oznaka: 'M-1',
    tipStebra: 'VMESNI',
    status: 'POTRJENA',
    pozicijaMm: 1234.6,
    razmikMm: 110.2,
    visinaStebraMm: 1100,
    materialStebra: 'ALU',
    opomba: 'test "navedek"',
    ...over,
  }
}

/** Realni zgodovina fixture (labels.ts auditActionLabels: EDIT =
 *  'Spremenjeno'). */
function zgodovina(over: Partial<ZgodovinaVrsticaVhod> = {}): ZgodovinaVrsticaVhod {
  return {
    timestamp: '2026-10-01T12:00:00.000Z',
    akcija: 'EDIT',
    meritevId: 'm-42',
    opis: 'Status spremenjen',
    staraVrednost: 'Osnutek',
    novaVrednost: 'Potrjena',
    ...over,
  }
}

describe('r350 meritve FAZA 7 — zgradiStebriVrstice (8-stolpčni R156)', () => {
  it('osnovna vrstica z realnimi labeli + citirana besedilna polja', () => {
    const [vrstica] = zgradiStebriVrstice([steber()])
    // tipStebraLabels.VMESNI = 'Vmesni'; statusLabels.POTRJENA = 'Potrjena';
    // materialStebraLabels.ALU = 'ALU'
    expect(vrstica).toContain('"Vmesni"')
    expect(vrstica).toContain('"Potrjena"')
    expect(vrstica).toContain('"ALU"')
    // števila NECITIRANA (VERBATIM kontrakt): poz = Math.round(1234.6) = 1235,
    // raz = Math.round(110.2) = 110, vis = 1100
    expect(vrstica).toBe('"S1","Vmesni","Potrjena",1235,110,1100,"ALU","test ""navedek"""')
  })

  it('fallbacki: brez tipStebra → prazno; status null → OSNUTEK; odsotna števila → prazno, razmik → em-dash', () => {
    const [vrstica] = zgradiStebriVrstice([steber({
      steberOznaka: null,
      tipStebra: null,
      status: null,
      pozicijaMm: null,
      razmikMm: null,
      visinaStebraMm: null,
      materialStebra: null,
      opomba: null,
    })])
    // oznaka: steberOznaka null → fallback m.oznaka ('M-1'); brez tipa → '';
    // status → statusLabels.OSNUTEK = 'Osnutek'; razmik → '—' (em-dash VERBATIM)
    expect(vrstica).toBe('"M-1","","Osnutek",,—,,"",""')
  })

  it('steberOznaka = klicateljeva resnica: oznaka uporabljena SAMO ko steberOznaka manjka', () => {
    const [a] = zgradiStebriVrstice([steber({ steberOznaka: 'AR-3' })])
    expect(a.startsWith('"AR-3",')).toBe(true)
    const [b] = zgradiStebriVrstice([steber({ steberOznaka: undefined, oznaka: 'M-9' })])
    expect(b.startsWith('"M-9",')).toBe(true)
  })

  it('csvEsc: navedki podvojeni (RFC 4180), null → prazno citirano', () => {
    const [vrstica] = zgradiStebriVrstice([steber({ opomba: 'a"b"c', oznaka: null, steberOznaka: null })])
    expect(vrstica.endsWith('"a""b""c"')).toBe(true)
  })

  it('determinizem: enak vhod = bajtno enak izhod (ni ure/naključja v jedru)', () => {
    const seznam = [steber(), steber({ steberOznaka: 'S2', pozicijaMm: 500 })]
    expect(zgradiStebriVrstice(seznam).join('\n')).toBe(zgradiStebriVrstice(seznam).join('\n'))
  })

  it('STEBRI_CSV_HEADER: bajtno enak R156 kontraktu (8 stolpcev)', () => {
    expect(STEBRI_CSV_HEADER).toBe('Oznaka,Tip,Status,Pozicija(mm),Razmik(mm),Visina(mm),Material,Opomba')
  })
})

describe('r350 meritve FAZA 7 — zgradiZgodovinaVrstice (6-stolpčni lokalni audit)', () => {
  it('osnovna vrstica: čas = slDatumKratko + ", " + slCasDolgo (ISTI prikaz kot zaslon), akcija label', () => {
    const [vrstica] = zgradiZgodovinaVrstice([zgodovina()])
    // auditActionLabels.EDIT = 'Spremenjeno'; čas = '1. 10. 2026, HH:MM:SS'
    expect(vrstica).toContain('"Spremenjeno"')
    expect(vrstica).toMatch(/^"1\. 10\. 2026, \d{2}:\d{2}:\d{2}","Spremenjeno","m-42","Status spremenjen","Osnutek","Potrjena"$/)
  })

  it('odprta stara/nova → prazno citirano (pošteno prazno, brez null literala)', () => {
    const [vrstica] = zgradiZgodovinaVrstice([zgodovina({ staraVrednost: undefined, novaVrednost: undefined })])
    expect(vrstica.endsWith(',"",""')).toBe(true)
  })

  it('vse 4 akcije = realni labeli (Dodano/Spremenjeno/Izbrisano/Status)', () => {
    const vrstice = zgradiZgodovinaVrstice([
      zgodovina({ akcija: 'ADD' }),
      zgodovina({ akcija: 'EDIT' }),
      zgodovina({ akcija: 'DELETE' }),
      zgodovina({ akcija: 'STATUS' }),
    ])
    expect(vrstice[0]).toContain('"Dodano"')
    expect(vrstice[1]).toContain('"Spremenjeno"')
    expect(vrstice[2]).toContain('"Izbrisano"')
    expect(vrstice[3]).toContain('"Status"')
  })

  it('determinizem: enak vhod = bajtno enak izhod', () => {
    const seznam = [zgodovina(), zgodovina({ meritevId: 'm-7', akcija: 'ADD' })]
    expect(zgradiZgodovinaVrstice(seznam).join('\n')).toBe(zgradiZgodovinaVrstice(seznam).join('\n'))
  })

  it('ZGODOVINA_CSV_HEADER: bajtno enak kontraktu (6 stolpcev) + NI kolizije s sistemskim lib/audit-csv.ts', () => {
    expect(ZGODOVINA_CSV_HEADER).toBe('Cas,Akcija,MeritevId,Opis,StaraVrednost,NovaVrednost')
    // sistemski kontrakt (R162) ima drugačno zaglavje — dve družini, EN VIR vsak
    expect(ZGODOVINA_CSV_HEADER).not.toBe('Čas,Akcija,Uporabnik,Vloga,E-pošta,IP,Staro stanje,Novo stanje')
  })
})

describe('r350 meritve FAZA 7 — buildSeznamPdfDoc (r269 build/generate razcep)', () => {
  const meritev = (over: Partial<SeznamPdfMeritev> = {}): SeznamPdfMeritev => ({
    id: 'm-1',
    oznaka: 'M-1',
    lokacija: 'Sever',
    tipMeritve: 'RAZDALJA',
    status: 'POTRJENA',
    segmentId: 'seg-1',
    dolzinaMm: 1234,
    visinaMm: 1100,
    kot: 45,
    createdAt: '2026-10-01T12:00:00.000Z',
    ...over,
  })
  const args = () => ({
    measurements: [meritev(), meritev({ id: 'm-2', oznaka: null, tipMeritve: null, status: null, kot: null, segmentId: null })],
    projectName: 'Testni projekt',
    totalLength: 12340,
    avgHeight: 1100,
    stSegmentov: 3,
    najdalsaDolzinaMm: 5678,
    totalArea: 12_340_000,
    statusCounts: { OSNUTEK: 2, POTRJENA: 5, ARHIVIRANA: 1 },
    izvozenoOb: new Date('2026-10-01T12:00:00.000Z'),
  })

  const zgradi = (a = args()) => Buffer.from(buildSeznamPdfDoc(a).output('arraybuffer'))

  it('determinizem: enak vhod = bajtno enak dokument (setCreationDate kanon r269)', () => {
    expect(zgradi().equals(zgradi())).toBe(true)
  })

  it('drugi izvozenoOb = drugačen dokument (noga + CreationDate sta vhodni resnici)', () => {
    const drugi = { ...args(), izvozenoOb: new Date('2026-09-29T08:01:00.000Z') }
    expect(zgradi(drugi).equals(zgradi())).toBe(false)
  })

  it('%PDF- magija + prazen seznam dovoljen v gradniku (guard = klicateljeva resnica)', () => {
    const bin = zgradi()
    expect(bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    const prazen = zgradi({ ...args(), measurements: [] })
    expect(prazen.subarray(0, 5).toString('ascii')).toBe('%PDF-')
  })

  it('wrapper exportSeznamPdf: doc.save(filename) z klicateljevim imenom (IME = klicateljeva resnica)', () => {
    // vir: wrapper pokliče build + save; guard/toasti NISO v modulu
    expect(pdfMod).toContain('export function exportSeznamPdf(args: SeznamPdfArgs & { filename: string }): void')
    expect(pdfMod).toContain('doc.save(args.filename)')
    expect(pdfMod).not.toContain('toast.')
  })

  it('VERBATIM dokaz: ključni literali glave/povzetka/tabe/noge v modulu, IZGINILI iz taba', () => {
    expect(pdfMod).toContain("'ROKSAL — Seznam meritev'")
    expect(pdfMod).toContain("doc.text('Povzetek', 14, 32)")
    expect(pdfMod).toContain('startY: 56')
    expect(pdfMod).toContain('headStyles: { fillColor: [29, 43, 62], textColor: 255, fontSize: 8 }')
    expect(pdfMod).toContain('Izvozeno ')
    // tab NE VEČ nosi gradnika (stale kopija izginila)
    expect(tab).not.toContain('ROKSAL — Seznam meritev')
    expect(tab).not.toContain('new jsPDF')
    expect(tab).not.toContain('autoTable')
    expect(tab).not.toContain("from 'jspdf'")
  })
})

describe('r350 meritve FAZA 7 — EN VIR + žičenje + 0-hex', () => {
  it('stale inline vrstični gradniki IZGINILI iz taba (vir: nič csvEsc klicev, nič inline header nizov)', () => {
    expect(tab).not.toContain('csvEsc(')
    expect(tab).not.toContain("'Oznaka,Tip,Status,Pozicija(mm),Razmik(mm),Visina(mm),Material,Opomba'")
    expect(tab).not.toContain("'Cas,Akcija,MeritevId,Opis,StaraVrednost,NovaVrednost'")
    expect(tab).not.toContain('stebri.map(')
    expect(tab).not.toContain('auditEntries.map(')
  })

  it('žičenje: tab uvaža in kliče NOVE gradnike (izvoz-csv ×3 + pdf-seznam)', () => {
    expect(tab).toContain('STEBRI_CSV_HEADER')
    expect(tab).toContain('ZGODOVINA_CSV_HEADER')
    // counting asercija šteje VSE pojavitve (import + komentar + klic —
    // LEKCIJA R349): ×4 = header komentar + import + handler komentar + klic
    expect((tab.match(/zgradiStebriVrstice/g) || []).length).toBe(4)
    expect((tab.match(/zgradiZgodovinaVrstice/g) || []).length).toBe(4)
    expect(tab).toContain('csvDokument(STEBRI_CSV_HEADER, zgradiStebriVrstice(stebri))')
    expect(tab).toContain('csvDokument(ZGODOVINA_CSV_HEADER, zgradiZgodovinaVrstice(auditEntries))')
    expect(tab).toContain('exportSeznamPdf({')
    expect(tab).toContain('izvozenoOb: new Date()')
    expect(tab).toContain('filename: `meritve_${selectedProject}_${new Date().toISOString().slice(0, 10)}.pdf`')
  })

  it('0 novih hex: modula izvoz-csv + pdf-seznam brez hex barvnih literalov (FAZA = premik teles)', () => {
    expect(mod).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(pdfMod).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('FAZA 5/6 regresija: MERITVE_CSV_HEADER + zgradiMeritveVrstice nedotaknjena (istega modula)', () => {
    expect(MERITVE_CSV_HEADER).toContain('Oznaka,Tip,Status,Lokacija,Segment,Dolzina(mm)')
    expect(typeof zgradiMeritveVrstice).toBe('function')
    expect(mod).toContain('export function zgradiMeritveVrstice')
  })

  it('TODO-R350: brez razvojnih ostankov v novi kodi', () => {
    expect(mod).not.toContain('TODO-R350')
    expect(pdfMod).not.toContain('TODO-R350')
    expect(tab).not.toContain('TODO-R350')
  })
})
