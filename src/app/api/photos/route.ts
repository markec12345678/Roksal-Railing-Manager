// Roksal Field - API: Slike projekta (pred/med/po montaži)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Slike za projekt (opcionalno filter po kategoriji)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const kategorija = searchParams.get('kategorija') // PRED | MED | PO

    if (!projectId) {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }

    const photos = await db.projectPhoto.findMany({
      where: {
        projectId,
        ...(kategorija ? { kategorija } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(photos)
  } catch (error) {
    console.error('Photos GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju slik' }, { status: 500 })
  }
}

// POST - Shrani sliko (base64 + kategorija + GPS)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const kat = body.kategorija ?? 'MED'
    if (!['PRED', 'MED', 'PO'].includes(kat)) {
      return NextResponse.json({ error: 'kategorija mora biti PRED, MED ali PO' }, { status: 400 })
    }

    const photo = await db.projectPhoto.create({
      data: {
        projectId: body.projectId,
        kategorija: kat,
        imageData: body.imageData,
        opomba: body.opomba ?? null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
      },
    })
    return NextResponse.json(photo, { status: 201 })
  } catch (error) {
    console.error('Photos POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri shranjevanju slike' }, { status: 500 })
  }
}

// DELETE - Izbriši sliko
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id je obvezen' }, { status: 400 })
    await db.projectPhoto.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Photos DELETE Error:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju slike' }, { status: 500 })
  }
}
