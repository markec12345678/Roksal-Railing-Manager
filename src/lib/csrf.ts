// Roksal — centralna CSRF / Origin preverba (R130 — issue #5 §6)
// ---------------------------------------------------------------------------
// Sejni piškotek je SameSite=Lax, kar v sodobnih brskalnikih že blokira
// klasični cross-site form POST. Lax sam pa ni dovolj, ker:
//   • starejši brskalniki ne poznajo SameSite;
//   • "same-site" ≠ "same-origin" (npr. drugi poddomeni na skupni domeni ali
//     drugi servisi na skupnem gostitelju — Render/Vercel aplikacije na isti
//     platformi so med sabo cross-origin, četudi brskalnik zanje velja
//     podobna pravila);
//   • Lax piškotek pošlje še pri top-level GET navigaciji — vsaka mutacija
//     mora zato biti POST/PATCH/PUT/DELETE (in je).
//
// Ta plast je zato EKSPlicitna in centralna: vsaka zahteva, ki SPREMENJA
// podatke (POST/PATCH/PUT/DELETE) in ni overjena z eksplicitnim `Authorization:
// Bearer` žetonom, mora dokazati izvor — glavo `Origin` (brskalniki jo pošiljajo
// na vseh mutacijah) ali vsaj `Referer`. Manjka oboje → 403 (fail-closed).
//
// Ločena obravnava Bearer/API-key (§6 zahteva): klient, ki eksplicitno predstavi
// `Authorization: Bearer …`, ni "ambientno" overjen s piškotkom — CSRF napad
// (ki zlori prav piškotek, ki ga brskalnik pošlje sam) ga ne more prenašati.
// Cross-site napadalec prav tako NE more nastaviti lastne glave Authorization
// (brskalnik jo šteje za prepovedano brez CORS odobritve), zato je izjema varna.
//
// Edge-safe: samo nizčin in URL razčlenjevanje — nič od node:crypto ali baze.
// Jedro (`isMutationOriginAllowed`) je čista funkcija → enotsko testirano.

import { NextResponse, type NextRequest } from 'next/server'

/** Metode, ki ne spreminjajo podatkov — CSRF ni relevanten. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function isSafeMethod(method: string): boolean {
  return SAFE_METHODS.has(method.toUpperCase())
}

/**
 * Iz `Origin` (`scheme://host[:port]`) ali `Referer` (poln URL) izlušči
 * normaliziranega gostitelja: male črke, brez privzetih vrat (:443/:80).
 * Literala vrednost `null` (pošiljajo jo nekateri sandbox konteksti) in
 * nesposobni shemi (data:, blob:, ftp:, chrome-extension:) vrnejo null.
 */
export function hostFromOriginish(value: string | null | undefined): string | null {
  if (!value) return null
  const v = value.trim()
  if (!v || v.toLowerCase() === 'null') return null
  try {
    const url = new URL(v)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    let host = url.host.toLowerCase()
    if (host.endsWith(':443') || host.endsWith(':80')) host = host.slice(0, -4)
    return host || null
  } catch {
    return null
  }
}

/** Normalizacija Host/x-forwarded-host vrednosti (isti format kot zgoraj). */
export function normalizeHostHeader(value: string | null | undefined): string | null {
  if (!value) return null
  const v = value.trim().toLowerCase()
  if (!v) return null
  // Host glava ne nosi sheme — odreži isto prva privzeta vrata, da se primerjava
  // ujame z hostFromOriginish. Neparja (npr. :8443) ostaneta.
  const stripped = v.endsWith(':443') || v.endsWith(':80') ? v.slice(0, -4) : v
  return stripped || null
}

/** x-forwarded-host je lahko seznam ("a, b") — zanima nas prvi (najbližji klientu). */
export function firstForwardedHost(value: string | null | undefined): string | null {
  if (!value) return null
  const first = value.split(',')[0]?.trim() ?? ''
  return first || null
}

/**
 * CSRF_ALLOWED_ORIGINS — veja/lista polnih izvorov (`https://app.roksal.si`),
 * ki smejo klicati API cross-origin (npr. ločena landinja na lastni domeni).
 * Pokvarjeni vnosi se tiho ignorirajo (ne morejo razširiti dostopa na ničesar,
 * ker ne ustrezajo nobenemu gostitelju).
 */
export function parseAllowlist(raw: string | null | undefined): string[] {
  if (!raw) return []
  const out: string[] = []
  for (const part of raw.split(',')) {
    const host = hostFromOriginish(part)
    if (host) out.push(host)
  }
  return out
}

