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
//
// R121 (object storage, issue #7): bajti NE gredo več v DB (base64 v
// ProjectPhoto.imageData je naredil tabelo ogromno in počasno). DB hrani SAMO
// metadata (storageKey/mime/sizeBytes/sha256), bajti v object storage
// (src/lib/object-storage.ts). GET ostane združljiv: hydrate data URI iz
// shrambe; zapuščinske vrstice (backfill še ni tekel) vračajo staro imageData.
import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { assertProjectAccess, AccessDeniedError } from '@/lib/access'
import {
  deleteObject,
  extensionForMime,
  getObject,
  objectKey,
  parseDataUri,
  putObject,
} from '@/lib/object-storage'

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

    const rows = await db.projectPhoto.findMany({
      where: {
        projectId,
        ...(kategorija ? { kategorija } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })

    // Združljivost s klientom: data URI hydrate iz object storage.
    // Zapuščinske vrstice (storageKey null) še nosijo imageData iz DB.
    const photos = await Promise.all(
      rows.map(async (p) => {
        if (!p.storageKey) return p
        const bytes = await getObject(p.storageKey)
        if (!bytes) {
          // Fail-closed: NE taji podatka — javno označimo, da artefakt manjka.
          return { ...p, imageData: null, storageMissing: true }
        }
        return {
          ...p,
          imageData: `data:${p.mime ?? 'image/jpeg'};base64,${bytes.toString('base64')}`,
        }
      })
    )
    return NextResponse.json(photos)
  } catch (error) {
    const denied = accessErrorResponse(error)
    if (denied) return denied
    console.error('Photos GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju slik' }, { status: 500 })
  }
}

// POST - Shrani sliko (data URI/base64 + kategorija + GPS) → object storage
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
    if (!body.imageData || typeof body.imageData !== 'string') {
      return NextResponse.json({ error: 'imageData je obvezen' }, { status: 400 })
    }

    const project = await db.project.findUnique({
      where: { id: body.projectId },
      select: { id: true, monterId: true, vodjaId: true, dealLocked: true },
    })
    assertProjectAccess(auth, project, 'read')

    const parsedImage = parseDataUri(body.imageData)
    if (!parsedImage) {
      return NextResponse.json(
        { error: 'imageData mora biti veljaven data URI ali base64 (do 15 MB)' },
        { status: 400 }
      )
    }

    // METADATA = TOČKA ZAVEZE (isti vzorc kot viz save-flow): najprej bajti v
    // object storage, nato vrstica v DB; DB napaka → kompenzacija (0 sirot).
    const id = randomUUID()
    const key = objectKey('photos', id, `slika.${extensionForMime(parsedImage.mime)}`)
    const put = await putObject(key, parsedImage.bytes, parsedImage.mime)
    try {
      const photo = await db.projectPhoto.create({
        data: {
          id,
          projectId: body.projectId,
          kategorija: kat,
          storageKey: put.key,
          mime: parsedImage.mime,
          sizeBytes: put.sizeBytes,
          sha256: put.sha256,
          opomba: body.opomba ?? null,
          latitude: body.latitude ?? null,
          longitude: body.longitude ?? null,
        },
      })
      return NextResponse.json(photo, { status: 201 })
    } catch (dbError) {
      await deleteObject(key)
      throw dbError
    }
  } catch (error) {
    const denied = accessErrorResponse(error)
    if (denied) return denied
    console.error('Photos POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri shranjevanju slike' }, { status: 500 })
  }
}

// DELETE - Izbriši sliko (DB vrstica + artefakt iz object storage)
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
      select: { projectId: true, storageKey: true },
    })
    if (!photo) return NextResponse.json({ error: 'Slika ne obstaja' }, { status: 404 })

    const project = await db.project.findUnique({
      where: { id: photo.projectId },
      select: { id: true, monterId: true, vodjaId: true, dealLocked: true },
    })
    assertProjectAccess(auth, project, 'update')

    await db.projectPhoto.delete({ where: { id } })
    if (photo.storageKey) await deleteObject(photo.storageKey)
    return NextResponse.json({ success: true })
  } catch (error) {
    const denied = accessErrorResponse(error)
    if (denied) return denied
    console.error('Photos DELETE Error:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju slike' }, { status: 500 })
  }
}
