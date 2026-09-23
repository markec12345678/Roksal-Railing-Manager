/**
 * VIZ — failure-safe save flow (runda S+4, P0 §3).
 *
 * Izvleček POST /api/viz/projects logike, da je mogoče s fault injection
 * DOKAZATI odpornost na delni neuspeh. Politika "metadata = commit točka":
 *
 *   1. Vse datoteke se NAJPREJ kopirajo v viz/projects/<id>/ (kopiranje je
 *      po korakih; vsak korak ima injekcijsko točko za teste).
 *   2. Metadata zapis (Prisma vrstica / project.json) nastane ZADNJI — to je
 *      COMMIT. Prej: napaka → compensating cleanup (0 orphan datotek, 0 fake
 *      zapisov). Po commitu: napaka → projekt ostane VELJAVEN (0 izgubljenih
 *      podatkov; morebitni staging ostanki pobere staging GC).
 *
 * Injekcijske točke (samo za teste; v produkciji faults = undefined):
 *   after-original | after-product | after-product-mask | after-mask |
 *   after-preview | after-result | after-placement | after-variants |
 *   before-metadata | after-metadata | before-staging-cleanup
 *
 * 'after-metadata' in 'before-staging-cleanup' simulirata sesutje po commitu:
 * funkcija mete InjectedFailure, a cleanup NE briše projekta (že zapisan).
 */
import type { VizPlacement, VizVariant } from './types'
import { VIZ_FILE_NAMES, projectKey, stagingKey, vizCopy, vizDelPrefix, vizHas, vizPut } from './storage'
import { createProject, type VizProjectRecord } from './repository'

/** Simuliran sesutje na injekcijski točki (testi). */
export class InjectedFailure extends Error {
  constructor(public readonly point: string) {
    super(`Vbrizgana napaka: ${point}`)
    this.name = 'InjectedFailure'
  }
}

export type VizSaveFaultPoint =
  | 'after-original'
  | 'after-product'
  | 'after-product-mask'
  | 'after-mask'
  | 'after-preview'
  | 'after-result'
  | 'after-placement'
  | 'after-variants'
  | 'before-metadata'
  | 'after-metadata'
  | 'before-staging-cleanup'

export interface VizSaveVariantInput {
  label: string
  productToken: string
  productMaskToken: string | null
}

export interface VizSaveFlowInput {
  id: string
  ownerId: string | null
  idempotencyKey?: string | null
  name: string
  stagingToken: string
  tokens: {
    original: string
    product: string
    productMask: string | null
    mask: string
  }
  placement: VizPlacement
  variants: VizSaveVariantInput[]
  /** Samo testi — set injekcijskih točk. */
  faults?: Set<VizSaveFaultPoint>
}

export interface VizSaveFlowResult {
  record: VizProjectRecord
  placementUrl: string
  urls: {
    original: string
    product: string
    productMask: string | null
    mask: string
    preview: string | null
    result: string | null
    placement: string
  }
}

function failIf(faults: Set<VizSaveFaultPoint> | undefined, point: VizSaveFaultPoint): void {
  if (faults?.has(point)) throw new InjectedFailure(point)
}

/** Kopiraj staged datoteko v projekt pod kanoničnim imenom; vrne javni URL ali null. */
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

/**
 * Odporen na delni neuspeh: staging → projekt.
 * Vrže InjectedFailure na injekcijskih točkah; ostale napake so neujete,
 * pre-commit pa vedno opravijo compensating cleanup (glej spodaj).
 */
