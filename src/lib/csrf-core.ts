// Roksal — CSRF dvojni žeton (R194 — issue #5 §6, VARNOST.md vrstica ZAPRTA)
// ---------------------------------------------------------------------------
// R130 je uvedel centralno preverbo izvora (Origin/Referer) na vseh mutacijah.
// VARNOST.md je ostal odkrit: `SameSite=Lax` + preverba izvora pokrijeta večino,
// ne pa vseh primerov — dvojni žeton (double-submit cookie) doda drugo, neodvisno
// plast: klient, ki želi mutirati s sejnim piškotkom, mora žeton iz piškotka
// `roksal_csrf` poslati tudi v glavi `x-csrf-token`. Cross-site napadalec piškotek
// lahko pošlje (brskalnik ga prilepi sam), a ga NE more prebrati (SOP) — zato
// glave ne more sestaviti. 403.
//
// Pravila (odločitev ob vezavi):
//   • Bearer klienti (API ključi, mobilni) — izjema, kot pri R130: niso ambientno
//     overjeni s piškotkom, CSRF jih ne zadeva.
//   • Brez sejnega piškotka → žeton NI zahtevan (ni ambientne avtorizacije, ki bi
//     jo bilo treba braniti); R130 preverba izvora ostaja edina plast.
//   • Sea + žeton piškotek manjka → stara seja pred uvedbo (grace) — R130 plast
//     jo ščiti na istem nivoju kot doslej. Prijava in GET /api/auth žeton izdata,
//     zato seje konvergirajo k novi plasti ob prvi obisku aplikacije.
//   • Sea + žeton prisotna → glava MORA obstajati in biti enaka vrednosti
//     piškotka. Manjka ali neujema → 403 (fail-closed).
//
// Ta datoteka je ČISTO jedro — brez uvozov `next/server`, da jo lahko uvaža
// tudi brskalniški paket (`csrf-client.ts`) in Edge runtime (`csrf.ts`).

import { SESSION_COOKIE, SESSION_TTL_SECONDS } from '@/lib/session'

/** Ime piškotka z žetonom (berljiv iz JS — namenoma BREZ HttpOnly). */
export const CSRF_COOKIE = 'roksal_csrf'

/** Glava, v kateri klient pošlje žeton nazaj strežniku. */
export const CSRF_HEADER = 'x-csrf-token'

/** Življenjska doba žetona — poravnana s sejo (ob prijavi se izda nov). */
export const CSRF_TTL_SECONDS = SESSION_TTL_SECONDS

/**
 * Vrednost imenovanega piškotka iz suhe glave `Cookie`.
 * Čisto razčlenjevanje nizov — Edge-varno. Prazna vrednost = odsotna.
 */
export function cookieValue(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() !== name) continue
    const raw = part.slice(eq + 1).trim()
    if (!raw) return null
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw // pokvaren escape — vzemi surovo (primerjava je še vedno natančna)
    }
  }
  return null
}

export type CsrfTokenVerdict = 'not-required' | 'ok' | 'rejected'

/**
 * Odločitev dvojnega žetona za eno zahtevo (čisto jedro, enotsko testirano):
 *   • brez sejnega piškotka → 'not-required' (Bearer in javni klijeji);
 *   • seja brez žetona (stara seja pred uvedbo) → 'not-required' — grace,
 *     dokumentirano v VARNOST.md; R130 plast ostaja;
 *   • seja + žeton → glava mora ujemati, sicer 'rejected' (403).
 */
export function csrfTokenVerdict(
  cookieHeader: string | null | undefined,
  headerToken: string | null | undefined,
): CsrfTokenVerdict {
  const session = cookieValue(cookieHeader, SESSION_COOKIE)
  if (!session) return 'not-required'
  const token = cookieValue(cookieHeader, CSRF_COOKIE)
  if (!token) return 'not-required'
  return headerToken !== null && headerToken !== undefined && headerToken !== '' && headerToken === token
    ? 'ok'
    : 'rejected'
}

/**
 * Atributi Set-Cookie za izdajo žetona: berljiv iz JS (brez HttpOnly — klient
 * ga mora poslati v glavi), SameSite=Lax, pot /, življenjska doba poravnana s
 * sejo, Secure na HTTPS. Vrednost ustvari klicatelj (crypto.randomUUID).
 */
export function csrfCookieAttributes(token: string, secure: boolean): string {
  return [
    `${CSRF_COOKIE}=${token}`,
    `Path=/`,
    `SameSite=Lax`,
    `Max-Age=${CSRF_TTL_SECONDS}`,
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ')
}
