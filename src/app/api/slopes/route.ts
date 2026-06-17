// Roksal Field - API: Nagibi (inclinometer meritve)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Nagibi za projekt
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }
    const slopes = await db.slope.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(slopes)
  } catch (error) {
    console.error('Slopes GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju nagibov' }, { status: 500 })
  }
}

// POST - Zapiši meritev nagiba
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const slope = await db.slope.create({
      data: {
        projectId: body.projectId,
        kotStopinje: body.kotStopinje,
        smer: body.smer ?? null,
        lokacija: body.lokacija ?? null,
      },
    })
    return NextResponse.json(slope, { status: 201 })
  } catch (error) {
    console.error('Slopes POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri zapisu nagiba' }, { status: 500 })
  }
}
