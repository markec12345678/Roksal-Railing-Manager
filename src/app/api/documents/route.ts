// Roksal Field - API: Dokumenti
// ---------------------------------------------------------------------------
// R121 (issue #7, Problem 6): dokument je ZDAJ PRAVI PDF ARTEFAKT, ne samo DB
// vrstica z imenom. Kanonična pot:
//
//   canonical data (projekt/stranka/meritve/navori/račun) → renderer
//   (src/lib/document-pdf.ts — čista funkcija, brez AI/naključja) → PDF bajti
//   → SHA-256 → object storage (files/documents/<id>/v<n>.pdf) → Document
//   + DocumentVersion (DB hrani samo metadata) + audit V ISTI transakciji.
//
// Verzioniranje: POST z `documentId` obstoječega dokumenta USTVARI NOVO
// verzijo (v2, v3 …) — prejšnje verzije ostajo v object storage in
// DocumentVersion (neizbrisna revizijska sled). Brez documentId = nov dokument.
//
// Varnost: resource authorization (R120 vzorec) — 'read' za ustvarjanje
// (terensko dejanje, zapisniki nastajajo na montaži dealLocked projekta),
// Avtentikacija obvezna.
import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { createDocumentSchema } from '@/lib/validations'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { assertProjectAccess, actorLabelOf, lacksPermission, AccessDeniedError } from '@/lib/access'
import { auditInTx } from '@/lib/audit'
import {
  deleteObject,
  extensionForMime,
  objectKey,
  putObject,
} from '@/lib/object-storage'
import { generateDocumentPdf } from '@/lib/document-pdf'

