// R145 (issue #5 §31 — Equipment lifecycle): zgodovina pregledov/kalibracij/
// servisov/popravil opreme.
//
// GET  ?equipmentId=…  — zadnjih 20 dogodkov opreme (deterministični red:
//       performedAt DESC, createdAt DESC, id DESC = totalen red), §17 DTO.
// POST — zabeleži dogodek + ATOMSKO posodobi življenjska polja opreme:
//         PREGLED     → lastInspectionAt = performedAt
//         KALIBRACIJA → lastCalibration... = performedAt + potrdilo + rok
//                       (certificate OBVEZEN na merski opremi — fail-closed;
//                        nemerska oprema → 400, kalibracija ni relevantna)
//         SERVIS/POPRAVILO → zadnjiServis = performedAt
//       Fail-closed: neznana oprema 404, prihodnji performedAt 400
//       ("nikoli izmišljevanje izvedbe v prihodnosti"), neznani tip/rezultat
//       400. Pravice: production.manage. Revizija ATOMSKO (§19).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized, denyWithoutPermission } from '@/lib/auth'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import {
  EQUIPMENT_EVENT_TYPES,
  EQUIPMENT_EVENT_RESULTS,
  eventUpdatesField,
  type EquipmentEventType,
  type EquipmentEventResult,
} from '@/lib/equipment-lifecycle'

const MAX_EVENTS = 20

