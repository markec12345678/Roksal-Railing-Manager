// R147 (issue #5 §28 — Structured installation evidence): struktuirano
// montažno dokazilo — pred/po, lokacija, čas, akter, projekt, GPS po
// policyju, verzirani checklist, merilni dokaz, napake, dokaz predaje.
//
// GET  ?projectId=…  — lista dokazil projekta (determinističen red:
//       createdAt DESC, id DESC; §17 strop limit 100 / offset 10k) +
//       PORABA MATERIALA izvedena s strežnika iz StockLedger (agregat po
//       artikel — nikoli iz klienta, §28 "material consumption").
// POST — shrani dokazilo: lokacija/checklist/defects/GPS strogo validirani
//       proti lib/installation-evidence.ts (fail-closed); fotke MORAJO
//       obstajati, pripadati projektu in imeti pravilno kategorijo
//       (before = PRED, after = PO); meritev MORA pripadati projektu.
//       Revizija INSTALLATION_EVIDENCE_SUBMITTED ATOMSKO s zapisom (§19).
// PATCH — posodobitve + DOKAZ PREDAJE (handoverName + handoverAt = potrditev
//       predaje). Predaja je MOŽNA SAMO z obema fotkama (fail-closed 409).
//       Potrjena predaja ZAKLENE dokazilo (locked → nadaljnji PATCH 409).
//       Revizija INSTALLATION_EVIDENCE_UPDATED / _HANDOVER ATOMSKO.
//
// Pravice (R155 vrata assertProjectAccess — prej BOLA, samo prijava):
// branje član projekta (+ skladišče za material kontekst, isti prag kot
// meritve); zapis MONTER+ na projektu. Fail-closed: GPS brez izrecnega
// dovoljenja → 400 (ne tiho).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { assertProjectAccess, AccessDeniedError } from '@/lib/access'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import {
  IEV_TEMPLATE_VERSION,
  validateIEVChecklist,
  validateIEVDefects,
  validateIEVGps,
  validateIEVLocation,
  computeIEVFlags,
} from '@/lib/installation-evidence'

const MAX_NOTE = 500
const DEFAULT_LIMIT = 100
const MAX_LIMIT = 100
const MAX_OFFSET = 10_000

/** Fail-closed fotka: mora obstajati, pripadati projektu in imeti kategorijo. */
async function validEvidencePhoto(
  tx: { projectPhoto: { findUnique: (args: { where: { id: string }; select: { projectId: true; kategorija: true } }) => Promise<{ projectId: string; kategorija: string } | null> } },
  photoId: string,
  projectId: string,
  kategorija: 'PRED' | 'PO',
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const photo = await tx.projectPhoto.findUnique({
    where: { id: photoId },
    select: { projectId: true, kategorija: true },
  })
  if (!photo) return { ok: false, reason: 'Fotografija ne obstaja' }
  if (photo.projectId !== projectId) return { ok: false, reason: 'Fotografija ne pripada projektu' }
  if (photo.kategorija !== kategorija) {
    return { ok: false, reason: `Fotografija mora imeti kategorijo ${kategorija} (je ${photo.kategorija})` }
  }
  return { ok: true }
}

