// Roksal Field - API: Naročila materiala (V5)
// Iz BOM draft → naročilo pri dobavitelju
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET — naročila (z option projectId)
export async function GET(request: Request) {
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

// POST — ustvari naročilo (iz BOM draft-a ali ročno)
export async function POST(request: Request) {
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

    // Pridobi trenutne cene + inventory podatke
    const inventoryIds = items.map((i) => i.inventoryId)
    const inventories = await db.inventory.findMany({ where: { id: { in: inventoryIds } } })
    const prices = await db.materialPrice.findMany({
      where: { inventoryId: { in: inventoryIds }, supplierId, veljavnostDo: null },
    })

    // Pripravi postavke naročila
    const orderItems = items.map((item) => {
      const inv = inventories.find((i) => i.id === item.inventoryId)
      const price = prices.find((p) => p.inventoryId === item.inventoryId)
      const cena = item.cena || price?.cena || 0
      return {
        inventoryId: item.inventoryId,
        kolicina: item.kolicina,
        cena,
        naziv: inv?.naziv || 'Neznan material',
        enota: inv?.enota || 'kos',
      }
    })

    const skupajCena = orderItems.reduce((sum, i) => sum + i.cena * i.kolicina, 0)

    // Ustvari naročilo s postavkami
    const order = await db.materialOrder.create({
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

    // AuditLog
    if (projectId) {
      await db.auditLog.create({
        data: {
          userId: 'system',
          projectId,
          akcija: 'MATERIAL_ORDER_CREATED',
          newValue: JSON.stringify({ orderId: order.id, supplierId, skupajCena, items: orderItems.length }),
        },
      })
    }

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    console.error('Material Orders POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju naročila' }, { status: 500 })
  }
}

// PATCH — spremeni status naročila
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, status, datumDobave } = body

    if (!id || !status) {
      return NextResponse.json({ error: 'id in status sta obvezna' }, { status: 400 })
    }

    const validStatusi = ['OSNUTEK', 'POSLANO', 'POTRJENO', 'DOBLJENO', 'PREKlicANO']
    if (!validStatusi.includes(status)) {
      return NextResponse.json({ error: 'Neveljaven status' }, { status: 400 })
    }

    const updated = await db.materialOrder.update({
      where: { id },
      data: {
        status,
        ...(datumDobave ? { datumDobave: new Date(datumDobave) } : {}),
      },
      include: { supplier: true, items: true },
    })

    // Če je status DOBLJENO — dodaj v zalogo
    if (status === 'DOBLJENO') {
      for (const item of updated.items) {
        await db.inventory.update({
          where: { id: item.inventoryId },
          data: { kolicinaZaloga: { increment: item.kolicina } },
        })
        await db.inventoryMovement.create({
          data: {
            inventoryId: item.inventoryId,
            kolicina: item.kolicina,
            tipPremika: 'DOBAVA',
            orderId: id,
          },
        })
      }
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Material Orders PATCH Error:', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju naročila' }, { status: 500 })
  }
}
