// Roksal Field - API: Dokumenti
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createDocumentSchema } from '@/lib/validations'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = createDocumentSchema.parse(body)

    const project = await db.project.findUnique({
      where: { id: validated.projectId },
      include: {
        customer: true,
        measurements: true,
        materials: {
          include: { inventory: true }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Projekt ni bil najden' }, { status: 404 })
    }

    const fileName = `${validated.tipDokumenta}_${project.id}_${Date.now()}.pdf`

    const document = await db.document.create({
      data: {
        projectId: project.id,
        tipDokumenta: validated.tipDokumenta,
        pdfUrl: fileName,
        status: 'GENERIRANO',
      }
    })

    await db.auditLog.create({
      data: {
        userId: 'system',
        projectId: project.id,
        akcija: 'GENERATE_PDF',
        newValue: JSON.stringify({ tipDokumenta: validated.tipDokumenta, fileName }),
      }
    })

    return NextResponse.json(document, { status: 201 })
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'issues' in error) {
      return NextResponse.json({ error: 'Neveljavni podatki', details: (error as { issues: unknown }).issues }, { status: 400 })
    }
    console.error('PDF Generation Error:', error)
    return NextResponse.json({ error: 'Napaka pri generiranju dokumenta' }, { status: 500 })
  }
}

export async function GET(request: Request) {
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
