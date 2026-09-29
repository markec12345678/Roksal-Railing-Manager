// R277 — TERENSKI PREGLED PDF: verzija + vir stolpca (issue #16 §6 —
// papirnata sledljivost zgodovine meritev). R276 je zgodovino verzij
// prinesel v UI (pill + panel); R277 jo prinese tudi na terenski PDF, da
// vodja s seznamom v roki vidi, KATERA verzija meritve je na listu in IZ
// KJE je prišla (Ročni vnos/Foto-CV/AR-Depth).
//
// Načela (ista kot družina R269):
//   • fail-closed: pokvaren verzija/vir → TypeError z indeksom krivca
//     (NE tiho String(number) na listu); neznani vir = pokvaren vir
//     (ista strogost kot status prek MEASUREMENT_STATUS_VALUES);
//   • legacy = iskren '—' (verzija null/vir null — nastalo pred
//     verzioniranjem R276; NIKOLI izmišljena v1 ali ugibanje vira);
//   • CSV kontrakt NIČ: meritevVrstica/meritveCsv ostajata 19-stolpčna —
//     verzija/vir sta SAMO PDF razširitev (MeritevZaIzvoz optional polji);
//   • determinizem: enak vhod + enak now = bajtno enak PDF.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildMeritveTerenPdfDoc,
  meritevTerenPregled,
  preveriMeritevVnos,
  type MeritveTerenVnos,
} from '@/lib/meritve-teren-pdf'
import { meritveCsv } from '@/lib/meritve-csv'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

const lib = beri('src/lib/meritve-teren-pdf.ts')
const csv = beri('src/lib/meritve-csv.ts')
const komponenta = beri('src/components/roksal/measurements-tab.tsx')

const NOW: Date = new Date('2026-09-29T10:00:00.000Z')

function mer(over: Partial<MeritveTerenVnos> & Pick<MeritveTerenVnos, 'id'>): MeritveTerenVnos {
  return {
    createdAt: '2026-09-20T08:00:00.000Z',
    dolzinaMm: 1000,
    visinaMm: 1100,
    ...over,
  }
}

// Verzionirana veriga (issue #16 §6 primer: 3200 → 3450 = korekcija v2) +
// legacy vrstica (brez verzije/vira — pred R276).
const MERITVE: MeritveTerenVnos[] = [
  mer({ id: 'v1', oznaka: 'Sever 1', verzija: 1, vir: 'MANUAL' }),
  mer({ id: 'v2', oznaka: 'Sever 1 — korekcija', verzija: 2, vir: 'PHOTO_CV', dolzinaMm: 3450, status: 'POTRJENA' }),
  mer({ id: 'v3', oznaka: 'AR poligraf', verzija: 3, vir: 'ARCORE_DEPTH', dolzinaMm: 3420 }),
  mer({ id: 'l1', oznaka: 'Legacy fasada', dolzinaMm: 2000, status: 'ARHIVIRANA' }),
]

function zgradi(vhodi: readonly MeritveTerenVnos[] = MERITVE, now: Date = NOW): Buffer {
  const doc = buildMeritveTerenPdfDoc(vhodi, { now, projektIme: 'Test projekt' })
  return Buffer.from(doc.output('arraybuffer'))
}

describe('R277 — verzija + vir v ENI resnici (meritevTerenPregled)', () => {
  it('vrste nosita verzija + vir: v1/v2/v3 + MANUAL/PHOTO_CV/ARCORE_DEPTH; legacy = null/null (iskrena praznina)', () => {
    const { vrste } = meritevTerenPregled(MERITVE)
    const poId = Object.fromEntries(vrste.map((v) => [v.id, v]))
    expect(poId['v1'].verzija).toBe(1)
    expect(poId['v1'].vir).toBe('MANUAL')
    expect(poId['v2'].verzija).toBe(2)
    expect(poId['v2'].vir).toBe('PHOTO_CV')
    expect(poId['v3'].verzija).toBe(3)
    expect(poId['v3'].vir).toBe('ARCORE_DEPTH')
    // legacy: izostanek → null (nikoli izmišljena v1 ali ugibanje vira)
    expect(poId['l1'].verzija).toBeNull()
    expect(poId['l1'].vir).toBeNull()
  })

  it('povzetek NE sme biti spremenjen (verzija/vir sta stolpca, ne KPI)', () => {
    const { povzetek } = meritevTerenPregled(MERITVE)
    expect(povzetek).toEqual({
      meritev: 4,
      osnutkov: 2,
      potrjenih: 1,
      arhiviranih: 1,
      skupnaDolzinaMm: 9870,
      tipov: 1,
    })
  })
})

