// Roksal Field - API: Prejemni zapisnik (punch list / closeout checklist)
// Kontrolni seznam pred predajo projekta: meja/soglasja, montaža, čiščenje, dokumentacija.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticate, unauthorized } from '@/lib/auth'

const createPunchSchema = z.object({
  projectId: z.string().min(1, 'ID projekta je obvezen'),
  naslov: z.string().min(1, 'Naslov točke je obvezen').max(200),
  opomba: z.string().max(500).optional().nullable(),
})

const updatePunchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['open', 'done', 'issue']).optional(),
  opomba: z.string().max(500).nullable().optional(),
  naslov: z.string().min(1).max(200).optional(),
})

export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }
    const items = await db.punchItem.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(items)
  } catch (error) {
    console.error('Punch GET error:', error)
    return NextResponse.json({ error: 'Napaka pri branju zapisnika' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const body = await request.json()
    const validated = createPunchSchema.parse(body)
    const item = await db.punchItem.create({
      data: {
        projectId: validated.projectId,
        naslov: validated.naslov,
        opomba: validated.opomba ?? null,
      },
    })
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Neveljavni podatki' }, { status: 400 })
    }
    console.error('Punch POST error:', error)
    return NextResponse.json({ error: 'Napaka pri shranjevanju točke' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const body = await request.json()
    const validated = updatePunchSchema.parse(body)
    const { id, ...data } = validated
    const item = await db.punchItem.update({ where: { id }, data })
    return NextResponse.json(item)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Neveljavni podatki' }, { status: 400 })
    }
    console.error('Punch PATCH error:', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju točke' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id je obvezen' }, { status: 400 })
    }
    await db.punchItem.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Punch DELETE error:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju točke' }, { status: 500 })
  }
}
