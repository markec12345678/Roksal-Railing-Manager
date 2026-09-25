// Roksal Field - API: Stranke
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createCustomerSchema } from '@/lib/validations'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { canManageCustomers, actorIdOf, principalBindingOf } from '@/lib/access'
import { escapeLikePattern } from '@/lib/search-access'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import {
  isValidIdempotencyKey,
  reserveIdempotencyIn,
  storeResponseIn,
  beginIdempotency,
  IdempotencyRaceError,
  idempotencyReplayResponse,
  idempotencyConflictResponse,
} from '@/lib/idempotency'

// Meje strani (issue #5 §17): brez parametrov se vedno vrne
// POPOLN seznam (zadržljivost s starimi klienti); z ?limit=&offset=
// pa strani. Strop limit = 500 — patološki vnosi ne morejo vleči
// neomejeno vrstic.
const DEFAULT_LIMIT = 500
const MAX_LIMIT = 500

// GET - Pridobi vse stranke (opcionalno s search queryjem + limit/offset)
export async function GET(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const correlationId = correlationFromRequest(request)
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim() ?? ''

    // R138 (§17): neomejen findMany → privzeta zgornja meja + opcijske
    // strani. Odzivna OBLIKA (polje) ostane ista — mobilni klient ni
    // prelomen. Neveljavne številke → fail-closed na privzeti limit.
    const limitRaw = Number.parseInt(searchParams.get('limit') ?? '', 10)
    const offsetRaw = Number.parseInt(searchParams.get('offset') ?? '', 10)
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(limitRaw, MAX_LIMIT)
        : DEFAULT_LIMIT
    const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0

    // R138: Po migraciji SQLite→PostgreSQL je `contains` postal
    // case-SENSITIVE (SQLite LIKE je bil za ASCII case-insensitive).
    // Iskanje "inox" je nenadoma prenehalo najti "Inox Vijak" — tiho
    // vedenjsko spremembo migracije. Zdaj izrecno mode: 'insensitive'
    // + escape LIKE wildcard znakov (deterministično dobesedno
    // ujemanje, enako vedenju JS .includes()).
    const pattern = escapeLikePattern(search)
    const insensitive = { contains: pattern, mode: 'insensitive' as const }

    const where = search
      ? {
          OR: [
            { ime: insensitive },
            { naslov: insensitive },
            { telefon: insensitive },
            { email: insensitive },
          ],
        }
      : {}

    const customers = await db.customer.findMany({
      where,
      include: {
        _count: { select: { projects: true } },
      },
      orderBy: { ime: 'asc' },
      take: limit,
      skip: offset,
    })

    return NextResponse.json(customers)
  } catch (error) {
    logWithCorrelation('customers.get', correlationId, error)
    return NextResponse.json({ error: 'Napaka pri branju strank', correlationId }, { status: 500 })
  }
}

// POST - Ustvari novo stranko
export async function POST(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  // Stranke ustvarjajo/urejajo uporabniki na terenu; API ključ = servisno branje.
  if (!canManageCustomers(auth)) {
    return forbidden('Stranke ustvarjajo uporabniki (prijava), ne API ključi.')
  }
  const correlationId = correlationFromRequest(request)

  // R139 (issue #5 §20): idempotenca — terenski klient (offline vrsta,
  // src/lib/offline-queue.ts) pošilja stabilen `Idempotency-Key`; retry po
  // mrežni napaki NE SME ustvariti dvojnika stranke (prej: isti ključ ni bil
  // upoštevan → dvakrat "Inox d.o.o." v CRM). Rezervacija + odgovor v ISTI
  // transakciji (exactly-once replay, isti vzorec kot /api/measurements).
  const idemHeader = request.headers.get('Idempotency-Key')
  const idemKey = idemHeader !== null && isValidIdempotencyKey(idemHeader) ? idemHeader : null
  if (idemHeader !== null && !idemKey) {
    return NextResponse.json({ error: 'Neveljaven Idempotency-Key' }, { status: 400 })
  }
  const idemBinding = idemKey ? principalBindingOf(auth) : null

  try {
    const body = await request.json()
    const validated = createCustomerSchema.parse(body)

    // R136 (§19): stranka + revizijski vpis v ENI transakciji. Prej je bila
    // ustvarjanje stranke brez vsakega revizijskega vpisa (vrzel v sledljivosti
    // "critical audit" iz §19) — zdaj CUSTOMER_CREATED z akterjem.
    const newCustomer = await db.$transaction(async (tx) => {
      // R139 (§20): rezervacija idempotenčnega ključa = PRVI stavek — vzporedni
      // poizkus istega ključa povzroči rollback cele transakcije (brez dvojnikov).
      if (idemKey) await reserveIdempotencyIn(tx, idemKey, 'customers', idemBinding)

      const created = await tx.customer.create({
        data: {
          ime: validated.ime.trim(),
          naslov: validated.naslov.trim(),
          telefon: validated.telefon?.trim() || null,
          email: validated.email?.trim() || null,
        },
        include: {
          _count: { select: { projects: true } },
        },
      })
      await tx.auditLog.create({
        data: {
          userId: auth.kind === 'user' ? auth.session.sub : null,
          akcija: 'CUSTOMER_CREATED',
          newValue: JSON.stringify({ customerId: created.id, ime: created.ime, naslov: created.naslov }),
        },
      })

      // R139 (§20): odgovor se shrani v ISTI transakciji — replay vrne
      // originalni 201 z originalnim telesom (exactly-once).
      if (idemKey) await storeResponseIn(tx, idemKey, 201, JSON.stringify(created))

      return created
    })

    return NextResponse.json(newCustomer, { status: 201 })
  } catch (error: unknown) {
    // R139 (§20): P2002 na rezervaciji (vzporedni poizkus istega ključa) →
    // odloči replay/conflict — ISTA odločitev kot /api/measurements.
    if (error instanceof IdempotencyRaceError && idemKey) {
      const begun = await beginIdempotency(idemKey, 'customers', idemBinding)
      if (begun.kind === 'replay') return idempotencyReplayResponse(begun)
      return idempotencyConflictResponse()
    }
    if (error && typeof error === 'object' && 'issues' in error) {
      return NextResponse.json(
        { error: 'Neveljavni podatki', details: (error as { issues: unknown }).issues },
        { status: 400 }
      )
    }
    logWithCorrelation('customers.post', correlationId, error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju stranke', correlationId }, { status: 500 })
  }
}
