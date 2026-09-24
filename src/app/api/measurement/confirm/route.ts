/**
 * MEASUREMENT API (issue #2) — POST /api/measurement/confirm
 *
 * Potrditev meritve: zaznane/ročne točke + referenčna mera →
 * MeasurementSession (server izračuna merilo + geometrijo — klient NE
 * pošilja izračunanih mm) + opcijsko geometrijsko mapiranje na fence-engine.
 * S projectId se meritev trajno shrani (Measurement + audit, ENA transakcija).
 *
 * Zakon: brez veljavnega merila se vrne SCALE_REQUIRED z geometry=null.
 *
 * ── MEJE ZAUPANJA (R120/item 17 — eksplicitni model) ──────────────────────
 *
 *   | Podatek                      | Status                    | Razlaga            |
 *   |------------------------------|---------------------------|--------------------|
 *   | klientski mm izračuni        | NE ZAUPAVAJO SE           | sploh ne sprejememo |
 *   |                              |                           | (ni polja v shemi) |
 *   | klientska detekcija          | NEZAUPAN PREDLOG          | server jo znova    |
 *   | (features/metrics echo)      | (untrusted proposal)      | validira (zod) in  |
 *   |                              |                           | ovrednoti prek     |
 *   |                              |                           | engine stanj       |
 *   | ročne točke (manual)         | uporabniški VHOD          | uporabnik sme      |
 *   |                              |                           | popraviti meritev  |
 *   |                              |                           | (fail-safe način)  |
 *   | merilo (scale)               | SERVER-AVTORITATIVNO      | izračun izključno  |
 *   |                              |                           | iz reference       |
 *   | končna geometrija/mm         | SERVER-AVTORITATIVNO      | buildSession()     |
 *   | (totalLength, height, segm.) |                           | na strežniku       |
 *
 * To NI varnostna luknja v smislu zaupanja med uporabniki: uporabnik meri
 * svoj balkon in lahko meritve tudi ročno popravi — detekcija je le predlog.
 * Pomembno je, da AVTORITATIVNE vrednosti (merilo, mm, geometrija) nastanejo
 * na strežniku in nosijo provenance, klient pa jih ne more "uglasiti".
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { assertProjectAccess, actorIdOf, AccessDeniedError } from '@/lib/access'
import { auditInTx } from '@/lib/audit'
import {
  buildSession,
  mapToGeometry,
  MeasurementValidationError,
} from '@/lib/measurement'
import type { MeasurementSession } from '@/lib/measurement'

export const runtime = 'nodejs'
export const maxDuration = 30

const normPoint = z.object({ x: z.number().finite(), y: z.number().finite() })

const confirmSchema = z.object({
  sessionId: z.string().min(1).max(128),
  source: z.enum(['automatic', 'manual', 'hybrid']),
  /** zaznane značilke iz /detect (echo — server NE zaupa izračunom klienta) */
  features: z
    .object({
      runs: z.array(
        z.object({
          yTop: z.number().finite(),
          yBottom: z.number().finite(),
          x0: z.number().finite(),
          x1: z.number().finite(),
          supportTop: z.number().finite().nonnegative(),
          supportBottom: z.number().finite().nonnegative(),
        }),
      ),
      posts: z.array(z.object({ x: z.number().finite(), support: z.number().finite().nonnegative() })),
      corners: z.tuple([normPoint, normPoint, normPoint, normPoint]).nullable(),
    })
    .nullable()
    .optional(),
  metrics: z
    .object({
      edgeDensity: z.number().finite().min(0).max(1),
      lineSupportTop: z.number().finite().min(0).max(1),
      lineSupportBottom: z.number().finite().min(0).max(1),
      lineCoverage: z.number().finite().min(0).max(1),
      postSpacingConsistency: z.number().finite().min(0).max(1),
      temporalStability: z.number().finite().min(0).max(1),
      frames: z.number().int().min(0).max(3),
    })
    .nullable()
    .optional(),
  /** ročna geometrija (ročni način ali popravki) */
  manual: z
    .object({
      path: z.array(normPoint).min(2).max(24),
      top: z.array(normPoint).min(2).max(24),
      posts: z.array(normPoint).max(48).optional(),
    })
    .nullable()
    .optional(),
  /** referenčna mera — brez nje NI dimenzij */
  reference: z
    .object({
      p1: normPoint,
      p2: normPoint,
      knownMm: z.number().finite().positive(),
      kind: z.enum(['user-known-measure', 'roksal-marker', 'known-object', 'depth-sensor']),
    })
    .nullable()
    .optional(),
  manualCorrections: z.number().int().min(0).max(999).optional(),
  confirmed: z.boolean().optional(),
  projectId: z.string().min(1).optional(),
  /** opcijsko geometrijsko mapiranje (takeoff predogled iz fence-engine) */
  geometry: z
    .object({
      productId: z.string().min(1).max(64),
      orientation: z.enum(['horizontal', 'vertical']),
      gapMm: z.number().finite().min(0).max(200),
      postWidthMm: z.number().finite().min(10).max(200),
      colorRgb: z.tuple([z.number().int().min(0).max(255), z.number().int().min(0).max(255), z.number().int().min(0).max(255)]).optional(),
    })
    .optional(),
})

