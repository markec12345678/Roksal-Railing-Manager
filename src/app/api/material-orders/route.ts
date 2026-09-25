// Roksal Field - API: Naročila materiala (V5) — S+9 (issue #4, §4/§5/§7)
// Iz BOM draft → naročilo pri dobavitelju.
// Prejem (DOBLJENO) je IDEMPOTENTEN in transakcijski: status guard + ledger
// dogodki + audit v ENI transakciji. Ponovljen request ne podvoji zaloge.
// Statusni stroj naročila: OSNUTEK → POSLANO → POTRJENO → DOBLJENO;
// PREKlicANO iz vseh stanj razen DOBLJENO.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden, denyWithoutPermission } from '@/lib/auth'
import { receiveOrder, StockError } from '@/lib/inventory'
import { auditInTx, audit } from '@/lib/audit'
import { actorIdOf, hasPermission } from '@/lib/access'

const ORDER_TRANSITIONS: Record<string, string[]> = {
  OSNUTEK: ['POSLANO', 'POTRJENO', 'PREKlicANO'],
  POSLANO: ['POTRJENO', 'DOBLJENO', 'PREKlicANO'],
  POTRJENO: ['DOBLJENO', 'PREKlicANO'],
  DOBLJENO: [],
  PREKlicANO: [],
}

// GET — naročila (z option projectId). Branje: vsi poslovni principalci.
export async function GET(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  // R126 (issue #5 §3): naročila razkrivajo dobavitelje in cene — to ni del
  // servisne pogodbe MOBILE_SYNC (matrika v access.ts). Prej je vsak API
  // ključ lahko prebral vsa naročila z postavkami zaloge.
  if (auth.kind === 'apikey') {
    return forbidden('Naročila so poslovni podatki — API ključ nima dostopa.')
  }
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')

    const orders = await db.materialOrder.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        supplier: true,
        project: { select: { nazivProjekta: true, customer: { select: { ime: true } } } },
        items: { include: { inventory: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(orders)
  } catch (error) {
    console.error('Material Orders GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju naročil' }, { status: 500 })
  }
}

// POST — ustvari naročilo (iz BOM draft-a ali ročno) — samo vodstvo.
export async function POST(request: Request) {
  // Spreminjanje cen, zalog, naročil in razporedov je vodstveno opravilo.
  // Monter bere (za delo na terenu), pisati pa ne sme.
  const denied = await denyWithoutPermission(request, 'procurement.create')
  if (denied) return denied
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const actor = actorIdOf(auth)
  try {
    const body = await request.json()
    const { projectId, supplierId, items, opombe } = body as {
      projectId?: string
      supplierId: string
      items: Array<{ inventoryId: string; kolicina: number; cena?: number }>
      opombe?: string
    }

    if (!supplierId || !items || items.length === 0) {
      return NextResponse.json({ error: 'supplierId in items so obvezni' }, { status: 400 })
    }

    // R136 (§18): količina > 0 in cena >= 0 — prej sta nevalidni vrednosti
    // (npr. 0, -5, NaN) prišle do DB CHECK (order_item_quantity_positive) kot
    // surov 500. Jasna 400 z elementom je pogodba za klienta (fail-closed,
    // brez ugibanja, katere postavka je pokvarjena).
    for (const [i, item] of items.entries()) {
      const kol = Number(item.kolicina)
      if (!Number.isFinite(kol) || kol <= 0) {
        return NextResponse.json(
          { error: `Količina postavke ${i + 1} mora biti pozitivno število.` },
          { status: 400 },
        )
      }
      if (item.cena !== undefined && (!Number.isFinite(Number(item.cena)) || Number(item.cena) < 0)) {
        return NextResponse.json(
          { error: `Cena postavke ${i + 1} ne sme biti negativna.` },
          { status: 400 },
        )
      }
    }

    // Pridobi trenutne cene + inventory podatke
    const inventoryIds = items.map((i) => i.inventoryId)
    const inventories = await db.inventory.findMany({ where: { id: { in: inventoryIds } } })

    // R136: neznani inventoryId pade na FK kot surov 500 — jasna 400 z
    // seznamom problematičnih ID-jev je deterministična pogodba.
    const neznani = inventoryIds.filter((id) => !inventories.some((inv) => inv.id === id))
    if (neznani.length > 0) {
      return NextResponse.json(
        { error: 'Nekateri materiali ne obstajajo.', neznaniId: neznani },
        { status: 400 },
      )
    }

    const prices = await db.materialPrice.findMany({
      where: { inventoryId: { in: inventoryIds }, supplierId, veljavnostDo: null },
    })

    // Pripravi postavke naročila
    const orderItems = items.map((item) => {
      const inv = inventories.find((i) => i.id === item.inventoryId)
      const price = prices.find((p) => p.inventoryId === item.inventoryId)
      const cena = Number(item.cena || price?.cena || 0)
      return {
        inventoryId: item.inventoryId,
        kolicina: Number(item.kolicina),
        cena,
        naziv: inv?.naziv || 'Neznan material',
        enota: inv?.enota || 'kos',
      }
    })

    const skupajCena = orderItems.reduce((sum, i) => sum + i.cena * i.kolicina, 0)

    // Naročilo + audit = ENA transakcija (issue #4, §13)
    const order = await db.$transaction(async (tx) => {
      const created = await tx.materialOrder.create({
        data: {
          projectId: projectId || null,
          supplierId,
          skupajCena,
          opombe: opombe || null,
          status: 'OSNUTEK',
          items: { create: orderItems },
        },
        include: {
          supplier: true,
          items: { include: { inventory: true } },
        },
      })

      if (projectId) {
        await auditInTx(tx, {
          request,
          session: auth.kind === 'user' ? auth.session : null,
          userId: actor,
          projectId,
          akcija: 'MATERIAL_ORDER_CREATED',
          newValue: { orderId: created.id, supplierId, skupajCena, items: orderItems.length },
        })
      }
      return created
    })

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    console.error('Material Orders POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju naročila' }, { status: 500 })
  }
}

