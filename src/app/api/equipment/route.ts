// R145 (issue #5 §31 — Equipment lifecycle): branje + upravljanje opreme.
//
// GET — seznam opreme z življenjskim ciklom (§17 minimalni DTO + izračunane
//       zastavice prek src/lib/equipment-lifecycle.ts — deterministika živi
//       v ENEM mestu). Stropi (§17, vzorec R144 lots): limit 100 / offset.
//       Anon → 401 + x-correlation-id.
//
// PATCH — status (prek matrike EQUIPMENT_TRANSITIONS: neveljavna tranzicija
//       → 409 z dovoljenimi cilji; UPOKOJENO je terminalno) + življenjski
//       cikl podatki (serijska številka, lokacija, interval pregledov,
//       kalibracijski rok/potrdilo). Revizija ATOMSKO s spremembo (§19).
//       Pravice: production.manage (isti katalog kot ekipe/oprema POST).
//
// Ustvarjanje opreme ostane v POST /api/crews?type=equipment (nazajzdružljivo
// z obstoječim UI) — tu je ŽIVLJENJSKI CIKL.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized, denyWithoutPermission } from '@/lib/auth'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import {
  checkTransition,
  isCalibrationOverdue,
  isCalibrationMissing,
  isInspectionDue,
  isInspectionUnknown,
  nextInspectionAt,
} from '@/lib/equipment-lifecycle'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 100
/** §17: odmik nad 10k ni smiseln (patološki offset ne mulca baze). */
const MAX_OFFSET = 10_000

interface EquipmentRow {
  id: string
  naziv: string
  tip: string
  sifra: string | null
  status: string
  lokacija: string | null
  opomba: string | null
  serijskaStevilka: string | null
  pridobitev: Date | null
  lastInspectionAt: Date | null
  inspectionIntervalDays: number | null
  calibrationRequired: boolean
  calibrationDueDate: Date | null
  calibrationCertificate: string | null
  zadnjiServis: Date | null
  _count: { assignments: number }
}

/** §17 minimalni DTO + deterministične življenjske zastavice (lib = 1 mesto). */
function dto(e: EquipmentRow, now: Date) {
  const nextInsp = nextInspectionAt(e)
  return {
    id: e.id,
    naziv: e.naziv,
    tip: e.tip,
    sifra: e.sifra,
    status: e.status,
    lokacija: e.lokacija,
    opomba: e.opomba,
    serijskaStevilka: e.serijskaStevilka,
    pridobitev: e.pridobitev?.toISOString() ?? null,
    lastInspectionAt: e.lastInspectionAt?.toISOString() ?? null,
    inspectionIntervalDays: e.inspectionIntervalDays,
    nextInspectionAt: nextInsp?.toISOString() ?? null,
    inspectionDue: isInspectionDue(e, now),
    inspectionUnknown: isInspectionUnknown(e),
    calibrationRequired: e.calibrationRequired,
    calibrationDueDate: e.calibrationDueDate?.toISOString() ?? null,
    calibrationCertificate: e.calibrationCertificate,
    calibrationOverdue: isCalibrationOverdue(e, now),
    calibrationMissing: isCalibrationMissing(e),
    zadnjiServis: e.zadnjiServis?.toISOString() ?? null,
    assignmentsCount: e._count.assignments,
  }
}

export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const correlationId = correlationFromRequest(request)
  try {
    const { searchParams } = new URL(request.url)
    const limitRaw = Number.parseInt(searchParams.get('limit') ?? '', 10)
    const offsetRaw = Number.parseInt(searchParams.get('offset') ?? '', 10)
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_LIMIT) : DEFAULT_LIMIT
    const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? Math.min(offsetRaw, MAX_OFFSET) : 0

    const rows = await db.equipment.findMany({
      orderBy: { naziv: 'asc' },
      take: limit,
      skip: offset,
      include: { _count: { select: { assignments: true } } },
    })

    const now = new Date()
    return NextResponse.json(rows.map((e) => dto(e, now)))
  } catch (error) {
    logWithCorrelation('equipment.get', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri branju opreme', correlationId },
      { status: 500 },
    )
  }
}

const VALID_FIELDS = [
  'status',
  'serijskaStevilka',
  'lokacija',
  'opomba',
  'inspectionIntervalDays',
  'calibrationDueDate',
  'calibrationCertificate',
] as const

