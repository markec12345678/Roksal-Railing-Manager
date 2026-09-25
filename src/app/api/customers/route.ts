// Roksal Field - API: Stranke
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createCustomerSchema } from '@/lib/validations'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { canManageCustomers, actorIdOf } from '@/lib/access'
import { escapeLikePattern } from '@/lib/search-access'

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
    console.error('Customers GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju strank' }, { status: 500 })
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
  try {
    const body = await request.json()
    const validated = createCustomerSchema.parse(body)

    // R136 (§19): stranka + revizijski vpis v ENI transakciji. Prej je bila
    // ustvarjanje stranke brez vsakega revizijskega vpisa (vrzel v sledljivosti
    // "critical audit" iz §19) — zdaj CUSTOMER_CREATED z akterjem.
    const newCustomer = await db.$transaction(async (tx) => {
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
      return created
    })

    return NextResponse.json(newCustomer, { status: 201 })
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'issues' in error) {
      return NextResponse.json(
        { error: 'Neveljavni podatki', details: (error as { issues: unknown }).issues },
        { status: 400 }
      )
    }
    console.error('Customers POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju stranke' }, { status: 500 })
  }
}
