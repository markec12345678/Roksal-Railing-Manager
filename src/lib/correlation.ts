// Roksal — correlation ID (issue #5 §22, R139: nadaljevanje iz R138)
// ---------------------------------------------------------------------------
// R138 je v proxy.ts (Next 16 middleware) uvedel `x-correlation-id`: vsak
// request dobi enoličen ID (klientov ga prevzame, sicer crypto.randomUUID)
// in ga posreduje route handlerjem. R138 ga je uporabil SAMO /api/search.
//
// R139: pomožnik za VSE kritične rute — enaka oblika strukturiranega loga
// in 5xx payload-a, brez različic od rute do rute:
//   • `correlationFromRequest(request)` — prebere glavo, ki jo je dodelil
//     proxy (sanitizirano: dolžina + varni znaki), z lokalnim UUID kot
//     rezervo (direktni klic v dev/testih brez proxy plast).
//   • `logWithCorrelation(event, correlationId, error)` — ENA oblika loga:
//     { event, correlationId, error } kot JSON (Vercel logi ga lahko
//     filtrirajo po obeh poljih; correlationId poveže klientov screenshot
//     napake s strežniškim zapisom).
//
// Načelo (§22): correlation ID ne spremeni VEDENJA — samo opazuje in korelira.
// Napaka s correlation ID v payload-u ne razkrije internih podrobnosti
// (brez stack trace, brez Prisma sporočil) — isti kontrakt kot /api/search.

export const CORRELATION_HEADER = 'x-correlation-id'

/** Maksimalna dolžina klientovega correlation ID (isti strop kot proxy). */
export const CORRELATION_MAX_LENGTH = 128

/**
 * Prebere correlation ID iz zahteve. Proxy ga dodeli VSEM requestom, zato
 * je glava v produkciji vedno prisotna; rezerva pokrije direktno izvajanje
 * (enotni testi, dev brez proxy plasti, interni klici). Klientov ID se
 * prevzame SAMO, če je sanitiziran (dolžina + varni znaki) — tuj znak
 * ne sme preiti v log/payload.
 */
export function correlationFromRequest(request: Request): string {
  const raw = request.headers.get(CORRELATION_HEADER)
  if (raw) {
    const trimmed = raw.trim()
    if (
      trimmed.length >= 8 &&
      trimmed.length <= CORRELATION_MAX_LENGTH &&
      /^[A-Za-z0-9._:-]+$/.test(trimmed)
    ) {
      return trimmed
    }
  }
  return crypto.randomUUID()
}

/** Kratka, varna oblika napake za log/payload — brez stacka, brez internals. */
export function correlationErrorSummary(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error) ?? '[neznana napaka]'
  } catch {
    return '[neznana napaka]'
  }
}

/** Structuriran error log — ENA oblika za vse rute (grep po "event"). */
export function logWithCorrelation(event: string, correlationId: string, error: unknown): void {
  console.error(
    JSON.stringify({
      event,
      correlationId,
      error: correlationErrorSummary(error),
    }),
  )
}
