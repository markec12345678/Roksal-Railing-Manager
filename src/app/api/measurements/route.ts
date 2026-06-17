// Roksal Field - API: Meritve (AR/LiDAR)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createMeasurementSchema } from '@/lib/validations'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = createMeasurementSchema.parse(body)

    const measurement = await db.measurement.create({
      data: {
        projectId: validated.projectId,
        dolzinaMm: validated.dolzinaMm,
        visinaMm: validated.visinaMm,
        lidarScanUrl: validated.lidarScanUrl,
        arMetadata: validated.arMetadata ? JSON.stringify(validated.arMetadata) : null,
        gpsLokacija: validated.gpsLokacija ? JSON.stringify(validated.gpsLokacija) : null,
      }
    })

    // Update project status (non-blocking)
    try {
      await db.project.update({
        where: { id: validated.projectId },
        data: { status: 'V_TEKU' }
      })
    } catch { /* ignore */ }

    // Create audit log (non-blocking — don't fail the whole request if audit fails)
    try {
      await db.auditLog.create({
        data: {
          userId: 'system',
          projectId: validated.projectId,
          akcija: 'CREATE_MEASUREMENT',
          newValue: JSON.stringify({ dolzinaMm: validated.dolzinaMm, visinaMm: validated.visinaMm }),
        }
      })
    } catch { /* ignore audit log failures (e.g. foreign key constraint on userId) */ }

    return NextResponse.json(measurement, { status: 201 })
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'issues' in error) {
      return NextResponse.json({ error: 'Neveljavni podatki', details: (error as { issues: unknown }).issues }, { status: 400 })
    }
    console.error('Measurement POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri shranjevanju meritev' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'Manjka projectId' }, { status: 400 })
    }

    const measurements = await db.measurement.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(measurements)
  } catch (error) {
    console.error('Measurements GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju meritev' }, { status: 500 })
  }
}
