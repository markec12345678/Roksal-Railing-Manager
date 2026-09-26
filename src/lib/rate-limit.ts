// Roksal — omejevanje hitrosti
// ---------------------------------------------------------------------------
// Brez tega je brute-force na gesla neomejen: napadalec lahko preizkusi tisoč
// gesel na sekundo in edina ovira je bila dolžina skriptovskega dela.
//
// Drseče okno v pomnilniku. Zgodovinsko (lastna namestitev, systemd enota) je
// to bil enoprocesni model; NA Vercelu (PostgreSQL/Neon, serverless) živi vsak
// primerek lambda funkcije s SVOJIM pomnilnikom, zato je zaščita NA PRIMEREK:
//   - ustavi zankaste kliente znotraj enega primerka (glavni cilj),
//   - globalni proračun čez primerke bi zahteval zunanjo shrambo (Redis/
//     DB tabelo) — vmesnik (`checkRate`) ostane enak, kadar se kdaj zamenja,
//   - ob hladnem startu se števec izprazni (sprejemljivo: napadalec dobi
//     svež proračun samo za svoj primerek).
//
// R184 — TELEMETRIJA: vsak ZAVRAĆEN zadetek (`ok: false`) se zabeleži kot
// "trip" (ključ, števec, zadnji čas) — ADMIN panel v Ekipi (Vzdrževanje —
// omejevanje hitrosti, /api/security/rate-limit) prikazuje vzorec napadov
// na trenutnem primerku. Ključi vsebujejo IP + e-naslov, zato telemetrija
// vrača SAMO kategorijo (predpono ključa) + deterministični krajšani SHA-256
// prstni odtis — nič PII nad tisto, kar že piše v revizijski sledi.
//
// Pomembno (brez lažnih trditev): števeci so v pomnilniku in veljajo za
// TRENUTNI PRIMEREK — panel to izrecno pove ("vzorec, ne globalne absolutne
// vrednosti").
import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { CORRELATION_HEADER, correlationFromRequest } from './correlation'

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

interface Trip {
  count: number
  lastAt: number
}

const buckets = new Map<string, Bucket>()
/** R184: zavrženi zadetki po ključu (telemetrija blokad — glej glavo zgoraj). */
const trips = new Map<string, Trip>()

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
    // R184: ZAVRAĆEN zadetek = trip — telemetrija blokade (samo ok:false;
    // uspešni zadetki NE štejejo kot blokade).
    const trip = trips.get(key)
    if (trip) {
      trip.count += 1
      trip.lastAt = now
    } else {
      trips.set(key, { count: 1, lastAt: now })
    }
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
  if (key === undefined) {
    buckets.clear()
    // R184: tudi telemetrija blokad gre počist — restart primerka je restart.
    trips.clear()
  } else {
    buckets.delete(key)
    trips.delete(key)
  }
}

/** Stanje za diagnostiko — koliko ključev je trenutno omejenih. */
export function rateLimitStats(): { keys: number; hits: number } {
  let hits = 0
  for (const b of buckets.values()) hits += b.hits.length
  return { keys: buckets.size, hits }
}

export interface RateLimitTripRow {
  /** Kategorija omejitve (predpona ključa pred prvim ':' — npr. `login`). */
  kind: string
  /** Deterministični krajšani prstni odtis ključa (SHA-256, 10 hex) — brez PII. */
  keyHash: string
  /** Koliko zavrženih zadetkov je ta ključ zbral (od zadnjega restarta). */
  count: number
  /** Čas zadnjega zavrženega zadetka (epoch ms). */
  lastAt: number
}

export interface RateLimitDetail {
  keys: number
  hits: number
  /** Skupno število vseh zavrženih zadetkov (od zadnjega restarta). */
  tripsTotal: number
  /** Blokade po ključih, UREJENE deterministično: count padajoče, nato lastAt padajoče, nato keyHash. */
  trips: RateLimitTripRow[]
}

/** Determinističen krajšani prstni odtis ključa (SHA-256, 10 hex) — brez PII. */
function prstniOdtis(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex').slice(0, 10)
}

/**
 * R184 — podrobna telemetrija za ADMIN diagnostiko (ta primerek).
 * Deterministična: isti nabor vedno isti vrstni red (count ↓, lastAt ↓, keyHash ↑).
 */
export function rateLimitDetail(): RateLimitDetail {
  const stats = rateLimitStats()
  let tripsTotal = 0
  const rows: RateLimitTripRow[] = []
  for (const [key, trip] of trips) {
    tripsTotal += trip.count
    rows.push({
      kind: key.includes(':') ? key.slice(0, key.indexOf(':')) : key,
      keyHash: prstniOdtis(key),
      count: trip.count,
      lastAt: trip.lastAt,
    })
  }
  rows.sort(
    (a, b) => b.count - a.count || b.lastAt - a.lastAt || (a.keyHash < b.keyHash ? -1 : a.keyHash > b.keyHash ? 1 : 0),
  )
  return { keys: stats.keys, hits: stats.hits, tripsTotal, trips: rows }
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

/**
 * R190 — omejevanje hitrosti na pisanju (val 1; VARNOST.md "Omejevanje
 * hitrosti na drugih rutah" — WRITE_LIMIT je bil od R135 pripravljen, a
 * ne vklopljen). Za mutirajoče rute: ključ `write:<ruta>:<ip>`, okno 60 s,
 * 300 zahtevkov — velikodušno, lovi SAMO zankaste kliente (vzorec glave
 * zgoraj), ne legitimnih uporabnikov niti sync serije.
 *
 * - ZAVRAGA telemetrijo (R184): zavržen zadetek = trip s kategorijo `write`
 *   — ADMIN panel v Ekipi ga prikaže samodejno (kindBadge družina `write`).
 * - 429 telo + `Retry-After` = ISTA družina kot prijava (R137/R189):
 *   fail-verbose `detail: 'Poskusi znova čez N s.'`, brez tihe blokade.
 * - R192 (§22 družinska enotnost): 429 odmeva `x-correlation-id` iz requesta
 *   (ali ustvari novega) — dnevniška vrstica strežnika in odgovor klientu
 *   nosita ISTI korelacijo kot vsi ostali error odgovori (vzorec health 503).
 * - Guard postavimo KOT PRVI stavek handlerja (vzorec /api/auth: omejitev
 *   pred ponudbo dela) — ščiti tudi pred neavtenticirano spam industrijo;
 *   pošten kompromis: deljeni IP (pisarna NAT) si deli proračun na rundo,
 *   300/min po rundi pa je nad vsakim legitnim vzorcem.
 *
 * Vrne `Response` (429), kadar je blokirano, sicer `null` (nadaljuj handler).
 */
export function zapisOmejitev(request: Request, ruta: string): NextResponse | null {
  const key = `write:${ruta}:${clientIp(request)}`
  const limit = checkRate(key, WRITE_LIMIT)
  if (limit.ok) return null
  const correlationId = correlationFromRequest(request)
  const res = NextResponse.json(
    {
      error: 'Preveč zahtev.',
      detail: `Poskusi znova čez ${limit.retryAfterSeconds} s.`,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(limit.retryAfterSeconds),
        [CORRELATION_HEADER]: correlationId,
      },
    },
  )
  return res
}
