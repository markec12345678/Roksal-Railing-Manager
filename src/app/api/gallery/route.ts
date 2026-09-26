// Roksal Field - API: Galerija realizacij
// ---------------------------------------------------------------------------
// R121 (object storage, issue #7): slikaPred/slikaPo (data URI) gredo v
// object storage (files/gallery/<id>/pred.jpg | po.jpg); DB samo metadata
// (slikaPredKey/Mime/Size/Sha256 …). GET združljivo hydrate-a stare
// zapisi/verzijske polja; zapuščinske vrstice (base64/URL v DB) ostanejo.
// ProjectId guard: 'read' (galerija ne spreminja poslovnega stanja projekta).
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
import { validateUploadContent } from '@/lib/upload-security'

function accessErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof AccessDeniedError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  return null
}

/** Hydrate ene galerijske slike (storageKey → data URI; zapuščina ostane). */
async function hydrateGalleryImage(
  item: { slikaPredKey: string | null; slikaPoKey: string | null } & Record<string, unknown>
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { ...item }
  for (const [keyField, dataField] of [
    ['slikaPredKey', 'slikaPred'],
    ['slikaPoKey', 'slikaPo'],
  ] as const) {
    const storageKey = item[keyField]
    if (!storageKey) continue
    const bytes = await getObject(storageKey)
    if (!bytes) {
      out[dataField] = null
      out.storageMissing = true
      continue
    }
    const mimeField = keyField.replace('Key', 'Mime')
    const mime = (item[mimeField] as string | null) ?? 'image/jpeg'
    out[dataField] = `data:${mime};base64,${bytes.toString('base64')}`
  }
  return out
}

// GET - Galerija (privzeto samo javne, ali vse z ?all=true)
export async function GET(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all') === 'true'

    const rows = await db.galleryItem.findMany({
      where: all ? {} : { javno: true },
      include: { profil: true, project: { include: { customer: true } } },
      orderBy: { createdAt: 'desc' },
    })
    const items = await Promise.all(rows.map((r) => hydrateGalleryImage(r)))
    return NextResponse.json(items)
  } catch (error) {
    const denied = accessErrorResponse(error)
    if (denied) return denied
    console.error('Gallery GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju galerije' }, { status: 500 })
  }
}

// POST - Dodaj v galerijo (slike → object storage, metadata → DB)
export async function POST(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const body = await request.json()
    if (!body.naslov || typeof body.naslov !== 'string') {
      return NextResponse.json({ error: 'naslov je obvezen' }, { status: 400 })
    }
    if (body.projectId) {
      const project = await db.project.findUnique({
        where: { id: body.projectId },
        select: { id: true, monterId: true, vodjaId: true, dealLocked: true },
      })
      assertProjectAccess(auth, project, 'read')
    }

    // Slike (neobvezna): data URI → bajti + mime
    const slots: Array<{ field: 'slikaPred' | 'slikaPo'; label: string }> = [
      { field: 'slikaPred', label: 'slikaPred' },
      { field: 'slikaPo', label: 'slikaPo' },
    ]
    const parsedSlots: Record<
      string,
      { bytes: Buffer; mime: string } | undefined
    > = {}
    for (const { field, label } of slots) {
      const value = body[field]
      if (value == null || value === '') continue
      if (typeof value === 'string' && !value.startsWith('data:')) {
        // URL ali zapuščinska vrednost — pustimo kot je (galerija dovoli URL)
        parsedSlots[field] = undefined
        continue
      }
      const parsed = parseDataUri(value)
      if (!parsed) {
        return NextResponse.json(
          { error: `${label} mora biti veljaven data URI ali URL (do 15 MB)` },
          { status: 400 }
        )
      }
      // R149 (§37 Upload security): deklaracija se preveri proti magičnim bajtom.
      const contentCheck = validateUploadContent(parsed.mime, parsed.bytes)
      if (!contentCheck.ok) {
        return NextResponse.json({ error: `${label}: ${contentCheck.reason}` }, { status: 400 })
      }
      parsedSlots[field] = parsed
    }

    const needsStorage = Object.values(parsedSlots).some(Boolean)
    const id = needsStorage ? randomUUID() : null

    // Bajti najprej, DB zapis = točka zaveze, kompenzacija ob napaki (0 sirot).
    const putPred = parsedSlots.slikaPred
      ? await putObject(
          objectKey('gallery', id!, `pred.${extensionForMime(parsedSlots.slikaPred.mime)}`),
          parsedSlots.slikaPred.bytes,
          parsedSlots.slikaPred.mime
        )
      : null
    const putPo = parsedSlots.slikaPo
      ? await putObject(
          objectKey('gallery', id!, `po.${extensionForMime(parsedSlots.slikaPo.mime)}`),
          parsedSlots.slikaPo.bytes,
          parsedSlots.slikaPo.mime
        )
      : null

    try {
      const item = await db.galleryItem.create({
        data: {
          projectId: body.projectId ?? null,
          profilId: body.profilId ?? null,
          naslov: body.naslov,
          opis: body.opis ?? null,
          lokacija: body.lokacija ?? null,
          // Zapuščinska polja: URL gre direktno; data URI NE gre v DB več.
          slikaPred:
            typeof body.slikaPred === 'string' && !body.slikaPred.startsWith('data:')
              ? body.slikaPred
              : null,
          slikaPo:
            typeof body.slikaPo === 'string' && !body.slikaPo.startsWith('data:')
              ? body.slikaPo
              : null,
          slikaPredKey: putPred?.key ?? null,
          slikaPredMime: putPred ? parsedSlots.slikaPred!.mime : null,
          slikaPredSize: putPred?.sizeBytes ?? null,
          slikaPredSha256: putPred?.sha256 ?? null,
          slikaPoKey: putPo?.key ?? null,
          slikaPoMime: putPo ? parsedSlots.slikaPo!.mime : null,
          slikaPoSize: putPo?.sizeBytes ?? null,
          slikaPoSha256: putPo?.sha256 ?? null,
          javno: body.javno ?? false,
        },
        include: { profil: true },
      })
      return NextResponse.json(item, { status: 201 })
    } catch (dbError) {
      if (putPred) await deleteObject(putPred.key)
      if (putPo) await deleteObject(putPo.key)
      throw dbError
    }
  } catch (error) {
    const denied = accessErrorResponse(error)
    if (denied) return denied
    console.error('Gallery POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri dodajanju v galerijo' }, { status: 500 })
  }
}
