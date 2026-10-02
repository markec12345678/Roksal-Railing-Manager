// R378 (issue #13, korak R167 iz §10) — API: detajl + prehodi/zapis proizvodnega naročila.
// ---------------------------------------------------------------------------
// GET   — detajl naročila (dostop 'read' do projekta): naročilo + VSE vrstice
//         (snapshoti: internalSku/plannedQty/produced/rejected/scrapped/
//         remaining — strežniško izračunan) + VSE operacije (sequence asc).
// PATCH — DVE dejanji (discipliniran vnos, ne prosti patch):
//           1. { action: 'transition', to, reason? } — prehod PO MATRIKI
//              §10 (production-orders.ts EN VIR); izidi (REWORK/REJECTED/
//              SCRAPPED/REPLACED) zahtevajo RAZLOG (400 brez — odmik brez
//              razloga je tiha mutacija zgodovine); PLANNED→RELEASED
//              napolni approvedById/approvedAt; zaklenjen projekt NE blokira
//              (meja R167: izvedba obstoječega naročila teče naprej);
//           2. { action: 'record-production', bomLineId, producedQty?,
//              rejectedQty?, scrappedQty? } — STROGI vnos (neznan ključ → 400:
//              remainingQty klienta NE zanima, strežnik ga izračuna — forged
//              vhod pada GLASNO); totali so ABSOLUTNI; invarianti: rejected ≤
//              produced, produced + scrapped ≤ planned (409) — clampov NI.
//         RBAC: dostop 'update' do projekta (isti prag kot PATCH /api/bom/[id]
//         — poslovna sprememba NA projektu); vsako dejanje = revizijski vpis
//         ATOMSKO z dogodkom (§19; zapisuje ga plast production-store).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { assertProjectAccess, actorIdOf, AccessDeniedError } from '@/lib/access'
import { PRODUCTION_ORDER_STATUSES } from '@/lib/production-orders'
import {
  ProductionStoreError,
  ZapisProdukcijeVhod,
  naloziProductionOrder,
  prehodProductionOrderVTx,
  zapisProdukcijeVTx,
} from '@/lib/production-store'

import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'

const patchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('transition', { message: "Podprta dejanja: 'transition', 'record-production'." }),
    to: z.enum(PRODUCTION_ORDER_STATUSES, { message: 'Neznan ciljni status naročila (matrika §10).' }),
    reason: z.string().max(500).optional().nullable(),
  }),
  // STROGA shema: neznan ključ (npr. forgan remainingQty) → 400 GLASNO —
  // klientov total nas NE zanima, remainingQty izračuna STREŽNIK.
  z
    .object({
      action: z.literal('record-production', { message: "Podprta dejanja: 'transition', 'record-production'." }),
      bomLineId: z.string().min(1, 'bomLineId je obvezen').max(64),
      producedQty: z.number().finite().min(0).optional(),
      rejectedQty: z.number().finite().min(0).optional(),
      scrappedQty: z.number().finite().min(0).optional(),
    })
    .strict(),
])

/** Vrstica DTO (§17 minimalni odgovor — brez notranjih zapisov revizije). */
interface ProductionLineDto {
  id: string
  lineOrder: number
  bomLineId: string
  internalSku: string
  plannedQty: number
  producedQty: number
  rejectedQty: number
  scrappedQty: number
  remainingQty: number
  unit: string
}

interface OperationDto {
  id: string
  operationType: string
  sequence: number
  plannedDurationMin: number | null
  actualDurationMin: number | null
  operatorId: string | null
  status: string
  result: string | null
  notes: string | null
  createdAt: Date
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { id } = await params
    const nalog = await naloziProductionOrder(id)
    if (!nalog) {
      return NextResponse.json({ error: 'Proizvodno naročilo ne obstaja' }, { status: 404 })
    }
    assertProjectAccess(auth, { id: nalog.projectId, monterId: null, vodjaId: null }, 'read')

