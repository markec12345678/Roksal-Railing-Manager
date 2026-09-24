/**
 * VISION API (issue #11 §7/§11) — POST /api/vision/placement
 *
 * Strežnik-avtoritativna ocena PWC postavitve (deterministično, brez AI):
 *   PlacementInput + (opcijsko) referenčna mera + segment + kotniki
 *   → evaluatePlacement (Product SDK pravila + computeFenceLayout)
 *   → projectPlacement (homografija oziroma iskren 2D približek)
 *   → { placement, projection }.
 *
 * PRAVILA:
 *  - invalid placement → { valid:false, violations[] } z jasen razlog,
 *    BREZ layouta → BOM ni mogoč (veriga ostane Measurement → Geometry → BOM).
 *  - merilo se računa STREŽNIŠKO iz referenčne mere (resolveScale) — klient
 *    NE sme vbrizgati mmPerUnit (ni ugibanja merila).
 *  - Ta endpoint NE piše v bazo in NE ustvarja meritve — potrjena geometrija
 *    gre IZKLJUČNO prek /api/measurement/confirm (canonical chain).
 *  - Enak vhod → bajtno enak odgovor (determinizem).
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticate, unauthorized } from '@/lib/auth'
import { evaluatePlacement, projectPlacement } from '@/lib/cv-studio/placement'
import { resolveScale } from '@/lib/measurement/scale'
import type { ProjectionResult } from '@/lib/cv-studio/types'

export const runtime = 'nodejs'
export const maxDuration = 30

const pointSchema = z.object({
  x: z.number().finite().min(-0.5).max(1.5),
  y: z.number().finite().min(-0.5).max(1.5),
})

const placementSchema = z.object({
  productId: z.string().min(1).max(200),
  orientation: z.enum(['horizontal', 'vertical']),
  gapMm: z.number().finite().min(0).max(200),
  postWidthMm: z.number().finite().min(0).max(500),
  fenceWidthMm: z.number().finite().min(0).max(30000),
  fenceHeightMm: z.number().finite().min(0).max(5000),
  posts: z
    .object({
      widthMm: z.number().finite().min(0).max(500),
      positionsMm: z.array(z.number().finite()).max(50),
    })
    .nullable()
    .optional(),
  handle: z.boolean().optional(),
  colorRgb: z
    .tuple([z.number().int().min(0).max(255), z.number().int().min(0).max(255), z.number().int().min(0).max(255)])
    .optional(),
  // merilo: STREŽNIŠKO iz referenčne mere (klient ne pošilja mmPerUnit)
  reference: z
    .object({
      p1: pointSchema,
      p2: pointSchema,
      knownMm: z.number().finite().positive().max(100000),
      kind: z.enum(['user-known-measure', 'roksal-marker', 'known-object', 'depth-sensor']),
    })
    .nullable()
    .optional(),
  // projekcija: potrjen segment (dno ograje) + opcijski kotniki (homografija)
  segment: z.object({ start: pointSchema, end: pointSchema }).optional(),
  corners: z.tuple([pointSchema, pointSchema, pointSchema, pointSchema]).nullable().optional(),
})

export async function POST(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Neveljaven JSON.', code: 'INVALID_JSON' }, { status: 400 })
  }

  const parsed = placementSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Neveljaven vhod.', code: 'INVALID_INPUT', issues: parsed.error.issues.slice(0, 10) },
      { status: 400 },
    )
  }
  const body = parsed.data

  // merilo — izključno strežniško iz referenčne mere (ni ugibanja)
  const scaleResult = body.reference ? resolveScale(body.reference) : null
  if (body.reference && !scaleResult?.scale) {
    return NextResponse.json(
      {
        error: 'Referenčna mera ni veljavna — merilo NI razrešeno (ni izmišljevanja).',
        code: 'SCALE_REQUIRED',
        reason: scaleResult?.reason ?? 'reference manjka',
      },
      { status: 422 },
    )
  }

  const placement = evaluatePlacement({
    productId: body.productId,
    orientation: body.orientation,
    gapMm: body.gapMm,
    postWidthMm: body.postWidthMm,
    fenceWidthMm: body.fenceWidthMm,
    fenceHeightMm: body.fenceHeightMm,
    posts: body.posts ?? null,
    handle: body.handle,
    colorRgb: body.colorRgb,
  })

  // projekcija samo ob veljavnem placement + merilu + segmentu
  let projection: ProjectionResult | null = null
  if (placement.valid && placement.layout && scaleResult?.scale && body.segment) {
    try {
      projection = projectPlacement({
        layout: placement.layout,
        orientation: body.orientation,
        segment: body.segment,
        scale: scaleResult.scale,
        corners: body.corners ?? null,
        postsWidthMm: body.posts?.widthMm,
        postsPositionsMm: body.posts?.positionsMm,
      })
    } catch {
      // degenerirani segment/kotniki → projekcija ni mogoča (placement ostane veljaven)
      projection = null
    }
  }

  return NextResponse.json({
    placement,
    projection,
    scale: scaleResult?.scale ?? null,
    scaleReason: scaleResult?.reason ?? null,
  })
}
