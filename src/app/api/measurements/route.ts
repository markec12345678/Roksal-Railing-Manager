// Roksal Field - API: Meritve (AR/LiDAR) — S+9 (issue #4, §3 + §14)
// Resource-level dostop: meritve sme dodati izvajalec projekta ali vodstvo
// (SKLADISCE samo bere). Stranski preskok NACRTOVANO → V_TEKU gre skozi
// statusni stroj (brez prisilnega overwrite-a statusa).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createMeasurementSchema } from '@/lib/validations'
import { authenticate, unauthorized } from '@/lib/auth'
import {
  assertProjectAccess,
  actorIdOf,
  AccessDeniedError,
} from '@/lib/access'
import { assertTransition, InvalidTransitionError } from '@/lib/project-state'

export async function POST(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const actor = actorIdOf(auth)
  try {
    const body = await request.json()
    const validated = createMeasurementSchema.parse(body)

    // Dostop do projekta — meritev lahko doda izvajalec/vodja projekta.
    const project = await db.project.findUnique({ where: { id: validated.projectId } })
    if (!project) throw new AccessDeniedError(404, 'Projekt ne obstaja')
    assertProjectAccess(auth, project, 'update')

    // Meritev + (možen prehod statusa) + audit = ENA transakcija (§13).
    const measurement = await db.$transaction(async (tx) => {
      const created = await tx.measurement.create({
        data: {
          projectId: validated.projectId,
          dolzinaMm: validated.dolzinaMm,
          visinaMm: validated.visinaMm,
          lidarScanUrl: validated.lidarScanUrl,
          arMetadata: validated.arMetadata ? JSON.stringify(validated.arMetadata) : null,
          gpsLokacija: validated.gpsLokacija ? JSON.stringify(validated.gpsLokacija) : null,
        }
      })

      // Prej: brezpogojen overwrite statusa. Zdaj: veljaven prehod skozi
      // statusni stroj — NACRTOVANO → V_TEKU; druga stanja ostanejo netaknjena.
      if (project.status === 'NACRTOVANO') {
        assertTransition({ from: project.status, to: 'V_TEKU', principal: auth, dealLocked: project.dealLocked })
        await tx.project.update({
          where: { id: validated.projectId },
          data: { status: 'V_TEKU' }
        })
      }

      await tx.auditLog.create({
        data: {
          userId: actor,
          projectId: validated.projectId,
          akcija: 'CREATE_MEASUREMENT',
          newValue: JSON.stringify({ dolzinaMm: validated.dolzinaMm, visinaMm: validated.visinaMm }),
        }
      })

      return created
    })

    return NextResponse.json(measurement, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof InvalidTransitionError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error && typeof error === 'object' && 'issues' in error) {
      return NextResponse.json({ error: 'Neveljavni podatki', details: (error as { issues: unknown }).issues }, { status: 400 })
    }
    console.error('Measurement POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri shranjevanju meritev' }, { status: 500 })
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

    // Dostop do meritev = dostop do projekta (403 na tuj projekt).
    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) throw new AccessDeniedError(404, 'Projekt ne obstaja')
    assertProjectAccess(auth, project, 'read')

    const measurements = await db.measurement.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(measurements)
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Measurements GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju meritev' }, { status: 500 })
  }
}
