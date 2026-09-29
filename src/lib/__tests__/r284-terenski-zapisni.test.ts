// R284 — testi: TERENSKI ZAPISNI LIST (issue #15 §3, worklog i5).
// (A) zapisniListVrste — čista funkcija (X1 fizični stolpci VEDNO null; X2 EN
//     VIR R269 meritevTerenPregled + R186 kot; X3 fail-closed; sort parity);
// (B) buildTerenskiZapisniPdfDoc — bajtni determinizem (X4 soli 0xb5–0xb8),
//     različna družina od R269 (NI konflikta z bajtnimi kontrakti);
// (C) ime datoteke; (D) salt register izolacija; (E) TERENSKA_VRATA ×9
//     (issue #14 §18 — statični protokol, NIKOLI podatki);
// (F) referenčna fikstura r283 (EN VIR — issue #15 §1 skelet) → §3 zapisni
//     list resnica (m1 kot 90 legacy, m2/m3 brez legacy kota = iskren '—').
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Buffer } from 'node:buffer'

import fikstura from '../../../scripts/r283-referencni-fiksture.json'
import {
  zapisniListVrste,
  buildTerenskiZapisniPdfDoc,
  terenskiZapisniPdfFilename,
  TERENSKA_VRATA,
  type TerenskiZapisniVnos,
} from '@/lib/terenski-zapisni-pdf'
import { buildMeritveTerenPdfDoc } from '@/lib/meritve-teren-pdf'

const NOW = new Date('2026-09-29T08:00:00.000Z')

function meritev(razlik: Partial<TerenskiZapisniVnos>): TerenskiZapisniVnos {
  return {
    id: 'm-x',
    createdAt: '2026-09-20T10:00:00.000Z',
    dolzinaMm: 3450,
    visinaMm: 1000,
    status: 'OSNUTEK',
    tipMeritve: 'RAZDALJA',
    ...razlik,
  }
}

/** Fikstura meritve → MeritveTerenVnos (zrcali component DTO pruning:
 *  createdAt = ts; arMetadata kot JSON niz; legacy ar.kot = kotStopinje). */
function fiksturaVnos(m: {
  id: string
  ts: string
  dolzinaMm: number
  visinaMm: number
  vir: string
  status: string
  verzija: number
  arMetadata: Record<string, unknown>
}): TerenskiZapisniVnos {
  const ar = m.arMetadata as { tipMeritve?: string; oznaka?: string; opomba?: string; kot?: unknown }
  return {
    id: m.id,
    createdAt: m.ts,
    dolzinaMm: m.dolzinaMm,
    visinaMm: m.visinaMm,
    tipMeritve: ar.tipMeritve ?? null,
    oznaka: ar.oznaka ?? null,
    status: m.status,
    lokacija: null,
    opomba: ar.opomba ?? null,
    verzija: m.verzija,
    vir: m.vir,
    kotStopinje: typeof ar.kot === 'number' ? ar.kot : null,
  }
}

