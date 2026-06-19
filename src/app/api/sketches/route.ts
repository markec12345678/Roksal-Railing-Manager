// Roksal Field - API: Skice (ročno risanje)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Skice za projekt
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }
    const sketches = await db.sketch.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(sketches)
  } catch (error) {
    console.error('Sketches GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju skic' }, { status: 500 })
  }
}

// POST - Shrani skico
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const sketch = await db.sketch.create({
      data: {
        projectId: body.projectId,
        naziv: body.naziv ?? `Skica ${new Date().toLocaleDateString('sl-SI')}`,
        pngData: body.pngData,
        povzetek: body.povzetek ?? null,
      },
    })
    return NextResponse.json(sketch, { status: 201 })
  } catch (error) {
    console.error('Sketches POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri shranjevanju skice' }, { status: 500 })
  }
}

// DELETE - Izbriši skico
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id je obvezen' }, { status: 400 })
    await db.sketch.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Sketches DELETE Error:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju skice' }, { status: 500 })
  }
}
