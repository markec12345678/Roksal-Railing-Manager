// R354 — MEASUREMENTS FAZA 8: teren izvozi ORKESTRACIJA →
// measurements/teren-izvozi.ts (vzorec FAZA 5/R348, FAZA 6/R349,
// FAZA 7/R350; args objekt — vzorec R346/R325). Testi:
// (A) manjka-projekt guard (diskriminiran rezultat — fetch NI klican);
// (B) prazno guard (fail-closed: nobena datoteka ne nastane);
// (C) teren-pdf: zKotom:false dialekt + generateMeritveTerenPdf klic + povzetek;
// (D) zapisni-pdf: zKotom:true + generateTerenskiZapisniPdf klic;
// (E) zapisni-csv: {csv, imeDatoteke, vrstic} projekcija — prenos v klicatelju;
// (F) fail-verbose VERBATIM (Error sporocilo + ne-Error 'Neznana napaka');
// (G) determinizem: isti vhod ×2 → isti rezultat;
// (H) EN VIR dokaz: tab = žičenje (3 klici izvediTerenIzvoz, 0 stale
//     lib-uvozov — LEKCIJA R347: stale kopije dihajo v telesih);
// (I) UI resnica v UI: VERBATIM toast besedila ostanejo v tabu (×3 uspeh +
//     prazno + fail-verbose), lib NE pozna toastov;
// (J) 0 novih hex (modul je logika, ne stil).
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ZDAJ = new Date('2026-10-01T12:00:00.000Z')
const FIKS = [
  {
    id: 'm-354-a',
    createdAt: '2026-09-20T10:00:00.000Z',
    dolzinaMm: 1250,
    visinaMm: 980,
    status: 'POTRJENA',
  },
]

vi.mock('@/components/roksal/measurements/teren-vnosi', () => ({
  fetchMeritveTerenVnosi: vi.fn(async () => FIKS),
}))
vi.mock('@/lib/meritve-teren-pdf', () => ({
  meritevTerenPregled: vi.fn(() => ({
    vrste: [],
    povzetek: { meritev: 1, osnutkov: 0, potrjenih: 1, arhiviranih: 0 },
  })),
  generateMeritveTerenPdf: vi.fn(),
  osnutekBeseda: vi.fn((n: number) => (n === 1 ? 'osnutek' : 'osnutki')),
}))
vi.mock('@/lib/terenski-zapisni-pdf', () => ({
  generateTerenskiZapisniPdf: vi.fn(),
}))
vi.mock('@/lib/terenski-zapisni-csv', () => ({
  zapisniListCsv: vi.fn(() => ({ csv: 'glava\nvrstica', vrstic: 2 })),
  zapisniListCsvFilename: vi.fn(() => 'Terenski-zapisni-list-2026-10-01.csv'),
}))

import { izvediTerenIzvoz } from '@/components/roksal/measurements/teren-izvozi'
import { fetchMeritveTerenVnosi } from '@/components/roksal/measurements/teren-vnosi'
import {
  meritevTerenPregled,
  generateMeritveTerenPdf,
} from '@/lib/meritve-teren-pdf'
import { generateTerenskiZapisniPdf } from '@/lib/terenski-zapisni-pdf'
import { zapisniListCsv, zapisniListCsvFilename } from '@/lib/terenski-zapisni-csv'

const tab = readFileSync(join(process.cwd(), 'src/components/roksal/measurements-tab.tsx'), 'utf8')
const modul = readFileSync(join(process.cwd(), 'src/components/roksal/measurements/teren-izvozi.ts'), 'utf8')