describe('R284 — zapisniListVrste (X1/X2/X3)', () => {
  it('zapisana resnica verbatim + fizični stolpci VEDNO null (X1 — izpolni lastnik)', () => {
    const { vrste } = zapisniListVrste([
      meritev({ id: 'm1', oznaka: 'REF-A', vir: 'MANUAL', verzija: 1, kotStopinje: 90 }),
    ])
    expect(vrste).toHaveLength(1)
    const v = vrste[0]
    expect(v.id).toBe('m1')
    expect(v.dolzinaMm).toBe(3450)
    expect(v.visinaMm).toBe(1000)
    expect(v.status).toBe('OSNUTEK')
    expect(v.oznaka).toBe('REF-A')
    expect(v.kot).toBe(90)
    expect(v.vir).toBe('MANUAL')
    expect(v.verzija).toBe(1)
    // X1: fizični stolpci NIKOLI izmišljeni — VEDNO null v digitalni resnici.
    expect(v.fizicnaRefMm).toBeNull()
    expect(v.deltaMm).toBeNull()
    expect(v.zapiskiTerena).toBeNull()
  })

  it('prazen seznam → TypeError (X3 — komponenta pokaže iskren toast)', () => {
    expect(() => zapisniListVrste([])).toThrow(TypeError)
    expect(() => zapisniListVrste([])).toThrow(/prazen seznam meritev/)
  })

  it('podvojen id → TypeError (pokvaren vir — dedup EN VIR R269)', () => {
    expect(() =>
      zapisniListVrste([meritev({ id: 'd1' }), meritev({ id: 'd1', oznaka: 'druga' })]),
    ).toThrow(TypeError)
    expect(() =>
      zapisniListVrste([meritev({ id: 'd1' }), meritev({ id: 'd1', oznaka: 'druga' })]),
    ).toThrow(/podvojen id/)
  })

  it('neznani status → TypeError (EN VIR R154 — 3 znani)', () => {
    expect(() => zapisniListVrste([meritev({ status: 'NEZNAN' })])).toThrow(TypeError)
    expect(() => zapisniListVrste([meritev({ status: 'NEZNAN' })])).toThrow(/status mora biti eden izmed/)
  })

  it('neznani vir → TypeError (X3 — fail-closed, NIČ ugibanja)', () => {
    expect(() => zapisniListVrste([meritev({ vir: 'NEZNAN_VIR' })])).toThrow(TypeError)
    expect(() => zapisniListVrste([meritev({ vir: 'NEZNAN_VIR' })])).toThrow(/vir mora biti eden izmed/)
  })

  it('kot: brez kotStopinje → null (iskren odpad "—" na listu)', () => {
    const { vrste } = zapisniListVrste([meritev({ id: 'm2' })])
    expect(vrste[0].kot).toBeNull()
  })

  it('sort EN VIR R269: OSNUTEK → POTRJENA (brez oznake zadnja) → ARHIVIRANA', () => {
    const { vrste } = zapisniListVrste([
      meritev({ id: 'h1', status: 'ARHIVIRANA', oznaka: 'A' }),
      meritev({ id: 'p2', status: 'POTRJENA' }),
      meritev({ id: 'a1', oznaka: 'B' }),
      meritev({ id: 'p1', status: 'POTRJENA', oznaka: 'C' }),
      meritev({ id: 'a2', oznaka: 'A' }),
    ])
    expect(vrste.map((v) => v.id)).toEqual(['a2', 'a1', 'p1', 'p2', 'h1'])
  })

  it('fikstura r283 EN VIR (issue #15 §1 skelet) → 3 vrste z viri §3', () => {
    const meritve = fikstura.meritve.map(fiksturaVnos)
    const { vrste, povzetek } = zapisniListVrste(meritve)
    expect(vrste).toHaveLength(3)
    expect(vrste.map((v) => v.vir)).toEqual(['MANUAL', 'PHOTO_CV', 'ARCORE_DEPTH'])
    expect(vrste.map((v) => v.dolzinaMm)).toEqual([3450, 2100, 4800])
    expect(vrste.map((v) => v.visinaMm)).toEqual([1000, 1000, 1100])
    expect(vrste.map((v) => v.verzija)).toEqual([1, 1, 1])
    // m1 legacy dialekt — kot 90° iz arMetadata.kot; m2/m3 brez legacy kota.
    expect(vrste[0].kot).toBe(90)
    expect(vrste[1].kot).toBeNull()
    expect(vrste[2].kot).toBeNull()
    // §3 isti test prek VSEH treh virov — vsi OSNUTEK (čaka terensko potrditev).
    expect(povzetek.meritev).toBe(3)
    expect(povzetek.osnutkov).toBe(3)
    expect(povzetek.skupnaDolzinaMm).toBe(3450 + 2100 + 4800)
  })

  it('fikstura fizični stolpci null TUDI za referenčni skelet (NI izmišljenih meritev)', () => {
    const { vrste } = zapisniListVrste(fikstura.meritve.map(fiksturaVnos))
    for (const v of vrste) {
      expect(v.fizicnaRefMm).toBeNull()
      expect(v.deltaMm).toBeNull()
      expect(v.zapiskiTerena).toBeNull()
    }
  })
})

