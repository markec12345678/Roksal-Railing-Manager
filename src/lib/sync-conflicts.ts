/**
 * R148 (issue #5 §36 — Mobile sync conflict model): deterministično jedro
 * sync protokola.
 *
 * §36 zahteva: device ID, client mutation ID, server/client timestamps,
 * ordering, duplicate detection, conflict detection/resolution, tombstones,
 * retry, partial sync, cursor/server revision — HTTP 200 mora jasno povedati,
 * kaj je bilo dejansko sprejeto.
 *
 * Pravila:
 *   • Ordering + cursor = MONOTONI `syncRevision` števec na projektu (rasel
 *     SAMO ob sync zapisih; 0 = brez sync zgodovine — nič ne izmišljamo).
 *     Časovni žigi se NIKOLI ne uporabljajo za vrstni red (nesinhronizirane
 *     ure) — samo za diagnostiko/audit.
 *   • Conflict detection: klient pošlje `baseRevision` (revizija, ki jo je
 *     videl) in/ali `baseUpdatedAt` (čas vnosa, ki ga je videl). Strežnik
 *     primerja z TRENUTNIM stanjem — odstopanje kateregakoli podanega vhoda
 *     je konflikt (NE tihi LWW). Brez obeh vhodov (star klient) se zapis
 *     uporabi z IZRECnim warningom (nadgrajljivost, dokumentirano).
 *   • Client-ahead (baseRevision > serverRevision) je KONFLIKT — strežnik
 *     ne ugiba kaj je izgubljeno (fail-closed).
 *   • Tombstone: izbrisan mobilni projekt ima grobnico (preživi brisanje
 *     vrstice) — ponovni sync dobi iskren `tombstone` rezultat, ne dvojnika.
 *   • Retry mapping: determinističen — konflikt je ponovljiv (klient osveži
 *     bazo in ponovi), validacijska napaka/grobnica ni ponovljiva.
 *   • Partial sync: kurzor + limit (strop), odgovor nosi nextCursor + hasMore.
 */

export const SYNC_DEVICE_ID_MIN = 8
export const SYNC_DEVICE_ID_MAX = 128
/** Varni znaki device ID-ja (brez presledkov/potnih ločil — header-safe). */
const DEVICE_ID_RE = /^[A-Za-z0-9._:-]+$/

export const SYNC_GET_DEFAULT_LIMIT = 100
export const SYNC_GET_MAX_LIMIT = 200

/**
 * Normalizacija device ID-ja (§36 "device ID"): niz, obrezan, 8–128 znakov,
 * samo varni znaki [A-Za-z0-9._:-]. Ne-znan izvor → napaka (fail-closed).
 */
export function normalizeDeviceId(raw: unknown): { error: string } | { deviceId: string } {
  if (typeof raw !== 'string') return { error: 'X-Device-Id mora biti niz' }
  const trimmed = raw.trim()
  if (trimmed.length < SYNC_DEVICE_ID_MIN) {
    return { error: `X-Device-Id mora imeti vsaj ${SYNC_DEVICE_ID_MIN} znakov` }
  }
  if (trimmed.length > SYNC_DEVICE_ID_MAX) {
    return { error: `X-Device-Id presega ${SYNC_DEVICE_ID_MAX} znakov` }
  }
  if (!DEVICE_ID_RE.test(trimmed)) {
    return { error: 'X-Device-Id vsebuje neveljavne znake (dovoljeno: črke, številke, . _ : -)' }
  }
  return { deviceId: trimmed }
}

export type ConflictVerdict =
  | { kind: 'legacy' }
  | { kind: 'clean' }
  | { kind: 'conflict'; detail: string }

/**
 * Deterministična odločitev konflikta (strežnik ne zaupa klientu):
 *   • brez obeh vhodov → 'legacy' (uporabi z izrecnim warningom);
 *   • baseRevision: cela števila ≥ 0; odstopanje od serverRevision → konflikt;
 *   • baseUpdatedAt: ISO čas; odstopanje od serverUpdatedAt → konflikt;
 *   • odstopanje kateregakoli PODANEGA vhoda → konflikt (fail-closed).
 * Neznani tipi vhodov → konflikt z razlogom (nismo utišali, nismo uporabili).
 */
export function detectSyncConflict(input: {
  baseRevision: unknown
  baseUpdatedAt: unknown
  serverRevision: number
  serverUpdatedAt: Date
}): ConflictVerdict {
  const hasRevision = input.baseRevision !== undefined && input.baseRevision !== null
  const hasUpdatedAt = input.baseUpdatedAt !== undefined && input.baseUpdatedAt !== null
  if (!hasRevision && !hasUpdatedAt) return { kind: 'legacy' }

  if (hasRevision) {
    const b = input.baseRevision
    if (typeof b !== 'number' || !Number.isInteger(b) || b < 0) {
      return { kind: 'conflict', detail: `Neveljaven baseRevision: ${String(b)}` }
    }
    if (b !== input.serverRevision) {
      const smer = b < input.serverRevision ? 'zastarel (strežnik je naprej)' : 'pred strežnikom (strežnik ne ugiba)'
      return {
        kind: 'conflict',
        detail: `baseRevision ${b} ≠ strežniška revizija ${input.serverRevision} — ${smer}.`,
      }
    }
  }
  if (hasUpdatedAt) {
    const bu = input.baseUpdatedAt
    if (typeof bu !== 'string' || Number.isNaN(Date.parse(bu))) {
      return { kind: 'conflict', detail: `Neveljaven baseUpdatedAt: ${String(bu)}` }
    }
    const serverIso = input.serverUpdatedAt.toISOString()
    // Deterministična primerjava ISO nizov (ista oblika — ms natančnost).
    if (new Date(bu).toISOString() !== serverIso) {
      return {
        kind: 'conflict',
        detail: `baseUpdatedAt (${bu}) ≠ strežniški updatedAt (${serverIso}) — strežniški zapis se je spremenil.`,
      }
    }
  }
  return { kind: 'clean' }
}

/**
 * Determinističen naslednji števec revizij (rasel SAMO ob sync zapisih).
 * Strežniški zapis ni nikoli premaknjen nazaj — max(current) + 1.
 */
export function nextSyncRevision(current: number): number {
  if (!Number.isInteger(current) || current < 0) return 1
  return current + 1
}

/**
 * Determinističen mapping ponovljivosti (§36 "retry"): konflikt je
 * ponovljiv po osvežitvi baze; validacija/trobnica nista (isti poskus bo
 * spet zavrnjen — spremeni podatke, ne pošiljaj znova).
 */
export function syncRetryable(kind: 'created' | 'updated' | 'conflict' | 'tombstone' | 'error', error?: string): boolean {
  if (kind === 'conflict') return true
  if (kind === 'error') {
    // Statusni stroj (zavrnjen prehod) je odvisen od strežniškega stanja —
    // ponovitev po osvežitvi je smiselna; validacija payload-a ni.
    return typeof error === 'string' && error.includes('statusni stroj')
  }
  return false
}

/** Strop za listanje grobnic v GET odgovoru (klient počisti lokalno). */
export const SYNC_TOMBSTONES_MAX = 100