export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const correlationId = correlationFromRequest(request)
  try {
    const url = new URL(request.url)
    const projectId = url.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }
    const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? '', 10)
    const offsetRaw = Number.parseInt(url.searchParams.get('offset') ?? '', 10)
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_LIMIT) : DEFAULT_LIMIT
    const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? Math.min(offsetRaw, MAX_OFFSET) : 0
    const now = new Date()

    // R155 (IDOR zaključek): dostop do dokazil = dostop do projekta
    // (404 neznana, 403 tuja) — prej samo 404 preverba, brez lastniških vrat.
    const project = await db.project.findUnique({ where: { id: projectId } })
    assertProjectAccess(auth, project, 'read')

    const [rows, total, ledger] = await Promise.all([
      db.installationEvidence.findMany({
        where: { projectId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: offset,
        select: {
          id: true,
          projectId: true,
          scheduleId: true,
          templateVersion: true,
          lokacija: true,
          beforePhotoId: true,
          afterPhotoId: true,
          gpsLat: true,
          gpsLng: true,
          gpsConsentAt: true,
          checklistJson: true,
          measurementId: true,
          defectsJson: true,
          handoverName: true,
          handoverAt: true,
          note: true,
          createdBy: { select: { ime: true } },
          createdAt: true,
        },
      }),
      db.installationEvidence.count({ where: { projectId } }),
      // §28 material consumption — deterministični strežniški agregat:
      // samo ODHODI (kolicina < 0) na projektu, skupaj po artikel.
      db.stockLedger.groupBy({
        by: ['inventoryId'],
        where: { projectId, kolicina: { lt: 0 } },
        _sum: { kolicina: true },
        _count: { _all: true },
      }),
    ])

    // Artikel imena za agregat (determinističen red po šifri, nato naziv).
    const invIds = ledger.map((l) => l.inventoryId)
    const invRows = await db.inventory.findMany({
      where: { id: { in: invIds } },
      select: { id: true, naziv: true, sifraMateriala: true, enota: true },
    })
    const invById = new Map(invRows.map((i) => [i.id, i]))
    const materialConsumption = ledger
      .map((l) => {
        const inv = invById.get(l.inventoryId)
        return {
          artikelId: l.inventoryId,
          naziv: inv?.naziv ?? '(neznana artikel)',
          sifra: inv?.sifraMateriala ?? null,
          enota: inv?.enota ?? '',
          kolicina: Math.round((l._sum.kolicina ?? 0) * 1000) / 1000,
          dogodki: l._count._all,
        }
      })
      .sort((a, b) => (a.sifra ?? '').localeCompare(b.sifra ?? '') || a.naziv.localeCompare(b.naziv))

    return NextResponse.json({
      evidence: rows.map((r) => ({
        id: r.id,
        projectId: r.projectId,
        scheduleId: r.scheduleId,
        templateVersion: r.templateVersion,
        lokacija: r.lokacija,
        beforePhotoId: r.beforePhotoId,
        afterPhotoId: r.afterPhotoId,
        gps:
          r.gpsConsentAt !== null && r.gpsLat !== null && r.gpsLng !== null
            ? { gpsLat: r.gpsLat, gpsLng: r.gpsLng, consentAt: r.gpsConsentAt.toISOString() }
            : null,
        checklist: JSON.parse(r.checklistJson),
        measurementId: r.measurementId,
        defects: JSON.parse(r.defectsJson),
        handoverName: r.handoverName,
        handoverAt: r.handoverAt?.toISOString() ?? null,
        note: r.note,
        createdBy: r.createdBy?.ime ?? null,
        createdAt: r.createdAt.toISOString(),
        ...computeIEVFlags({
          beforePhotoId: r.beforePhotoId,
          afterPhotoId: r.afterPhotoId,
          checklistJson: r.checklistJson,
          defectsJson: r.defectsJson,
          handoverAt: r.handoverAt,
          now,
        }),
      })),
      total,
      limit,
      offset,
      materialConsumption,
    })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logWithCorrelation('evidence.get', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri branju montažnih dokazil', correlationId },
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
      if (!sched) return NextResponse.json({ error: 'Termin ne obstaja' }, { status: 400 })
      projectId = sched.projectId
    }
    if (!projectId) {
      return NextResponse.json({ error: 'projectId (ALI scheduleId) je obvezen' }, { status: 400 })
    }
    if (!body) return NextResponse.json({ error: 'Manjka telo zahteve' }, { status: 400 })

    // R155 (IDOR zaključek): zapis dokazila = mutacija projekta (isti prag kot
    // meritve POST); vrata PRED transakcijo — po 403 je baza NESPREMENJENA.
    const gateProject = await db.project.findUnique({ where: { id: projectId } })
    assertProjectAccess(auth, gateProject, 'update')

    const loc = validateIEVLocation(body.lokacija)
    if ('error' in loc) return NextResponse.json({ error: loc.error }, { status: 400 })
    if (body.checklist === undefined) {
      return NextResponse.json({ error: 'checklist je obvezen' }, { status: 400 })
    }
    const checklist = validateIEVChecklist(body.checklist)
    if ('error' in checklist) return NextResponse.json({ error: checklist.error }, { status: 400 })
    const defects = validateIEVDefects(body.defects)
    if ('error' in defects) return NextResponse.json({ error: defects.error }, { status: 400 })
    const gps = validateIEVGps(
      body.gps && typeof body.gps === 'object'
        ? (body.gps as { gpsConsent: unknown; gpsLat: unknown; gpsLng: unknown })
        : null,
    )
    if ('error' in gps) return NextResponse.json({ error: gps.error }, { status: 400 })

    const beforePhotoId = typeof body.beforePhotoId === 'string' ? body.beforePhotoId : null
    const afterPhotoId = typeof body.afterPhotoId === 'string' ? body.afterPhotoId : null
    const measurementId = typeof body.measurementId === 'string' ? body.measurementId : null
    const note =
      typeof body.note === 'string' && body.note.trim().length > 0
        ? body.note.trim().slice(0, MAX_NOTE)
        : null

    const outcome = await db.$transaction(async (tx) => {
      const project = await tx.project.findUnique({ where: { id: projectId }, select: { id: true } })
      if (!project) return { kind: 'notfound' } as const

      // scheduleId, če je podan, MORA obstajati in pripadati projektu (fail-closed).
      if (scheduleId) {
        const sched = await tx.installationSchedule.findUnique({
          where: { id: scheduleId },
          select: { projectId: true },
        })
        if (!sched || sched.projectId !== projectId) {
          return { kind: 'badSchedule' } as const
        }
      }
      // Fotke: kategorija + projektna pripadnost (fail-closed, §28 before/after).
      if (beforePhotoId) {
        const b = await validEvidencePhoto(tx, beforePhotoId, projectId, 'PRED')
        if (!b.ok) return { kind: 'badPhoto', reason: b.reason } as const
      }
      if (afterPhotoId) {
        const a = await validEvidencePhoto(tx, afterPhotoId, projectId, 'PO')
        if (!a.ok) return { kind: 'badPhoto', reason: a.reason } as const
      }
      // Merilni dokaz: mora obstajati in pripadati projektu (fail-closed).
      if (measurementId) {
        const m = await tx.measurement.findUnique({ where: { id: measurementId }, select: { projectId: true } })
        if (!m || m.projectId !== projectId) {
          return { kind: 'badMeasurement' } as const
        }
      }

      const created = await tx.installationEvidence.create({
        data: {
          projectId,
          ...(scheduleId ? { scheduleId } : {}),
          templateVersion: IEV_TEMPLATE_VERSION,
          lokacija: loc.lokacija,
          ...(beforePhotoId ? { beforePhotoId } : {}),
          ...(afterPhotoId ? { afterPhotoId } : {}),
          // GPS po policyju: soglasje → koordinate + čas soglasja (strežnik).
          ...(gps.gps.withConsent
            ? { gpsLat: gps.gps.gpsLat, gpsLng: gps.gps.gpsLng, gpsConsentAt: new Date() }
            : {}),
          checklistJson: JSON.stringify(checklist.items),
          ...(measurementId ? { measurementId } : {}),
          defectsJson: JSON.stringify(defects.defects),
          ...(note ? { note } : {}),
          ...(auth.kind === 'user' ? { createdById: auth.session.sub } : {}),
        },
      })

      let auditUserId: string | null = null
      if (auth.kind === 'user') auditUserId = auth.session.sub
      await tx.auditLog.create({
        data: {
          userId: auditUserId,
          projectId,
          akcija: 'INSTALLATION_EVIDENCE_SUBMITTED',
          oldValue: null,
          newValue: JSON.stringify({
            evidenceId: created.id,
            templateVersion: IEV_TEMPLATE_VERSION,
            ...(scheduleId ? { scheduleId } : {}),
            hasBefore: beforePhotoId !== null,
            hasAfter: afterPhotoId !== null,
            gpsConsent: gps.gps.withConsent,
            defectsCount: defects.defects.length,
          }),
        },
      })
      return { kind: 'created', created } as const
    })

    if (outcome.kind === 'notfound') {
      return NextResponse.json({ error: 'Projekt ne obstaja' }, { status: 404 })
    }
    if (outcome.kind === 'badSchedule') {
      return NextResponse.json({ error: 'Termin ne obstaja ali ne pripada projektu' }, { status: 400 })
    }
    if (outcome.kind === 'badPhoto') {
      return NextResponse.json({ error: outcome.reason }, { status: 400 })
    }
    if (outcome.kind === 'badMeasurement') {
      return NextResponse.json({ error: 'Meritev ne obstaja ali ne pripada projektu' }, { status: 400 })
    }

    return NextResponse.json(
      {
        id: outcome.created.id,
        templateVersion: outcome.created.templateVersion,
        lokacija: outcome.created.lokacija,
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logWithCorrelation('evidence.post', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri shranjevanju montažnega dokazila', correlationId },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const correlationId = correlationFromRequest(request)
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const id = typeof body?.id === 'string' ? body.id : null
    if (!id || !body) return NextResponse.json({ error: 'id je obvezen' }, { status: 400 })

    const existing = await db.installationEvidence.findUnique({
      where: { id },
      select: { id: true, projectId: true, handoverAt: true, beforePhotoId: true, afterPhotoId: true },
    })
    if (!existing) return NextResponse.json({ error: 'Dokazilo ne obstaja' }, { status: 404 })
    // R155 (IDOR zaključek): sprememba dokazila = mutacija njegovega projekta
    // (404 neznana, 403 tuja; deal-lock zavre prek 'update' vrata).
    const gateProject = await db.project.findUnique({ where: { id: existing.projectId } })
    assertProjectAccess(auth, gateProject, 'update')
    // Zaklenjeno = potrjena predaja (deterministična funkcija zapisa).
    if (existing.handoverAt !== null) {
      return NextResponse.json(
        { error: 'Dokazilo je zaklenjeno s potrjeno predajo — spremembe niso mogoče' },
        { status: 409 },
      )
    }

    // Validacije VSE pred transakcijo (vzorec R146: vrata pred mutacijo).
    let lokacija: string | null = null
    if ('lokacija' in body) {
      const loc = validateIEVLocation(body.lokacija)
      if ('error' in loc) return NextResponse.json({ error: loc.error }, { status: 400 })
      lokacija = loc.lokacija
    }
    let checklistJson: string | null = null
    let checklistAllChecked: boolean | null = null
    if ('checklist' in body) {
      const checklist = validateIEVChecklist(body.checklist)
      if ('error' in checklist) return NextResponse.json({ error: checklist.error }, { status: 400 })
      checklistJson = JSON.stringify(checklist.items)
      checklistAllChecked = checklist.items.every((i) => i.checked)
    }
    let defectsJson: string | null = null
    let defectsCount = 0
    if ('defects' in body) {
      const defects = validateIEVDefects(body.defects)
      if ('error' in defects) return NextResponse.json({ error: defects.error }, { status: 400 })
      defectsJson = JSON.stringify(defects.defects)
      defectsCount = defects.defects.length
    }
    let gpsPatch: { gpsLat: number | null; gpsLng: number | null; gpsConsentAt: Date | null } | null = null
    if ('gps' in body) {
      const gps = validateIEVGps(
        body.gps && typeof body.gps === 'object'
          ? (body.gps as { gpsConsent: unknown; gpsLat: unknown; gpsLng: unknown })
          : null,
      )
      if ('error' in gps) return NextResponse.json({ error: gps.error }, { status: 400 })
      gpsPatch = gps.gps.withConsent
        ? { gpsLat: gps.gps.gpsLat, gpsLng: gps.gps.gpsLng, gpsConsentAt: new Date() }
        : { gpsLat: null, gpsLng: null, gpsConsentAt: null }
    }
    let beforePhotoId: string | null | undefined
    if ('beforePhotoId' in body) {
      beforePhotoId = typeof body.beforePhotoId === 'string' ? body.beforePhotoId : null
    }
    let afterPhotoId: string | null | undefined
    if ('afterPhotoId' in body) {
      afterPhotoId = typeof body.afterPhotoId === 'string' ? body.afterPhotoId : null
    }
    let measurementId: string | null | undefined
    if ('measurementId' in body) {
      measurementId = typeof body.measurementId === 'string' ? body.measurementId : null
    }
    const note =
      typeof body.note === 'string' && body.note.trim().length > 0
        ? body.note.trim().slice(0, MAX_NOTE)
        : null
    // Predaja: fail-closed vnos — ime mora biti ne-prazno (≤ 200).
    const handoverRaw = body.handoverName
    const confirmHandover = typeof handoverRaw === 'string' && handoverRaw.trim().length > 0
    if (handoverRaw !== undefined && !confirmHandover) {
      return NextResponse.json(
        { error: 'Predaja zahteva ime predajnika (izrecen prazen vnos ni veljaven)' },
        { status: 400 },
      )
    }
    const handoverName = confirmHandover ? (handoverRaw as string).trim().slice(0, 200) : null

    const outcome = await db.$transaction(async (tx) => {
      // Preveri fotke/meritev (vključno z NOVIMI stanji pred predajo).
      const effBefore = beforePhotoId !== undefined ? beforePhotoId : existing.beforePhotoId
      const effAfter = afterPhotoId !== undefined ? afterPhotoId : existing.afterPhotoId
      if (beforePhotoId) {
        const b = await validEvidencePhoto(tx, beforePhotoId, existing.projectId, 'PRED')
        if (!b.ok) return { kind: 'badPhoto', reason: b.reason } as const
      }
      if (afterPhotoId) {
        const a = await validEvidencePhoto(tx, afterPhotoId, existing.projectId, 'PO')
        if (!a.ok) return { kind: 'badPhoto', reason: a.reason } as const
      }
      if (measurementId) {
        const m = await tx.measurement.findUnique({
          where: { id: measurementId },
          select: { projectId: true },
        })
        if (!m || m.projectId !== existing.projectId) {
          return { kind: 'badMeasurement' } as const
        }
      }
      // VRATA PRED mutacijo: predaja brez pred/po fotk → 409 (nič spremenjeno).
      if (confirmHandover && (effBefore === null || effAfter === null)) {
        return { kind: 'handoverBlocked' } as const
      }

      const updated = await tx.installationEvidence.update({
        where: { id },
        data: {
          ...(lokacija !== null ? { lokacija } : {}),
          ...(checklistJson !== null ? { checklistJson } : {}),
          ...(defectsJson !== null ? { defectsJson } : {}),
          ...(gpsPatch ?? {}),
          ...(beforePhotoId !== undefined ? { beforePhotoId } : {}),
          ...(afterPhotoId !== undefined ? { afterPhotoId } : {}),
          ...(measurementId !== undefined ? { measurementId } : {}),
          ...(note ? { note } : {}),
          ...(confirmHandover ? { handoverName, handoverAt: new Date() } : {}),
        },
      })

      let auditUserId: string | null = null
      if (auth.kind === 'user') auditUserId = auth.session.sub
      await tx.auditLog.create({
        data: {
          userId: auditUserId,
          projectId: existing.projectId,
          akcija: confirmHandover ? 'INSTALLATION_EVIDENCE_HANDOVER' : 'INSTALLATION_EVIDENCE_UPDATED',
          oldValue: null,
          newValue: JSON.stringify({
            evidenceId: id,
            ...(confirmHandover ? { handoverName } : {}),
            ...(checklistAllChecked !== null ? { checklistAllChecked } : {}),
            ...(defectsJson !== null ? { defectsCount } : {}),
          }),
        },
      })
      return { kind: 'updated', updated } as const
    })

    if (outcome.kind === 'badPhoto') {
      return NextResponse.json({ error: outcome.reason }, { status: 400 })
    }
    if (outcome.kind === 'badMeasurement') {
      return NextResponse.json({ error: 'Meritev ne obstaja ali ne pripada projektu' }, { status: 400 })
    }
    if (outcome.kind === 'handoverBlocked') {
      return NextResponse.json(
        { error: 'Predaja brez PRED in PO fotografije ni mogoča — dodajte fotke, preden potrdite predajo' },
        { status: 409 },
      )
    }

    return NextResponse.json({ id: outcome.updated.id, handoverAt: outcome.updated.handoverAt?.toISOString() ?? null })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logWithCorrelation('evidence.patch', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri posodabljanju montažnega dokazila', correlationId },
      { status: 500 },
    )
  }
}
