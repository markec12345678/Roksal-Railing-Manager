// VIZ — /api/viz/projects (runda S+2). Spec: docs/VIZ_CONTRACTS.md
//   GET  — seznam projektov (najnovejši prej, max 50, placement parsed)
//   POST — { name, stagingToken, variants? } → premakne staging mapo v
//          public/viz/projects/<id>/, preimenuje datoteke na kanonična
//          MVP imena, zapiše placement.json in ustvari VizProject vrstico.
//
// Opomba o tokenih: /api/viz/stage ustvari NOV token za vsako datoteko.
// Staging mapa `stagingToken` (balkon) vsebuje preview.jpg + result.json iz
// /api/viz/preview; result.json hrani provenance (tokeni product/mask/
// productMask), po katerih ta route poišče in preimenuje ostale datoteke.
// Izvozno dodatno (nadomestek result.json): telesu lahko pošlješ tudi
// originalToken/productToken/maskToken/productMaskToken izrecno.
import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { getVizDb } from '@/lib/viz/db'
import { authenticate, unauthorized } from '@/lib/auth'
import type { VizPlacement, VizVariant } from '@/lib/viz/types'
import { placementSchema, stagedTokenSchema } from '@/lib/viz/validate'
import {
  VIZ_FILE_NAMES,
  copyFileInto,
  ensureVizDirs,
  moveDir,
  pathExists,
  projectDir,
  publicProjectUrl,
  readJsonFile,
  removeDir,
  stagingDir,
  writeJsonFile,
} from '@/lib/viz/storage'

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
  const vizDb = getVizDb()
  try {
    const rows = await vizDb.vizProject.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    const projects = rows.map((row) => ({
      id: row.id,
      name: row.name,
      previewPath: row.previewPath,
      createdAt: row.createdAt.toISOString(),
      placement: parseJsonOrNull<VizPlacement>(row.placement),
    }))
    return NextResponse.json({ projects })
  } catch (error) {
    console.error('Viz projects GET error:', error)
    return NextResponse.json({ error: 'Napaka pri branju viz projektov' }, { status: 500 })
  }
}

