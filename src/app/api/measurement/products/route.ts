/**
 * MEASUREMENT API (issue #2) — GET /api/measurement/products
 *
 * Katalog produktov za merilni studio (determinističen read iz Product SDK).
 * UI mora uporabnika vprašati za izdelek/orientacijo — NIKOLI ne ugibajo
 * (issue #2 §7: profil se NE ugiba iz slike).
 */
import { NextResponse } from 'next/server'
import { authenticate, unauthorized } from '@/lib/auth'
import { listProductDefinitions } from '@/lib/product-sdk'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()

  const defs = listProductDefinitions()
  return NextResponse.json({
    products: defs
      .filter((d) => d.rights !== 'rejected')
      .map((d) => ({
        id: d.id,
        family: d.family,
        profile: d.profile.name,
        orientations: d.orientations,
        board: {
          minGapMm: d.board.minGapMm,
          maxGapMm: d.board.maxGapMm,
        },
        rights: d.rights,
      })),
  })
}
