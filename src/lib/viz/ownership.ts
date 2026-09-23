/**
 * VIZ — lastništvo projektov (runda S+4, P0).
 *
 * Politika (docs/VIZ_CONTRACTS.md §ownership):
 *   • Vsak viz projekt/render job je vezan na uporabniško sejo, ki ga je
 *     ustvarila (ownerId = SessionPayload.sub = Profile.id).
 *   • API ključi (rkm_…) NIMAJO dostopa do /api/viz/* — to je aplikacijska
 *     konvencija od S+2 (ključ je samo za sinhronizacijo izmere). 403.
 *   • Tuji ali neobstoječ projekt → 404 (ne 403): ne puščamo informacije,
 *     ali projekt z danim id obstaja. Ena konsistentna politika.
 *   • Zapuščinski zapisi brez ownerId (runde pred S+4) → vidni/administrirajo
 *     SAMO uporabniki z vlogo ADMIN.
 *
 * Backend preverja lastništvo na vsaki ruti — frontend je samo udobje,
 * nikoli varnost (route handler je zadnja plast za proxy middleware-om).
 */
import { authenticate, forbidden, unauthorized } from '@/lib/auth'
import type { SessionPayload } from '@/lib/session'

export interface VizOwnerContext {
  /** Profile.id seje — lastnik zapisov. */
  ownerId: string
  /** ADMIN sme dostopati do zapuščinskih zapisov brez ownerId. */
  isAdmin: boolean
}

/**
 * Vrni kontekst lastnika ali `NextResponse` napako (401/403).
 * Uporaba v ruti:
 *
 *     const ctx = await vizOwner(request)
 *     if (ctx instanceof Response) return ctx
 */
export async function vizOwner(
  request: Request
): Promise<VizOwnerContext | Response> {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  if (auth.kind === 'apikey') {
    return forbidden('Vizualizacije so vezane na prijavljenega uporabnika — API ključ ni dovolj.')
  }
  const session: SessionPayload = auth.session
  return { ownerId: session.sub, isAdmin: session.vloga === 'ADMIN' }
}

/** Ali sme kontekst dostopati do zapisa s tem ownerId (null = zapuščina)? */
export function mayAccess(ctx: VizOwnerContext, recordOwnerId: string | null | undefined): boolean {
  if (recordOwnerId == null) return ctx.isAdmin
  return recordOwnerId === ctx.ownerId
}
