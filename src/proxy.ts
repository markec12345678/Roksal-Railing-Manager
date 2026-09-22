// Roksal — proxy: nihče brez seje ne pride do podatkov
// ---------------------------------------------------------------------------
// Pred tem ni bilo nobene zaščite: 27 od 28 API rut je bilo javnih, `/api/auth`
// pa je za poljuben e-mail ustvaril ADMIN profil. Middleware je prva linija —
// blokira anonimni promet, preden se ruta sploh izvede.
//
// Ruta se s tem ne sme zadovoljiti: vsaka API ruta dodatno kliče
// `authenticate(request)` iz `@/lib/auth`, da ni odvisna samo od proxy-ja.
//
// Next 16 je `middleware.ts` preimenoval v `proxy.ts` (funkcija `proxy`); staro
// ime je zastarelo in bo v Next 17 odstranjeno. Zato je ta datoteka že na novi
// konvenciji — `npx @next/codemod middleware-to-proxy .` ni potreben.
//
// Proxy teče na Edge runtimeu, zato uvaža SAMO `@/lib/session` (Web Crypto).
// `@/lib/password` (node:crypto scrypt) bi tu počil — in se ne sme.

import { NextResponse, type NextRequest } from 'next/server'
import { extractToken, verifySession } from '@/lib/session'

/** Poti, ki so javne po zasnovi. */
const PUBLIC_EXACT = new Set<string>([
  '/login',
  '/api', // health check za uptime monitor
  // Prijava MORA biti javna — sicer se nihče ne more prijaviti. Ruta sama
  // poskrbi, da POST preveri geslo, GET (»kdo sem«) pa vrne 401 brez seje.
  '/api/auth',
  '/api/auth/logout',
  // Demo dostop ("vstop brez prijave") — javen po zasnovi, omejen s hitrostjo
  // in izklopljiv z DEMO_ACCESS=off. Glej src/app/api/auth/demo/route.ts.
  '/api/auth/demo',
])

/** Predpone, ki so javne: portal stranke je dostopen s sposobnostnim URL-jem (clientToken). */
const PUBLIC_PREFIXES = [
  '/portal/',
  '/api/portal',
  '/m/',
  '/api/public',
  // 3D modeli ograj (runda O): Scene Viewer/Quick Look ju prenese IZVEN
  // brskalniške seje (sistemska aplikacija brez piškotkov) — preusmeritev na
  // prijavo bi pokvarila AR na telefonu. Modeli so generična geometrija
  // (brez uporabniških podatkov), zato so javni po zasnovi.
  '/models/',
]

/**
 * API ključi: poti, kjer se namesto seje sprejme `Authorization: Bearer rkm_…`.
 * Proxy preveri samo **obliko** — pravi hash preveri ruta, ker Edge runtime
 * nima dostopa do `node:crypto` in ker mora biti preverjanje ključa v bazi.
 */
const API_KEY_PATHS = ['/api/sync']

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function acceptsApiKey(pathname: string): boolean {
  return API_KEY_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  // Mobilni klient z API ključem
  if (acceptsApiKey(pathname)) {
    const auth = request.headers.get('authorization')
    if (auth?.startsWith('Bearer rkm_')) return NextResponse.next()
    // brez ključa še vedno preverimo sejo — sinhronizacija iz brskalnika naj dela
  }

  const session = await verifySession(extractToken(request))
  if (session) {
    // Identiteto posredujemo naprej, da je rutam ni treba znova razčlenjevati.
    // Ruta vseeno preveri podpis sama (authenticate), zato to ni vir zaupanja,
    // ampak samo priročen podatek za dnevnike.
    const headers = new Headers(request.headers)
    headers.set('x-roksal-user', session.sub)
    headers.set('x-roksal-role', session.vloga)
    headers.set('x-roksal-email', session.email)
    return NextResponse.next({ request: { headers } })
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Neavtoriziran dostop', detail: 'Prijava je obvezna.' },
      { status: 401 },
    )
  }

  const login = new URL('/login', request.url)
  login.searchParams.set('next', pathname)
  return NextResponse.redirect(login)
}

/**
 * Vse razen statike in PWA datotek.
 * `sw.js` in `manifest.json` morata ostati javna, sicer PWA ne deluje.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|robots.txt|icon.svg|logo.svg|icon-192.png|icon-512.png).*)',
  ],
}
