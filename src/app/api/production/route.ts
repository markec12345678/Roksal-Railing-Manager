// R378 (issue #13, korak R167 iz §10) — API: proizvodna naročila projekta.
// ---------------------------------------------------------------------------
// GET  — seznam VSEH proizvodnih naročil projekta (?projectId=; dostop
//        'read' do projekta — ista vrata kot vse projektne rute). Vrača
//        minimalni seznam (status/priority/dueAt/bomVersionId/lineCount —
//        vrstice, operacije in agregati so na GET /api/production/[id]).
// POST — ustvari NOVO naročilo nad ODOBRENIM BOM (PLANNED):
//          vhod  = { projectId, bomVersionId, priority?, dueAt? } (SAMO
//                   povezavi — vrstice se izpeljejo IZKLJUČNO strežniško iz
//                   snapshotov BOMLine; §10: produkcija NE sme ponovno
//                   izračunavati geometrije, uporabi odobren BOM);
//          vrata = dostop 'update' do projekta + pravica quotes.create
//                  (isti vzorec kot POST /api/bom — katalog §10 quotes.create
//                  izrecno pokriva »Izračun ponudbe (kalkulator/BOM)« in
//                  proizvodno naročilo je IZPELJALNA plast iste verige
//                  ponudba→BOM→naročilo; MONTER jo ima — teren načrtuje
//                  izvedbo, SKLADISCE ne; RBAC matrika je ZAMRZNJENA —
//                  production.manage ostaja za razpored/ekipe/opremo);
//          stroj = ustvariProductionOrderVTx (TRANSAKCIJSKO): projekt
//                  obstaja 404 / zaklenjen 409 (nova zaveza = change order
//                  teritorij §6/§7 — meja R167) / BOM verzija 404 / prečni
//                  projekt 409 / status ≠ APPROVED 409 (§10: produkcija
//                  SAMO nad odobrenim BOM) / prioritetna validacija 400 /
//                  vrstice = snapshoti (determinizem jedra) + revizijski
//                  vpis ATOMSKO (§19).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { assertProjectAccess, lacksPermission, actorIdOf, AccessDeniedError } from '@/lib/access'
import { ProductionStoreError, ustvariProductionOrderVTx } from '@/lib/production-store'
import { ProductionOrdersError } from '@/lib/production-orders'

import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'

const novoNarociloSchema = z.object({
  projectId: z.string().min(1, 'projectId je obvezen').max(64),
  bomVersionId: z.string().min(1, 'bomVersionId je obvezen').max(64),
  priority: z.enum(['NIZKA', 'NORMALNA', 'URGENTNO']).optional(),
  dueAt: z.string().datetime().optional().nullable(),
})

export async function GET(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, monterId: true, vodjaId: true, dealLocked: true },
    })
    assertProjectAccess(auth, project, 'read')

    const nalogi = await db.productionOrder.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        priority: true,
        dueAt: true,
        bomVersionId: true,
        createdAt: true,
        updatedAt: true,
        approvedAt: true,
        _count: { select: { lines: true, operations: true } },
      },
    })
    return NextResponse.json({
      projectId,
      dealLocked: project!.dealLocked,
      orders: nalogi.map((n) => ({
        id: n.id,
        status: n.status,
        priority: n.priority,
        dueAt: n.dueAt,
        bomVersionId: n.bomVersionId,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        approvedAt: n.approvedAt,
        lineCount: n._count.lines,
        operationCount: n._count.operations,
      })),
    })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Production GET error:', error)
    return NextResponse.json({ error: 'Napaka pri branju proizvodnih naročil' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  // R378 — val 2 omejevanje hitrosti na pisanju (WRITE_LIMIT, kind `write`)
  const zavrnjeno = zapisOmejitev(request, 'production')
  if (zavrnjeno) return zavrnjeno

  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  // §10 (R135): proizvodno naročilo izpelje ISTA pravica kot BOM (quotes.create
  // — katalog jo opisuje kot »Izračun ponudbe (kalkulator/BOM)«; naročilo je
  // izpeljava te verige). MONTER jo ima, SKLADISCE/apikey ne.
  if (lacksPermission(auth, 'quotes.create')) {
    return forbidden('Ustvarjanje proizvodnega naročila zahteva uporabniško pravico quotes.create.')
  }
  try {
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const parsed = novoNarociloSchema.safeParse(telo.telo)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Neveljavni podatki', detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
        { status: 400 },
      )
    }
    const { projectId, bomVersionId, priority, dueAt } = parsed.data

    // Vrata na ravni vira: naročilo je poslovni zapis NA projektu.
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, monterId: true, vodjaId: true, dealLocked: true },
    })
    assertProjectAccess(auth, project, 'update')

    const actor = actorIdOf(auth)
    // R294 F4: stena ure živi v ruti — en trenutek za celo transakcijo.
    const zdaj = new Date()
    const ustvarjeno = await db.$transaction(async (tx) =>
      ustvariProductionOrderVTx(tx, {
        projectId,
        bomVersionId,
        priority,
        dueAt: dueAt !== undefined && dueAt !== null ? new Date(dueAt) : null,
        actorId: actor,
        now: zdaj,
        revizija: { request, session: auth.kind === 'user' ? auth.session : null, userId: actor },
      }),
    )

    return NextResponse.json(
      {
        success: true,
        order: {
          id: ustvarjeno.orderId,
          status: ustvarjeno.status,
          priority: ustvarjeno.priority,
          bomVersionId: ustvarjeno.bomVersionId,
          lineCount: ustvarjeno.lineCount,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof ProductionStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    if (error instanceof ProductionOrdersError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Production POST error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju proizvodnega naročila' }, { status: 500 })
  }
}
