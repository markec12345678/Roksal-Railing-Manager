// Roksal Field - API: Meritve (AR/LiDAR) — S+9 (issue #4, §3 + §14)
// Resource-level dostop: meritve sme dodati izvajalec projekta ali vodstvo
// (SKLADISCE samo bere). Stranski preskok NACRTOVANO → V_TEKU gre skozi
// statusni stroj (brez prisilnega overwrite-a statusa).
// R128 (issue #5 §4): `Idempotency-Key` (offline vrsta) — rezervacija ključa
// IN snapshot odgovora v ISTI transakciji kot mutacija = exactly-once replay
// (ponovitev istega ključa vrne originalni odgovor, brez dvojnika meritve).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createMeasurementSchema } from '@/lib/validations'
import { authenticate, unauthorized } from '@/lib/auth'
import { assertProjectAccess, actorIdOf, principalBindingOf, AccessDeniedError } from '@/lib/access'
import { assertTransition, InvalidTransitionError } from '@/lib/project-state'
import {
  MEASUREMENT_STATUS_VALUES,
  isValidMeasurementStatus,
  type MeasurementStatusValue,
} from '@/lib/measurement-status'
import {
  beginIdempotency,
  idempotencyConflictResponse,
  idempotencyReplayResponse,
  IdempotencyRaceError,
  isValidIdempotencyKey,
  reserveIdempotencyIn,
  storeResponseIn,
} from '@/lib/idempotency'

export async function POST(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const actor = actorIdOf(auth)
  // Idempotenca (R128): veljaven klient ključ se rezervira kot PRVI stavek
  // transakcije (atomsko z mutacijo — exactly-once); validacija 400 rezervacije
  // NE pusti (ročni retry ostane čist 400, ne večni 409).
  const idemHeader = request.headers.get('Idempotency-Key')
  const idemKey = idemHeader !== null && isValidIdempotencyKey(idemHeader) ? idemHeader : null
  if (idemHeader !== null && !idemKey) {
    return NextResponse.json({ error: 'Neveljaven Idempotency-Key' }, { status: 400 })
  }
  const idemBinding = idemKey ? principalBindingOf(auth) : null
  try {
    const body = await request.json()
    const validated = createMeasurementSchema.parse(body)

    // Dostop do projekta — meritev lahko doda izvajalec/vodja projekta.
    const project = await db.project.findUnique({ where: { id: validated.projectId } })
    if (!project) throw new AccessDeniedError(404, 'Projekt ne obstaja')
    assertProjectAccess(auth, project, 'update')

    // Meritev + (možen prehod statusa) + audit (+ idempotenca) = ENA transakcija (§13).
    const measurement = await db.$transaction(async (tx) => {
      // R128: rezervacija Idempotency-Key = PRVI stavek — vzporedni poizkus
      // istega ključa povzroči rollback cele transakcije (brez dvojnikov).
      if (idemKey) await reserveIdempotencyIn(tx, idemKey, 'measurements', idemBinding)

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

      // R128: snapshot odgovora v isti transakciji — retry istega ključa
      // vrne TA odgovor (exactly-once), ne ustvari druge meritve.
      if (idemKey) {
        await storeResponseIn(tx, idemKey, 201, JSON.stringify(created))
      }

      return created
    })

    const response = NextResponse.json(measurement, { status: 201 })
    if (idemKey) response.headers.set('Idempotent-Stored', 'true')
    return response
  } catch (error: unknown) {
    // R128: vzporedni poizkus istega ključa — transakcija rollbackana;
    // vrni shranjen odgovor (replay) ali čist 409 (tudi tuji profil — brez razkritja).
    if (idemKey && error instanceof IdempotencyRaceError) {
      const begun = await beginIdempotency(idemKey, 'measurements', idemBinding)
      if (begun.kind === 'replay') return idempotencyReplayResponse(begun)
      return idempotencyConflictResponse()
    }
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

    // R154: ?status= — strežniški filter po statusu meritve (R153 indeks
    // (projectId, status) dobi dejansko rabo). Stroga validacija: neznana
    // vrednost → 400 z izrecno napako (fail-closed, ne tiho prazen seznam).
    // Brez parametra = nespremenjeno obnašanje (vse meritve projekta).
    const statusParam = searchParams.get('status')
    let statusFilter: MeasurementStatusValue | null = null
    if (statusParam !== null) {
      if (!isValidMeasurementStatus(statusParam)) {
        return NextResponse.json(
          { error: `Neveljaven status: dovoljene vrednosti so ${MEASUREMENT_STATUS_VALUES.join(', ')}` },
          { status: 400 }
        )
      }
      statusFilter = statusParam
    }

    // Dostop do meritev = dostop do projekta (403 na tuj projekt).
    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) throw new AccessDeniedError(404, 'Projekt ne obstaja')
    assertProjectAccess(auth, project, 'read')

    const measurements = await db.measurement.findMany({
      where: statusFilter ? { projectId, status: statusFilter } : { projectId },
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
