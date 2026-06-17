// Roksal Field - API: AR posnetki (kamera + točke + vizualizacija)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - AR posnetki za projekt
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }

    const snapshots = await db.arSnapshot.findMany({
      where: { projectId },
      include: { profil: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(snapshots)
  } catch (error) {
    console.error('AR Snapshots GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju AR posnetkov' }, { status: 500 })
  }
}

// POST - Shrani AR posnetek
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const snapshot = await db.arSnapshot.create({
      data: {
        projectId: body.projectId,
        profilId: body.profilId ?? null,
        imageUrl: body.imageUrl,
        tocke: JSON.stringify(body.tocke ?? []),
        meritve: body.meritve ? JSON.stringify(body.meritve) : null,
        kalibracija: body.kalibracija ? JSON.stringify(body.kalibracija) : null,
        opombe: body.opombe ?? null,
      },
      include: { profil: true },
    })
    return NextResponse.json(snapshot, { status: 201 })
  } catch (error) {
    console.error('AR Snapshots POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri shranjevanju AR posnetka' }, { status: 500 })
  }
}

// DELETE - Izbriši AR posnetek
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id je obvezen' }, { status: 400 })

    await db.arSnapshot.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('AR Snapshots DELETE Error:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju AR posnetka' }, { status: 500 })
  }
}
