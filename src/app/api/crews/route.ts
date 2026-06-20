// Roksal Field - API: Crews + Equipment (V6)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET — ekipe ali oprema (glede na ?type=crew|equipment)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'crew'

    if (type === 'equipment') {
      const equipment = await db.equipment.findMany({
        include: { _count: { select: { assignments: true } } },
        orderBy: { naziv: 'asc' },
      })
      return NextResponse.json(equipment)
    }

    // crews
    const crews = await db.crew.findMany({
      where: { aktivna: true },
      include: {
        _count: { select: { members: true, schedules: true } },
        vodja: { select: { ime: true } },
      },
      orderBy: { naziv: 'asc' },
    })
    return NextResponse.json(crews)
  } catch (error) {
    console.error('Crews GET Error:', error)
    return NextResponse.json({ error: 'Napaka' }, { status: 500 })
  }
}

// POST — ustvari ekipo ali opremo
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const type = body.type || 'crew'

    if (type === 'equipment') {
      const eq = await db.equipment.create({
        data: {
          naziv: body.naziv,
          tip: body.tip || 'OSTALO',
          sifra: body.sifra || null,
          lokacija: body.lokacija || null,
          opomba: body.opomba || null,
        },
      })
      return NextResponse.json(eq, { status: 201 })
    }

    // crew
    const crew = await db.crew.create({
      data: {
        naziv: body.naziv,
        vodjaId: body.vodjaId || null,
        barva: body.barva || '#1d2b3e',
      },
    })
    return NextResponse.json(crew, { status: 201 })
  } catch (error) {
    console.error('Crews POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju' }, { status: 500 })
  }
}
