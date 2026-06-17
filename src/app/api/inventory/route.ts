// Roksal Field - API: Zaloga in inventar
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createInventorySchema, inventoryMovementSchema } from '@/lib/validations'

// GET - Pridobi celotno zalogo s statusi
export async function GET() {
  try {
    const inventory = await db.inventory.findMany({
      include: {
        usages: { take: 5, orderBy: { datumVpisa: 'desc' } },
        movements: { take: 10, orderBy: { createdAt: 'desc' } },
        _count: { select: { usages: true, movements: true } },
      },
      orderBy: { naziv: 'asc' },
    })

    return NextResponse.json(inventory)
  } catch (error) {
    console.error('Inventory GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju zaloge' }, { status: 500 })
  }
}

// POST - Ustvari novo inventarno postavko ali zabeleži premik
export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (body.tipPremika) {
      const validated = inventoryMovementSchema.parse(body)
      const movement = await db.inventoryMovement.create({
        data: {
          inventoryId: validated.inventoryId,
          projectId: validated.projectId ?? null,
          kolicina: validated.kolicina,
          tipPremika: validated.tipPremika,
        }
      })

      const adjustment = validated.tipPremika === 'DOPOLNITEV' ? validated.kolicina : -validated.kolicina
      const updated = await db.inventory.update({
        where: { id: validated.inventoryId },
        data: { kolicinaZaloga: { increment: adjustment } },
      })

      if (updated.kolicinaZaloga < updated.minimalnaZaloga) {
        await db.notification.create({
          data: {
            userId: 'skladisce',
            naslov: `Nizka zaloga: ${updated.naziv}`,
            sporocilo: `Zaloga za "${updated.naziv}" (${updated.sifraMateriala}) je padla na ${updated.kolicinaZaloga} ${updated.enota}.`,
          }
        })
      }

      return NextResponse.json({ movement, inventory: updated }, { status: 201 })
    } else {
      const validated = createInventorySchema.parse(body)
      const item = await db.inventory.create({
        data: {
          sifraMateriala: validated.sifraMateriala,
          naziv: validated.naziv,
          tip: validated.tip,
          kolicinaZaloga: validated.kolicinaZaloga,
          enota: validated.enota,
          minimalnaZaloga: validated.minimalnaZaloga,
        }
      })
      return NextResponse.json(item, { status: 201 })
    }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'issues' in error) {
      return NextResponse.json({ error: 'Neveljavni podatki', details: (error as { issues: unknown }).issues }, { status: 400 })
    }
    console.error('Inventory POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri upravljanju zaloge' }, { status: 500 })
  }
}
