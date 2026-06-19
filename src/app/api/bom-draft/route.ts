// Roksal Field - API: BOM Draft (V4.1)
// GET /api/bom-draft?projectId=X — pridobi BOM draft za projekt
// PATCH /api/bom-draft — posodobi BOM draft (dodaj/odstrani artikle)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET — pridobi BOM draft
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { bomDraftJson: true, dealLocked: true, dealLockedAt: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Projekt ni najden' }, { status: 404 })
    }

    if (!project.bomDraftJson) {
      return NextResponse.json({
        bomDraft: null,
        dealLocked: project.dealLocked,
        message: 'BOM draft še ni generiran. Zakleni deal po podpisu.',
      })
    }

    return NextResponse.json({
      bomDraft: JSON.parse(project.bomDraftJson),
      dealLocked: project.dealLocked,
      dealLockedAt: project.dealLockedAt,
    })
  } catch (error) {
    console.error('BOM Draft GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju BOM draft-a' }, { status: 500 })
  }
}

// PATCH — posodobi BOM draft (uredi artikle, dodaj opombe)
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { projectId, items, notes } = body as {
      projectId: string
      items?: Array<{ kategorija: string; naziv: string; kolicina: number; enota: string; opomba?: string }>
      notes?: string
    }

    if (!projectId) {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { bomDraftJson: true, dealLocked: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Projekt ni najden' }, { status: 404 })
    }

    if (!project.dealLocked) {
      return NextResponse.json({ error: 'Deal mora biti zaklenjen pred urejanjem BOM draft-a' }, { status: 400 })
    }

    const existing = project.bomDraftJson ? JSON.parse(project.bomDraftJson) : { items: [] }
    const updated = {
      ...existing,
      items: items || existing.items,
      notes: notes || existing.notes,
      updatedAt: new Date().toISOString(),
    }

    await db.project.update({
      where: { id: projectId },
      data: { bomDraftJson: JSON.stringify(updated) },
    })

    // AuditLog
    await db.auditLog.create({
      data: {
        userId: 'system',
        projectId,
        akcija: 'BOM_DRAFT_UPDATED',
        newValue: JSON.stringify({ itemCount: updated.items.length }),
      },
    })

    return NextResponse.json({ success: true, bomDraft: updated })
  } catch (error) {
    console.error('BOM Draft PATCH Error:', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju BOM draft-a' }, { status: 500 })
  }
}