export interface CsrfInput {
  /** HTTP metoda zahteve. */
  method: string
  /** Ali zahteva nosi `Authorization: Bearer …` (API ključ, mobilni klient, cron). */
  hasBearer: boolean
  /** Glava `Origin` (ali null). */
  origin: string | null
  /** Glava `Referer` (ali null) — uporabljena samo, kadar Origin manjka. */
  referer: string | null
  /** Glava `Host`. */
  host: string | null
  /** Prva vrednost `x-forwarded-host` (za proxy/prednje strežnike). */
  forwardedHost: string | null
  /** Dodatno dovoljeni gostitelji (iz CSRF_ALLOWED_ORIGINS). */
  allowlist?: string[]
}

/**
 * Ali sme ta zahteva nadaljevati? `false` = zavrniti s 403 (fail-closed).
 *
 * Pravila (vrstni red je pomemben):
 *   1. varna metoda (GET/HEAD/OPTIONS) → dovoljeno;
 *   2. Bearer overitev → dovoljeno (ni ambientnega piškotka, glej zgoraj);
 *   3. Origin prisoten → GOSTITELJ MORA ustrezati zahtevku (Host /
 *      x-forwarded-host) ali listi dovoljenih — Referer se ignorira (slabši
 *      signal: referrer-policy ga lahko odreže, Origin pa ne);
 *   4. Origin manjka, Referer prisoten → enaka preverba na Referer;
 *   5. oboje manjka → ZAVRNJENO (fail-closed: brskalnik na mutaciji VEDNO
 *      pošlje Origin; klient brez obeh je po sporazumu dolžan Bearer).
 */
export function isMutationOriginAllowed(input: CsrfInput): boolean {
  if (isSafeMethod(input.method)) return true
  if (input.hasBearer) return true

  const requestHost = input.forwardedHost
    ? normalizeHostHeader(input.forwardedHost)
    : normalizeHostHeader(input.host)
  if (!requestHost) return false // brez Host ni s čim primerjati — fail-closed

  const extra = new Set((input.allowlist ?? []).map((h) => normalizeHostHeader(h)).filter(Boolean) as string[])
  const allowedHosts = new Set([requestHost, ...extra])

  const originHost = hostFromOriginish(input.origin)
  if (input.origin !== null && input.origin !== undefined && input.origin.trim() !== '') {
    // Origin glava je prisotna (tudi vrednost `null`) — odloča izključno ona.
    return originHost !== null && allowedHosts.has(originHost)
  }

  const refererHost = hostFromOriginish(input.referer)
  if (input.referer !== null && input.referer !== undefined && input.referer.trim() !== '') {
    return refererHost !== null && allowedHosts.has(refererHost)
  }

  // Origin in Referer manjkata: brskalnik to pri mutaciji ne more storiti.
  return false
}

// ── proxy vstopna točka ───────────────────────────────────────────────────────

/**
 * Centralna preverba za proxy (prva vrsta v `proxy()` — TUDI javne rute, ker
 * prijava in demo sta prav tako cookie-mutacija, ki jo je treba braniti).
 *
 * Vrne 403 odgovor, če je zahtevo treba zavreči, sicer `null` (nadaljuj).
 * Samo `/api/*` poti: strani nimajo mutacijskih handlerjev (server actions jih
 * ne uporabljajo, Next pa svoje akcije ščiti sam).
 */
export function csrfGuard(request: NextRequest): NextResponse | null {
  const method = request.method.toUpperCase()
  if (isSafeMethod(method)) return null
  if (!request.nextUrl.pathname.startsWith('/api/')) return null

  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return null // ločena obravnava Bearer/API-key (§6)

  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const ok = isMutationOriginAllowed({
    method,
    hasBearer: false,
    origin,
    referer,
    host: request.headers.get('host'),
    forwardedHost: firstForwardedHost(request.headers.get('x-forwarded-host')),
    allowlist: parseAllowlist(process.env.CSRF_ALLOWED_ORIGINS),
  })
  if (ok) return null

  console.warn('[csrf] zavrnjena mutacija brez veljavnega izvora:', {
    path: request.nextUrl.pathname,
    method,
    origin: origin ?? '(manjka)',
    referer: referer ?? '(manjka)',
  })
  return NextResponse.json(
    {
      error: 'Zavrnjeno — preverba izvora ni uspela (CSRF).',
      detail:
        'Zahteve, ki spreminjajo podatke, morajo prihajati iz iste izvorne strani ' +
        '(glava Origin) ali nositi Authorization: Bearer žeton.',
    },
    { status: 403 },
  )
}
