// R283 — testi: (A) izracunajMeritveVirPregled (issue #15 §3 pokritost
// virov — fail-closed, iskrena praznina); (B) referenčna fikstura
// (issue #15 §1 skelet) proti SKUPNEMU KONTRAKTU v1 — parseArSessionPayload
// + round-trip bajtna identičnost + §1 checklist invarianti.
import { describe, expect, it } from 'vitest'

import fikstura from '../../../scripts/r283-referencni-fiksture.json'
import {
  parseArSessionPayload,
  serializeArSessionPayload,
  AR_SESSION_SOURCES,
} from '@/lib/ar-contract'
import { izracunajMeritveVirPregled } from '@/lib/meritve-viri-pregled'

describe('R283 — izracunajMeritveVirPregled (issue #15 §3, fail-closed)', () => {
  it('prazen seznam → null (iskrena praznina — brez vrstice)', () => {
    expect(izracunajMeritveVirPregled([])).toBeNull()
  })

  it('vse vrstice brez viroma → null (nikoli izumljen števec)', () => {
    expect(izracunajMeritveVirPregled([{ vir: null }, {}, { vir: undefined }])).toBeNull()
  })

  it('neznan vir se NE šteje (fail-closed — nič ugibanja)', () => {
    expect(izracunajMeritveVirPregled([{ vir: 'AVTOMATSKO' }, { vir: 'manual' }])).toBeNull()
  })

  it('delna pokritost (samo MANUAL) → števec + popolnaPokritost false', () => {
    const r = izracunajMeritveVirPregled([{ vir: 'MANUAL' }, { vir: 'MANUAL' }])
    expect(r).toEqual({ manual: 2, photoCv: 0, arcoreDepth: 0, skupaj: 2, popolnaPokritost: false })
  })

  it('polna pokritost (vse tri vrste) → popolnaPokritost true', () => {
    const r = izracunajMeritveVirPregled([
      { vir: 'MANUAL' },
      { vir: 'PHOTO_CV' },
      { vir: 'ARCORE_DEPTH' },
    ])
    expect(r).toEqual({ manual: 1, photoCv: 1, arcoreDepth: 1, skupaj: 3, popolnaPokritost: true })
  })

  it('mešanica: prepoznani + neznani + brez — šteje SAMO prepoznane', () => {
    const r = izracunajMeritveVirPregled([
      { vir: 'MANUAL' },
      { vir: 'NEZNAN_VIR' },
      {},
      { vir: 'ARCORE_DEPTH' },
    ])
    expect(r).not.toBeNull()
    expect(r!.skupaj).toBe(2)
    expect(r!.popolnaPokritost).toBe(false)
  })

  it('dvojni foto-CV + en ročni — števci po vrsti', () => {
    const r = izracunajMeritveVirPregled([
      { vir: 'PHOTO_CV' },
      { vir: 'PHOTO_CV' },
      { vir: 'MANUAL' },
    ])
    expect(r!.photoCv).toBe(2)
    expect(r!.manual).toBe(1)
    expect(r!.arcoreDepth).toBe(0)
  })

  it('zaprta množica = AR_SESSION_SOURCES (EN VIR resnice — kontrakt #17 B)', () => {
    // vsi trije viri kontrakta se štejejo; karkoli zunaj — ne
    expect(AR_SESSION_SOURCES).toEqual(['ARCORE_DEPTH', 'MANUAL', 'PHOTO_CV'])
  })
})

