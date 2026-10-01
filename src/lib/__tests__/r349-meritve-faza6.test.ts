// R349 — MEASUREMENTS FAZA 6: EN VIR fetch + fail-verbose DTO pruning
// terenskih izvozov → measurements/teren-vnosi.ts (vzorec kalkulator
// FAZA 5–7 + meritve FAZA 5). Testi:
// (A) R269 dialekt (zKotom: false) — DTO BREZ kotStopinje ključa (bajtni
//     kontrakt terenskega pregleda) in brez kot validacije;
// (B) R284/R285 dialekt (zKotom: true) — kotStopinje prvorazredni stolpec +
//     legacy arMetadata.kot fallback (R283 dialekt m1/m2);
// (C) fail-verbose VERBATIM napake (indeks krivca + id; R264–R268 vzorec);
// (D) arMetadata toleranca ({} / null / '' — UI parser je toleranten {});
// (E) determinizem (isti vhod = isti izhod, OBA dialekta);
// (F) fetch wrapper (URL + credentials + HTTP razlog + ne-polje TypeError);
// (G) EN VIR dokaz: tab = žičenje (3 klici, 0 stale kopij — LEKCIJA R347 2:
//     stale kopije dihajo v function telesih ×3, zdaj izginile);
// (H) 0 novih hex (val 32 je aria/title/ring razredi — modul je logika).
import { describe, expect, it, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  fetchMeritveTerenVnosi,
  pruneMeritveTerenVrstice,
  type TerenVnosiOpcije,
} from '@/components/roksal/measurements/teren-vnosi'

const tab = readFileSync(join(process.cwd(), 'src/components/roksal/measurements-tab.tsx'), 'utf8')
const modul = readFileSync(join(process.cwd(), 'src/components/roksal/measurements/teren-vnosi.ts'), 'utf8')

