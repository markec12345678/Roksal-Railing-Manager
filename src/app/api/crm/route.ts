// Roksal Field - API: CRM modul (V4.2)
// GET  /api/crm           — seznam strank z LTV, št. projektov, status, opomniki
// GET  /api/crm?id=X      — podrobnosti stranke z zgodovino projektov
// PATCH /api/crm          — posodobi CRM polja (status, opomnik, kontaktna oseba, opombe)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET — seznam strank z CRM podatki
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const status = searchParams.get('status') // AKTIVEN | NEAKTIVEN | POTENCIALEN | ARHIVIRAN
    const opomniki = searchParams.get('opomniki') === 'true' // samo z opomniki

    if (id) {
      // Podrobnosti ene stranke z zgodovino projektov
      const customer = await db.customer.findUnique({
        where: { id },
        include: {
          projects: {
            select: {
              id: true,
              nazivProjekta: true,
              status: true,
              dealLocked: true,
              dealLockedAt: true,
              estimatedPrice: true,
              createdAt: true,
              datumMontaze: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      })

      if (!customer) {
        return NextResponse.json({ error: 'Stranka ni najdena' }, { status: 404 })
      }

      // Izračunaj LTV (Life Time Value)
      const ltv = customer.projects.reduce((sum, p) => sum + (p.estimatedPrice || 0), 0)
      const zaklenjeniProjekti = customer.projects.filter(p => p.dealLocked).length

      return NextResponse.json({
        ...customer,
        ltv,
        zaklenjeniProjekti,
        skupajProjektov: customer.projects.length,
      })
    }

    // Seznam vseh strank z CRM podatki
    const where = {
      ...(status ? { status } : {}),
      ...(opomniki ? { opomnikDatum: { not: null } } : {}),
    }

    const customers = await db.customer.findMany({
      where,
      include: {
        projects: {
          select: {
            id: true,
            estimatedPrice: true,
            dealLocked: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Obogatite z LTV, št. projektov, opomnik status
    const enriched = customers.map((c) => {
      const ltv = c.projects.reduce((sum, p) => sum + (p.estimatedPrice || 0), 0)
      const zaklenjeni = c.projects.filter((p) => p.dealLocked).length
      const zadnjiProjekt = c.projects[0]?.createdAt || null

      // Opomnik status
      let opomnikStatus: 'NI' | 'AKTIVEN' | 'POTEKEL' = 'NI'
      if (c.opomnikDatum) {
        const days = Math.floor((c.opomnikDatum.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        if (days < 0) opomnikStatus = 'POTEKEL'
        else if (days <= 7) opomnikStatus = 'AKTIVEN'
      }

      return {
        id: c.id,
        ime: c.ime,
        naslov: c.naslov,
        telefon: c.telefon,
        email: c.email,
        status: c.status,
        kontaktnaOseba: c.kontaktnaOseba,
        kategorija: c.kategorija,
        opomnikDatum: c.opomnikDatum,
        opomnikOpis: c.opomnikOpis,
        zadnjiKontakt: c.zadnjiKontakt,
        opombeCRM: c.opombeCRM,
        createdAt: c.createdAt,
        ltv,
        zaklenjeni,
        skupajProjektov: c.projects.length,
        zadnjiProjekt,
        opomnikStatus,
      }
    })

    // Statistike
    const stats = {
      skupno: enriched.length,
      aktivni: enriched.filter((c) => c.status === 'AKTIVEN').length,
      neaktivni: enriched.filter((c) => c.status === 'NEAKTIVEN').length,
      potencialni: enriched.filter((c) => c.status === 'POTENCIALEN').length,
      zOpomniki: enriched.filter((c) => c.opomnikStatus !== 'NI').length,
      potekliOpomniki: enriched.filter((c) => c.opomnikStatus === 'POTEKEL').length,
      skupniLTV: enriched.reduce((sum, c) => sum + c.ltv, 0),
    }

    return NextResponse.json({
      customers: enriched,
      stats,
    })
  } catch (error) {
    console.error('CRM GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju CRM podatkov' }, { status: 500 })
  }
}

// PATCH — posodobi CRM polja stranke
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body as {
      id: string
      status?: string
      kontaktnaOseba?: string | null
      opomnikDatum?: string | null
      opomnikOpis?: string | null
      zadnjiKontakt?: string | null
      opombeCRM?: string | null
      kategorija?: string | null
    }

    if (!id) {
      return NextResponse.json({ error: 'id je obvezen' }, { status: 400 })
    }

    const updated = await db.customer.update({
      where: { id },
      data: {
        ...(updateData.status !== undefined ? { status: updateData.status } : {}),
        ...(updateData.kontaktnaOseba !== undefined ? { kontaktnaOseba: updateData.kontaktnaOseba } : {}),
        ...(updateData.opomnikDatum !== undefined ? { opomnikDatum: updateData.opomnikDatum ? new Date(updateData.opomnikDatum) : null } : {}),
        ...(updateData.opomnikOpis !== undefined ? { opomnikOpis: updateData.opomnikOpis } : {}),
        ...(updateData.zadnjiKontakt !== undefined ? { zadnjiKontakt: updateData.zadnjiKontakt ? new Date(updateData.zadnjiKontakt) : null } : {}),
        ...(updateData.opombeCRM !== undefined ? { opombeCRM: updateData.opombeCRM } : {}),
        ...(updateData.kategorija !== undefined ? { kategorija: updateData.kategorija } : {}),
      },
    })

    // AuditLog
    await db.auditLog.create({
      data: {
        userId: 'system',
        akcija: 'CRM_UPDATE',
        newValue: JSON.stringify({ customerId: id, fields: Object.keys(updateData) }),
      },
    })

    return NextResponse.json({ success: true, customer: updated })
  } catch (error) {
    console.error('CRM PATCH Error:', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju CRM' }, { status: 500 })
  }
}
