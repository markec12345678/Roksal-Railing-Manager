// R348 — dekompozicija measurements-tab FAZA 5: EN VIR gradnja starejše
// družine CSV izvozov (vzorec kalkulator FAZA 5–7 / R325 pdf-exports).
// ---------------------------------------------------------------------------
//  • measurements/izvoz-csv.ts — csvEsc + csvDokument + MERITVE_CSV_HEADER +
//    zgradiMeritveVrstice (17-stolpčni P1 kontrakt) izluščeni VERBATIM iz
//    taba; gradniki NESPREMENJENI — izvožene datoteke bajtno iste;
//  • stale kopije IZGINILE: handleExportCSV ≡ handleBulkExportCSV sta nosila
//    bajtno identični telesi 17-stolpčnega gradnika (2 resnici — zdaj EN
//    VIR); 4 × inline Blob prenos → kanon downloadCsvText (R171/R296);
//    15 × inline podvajanje navedkov → csvEsc; 4 × inline BOM → csvDokument;
//  • determinizem: isti vhod = bajtno isti izhod (brez Date.now v jedru);
//  • FAZA regresija: R186 lib/meritve-csv kanon (izvoziMeritveCsv) nedotaknjen.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MERITVE_CSV_HEADER,
  csvDokument,
  csvEsc,
  zgradiMeritveVrstice,
  type MeritveVrsticaVhod,
} from '@/components/roksal/measurements/izvoz-csv'

const TAB = join(process.cwd(), 'src/components/roksal/measurements-tab.tsx')
const MOD = join(process.cwd(), 'src/components/roksal/measurements/izvoz-csv.ts')
const STEBER = join(process.cwd(), 'src/components/roksal/measurements/steber-table.tsx')

const tab = readFileSync(TAB, 'utf8')
const mod = readFileSync(MOD, 'utf8')
const steber = readFileSync(STEBER, 'utf8')

/** Realni fixtures (MERILEC LEKCIJE R347 4: kanonske vrednosti iz labels.ts
 *  in slDatumKratko paritete — ne izmišljeni prikazi). */
function meritev(over: Partial<MeritveVrsticaVhod> = {}): MeritveVrsticaVhod {
  return {
    oznaka: 'S1',
    tipMeritve: 'RAZDALJA',
    status: 'POTRJENA',
    lokacija: 'Severna fasada',
    segmentId: 'seg-1',
    dolzinaMm: 1234,
    visinaMm: 1100,
    steviloStebrov: null,
    tipPodlage: 'beton',
    kot: null,
    opomba: 'test',
    opombe: null,
    createdAt: '2026-10-01T12:00:00.000Z',
    ...over,
  }
}

describe('r348 meritve FAZA 5 — zgradiMeritveVrstice (17-stolpčni P1)', () => {
  it('osnovna vrstica z realnimi labeli + multi-unit stolpci', () => {
    const [vrstica] = zgradiMeritveVrstice([meritev()])
    // tipMeritveLabels.RAZDALJA = 'Razdalja'; statusLabels.POTRJENA = 'Potrjena';
    // groundTypeLabels.beton = 'Beton'; slDatumKratko = '1. 10. 2026'
    expect(vrstica).toContain('"Razdalja"')
    expect(vrstica).toContain('"Potrjena"')
    expect(vrstica).toContain('"Beton"')
    // multi-unit: 1234 mm → 123 cm (Math.round) → 1.23 m (toFixed 2);
    // 1100 mm → 110 → 1.10; datum = ZADNJI stolpec, NECITIRAN (VERBATIM)
    expect(vrstica).toContain(',1234,123,1.23,1100,110,1.10,')
    expect(vrstica.endsWith(',1. 10. 2026')).toBe(true)
  })

  it('privzeti fallbacki: brez tipa → Razdalja; status → OSNUTEK; prazna polja', () => {
    const [vrstica] = zgradiMeritveVrstice([meritev({
      oznaka: null,
      tipMeritve: null,
      status: null,
      lokacija: null,
      segmentId: null,
      steviloStebrov: null,
      tipPodlage: null,
      kot: null,
      opomba: null,
      opombe: null,
    })])
    // oznaka null → "" (citirano prazno — csvEsc EN VIR); potem fallbacki
    expect(vrstica.startsWith('"","Razdalja","Osnutek",')).toBe(true)
    expect(vrstica).toContain('"",""') // lokacija/segment prazno citirana
    expect(vrstica).not.toContain('n/a')
    expect(vrstica).not.toContain('null')
  })

  it('podlaga: znana vrednost → label; neznana → surova vrednost (ISTO kot UI)', () => {
    const [znana] = zgradiMeritveVrstice([meritev({ tipPodlage: 'les' })])
    expect(znana).toContain('"Lesena podlaga"')
    const [surova] = zgradiMeritveVrstice([meritev({ tipPodlage: 'DRUGO-X' })])
    expect(surova).toContain('"DRUGO-X"')
  })

  it('csvEsc: navedki podvojeni, null/undefined → prazno', () => {
    expect(csvEsc('a"b')).toBe('a""b')
    expect(csvEsc(null)).toBe('')
    expect(csvEsc(undefined)).toBe('')
    expect(csvEsc('')).toBe('')
    const [z] = zgradiMeritveVrstice([meritev({ opomba: 'navedek " poseben' })])
    expect(z).toContain('"navedek "" poseben"')
  })

  it('determinizem: isti vhod ×2 = bajtno isti izhod; vrstni red = vrstni red vhoda', () => {
    const seznam = [meritev(), meritev({ oznaka: 'S2', dolzinaMm: 999, status: 'OSNUTEK' })]
    const a = zgradiMeritveVrstice(seznam)
    const b = zgradiMeritveVrstice([...seznam])
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(a[1]).toContain('"S2"')
  })

  it('EN VIR dokaz: vsota delov = celota (prej 2 stale telesi — zdaj 1 gradnik)', () => {
    const a = [meritev()]
    const b = [meritev({ oznaka: 'S2', tipMeritve: 'VISINA', dolzinaMm: 0, visinaMm: 250 })]
    const celota = zgradiMeritveVrstice([...a, ...b])
    expect(celota).toEqual([...zgradiMeritveVrstice(a), ...zgradiMeritveVrstice(b)])
  })
})