function osnova(razlik: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'm-349-a',
    createdAt: '2026-09-20T10:00:00.000Z',
    dolzinaMm: 1250,
    visinaMm: 980,
    status: 'POTRJENA',
    ...razlik,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('r349 FAZA 6 — EN VIR DTO pruning (teren-vnosi.ts)', () => {
  it('(A) R269 dialekt zKotom: false — ključ kotStopinje IZOSTANE iz DTO (bajtni kontrakt), tudi če API vrne vrednost', () => {
    const [vnos] = pruneMeritveTerenVrstice([osnova({ kotStopinje: 45 })], { zKotom: false })
    expect('kotStopinje' in vnos).toBe(false)
    expect(vnos.id).toBe('m-349-a')
    expect(vnos.dolzinaMm).toBe(1250)
    expect(vnos.verzija).toBeNull()
    expect(vnos.vir).toBeNull()
  })

  it('(A2) R269 dialekt NE validira kotStopinje (stale handler ga NI poznal — pokvaren kot ne zlomi terenskega pregleda)', () => {
    const [vnos] = pruneMeritveTerenVrstice([osnova({ kotStopinje: 'pokvaren' })], { zKotom: false })
    expect('kotStopinje' in vnos).toBe(false)
  })

  it('(B) R284/R285 dialekt zKotom: true — kotStopinje iz API-ja, ključ VEDNO prisoten (odsoten = null)', () => {
    const [a] = pruneMeritveTerenVrstice([osnova({ kotStopinje: 90 })], { zKotom: true })
    expect('kotStopinje' in a).toBe(true)
    expect(a.kotStopinje).toBe(90)
    const [b] = pruneMeritveTerenVrstice([osnova()], { zKotom: true })
    expect('kotStopinje' in b).toBe(true)
    expect(b.kotStopinje).toBeNull()
  })

  it('(B2) legacy arMetadata.kot fallback SAMO v zKotom: true dialektu (R283 fikstura m1/m2)', () => {
    const vrstice = [osnova({ arMetadata: JSON.stringify({ kot: 72.5 }) })]
    const [z] = pruneMeritveTerenVrstice(vrstice, { zKotom: true })
    expect(z.kotStopinje).toBe(72.5)
    const [brez] = pruneMeritveTerenVrstice(vrstice, { zKotom: false })
    expect('kotStopinje' in brez).toBe(false)
  })

  it('(C) fail-verbose VERBATIM: manjkajoč id / createdAt (indeks krivca)', () => {
    expect(() => pruneMeritveTerenVrstice([osnova({ id: '' })], { zKotom: false }))
      .toThrow('meritev vrstica 0: manjkajoč id v odgovoru API-ja')
    expect(() => pruneMeritveTerenVrstice([osnova({ createdAt: '' })], { zKotom: false }))
      .toThrow('meritev vrstica 0 (m-349-a): manjkajoč createdAt v odgovoru API-ja')
  })

  it('(C2) fail-verbose VERBATIM: fizikalne mere (negativno + ne-število)', () => {
    expect(() => pruneMeritveTerenVrstice([osnova({ dolzinaMm: -1 })], { zKotom: false }))
      .toThrow('dolzinaMm mora biti ne-negativno končno število, ne -1')
    expect(() => pruneMeritveTerenVrstice([osnova({ visinaMm: Number.NaN })], { zKotom: false }))
      .toThrow('visinaMm mora biti ne-negativno končno število, ne NaN')
  })

  it('(C3) fail-verbose VERBATIM: verzija (0 / 1.5 / niz) + vir (število)', () => {
    expect(() => pruneMeritveTerenVrstice([osnova({ verzija: 0 })], { zKotom: true }))
      .toThrow('verzija mora biti pozitivno celo število ALI null, ne 0')
    expect(() => pruneMeritveTerenVrstice([osnova({ verzija: 1.5 })], { zKotom: false }))
      .toThrow('verzija mora biti pozitivno celo število ALI null, ne 1.5')
    expect(() => pruneMeritveTerenVrstice([osnova({ verzija: '2' })], { zKotom: false }))
      .toThrow('verzija mora biti pozitivno celo število ALI null, ne 2')
    expect(() => pruneMeritveTerenVrstice([osnova({ vir: 7 })], { zKotom: false }))
      .toThrow('vir mora biti niz ALI null, ne 7')
  })

  it('(C4) fail-verbose VERBATIM: kotStopinje validacija SAMO zKotom: true (String(number) NIKOLI na listu)', () => {
    expect(() => pruneMeritveTerenVrstice([osnova({ kotStopinje: '90' })], { zKotom: true }))
      .toThrow('kotStopinje mora biti končno število ALI null, ne 90')
    expect(() => pruneMeritveTerenVrstice([osnova({ kotStopinje: Number.POSITIVE_INFINITY })], { zKotom: true }))
      .toThrow('kotStopinje mora biti končno število ALI null, ne Infinity')
  })

  it('(C5) fail-verbose VERBATIM: pokvaren arMetadata (ne-niz, bad JSON, JSON polje)', () => {
    expect(() => pruneMeritveTerenVrstice([osnova({ arMetadata: 42 })], { zKotom: false }))
      .toThrow('arMetadata mora biti niz ALI null, ne 42')
    expect(() => pruneMeritveTerenVrstice([osnova({ arMetadata: '{pokvaren' })], { zKotom: false }))
      .toThrow('arMetadata ni razumljen kot JSON objekt (pokvaren vir)')
    expect(() => pruneMeritveTerenVrstice([osnova({ arMetadata: '[1,2]' })], { zKotom: false }))
      .toThrow('arMetadata ni razumljen kot JSON objekt (pokvaren vir)')
  })

  it('(D) arMetadata toleranca: null / undefined / prazen niz → polja default null (UI parser toleranten {})', () => {
    for (const ar of [null, undefined, '   ']) {
      const [vnos] = pruneMeritveTerenVrstice([osnova({ arMetadata: ar })], { zKotom: true })
      expect(vnos.tipMeritve).toBeNull()
      expect(vnos.oznaka).toBeNull()
      expect(vnos.lokacija).toBeNull()
      expect(vnos.opomba).toBeNull()
    }
  })

  it('(D2) status fallback EN VIR: m.status ?? ar.status (R186 vzorec)', () => {
    const [a] = pruneMeritveTerenVrstice([osnova({ status: undefined, arMetadata: JSON.stringify({ status: 'OSNUTEK' }) })], { zKotom: false })
    expect(a.status).toBe('OSNUTEK')
    const [b] = pruneMeritveTerenVrstice([osnova({ status: 'POTRJENA', arMetadata: JSON.stringify({ status: 'OSNUTEK' }) })], { zKotom: false })
    expect(b.status).toBe('POTRJENA')
  })

  it('(E) determinizem: isti vhod ×2 = bajtno enak izhod (OBA dialekta)', () => {
    const vhod = [osnova({ arMetadata: JSON.stringify({ oznaka: 'A1', lokacija: 'terasa' }) })]
    const a = pruneMeritveTerenVrstice(vhod, { zKotom: false })
    const b = pruneMeritveTerenVrstice(vhod, { zKotom: false })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    const c = pruneMeritveTerenVrstice(vhod, { zKotom: true })
    const d = pruneMeritveTerenVrstice(vhod, { zKotom: true })
    expect(JSON.stringify(c)).toBe(JSON.stringify(d))
  })

  it('(F) fetch wrapper: URL + credentials + HTTP razlog (fail-verbose)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503, json: vi.fn() })
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchMeritveTerenVnosi('p1', { zKotom: false }))
      .rejects.toThrow('GET /api/measurements → HTTP 503')
    expect(fetchMock).toHaveBeenCalledWith('/api/measurements?projectId=p1', { credentials: 'same-origin' })
  })

  it('(F2) fetch wrapper: ne-polje odgovora → TypeError (VERBATIM)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockResolvedValue({ napaka: 'ne-polje' }) }))
    await expect(fetchMeritveTerenVnosi('p1', { zKotom: false }))
      .rejects.toThrow('Odgovora /api/measurements ni mogoče prebrati (ni polja).')
  })

  it('(F3) fetch wrapper: happy path ponesese DTO čez EN VIR pruning (dialect true)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([osnova({ kotStopinje: 30 })]),
    }))
    const vnosi = await fetchMeritveTerenVnosi('p2', { zKotom: true })
    expect(vnosi).toHaveLength(1)
    expect(vnosi[0].kotStopinje).toBe(30)
  })

  it('(G) EN VIR dokaz: tab ima 3 EN VIR klice (×1 R269 false + ×2 R284/R285 true) in 0 stale kopij (LEKCIJA R347 2 — stale kopije dihajo v function telesih; LEKCIJA R348 4 — štejemo SAMO await klice, komentarji izključeni)', () => {
    expect(tab.split('await fetchMeritveTerenVnosi(selectedProject, { zKotom: false })').length - 1).toBe(1)
    expect(tab.split('await fetchMeritveTerenVnosi(selectedProject, { zKotom: true })').length - 1).toBe(2)
    expect(tab).toContain("import { fetchMeritveTerenVnosi } from './measurements/teren-vnosi'")
    expect(tab).not.toContain('const vrstice = data as Array<Record<string, unknown>>')
    expect(tab).not.toContain('manjkajoč id v odgovoru API-ja')
    expect(tab).not.toContain('arMetadata ni razumljen kot JSON objekt (pokvaren vir)')
  })

  it('(G2) modul nosi bajtna kontrakta EKSPLICITNO (iskreno — nič tihega dialektnega stikala)', () => {
    expect(modul).toContain('zKotom: boolean')
    expect(modul).toContain('...(opcije.zKotom ? { kotStopinje: kot } : {})')
    expect(modul).toContain('pruneMeritveTerenVrstice')
    expect(modul).toContain('fetchMeritveTerenVnosi')
  })

  it('(H) 0 novih hex v modulu (logika — barve niso del kontrakta; val 32 je aria/title/ring razredi v tabu)', () => {
    const hex = modul.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
    expect(hex).toEqual([])
  })
})
