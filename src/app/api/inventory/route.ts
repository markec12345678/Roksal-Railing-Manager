// Roksal Field - API: Zaloga in inventar — S+9 (issue #4, §4)
// Vsak premik zaloge gre skozi transakcijski StockLedger (delta + balanceAfter
// v ENI transakciji). Združljivost: stari tipi premikov (PORABA/DOPOLNITEV/ODPIS)
// se preslikajo v ledger dogodke (ISSUE/PURCHASE/WASTE).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createInventorySchema, inventoryMovementSchema } from '@/lib/validations'
import { authenticate, unauthorized, forbidden, denyWithoutPermission } from '@/lib/auth'
import { recordMovement, StockError } from '@/lib/inventory'
import { creditLotInTx } from '@/lib/lots'
import { hasPermission, actorIdOf } from '@/lib/access'
import { queueNotifications } from '@/lib/notifications'
import { decToPlain } from '@/lib/decimal-policy'
import { veljavajKonverzijoZaZapis, UnitsError } from '@/lib/units'
import { correlationFromRequest } from '@/lib/correlation'
import type { StockLedgerEventType } from '@prisma/client'

import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'
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
      // R380 (§12): Decimal → number na DTO meji (kolicinaZaloga,
      // minimalnaZaloga, ledger kolicina/balanceAfter, konverzija …).
      return NextResponse.json(decToPlain({ inventory: item, ledger }))
    }

    const inventory = await db.inventory.findMany({
      include: {
        usages: { take: 5, orderBy: { datumVpisa: 'desc' } },
        movements: { take: 10, orderBy: { createdAt: 'desc' } },
        // R221 — števec zasidranj pri dobaviteljih (MaterialPrice po artikel):
        // EN VIR za čip/paleto 'brez dobavitelja' (=== 0 → nihče ni vpisan).
        // Štetje VSEH vrstic (tudi pretečenih) — čip pove 'brez VPISANE
        // cene'; pretečena cena je še vedno zasidran dobavitelj (iskreno).
        _count: { select: { usages: true, movements: true, prices: true } },
      },
      orderBy: { naziv: 'asc' },
    })

    return NextResponse.json(decToPlain(inventory))
  } catch (error) {
    console.error('Inventory GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju zaloge' }, { status: 500 })
  }
}

// POST - Ustvari novo inventarno postavko ali zabeleži premik
export async function POST(request: Request) {
  // R191 — val 2 omejevanja hitrosti na pisanju (WRITE_LIMIT, kind `write`)
  const zavrnjeno = zapisOmejitev(request, 'inventory')
  if (zavrnjeno) return zavrnjeno

  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const correlationId = correlationFromRequest(request)
  try {
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const body = telo.telo

    if (body.tipPremika) {
      // §10 (R135): premik zaloge = konkretno dovoljenje inventory.write
      // (vodstvo + skladišče; monter bere, ne piše; API ključ ne upravlja zaloge).
      if (!hasPermission(auth, 'inventory.write')) {
        return forbidden('Premike zaloge beležita vodstvo ali skladišče (pravica inventory.write).')
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

      // R380 (§12): obe polji sta Decimal — RELACIJSKA primerjava Decimal <
      // Decimal v JS gre prek valueOf() → STRING primerjava ("5" < "10" =
      // false!). Prehod v number (3dp izgube ni) je EDINI varni način.
      if (updated.kolicinaZaloga.toNumber() < updated.minimalnaZaloga.toNumber()) {
        // R143 (§29): obvestilo gre skozi dispatcher (QUEUED → SENT → …) —
        // predloga LOW_STOCK v1, naslovljeno na VLOGO SKLADISCE (prej pseudo-
        // uporabnik 'skladisce', ki ga nobena seja ne ujame), z entiteto in
        // korelacijo. Vedenjska pariteta: ena vrstica na premik pod minimumom.
        await queueNotifications({
          template: 'LOW_STOCK',
          naslov: `Nizka zaloga: ${updated.naziv}`,
          sporocilo: `Zaloga za "${updated.naziv}" (${updated.sifraMateriala}) je padla na ${updated.kolicinaZaloga} ${updated.enota}.`,
          recipients: [{ recipientRole: 'SKLADISCE' }],
          entity: { type: 'inventory', id: updated.id },
          correlationId,
        })
      }

      return NextResponse.json(decToPlain({ balanceAfter, inventory: updated }), { status: 201 })
    } else {
      // Nova inventarna postavka = master podatek kataloga (vodstvo).
      const denied = await denyWithoutPermission(request, 'catalog.manage')
      if (denied) return denied
      const validated = createInventorySchema.parse(body)
      const actor = actorIdOf(auth)

      // R380 (§12) — konverzija enot: FAIL-CLOSED validacija kanona
      // (EXACT 'm²' ≠ 'm2'; pozitivni faktorji; preciznost 0–6; nabor
      // GORI/DOL/NAJBLIŽJE). Neveljaven zapis → javna 400 s seznamom.
      let konverzija
      try {
        konverzija = veljavajKonverzijoZaZapis(validated)
      } catch (e) {
        if (e instanceof UnitsError) {
          return NextResponse.json({ error: e.message }, { status: e.suggestedStatus })
        }
        throw e
      }

      // Artikel + OPENING ledger dogodek + ustanovitvena ŠARŽA (§24) = ENA transakcija.
      const item = await db.$transaction(async (tx) => {
        const created = await tx.inventory.create({
          data: {
            sifraMateriala: validated.sifraMateriala,
            naziv: validated.naziv,
            tip: validated.tip,
            kolicinaZaloga: validated.kolicinaZaloga,
            enota: validated.enota,
            minimalnaZaloga: validated.minimalnaZaloga,
            // R380 (§12): validirana konverzija (veljavna polja ali NULL).
            purchaseUnit: konverzija.purchaseUnit,
            stockUnit: konverzija.stockUnit,
            consumptionUnit: konverzija.consumptionUnit,
            supplierPackSize: konverzija.supplierPackSize,
            conversionFactor: konverzija.conversionFactor,
            precision: konverzija.precision,
            rounding: konverzija.rounding,
          }
        })
        if (validated.kolicinaZaloga > 0) {
          // R144 (§24): ustanovitvena zaloga = šarža z neznanim poreklom
          // (iskreno — brez izmišljanja dobavitelja/cene). FIFO jo postavi
          // prvo (deliveryDate = kreacija artikla).
          const lot = await creditLotInTx(tx, {
            inventoryId: created.id,
            kolicina: validated.kolicinaZaloga,
            note: 'Ustanovitvena zaloga (poreklo neznano)',
          })
          await tx.stockLedger.create({
            data: {
              inventoryId: created.id,
              eventType: 'OPENING',
              kolicina: validated.kolicinaZaloga,
              enota: validated.enota,
              balanceAfter: validated.kolicinaZaloga,
              actorId: actor,
              reason: 'Ustanovitvena zaloga',
              lotId: lot.id,
            },
          })
        }
        return created
      })
      return NextResponse.json(decToPlain(item), { status: 201 })
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
