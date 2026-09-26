// R146 (issue #5 §27 — Quality control gate): struktuirana preverba kakovosti.
//
// GET  ?projectId=…  — najnovejša preverba projekta (determinističen red:
//       approvedAt DESC, createdAt DESC, id DESC), §17 minimalni DTO.
// POST — shrani preverbo: items strogo validirani proti VERZIJIRANI predlogi
//       v lib/qc-gate.ts (fail-closed: manjkajoč/dodatn ključ, ne-boolean
//       checked, opomba OBVEZNA pri neizpolnjeni postavki). passed +
//       defectsCount so IZRAČUNANI (ne zaupamo klientu). Revizija QC_SUBMITTED
//       ATOMSKO s zapisom (§19). Odobritelj = seja (approvedBy/approvedAt §27).
//
// Pravice: branje član projekta (+ skladišče za material kontekst, isti prag
// kot meritve); zapis MONTER+ na projektu (terensko delo) — R155 vrata
// assertProjectAccess (prej je bila samo prijava — BOLA, popravljeno).
// Fail-closed vrata ZAKLJUCENO so v PATCH /api/schedules (override tam).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { assertProjectAccess, AccessDeniedError } from '@/lib/access'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import {
  QC_TEMPLATE_VERSION,
  validateQCItems,
  computePassed,
  countDefects,
} from '@/lib/qc-gate'

const MAX_NOTE = 500

export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const correlationId = correlationFromRequest(request)
  try {
    const projectId = new URL(request.url).searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }
    // R155: dostop do preverbe = dostop do projekta (404 neznana, 403 tuja).
    const project = await db.project.findUnique({ where: { id: projectId } })
    assertProjectAccess(auth, project, 'read')
    const latest = await db.qualityControl.findFirst({
      where: { projectId },
      orderBy: [{ approvedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        projectId: true,
        scheduleId: true,
        templateVersion: true,
        itemsJson: true,
        passed: true,
        defectsCount: true,
        note: true,
        approvedBy: { select: { ime: true } },
        approvedAt: true,
      },
    })
    if (!latest) return NextResponse.json({ qualityControl: null })
    return NextResponse.json({
      qualityControl: {
        id: latest.id,
        projectId: latest.projectId,
        scheduleId: latest.scheduleId,
        templateVersion: latest.templateVersion,
        items: JSON.parse(latest.itemsJson),
        passed: latest.passed,
        defectsCount: latest.defectsCount,
        note: latest.note,
        approvedBy: latest.approvedBy?.ime ?? null,
        approvedAt: latest.approvedAt.toISOString(),
      },
    })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logWithCorrelation('qc.get', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri branju preverbe kakovosti', correlationId },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const correlationId = correlationFromRequest(request)
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    let projectId = typeof body?.projectId === 'string' ? body.projectId : null
    const scheduleId = typeof body?.scheduleId === 'string' ? body.scheduleId : null
    // Fail-closed derivacija: če je podan SAMO scheduleId, se projectId
    // izvede iz termina (neznana termina → 400 — ne ugibamo).
    if (!projectId && scheduleId) {
      const sched = await db.installationSchedule.findUnique({
        where: { id: scheduleId },
        select: { projectId: true },
      })
      if (!sched) {
        return NextResponse.json({ error: 'Termin ne obstaja' }, { status: 400 })
      }
      projectId = sched.projectId
    }
    if (!projectId) {
      return NextResponse.json({ error: 'projectId (ALI scheduleId) je obvezen' }, { status: 400 })
    }
    // R155: zapis preverbe = mutacija projekta (isti prag kot meritve POST);
    // vrata PRED transakcijo — po 403 je baza NESPREMENJENA.
    const gateProject = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, monterId: true, vodjaId: true, dealLocked: true },
    })
    assertProjectAccess(auth, gateProject, 'update')
    if (!body || !('items' in body)) {
      return NextResponse.json({ error: 'items so obvezni' }, { status: 400 })
    }
    const verdict = validateQCItems(body.items)
    if ('error' in verdict) {
      return NextResponse.json({ error: verdict.error }, { status: 400 })
    }
    const items = verdict.items
    const passed = computePassed(items)
    const defectsCount = countDefects(items)
    const note =
      typeof body.note === 'string' && body.note.trim().length > 0
        ? body.note.trim().slice(0, MAX_NOTE)
        : null

    // scheduleId, če je podan, MORA obstajati in pripadati projektu (fail-closed
    // proti tujim FK povezavam; neznana oprema termina → 400).
    if (scheduleId) {
      const sched = await db.installationSchedule.findUnique({
        where: { id: scheduleId },
        select: { projectId: true },
      })
      if (!sched || sched.projectId !== projectId) {
        return NextResponse.json(
          { error: 'Termin ne obstaja ali ne pripada projektu' },
          { status: 400 },
        )
      }
    }

    const outcome = await db.$transaction(async (tx) => {
      const project = await tx.project.findUnique({ where: { id: projectId }, select: { id: true } })
      if (!project) return { kind: 'notfound' } as const

      const created = await tx.qualityControl.create({
        data: {
          projectId,
          ...(scheduleId ? { scheduleId } : {}),
          templateVersion: QC_TEMPLATE_VERSION,
          itemsJson: JSON.stringify(items),
          passed,
          defectsCount,
          ...(note ? { note } : {}),
          approvedById: auth.kind === 'user' ? auth.session.sub : null,
        },
      })

      let auditUserId: string | null = null
      if (auth.kind === 'user') auditUserId = auth.session.sub
      await tx.auditLog.create({
        data: {
          userId: auditUserId,
          projectId,
          akcija: 'QC_SUBMITTED',
          oldValue: null,
          newValue: JSON.stringify({
            qcId: created.id,
            templateVersion: QC_TEMPLATE_VERSION,
            passed,
            defectsCount,
            ...(scheduleId ? { scheduleId } : {}),
          }),
        },
      })

      return { kind: 'created', created } as const
    })

    if (outcome.kind === 'notfound') {
      return NextResponse.json({ error: 'Projekt ne obstaja' }, { status: 404 })
    }

    return NextResponse.json(
      {
        id: outcome.created.id,
        passed: outcome.created.passed,
        defectsCount: outcome.created.defectsCount,
        templateVersion: outcome.created.templateVersion,
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logWithCorrelation('qc.post', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri shranjevanju preverbe kakovosti', correlationId },
      { status: 500 },
    )
  }
}