export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const correlationId = correlationFromRequest(request)
  try {
    const equipmentId = new URL(request.url).searchParams.get('equipmentId')
    if (!equipmentId) {
      return NextResponse.json({ error: 'equipmentId je obvezen' }, { status: 400 })
    }
    const events = await db.equipmentEvent.findMany({
      where: { equipmentId },
      orderBy: [{ performedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_EVENTS,
      select: {
        id: true,
        type: true,
        performedAt: true,
        result: true,
        certificate: true,
        opomba: true,
        performedBy: { select: { ime: true } },
        createdAt: true,
      },
    })
    return NextResponse.json(
      events.map((ev) => ({
        id: ev.id,
        type: ev.type,
        performedAt: ev.performedAt.toISOString(),
        result: ev.result,
        certificate: ev.certificate,
        opomba: ev.opomba,
        performedBy: ev.performedBy?.ime ?? null,
      })),
    )
  } catch (error) {
    logWithCorrelation('equipment.events.get', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri branju zgodovine opreme', correlationId },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const denied = await denyWithoutPermission(request, 'production.manage')
  if (denied) return denied
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const correlationId = correlationFromRequest(request)

  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const equipmentId = typeof body?.equipmentId === 'string' ? body.equipmentId : null
    const type = typeof body?.type === 'string' ? (body.type as EquipmentEventType) : null
    const resultStr = body?.result === undefined ? 'V_REDU' : body?.result
    if (!equipmentId || !type) {
      return NextResponse.json({ error: 'equipmentId in type sta obvezna' }, { status: 400 })
    }
    if (!(EQUIPMENT_EVENT_TYPES as readonly string[]).includes(type)) {
      return NextResponse.json(
        { error: `Neznani tip dogodka. Dovoljeni: ${EQUIPMENT_EVENT_TYPES.join(', ')}` },
        { status: 400 },
      )
    }
    if (!(EQUIPMENT_EVENT_RESULTS as readonly string[]).includes(String(resultStr))) {
      return NextResponse.json(
        { error: `Neznani rezultat. Dovoljeni: ${EQUIPMENT_EVENT_RESULTS.join(', ')}` },
        { status: 400 },
      )
    }
    const result = String(resultStr) as EquipmentEventResult

    // performedAt: privzeto ZDAJ; eksplicitno podan mora biti veljaven in NE
    // v prihodnosti (izvedbe v prihodnosti = izmišljevanje — fail-closed).
    let performedAt = new Date()
    if (body?.performedAt !== undefined && body?.performedAt !== null) {
      performedAt = new Date(String(body.performedAt))
      if (Number.isNaN(performedAt.getTime())) {
        return NextResponse.json({ error: 'performedAt ni veljaven datum' }, { status: 400 })
      }
    }
    if (performedAt.getTime() > Date.now()) {
      return NextResponse.json(
        { error: 'Datum izvedbe ne more biti v prihodnosti' },
        { status: 400 },
      )
    }

    const certificate =
      body?.certificate === undefined || body?.certificate === null
        ? null
        : String(body.certificate).slice(0, 200)
    const opomba =
      body?.opomba === undefined || body?.opomba === null
        ? null
        : String(body.opomba).slice(0, 500)
    // KALIBRACIJA lahko NASTAVI nov rok (s potrdila); neveljaven → 400.
    let nextDueDate: Date | null = null
    if (type === 'KALIBRACIJA' && body?.nextDueDate !== undefined && body?.nextDueDate !== null) {
      nextDueDate = new Date(String(body.nextDueDate))
      if (Number.isNaN(nextDueDate.getTime())) {
        return NextResponse.json({ error: 'nextDueDate ni veljaven datum' }, { status: 400 })
      }
    }

    const outcome = await db.$transaction(async (tx) => {
      const equipment = await tx.equipment.findUnique({ where: { id: equipmentId } })
      if (!equipment) return { kind: 'notfound' } as const

      // §31: kalibracija je relevantna SAMO za mersko opremo; na merski
      // opremi je potrdilo OBVEZNO (sicer bi "kalibracija" brez dokazila
      // tiho povrnila uporabnost — tihon degradiranje varnosti).
      if (type === 'KALIBRACIJA') {
        if (!equipment.calibrationRequired) {
          return { kind: 'badcalibration', naziv: equipment.naziv } as const
        }
        if (!certificate) {
          return { kind: 'badcertificate', naziv: equipment.naziv } as const
        }
      }

      const event = await tx.equipmentEvent.create({
        data: {
          equipmentId,
          type,
          performedAt,
          result,
          certificate,
          opomba,
          performedById: auth.kind === 'user' ? auth.session.sub : null,
        },
      })

      // Deterministična trasa eventa → življenjska polja opreme (ENO mesto
      // resnice: eventUpdatesField). NAPAKA rezultat NE posodablja polj
      // (pregled z napako ni "zadnji veljaven pregled" — iskreno stanje).
      let updated = equipment
      if (result === 'V_REDU') {
        const field = eventUpdatesField(type)
        const data =
          field === 'lastInspectionAt'
            ? { lastInspectionAt: performedAt }
            : field === 'calibration'
              ? {
                  calibrationDueDate:
                    nextDueDate ?? equipment.calibrationDueDate,
                  calibrationCertificate: certificate ?? equipment.calibrationCertificate,
                }
              : { zadnjiServis: performedAt }
        updated = await tx.equipment.update({ where: { id: equipmentId }, data })
      }

      let auditUserId: string | null = null
      if (auth.kind === 'user') auditUserId = auth.session.sub
      await tx.auditLog.create({
        data: {
          userId: auditUserId,
          akcija: 'EQUIPMENT_EVENT',
          oldValue: JSON.stringify({
            equipmentId,
            status: equipment.status,
            lastInspectionAt: equipment.lastInspectionAt?.toISOString() ?? null,
            calibrationDueDate: equipment.calibrationDueDate?.toISOString() ?? null,
          }),
          newValue: JSON.stringify({ eventId: event.id, type, result, performedAt: performedAt.toISOString() }),
        },
      })

      return { kind: 'created', event, equipment: updated } as const
    })

    if (outcome.kind === 'notfound') {
      return NextResponse.json({ error: 'Oprema ne obstaja' }, { status: 404 })
    }
    if (outcome.kind === 'badcalibration') {
      return NextResponse.json(
        { error: `Kalibracija je relevantna samo za mersko opremo — "${outcome.naziv}" ni merska.` },
        { status: 400 },
      )
    }
    if (outcome.kind === 'badcertificate') {
      return NextResponse.json(
        { error: `Merska oprema "${outcome.naziv}" ZAHTEVA potrdilo o kalibraciji (fail-closed).` },
        { status: 400 },
      )
    }

    return NextResponse.json(
      {
        id: outcome.event.id,
        type: outcome.event.type,
        performedAt: outcome.event.performedAt.toISOString(),
        result: outcome.event.result,
      },
      { status: 201 },
    )
  } catch (error) {
    logWithCorrelation('equipment.events.post', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri beleženju dogodka opreme', correlationId },
      { status: 500 },
    )
  }
}