export async function saveProjectFromStaging(input: VizSaveFlowInput): Promise<VizSaveFlowResult> {
  const faults = input.faults
  const { id } = input
  // ── 1. Kopiraj datoteke (pre-commit — vsaka napaka sprosti cleanup) ──────
  try {
    const originalUrl =
      (await copyIntoProject(id, input.stagingToken, VIZ_FILE_NAMES.original, VIZ_FILE_NAMES.original)) ??
      (await copyIntoProject(id, input.tokens.original, VIZ_FILE_NAMES.original, VIZ_FILE_NAMES.original))
    if (!originalUrl) {
      throw new Error('Staged fotografija balkona ne obstaja — naloži sliko znova')
    }
    failIf(faults, 'after-original')

    const productUrl = await copyIntoProject(id, input.tokens.product, VIZ_FILE_NAMES.product, VIZ_FILE_NAMES.product)
    failIf(faults, 'after-product')

    const productMaskSrc = input.tokens.productMask
      ? stagingKey(input.tokens.productMask, VIZ_FILE_NAMES.productMask)
      : null
    const productMaskUrl = productMaskSrc
      ? await copyIntoProject(id, input.tokens.productMask!, VIZ_FILE_NAMES.productMask, VIZ_FILE_NAMES.productMask)
      : null
    failIf(faults, 'after-product-mask')

    const maskUrl = await copyIntoProject(id, input.tokens.mask, VIZ_FILE_NAMES.mask, VIZ_FILE_NAMES.mask)
    failIf(faults, 'after-mask')

    const previewUrl = await copyIntoProject(id, input.stagingToken, VIZ_FILE_NAMES.preview, VIZ_FILE_NAMES.preview)
    failIf(faults, 'after-preview')

    // result.json (metrike + provenance) — javna datoteka projekta.
    const resultUrl = await copyIntoProject(id, input.stagingToken, VIZ_FILE_NAMES.result, VIZ_FILE_NAMES.result)
    failIf(faults, 'after-result')

    // placement.json (normalizirane koordinate).
    const placementPut = await vizPut(
      projectKey(id, VIZ_FILE_NAMES.placement),
      Buffer.from(JSON.stringify(input.placement, null, 2), 'utf8'),
      'application/json'
    )
    failIf(faults, 'after-placement')

    // ── Variante: product-<i>.jpg / product-mask-<i>.png ────────────────────
    const variantRecords: VizVariant[] = []
    for (let i = 0; i < input.variants.length; i++) {
      const variant = input.variants[i]
      const idx = i + 1
      const vProductUrl = await copyIntoProject(id, variant.productToken, VIZ_FILE_NAMES.product, `product-${idx}.jpg`)
      let variantMaskPath: string | null = null
      if (variant.productMaskToken) {
        const vMaskUrl = await copyIntoProject(
          id,
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
    failIf(faults, 'after-variants')

    // ── 2. COMMIT — metadata zapis ZADNJI ───────────────────────────────────
    failIf(faults, 'before-metadata')
    const record = await createProject({
      id,
      ownerId: input.ownerId,
      idempotencyKey: input.idempotencyKey ?? null,
      name: input.name,
      originalPath: originalUrl,
      productPath: productUrl ?? '',
      productMaskPath: productMaskUrl,
      maskPath: maskUrl ?? '',
      previewPath: previewUrl,
      resultPath: resultUrl,
      placement: JSON.stringify(input.placement),
      variants: variantRecords.length > 0 ? JSON.stringify(variantRecords) : null,
    })
    failIf(faults, 'after-metadata')

    // ── 3. Post-commit: pobriši porabljene staging tokene (best-effort) ─────
    failIf(faults, 'before-staging-cleanup')
    const consumedTokens = new Set<string>([
      input.stagingToken,
      input.tokens.original,
      input.tokens.product,
      input.tokens.mask,
      input.tokens.productMask ?? '',
      ...input.variants.map((v) => v.productToken),
      ...input.variants.map((v) => v.productMaskToken ?? ''),
    ])
    consumedTokens.delete('')
    for (const token of consumedTokens) {
      await vizDelPrefix(`viz/staging/${token}`).catch(() => undefined)
    }

    return {
      record,
      placementUrl: placementPut.url,
      urls: {
        original: record.originalPath,
        product: record.productPath,
        productMask: record.productMaskPath,
        mask: record.maskPath,
        preview: record.previewPath,
        result: record.resultPath,
        placement: placementPut.url,
      },
    }
  } catch (error) {
    // ── Compensating cleanup ────────────────────────────────────────────────
    // Pre-commit napaka (vključno z InjectedFailure pred commitom): pobriši
    // morebitne prekopirane projektne datoteke → 0 orphan datotek, 0 fake
    // zapisov. PO commitu (after-metadata / before-staging-cleanup) projekta
    // NE brišemo — je že veljaven commit (0 izgubljenih podatkov); staging
    // ostanki so za staging GC.
    const afterCommit = faults?.has('after-metadata') || faults?.has('before-staging-cleanup')
    const injected = error instanceof InjectedFailure
    if (injected && !afterCommit) {
      await vizDelPrefix(`viz/projects/${id}/`).catch(() => undefined)
    }
    if (injected && afterCommit) {
      // simuliramo sesutje po commitu — projekt ostane; staging očisti GC.
      // (v produkciji faults ni nastavljen, zato ta veja obstaja samo v testih)
    }
    if (!injected) {
      // Prava napaka: ne vemo, ali je commit uspel → poskusi prebrati metadata.
      // Če metadata ne obstaja, so to pre-commit orphans → počisti.
      // (check pohitri, ne zamenjuje GC-ja; minimalna poškodba je cilj)
      try {
        const { getProject } = await import('./repository')
        const committed = await getProject(id)
        if (!committed) {
          await vizDelPrefix(`viz/projects/${id}/`).catch(() => undefined)
        }
      } catch {
        // cleanup je best-effort — GC pobere morebitne ostanke kasneje
      }
    }
    throw error
  }
}
