// Roksal Field - API: Sinhronizacija z mobilno aplikacijo
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createProjectSchema } from '@/lib/validations'

// Simple API key authentication for mobile sync
const isValidApiKey = (key: string | null): boolean => {
  if (!key) return false
  // In production, validate against a database or environment variable
  return key.startsWith('ROKSAL_MOBILE_') && key.length >= 20
}

// POST - Sprejme podatke iz mobilne aplikacije in ustvari/posodobi projekte
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Neveljavna avtentikacija' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    if (!isValidApiKey(token)) {
      return NextResponse.json({ error: 'Neveljaven token' }, { status: 401 })
    }

    const mobileProjects = Array.isArray(body) ? body : [body]
    const syncedProjects = []

    for (const mobileProject of mobileProjects) {
      let existingProject = await db.project.findFirst({
        where: {
          mobileProjectId: mobileProject.id,
        }
      })

      if (existingProject) {
        const updated = await db.project.update({
          where: { id: existingProject.id },
          data: {
            status: mobileProject.status || existingProject.status,
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
        let customer = await db.customer.findFirst({
          where: {
            OR: [
              { email: mobileProject.customerEmail },
              { telefon: mobileProject.phone }
            ]
          }
        })

        if (!customer) {
          customer = await db.customer.create({
            data: {
              ime: mobileProject.customerName,
              naslov: mobileProject.address,
              telefon: mobileProject.phone || null,
              email: mobileProject.customerEmail || null,
            }
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
