// Roksal Field - API: Cene materiala pri dobaviteljih (V5)
// Pricing intelligence — primerjava cen, najcenejši dobavitelj
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET — cene materiala (z option za primerjavo dobaviteljev)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const inventoryId = searchParams.get('inventoryId')
    const supplierId = searchParams.get('supplierId')
    const primerno = searchParams.get('primerjaj') === 'true' // najboljše cene per material

    if (primerno && inventoryId) {
      // Primerjaj cene enega materiala pri vseh dobaviteljih
      const prices = await db.materialPrice.findMany({
        where: { inventoryId, veljavnostDo: null },
        include: { supplier: true },
        orderBy: { cena: 'asc' },
      })
      const najboljsa = prices[0] || null
      return NextResponse.json({ prices, najboljsa, razlika: prices.length > 1 ? prices[0].cena - prices[prices.length - 1].cena : 0 })
    }

    const where = {
      ...(inventoryId ? { inventoryId } : {}),
      ...(supplierId ? { supplierId } : {}),
      veljavnostDo: null, // samo trenutno veljavne
    }

    const prices = await db.materialPrice.findMany({
      where,
      include: { inventory: true, supplier: true },
      orderBy: { createdAt: 'desc' },
    })

    // Najboljše cene per material (za pricing optimization)
    if (!inventoryId && !supplierId) {
      const byMaterial = new Map<string, { inventoryId: string; inventory: unknown; bestPrice: number; bestSupplier: string; suppliers: number }>()
      for (const p of prices) {
        const existing = byMaterial.get(p.inventoryId)
        if (!existing || p.cena < existing.bestPrice) {
          byMaterial.set(p.inventoryId, {
            inventoryId: p.inventoryId,
            inventory: p.inventory,
            bestPrice: p.cena,
            bestSupplier: p.supplier.naziv,
            suppliers: (existing?.suppliers || 0) + 1,
          })
        } else if (existing) {
          existing.suppliers += 1
        }
      }
      return NextResponse.json({
        prices,
        bestPerMaterial: Array.from(byMaterial.values()),
      })
    }

    return NextResponse.json(prices)
  } catch (error) {
    console.error('Material Prices GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju cen' }, { status: 500 })
  }
}

// POST — dodaj/posodobi ceno materiala pri dobavitelju
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { inventoryId, supplierId, cena, opomba } = body

    if (!inventoryId || !supplierId || cena === undefined) {
      return NextResponse.json({ error: 'inventoryId, supplierId, cena so obvezni' }, { status: 400 })
    }

    // Zapri prejšnjo veljavno ceno
    await db.materialPrice.updateMany({
      where: { inventoryId, supplierId, veljavnostDo: null },
      data: { veljavnostDo: new Date() },
    })

    // Ustvari novo ceno
    const price = await db.materialPrice.create({
      data: {
        inventoryId,
        supplierId,
        cena: parseFloat(cena),
        opomba: opomba || null,
      },
      include: { inventory: true, supplier: true },
    })

    return NextResponse.json(price, { status: 201 })
  } catch (error) {
    console.error('Material Prices POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri shranjevanju cene' }, { status: 500 })
  }
}