/** POST — shrani staging v projekt (premakni datoteke + ustvari vrstico). */
export async function POST(request: Request) {
  // Aplikacijska konvencija: proxy je prva plast, ruta preveri sama (glej src/lib/auth.ts).
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const vizDb = getVizDb()
  let destDir: string | null = null
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

    const srcDir = stagingDir(stagingToken)
    if (!(await pathExists(srcDir))) {
      return NextResponse.json(
        { error: 'Staging token ne obstaja ali je že porabljen' },
        { status: 400 }
      )
    }

    // ── result.json → provenance (placement + tokeni) ───────────────────────
    const stagedResult = await readJsonFile<StagedResultJson>(
      path.join(srcDir, VIZ_FILE_NAMES.result)
    )
    const placementParsed = stagedResult
      ? placementSchema.safeParse(stagedResult.placement)
      : null
    if (!stagedResult || !placementParsed?.success) {
      return NextResponse.json(
        { error: 'Projekta ni mogoče shraniti — najprej izvedi predogled (manjka veljaven result.json)' },
        { status: 400 }
      )
    }
    const placement = placementParsed.data
    const tokens = {
      original: parsed.data.originalToken ?? stagedResult.tokens.original ?? stagingToken,
      product: parsed.data.productToken ?? stagedResult.tokens.product ?? null,
      productMask: parsed.data.productMaskToken ?? stagedResult.tokens.productMask ?? null,
      mask: parsed.data.maskToken ?? stagedResult.tokens.mask ?? null,
    }
    if (!tokens.product || !tokens.mask) {
      return NextResponse.json(
        { error: 'Manjkajo staged datoteke (produkt ali maska stare ograje)' },
        { status: 400 }
      )
    }

    // ── Preveri vire PRED destruktivnimi operacijami ────────────────────────
    const productSrc = path.join(stagingDir(tokens.product), VIZ_FILE_NAMES.product)
    const maskSrc = path.join(stagingDir(tokens.mask), VIZ_FILE_NAMES.mask)
    if (!(await pathExists(productSrc))) {
      return NextResponse.json({ error: 'Staged produkt ne obstaja — naloži sliko znova' }, { status: 400 })
    }
    if (!(await pathExists(maskSrc))) {
      return NextResponse.json({ error: 'Staged maska ne obstaja — nariši masko znova' }, { status: 400 })
    }
    const productMaskSrc =
      tokens.productMask
        ? path.join(stagingDir(tokens.productMask), VIZ_FILE_NAMES.productMask)
        : null
    if (tokens.productMask && (!productMaskSrc || !(await pathExists(productMaskSrc)))) {
      return NextResponse.json({ error: 'Staged maska izdelka ne obstaja' }, { status: 400 })
    }
    // Variantne vire preverimo vnaprej — pred destruktivnimi operacijami.
    const variantSources: Array<{
      label: string
      productSrc: string
      productMaskSrc: string | null
    }> = []
    if (variants && variants.length > 0) {
      for (const variant of variants) {
        const vProductSrc = path.join(stagingDir(variant.productToken), VIZ_FILE_NAMES.product)
        if (!(await pathExists(vProductSrc))) {
          return NextResponse.json(
            { error: `Staged produkt variante "${variant.label}" ne obstaja` },
            { status: 400 }
          )
        }
        const vMaskSrc = variant.productMaskToken
          ? path.join(stagingDir(variant.productMaskToken), VIZ_FILE_NAMES.productMask)
          : null
        variantSources.push({
          label: variant.label,
          productSrc: vProductSrc,
          productMaskSrc: vMaskSrc && (await pathExists(vMaskSrc)) ? vMaskSrc : null,
        })
      }
    }

    // ── Premakni staging → projects/<id>/ ───────────────────────────────────
    await ensureVizDirs()
    const id = randomUUID()
    destDir = projectDir(id)
    await mkdir(destDir, { recursive: true })
    await moveDir(srcDir, destDir)

    try {
      // Kanonična imena iz sibling staging map.
      await copyFileInto(productSrc, destDir, VIZ_FILE_NAMES.product)
      await copyFileInto(maskSrc, destDir, VIZ_FILE_NAMES.mask)
      if (productMaskSrc) {
        await copyFileInto(productMaskSrc, destDir, VIZ_FILE_NAMES.productMask)
      }

      // placement.json na disk (normalizirane koordinate).
      await writeJsonFile(path.join(destDir, VIZ_FILE_NAMES.placement), placement)

      // ── Variante: product-<i>.jpg / product-mask-<i>.png ──────────────────
      const variantRecords: VizVariant[] = []
      for (let i = 0; i < variantSources.length; i++) {
        const variant = variantSources[i]
        const idx = i + 1
        await copyFileInto(variant.productSrc, destDir, `product-${idx}.jpg`)
        let variantMaskPath: string | null = null
        if (variant.productMaskSrc) {
          await copyFileInto(variant.productMaskSrc, destDir, `product-mask-${idx}.png`)
          variantMaskPath = publicProjectUrl(id, `product-mask-${idx}.png`)
        }
        variantRecords.push({
          label: variant.label,
          productPath: publicProjectUrl(id, `product-${idx}.jpg`),
          productMaskPath: variantMaskPath,
          previewPath: null,
        })
      }

      // ── Pobriši porabljene sibling staging mape ───────────────────────────
      const consumedTokens = new Set<string>([
        tokens.product,
        tokens.mask,
        tokens.productMask ?? '',
        ...(variants?.map((v) => v.productToken) ?? []),
        ...(variants?.map((v) => v.productMaskToken ?? '') ?? []),
      ])
      consumedTokens.delete('')
      consumedTokens.delete(stagingToken)

      for (const token of consumedTokens) {
        await removeDir(stagingDir(token)).catch(() => undefined)
      }

      // ── Vrstica v bazi (poti = javni URL-ji) ──────────────────────────────
      const hasPreview = await pathExists(path.join(destDir, VIZ_FILE_NAMES.preview))
      const hasResult = await pathExists(path.join(destDir, VIZ_FILE_NAMES.result))
      const row = await vizDb.vizProject.create({
        data: {
          id,
          name,
          originalPath: publicProjectUrl(id, VIZ_FILE_NAMES.original),
          productPath: publicProjectUrl(id, VIZ_FILE_NAMES.product),
          productMaskPath: productMaskSrc ? publicProjectUrl(id, VIZ_FILE_NAMES.productMask) : null,
          maskPath: publicProjectUrl(id, VIZ_FILE_NAMES.mask),
          previewPath: hasPreview ? publicProjectUrl(id, VIZ_FILE_NAMES.preview) : null,
          resultPath: hasResult ? publicProjectUrl(id, VIZ_FILE_NAMES.result) : null,
          resultImagePath: null,
          placement: JSON.stringify(placement),
          variants: variantRecords.length > 0 ? JSON.stringify(variantRecords) : null,
        },
      })

      const urls = {
        original: row.originalPath,
        product: row.productPath,
        productMask: row.productMaskPath,
        mask: row.maskPath,
        preview: row.previewPath,
        placement: publicProjectUrl(id, VIZ_FILE_NAMES.placement),
        result: row.resultPath,
      }
      return NextResponse.json({ projectId: row.id, urls })
    } catch (innerError) {
      // Pospravi nedokončano projektno mapo.
      console.error('Viz projects POST inner error:', innerError)
      await removeDir(destDir).catch(() => undefined)
      destDir = null
      throw innerError
    }
  } catch (error) {
    if (destDir) {
      await removeDir(destDir).catch(() => undefined)
    }
    console.error('Viz projects POST error:', error)
    return NextResponse.json({ error: 'Napaka pri shranjevanju projekta' }, { status: 500 })
  }
}
