// Roksal Field - API: Galerija realizacij
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Galerija (privzeto samo javne, ali vse z ?all=true)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all') === 'true'

    const items = await db.galleryItem.findMany({
      where: all ? {} : { javno: true },
      include: { profil: true, project: { include: { customer: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(items)
  } catch (error) {
    console.error('Gallery GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju galerije' }, { status: 500 })
  }
}

// POST - Dodaj v galerijo
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const item = await db.galleryItem.create({
      data: {
        projectId: body.projectId ?? null,
        profilId: body.profilId ?? null,
        naslov: body.naslov,
        opis: body.opis ?? null,
        lokacija: body.lokacija ?? null,
        slikaPred: body.slikaPred ?? null,
        slikaPo: body.slikaPo ?? null,
        javno: body.javno ?? false,
      },
      include: { profil: true },
    })
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('Gallery POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri dodajanju v galerijo' }, { status: 500 })
  }
}