export async function PATCH(request: Request) {
  // Upravljanje opreme je vodstveno opravilo (isti katalog kot ustvarjanje).
  const denied = await denyWithoutPermission(request, 'production.manage')
  if (denied) return denied
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const correlationId = correlationFromRequest(request)

  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const id = typeof body?.id === 'string' ? body.id : null
    if (!id || !body) {
      return NextResponse.json({ error: 'id je obvezen' }, { status: 400 })
    }
    const unknown = Object.keys(body).filter(
      (k) => k !== 'id' && !(VALID_FIELDS as readonly string[]).includes(k),
    )
    if (unknown.length > 0) {
      return NextResponse.json({ error: `Nepoznana polja: ${unknown.join(', ')}` }, { status: 400 })
    }

    // Interval pregledov: pozitivno celo število dni 1..3650 ali null (fail-closed).
    let inspectionIntervalDays: number | null | undefined
    if (body.inspectionIntervalDays !== undefined) {
      const raw = body.inspectionIntervalDays
      if (raw === null) inspectionIntervalDays = null
      else if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 1 && raw <= 3650) {
        inspectionIntervalDays = raw
      } else {
        return NextResponse.json(
          { error: 'inspectionIntervalDays mora biti celo število 1–3650 ali null' },
          { status: 400 },
        )
      }
    }

    // Kalibracijski rok: veljaven datum ali null (eksplicitno brisanje).
    let calibrationDueDate: Date | null | undefined
    if (body.calibrationDueDate !== undefined) {
      const raw = body.calibrationDueDate
      if (raw === null) calibrationDueDate = null
      else {
        const d = new Date(String(raw))
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json({ error: 'calibrationDueDate ni veljaven datum' }, { status: 400 })
        }
        calibrationDueDate = d
      }
    }

    const result = await db.$transaction(async (tx) => {
      const current = await tx.equipment.findUnique({ where: { id } })
      if (!current) return { kind: 'notfound' } as const

      // Status tranzicija (§31 matrika — neveljavna → 409 z dovoljenimi).
      let isTransition = false
      if (typeof body.status === 'string' && body.status !== current.status) {
        const verdict = checkTransition(current.status, body.status)
        if (!verdict.ok) {
          return {
            kind: 'conflict',
            from: current.status,
            to: body.status,
            allowed: verdict.allowed,
          } as const
        }
        isTransition = true
      }

      const updated = await tx.equipment.update({
        where: { id },
        data: {
          ...(typeof body.status === 'string' ? { status: body.status } : {}),
          ...(body.serijskaStevilka !== undefined
            ? { serijskaStevilka: body.serijskaStevilka === null ? null : String(body.serijskaStevilka).slice(0, 100) }
            : {}),
          ...(body.lokacija !== undefined
            ? { lokacija: body.lokacija === null ? null : String(body.lokacija).slice(0, 120) }
            : {}),
          ...(body.opomba !== undefined
            ? { opomba: body.opomba === null ? null : String(body.opomba).slice(0, 500) }
            : {}),
          ...(inspectionIntervalDays !== undefined ? { inspectionIntervalDays } : {}),
          ...(calibrationDueDate !== undefined ? { calibrationDueDate } : {}),
          ...(body.calibrationCertificate !== undefined
            ? { calibrationCertificate: body.calibrationCertificate === null ? null : String(body.calibrationCertificate).slice(0, 200) }
            : {}),
        },
      })

      // Revizija ATOMSKO s spremembo (§19) — oldValue = stanje pred spremembo.
      let auditUserId: string | null = null
      if (auth.kind === 'user') auditUserId = auth.session.sub
      await tx.auditLog.create({
        data: {
          userId: auditUserId,
          akcija: isTransition ? 'EQUIPMENT_STATUS' : 'EQUIPMENT_UPDATE',
          oldValue: JSON.stringify({
            equipmentId: id,
            status: current.status,
            serijskaStevilka: current.serijskaStevilka,
            inspectionIntervalDays: current.inspectionIntervalDays,
            calibrationDueDate: current.calibrationDueDate?.toISOString() ?? null,
            calibrationCertificate: current.calibrationCertificate,
          }),
          newValue: JSON.stringify({
            equipmentId: id,
            status: updated.status,
            ...(isTransition ? { from: current.status, to: updated.status } : {}),
          }),
        },
      })

      return { kind: 'updated', row: updated } as const
    })

    if (result.kind === 'notfound') {
      return NextResponse.json({ error: 'Oprema ne obstaja' }, { status: 404 })
    }
    if (result.kind === 'conflict') {
      return NextResponse.json(
        {
          error:
            result.allowed.length === 0
              ? `Oprema je UPOKOJENA (terminalno stanje) — status ${result.from} se ne spreminja več.`
              : `Neveljavna tranzicija ${result.from} → ${result.to}. Dovoljeni cilji: ${result.allowed.join(', ')}.`,
          allowed: result.allowed,
        },
        { status: 409 },
      )
    }

    // Ponovno preberi števce assignments (dto jih prikazuje).
    const count = await db.equipmentAssignment.count({ where: { equipmentId: id } })
    const now = new Date()
    return NextResponse.json(
      dto({ ...result.row, _count: { assignments: count } }, now),
    )
  } catch (error) {
    logWithCorrelation('equipment.patch', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri posodabljanju opreme', correlationId },
      { status: 500 },
    )
  }
}