describe('R284 — buildTerenskiZapisniPdfDoc (X4 bajtni determinizem)', () => {
  const VHOD: TerenskiZapisniVnos[] = [
    meritev({ id: 'a1', oznaka: 'REF-A', vir: 'MANUAL', verzija: 1, kotStopinje: 90 }),
    meritev({ id: 'a2', oznaka: 'REF-B', vir: 'PHOTO_CV', verzija: 1, createdAt: '2026-09-21T10:00:00.000Z' }),
    meritev({ id: 'a3', vir: 'ARCORE_DEPTH', verzija: 1, createdAt: '2026-10-01T09:00:00.000Z', dolzinaMm: 4800, visinaMm: 1100 }),
  ]
  const zgradi = (m: readonly TerenskiZapisniVnos[] = VHOD, n: Date = NOW): Buffer =>
    Buffer.from(
      buildTerenskiZapisniPdfDoc(m, { now: n, projektIme: 'REF — Terenska validacija (issue #15)' }).output('arraybuffer'),
    )

  it('enak vhod → bajtno enak PDF (X4)', () => {
    expect(zgradi().equals(zgradi())).toBe(true)
  })

  it('različen now → različen PDF (setCreationDate + fileId)', () => {
    expect(zgradi(VHOD, new Date('2026-09-29T08:01:00.000Z')).equals(zgradi())).toBe(false)
  })

  it('%PDF- magija + RAZLIČNA družina od R269 (NI konflikta z bajtnimi kontrakti)', () => {
    const bin = zgradi()
    expect(bin.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(bin.length).toBeGreaterThan(10000)
    const r269 = Buffer.from(buildMeritveTerenPdfDoc(VHOD, { now: NOW, projektIme: 'REF — Terenska validacija (issue #15)' }).output('arraybuffer'))
    expect(r269.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(bin.length).not.toBe(r269.length)
  })

  it('prazen seznam → TypeError (ni prazne datoteke)', () => {
    expect(() => zgradi([])).toThrow(TypeError)
  })

  it('pokvarene opcije → TypeError (now / projektIme)', () => {
    expect(() => buildTerenskiZapisniPdfDoc(VHOD, { now: 'danes' as unknown as Date })).toThrow(TypeError)
    expect(() => buildTerenskiZapisniPdfDoc(VHOD, { now: NOW, projektIme: 42 as unknown as string })).toThrow(TypeError)
  })
})

describe('R284 — terenskiZapisniPdfFilename', () => {
  it('format + determinizem (družinski vzorec)', () => {
    expect(terenskiZapisniPdfFilename(NOW)).toBe('Terenski-zapisni-2026-09-29.pdf')
    expect(() => terenskiZapisniPdfFilename('danes' as unknown as Date)).toThrow(TypeError)
  })
})

describe('R284 — salt register izolacija (X4 — lastni soli 0xb5–0xb8)', () => {
  const lib = readFileSync(join(process.cwd(), 'src/lib/terenski-zapisni-pdf.ts'), 'utf8')
  it('vsebuje lastne soli 0xb5 in 0xb8', () => {
    expect(lib).toContain('fnv1aHex(seed, 0xb5)')
    expect(lib).toContain('fnv1aHex(seed, 0xb8)')
  })
  it('NE vsebuje R269 soli 0xa1/0xa4 (isti salt v dveh libih NE sme dati isti ID)', () => {
    expect(lib).not.toContain('fnv1aHex(seed, 0xa1)')
    expect(lib).not.toContain('fnv1aHex(seed, 0xa4)')
  })
})

describe('R284 — TERENSKA_VRATA (X7 — issue #14 §18, statični protokol)', () => {
  it('točno 9 vrat (field-test gate ×9), vsa ne-prazna', () => {
    expect(TERENSKA_VRATA).toHaveLength(9)
    for (const t of TERENSKA_VRATA) {
      expect(typeof t).toBe('string')
      expect(t.length).toBeGreaterThan(3)
    }
  })
  it('pokriva ključne scenarije (balkon 90°, stopnice, re-anchor, kalibracija, drift)', () => {
    const skupaj = TERENSKA_VRATA.join(' | ')
    expect(skupaj).toContain('balkon 3 m')
    expect(skupaj).toContain('stopnice')
    expect(skupaj).toContain('drift')
    expect(skupaj).toContain('re-anchor')
    expect(skupaj).toContain('calibration point C')
  })
})
