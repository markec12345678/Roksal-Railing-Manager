// Roksal Field - API: Installation Schedules (V6)
// Koledar montaže — termini, ekipe, status
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { MANAGER_ROLES, denyUnless } from '@/lib/auth'

// GET — termini (z option projectId, crewId, datum range)
export async function GET(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const crewId = searchParams.get('crewId')
    const status = searchParams.get('status')
    const od = searchParams.get('od')
    const doD = searchParams.get('do')

    const where = {
      ...(projectId ? { projectId } : {}),
      ...(crewId ? { crewId } : {}),
      ...(status ? { status } : {}),
      ...(od || doD ? { datumZacetka: { ...(od ? { gte: new Date(od) } : {}), ...(doD ? { lte: new Date(doD) } : {}) } } : {}),
    }

    const schedules = await db.installationSchedule.findMany({
      where,
      include: {
        project: { select: { id: true, nazivProjekta: true, customer: { select: { ime: true, naslov: true } } } },
        crew: { select: { id: true, naziv: true, barva: true } },
        monter: { select: { id: true, ime: true } },
        equipment: { include: { equipment: { select: { id: true, naziv: true, tip: true } } } },
      },
      orderBy: { datumZacetka: 'asc' },
    })

    return NextResponse.json(schedules)
  } catch (error) {
    console.error('Schedules GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju terminov' }, { status: 500 })
  }
}

// POST — ustvari termin montaže
export async function POST(request: Request) {
  // Spreminjanje cen, zalog, naročil in razporedov je vodstveno opravilo.
  // Monter bere (za delo na terenu), pisati pa ne sme.
  const denied = await denyUnless(request, MANAGER_ROLES)
  if (denied) return denied
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const body = await request.json()
    const { projectId, crewId, monterId, datumZacetka, datumKonca, predvideneUre, opombe, lokacija } = body

    if (!projectId || !datumZacetka || !datumKonca) {
      return NextResponse.json({ error: 'projectId, datumZacetka, datumKonca so obvezni' }, { status: 400 })
    }

    // Preveri konflikte (isti crew ali monter v istem času)
    if (crewId) {
      const conflict = await db.installationSchedule.findFirst({
        where: {
          crewId,
          status: { in: ['NAVRTENO', 'V_TEKU'] },
          OR: [
            { datumZacetka: { lte: new Date(datumKonca) }, datumKonca: { gte: new Date(datumZacetka) } },
          ],
        },
      })
      if (conflict) {
        return NextResponse.json({ error: 'Ekipa ima že termin v tem času', conflict }, { status: 409 })
      }
    }

    const schedule = await db.installationSchedule.create({
      data: {
        projectId,
        crewId: crewId || null,
        monterId: monterId || null,
        datumZacetka: new Date(datumZacetka),
        datumKonca: new Date(datumKonca),
        predvideneUre: predvideneUre || 8,
        opombe: opombe || null,
        lokacija: lokacija || null,
        status: 'NAVRTENO',
      },
      include: {
        project: { select: { nazivProjekta: true, customer: { select: { ime: true, naslov: true } } } },
        crew: { select: { naziv: true, barva: true } },
      },
    })

    // Posodobi projekt status na V_IZDELAVI če je bil ZA_MONTAZO
    await db.project.updateMany({
      where: { id: projectId, status: 'ZA_MONTAZO' },
      data: { status: 'V_IZDELAVI' },
    })

    // AuditLog — userId mora obstajati v Profile (FK!), zato seje uporabimo
    // pravi id, API-ključ pa pade nazaj na demo profil. Zavito v try/catch:
    // revija ne sme pokvariti glavne operacije (prej je FK kršitev na
    // 'system' vrgla 500 in ustvarjanje termina je bilo pokvarjeno).
    try {
      let auditUserId = 'system'
      if (auth.kind === 'user') {
        auditUserId = auth.session.sub
      } else {
        const fallback = await db.profile.findFirst({ where: { vloga: 'ADMIN' }, select: { id: true } })
        if (fallback) auditUserId = fallback.id
      }
      await db.auditLog.create({
        data: {
          userId: auditUserId,
          projectId,
          akcija: 'SCHEDULE_CREATED',
          newValue: JSON.stringify({ scheduleId: schedule.id, datumZacetka, crewId }),
        },
      })
    } catch (auditError) {
      console.error('Audit log (schedule) napaka:', auditError)
    }

    return NextResponse.json(schedule, { status: 201 })
  } catch (error) {
    console.error('Schedules POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju termina' }, { status: 500 })
  }
}

// PATCH — spremeni status termina
export async function PATCH(request: Request) {
  // Spreminjanje cen, zalog, naročil in razporedov je vodstveno opravilo.
  // Monter bere (za delo na terenu), pisati pa ne sme.
  const denied = await denyUnless(request, MANAGER_ROLES)
  if (denied) return denied
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const body = await request.json()
    const { id, status, dejanskeUre, opombe } = body

    if (!id || !status) {
      return NextResponse.json({ error: 'id in status sta obvezna' }, { status: 400 })
    }

    const validStatusi = ['NAVRTENO', 'V_TEKU', 'ZAKLJUCENO', 'PREKlicANO', 'PRELOZENO']
    if (!validStatusi.includes(status)) {
      return NextResponse.json({ error: 'Neveljaven status' }, { status: 400 })
    }

    const updated = await db.installationSchedule.update({
      where: { id },
      data: {
        status,
        ...(dejanskeUre !== undefined ? { dejanskeUre } : {}),
        ...(opombe !== undefined ? { opombe } : {}),
      },
      include: { project: { select: { id: true, nazivProjekta: true } }, crew: { select: { naziv: true } } },
    })

    // Če je ZAKLJUCENO → posodobi projekt status na MONTIRANO
    if (status === 'ZAKLJUCENO') {
      await db.project.update({
        where: { id: updated.projectId },
        data: { status: 'MONTIRANO' },
      })
      // Odštej material iz zaloge (iz BOM draft)
      const project = await db.project.findUnique({ where: { id: updated.projectId }, select: { bomDraftJson: true } })
      if (project?.bomDraftJson) {
        const bom = JSON.parse(project.bomDraftJson)
        for (const item of bom.items || []) {
          const inv = await db.inventory.findFirst({ where: { naziv: { contains: item.naziv.split(' ')[0] } } })
          if (inv) {
            await db.inventory.update({ where: { id: inv.id }, data: { kolicinaZaloga: { decrement: item.kolicina } } })
            await db.inventoryMovement.create({ data: { inventoryId: inv.id, kolicina: -item.kolicina, tipPremika: 'PORABA', projectId: updated.projectId } })
          }
        }
      }
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Schedules PATCH Error:', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju termina' }, { status: 500 })
  }
}

// DELETE — izbriši termin
export async function DELETE(request: Request) {
  // Spreminjanje cen, zalog, naročil in razporedov je vodstveno opravilo.
  // Monter bere (za delo na terenu), pisati pa ne sme.
  const denied = await denyUnless(request, MANAGER_ROLES)
  if (denied) return denied
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id je obvezen' }, { status: 400 })
    await db.installationSchedule.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Schedules DELETE Error:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju termina' }, { status: 500 })
  }
}
