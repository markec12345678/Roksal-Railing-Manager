// R376 (issue #13, korak R166 iz §5/§6/§11) — API: detajl/odobritev BOM verzije.
// ---------------------------------------------------------------------------
// GET   — detajl verzije BOM (dostop 'read' do projekta njenega nosilca):
//         verzija (sled izvora: sourceQuoteVersionId, priceBookVersionId,
//         productSdkVersion, layoutFingerprint) + VSE vrstice (internalSku,
//         category, quantity, honest NULL stroške §8, EXACT inventarna
//         vezava). Vir za procurement prikaz (agregati: /api/bom/procurement).
// PATCH — { action: 'approve' }: DRAFT → APPROVED (edini prehod; odobritev
//         BOM = sprostitev za nabavo/proizvodnjo). FAIL-CLOSED pravila:
//           • SAMO action 'approve' (SUPERSEDED nastane IZKLJUČNO ob novi
//             verziji — POST /api/bom oz. zaklep; tu ni poti do njega);
//           • prehod po matriki BOM_VERSION_TRANSITIONS (DRAFT→APPROVED),
//             drugačen status → 409 z dovoljenimi cilji;
//           • ZAKLENJEN projekt → 409 (BOM je po zaklepu nespremenljiv —
//             APPROVED verzijo ob zaklepu ustvari deal-lock, naknadne
//             odobritve bi bile tiha mutacija §7);
//           • dostop 'update' do projekta + revizijski vpis ATOMSKO (§19).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { assertProjectAccess, actorIdOf, AccessDeniedError } from '@/lib/access'
import { checkBomVersionTransition } from '@/lib/bom-versions'

import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'
import { auditInTx } from '@/lib/audit'

const patchActionSchema = z.object({
  action: z.literal('approve', { message: "Edino podprto dejanje je 'approve' (odobritev DRAFT verzije BOM)." }),
})

/** Vrstica DTO (§17 minimalni odgovor — brez notranjih id-jev zapisov). */
interface BomLineDto {
  id: string
  lineOrder: number
  quoteLineKey: string | null
  internalSku: string
  supplierSku: string | null
  inventoryId: string | null
  category: string
  descriptionSnapshot: string
  quantity: number
  unit: string
  wasteFactor: number | null
  grossQuantity: number | null
  unitCost: number | null
  totalCost: number | null
  supplierId: string | null
  geometrySource: string | null
  calculationRuleVersion: string
  status: string
  /** NEVEZANO razlog — NULL pri EXACT vezanih vrsticah (§11 honest fail-closed). */
  vezavaRazlog: string | null
}

