// Roksal Field - API: Meritve [id] — R153 (issue #5 §19)
// PATCH: sprememba statusa meritve (OSNUTEK → POTRJENA → ARHIVIRANA → …)
// z revizijsko sledjo v AuditLog (MEASUREMENT_STATUS, oldValue/newValue).
//
// Zgodovina: status je bil do R153 izključno UI koncept (po reloadu izginil);
// R152 je zato UI iskreno javil "API ne podpira PATCH". Ta ruta odstrani
// workaround: sprememba je PERZISTENTNA + revizijsko sledena.
//
// Fail-closed pravila:
//   • brisanje ostaje ZAVRTO po zasnovi (meritve so revizijski podatki, ki
//     napajajo BOM/dokazila — DELETE ni implementiran in ga ta ruta ne doda);
//   • ponovno odprtje ARHIVIRANE meritve ZAHTEVA opombo (razlog ≥ 3 znaki) —
//     arhiv je izključen iz aktivnih pregledov, vrnitev mora biti utemeljena;
//   • isti status = idempotenten 200 (changed:false, brez novega revizijskega
//     zapisa — retry ne ustvari šuma v reviziji);
//   • dostop = isti vrata kot POST /api/measurements (izvajalec projekta ali
//     vodstvo; SKLADISCE samo bere → 403).
// Meje vrednosti (dolzinaMm/visinaMm) NISO popravljive prek te rute —
// merilni podatki so revizijski; popravki gredo skozi vodjo (nov vnos).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { assertProjectAccess, actorIdOf, AccessDeniedError } from '@/lib/access'

const MEASUREMENT_STATUSES = ['OSNUTEK', 'POTRJENA', 'ARHIVIRANA'] as const

const patchMeasurementStatusSchema = z.object({
  status: z.enum(MEASUREMENT_STATUSES, {
    message: 'Status mora biti OSNUTEK, POTRJENA ali ARHIVIRANA',
  }),
  // Razlog spremembe — obvezen SAMO pri ponovnem odprtju arhiva (spodaj).
  note: z.string().max(500, 'Opomba je lahko največ 500 znakov').optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const actor = actorIdOf(auth)
  try {
    const { id } = await params
    const body = await request.json().catch(() => null)
    if (body === null || typeof body !== 'object') {
      return NextResponse.json({ error: 'Manjka telo zahtevka' }, { status: 400 })
    }
    const validated = patchMeasurementStatusSchema.parse(body)

    const measurement = await db.measurement.findUnique({ where: { id } })
    if (!measurement) {
      return NextResponse.json({ error: 'Meritev ne obstaja' }, { status: 404 })
    }

    // Dostop do meritve = dostop do projekta (403 na tuj projekt, 404 neznano).
    const project = await db.project.findUnique({ where: { id: measurement.projectId } })
    assertProjectAccess(auth, project, 'update')

    const oldStatus = measurement.status
    const newStatus = validated.status

    // Ponovno odprtje arhiva brez razloga → zavrnjeno (fail-closed).
    const reopeningArchive = oldStatus === 'ARHIVIRANA' && newStatus !== 'ARHIVIRANA'
    if (reopeningArchive && (!validated.note || validated.note.trim().length < 3)) {
      return NextResponse.json(
        {
          error:
            'Ponovno odpiranje arhivirane meritve zahteva opombo (razlog, vsaj 3 znaki) — arhivirane meritve so izključene iz aktivnih pregledov.',
        },
        { status: 400 }
      )
    }

    // Idempotenca: isti status → nič ne mutiramo, brez novega revizijskega
    // zapisa (retry ali dvakratni klik ne ustvarita revizijskega šuma).
    if (oldStatus === newStatus) {
      return NextResponse.json({ changed: false, measurement })
    }

    const statusUpdatedAt = new Date()
    const updated = await db.$transaction(async (tx) => {
      const row = await tx.measurement.update({
        where: { id },
        data: {
          status: newStatus,
          statusNote: validated.note?.trim() || null,
          statusUpdatedAt,
        },
      })
      await tx.auditLog.create({
        data: {
          userId: actor,
          projectId: measurement.projectId,
          akcija: 'MEASUREMENT_STATUS',
          oldValue: JSON.stringify({ status: oldStatus }),
          newValue: JSON.stringify({
            status: newStatus,
            note: validated.note?.trim() || null,
            statusUpdatedAt: statusUpdatedAt.toISOString(),
          }),
        },
      })
      return row
    })

    return NextResponse.json({ changed: true, measurement: updated })
  } catch (error: unknown) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error && typeof error === 'object' && 'issues' in error) {
      return NextResponse.json(
        { error: 'Neveljavni podatki', details: (error as { issues: unknown }).issues },
        { status: 400 }
      )
    }
    console.error('Measurement PATCH Error:', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju meritve' }, { status: 500 })
  }
}