const KONTEKST = {
  selectedProject: 'p-1',
  projektIme: 'Balkon Kranj',
  zdaj: ZDAJ,
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(fetchMeritveTerenVnosi as ReturnType<typeof vi.fn>).mockImplementation(async () => FIKS)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('r354 FAZA 8 — teren izvozi orkestracija (teren-izvozi.ts)', () => {
  it('(A) manjka-projekt: diskriminiran rezultat — fetch/generate NIKOLI klicana', async () => {
    const r = await izvediTerenIzvoz('teren-pdf', { selectedProject: null, projektIme: null, zdaj: ZDAJ })
    expect(r).toEqual({ izid: 'manjka-projekt' })
    expect(fetchMeritveTerenVnosi).not.toHaveBeenCalled()
    expect(generateMeritveTerenPdf).not.toHaveBeenCalled()
  })

  it('(B) prazno: fail-closed — nobena datoteka ne nastane (generate ×0, csv ×0)', async () => {
    ;(fetchMeritveTerenVnosi as ReturnType<typeof vi.fn>).mockImplementation(async () => [])
    for (const vrsta of ['teren-pdf', 'zapisni-pdf', 'zapisni-csv'] as const) {
      const r = await izvediTerenIzvoz(vrsta, KONTEKST)
      expect(r, vrsta).toEqual({ izid: 'prazno' })
    }
    expect(generateMeritveTerenPdf).not.toHaveBeenCalled()
    expect(generateTerenskiZapisniPdf).not.toHaveBeenCalled()
    expect(zapisniListCsv).not.toHaveBeenCalled()
  })

  it('(C) teren-pdf: zKotom:false dialekt + generateMeritveTerenPdf (DTO + {now, projektIme}) + povzetek', async () => {
    const r = await izvediTerenIzvoz('teren-pdf', KONTEKST)
    expect(r.izid).toBe('uspeh-pdf')
    if (r.izid === 'uspeh-pdf') {
      expect(r.povzetek).toEqual({ meritev: 1, osnutkov: 0, potrjenih: 1, arhiviranih: 0 })
    }
    expect(fetchMeritveTerenVnosi).toHaveBeenCalledWith('p-1', { zKotom: false })
    expect(generateMeritveTerenPdf).toHaveBeenCalledTimes(1)
    expect(generateMeritveTerenPdf).toHaveBeenCalledWith(FIKS, { now: ZDAJ, projektIme: 'Balkon Kranj' })
    expect(generateTerenskiZapisniPdf).not.toHaveBeenCalled()
  })

  it('(D) zapisni-pdf: zKotom:true dialekt + generateTerenskiZapisniPdf (teren PDF NI klican)', async () => {
    const r = await izvediTerenIzvoz('zapisni-pdf', KONTEKST)
    expect(r.izid).toBe('uspeh-pdf')
    expect(fetchMeritveTerenVnosi).toHaveBeenCalledWith('p-1', { zKotom: true })
    expect(generateTerenskiZapisniPdf).toHaveBeenCalledWith(FIKS, { now: ZDAJ, projektIme: 'Balkon Kranj' })
    expect(generateMeritveTerenPdf).not.toHaveBeenCalled()
  })

  it('(E) zapisni-csv: {csv, imeDatoteke, vrstic} projekcija — prenos OSTANE v klicatelju (lib ne prenasa)', async () => {
    const r = await izvediTerenIzvoz('zapisni-csv', KONTEKST)
    expect(r).toEqual({
      izid: 'uspeh-csv',
      csv: 'glava\nvrstica',
      imeDatoteke: 'Terenski-zapisni-list-2026-10-01.csv',
      vrstic: 2,
    })
    expect(zapisniListCsv).toHaveBeenCalledWith(FIKS)
    expect(zapisniListCsvFilename).toHaveBeenCalledWith(ZDAJ)
    expect(modul.match(/downloadCsvText\(/)).toBeNull()
  })

  it('(F) fail-verbose VERBATIM: Error → sporocilo; ne-Error → Neznana napaka (nikoli tiho)', async () => {
    ;(fetchMeritveTerenVnosi as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      throw new Error('GET /api/measurements → HTTP 500')
    })
    const r = await izvediTerenIzvoz('teren-pdf', KONTEKST)
    expect(r).toEqual({ izid: 'napaka', sporocilo: 'GET /api/measurements → HTTP 500' })

    ;(fetchMeritveTerenVnosi as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      throw 'pokvaren vnos'
    })
    const r2 = await izvediTerenIzvoz('zapisni-csv', KONTEKST)
    expect(r2).toEqual({ izid: 'napaka', sporocilo: 'Neznana napaka (pokvaren vnos).' })
  })

  it('(G) determinizem: isti vhod ×2 → isti rezultat (isti klici ×2)', async () => {
    const a = await izvediTerenIzvoz('teren-pdf', KONTEKST)
    const b = await izvediTerenIzvoz('teren-pdf', KONTEKST)
    expect(a).toEqual(b)
    expect(fetchMeritveTerenVnosi).toHaveBeenCalledTimes(2)
  })

  it('(H) EN VIR dokaz: 1 definicija orkestracije, tab = 3 klici, 0 stale lib-uvozov v tabu', () => {
    expect((modul.match(/export async function izvediTerenIzvoz/g) || []).length).toBe(1)
    expect((tab.match(/izvediTerenIzvoz\('/g) || []).length).toBe(3)
    expect(tab).toContain("import { izvediTerenIzvoz } from './measurements/teren-izvozi'")
    // stale libi iz taba izginili (LEKCIJA R347: stale kopije dihajo v telesih;
    // call-form dokaz — zgodovinski komentarji SMEJO omenjati imena)
    expect((tab.match(/await fetchMeritveTerenVnosi\(/g) || []).length).toBe(0)
    expect((tab.match(/generateTerenskiZapisniPdf\(/g) || []).length).toBe(0)
    expect((tab.match(/zapisniListCsv\(/g) || []).length).toBe(0)
    expect((tab.match(/zapisniListCsvFilename\(/g) || []).length).toBe(0)
    expect((tab.match(/generateMeritveTerenPdf\(/g) || []).length).toBe(0)
    expect(tab).not.toContain("from './measurements/teren-vnosi'")
    // meritevTerenPregled OSTANE v tabu (mini-vrstica WYSIWYG — drug potrošnik)
    expect(tab).toContain('meritevTerenPregled(')
  })

  it('(I) UI resnica v UI: VERBATIM toast besedila ostanejo v tabu; lib NE pozna toastov', () => {
    // uspeh ×3
    expect(tab).toContain("'Terenski pregled meritev prenešen v PDF'")
    expect(tab).toContain("'Zapisni list prenešen v PDF'")
    expect(tab).toContain("'Zapisni list prenešen v CSV'")
    // prazno ×3 (fail-closed opombe)
    expect(tab).toContain("'Terenski pregled se izvozi, ko je vpisana prva meritev projekta.'")
    expect(tab).toContain("'Terenski zapisni list se izvozi, ko je vpisana prva meritev projekta.'")
    expect(tab).toContain("'Terenski zapisni list (CSV) se izvozi, ko je vpisana prva meritev projekta.'")
    // fail-verbose naslov
    expect((tab.match(/'Izvoz ni uspel'/g) || []).length).toBe(3)
    // projekt guard opombe ×3
    expect(tab).toContain("'Terenski pregled je projekt-obračunski — najprej izberite projekt.'")
    expect(tab).toContain("'Terenski zapisni list je projekt-obračunski — najprej izberite projekt.'")
    expect(tab).toContain("'Terenski zapisni list (CSV) je projekt-obračunski — najprej izberite projekt.'")
    // lib je čist (brez UI uvozov — diskriminiran rezultat namesto toastov)
    expect(modul).not.toMatch(/from '@\/hooks\/use-toast'/)
    expect(modul).not.toMatch(/from 'sonner'/)
    expect(modul).toContain('Fail-verbose')
  })

  it('(J) zgodovina + kanon v viru: FAZA 8 komentar, bajtni kontrakt NESPREMENJEN, 0 novih hex', () => {
    expect(modul).toContain('R354 — FAZA 8')
    expect(modul).toContain('NESPREMENJEN')
    expect(modul).toContain('NI tihe degradacije')
    expect(modul.match(/#[0-9a-fA-F]{3,8}\b/)).toBeNull()
  })
})
