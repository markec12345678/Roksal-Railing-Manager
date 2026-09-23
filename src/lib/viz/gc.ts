/**
 * VIZ — staging garbage collection (runda S+4, P1 §5).
 *
 * Zapuščeni staging (`viz/staging/<token>/*`) nastane, ko uporabnik začne
 * tok (stage/preview) in NE shrani projekta (zapre brskalnik, pade povezava,
 * ali pa save ne uspe po commitu). Ena seja stage-uje do ~12 MB — brez GC
 * to raste brez meje.
 *
 * Politika TTL = **24 ur** (VIZ_STAGING_TTL_MS preglasi):
 *   • Normalen tok porabi staging tokene v minutah (save izbriše porabljene).
 *   • 24 h je veliko višje od najdaljše realne seje (sreda odmor, naslednji
 *     dan nadaljevanje) — aktivnega staginga NE more po naključju izbrisati.
 *   • Starost staging tokena = NAJNOVEJŠI uploadedAt njegovih datotek
 *     (aktivnost podaljša življenje).
 *
 * GC NE smeta prizadeti:
 *   • `viz/projects/**` — shranjeni projekti (nikoli pod staging prefixom)
 *   • `viz/render-jobs/**` — metadata render jobov
 * (preprosto zato, ker GC dela list NAJSTROŽJEGA prefixa `viz/staging/`).
 */
import { vizDelPrefix, vizListWithTimes } from './storage'

/** Privzeti TTL: 24 ur. */
export const DEFAULT_STAGING_TTL_MS = 24 * 60 * 60 * 1000

export function stagingTtlMs(): number {
  const raw = Number(process.env.VIZ_STAGING_TTL_MS)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_STAGING_TTL_MS
}

export interface GcStagingResult {
  /** Število staging tokenov, ki jih je list našel. */
  scannedTokens: number
  /** Tokeni izbrisani (pretečeni). */
  deletedTokens: string[]
  /** Število izbrisanih datotek. */
  deletedFiles: number
  /** Tokeni, ki ostanejo (sveži). */
  keptTokens: string[]
  /** Uporabljen TTL. */
  ttlMs: number
  /** Datum zagona. */
  ranAt: string
}

/** Iz ključa `viz/staging/<token>/<ime>` poišči token (ali null, če oblika ne ustreza). */
export function stagingTokenOfKey(key: string): string | null {
  const rest = key.startsWith('viz/staging/') ? key.slice('viz/staging/'.length) : null
  if (!rest) return null
  const slash = rest.indexOf('/')
  if (slash <= 0) return null
  const token = rest.slice(0, slash)
  return /^[A-Za-z0-9_-]{1,100}$/.test(token) ? token : null
}

/**
 * Počisti pretečeni staging. Varno za projekte (obrača se SAMO na viz/staging/).
 */
export async function gcStaging(opts: { now?: Date; ttlMs?: number } = {}): Promise<GcStagingResult> {
  const now = opts.now ?? new Date()
  const ttlMs = opts.ttlMs ?? stagingTtlMs()
  const items = await vizListWithTimes('viz/staging/')

  // Združi po tokenu; starost = NAJNOVEJŠI uploadedAt (aktivnost podaljša).
  const byToken = new Map<string, { count: number; latest: number }>()
  for (const item of items) {
    const token = stagingTokenOfKey(item.key)
    if (!token) continue
    const t = byToken.get(token) ?? { count: 0, latest: 0 }
    t.count += 1
    t.latest = Math.max(t.latest, item.uploadedAt.getTime())
    byToken.set(token, t)
  }

  const deletedTokens: string[] = []
  let deletedFiles = 0
  const keptTokens: string[] = []
  for (const [token, info] of byToken) {
    if (now.getTime() - info.latest > ttlMs) {
      // token je validiran z SAFE_SEGMENT v stagingTokenOfKey — varen prefix
      await vizDelPrefix(`viz/staging/${token}/`)
      deletedTokens.push(token)
      deletedFiles += info.count
    } else {
      keptTokens.push(token)
    }
  }

  return {
    scannedTokens: byToken.size,
    deletedTokens,
    deletedFiles,
    keptTokens,
    ttlMs,
    ranAt: now.toISOString(),
  }
}
