// Roksal — omejevanje hitrosti
// ---------------------------------------------------------------------------
// Brez tega je brute-force na gesla neomejen: napadalec lahko preizkusi tisoč
// gesel na sekundo in edina ovira je bila dolžina skriptovskega dela.
//
// Drseče okno v pomnilniku. Za to aplikacijo je to dovolj, ker:
//   - teče na ENEM vozlišču (SQLite je enoprocesna, systemd enota),
//   - ne potrebuje Redis-a in s tem nove infrastrukture,
//   - ob ponovnem zagonu se števec izprazni, kar je sprejemljivo (najslabši
//     primer: napadalec sproži ponovni zagon in dobi svež proračun).
// Če kdaj postaviš več vozlišč pred isto bazo, zamenjaj shrambo za Redis ali
// SQLite tabelo — vmesnik (`checkRate`) ostane enak.

export interface RateLimitOptions {
  /** Število dovoljenih zadetkov v oknu. */
  limit: number
  /** Dolžina okna v ms. */
  windowMs: number
}

export interface RateLimitResult {
  ok: boolean
  /** Koliko zadetkov še ostane v tem oknu. */
  remaining: number
  /** Čez koliko ms bo spet prosto (0, kadar je `ok`). */
  retryAfterMs: number
  limit: number
  /** Koliko sekund za `Retry-After` glavo. */
  retryAfterSeconds: number
}

interface Bucket {
  hits: number[]
}

const buckets = new Map<string, Bucket>()

/** Privzeto za prijavo: 10 poskusov na 15 minut na (IP + e-naslov). */
export const LOGIN_LIMIT: RateLimitOptions = { limit: 10, windowMs: 15 * 60 * 1000 }
/** Za pisanje po API-ju: velikodušno, lovi samo zankaste kliente. */
export const WRITE_LIMIT: RateLimitOptions = { limit: 300, windowMs: 60 * 1000 }

/**
 * Preveri in zabeleži zadetek.
 *
 * @param key identificira vir (npr. `login:1.2.3.4:marko@roksal.si`)
 */
export function checkRate(key: string, options: RateLimitOptions = WRITE_LIMIT): RateLimitResult {
  const now = Date.now()
  const cutoff = now - options.windowMs
  const bucket = buckets.get(key) ?? { hits: [] }

  // Odstrani zadetke izven okna — brez tega bi seznam rasel v nedogled.
  while (bucket.hits.length > 0 && bucket.hits[0] <= cutoff) bucket.hits.shift()

  if (bucket.hits.length >= options.limit) {
    const oldest = bucket.hits[0]
    const retryAfterMs = Math.max(0, oldest + options.windowMs - now)
    buckets.set(key, bucket)
    return {
      ok: false,
      remaining: 0,
      retryAfterMs,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      limit: options.limit,
    }
  }

  bucket.hits.push(now)
  buckets.set(key, bucket)
  return {
    ok: true,
    remaining: options.limit - bucket.hits.length,
    retryAfterMs: 0,
    retryAfterSeconds: 0,
    limit: options.limit,
  }
}

/**
 * Zabeleži zadetek SAMO ob neuspehu.
 *
 * Za prijavo je to pomembno: uporabnik, ki se desetkrat pravilno prijavi,
 * ne sme biti kaznovan, medtem ko mora napadalec, ki desetkrat zgreši, počakati.
 * Kličemo z `false` za uspeh, `true` za neuspeh.
 */
export function releaseRate(key: string): void {
  const bucket = buckets.get(key)
  if (!bucket) return
  bucket.hits.pop()
  if (bucket.hits.length === 0) buckets.delete(key)
}

/** Pozabi vse (testi) ali en ključ (ročno odpuščanje po preverjenem incidentu). */
export function resetRateLimit(key?: string): void {
  if (key === undefined) buckets.clear()
  else buckets.delete(key)
}

/** Stanje za diagnostiko — koliko ključev je trenutno omejenih. */
export function rateLimitStats(): { keys: number; hits: number } {
  let hits = 0
  for (const b of buckets.values()) hits += b.hits.length
  return { keys: buckets.size, hits }
}

/**
 * IP naslov zahtevka. `x-forwarded-for` preberemo samo, kadar zaupamo posredniku —
 * v naši namestitvi je to Caddy na istem stroju (`deploy/Caddyfile`), ki ga nastavi.
 * Brez tega bi vsi uporabniki delili IP posrednika in si med seboj krajšali proračun.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const real = request.headers.get('x-real-ip')
  if (real) return real
  try {
    // Next v dev načinu nima teh glav; URL vsaj loči vmesnik.
    return new URL(request.url).hostname
  } catch {
    return 'unknown'
  }
}
