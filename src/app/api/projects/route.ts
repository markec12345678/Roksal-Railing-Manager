// Roksal Field - API: Projekti
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createProjectSchema, updateProjectSchema } from '@/lib/validations'

// GET - Pridobi vse projekte s podatki o strankah in meritvah
export async function GET() {
  try {
    const projects = await db.project.findMany({
      include: {
        customer: true,
        monter: { select: { id: true, ime: true, vloga: true } },
        vodja: { select: { id: true, ime: true, vloga: true } },
        measurements: true,
        materials: { include: { inventory: true } },
        _count: {
          select: { documents: true, auditLogs: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(projects)
  } catch (error) {
    console.error('Projects GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju projektov' }, { status: 500 })
  }
}

// POST - Ustvari nov projekt
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = createProjectSchema.parse(body)

    const newProject = await db.project.create({
      data: {
        nazivProjekta: validated.nazivProjekta,
        customerId: validated.customerId,
        monterId: validated.monterId,
        vodjaId: validated.vodjaId,
        ekipaId: validated.ekipaId,
        datumMontaze: validated.datumMontaze ? new Date(validated.datumMontaze) : null,
        opombe: validated.opombe,
      },
      include: {
        customer: true,
        monter: { select: { id: true, ime: true } },
      }
    })

    await db.auditLog.create({
      data: {
        userId: validated.monterId || validated.vodjaId || 'system',
        projectId: newProject.id,
        akcija: 'CREATE_PROJECT',
        newValue: JSON.stringify({ nazivProjekta: validated.nazivProjekta }),
      }
    })

    return NextResponse.json(newProject, { status: 201 })
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'issues' in error) {
      return NextResponse.json({ error: 'Neveljavni podatki', details: (error as { issues: unknown }).issues }, { status: 400 })
    }
    console.error('Projects POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju projekta' }, { status: 500 })
  }
}

// PATCH - Posodobi projekt
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Manjka ID projekta' }, { status: 400 })
    }

    const validated = updateProjectSchema.parse(updateData)

    const updated = await db.project.update({
      where: { id },
      data: validated,
      include: {
        customer: true,
        monter: { select: { id: true, ime: true } },
      }
    })

    return NextResponse.json(updated)
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'issues' in error) {
      return NextResponse.json({ error: 'Neveljavni podatki', details: (error as { issues: unknown }).issues }, { status: 400 })
    }
    console.error('Projects PATCH Error:', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju projekta' }, { status: 500 })
  }
}