describe('R277 — fail-closed meje (pokvaren verzija/vir → TypeError z indeksom)', () => {
  it('verzija kot niz = TypeError (ne tiho String(number) na listu)', () => {
    expect(() => meritevTerenPregled([mer({ id: 'x', verzija: '2' as unknown as number })])).toThrow(TypeError)
    try {
      meritevTerenPregled([mer({ id: 'x', verzija: '2' as unknown as number })])
    } catch (e) {
      expect((e as TypeError).message).toContain('preveriMeritevVnos (0)')
      expect((e as TypeError).message).toContain('verzija')
    }
  })

  it('verzija 0 / ulomek / negativna = TypeError (pozitivno celo število ALI null)', () => {
    expect(() => meritevTerenPregled([mer({ id: 'x', verzija: 0 })])).toThrow(TypeError)
    expect(() => meritevTerenPregled([mer({ id: 'x', verzija: 1.5 })])).toThrow(TypeError)
    expect(() => meritevTerenPregled([mer({ id: 'x', verzija: -2 })])).toThrow(TypeError)
  })

  it('neznani vir = TypeError (ista strogost kot neznani status)', () => {
    expect(() => meritevTerenPregled([mer({ id: 'x', vir: 'NEZNAN' })])).toThrow(TypeError)
    expect(() => meritevTerenPregled([mer({ id: 'x', vir: 5 as unknown as string })])).toThrow(TypeError)
    try {
      preveriMeritevVnos(mer({ id: 'x', vir: 'NEZNAN' }), 3)
    } catch (e) {
      expect((e as TypeError).message).toContain('(3)')
      expect((e as TypeError).message).toContain('MANUAL/PHOTO_CV/ARCORE_DEPTH')
    }
  })

  it('ekspliciten null verzija/vir = VELJAVNO (legacy — iskren odpad, ne napaka)', () => {
    const { vrste } = meritevTerenPregled([mer({ id: 'x', verzija: null, vir: null })])
    expect(vrste[0].verzija).toBeNull()
    expect(vrste[0].vir).toBeNull()
  })
})

describe('R277 — PDF bajtni dokazi (determinizem + glava)', () => {
  it('enak vhod + enak now = bajtno enak; drug now = drugačen; %PDF- magija', () => {
    const a = zgradi()
    expect(a.equals(zgradi())).toBe(true)
    expect(zgradi(MERITVE, new Date('2026-09-29T10:01:00.000Z')).equals(a)).toBe(false)
    expect(a.subarray(0, 5).toString('ascii')).toBe('%PDF-')
  })

  it('verzija/vir SO del vrstice (f(vhod)): sprememba verzije = drugačen dokument', () => {
    const drugace = zgradi(MERITVE.map((m) => (m.id === 'v1' ? { ...m, verzija: 7 } : m)))
    expect(drugace.equals(zgradi())).toBe(false)
  })
})

describe('R277 — žične vrstice (EN VIR — lib + tab)', () => {
  it('lib: 10-stolpčna glava z Verzija + Vir; vN prikaz; MERITEV_VIR_LABELS za vir oznako; sklep poimenuje verigo korekcij', () => {
    expect(lib).toContain("'Verzija', 'Vir'")
    expect(lib).toContain('v.verzija === null')
    expect(lib).toContain('MERITEV_VIR_LABELS[v.vir]')
    expect(lib).toContain('verzija = veriga korekcij')
    expect(lib).toContain('nastalo pred verzioniranjem')
  })

  it('lib: preverba vir gre prek MERITEV_VIRI (EN VIR z meritev-verzije.ts — ne kopija seznama)', () => {
    expect(lib).toContain('MERITEV_VIRI')
    expect(lib).toContain("from './meritev-verzije'")
  })

  it('tab: FRESH DTO poneseta verzija + vir (fail-verbose tipovna preverba)', () => {
    expect(komponenta).toContain('verzija: (m.verzija ?? null) as number | null')
    expect(komponenta).toContain('vir: (m.vir ?? null) as string | null')
    expect(komponenta).toContain('verzija mora biti pozitivno celo število ALI null')
  })

  it('CSV kontrakt NIČ: meritevVrstica ne uporablja verzija/vir; MeritevZaIzvoz ima samo opcijski razširitev', () => {
    // meritevVrstica sega SAMO v znana CSV polja — verzija/vir ne smeta biti v
    // CSV graditelju (19-stolpčni arhivni kontrakt R186 ostaja bajtno stabilen).
    const vrsticaZ = meritveCsv([mer({ id: 'x', verzija: 2, vir: 'PHOTO_CV' })]).csv
    const vrsticaBrez = meritveCsv([mer({ id: 'x' })]).csv
    expect(vrsticaZ).toBe(vrsticaBrez)
    expect(vrsticaZ).not.toContain('PHOTO_CV')
    // tipovna razširitev je opcijska (ne lomi obstoječih klicateljev)
    expect(csv).toContain('verzija?: number | null')
    expect(csv).toContain('vir?: string | null')
  })
})
