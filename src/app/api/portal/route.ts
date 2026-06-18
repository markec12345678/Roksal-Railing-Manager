// Roksal Field - API: Portal stranke (management endpoints)
// POST /api/portal {projectId, action: 'enable'|'disable'|'regenerate'|'update'}
// GET  /api/portal?projectId=X  ->  {enabled, token, url}
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - status portala za projekt
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        clientToken: true,
        clientPortalEnabled: true,
        clientNotes: true,
        estimatedPrice: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Projekt ni najden' }, { status: 404 })
    }

    return NextResponse.json({
      enabled: project.clientPortalEnabled,
      token: project.clientToken,
      url: project.clientToken ? `/portal/${project.clientToken}` : null,
      clientNotes: project.clientNotes,
      estimatedPrice: project.estimatedPrice,
    })
  } catch (error) {
    console.error('Portal GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju portala' }, { status: 500 })
  }
}

// POST - upravljanje portala (enable/disable/regenerate/update)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { projectId, action } = body as {
      projectId?: string
      action?: 'enable' | 'disable' | 'regenerate' | 'update'
      clientNotes?: string | null
      estimatedPrice?: number | null
      showPrice?: boolean
    }

    if (!projectId) {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }
    if (!action || !['enable', 'disable', 'regenerate', 'update'].includes(action)) {
      return NextResponse.json(
        { error: "action mora biti 'enable', 'disable', 'regenerate' ali 'update'" },
        { status: 400 }
      )
    }

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, clientToken: true },
    })
    if (!project) {
      return NextResponse.json({ error: 'Projekt ni najden' }, { status: 404 })
    }

    let updateData: Record<string, unknown> = {}

    if (action === 'enable') {
      updateData.clientPortalEnabled = true
      if (!project.clientToken) {
        updateData.clientToken = generateToken()
      }
    } else if (action === 'disable') {
      updateData.clientPortalEnabled = false
    } else if (action === 'regenerate') {
      updateData.clientToken = generateToken()
      updateData.clientPortalEnabled = true
    } else if (action === 'update') {
      if (typeof body.clientNotes === 'string' || body.clientNotes === null) {
        updateData.clientNotes = body.clientNotes?.trim() || null
      }
      if (typeof body.estimatedPrice === 'number' || body.estimatedPrice === null) {
        const price = body.estimatedPrice
        if (price !== null && (Number.isNaN(price) || price < 0)) {
          return NextResponse.json(
            { error: 'Cena mora biti pozitivno število' },
            { status: 400 }
          )
        }
        updateData.estimatedPrice = price
      }
    }

    const updated = await db.project.update({
      where: { id: projectId },
      data: updateData,
      select: {
        id: true,
        clientToken: true,
        clientPortalEnabled: true,
        clientNotes: true,
        estimatedPrice: true,
      },
    })

    try {
      await db.auditLog.create({
        data: {
          userId: 'system',
          projectId: updated.id,
          akcija: `PORTAL_${action.toUpperCase()}`,
          newValue: JSON.stringify({
            enabled: updated.clientPortalEnabled,
            hasToken: !!updated.clientToken,
          }),
        },
      })
    } catch {
      // ignore audit log failures
    }

    return NextResponse.json({
      enabled: updated.clientPortalEnabled,
      token: updated.clientToken,
      url: updated.clientToken ? `/portal/${updated.clientToken}` : null,
      clientNotes: updated.clientNotes,
      estimatedPrice: updated.estimatedPrice,
    })
  } catch (error) {
    console.error('Portal POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri upravljanju portala' }, { status: 500 })
  }
}

function generateToken(): string {
  const t = Date.now().toString(36)
  const rand =
    Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
  return `c${t}${rand}`
}
