// Roksal Field - API: Zaloga in inventar — S+9 (issue #4, §4)
// Vsak premik zaloge gre skozi transakcijski StockLedger (delta + balanceAfter
// v ENI transakciji). Združljivost: stari tipi premikov (PORABA/DOPOLNITEV/ODPIS)
// se preslikajo v ledger dogodke (ISSUE/PURCHASE/WASTE).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createInventorySchema, inventoryMovementSchema } from '@/lib/validations'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { MANAGER_ROLES, denyUnless } from '@/lib/auth'
import { recordMovement, StockError } from '@/lib/inventory'
import { canManageInventory, actorIdOf } from '@/lib/access'
import type { StockLedgerEventType } from '@prisma/client'

/** Stari UI tipi → ledger dogodki (združljivost z obstoječim klientom). */
function mapEventType(tip: string): StockLedgerEventType {
  switch (tip) {
    case 'PORABA':
      return 'ISSUE'
    case 'DOPOLNITEV':
      return 'PURCHASE'
    case 'ODPIS':
      return 'WASTE'
    case 'ISSUE':
    case 'PURCHASE':
    case 'RECEIPT':
    case 'RETURN':
    case 'RESERVATION':
    case 'RELEASE':
    case 'WASTE':
    case 'DAMAGE':
    case 'ADJUSTMENT':
    case 'PROJECT_ALLOCATION':
      return tip as StockLedgerEventType
    default:
      throw new StockError(400, `Neznan tip premika: ${tip}`)
  }
}

// GET - Pridobi celotno zalogo s statusi (+ ledger sled po artikel: ?inventoryId=)
export async function GET(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const inventoryId = searchParams.get('inventoryId')
    const withLedger = searchParams.get('ledger') === '1'

    if (withLedger && inventoryId) {
      const [item, ledger] = await Promise.all([
        db.inventory.findUnique({ where: { id: inventoryId } }),
        db.stockLedger.findMany({
          where: { inventoryId },
          orderBy: { createdAt: 'desc' },
          take: 200,
        }),
      ])
      if (!item) {
        return NextResponse.json({ error: 'Artikel ne obstaja' }, { status: 404 })
      }
      return NextResponse.json({ inventory: item, ledger })
    }

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
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const body = await request.json()

    if (body.tipPremika) {
      // Premik zaloge: vodstvo + skladišče (monter bere, ne piše).
      if (!canManageInventory(auth)) {
        return forbidden('Premike zaloge beležita vodstvo ali skladišče.')
      }
      const validated = inventoryMovementSchema.parse(body)
      const eventType = mapEventType(validated.tipPremika)
      const actor = actorIdOf(auth)

      // Transakcijski ledger: dogodek + bilanca + movement = ENA transakcija.
      const balanceAfter = await recordMovement({
        inventoryId: validated.inventoryId,
        eventType,
        kolicina: validated.kolicina,
        projectId: validated.projectId ?? null,
        actorId: actor,
        reason: `Ročni premik (${validated.tipPremika})`,
      })

      const updated = await db.inventory.findUniqueOrThrow({
        where: { id: validated.inventoryId },
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

      return NextResponse.json({ balanceAfter, inventory: updated }, { status: 201 })
    } else {
      // Nova inventarna postavka = vodstvena odločitev.
      const denied = await denyUnless(request, MANAGER_ROLES)
      if (denied) return denied
      const validated = createInventorySchema.parse(body)
      const actor = actorIdOf(auth)

      // Artikel + OPENING ledger dogodek = ENA transakcija.
      const item = await db.$transaction(async (tx) => {
        const created = await tx.inventory.create({
          data: {
            sifraMateriala: validated.sifraMateriala,
            naziv: validated.naziv,
            tip: validated.tip,
            kolicinaZaloga: validated.kolicinaZaloga,
            enota: validated.enota,
            minimalnaZaloga: validated.minimalnaZaloga,
          }
        })
        if (validated.kolicinaZaloga > 0) {
          await tx.stockLedger.create({
            data: {
              inventoryId: created.id,
              eventType: 'OPENING',
              kolicina: validated.kolicinaZaloga,
              enota: validated.enota,
              balanceAfter: validated.kolicinaZaloga,
              actorId: actor,
              reason: 'Ustanovitvena zaloga',
            },
          })
        }
        return created
      })
      return NextResponse.json(item, { status: 201 })
    }
  } catch (error: unknown) {
    if (error instanceof StockError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error && typeof error === 'object' && 'issues' in error) {
      return NextResponse.json({ error: 'Neveljavni podatki', details: (error as { issues: unknown }).issues }, { status: 400 })
    }
    console.error('Inventory POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri upravljanju zaloge' }, { status: 500 })
  }
}