    const lines: ProductionLineDto[] = nalog.lines.map((l) => ({
      id: l.id,
      lineOrder: l.lineOrder,
      bomLineId: l.bomLineId,
      internalSku: l.internalSku,
      plannedQty: l.plannedQty.toNumber(),
      producedQty: l.producedQty.toNumber(),
      rejectedQty: l.rejectedQty.toNumber(),
      scrappedQty: l.scrappedQty.toNumber(),
      remainingQty: l.remainingQty.toNumber(),
      unit: l.unit,
    }))
    const operations: OperationDto[] = nalog.operations.map((o) => ({
      id: o.id,
      operationType: o.operationType,
      sequence: o.sequence,
      plannedDurationMin: o.plannedDurationMin,
      actualDurationMin: o.actualDurationMin,
      operatorId: o.operatorId,
      status: o.status,
      result: o.result,
      notes: o.notes,
      createdAt: o.createdAt,
    }))

    return NextResponse.json({
      order: {
        id: nalog.id,
        projectId: nalog.projectId,
        bomVersionId: nalog.bomVersionId,
        status: nalog.status,
        priority: nalog.priority,
        dueAt: nalog.dueAt,
        createdAt: nalog.createdAt,
        updatedAt: nalog.updatedAt,
        approvedById: nalog.approvedById,
        approvedAt: nalog.approvedAt,
        lines,
        operations,
      },
    })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Production order GET error:', error)
    return NextResponse.json({ error: 'Napaka pri branju proizvodnega naročila' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // R378 — val 2 omejevanje hitrosti na pisanju (WRITE_LIMIT, kind `write`)
  const zavrnjeno = zapisOmejitev(request, 'production/[id]')
  if (zavrnjeno) return zavrnjeno

  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { id } = await params
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const parsed = patchSchema.safeParse(telo.telo)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Neveljavni podatki', detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
        { status: 400 },
      )
    }

    // Vrata na ravni vira: prehod/zapis je poslovna sprememba NA projektu.
    const nalog = await db.productionOrder.findUnique({
      where: { id },
      select: { id: true, projectId: true, project: { select: { id: true, monterId: true, vodjaId: true } } },
    })
    if (!nalog) {
      return NextResponse.json({ error: 'Proizvodno naročilo ne obstaja' }, { status: 404 })
    }
    assertProjectAccess(auth, nalog.project, 'update')

    const actor = actorIdOf(auth)
    // R294 F4: stena ure živi v ruti — en trenutek za celo transakcijo.
    const zdaj = new Date()
    const revizija = { request, session: auth.kind === 'user' ? auth.session : null, userId: actor }

    // Ozkočenje uniona v LOKALNO const — ozkočenje prek referenčne verige
    // (parsed.data) se v TS ne ohrani za destrukturiranje; lokalna const
    // vezi pa se zanesljivo ožijo in prenašajo v closure.
    const data = parsed.data
    if (data.action === 'transition') {
      const { to, reason } = data
      const prehod = await db.$transaction(async (tx) =>
        prehodProductionOrderVTx(tx, {
          orderId: id,
          to,
          reason: reason ?? null,
          actorId: actor,
          now: zdaj,
          revizija,
        }),
      )
      return NextResponse.json({
        success: true,
        order: { id: prehod.orderId, status: prehod.to },
        from: prehod.from,
      })
    }

    // action === 'record-production'
    const zapis: ZapisProdukcijeVhod = {
      orderId: id,
      bomLineId: data.bomLineId,
      producedQty: data.producedQty,
      rejectedQty: data.rejectedQty,
      scrappedQty: data.scrappedQty,
      actorId: actor,
      now: zdaj,
      revizija,
    }
    const posodobljeno = await db.$transaction(async (tx) => zapisProdukcijeVTx(tx, zapis))
    return NextResponse.json({ success: true, line: posodobljeno })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof ProductionStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    console.error('Production order PATCH error:', error)
    return NextResponse.json({ error: 'Napaka pri spremembi proizvodnega naročila' }, { status: 500 })
  }
}
