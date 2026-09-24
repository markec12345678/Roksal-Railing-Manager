// Roksal Field - API: Dokumenti
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createDocumentSchema } from '@/lib/validations'
import { authenticate, unauthorized } from '@/lib/auth'
import { assertProjectAccess, AccessDeniedError } from '@/lib/access'
import { auditInTx } from '@/lib/audit'

export async function POST(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const body = await request.json()
    const validated = createDocumentSchema.parse(body)

    const project = await db.project.findUnique({
      where: { id: validated.projectId },
      select: { id: true, nazivProjekta: true, status: true, monterId: true, vodjaId: true, dealLocked: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Projekt ni bil najden' }, { status: 404 })
    }
    // Terensko dejanje (zapisniki nastajajo na montaži, projekt je dealLocked):
    // 'read' — kot fotografije (R120). Ustvarjanje zapisa ne spreminja poslovnega stanja.
    assertProjectAccess(auth, project, 'read')

    const fileName = `${validated.tipDokumenta}_${project.id}_${Date.now()}.pdf`

    // ATOMSKO: dokument + revizijski vnos v ENI transakciji. (Prej: userId 'system'
    // je kršil FK AuditLog_userId_fkey → 500, dokument pa je ostal zapisan brez
    // sledi — delni zapis. E2E veriga (issue #9) je to dokazala na živem strežniku.)
    const document = await db.$transaction(async (tx) => {
      const created = await tx.document.create({
        data: {
          projectId: project.id,
          tipDokumenta: validated.tipDokumenta,
          pdfUrl: fileName,
          status: 'GENERIRANO',
        },
      })

      await auditInTx(tx, {
        request,
        session: auth.kind === 'user' ? auth.session : null,
        userId: auth.kind === 'user' ? auth.session.sub : null,
        projectId: project.id,
        akcija: 'GENERATE_PDF',
        newValue: { tipDokumenta: validated.tipDokumenta, fileName, dokumentId: created.id },
      })

      return created
    })

    return NextResponse.json(document, { status: 201 })
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

    const documents = await db.document.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(documents)
  } catch (error) {
    console.error('Documents GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju dokumentov' }, { status: 500 })
  }
}
