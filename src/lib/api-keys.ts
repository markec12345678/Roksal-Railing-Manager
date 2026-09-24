// Roksal — API-key scope katalog (R126 — issue #5 §3: API-key lifecycle)
// ---------------------------------------------------------------------------
// API ključ (servisni principal MOBILE_SYNC) NI več "dobrodelno vse ali nič":
// vsak ključ nosi izrazno scope listo, projektne omejitve, potek in per-key
// omejitev hitrosti. Ta datoteka je EDINI katalog veljavnih scope-ov —
// rute preverjajo konkreten scope, ne "ali je apikey".
//
// Načela (usklajeno z docs/SECURITY-POLICY.md):
//   1. Scope NIKOLI ugibamo iz imena ključa — samo iz baze.
//   2. Neznani scope v bazi = ključ ne dobi pravic, ki jih nosi (parse samo
//      prepoznane vrednosti); neznane vrednosti pa se vidijo v CLI --list,
//      da jih owner popravi. Fail-closed.
//   3. Privzeta lista NOVEGA ključa = dosedanja pogodba MOBILE_SYNC (matrika
//      v access.ts). Nič ne zožimo tiho, nič ne razširimo tiho.

/** Veljavni scope-i API ključev z namenskim opisom. */
export const API_KEY_SCOPES = {
  /** Sinhronizacija: branje sync zrcala projektov (/api/sync GET). */
  'projects:read': 'branje projektov prek sync zrcala',
  /** Sinhronizacija: upsert projektov + status SAMO prek statusnega stroja. */
  'projects:write': 'ustvarjanje/posodabljanje projektov prek sync (statusni stroj)',
  /** Potrjevanje meritev iz terena (/api/measurement/confirm). */
  'measurements:create': 'potrjevanje meritev (measurement confirm)',
  /** Branje fotodokumentacije projekta (/api/photos GET). */
  'photos:read': 'branje fotodokumentacije',
  /** Nalaganje fotodokumentacije (/api/photos POST). */
  'photos:write': 'nalaganje fotodokumentacije',
} as const

export type ApiKeyScope = keyof typeof API_KEY_SCOPES

/** Privzeti scope-i novega ključa = dokumentirana pogodba MOBILE_SYNC. */
export const DEFAULT_API_KEY_SCOPES: ApiKeyScope[] = [
  'projects:read',
  'projects:write',
  'measurements:create',
  'photos:read',
  'photos:write',
]

/** Privzeta per-key omejitev hitrosti (zahtevkov/minuto), če ključ ne pove drugače. */
export const DEFAULT_API_KEY_RATE_LIMIT_PER_MIN = 120

/** Razčleni scope string iz baze; neznane vrednosti tiho spusti (fail-closed). */
export function parseApiKeyScopes(raw: string | null | undefined): ApiKeyScope[] {
  if (!raw) return []
  const valid = new Set(Object.keys(API_KEY_SCOPES))
  const out: ApiKeyScope[] = []
  for (const part of raw.split(',')) {
    const scope = part.trim() as ApiKeyScope
    if (valid.has(scope) && !out.includes(scope)) out.push(scope)
  }
  return out
}

/** Razčleni projektne omejitve; null/prazno = vsi projekti. */
export function parseApiKeyProjectScope(raw: string | null | undefined): string[] | null {
  if (!raw) return null
  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return ids.length > 0 ? ids : null
}

/** Ali context API ključa nosi ta scope? */
export function hasApiKeyScope(
  principal: { kind: string; scopes?: readonly string[] },
  scope: ApiKeyScope
): boolean {
  return principal.kind === 'apikey' && (principal.scopes ?? []).includes(scope)
}
