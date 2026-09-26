// Roksal Field - API: Nagibi (inclinometer meritve)
// R154 (P1 bug fix — rava dostopa na ravni vira): do zdaj je GET/POST
// preveril SAMO prijavo — vsak avtenticiran uporabnik je lahko BRAL nagibe
// TUJEGA projekta in JIH ZAPISAL na tuj projekt (broken object-level
// authorization). Zdaj isti vrata kot sestrske rute (measurements, sketches,
// photos, documents …): dostop do nagibov = dostop do projekta.
//   • GET  → assertProjectAccess(auth, project, 'read')
//   • POST → assertProjectAccess(auth, project, 'update') — zapis nagiba je
//     mutacija projektne podatkovne zbirke (isti prag kot dodajanje meritve).
// Neznani projectId → 404 (AccessDeniedError), tuj projekt → 403. Nič ni
// zapisano, preden vrata prestanejo (fail-closed red: 400 ZAPE avtentikaciji).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { assertProjectAccess, AccessDeniedError } from '@/lib/access'

// GET - Nagibi za projekt
export async function GET(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }
    // R154: dostop do nagibov = dostop do projekta (404 neznana, 403 tuja).
    const project = await db.project.findUnique({ where: { id: projectId } })
    assertProjectAccess(auth, project, 'read')
    const slopes = await db.slope.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(slopes)
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Slopes GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju nagibov' }, { status: 500 })
  }
}

// POST - Zapiši meritev nagiba
export async function POST(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const body = (await request.json()) as { projectId?: unknown; kotStopinje?: unknown; smer?: unknown; lokacija?: unknown }
    const projectId = typeof body.projectId === 'string' ? body.projectId : ''
    if (!projectId) {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }
    // R154: zapis nagiba = mutacija projekta (isti prag kot meritve POST).
    const project = await db.project.findUnique({ where: { id: projectId } })
    assertProjectAccess(auth, project, 'update')
    const kotStopinje = typeof body.kotStopinje === 'number' ? body.kotStopinje : Number(body.kotStopinje)
    if (!Number.isFinite(kotStopinje)) {
      return NextResponse.json({ error: 'kotStopinje mora biti število' }, { status: 400 })
    }
    const slope = await db.slope.create({
      data: {
        projectId,
        kotStopinje,
        smer: typeof body.smer === 'string' ? body.smer : null,
        lokacija: typeof body.lokacija === 'string' ? body.lokacija : null,
      },
    })
    return NextResponse.json(slope, { status: 201 })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Slopes POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri zapisu nagiba' }, { status: 500 })
  }
}
