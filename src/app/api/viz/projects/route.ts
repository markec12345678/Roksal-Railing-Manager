// VIZ — /api/viz/projects (runda S+2, storage driver runda S+3). Spec: docs/VIZ_CONTRACTS.md
//   GET  — seznam projektov (najnovejši prej, max 50, placement parsed)
//   POST — { name, stagingToken, variants? } → kopira staging datoteke v
//          projektno shrambo (viz/projects/<id>/, kanonična MVP imena),
//          zapiše placement.json, porabi staging tokene in ustvari metadata
//          zapis (local = Prisma vrstica, blob = project.json v Vercel Blob).
//
// Opomba o tokenih: /api/viz/stage ustvari NOV token za vsako datoteko.
// Staging mapa `stagingToken` (balkon) vsebuje preview.jpg + result.json iz
// /api/viz/preview; result.json hrani provenance (tokeni product/mask/
// productMask), po katerih ta route poišče in kopira ostale datoteke.
// Izvozno dodatno (nadomestek result.json): telesu lahko pošlješ tudi
// originalToken/productToken/maskToken/productMaskToken izrecno.
import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { vizOwner, type VizOwnerContext } from '@/lib/viz/ownership'
import type { VizPlacement, VizVariant } from '@/lib/viz/types'
import { placementSchema, stagedTokenSchema } from '@/lib/viz/validate'
import { VIZ_FILE_NAMES, clientUrlForPath, stagingKey, vizGet, vizHas } from '@/lib/viz/storage'
import { findProjectByIdempotencyKey, listProjectsForOwner } from '@/lib/viz/repository'
import { saveProjectFromStaging, type VizSaveVariantInput } from '@/lib/viz/save-flow'

export const runtime = 'nodejs'

interface StagedResultJson {
  metrics: unknown
  placement: VizPlacement
  tokens: {
    original: string
    product: string
    productMask: string | null
    mask: string
  }
  createdAt?: string
}

const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Ime projekta je obvezno').max(120, 'Ime je predolgo'),
  stagingToken: stagedTokenSchema,
  // S+4 idempotenca: isti ključ + isti lastnik → isti projekt (brez podvajanja).
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
  // Izbirni izrecni tokeni (nadomestek, če result.json ni na voljo)
  originalToken: stagedTokenSchema.optional(),
  productToken: stagedTokenSchema.optional(),
  maskToken: stagedTokenSchema.optional(),
  productMaskToken: stagedTokenSchema.nullable().optional(),
  variants: z
    .array(
      z.object({
        label: z.string().trim().min(1, 'Oznaka variante je obvezna').max(80),
        productToken: stagedTokenSchema,
        productMaskToken: stagedTokenSchema.nullable().optional(),
      })
    )
    .max(5, 'Največ 5 variant')
    .optional(),
})

function parseJsonOrNull<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** GET — seznam projektov PRIJAVLJENEGA UPORABNIKA (S+4), najnovejši prej, max 50. */
export async function GET(request: Request) {
  // Aplikacijska konvencija: proxy je prva plast, ruta preveri sama (glej src/lib/auth.ts).
  const ctx = await vizOwner(request)
  if (ctx instanceof Response) return ctx
  try {
    const records = await listProjectsForOwner(ctx)
    const projects = records.map((rec) => ({
      id: rec.id,
      name: rec.name,
      previewPath: rec.previewPath ? clientUrlForPath(rec.previewPath) : null,
      createdAt: rec.createdAt,
      placement: parseJsonOrNull<VizPlacement>(rec.placement),
    }))
    return NextResponse.json({ projects })
  } catch (error) {
    console.error('Viz projects GET error:', error)
    return NextResponse.json({ error: 'Napaka pri branju viz projektov' }, { status: 500 })
  }
}