// PATCH — spremeni status naročila (statusni stroj + idempotenten prejem).
// §10 (R135): statusni stroj = procurement.approve (vodstvo); skladišče sme
// SAMO prejem (status → DOBLJENO, "prejem je skladiščna operacija").
export async function PATCH(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const actor = actorIdOf(auth)
  // R126 (issue #5 §3): API ključ NI manager — prej je smel spreminjati
  // naročila (nasprotno matriki: "administracija zaloge" je nedovoljeno).
  const canApprove = hasPermission(auth, 'procurement.approve')
  const canReceive = hasPermission(auth, 'procurement.receive')
  if (!canApprove && !canReceive) {
    return forbidden('Sprememba naročil je pravica vodstva (procurement.approve); skladišče sme samo prejem (procurement.receive).')
  }
  try {
    const body = await request.json()
    const { id, status } = body as { id?: string; status?: string; datumDobave?: string }

    if (!id || !status) {
      return NextResponse.json({ error: 'id in status sta obvezna' }, { status: 400 })
    }

    if (!canApprove && status !== 'DOBLJENO') {
      return forbidden('Skladišče lahko naročilo samo prejme (DOBLJENO) — ostale prehode ureja vodstvo (procurement.approve).')
    }

    const existing = await db.materialOrder.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Naročilo ne obstaja' }, { status: 404 })
    }

    // Statusni stroj (issue #4, §7) — prehod mora biti dovoljen.
    const allowed = ORDER_TRANSITIONS[existing.status] ?? []
    if (status !== existing.status && !allowed.includes(status)) {
      return NextResponse.json(
        {
          error: `Neveljaven prehod statusa: ${existing.status} → ${status} (dovoljeni: ${allowed.join(', ') || '—'})`,
        },
        { status: 409 }
      )
    }

    // Prejem materiala — idempotentna transakcijska pot (issue #4, §5).
    if (status === 'DOBLJENO') {
      const result = await receiveOrder(id, actor)
      const updated = await db.materialOrder.findUnique({
        where: { id },
        include: { supplier: true, items: { include: { inventory: true } } },
      })
      await audit({
        request,
        session: auth.kind === 'user' ? auth.session : null,
        userId: actor,
        projectId: existing.projectId,
        akcija: result.alreadyReceived ? 'MATERIAL_RECEIPT_DUPLICATE' : 'MATERIAL_RECEIPT',
        oldValue: existing.status,
        newValue: 'DOBLJENO',
      })
      return NextResponse.json({ ...updated, alreadyReceived: result.alreadyReceived })
    }

    const updated = await db.materialOrder.update({
      where: { id },
      data: { status },
      include: { supplier: true, items: true },
    })

    await audit({
      request,
      session: auth.kind === 'user' ? auth.session : null,
      userId: actor,
      projectId: existing.projectId,
      akcija: 'MATERIAL_ORDER_STATUS',
      oldValue: existing.status,
      newValue: status,
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof StockError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Material Orders PATCH Error:', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju naročila' }, { status: 500 })
  }
}
