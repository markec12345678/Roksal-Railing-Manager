// Roksal Field - API: Šarže (lot/batch) — R144 (issue #5, §24)
// ---------------------------------------------------------------------------
// GET /api/inventory/lots?inventoryId=…  → šarže artikla (FIFO red) z
// dobaviteljem, nabavno ceno, prejemom in sledjo alokacij (zadnjih 10).
// GET /api/inventory/lots                → zadnje šarže čez artikle (§17 strop).
//
// Bralna ruta: vsak prijavljen uporabnik (vključno MONTER — vzorec /api/
// inventory GET, ki bere zalogo); API ključ DOBI bere (samo-pregled, vzorec
// /api/material-orders §21). Fail-closed: anon → 401 + x-correlation-id (§22).
// §17: minimalni DTO, stropi (100 šarži / 10 alokacij na šaržo).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { correlationFromRequest, CORRELATION_HEADER } from '@/lib/correlation'
import { LOT_STATUS_ACTIVE, LOT_STATUS_EXHAUSTED, LOT_STATUS_CLOSED } from '@/lib/lots'

const MAX_LOTS = 100
const MAX_ALLOCATIONS_PER_LOT = 10

/** Minimalni DTO šarže (§17) — brez internih polj. */
function lotDto(lot: {
  id: string
  lotNumber: string
  deliveryDate: Date
  purchasePrice: number | null
  quantityInitial: number
  quantityRemaining: number
  status: string
  note: string | null
  supplier: { naziv: string } | null
  order: { id: string } | null
  allocations: {
    id: string
    eventType: string
    kolicina: number
    createdAt: Date
    project: { nazivProjekta: string } | null
  }[]
}) {
  return {
    id: lot.id,
    lotNumber: lot.lotNumber,
    dobavitelj: lot.supplier?.naziv ?? null,
    orderId: lot.order?.id ?? null,
    deliveryDate: lot.deliveryDate.toISOString(),
    purchasePrice: lot.purchasePrice,
    quantityInitial: lot.quantityInitial,
    quantityRemaining: lot.quantityRemaining,
    status: lot.status,
    note: lot.note,
    allocations: lot.allocations.map((a) => ({
      id: a.id,
      eventType: a.eventType,
      kolicina: a.kolicina,
      projekt: a.project?.nazivProjekta ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
  }
}

export async function GET(request: Request) {
  const correlationId = correlationFromRequest(request)
  const auth = await authenticate(request)
  if (!auth) {
    // 401 nosi korelacijo (§22 — vzorec dimnih preverb [23]/[25]).
    const res = unauthorized()
    res.headers.set(CORRELATION_HEADER, correlationId)
    return res
  }
  try {
    const { searchParams } = new URL(request.url)
    const inventoryId = searchParams.get('inventoryId')

    if (inventoryId) {
      const article = await db.inventory.findUnique({
        where: { id: inventoryId },
        select: { id: true, naziv: true, enota: true },
      })
      if (!article) {
        return NextResponse.json({ error: 'Artikel ne obstaja' }, { status: 404 })
      }

      // FIFO red — isti determinističen red kot alokacija v src/lib/lots.ts.
      const lots = await db.inventoryLot.findMany({
        where: { inventoryId },
        orderBy: [{ deliveryDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        take: MAX_LOTS,
        include: {
          supplier: { select: { naziv: true } },
          order: { select: { id: true } },
          allocations: {
            orderBy: { createdAt: 'desc' },
            take: MAX_ALLOCATIONS_PER_LOT,
            include: { project: { select: { nazivProjekta: true } } },
          },
        },
      })

      return NextResponse.json({
        inventory: article,
        lots: lots.map(lotDto),
        activeLots: lots.filter((l) => l.status === LOT_STATUS_ACTIVE).length,
        exhaustedLots: lots.filter((l) => l.status === LOT_STATUS_EXHAUSTED).length,
        closedLots: lots.filter((l) => l.status === LOT_STATUS_CLOSED).length,
      })
    }

    // Brez inventoryId: zadnje šarže čez artikle (pregled "od kod je material").
    const lots = await db.inventoryLot.findMany({
      orderBy: { createdAt: 'desc' },
      take: MAX_LOTS,
      include: {
        supplier: { select: { naziv: true } },
        order: { select: { id: true } },
        inventory: { select: { naziv: true, sifraMateriala: true, enota: true } },
        allocations: {
          orderBy: { createdAt: 'desc' },
          take: MAX_ALLOCATIONS_PER_LOT,
          include: { project: { select: { nazivProjekta: true } } },
        },
      },
    })

    return NextResponse.json({
      lots: lots.map((l) => ({
        ...lotDto(l),
        artikel: {
          naziv: l.inventory.naziv,
          sifraMateriala: l.inventory.sifraMateriala,
          enota: l.inventory.enota,
        },
      })),
    })
  } catch (error) {
    console.error('Inventory lots GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju šarž' }, { status: 500 })
  }
}