/** POST — shrani staging v projekt (kopira datoteke + ustvari metadata zapis). */
export async function POST(request: Request) {
  // S+4: projekt je vezan na prijavljenega uporabnika (lastništvo na backendu).
  const ctx: VizOwnerContext | Response = await vizOwner(request)
  if (ctx instanceof Response) return ctx
  const createdId = randomUUID()
  try {
    const body = await request.json().catch(() => null)
    const parsed = createProjectSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Neveljavni podatki projekta', details: parsed.error.issues },
        { status: 400 }
      )
    }
    const { name, stagingToken, variants, idempotencyKey } = parsed.data

    // ── S+4 idempotenca: ponovljen save z istim ključem → isti projekt ──────
    if (idempotencyKey) {
      const existing = await findProjectByIdempotencyKey(ctx.ownerId, idempotencyKey)
      if (existing) {
        return NextResponse.json(
          { projectId: existing.id, urls: {
            original: existing.originalPath,
            product: existing.productPath,
            productMask: existing.productMaskPath,
            mask: existing.maskPath,
            preview: existing.previewPath,
            placement: null,
            result: existing.resultPath,
          }, idempotent: true },
          { status: 200 }
        )
      }
    }

    // ── result.json → provenance (placement + tokeni) ───────────────────────
    const stagedResult = await vizGet(stagingKey(stagingToken, VIZ_FILE_NAMES.result))
    const stagedResultJson = stagedResult
      ? (JSON.parse(stagedResult.toString('utf8')) as StagedResultJson)
      : null
    const placementParsed = stagedResultJson
      ? placementSchema.safeParse(stagedResultJson.placement)
      : null
    if (!stagedResultJson || !placementParsed?.success) {
      return NextResponse.json(
        { error: 'Projekta ni mogoče shraniti — najprej izvedi predogled (manjka veljaven result.json)' },
        { status: 400 }
      )
    }
    const placement = placementParsed.data
    const tokens = {
      original: parsed.data.originalToken ?? stagedResultJson.tokens.original ?? stagingToken,
      product: parsed.data.productToken ?? stagedResultJson.tokens.product ?? null,
      productMask: parsed.data.productMaskToken ?? stagedResultJson.tokens.productMask ?? null,
      mask: parsed.data.maskToken ?? stagedResultJson.tokens.mask ?? null,
    }
    if (!tokens.product || !tokens.mask) {
      return NextResponse.json(
        { error: 'Manjkajo staged datoteke (produkt ali maska stare ograje)' },
        { status: 400 }
      )
    }

    // ── Preveri vire PRED kopiranjem ────────────────────────────────────────
    const productSrc = stagingKey(tokens.product, VIZ_FILE_NAMES.product)
    const maskSrc = stagingKey(tokens.mask, VIZ_FILE_NAMES.mask)
    if (!(await vizHas(productSrc))) {
      return NextResponse.json({ error: 'Staged produkt ne obstaja — naloži sliko znova' }, { status: 400 })
    }
    if (!(await vizHas(maskSrc))) {
      return NextResponse.json({ error: 'Staged maska ne obstaja — nariši masko znova' }, { status: 400 })
    }
    const productMaskSrc = tokens.productMask
      ? stagingKey(tokens.productMask, VIZ_FILE_NAMES.productMask)
      : null
    if (productMaskSrc && !(await vizHas(productMaskSrc))) {
      return NextResponse.json({ error: 'Staged maska izdelka ne obstaja' }, { status: 400 })
    }
    // Variantne vire preverimo vnaprej — pred kopiranjem.
    const variantSources: VizSaveVariantInput[] = []
    if (variants && variants.length > 0) {
      for (const variant of variants) {
        const vProductSrc = stagingKey(variant.productToken, VIZ_FILE_NAMES.product)
        if (!(await vizHas(vProductSrc))) {
          return NextResponse.json(
            { error: `Staged produkt variante "${variant.label}" ne obstaja` },
            { status: 400 }
          )
        }
        const vMaskSrc = variant.productMaskToken
          ? stagingKey(variant.productMaskToken, VIZ_FILE_NAMES.productMask)
          : null
        if (vMaskSrc && !(await vizHas(vMaskSrc))) {
          return NextResponse.json(
            { error: `Staged maska izdelka variante "${variant.label}" ne obstaja` },
            { status: 400 }
          )
        }
        variantSources.push({
          label: variant.label,
          productToken: variant.productToken,
          productMaskToken: variant.productMaskToken ?? null,
        })
      }
    }

    // ── Failure-safe save (S+4): kopiranje → COMMIT (metadata) → staging ────
    // Vse kopiranje + commit + staging cleanup je v saveProjectFromStaging
    // (compensating cleanup pri pre-commit napakah; testi z fault injection).
    const { record, urls } = await saveProjectFromStaging({
      id: createdId,
      ownerId: ctx.ownerId,
      idempotencyKey: idempotencyKey ?? null,
      name,
      stagingToken,
      tokens,
      placement,
      variants: variantSources,
    })

    return NextResponse.json({ projectId: record.id, urls })
  } catch (error) {
    // Pre-commit cleanup je naredil saveProjectFromStaging (compensating);
    // tu samo tolerantno pospravimo morebitne ostanke brez metadata (GC pa
    // pobere preostanek kasneje) — NE moremo poškodovati že commitanega projekta.
    console.error('Viz projects POST error:', error)
    return NextResponse.json({ error: 'Napaka pri shranjevanju projekta' }, { status: 500 })
  }
}