/** Naloži verzijo + nosilec + projekt (lastniška vrata). 404, če ne obstaja. */
async function naloziVerzijo(id: string) {
  return db.bOMVersion.findUnique({
    where: { id },
    include: {
      bom: { include: { project: { select: { id: true, monterId: true, vodjaId: true, nazivProjekta: true, dealLocked: true } } } },
      lines: { orderBy: { lineOrder: 'asc' } },
    },
  })
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { id } = await params
    const version = await naloziVerzijo(id)
    if (!version) {
      return NextResponse.json({ error: 'Verzija BOM ne obstaja' }, { status: 404 })
    }
    assertProjectAccess(auth, version.bom.project, 'read')

    const lines: BomLineDto[] = version.lines.map((l) => ({
      id: l.id,
      lineOrder: l.lineOrder,
      quoteLineKey: l.quoteLineKey,
      internalSku: l.internalSku,
      supplierSku: l.supplierSku,
      inventoryId: l.inventoryId,
      category: l.category,
      descriptionSnapshot: l.descriptionSnapshot,
      quantity: l.quantity.toNumber(),
      unit: l.unit,
      wasteFactor: l.wasteFactor === null ? null : l.wasteFactor.toNumber(),
      grossQuantity: l.grossQuantity === null ? null : l.grossQuantity.toNumber(),
      unitCost: l.unitCost === null ? null : l.unitCost.toNumber(),
      totalCost: l.totalCost === null ? null : l.totalCost.toNumber(),
      supplierId: l.supplierId,
      geometrySource: l.geometrySource,
      calculationRuleVersion: l.calculationRuleVersion,
      status: l.status,
      vezavaRazlog: l.inventoryId === null
        ? `internalSku '${l.internalSku}' ni v inventarju (EXACT sifraMateriala ujemanje) — vrstica je NEVEZANA.`
        : null,
    }))

    return NextResponse.json({
      version: {
        id: version.id,
        bomId: version.bomId,
        projectId: version.bom.projectId,
        projectName: version.bom.project.nazivProjekta,
        versionNumber: version.versionNumber,
        status: version.status,
        sourceQuoteVersionId: version.sourceQuoteVersionId,
        priceBookVersionId: version.priceBookVersionId,
        productSdkVersion: version.productSdkVersion,
        layoutFingerprint: version.layoutFingerprint,
        createdAt: version.createdAt,
        approvedAt: version.approvedAt,
        lines,
      },
    })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('BOM version GET error:', error)
    return NextResponse.json({ error: 'Napaka pri branju verzije BOM' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // R376 — val 2 omejevanje hitrosti na pisanju (WRITE_LIMIT, kind `write`)
  const zavrnjeno = zapisOmejitev(request, 'bom/[id]')
  if (zavrnjeno) return zavrnjeno

  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { id } = await params
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const parsed = patchActionSchema.safeParse(telo.telo)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Neveljavni podatki', detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
        { status: 400 },
      )
    }

    const version = await naloziVerzijo(id)
    if (!version) {
      return NextResponse.json({ error: 'Verzija BOM ne obstaja' }, { status: 404 })
    }
    // Odobritev BOM = poslovna sprememba NA projektu → 'update' vrata
    // (isti prag kot zaklep posla; MONTER/vodja lastnika ali upravitelj).
    assertProjectAccess(auth, version.bom.project, 'update')

    // §7: zaklenjen projekt → BOM je NESPREMENLJIV (APPROVED verzijo ob
    // zaklepu ustvari deal-lock; naknadna odobritev bi bila tiha mutacija).
    if (version.bom.project.dealLocked) {
      return NextResponse.json(
        { error: 'Zaklenjen projekt — BOM je nespremenljiv (sprememba = eksplicitna nova verzija/change order).' },
        { status: 409 },
      )
    }

    // Statusni stroj (EN VIR — bom-versions.ts): DRAFT → APPROVED.
    const transition = checkBomVersionTransition(version.status, 'APPROVED')
    if (!transition.ok) {
      return NextResponse.json(
        {
          error: `Odobritev BOM verzije je mogoča samo nad osnutkom (DRAFT) — trenutni status je ${version.status}.`,
          detail: `Dovoljeni cilji iz ${version.status}: ${transition.allowed.length > 0 ? transition.allowed.join(', ') : '— (terminalno stanje)'}.`,
        },
        { status: 409 },
      )
    }

    const actor = actorIdOf(auth)
    // R294 F4: stena ure živi v ruti — en trenutek za odobritev + revizijo.
    const zdaj = new Date()
    const odobrena = await db.$transaction(async (tx) => {
      const updated = await tx.bOMVersion.update({
        where: { id: version.id },
        data: { status: 'APPROVED', approvedById: actor, approvedAt: zdaj },
      })
      await auditInTx(tx, {
        request,
        session: auth.kind === 'user' ? auth.session : null,
        userId: actor,
        projectId: version.bom.projectId,
        akcija: 'BOM_VERSION_APPROVED',
        oldValue: { status: version.status, versionNumber: version.versionNumber },
        newValue: {
          status: 'APPROVED',
          versionId: version.id,
          versionNumber: version.versionNumber,
          lineCount: version.lines.length,
          sourceQuoteVersionId: version.sourceQuoteVersionId,
          layoutFingerprint: version.layoutFingerprint,
        },
      })
      return updated
    })

    return NextResponse.json({
      success: true,
      version: {
        id: odobrena.id,
        versionNumber: odobrena.versionNumber,
        status: odobrena.status,
        approvedAt: odobrena.approvedAt,
        lineCount: version.lines.length,
      },
    })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('BOM version PATCH error:', error)
    return NextResponse.json({ error: 'Napaka pri odobritvi verzije BOM' }, { status: 500 })
  }
}
