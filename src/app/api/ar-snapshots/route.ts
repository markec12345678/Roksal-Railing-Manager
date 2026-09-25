// Roksal Field - API: AR posnetki (kamera + točke + vizualizacija)
// ---------------------------------------------------------------------------
// R120 vzorec (IDOR zaprt): prej SAMO avtentikacija — tuj projekt je bil
// berljiv/pisljiv. Zdaj resource authorization:
//   GET    → 'read'   (AR dokumentacija meritve)
//   POST   → 'read'   (terenško dejanje — deluje tudi na dealLocked)
//   DELETE → 'update' (destruktivno — deal-lock zavre)
//
// R121 (object storage, issue #7): bajti posnetka v object storage
// (files/ar-snapshots/<id>/posnetek.png); DB samo metadata. GET združljivo
// hydrate-a imageUrl iz shrambe; zapuščinske vrstice vračajo staro imageUrl.
import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { assertProjectAccess, AccessDeniedError, principalBindingOf } from '@/lib/access'
import {
  deleteObject,
  getObject,
  objectKey,
  parseDataUri,
  putObject,
} from '@/lib/object-storage'
import {
  beginIdempotency,
  idempotencyConflictResponse,
  idempotencyReplayResponse,
  isValidIdempotencyKey,
  storeResponse,
} from '@/lib/idempotency'

function accessErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof AccessDeniedError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  return null
}

// GET - AR posnetki za projekt
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

    const rows = await db.arSnapshot.findMany({
      where: { projectId },
      include: { profil: true },
      orderBy: { createdAt: 'desc' },
    })
    const snapshots = await Promise.all(
      rows.map(async (s) => {
        if (!s.storageKey) return s
        const bytes = await getObject(s.storageKey)
        if (!bytes) return { ...s, imageUrl: null, storageMissing: true }
        return {
          ...s,
          imageUrl: `data:${s.mime ?? 'image/png'};base64,${bytes.toString('base64')}`,
        }
      })
    )
    return NextResponse.json(snapshots)
  } catch (error) {
    const denied = accessErrorResponse(error)
    if (denied) return denied
    console.error('AR Snapshots GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju AR posnetkov' }, { status: 500 })
  }
}

// POST - Shrani AR posnetek (data URI → object storage + metadata v DB)
export async function POST(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const body = await request.json()
    if (!body.projectId || typeof body.projectId !== 'string') {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }
    if (!body.imageUrl || typeof body.imageUrl !== 'string') {
      return NextResponse.json({ error: 'imageUrl je obvezen' }, { status: 400 })
    }

    const project = await db.project.findUnique({
      where: { id: body.projectId },
      select: { id: true, monterId: true, vodjaId: true, dealLocked: true },
    })
    assertProjectAccess(auth, project, 'read')

    const parsed = parseDataUri(body.imageUrl)
    if (!parsed) {
      return NextResponse.json(
        { error: 'imageUrl mora biti veljaven data URI ali base64 (do 15 MB)' },
        { status: 400 }
      )
    }

    // R128 (issue #5 §4): idempotenca AR posnetkov — rezervacija ključa
    // ŠELE po validaciji (400 ne ostavi večnega 409); objekt + vrstica sta
    // netransakcijska (storage), zato snapshot odgovora best-effort po
    // uspehu — retry v vmesnem oknu dobi 409 → klient conflict → ročni retry.
    const idemHeader = request.headers.get('Idempotency-Key')
    if (idemHeader !== null && !isValidIdempotencyKey(idemHeader)) {
      return NextResponse.json({ error: 'Neveljaven Idempotency-Key' }, { status: 400 })
    }
    const actorId = principalBindingOf(auth)
    if (idemHeader) {
      const begun = await beginIdempotency(idemHeader, 'ar-snapshots', actorId)
      if (begun.kind === 'replay') return idempotencyReplayResponse(begun)
      if (begun.kind === 'conflict') return idempotencyConflictResponse()
    }

    const id = randomUUID()
    const key = objectKey('ar-snapshots', id, 'posnetek.png')
    const put = await putObject(key, parsed.bytes, parsed.mime)
    try {
      const snapshot = await db.arSnapshot.create({
        data: {
          id,
          projectId: body.projectId,
          profilId: body.profilId ?? null,
          storageKey: put.key,
          mime: parsed.mime,
          sizeBytes: put.sizeBytes,
          sha256: put.sha256,
          tocke: JSON.stringify(body.tocke ?? []),
          meritve: body.meritve ? JSON.stringify(body.meritve) : null,
          kalibracija: body.kalibracija ? JSON.stringify(body.kalibracija) : null,
          opombe: body.opombe ?? null,
        },
        include: { profil: true },
      })
      if (idemHeader) {
        await storeResponse(idemHeader, 201, JSON.stringify(snapshot))
      }
      return NextResponse.json(snapshot, { status: 201 })
    } catch (dbError) {
      await deleteObject(key)
      throw dbError
    }
  } catch (error) {
    const denied = accessErrorResponse(error)
    if (denied) return denied
    console.error('AR Snapshots POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri shranjevanju AR posnetka' }, { status: 500 })
  }
}

// DELETE - Izbriši AR posnetek (DB + artefakt)
export async function DELETE(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id je obvezen' }, { status: 400 })

    const snapshot = await db.arSnapshot.findUnique({
      where: { id },
      select: { projectId: true, storageKey: true },
    })
    if (!snapshot) return NextResponse.json({ error: 'AR posnetek ne obstaja' }, { status: 404 })

    const project = await db.project.findUnique({
      where: { id: snapshot.projectId },
      select: { id: true, monterId: true, vodjaId: true, dealLocked: true },
    })
    assertProjectAccess(auth, project, 'update')

    await db.arSnapshot.delete({ where: { id } })
    if (snapshot.storageKey) await deleteObject(snapshot.storageKey)
    return NextResponse.json({ success: true })
  } catch (error) {
    const denied = accessErrorResponse(error)
    if (denied) return denied
    console.error('AR Snapshots DELETE Error:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju AR posnetka' }, { status: 500 })
  }
}
