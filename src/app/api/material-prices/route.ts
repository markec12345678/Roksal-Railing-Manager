// Roksal Field - API: Cene materiala pri dobaviteljih (V5)
// Pricing intelligence — primerjava cen, najcenejši dobavitelj
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { denyWithoutPermission } from '@/lib/auth'

// GET — cene materiala (z option za primerjavo dobaviteljev)
export async function GET(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
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
  // Spreminjanje cen, zalog, naročil in razporedov je vodstveno opravilo.
  // Monter bere (za delo na terenu), pisati pa ne sme.
  const denied = await denyWithoutPermission(request, 'price.override')
  if (denied) return denied
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const body = await request.json()
    const { inventoryId, supplierId, cena, opomba } = body

    if (!inventoryId || !supplierId || cena === undefined) {
      return NextResponse.json({ error: 'inventoryId, supplierId, cena so obvezni' }, { status: 400 })
    }

    // R136 (§18): cena mora biti končno število >= 0 — DB CHECK (price_nonnegative)
    // bi sicer vrnil surov P2010; jasna 400 s slovenskim sporočilom je pogodba.
    const cenaSt = typeof cena === 'string' ? Number(cena.replace(',', '.')) : Number(cena)
    if (!Number.isFinite(cenaSt) || cenaSt < 0) {
      return NextResponse.json({ error: 'Cena mora biti neznegativno število.' }, { status: 400 })
    }

    // R136 (§19): zapri prejšnjo ceno + ustvari novo v ENI transakciji.
    // Prej sta bila dva ločena write-a — crash/vstavljanje med njima bi pustil
    // DVE odprti ceni za isti par (material, dobavitelj), kar je hkrati edini
    // možen kršitelj EXCLUDE omejitve material_price_no_overlap (§18).
    //
    // GREATEST(veljavnostOd, zdaj): če je ura aplikacije za urnikom baze
    // (razpeljeno deployanje/vm), bi veljavnostDo < veljavnostOd ustvarilo
    // NEVELJAVEN range (PostgreSQL 22000) → EXCLUDE transakcija bi padla.
    // GREATEST zagotovi veljaven interval tudi pri odmiku ur.
    const zapriOb = new Date()
    const price = await db.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`UPDATE "MaterialPrice"
          SET "veljavnostDo" = GREATEST("veljavnostOd", ${zapriOb}::timestamp)
          WHERE "inventoryId" = ${inventoryId} AND "supplierId" = ${supplierId} AND "veljavnostDo" IS NULL`,
      )
      return tx.materialPrice.create({
        data: {
          inventoryId,
          supplierId,
          cena: cenaSt,
          opomba: opomba || null,
        },
        include: { inventory: true, supplier: true },
      })
    })

    return NextResponse.json(price, { status: 201 })
  } catch (error) {
    console.error('Material Prices POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri shranjevanju cene' }, { status: 500 })
  }
}
