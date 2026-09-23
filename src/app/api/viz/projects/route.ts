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
import { authenticate, unauthorized } from '@/lib/auth'
import type { VizPlacement, VizVariant } from '@/lib/viz/types'
import { placementSchema, stagedTokenSchema } from '@/lib/viz/validate'
import {
  VIZ_FILE_NAMES,
  projectKey,
  stagingKey,
  vizCopy,
  vizDelPrefix,
  vizGet,
  vizHas,
  vizPut,
} from '@/lib/viz/storage'
import { createProject, listProjects } from '@/lib/viz/repository'

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

/** GET — seznam projektov, najnovejši prej, max 50. */
export async function GET(request: Request) {
  // Aplikacijska konvencija: proxy je prva plast, ruta preveri sama (glej src/lib/auth.ts).
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const records = await listProjects()
    const projects = records.map((rec) => ({
      id: rec.id,
      name: rec.name,
      previewPath: rec.previewPath,
      createdAt: rec.createdAt,
      placement: parseJsonOrNull<VizPlacement>(rec.placement),
    }))
    return NextResponse.json({ projects })
  } catch (error) {
    console.error('Viz projects GET error:', error)
    return NextResponse.json({ error: 'Napaka pri branju viz projektov' }, { status: 500 })
  }
}

/** Kopiraj staged datoteko v projekt pod kanoničnim imenom; vrne javni URL. */
async function copyIntoProject(
  id: string,
  srcToken: string,
  srcName: string,
  destName: string
): Promise<string | null> {
  const srcKey = stagingKey(srcToken, srcName)
  if (!(await vizHas(srcKey))) return null
  const { url } = await vizCopy(srcKey, projectKey(id, destName))
  return url
}

/** POST — shrani staging v projekt (kopira datoteke + ustvari metadata zapis). */
export async function POST(request: Request) {
  // Aplikacijska konvencija: proxy je prva plast, ruta preveri sama (glej src/lib/auth.ts).
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
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
    const { name, stagingToken, variants } = parsed.data

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
    const variantSources: Array<{
      label: string
      productToken: string
      productMaskToken: string | null
    }> = []
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

    // ── Kopiraj staging → projects/<id>/ (kanonična imena) ─────────────────
    // original (stagingToken ali izrecno), preview + result so v staging
    // originalnega tokena; result.json pa ni javna datoteka projekta.
    const originalUrl =
      (await copyIntoProject(createdId, stagingToken, VIZ_FILE_NAMES.original, VIZ_FILE_NAMES.original)) ??
      (await copyIntoProject(createdId, tokens.original, VIZ_FILE_NAMES.original, VIZ_FILE_NAMES.original))
    if (!originalUrl) {
      return NextResponse.json(
        { error: 'Staged fotografija balkona ne obstaja — naloži sliko znova' },
        { status: 400 }
      )
    }

    const productUrl = await copyIntoProject(createdId, tokens.product, VIZ_FILE_NAMES.product, VIZ_FILE_NAMES.product)
    const maskUrl = await copyIntoProject(createdId, tokens.mask, VIZ_FILE_NAMES.mask, VIZ_FILE_NAMES.mask)
    const productMaskUrl = productMaskSrc
      ? await copyIntoProject(createdId, tokens.productMask!, VIZ_FILE_NAMES.productMask, VIZ_FILE_NAMES.productMask)
      : null

    const previewUrl = await copyIntoProject(createdId, stagingToken, VIZ_FILE_NAMES.preview, VIZ_FILE_NAMES.preview)

    // result.json (metrike + provenance) — javna datoteka projekta (kot v S+2).
    const resultUrl = await copyIntoProject(createdId, stagingToken, VIZ_FILE_NAMES.result, VIZ_FILE_NAMES.result)

    // placement.json (normalizirane koordinate).
    const placementPut = await vizPut(projectKey(createdId, VIZ_FILE_NAMES.placement), Buffer.from(JSON.stringify(placement, null, 2), 'utf8'), 'application/json')

    // ── Variante: product-<i>.jpg / product-mask-<i>.png ────────────────────
    const variantRecords: VizVariant[] = []
    for (let i = 0; i < variantSources.length; i++) {
      const variant = variantSources[i]
      const idx = i + 1
      const vProductUrl = await copyIntoProject(
        createdId,
        variant.productToken,
        VIZ_FILE_NAMES.product,
        `product-${idx}.jpg`
      )
      let variantMaskPath: string | null = null
      if (variant.productMaskToken) {
        const vMaskUrl = await copyIntoProject(
          createdId,
          variant.productMaskToken,
          VIZ_FILE_NAMES.productMask,
          `product-mask-${idx}.png`
        )
        variantMaskPath = vMaskUrl
      }
      variantRecords.push({
        label: variant.label,
        productPath: vProductUrl ?? '',
        productMaskPath: variantMaskPath,
        previewPath: null,
      })
    }

    // ── Metadata zapis (local = Prisma, blob = project.json) ────────────────
    const record = await createProject({
      id: createdId,
      name,
      originalPath: originalUrl,
      productPath: productUrl ?? '',
      productMaskPath: productMaskUrl,
      maskPath: maskUrl ?? '',
      previewPath: previewUrl,
      resultPath: resultUrl,
      placement: JSON.stringify(placement),
      variants: variantRecords.length > 0 ? JSON.stringify(variantRecords) : null,
    })

    // ── Pobriši porabljene staging tokene ───────────────────────────────────
    const consumedTokens = new Set<string>([
      stagingToken,
      tokens.original,
      tokens.product,
      tokens.mask,
      tokens.productMask ?? '',
      ...(variants?.map((v) => v.productToken) ?? []),
      ...(variants?.map((v) => v.productMaskToken ?? '') ?? []),
    ])
    consumedTokens.delete('')
    for (const token of consumedTokens) {
      await vizDelPrefix(`viz/staging/${token}`).catch(() => undefined)
    }

    const urls = {
      original: record.originalPath,
      product: record.productPath,
      productMask: record.productMaskPath,
      mask: record.maskPath,
      preview: record.previewPath,
      placement: placementPut.url,
      result: record.resultPath,
    }
    return NextResponse.json({ projectId: record.id, urls })
  } catch (error) {
    // Pospravi nedokončano projektno mapo (tolerantno).
    await vizDelPrefix(`viz/projects/${createdId}`).catch(() => undefined)
    console.error('Viz projects POST error:', error)
    return NextResponse.json({ error: 'Napaka pri shranjevanju projekta' }, { status: 500 })
  }
}
