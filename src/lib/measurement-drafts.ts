/**
 * R152 — Iskreni lokalni osnutki meritev (fail-closed offline store).
 *
 * Problem (fail-open vzorec, odstranjen): ko POST /api/measurements ni uspel,
 * je klient ustvaril izmišljeno vrstico z `local_${Date.now()}` id-jem in
 * pokazal toast.success "(lokalno)" — meritev je izgubljena ob osvežitvi,
 * uporabnik pa je bil lažno obveščen, da je shranjena.
 *
 * Zdaj: neuspele sinhronizacije gredo v EKSPliciten lokalni osnutek
 * (localStorage, ločen ključ na projekt), ki je:
 *   - vedno vidno označen "OSNUTEK — ni sinhronizirano" (badge v vrstici),
 *   - ohranjen čez osvežitve (localStorage, per projekt),
 *   - ročno sinhroniziran prek "Sinhroniziraj osnutke" (retry na isti POST),
 *   - nikoli ni prikazan kot uspešno shranjena meritev v bazi.
 *
 * Fail-closed: localStorage napake (quota, nedostopen) so vidne — klicatelj
 * dobi throws in pokaže toast.error. Ni tihega izgubljanja. Korupten JSON
 * v enemu ključu ne pobriše ostalih osnutkov — preskoči se z opozorilom.
 */

export const DRAFT_KEY_PREFIX = 'roksal_measurement_drafts_'

/** Osnutek = točno tisti POST payload, ki ni bil sinhroniziran + metapodatki. */
export interface MeasurementDraft {
  /** Determinističen id osnutka: draft_<createdAtMs>_<števec> */
  draftId: string
  /** Strežniški čas ustvarjanja osnutka (ISO) — nikoli izmišljen. */
  createdAt: string
  /** Human readable oznaka za seznam osnutkov (oznaka/lokacija meritve). */
  label: string
  /** Točno telo, ki ga je treba ponovno POSTati na /api/measurements. */
  payload: Record<string, unknown>
}

let draftCounter = 0

/** Javni števec za deterministične id-je znotraj seje (raste monotono). */
export function _draftCounterForTest(): number {
  return draftCounter
}

export function makeDraftId(createdAtMs: number = Date.now()): string {
  draftCounter += 1
  return `draft_${createdAtMs}_${draftCounter}`
}

export function draftsKey(projectId: string): string {
  if (!projectId || typeof projectId !== 'string') {
    throw new Error('draftsKey: projectId je obvezen')
  }
  return `${DRAFT_KEY_PREFIX}${projectId}`
}

/** Fail-closed ob odsotnem localStorage (SSR/testi): čitljivo javi, ne tiho. */
function storage(): Storage {
  if (typeof window === 'undefined' || !window.localStorage) {
    throw new Error('localStorage ni na voljo — osnutki ne more biti shranjeni')
  }
  return window.localStorage
}

/**
 * Naloži osnutke projekta. Korupten vnos → { skipped: n } (ostali ohranjeni,
 * napaka je vidna klicatelju, ni tihe izgube celotnega seznama).
 */
export function loadDrafts(projectId: string): {
  drafts: MeasurementDraft[]
  skipped: number
} {
  const key = draftsKey(projectId)
  const raw = storage().getItem(key)
  if (!raw) return { drafts: [], skipped: 0 }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // Korupten seznam → iskreno o čemur vemo: nič uporabnega, vsebina preskočena.
    return { drafts: [], skipped: 1 }
  }

  if (!Array.isArray(parsed)) return { drafts: [], skipped: 1 }

  const drafts: MeasurementDraft[] = []
  let skipped = 0
  for (const entry of parsed) {
    const d = entry as Partial<MeasurementDraft> | null
    if (
      d &&
      typeof d.draftId === 'string' &&
      typeof d.createdAt === 'string' &&
      typeof d.payload === 'object' &&
      d.payload !== null
    ) {
      drafts.push({
        draftId: d.draftId,
        createdAt: d.createdAt,
        label: typeof d.label === 'string' ? d.label : '',
        payload: d.payload as Record<string, unknown>,
      })
    } else {
      skipped += 1
    }
  }
  return { drafts, skipped }
}

/** Shrani en osnutek (append). Quota/serialize napake se širijo (fail-closed). */
export function saveDraft(projectId: string, draft: MeasurementDraft): MeasurementDraft[] {
  const { drafts } = loadDrafts(projectId)
  const next = [draft, ...drafts]
  storage().setItem(draftsKey(projectId), JSON.stringify(next))
  return next
}

/** Odstrani osnutek po draftId (idempotentno). Vrne nov seznam. */
export function removeDraft(projectId: string, draftId: string): MeasurementDraft[] {
  const { drafts } = loadDrafts(projectId)
  const next = drafts.filter((d) => d.draftId !== draftId)
  storage().setItem(draftsKey(projectId), JSON.stringify(next))
  return next
}

/** Zamenjaj celoten seznam (po sinhronizaciji — odstrani uspešne). */
export function writeDrafts(projectId: string, drafts: MeasurementDraft[]): void {
  storage().setItem(draftsKey(projectId), JSON.stringify(drafts))
}

export function draftCount(projectId: string): number {
  return loadDrafts(projectId).drafts.length
}
