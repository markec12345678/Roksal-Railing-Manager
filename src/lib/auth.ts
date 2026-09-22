// Roksal — avtentikacija na nivoju zahtevka
// ---------------------------------------------------------------------------
// Dva načina dostopa:
//   1. **uporabnik** — sejni piškotek (ali Bearer z istim žetonom), iz prijave
//   2. **API ključ** — `Authorization: Bearer rkm_…` za mobilni klient (BalkonAR)
//
// Middleware preveri samo *prisotnost in podpis* seje (hitro, na robu).
// Ta datoteka se uporablja v rutah in pove *kdo* je — zato so tu tudi vloge.
// Oboje je potrebno: middleware blokira anonimni promet pred obravnavo rute,
// ruta pa ne sme zaupati samo njemu (obvod z direktnim klicem handlerja).

import { NextResponse } from 'next/server'
import { extractToken, verifySession, type SessionPayload } from './session'
import { verifyApiKey } from './password'

export type AuthContext =
  | { kind: 'user'; session: SessionPayload }
  | { kind: 'apikey'; name: string }

/** Vrni identiteto zahteve ali `null`, če je ni. Nikoli ne vrže. */
export async function authenticate(request: Request): Promise<AuthContext | null> {
  const header = request.headers.get('authorization')

  // API ključ ima prednost: mobilni klient nima piškotkov.
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7)
    if (token.startsWith('rkm_')) {
      const key = await verifyApiKey(token)
      return key ? { kind: 'apikey', name: key.name } : null
    }
    // Bearer z sejim žetonom (uporabno za skripte in testiranje)
    const session = await verifySession(token)
    return session ? { kind: 'user', session } : null
  }

  const session = await verifySession(extractToken(request))
  return session ? { kind: 'user', session } : null
}

/** Samo uporabniška seja (API ključi ne morejo brati CRM, cen, zalog …). */
export async function requireUser(request: Request): Promise<SessionPayload | null> {
  const context = await authenticate(request)
  return context?.kind === 'user' ? context.session : null
}

export function hasRole(session: SessionPayload, roles: string[]): boolean {
  return roles.includes(session.vloga)
}

/**
 * Vrže `NextResponse`, če dostop ni dovoljen, sicer `null`.
 *
 * Uporaba v ruti (dvakrat preverjeno namerno — proxy je prva plast, ne zadnja):
 *
 *     const denied = await denyUnless(request, MANAGER_ROLES)
 *     if (denied) return denied
 *
 * API ključ (mobilni klient) ne sme v poslovne rute: ključ je namenjen samo
 * sinhronizaciji izmere, ne urejanju cen ali zalog.
 */
export async function denyUnless(request: Request, roles: string[]): Promise<NextResponse | null> {
  const context = await authenticate(request)
  if (!context) return unauthorized()
  if (context.kind !== 'user') {
    return forbidden('API ključ nima dostopa do te poti — potrebna je prijava uporabnika.')
  }
  if (!hasRole(context.session, roles)) {
    return forbidden(`Za to dejanje je potrebna vloga ${roles.join(' ali ')}. Tvoja vloga: ${context.session.vloga}.`)
  }
  return null
}

export function unauthorized(detail = 'Prijava je obvezna.'): NextResponse {
  return NextResponse.json({ error: 'Neavtoriziran dostop', detail }, { status: 401 })
}

export function forbidden(detail = 'Za to dejanje nimaš pravice.'): NextResponse {
  return NextResponse.json({ error: 'Prepovedano', detail }, { status: 403 })
}

/** Vloge, ki smejo spreminjati cene, zaloge in naročila. */
export const MANAGER_ROLES = ['ADMIN', 'VODJA']
/** Vloge, ki smejo vse. */
export const ADMIN_ROLES = ['ADMIN']
