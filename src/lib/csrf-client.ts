// Roksal — brskalniški del dvojnega žetona (R194 — issue #5 §6)
// ---------------------------------------------------------------------------
// Enotski vstopni punkt: idempotentna namestitev ovoja okoli `window.fetch`,
// ki isti-izvornim mutacijam (POST/PATCH/PUT/DELETE) samodejno doda glavo
// `x-csrf-token` z vrednostjo piškotka `roksal_csrf`. Vsi obstoječi klici
// (43+ točk v komponentah, offline vrsta, dinamični uvozi) dobijo plast brez
// sprememb kode — stranski učinek je samo glava.
//
// Varostne lastnosti:
//   • Žeton se prilepi SAMO isti-izvornim URL-jem — cross-origin klici ostanejo
//     nedotaknjeni (žeton nikoli ne odteče tretji strani).
//   • Varne metode (GET/HEAD/OPTIONS) ostanejo nedotaknjene.
//   • Klicatelj, ki je žeton že postavil (prihodnost/testi), ni preglašen.
//   • Brez piškotka (neprijavljen, javne poti) se ne pošilja nič — R130
//     preverba izvora ostaja edina plast (isti dogovor kot strežnik).
//   • Napaka v oviju NIKOLI ne poruši prometa — pademo nazaj na originalni
//     fetch (fail-open ovoj, strežnik je kljub temu fail-closed).

import {
  CSRF_COOKIE,
  CSRF_HEADER,
  CSRF_REJECTION_EVENT,
  CSRF_REJECTION_MARKER,
  cookieValue,
} from '@/lib/csrf-core'

/** Metode, ki ne spreminjajo podatkov — ovoj se ne dotakne. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** Minimalna struktura okna — injectable za enotske teste (brez jsdom). */
export interface CsrfWindow {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  location: { href: string; origin: string }
  document: { cookie: string }
  dispatchEvent: (event: Event) => boolean
}

type PatchedWindow = CsrfWindow & { __roksalCsrfFetch?: boolean }

function methodOf(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return String(init.method).toUpperCase()
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.method.toUpperCase()
  }
  return 'GET'
}

function existingHeader(input: RequestInfo | URL, init?: RequestInit): string | null {
  try {
    const fromInit = init?.headers ? new Headers(init.headers as HeadersInit).get(CSRF_HEADER) : null
    if (fromInit) return fromInit
    if (typeof Request !== 'undefined' && input instanceof Request) {
      return input.headers.get(CSRF_HEADER)
    }
  } catch {
    // pokvarene glave naj rešuje strežnik — ovoj se ne podira
  }
  return null
}

/**
 * R195 — če je 403 odgovor ZAVRNITEV dvojnega žetona (marker 'dvojni podpis'
 * v telesu), sproži dogodek `roksal:csrf-zavrnjen` — posluša ga csrf-guard in
 * pokaže toast 'Osvežite stran'. RBAC 403 in R130 preverba izvora imata drugačno
 * telo → brez dogodka (toast ne lažno zatreste za permisije).
 *
 * Telo se bere iz KLONA — original odgovor ostane klicatelju nedotaknjen.
 * Fire-and-forget z ujetim rejection: tekoči promet NIKOLI ne pade zaradi
 * diagnostike (fail-open ovoj, strežnik fail-closed).
 */
function objaviCsrfZavrnitev(win: CsrfWindow, promise: Promise<Response>): Promise<Response> {
  return promise.then((res) => {
    if (res.status === 403) {
      try {
        void res
          .clone()
          .text()
          .then((telo) => {
            if (telo.includes(CSRF_REJECTION_MARKER)) {
              win.dispatchEvent(new Event(CSRF_REJECTION_EVENT))
            }
          })
          .catch(() => {
            // telesa ni mogoče prebrati (npr. odgovor že porabljen) — nič,
            // diagnostika ne sme vplivati na promet
          })
      } catch {
        // klon ne uspe — nič; klicatelj dobi odgovor nespremenjen
      }
    }
    return res
  })
}

/**
 * Idempotentno namesti ovoj. Vrne `true`, če je namestitev pravkar potekala,
 * `false`, če je bila že izvedena (dvojni klic React strict mode itd.).
 */
export function installCsrfFetch(win: CsrfWindow): boolean {
  const w = win as PatchedWindow
  if (w.__roksalCsrfFetch) return false
  const orig = win.fetch.bind(win)
  w.__roksalCsrfFetch = true
  win.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      if (SAFE_METHODS.has(methodOf(input, init))) return orig(input, init)

      let url: URL
      try {
        url = new URL(input instanceof Request ? input.url : String(input), win.location.href)
      } catch {
        return orig(input, init)
      }
      // Žeton NIKOLI ne odide čez izvor — samo isti-izvorne mutacije.
      if (url.origin !== win.location.origin) return orig(input, init)
      if (existingHeader(input, init)) return objaviCsrfZavrnitev(win, orig(input, init))

      const token = cookieValue(win.document.cookie, CSRF_COOKIE)
      if (!token) return objaviCsrfZavrnitev(win, orig(input, init))

      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      )
      headers.set(CSRF_HEADER, token)
      return objaviCsrfZavrnitev(win, orig(input, { ...init, headers }))
    } catch {
      // fail-open ovoj — strežnik je fail-closed (R130 + dvojni žeton)
      return orig(input, init)
    }
  }
  return true
}