export async function POST(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  // §10 (R135): generiranje uradnih dokumentov = documents.generate —
  // samo uporabniške vloge (API ključ ne dela uradnih dokumentov, isto kot
  // pri računih; izrecna, dokumentirana zožitev servisne pogodbe).
  if (lacksPermission(auth, 'documents.generate')) {
    return forbidden('Izdelava dokumentov zahteva uporabniško pravico documents.generate.')
  }
  try {
    const body = await request.json()
    const validated = createDocumentSchema.parse(body)

    const project = await db.project.findUnique({
      where: { id: validated.projectId },
      select: { id: true, nazivProjekta: true, status: true, opombe: true, projectData: true, datumMontaze: true, monterId: true, vodjaId: true, dealLocked: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Projekt ni bil najden' }, { status: 404 })
    }
    // Terensko dejanje (zapisniki nastajajo na montaži, projekt je dealLocked):
    // 'read' — kot fotografije (R120). Ustvarjanje zapisa ne spreminja poslovnega stanja.
    assertProjectAccess(auth, project, 'read')

    // ── Verzioniranje: obstoječ dokument (documentId) ali nov? ──────────────
    const existingDocument = validated.documentId
      ? await db.document.findUnique({
          where: { id: validated.documentId },
          select: { id: true, projectId: true, _count: { select: { versions: true } } },
        })
      : null
    if (validated.documentId && !existingDocument) {
      return NextResponse.json({ error: 'Dokument ni bil najden' }, { status: 404 })
    }
    if (existingDocument && existingDocument.projectId !== project.id) {
      return NextResponse.json({ error: 'Dokument ne pripada temu projektu' }, { status: 400 })
    }

    const documentId = existingDocument?.id ?? randomUUID()
    const version = (existingDocument?._count.versions ?? 0) + 1

    // ── Kanonični vhod za renderer (vse iz DB — ni kliceskih podatkov) ──────
    const [customer, measurements, punchItems, invoice] = await Promise.all([
      db.customer.findFirst({ where: { projects: { some: { id: project.id } } } }),
      db.measurement.findMany({ where: { projectId: project.id }, orderBy: { createdAt: 'asc' }, select: { dolzinaMm: true, visinaMm: true, createdAt: true } }),
      db.punchItem.findMany({ where: { projectId: project.id }, orderBy: { createdAt: 'desc' }, select: { naslov: true, opomba: true, status: true } }),
      db.invoice.findFirst({ where: { projectId: project.id, status: { in: ['IZDAN', 'PLACAN'] } }, orderBy: { datumIzdaje: 'desc' } }),
    ])

    const pdfBytes = generateDocumentPdf({
      tipDokumenta: validated.tipDokumenta,
      documentId,
      version,
      datumIzdaje: new Date().toISOString(),
      project: {
        naziv: project.nazivProjekta,
        status: project.status,
        datumMontaze: project.datumMontaze?.toISOString() ?? null,
        opombe: project.opombe,
        projectDataJson: project.projectData,
      },
      customer: {
        ime: customer?.ime ?? 'Neznana stranka',
        naslov: customer?.naslov ?? null,
        telefon: customer?.telefon ?? null,
        email: customer?.email ?? null,
      },
      actor: actorLabelOf(auth),
      measurements,
      punchItems,
      invoice: invoice
        ? {
            stevilka: invoice.stevilka,
            osnova: invoice.osnova,
            ddv: invoice.ddv,
            skupaj: invoice.osnova + invoice.ddv,
          }
        : null,
    })

    // ── Object storage: bajti najprej, DB = točka zaveze, kompenzacija ──────
    const key = objectKey('documents', documentId, `v${version}.${extensionForMime('application/pdf')}`)
    const put = await putObject(key, pdfBytes, 'application/pdf')

    try {
      // ATOMSKO: dokument (+ verzija) + revizijski vnos v ENI transakciji.
      // (Prej: userId 'system' je kršil FK AuditLog_userId_fkey → 500, dokument
      // pa je ostal zapisan brez sledi — delni zapis. E2E veriga (issue #9) je
      // to dokazala na živem strežniku.)
      const document = await db.$transaction(async (tx) => {
        const created = existingDocument
          ? await tx.document.update({
              where: { id: documentId },
              data: {
                storageKey: put.key,
                sha256: put.sha256,
                status: 'GENERIRANO',
              },
            })
          : await tx.document.create({
              data: {
                id: documentId,
                projectId: project.id,
                tipDokumenta: validated.tipDokumenta,
                storageKey: put.key,
                sha256: put.sha256,
                status: 'GENERIRANO',
              },
            })

        await tx.documentVersion.create({
          data: {
            documentId,
            version,
            storageKey: put.key,
            mime: 'application/pdf',
            sizeBytes: put.sizeBytes,
            sha256: put.sha256,
          },
        })

        await auditInTx(tx, {
          request,
          session: auth.kind === 'user' ? auth.session : null,
          userId: auth.kind === 'user' ? auth.session.sub : null,
          projectId: project.id,
          akcija: existingDocument ? 'REGENERATE_PDF' : 'GENERATE_PDF',
          newValue: {
            tipDokumenta: validated.tipDokumenta,
            dokumentId: documentId,
            verzija: version,
            storageKey: put.key,
            sha256: put.sha256,
            sizeBytes: put.sizeBytes,
          },
        })

        return created
      })

      return NextResponse.json(
        {
          ...document,
          verzija: version,
          url: `/api/files/${put.key}`,
          sha256: put.sha256,
          sizeBytes: put.sizeBytes,
        },
        { status: 201 },
      )
    } catch (dbError) {
      await deleteObject(key)
      throw dbError
    }
  } catch (error: unknown) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error && typeof error === 'object' && 'issues' in error) {
      return NextResponse.json({ error: 'Neveljavni podatki', details: (error as { issues: unknown }).issues }, { status: 400 })
    }
    console.error('PDF Generation Error:', error)
    return NextResponse.json({ error: 'Napaka pri generiranju dokumenta' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'Manjka projectId' }, { status: 400 })
    }

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, monterId: true, vodjaId: true, dealLocked: true },
    })
    assertProjectAccess(auth, project, 'read')

    const documents = await db.document.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: { versions: { orderBy: { version: 'asc' } } },
    })

    return NextResponse.json(documents)
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Documents GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju dokumentov' }, { status: 500 })
  }
}
