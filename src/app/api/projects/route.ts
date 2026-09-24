// Roksal Field - API: Projekti — S+9 (issue #4, §3 + §13 + §14)
// GET: filtrirano po vlogi (MONTER vidi svoje, vodstvo/skladišče vse).
// POST: ustvarjanje + audit v isti transakciji (brez ilegalnega userId 'system').
// PATCH: resource-level dostop + ENOTEN statusni stroj (preprečuje preskoke).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createProjectSchema, updateProjectSchema } from '@/lib/validations'
import { authenticate, unauthorized } from '@/lib/auth'
import {
  assertProjectAccess,
  projectWhereForPrincipal,
  actorIdOf,
  AccessDeniedError,
} from '@/lib/access'
import { assertTransition, InvalidTransitionError } from '@/lib/project-state'
import { auditInTx } from '@/lib/audit'

// GET - Pridobi projekte s podatki o strankah in meritvah (filtrirano po vlogi)
export async function GET(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const projects = await db.project.findMany({
      where: projectWhereForPrincipal(auth),
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
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const actor = actorIdOf(auth)
  try {
    const body = await request.json()
    const validated = createProjectSchema.parse(body)

    // Projekt + audit = ENA transakcija (issue #4, §13)
    const newProject = await db.$transaction(async (tx) => {
      const created = await tx.project.create({
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
      await tx.auditLog.create({
        data: {
          userId: actor,
          projectId: created.id,
          akcija: 'CREATE_PROJECT',
          newValue: JSON.stringify({ nazivProjekta: validated.nazivProjekta }),
        }
      })
      return created
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
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const actor = actorIdOf(auth)
  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Manjka ID projekta' }, { status: 400 })
    }

    const validated = updateProjectSchema.parse(updateData)

    // Resource-level dostop (issue #4, §3): 404 ne obstaja, 403 tuj projekt.
    const existing = await db.project.findUnique({ where: { id } })
    if (!existing) throw new AccessDeniedError(404, 'Projekt ne obstaja')
    assertProjectAccess(auth, existing, validated.status !== undefined ? 'changeStatus' : 'update')

    // Statusni stroj (issue #4, §14) — prehod mora biti dovoljen.
    if (validated.status !== undefined && validated.status !== existing.status) {
      assertTransition({
        from: existing.status,
        to: validated.status,
        principal: auth,
        dealLocked: existing.dealLocked,
      })
    }

    // followUpDate prihaja kot ISO string — Prisma želi Date ali null
    const { followUpDate, followUpOpomba, ...rest } = validated
    const data: Record<string, unknown> = { ...rest }
    if (followUpDate !== undefined) {
      data.followUpDate =
        followUpDate === null || followUpDate === '' ? null : new Date(followUpDate)
    }
    if (followUpOpomba !== undefined) data.followUpOpomba = followUpOpomba

    const statusChanged = data.status !== undefined && data.status !== existing.status

    // Update + (ob statusni spremembi) audit = ENA transakcija.
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.project.update({
        where: { id },
        data,
        include: {
          customer: true,
          monter: { select: { id: true, ime: true } },
        }
      })
      if (statusChanged) {
        await tx.auditLog.create({
          data: {
            userId: actor,
            projectId: id,
            akcija: 'STATUS_SPREMENJEN',
            oldValue: existing.status,
            newValue: String(data.status),
          },
        })
      }
      return result
    })

    return NextResponse.json(updated)
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
    console.error('Projects PATCH Error:', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju projekta' }, { status: 500 })
  }
}