describe('R283 — referenčna fikstura (issue #15 §1 skelet) proti kontraktu v1', () => {
  const meritve = fikstura.meritve as Array<{
    id: string
    vir: string
    dolzinaMm: number
    visinaMm: number
    status: string
    verzija: number
    ts: string
    arMetadata: Record<string, unknown>
  }>

  it('vse tri vrste virov prisotne (issue #15 §3: manual + PHOTO_CV + ARCORE_DEPTH)', () => {
    const viri = meritve.map((m) => m.vir).sort()
    expect(viri).toEqual(['ARCORE_DEPTH', 'MANUAL', 'PHOTO_CV'])
  })

  it('m3 = POLN kontrakt payload v1 — parse uspe (T3 referenčna integriteta vključno)', () => {
    const m3 = meritve.find((m) => m.id === 'e2e-r283-m3')!
    const parsed = parseArSessionPayload(m3.arMetadata)
    expect(parsed.contractVersion).toBe(1)
    expect(parsed.source).toBe('ARCORE_DEPTH')
    expect(parsed.segments.length).toBe(3)
  })

  it('m3 round-trip bajtno identičen (ključni vrstni red = red definicije sheme)', () => {
    const m3 = meritve.find((m) => m.id === 'e2e-r283-m3')!
    const payload = JSON.parse(JSON.stringify(m3.arMetadata))
    expect(serializeArSessionPayload(parseArSessionPayload(payload))).toBe(
      JSON.stringify(payload),
    )
  })

  it('§1 geometrija: raven (slope 0) + kot 90° + stopniščni (slope 35) + naklon (slope 8)', () => {
    const m3 = meritve.find((m) => m.id === 'e2e-r283-m3')!
    const parsed = parseArSessionPayload(m3.arMetadata)
    const slopes = parsed.segments
      .map((s) => s.slopeDeg)
      .filter((s): s is number => typeof s === 'number')
    expect(slopes).toHaveLength(3)
    expect(slopes.sort((a, b) => a - b)).toEqual([0, 8, 35])
    expect(parsed.segments.map((s) => s.angleDeg)).toContain(90)
    // m1 legacy dialekt nosi kot 90° (UI kot badge resnica)
    const m1 = meritve.find((m) => m.id === 'e2e-r283-m1')!
    expect((m1.arMetadata as { kot?: number }).kot).toBe(90)
  })

  it('§1 različne dolžine + višine + profil + barva/material', () => {
    const dolzine = new Set(meritve.map((m) => m.dolzinaMm))
    expect(dolzine.size).toBeGreaterThanOrEqual(3)
    const m3 = meritve.find((m) => m.id === 'e2e-r283-m3')!
    const parsed = parseArSessionPayload(m3.arMetadata)
    const profili = new Set(parsed.segments.map((s) => s.profile))
    expect(profili.has('ROMB 67')).toBe(true)
    const materiali = new Set(parsed.segments.map((s) => s.material))
    expect(materiali.has('ALU')).toBe(true)
    expect(materiali.has('WPC sivi')).toBe(true)
    expect(parsed.segments.some((s) => s.color === 'RAL 7016')).toBe(true)
  })

  it('§1 fotografije: photoIds ⊆ photoRefs (T3 — nič osirotelih) + glbRefs', () => {
    const m3 = meritve.find((m) => m.id === 'e2e-r283-m3')!
    const parsed = parseArSessionPayload(m3.arMetadata)
    expect(parsed.photoRefs!.length).toBeGreaterThanOrEqual(2)
    expect(parsed.glbRefs!.length).toBe(1)
    for (const seg of parsed.segments) {
      for (const pid of seg.photoIds ?? []) {
        expect(parsed.photoRefs!.some((r) => r.ref === pid)).toBe(true)
      }
      for (const mid of seg.modelIds ?? []) {
        expect(parsed.glbRefs!.some((r) => r.ref === mid)).toBe(true)
      }
    }
  })

  it('§1 ponovni obisk: AR session nosi Drug sessionId (drugi datum — determinizem)', () => {
    const m3 = meritve.find((m) => m.id === 'e2e-r283-m3')!
    const parsed = parseArSessionPayload(m3.arMetadata)
    expect(parsed.sessionId).toBe('e2e-r283-sess-3')
    const m1ts = meritve.find((m) => m.id === 'e2e-r283-m1')!.ts
    expect(m3.ts > m1ts).toBe(true)
  })

  it('skelet semantika: vse meritve OSNUTEK verzija 1 — ČAKAJO terensko potrditev', () => {
    for (const m of meritve) {
      expect(m.status).toBe('OSNUTEK')
      expect(m.verzija).toBe(1)
    }
  })
})
