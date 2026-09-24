// Roksal Field - API: Sinhronizacija z mobilno aplikacijo
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createProjectSchema } from '@/lib/validations'
import { authenticate, unauthorized } from '@/lib/auth'
import { transitionAllowed } from '@/lib/project-state'
import type { ProjectStatus } from '@prisma/client'

// Avtentikacija: API ključ (mobilni klient) ali veljavna seja (brskalnik).
//
// POPRAVEK: prej je bilo preverjanje `key.startsWith('ROKSAL_MOBILE_') &&
// key.length >= 20`. Oblika ključa je bila v javnem repozitoriju, torej je bil
// vsak, ki jo je prebral, pooblaščen za pisanje v bazo. Zdaj se ključi ustvarijo
// z `bunx tsx tools/create-api-key.ts`, v bazi je samo njihov hash, posamezen
// ključ pa se da preklicati.

// POST - Sprejme podatke iz mobilne aplikacije in ustvari/posodobi projekte
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const auth = await authenticate(request)
    if (!auth) {
      return NextResponse.json(
        { error: 'Neveljavna avtentikacija', detail: 'Pričakujem `Authorization: Bearer rkm_…` ali veljavno sejo.' },
        { status: 401 },
      )
    }

    const mobileProjects = Array.isArray(body) ? body : [body]
    // Untyped `[]` infers `never[]`, so every push below was a type error.
    const syncedProjects: Array<Record<string, unknown>> = []

    for (const mobileProject of mobileProjects) {
      let existingProject = await db.project.findFirst({
        where: {
          mobileProjectId: mobileProject.id,
        }
      })

      if (existingProject) {
        // S+9 (issue #4, §14): mobilni klient NE sme preskočiti statusnega
        // stroja — predlagani status se upošteva SAMO, če je prehod veljaven.
        const proposed = mobileProject.status as string | undefined
        const nextStatus: ProjectStatus =
          proposed && proposed !== existingProject.status &&
          transitionAllowed({ from: existingProject.status, to: proposed, principal: auth, dealLocked: existingProject.dealLocked })
            ? (proposed as ProjectStatus)
            : existingProject.status
        const updated = await db.project.update({
          where: { id: existingProject.id },
          data: {
            status: nextStatus,
            opombe: mobileProject.extraNotes || existingProject.opombe,
            latitude: mobileProject.latitude ?? existingProject.latitude,
            longitude: mobileProject.longitude ?? existingProject.longitude,
            updatedAt: new Date(),
          },
          include: {
            customer: true,
            monter: { select: { id: true, ime: true } },
          }
        })
        syncedProjects.push(updated)
      } else {
        // POPRAVEK podvajanja: `OR: [{ email: null }, { telefon: null }]` se je
        // ujemal s PRVO stranko, ki nima e-pošte oziroma telefona, zato je vsaka
        // sinhronizacija brez teh podatkov našla napačno obstoječo stranko — ali pa
        // ustvarila novo in podvojila pravo. Pogoja zdaj dodamo samo, kadar imamo
        // dejansko vrednost, in iščemo po obeh ločeno (e-pošta je močnejši ključ).
        const email = (mobileProject.customerEmail ?? '').trim().toLowerCase() || null
        const phone = (mobileProject.phone ?? '').trim() || null

        let customer = email
          ? await db.customer.findFirst({ where: { email } })
          : null
        if (!customer && phone) {
          customer = await db.customer.findFirst({ where: { telefon: phone } })
        }
        if (!customer && mobileProject.id) {
          // Isti mobilni projekt že ima stranko — ne ustvarjaj dvojnikov.
          customer = await db.customer.findFirst({
            where: { projects: { some: { mobileProjectId: mobileProject.id } } },
          })
        }

        if (!customer) {
          customer = await db.customer.create({
            data: {
              ime: mobileProject.customerName || 'Neznana stranka',
              naslov: mobileProject.address || '',
              telefon: phone,
              email,
            },
          })
        }

        const newProject = await db.project.create({
          data: {
            nazivProjekta: `${mobileProject.customerName} - ${mobileProject.railingStyle}`,
            customerId: customer.id,
            status: mobileProject.status || 'NACRTOVANO',
            opombe: mobileProject.extraNotes || null,
            latitude: mobileProject.latitude ?? null,
            longitude: mobileProject.longitude ?? null,
            mobileProjectId: mobileProject.id,
            originalImagePath: mobileProject.originalImagePath || null,
            geminiEstimate: mobileProject.geminiEstimate || null,
            projectData: JSON.stringify({
              lengthCm: mobileProject.lengthCm,
              heightCm: mobileProject.heightCm,
              widthCm: mobileProject.widthCm,
              mountType: mobileProject.mountType,
              colorHex: mobileProject.colorHex,
              colorName: mobileProject.colorName,
              railingStyle: mobileProject.railingStyle,
            }),
          },
          include: {
            customer: true,
          }
        })
        syncedProjects.push(newProject)
      }
    }

    return NextResponse.json({
      message: `Sinhroniziranih ${syncedProjects.length} projektov`,
      projects: syncedProjects,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Sync POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri sinhronizaciji' }, { status: 500 })
  }
}

// GET - Vrne projekte za sinhronizacijo v mobilno aplikacijo
export async function GET(request: Request) {
  // Tudi branje projektov za sinhronizacijo je zaščiteno: seznam razkrije stranke in naslove.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const lastSync = searchParams.get('lastSync')

    let projects
    if (lastSync) {
      const syncDate = new Date(lastSync)
      projects = await db.project.findMany({
        where: {
          updatedAt: { gte: syncDate },
        },
        include: {
          customer: true,
          monter: { select: { id: true, ime: true } },
        },
        orderBy: { updatedAt: 'asc' }
      })
    } else {
      projects = await db.project.findMany({
        where: {
          mobileProjectId: { not: null }
        },
        include: {
          customer: true,
          monter: { select: { id: true, ime: true } },
        },
        orderBy: { updatedAt: 'asc' }
      })
    }

    return NextResponse.json({
      projects,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Sync GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju projektov' }, { status: 500 })
  }
}