export async function POST(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const actor = actorIdOf(auth)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Neveljaven JSON.' }, { status: 400 })
  }
  const parsed = confirmSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Neveljavni vhod.', issues: parsed.error.issues.slice(0, 5) },
      { status: 400 },
    )
  }
  const v = parsed.data

  try {
    // ── Server izračuna seja (merilo + geometrija + stanje) ────────────────
    const session: MeasurementSession = buildSession({
      sessionId: v.sessionId,
      source: v.source,
      detected:
        v.features !== undefined && v.features !== null
          ? { features: v.features, metrics: v.metrics ?? {
              edgeDensity: 0, lineSupportTop: 0, lineSupportBottom: 0,
              lineCoverage: 0, postSpacingConsistency: 1, temporalStability: 1, frames: 1,
            } }
          : null,
      manual: v.manual ?? null,
      reference: v.reference ?? null,
      manualCorrections: v.manualCorrections,
      confirmed: v.confirmed,
    })

    // ── Opcijsko geometrijsko mapiranje (fence-engine — EN vir resnice) ────
    let takeoffPreview: ReturnType<typeof mapToGeometry>['takeoffPreview'] | null = null
    let layout: Pick<ReturnType<typeof mapToGeometry>['layout'], 'boardCount' | 'fieldSpanMm' | 'fenceWidthMm' | 'fenceHeightMm' | 'orientation' | 'warnings'> | null = null
    if (v.geometry) {
      const mapped = mapToGeometry({
        session,
        productId: v.geometry.productId,
        orientation: v.geometry.orientation,
        gapMm: v.geometry.gapMm,
        postWidthMm: v.geometry.postWidthMm,
        colorRgb: v.geometry.colorRgb,
      })
      takeoffPreview = mapped.takeoffPreview
      layout = {
        boardCount: mapped.layout.boardCount,
        fieldSpanMm: mapped.layout.fieldSpanMm,
        fenceWidthMm: mapped.layout.fenceWidthMm,
        fenceHeightMm: mapped.layout.fenceHeightMm,
        orientation: mapped.layout.orientation,
        warnings: mapped.layout.warnings,
      }
    }

    // ── Trajno shranjevanje (Measurement + audit v ENI transakciji) ─────────
    let savedId: string | null = null
    if (v.projectId) {
      const project = await db.project.findUnique({ where: { id: v.projectId } })
      if (!project) throw new AccessDeniedError(404, 'Projekt ne obstaja')
      assertProjectAccess(auth, project, 'update')

      // Brez geometrije ni smisla shranjevati meritev z mm (SCALE_REQUIRED).
      if (!session.geometry) {
        return NextResponse.json(
          {
            error: 'Meritev brez merila ni shranjena (SCALE_REQUIRED).',
            session,
          },
          { status: 422 },
        )
      }

      savedId = await db.$transaction(async (tx) => {
        const created = await tx.measurement.create({
          data: {
            projectId: v.projectId!,
            dolzinaMm: Math.round(session.geometry!.totalLengthMm.valueMm),
            visinaMm: Math.round(session.geometry!.heightMm.valueMm),
            arMetadata: JSON.stringify({
              kind: 'measurement-session',
              version: session.version,
              sessionId: session.sessionId,
              source: session.source,
              quality: session.quality,
              scale: session.scale,
              features: session.features,
              geometry: session.geometry,
              takeoffPreview,
            }),
          },
        })
        await auditInTx(tx, {
          request,
          userId: actor,
          akcija: 'CREATE_MEASUREMENT',
          projectId: v.projectId,
          oldValue: null,
          newValue: {
            dolzinaMm: created.dolzinaMm,
            visinaMm: created.visinaMm,
            source: session.source,
            state: session.quality.state,
          },
        })
        return created.id
      })
    }

    return NextResponse.json(
      { session, takeoffPreview, layout, savedMeasurementId: savedId },
      { status: savedId ? 201 : 200 },
    )
  } catch (error) {
    if (error instanceof MeasurementValidationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (
      error instanceof Error &&
      error.name === 'GeometryMappingError'
    ) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    console.error('[measurement/confirm]', error)
    return NextResponse.json({ error: 'Napaka pri potrditvi meritve.' }, { status: 500 })
  }
}
