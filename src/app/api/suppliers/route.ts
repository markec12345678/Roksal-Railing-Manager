// Roksal Field - API: Dobavitelji (V5)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET — vsi dobavitelji (z številom cen in naročil)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const aktivni = searchParams.get('aktivne') !== 'false'

    const suppliers = await db.supplier.findMany({
      where: aktivni ? { aktivna: true } : {},
      include: {
        _count: { select: { materialPrices: true, orders: true } },
      },
      orderBy: { naziv: 'asc' },
    })
    return NextResponse.json(suppliers)
  } catch (error) {
    console.error('Suppliers GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju dobaviteljev' }, { status: 500 })
  }
}

// POST — ustvari dobavitelja
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supplier = await db.supplier.create({
      data: {
        naziv: body.naziv,
        kontakt: body.kontakt || null,
        email: body.email || null,
        telefon: body.telefon || null,
        naslov: body.naslov || null,
        iban: body.iban || null,
        dobavniRok: body.dobavniRok ?? 7,
        popust: body.popust ?? 0,
      },
    })
    return NextResponse.json(supplier, { status: 201 })
  } catch (error) {
    console.error('Suppliers POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju dobavitelja' }, { status: 500 })
  }
}

// PATCH — posodobi dobavitelja
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, ...data } = body
    if (!id) return NextResponse.json({ error: 'id je obvezen' }, { status: 400 })
    const updated = await db.supplier.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Suppliers PATCH Error:', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju' }, { status: 500 })
  }
}

// DELETE — izklopi dobavitelja (ne izbriše)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id je obvezen' }, { status: 400 })
    await db.supplier.update({ where: { id }, data: { aktivna: false } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Suppliers DELETE Error:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju' }, { status: 500 })
  }
}
