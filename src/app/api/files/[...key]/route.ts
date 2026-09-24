// R121 — Object storage SERVING ruta (issue #7, Problems 5/6).
// ---------------------------------------------------------------------------
// Bajti (fotografije, skice, AR posnetki, PDF artefakti) živijo v object
// storage; DB hrani samo metadata. Ta ruta je EDINI dostop za kliente:
//
//   GET /api/files/<resource>/<id>/<ime>
//
// Varnost:
//   • avtentikacija (seja ali API ključ) — anonimno NI dostopa;
//   • avtorizacija po viru: ključ se razčleni → zapis v DB → projectId →
//     assertProjectAccess('read') (isti model kot vse business rute, R120);
//   • ETag = SHA-256 (integriteta + učinkovit cache);
//   • 403/404 politika: tuj projekt = 404 oz. 403 po matriki access.ts,
//     neobstoječ ključ/zapis = 404, pokvarjen ključ = 400.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { assertProjectAccess, AccessDeniedError } from '@/lib/access'
import { getObject, parseObjectKey, sha256Of } from '@/lib/object-storage'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()

  const { key: segments } = await params
  const key = segments.join('/')
  const parsed = parseObjectKey(key)
  if (!parsed) {
    return NextResponse.json({ error: 'Neveljaven ključ shrambe' }, { status: 400 })
  }

  try {
    // ── resource → projectId (avtorizacijska izhodiščna točka) ──────────────
    let projectId: string | null = null
    let knownSha256: string | null = null
    switch (parsed.resource) {
      case 'photos': {
        const row = await db.projectPhoto.findUnique({
          where: { id: parsed.id },
          select: { projectId: true, sha256: true },
        })
        if (!row) return NextResponse.json({ error: 'Slika ne obstaja' }, { status: 404 })
        projectId = row.projectId
        knownSha256 = row.sha256
        break
      }
      case 'sketches': {
        const row = await db.sketch.findUnique({
          where: { id: parsed.id },
          select: { projectId: true, sha256: true },
        })
        if (!row) return NextResponse.json({ error: 'Skica ne obstaja' }, { status: 404 })
        projectId = row.projectId
        knownSha256 = row.sha256
        break
      }
      case 'ar-snapshots': {
        const row = await db.arSnapshot.findUnique({
          where: { id: parsed.id },
          select: { projectId: true, sha256: true },
        })
        if (!row) return NextResponse.json({ error: 'AR posnetek ne obstaja' }, { status: 404 })
        projectId = row.projectId
        knownSha256 = row.sha256
        break
      }
      case 'gallery': {
        const row = await db.galleryItem.findUnique({
          where: { id: parsed.id },
          select: { projectId: true },
        })
        // Galerija realizacij lahko brez projekta (javni katalog) — zahteva
        // prijavo, projektne omejitve ni.
        if (!row) return NextResponse.json({ error: 'Galerija ne obstaja' }, { status: 404 })
        projectId = row.projectId
        break
      }
      case 'documents': {
        const row = await db.document.findUnique({
          where: { id: parsed.id },
          select: { projectId: true, sha256: true },
        })
        if (!row) return NextResponse.json({ error: 'Dokument ne obstaja' }, { status: 404 })
        projectId = row.projectId
        knownSha256 = row.sha256
        break
      }
    }

    if (projectId) {
      const project = await db.project.findUnique({
        where: { id: projectId },
        select: { id: true, monterId: true, vodjaId: true, dealLocked: true },
      })
      assertProjectAccess(auth, project, 'read')
    }

    const bytes = await getObject(key)
    if (!bytes) {
      return NextResponse.json({ error: 'Artefakt manjka v shrambi' }, { status: 404 })
    }

    const sha256 = knownSha256 ?? sha256Of(bytes)
    const ifNoneMatch = request.headers.get('if-none-match')
    if (ifNoneMatch && ifNoneMatch.includes(sha256)) {
      return new Response(null, { status: 304, headers: { ETag: `"${sha256}"` } })
    }

    const name = parsed.name
    const mime = name.endsWith('.png')
      ? 'image/png'
      : name.endsWith('.webp')
        ? 'image/webp'
        : name.endsWith('.pdf')
          ? 'application/pdf'
          : name.endsWith('.jpg') || name.endsWith('.jpeg')
            ? 'image/jpeg'
            : 'application/octet-stream'

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Length': String(bytes.length),
        'Cache-Control': 'private, max-age=3600',
        ETag: `"${sha256}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Files GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju artefakta' }, { status: 500 })
  }
}
