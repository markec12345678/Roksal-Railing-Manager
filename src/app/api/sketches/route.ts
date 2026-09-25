// Roksal Field - API: Skice (ročno risanje)
// ---------------------------------------------------------------------------
// R120 vzorec (IDOR zaprt): prej je ruta preverila SAMO avtentikacijo —
// prijavljen principal je lahko bral/pisal/brisan skice TUJIH projektov.
//   GET    → 'read'   (skica je del merilne dokumentacije)
//   POST   → 'read'   (terenško dejanje — deluje tudi na dealLocked)
//   DELETE → 'update' (destruktivno — deal-lock zavre)
//
// R121 (object storage, issue #7): bajti skice v object storage
// (files/sketches/<id>/skica.png); DB samo metadata. GET združljivo
// hydrate-a pngData iz shrambe; zapuščinske vrstice vračajo staro pngData.
import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { assertProjectAccess, AccessDeniedError } from '@/lib/access'
import {
  deleteObject,
  getObject,
  objectKey,
  parseDataUri,
  putObject,
} from '@/lib/object-storage'

function accessErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof AccessDeniedError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  return null
}

// R140 (issue #5 §17): skice vodijo težke data URI-je — neomejen findMany bi
// za projektom z mnogo skicami povlekel ogromen odgovor. Privzeti strop 200
// + opcijski limit/offset. Odzivna OBLIKA (polje) ostane ista.
const SKETCH_DEFAULT_LIMIT = 200
const SKETCH_MAX_LIMIT = 200

// GET - Skice za projekt
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

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, monterId: true, vodjaId: true, dealLocked: true },
    })
    assertProjectAccess(auth, project, 'read')

    // R140 (§17): strani — neveljavne številke → fail-closed na privzeti limit.
    const limitRaw = Number.parseInt(searchParams.get('limit') ?? '', 10)
    const offsetRaw = Number.parseInt(searchParams.get('offset') ?? '', 10)
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(limitRaw, SKETCH_MAX_LIMIT)
        : SKETCH_DEFAULT_LIMIT
    const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0

    const rows = await db.sketch.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })
    const sketches = await Promise.all(
      rows.map(async (s) => {
        if (!s.storageKey) return s
        const bytes = await getObject(s.storageKey)
        if (!bytes) return { ...s, pngData: null, storageMissing: true }
        return {
          ...s,
          pngData: `data:${s.mime ?? 'image/png'};base64,${bytes.toString('base64')}`,
        }
      })
    )
    return NextResponse.json(sketches)
  } catch (error) {
    const denied = accessErrorResponse(error)
    if (denied) return denied
    console.error('Sketches GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju skic' }, { status: 500 })
  }
}

// POST - Shrani skico (data URI → object storage + metadata v DB)
export async function POST(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const body = await request.json()
    if (!body.projectId || typeof body.projectId !== 'string') {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }
    if (!body.pngData || typeof body.pngData !== 'string') {
      return NextResponse.json({ error: 'pngData je obvezen' }, { status: 400 })
    }

    const project = await db.project.findUnique({
      where: { id: body.projectId },
      select: { id: true, monterId: true, vodjaId: true, dealLocked: true },
    })
    assertProjectAccess(auth, project, 'read')

    const parsed = parseDataUri(body.pngData)
    if (!parsed) {
      return NextResponse.json(
        { error: 'pngData mora biti veljaven data URI ali base64 (do 15 MB)' },
        { status: 400 }
      )
    }

    const id = randomUUID()
    const key = objectKey('sketches', id, 'skica.png')
    const put = await putObject(key, parsed.bytes, parsed.mime)
    try {
      const sketch = await db.sketch.create({
        data: {
          id,
          projectId: body.projectId,
          naziv: body.naziv ?? `Skica ${new Date().toLocaleDateString('sl-SI')}`,
          storageKey: put.key,
          mime: parsed.mime,
          sizeBytes: put.sizeBytes,
          sha256: put.sha256,
          povzetek: body.povzetek ?? null,
        },
      })
      return NextResponse.json(sketch, { status: 201 })
    } catch (dbError) {
      await deleteObject(key)
      throw dbError
    }
  } catch (error) {
    const denied = accessErrorResponse(error)
    if (denied) return denied
    console.error('Sketches POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri shranjevanju skice' }, { status: 500 })
  }
}

// DELETE - Izbriši skico (DB + artefakt)
export async function DELETE(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id je obvezen' }, { status: 400 })

    const sketch = await db.sketch.findUnique({
      where: { id },
      select: { projectId: true, storageKey: true },
    })
    if (!sketch) return NextResponse.json({ error: 'Skica ne obstaja' }, { status: 404 })

    const project = await db.project.findUnique({
      where: { id: sketch.projectId },
      select: { id: true, monterId: true, vodjaId: true, dealLocked: true },
    })
    assertProjectAccess(auth, project, 'update')

    await db.sketch.delete({ where: { id } })
    if (sketch.storageKey) await deleteObject(sketch.storageKey)
    return NextResponse.json({ success: true })
  } catch (error) {
    const denied = accessErrorResponse(error)
    if (denied) return denied
    console.error('Sketches DELETE Error:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju skice' }, { status: 500 })
  }
}