describe('r348 meritve FAZA 5 — csvDokument + MERITVE_CSV_HEADER', () => {
  it('MERITVE_CSV_HEADER: bajtno = stara stale kopija (17 stolpcev = 16 vejic)', () => {
    expect(MERITVE_CSV_HEADER).toBe(
      'Oznaka,Tip,Status,Lokacija,Segment,Dolzina(mm),Dolzina(cm),Dolzina(m),Visina(mm),Visina(cm),Visina(m),Stebri,Podlaga,Kot,Opomba,Opombe,Datum',
    )
    expect(MERITVE_CSV_HEADER.split(',').length).toBe(17)
  })

  it('csvDokument: BOM + zaglavje + LF (bajtna struktura starejše družine)', () => {
    const dok = csvDokument('A,B', ['"x",1', '"y",2'])
    expect(dok.charCodeAt(0)).toBe(0xfeff)
    expect(dok).toBe('\uFEFFA,B\n"x",1\n"y",2')
  })

  it('0 novih hex v novem modulu (kanon val 15+)', () => {
    expect(mod).not.toMatch(/#[0-9a-fA-F]{6}\b/)
  })
})

describe('r348 meritve FAZA 5 — stale kopije IZGINILE + žičenje EN VIR', () => {
  it('tab: 0 × new Blob (4 inline prenos bloka → kanon downloadCsvText)', () => {
    expect(tab).not.toContain('new Blob')
  })

  it('tab: 0 × inline podvajanje navedkov (15 → csvEsc)', () => {
    expect(tab).not.toContain(`.replace(/"/g, '""')`)
    expect(mod).toContain(`.replace(/"/g, '""')`) // EN VIR v modulu
  })

  it('tab: 0 × inline BOM združevanje (4 → csvDokument)', () => {
    expect(tab).not.toContain(`'\\uFEFF' + header`)
    expect(mod).toContain(`'\\uFEFF' + header`)
  })

  it('žičenje: zgradiMeritveVrstice ×2 klica (vse + izbrane), 1 definicija v modulu', () => {
    expect(mod).toContain('export function zgradiMeritveVrstice')
    expect((tab.match(/zgradiMeritveVrstice\(/g) ?? []).length).toBe(2)
    expect(tab).toContain('zgradiMeritveVrstice(measurements)')
    expect(tab).toContain('zgradiMeritveVrstice(selected)')
  })

  it('žičenje: MERITVE_CSV_HEADER ×4 (import + opis + 2 klica), csvDokument ×4, csvEsc ×5 (R348 resnica; R350 FAZA 7 premik → ×0 v tabu), downloadCsvText ×6', () => {
    expect((tab.match(/MERITVE_CSV_HEADER/g) ?? []).length).toBe(4)
    expect((tab.match(/csvDokument\(/g) ?? []).length).toBe(4)
    // R350 FAZA 7: steber + zgodovina vrstična gradnika sta se preselila v
    // izvoz-csv.ts (zgradiStebriVrstice/zgradiZgodovinaVrstice) — tab nič več
    // kliče csvEsc direktno (5 → 0; 15. premik prsta — zgodovina: 14. premik
    // r172 6475→6271, glej R349 worklog). Stale test = del kontrakta.
    expect((tab.match(/csvEsc\(/g) ?? []).length).toBe(0)
    expect((mod.match(/csvEsc\(/g) ?? []).length).toBeGreaterThanOrEqual(3)
    expect((tab.match(/downloadCsvText\(/g) ?? []).length).toBe(6)
  })

  it('stale header literala je ostala SAMO v modulu (tab nosi samo stebri/audit lokalni header)', () => {
    expect(tab).not.toContain(
      "'Oznaka,Tip,Status,Lokacija,Segment,Dolzina(mm),Dolzina(cm),Dolzina(m),Visina(mm),Visina(cm),Visina(m),Stebri,Podlaga,Kot,Opomba,Opombe,Datum'",
    )
  })

  it('FAZA regresija: R186 kanon lib/meritve-csv nedotaknjen (izvoziMeritveCsv še EN VIR)', () => {
    expect(tab).toContain('meritveCsv(filteredMeasurements)')
    expect(tab).toContain('meritveCsvFilename(')
    expect(tab).toContain('downloadCsvText(zapisniListCsvFilename(new Date()), csv)')
  })

  it('žičenje: 4 CSV izvozi prek kanona nosijo R348 oznako (stebri/meritve/izbrane/zgodovina)', () => {
    expect(tab).toContain('stebri_${segmentId}_')
    expect(tab).toContain('meritve_${selectedProject}_')
    expect(tab).toContain('meritve_izbrane_')
    expect(tab).toContain('zgodovina_${selectedProject}_')
    expect((tab.match(/R348 FAZA 5/g) ?? []).length).toBe(4)
  })

  it('steber-table: izvozni gumb a11y (val 31) — aria + title ŽIVO', () => {
    expect(steber).toContain('aria-label="Izvozi preglednico stebrov kot CSV"')
    expect(steber).toContain('title="Izvozi stebre tega segmenta kot CSV za Excel"')
    expect(steber).toContain('focus-visible:ring-roksal-navy/40')
  })
})
