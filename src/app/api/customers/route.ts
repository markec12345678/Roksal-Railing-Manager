// Roksal Field - API: Stranke
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createCustomerSchema } from '@/lib/validations'

// GET - Pridobi vse stranke (opcionalno s search queryjem)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim() ?? ''

    const where = search
      ? {
          OR: [
            { ime: { contains: search } },
            { naslov: { contains: search } },
            { telefon: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {}

    const customers = await db.customer.findMany({
      where,
      include: {
        _count: { select: { projects: true } },
      },
      orderBy: { ime: 'asc' },
    })

    return NextResponse.json(customers)
  } catch (error) {
    console.error('Customers GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju strank' }, { status: 500 })
  }
}

// POST - Ustvari novo stranko
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = createCustomerSchema.parse(body)

    const newCustomer = await db.customer.create({
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
