// R152 — testi (iskreni podatki: nič demo fallbackov, iskreni lokalni osnutki).
// ---------------------------------------------------------------------------
//   • REGRESIJSKI STRAŽAR: v src/components/roksal NE SME biti nobenega
//     `const demo[A-Z]` polja (izmišljeni podatki na mestu napake/praznega
//     stanja so fail-open kršitev — vzorec, ki ga je R151/R152 odstranil iz
//     documents/dashboard/inventory/safety/measurements tabov).
//   • REGRESIJSKI STRAŽAR 2: noben `id: \`local_${Date.now()}` vzorec v
//     komponentah (izmišljene vrstice s fake-success toastom — nadomeščene
//     z eksplicitnimi osnutki iz lib/measurement-drafts).
//   • lib/measurement-drafts: determinističen draftId (monoton števec), JSON
//     round-trip, loadDrafts → korupten vnos preskočen (ostali ohranjeni,
//     skipped viden), removeDraft idempotenten, draftsKey validacija,
//     fail-closed brez localStorage (SSR), saveDraft append na začetek.
//
// localStorage se simulira z globalThis shimom (jsdom ni v uporabi).
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  DRAFT_KEY_PREFIX,
  draftsKey,
  loadDrafts,
  makeDraftId,
  removeDraft,
  saveDraft,
  type MeasurementDraft,
} from '@/lib/measurement-drafts'

// ---------------------------------------------------------------------------
// 1) REGRESIJSKI STRAŽARJI (celoten roksal komponent direktorij)
// ---------------------------------------------------------------------------

function roksalComponentFiles(): string[] {
  const dir = join(process.cwd(), 'src', 'components', 'roksal')
  return readdirSync(dir).filter((f) => f.endsWith('.tsx')).map((f) => join(dir, f))
}

