// Roksal Field - API: Prejemni zapisnik (punch list / closeout checklist)
// Kontrolni seznam pred predajo projekta: meja/soglasja, montaža, čiščenje, dokumentacija.
// R155 (P1 bug fix — zaključek IDOR pregleda): do zdaj so VSE operacije
// preverile SAMO prijavo — vsak avtenticiran uporabnik je lahko bral točke
// TUJEGA projekta, jih DODAL, SPREMENIL in celo BRISAL (po id, brez vsakršne
// lastniške preverbe). Zdaj isti vrata kot sestrske rute (skice R120, nagibi
// R154, meritve):
//   • GET           → assertProjectAccess(auth, project, 'read')
//   • POST          → assertProjectAccess(auth, project, 'update')
//   • PATCH/DELETE  → točka → projekt → 'update' (destruktivno — deal-lock zavre;
//                     isti prag kot brisanje skice). Neznana točka → 404.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticate, unauthorized, type AuthContext } from '@/lib/auth'
import { assertProjectAccess, AccessDeniedError, type ProjectRef } from '@/lib/access'

const PROJECT_SELECT = { id: true, monterId: true, vodjaId: true, dealLocked: true } satisfies Record<string, boolean>

function accessErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof AccessDeniedError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  return null
}

/** R155: točka → projekt (vrata 'update' — brisanje/sprememba je mutacija). */
async function gatePunchItem(auth: AuthContext, id: string, access: 'read' | 'update'): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const item = await db.punchItem.findUnique({ where: { id }, select: { projectId: true } })
  if (!item) {
    return { ok: false, response: NextResponse.json({ error: 'Točka ne obstaja' }, { status: 404 }) }
  }
  const project = await db.project.findUnique({ where: { id: item.projectId }, select: PROJECT_SELECT })
  try {
    assertProjectAccess(auth, project as ProjectRef | null, access)
    return { ok: true }
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { ok: false, response: NextResponse.json({ error: error.message }, { status: error.status }) }
    }
    throw error
  }
}

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
    // R155: dostop do zapisnika = dostop do projekta (404 neznana, 403 tuja).
    const project = await db.project.findUnique({ where: { id: projectId }, select: PROJECT_SELECT })
    assertProjectAccess(auth, project as ProjectRef | null, 'read')
    const items = await db.punchItem.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(items)
  } catch (error) {
    const denied = accessErrorResponse(error)
    if (denied) return denied
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
    // R155: dodajanje točke = mutacija projekta; vrata PRED zapisom.
    const project = await db.project.findUnique({ where: { id: validated.projectId }, select: PROJECT_SELECT })
    assertProjectAccess(auth, project as ProjectRef | null, 'update')
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
    const denied = accessErrorResponse(error)
    if (denied) return denied
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
    // R155: sprememba točke = mutacija projekta točke (404 neznana, 403 tuja).
    const gate = await gatePunchItem(auth, id, 'update')
    if (!gate.ok) return gate.response
    const item = await db.punchItem.update({ where: { id }, data })
    return NextResponse.json(item)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Neveljavni podatki' }, { status: 400 })
    }
    const denied = accessErrorResponse(error)
    if (denied) return denied
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
    // R155: brisanje točke = mutacija projekta točke (404 neznana, 403 tuja);
    // deal-lock zavre (isti prag kot brisanje skice).
    const gate = await gatePunchItem(auth, id, 'update')
    if (!gate.ok) return gate.response
    await db.punchItem.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const denied = accessErrorResponse(error)
    if (denied) return denied
    console.error('Punch DELETE error:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju točke' }, { status: 500 })
  }
}
