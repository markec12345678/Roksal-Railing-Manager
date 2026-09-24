// Roksal Field - API: Slike projekta (pred/med/po montaži)
// ---------------------------------------------------------------------------
// R120 (cross-project IDOR): prej je ruta preverila SAMO avtentikacijo — vsak
// prijavljen principal je lahko bral/pisal/brisan slike ZA KATERIKOLI projekt
// (IDOR). Zdaj velja resource authorization:
//
//   GET    → 'read'    (videti projekt = videti njegove slike)
//   POST   → 'read'    (nalaganje fotodokumentacije je TERENSKO dejanje, ne
//                       poslovno — mora delovati tudi na dealLocked projektu,
//                       kjer se montaža dejansko izvaja; monter je po 'read'
//                       vseeno omejen na svoje projekte)
//   DELETE → 'update'  (brisanje je destruktivno — deal-lock ga zavre)
//
// Servisni principal MOBILE_SYNC: read/update po matriki v src/lib/access.ts
// (fotodokumentacija je izrazita servisna pravica; delete NI).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { assertProjectAccess, AccessDeniedError } from '@/lib/access'

/** Zavij resource napake v 403/404 odgovor (politika: 404 ne obstaja, 403 prepovedano). */
function accessErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof AccessDeniedError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  return null
}

// GET - Slike za projekt (opcionalno filter po kategoriji)
export async function GET(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const kategorija = searchParams.get('kategorija') // PRED | MED | PO

    if (!projectId) {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, monterId: true, vodjaId: true, dealLocked: true },
    })
    assertProjectAccess(auth, project, 'read')

    const photos = await db.projectPhoto.findMany({
      where: {
        projectId,
        ...(kategorija ? { kategorija } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(photos)
  } catch (error) {
    const denied = accessErrorResponse(error)
    if (denied) return denied
    console.error('Photos GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju slik' }, { status: 500 })
  }
}

// POST - Shrani sliko (base64 + kategorija + GPS)
export async function POST(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const body = await request.json()
    const kat = body.kategorija ?? 'MED'
    if (!['PRED', 'MED', 'PO'].includes(kat)) {
      return NextResponse.json({ error: 'kategorija mora biti PRED, MED ali PO' }, { status: 400 })
    }
    if (!body.projectId || typeof body.projectId !== 'string') {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }

    const project = await db.project.findUnique({
      where: { id: body.projectId },
      select: { id: true, monterId: true, vodjaId: true, dealLocked: true },
    })
    assertProjectAccess(auth, project, 'read')

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
    const denied = accessErrorResponse(error)
    if (denied) return denied
    console.error('Photos POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri shranjevanju slike' }, { status: 500 })
  }
}

// DELETE - Izbriši sliko
export async function DELETE(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id je obvezen' }, { status: 400 })

    const photo = await db.projectPhoto.findUnique({
      where: { id },
      select: { projectId: true },
    })
    if (!photo) return NextResponse.json({ error: 'Slika ne obstaja' }, { status: 404 })

    const project = await db.project.findUnique({
      where: { id: photo.projectId },
      select: { id: true, monterId: true, vodjaId: true, dealLocked: true },
    })
    assertProjectAccess(auth, project, 'update')

    await db.projectPhoto.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    const denied = accessErrorResponse(error)
    if (denied) return denied
    console.error('Photos DELETE Error:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju slike' }, { status: 500 })
  }
}