describe('R152 regresijski stražarji — iskreni podatki v komponentah', () => {
  it('nobena roksal komponenta ne sme vsebovati `const demo[A-Z]` polja', () => {
    const offenders: string[] = []
    for (const file of roksalComponentFiles()) {
      const src = readFileSync(file, 'utf8')
      if (/const demo[A-Z]\w*\s*[=:]/.test(src)) offenders.push(file)
    }
    expect(offenders).toEqual([])
  })

  it('nobena roksal komponenta ne sme več kreira `id: local_${Date.now()}` vrstic', () => {
    const offenders: string[] = []
    for (const file of roksalComponentFiles()) {
      const src = readFileSync(file, 'utf8')
      if (/id:\s*`local_\$\{Date\.now\(\)/.test(src)) offenders.push(file)
    }
    expect(offenders).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 2) localStorage shim
// ---------------------------------------------------------------------------

type Store = Record<string, string>

function installLocalStorage(): { store: Store } {
  const store: Store = {}
  ;(globalThis as Record<string, unknown>).window = { localStorage: undefined }
  Object.defineProperty((globalThis as Record<string, unknown>).window, 'localStorage', {
    value: {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = String(v) },
      removeItem: (k: string) => { delete store[k] },
      clear: () => { for (const k of Object.keys(store)) delete store[k] },
    },
    configurable: true,
  })
  return { store }
}

function uninstallLocalStorage() {
  delete (globalThis as Record<string, unknown>).window
}

describe('R152 — lib/measurement-drafts (iskreni offline osnutki)', () => {
  let store: Store
  beforeEach(() => { store = installLocalStorage().store })
  afterEach(() => uninstallLocalStorage())

  it('draftId je determinističen znotraj seje: monoton števec, brez Math.random', () => {
    const t0 = 1_700_000_000_000
    const a = makeDraftId(t0)
    const b = makeDraftId(t0)
    const c = makeDraftId(t0)
    expect(a).toBe(`draft_${t0}_1`)
    expect(b).toBe(`draft_${t0}_2`)
    expect(c).toBe(`draft_${t0}_3`)
    // 100× zaporedje brez kolizij (determinizem znotraj istega procesa)
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) ids.add(makeDraftId(t0))
    expect(ids.size).toBe(100)
  })

  it('draftsKey: prefiks + projectId; prazen/neveljaven projectId → vidna napaka', () => {
    expect(draftsKey('proj-1')).toBe(`${DRAFT_KEY_PREFIX}proj-1`)
    expect(() => draftsKey('')).toThrow(/projectId je obvezen/)
    expect(() => draftsKey(undefined as unknown as string)).toThrow(/projectId je obvezen/)
  })

  it('saveDraft appenda na ZAČETEK; loadDrafts vrne v vrstnem redu shranjevanja', () => {
    const d1: MeasurementDraft = { draftId: 'draft_1', createdAt: '2026-09-26T01:00:00.000Z', label: 'prva', payload: { dolzinaMm: 1000 } }
    const d2: MeasurementDraft = { draftId: 'draft_2', createdAt: '2026-09-26T01:01:00.000Z', label: 'druga', payload: { dolzinaMm: 2000 } }
    saveDraft('p1', d1)
    saveDraft('p1', d2)
    const { drafts, skipped } = loadDrafts('p1')
    expect(skipped).toBe(0)
    expect(drafts.map((d) => d.draftId)).toEqual(['draft_2', 'draft_1'])
    // payload je round-trip identičen
    expect(drafts[1].payload).toEqual({ dolzinaMm: 1000 })
  })

  it('osnutki so ločeni na projekt (ključ per projekt)', () => {
    saveDraft('proj-A', { draftId: 'draft_a', createdAt: '2026-09-26T01:00:00.000Z', label: 'A', payload: {} })
    saveDraft('proj-B', { draftId: 'draft_b', createdAt: '2026-09-26T01:00:00.000Z', label: 'B', payload: {} })
    expect(loadDrafts('proj-A').drafts.map((d) => d.draftId)).toEqual(['draft_a'])
    expect(loadDrafts('proj-B').drafts.map((d) => d.draftId)).toEqual(['draft_b'])
  })

  it('korupten JSON → skipped: 1, ostali osnutki (v več elementih) ohranjeni', () => {
    const key = draftsKey('p-corrupt')
    // veljaven element + pokvarjen element v istem seznamu
    window.localStorage.setItem(key, JSON.stringify([
      { draftId: 'draft_ok', createdAt: '2026-09-26T01:00:00.000Z', label: 'ok', payload: { x: 1 } },
      { broken: true },
    ]))
    const { drafts, skipped } = loadDrafts('p-corrupt')
    expect(drafts.map((d) => d.draftId)).toEqual(['draft_ok'])
    expect(skipped).toBe(1)
    // popolnoma pokvarjen JSON (nič uporabnega)
    window.localStorage.setItem(key, '{nič tega}')
    const r2 = loadDrafts('p-corrupt')
    expect(r2.drafts).toEqual([])
    expect(r2.skipped).toBe(1)
  })

  it('struktura brez payload/draftId/createdAt → preskočena (fail-closed validacija)', () => {
    const key = draftsKey('p-shape')
    window.localStorage.setItem(key, JSON.stringify([
      { draftId: 'ok', createdAt: '2026-09-26T01:00:00.000Z', payload: {} },
      { draftId: 'brez-payload', createdAt: '2026-09-26T01:00:00.000Z' },
      { createdAt: '2026-09-26T01:00:00.000Z', payload: {} },
      null,
      'draft kot niz',
    ]))
    const { drafts, skipped } = loadDrafts('p-shape')
    expect(drafts.map((d) => d.draftId)).toEqual(['ok'])
    expect(skipped).toBe(4)
  })

  it('removeDraft je idempotenten; manjkajoči draftId ne spremeni ostalih', () => {
    saveDraft('p2', { draftId: 'draft_x', createdAt: '2026-09-26T01:00:00.000Z', label: 'x', payload: {} })
    saveDraft('p2', { draftId: 'draft_y', createdAt: '2026-09-26T01:01:00.000Z', label: 'y', payload: {} })
    const afterFirst = removeDraft('p2', 'draft_x')
    expect(afterFirst.map((d) => d.draftId)).toEqual(['draft_y'])
    const afterSecond = removeDraft('p2', 'draft_x')
    expect(afterSecond.map((d) => d.draftId)).toEqual(['draft_y'])
  })

  it('fail-closed brez localStorage (SSR): loadDrafts/saveDraft javita, ne tiho', () => {
    uninstallLocalStorage()
    expect(() => loadDrafts('p3')).toThrow(/localStorage ni na voljo/)
    expect(() => saveDraft('p3', { draftId: 'd', createdAt: 'x', label: '', payload: {} })).toThrow(/localStorage ni na voljo/)
    // restore za afterEach
    installLocalStorage()
  })

  it('neznani projectId ne razkrije podatkov drugega projekta (izolacija ključev)', () => {
    saveDraft('pA', { draftId: 'draft_a', createdAt: '2026-09-26T01:00:00.000Z', label: 'A', payload: { sekretno: 'A' } })
    const { drafts } = loadDrafts('pB')
    expect(drafts).toEqual([])
  })
})
