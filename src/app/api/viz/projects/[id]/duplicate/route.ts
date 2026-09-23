// VIZ — /api/viz/projects/[id]/duplicate (runda S+5). Spec §16: podvoji projekt.
//
//   POST — podvoji LASTNIKOV projekt: kopira vse datoteke
//          viz/projects/<id>/* → viz/projects/<newId>/* (brez project.json),
//          ustvari NOV metadata zapis (name + " (kopija)"), isti lastnik.
//          Tuj projekt = 404 (enako kot GET/PATCH/DELETE — ne razkrivaj obstoja).
//
// Pogodba odgovora: { project: { id, name, createdAt } }
import { NextResponse } from 'next/server'
import { vizOwner } from '@/lib/viz/ownership'
import { vizList, vizCopy } from '@/lib/viz/storage'
import { duplicateProjectForOwner } from '@/lib/viz/repository'

export const runtime = 'nodejs'

/** Kopira vse projektne datoteke (brez metadata dokumenta) na nov id. */
async function copyProjectFiles(srcId: string, destId: string): Promise<number> {
  const prefix = `viz/projects/${srcId}/`
  const destPrefix = `viz/projects/${destId}/`
  const items = await vizList(prefix)
  let copied = 0
  for (const item of items) {
    if (item.key.endsWith('/project.json')) continue // metadata gre ločeno
    await vizCopy(item.key, item.key.replace(prefix, destPrefix))
    copied++
  }
  return copied
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // S+4/S+5: samo lastnik sme podvojiti; tuj projekt = 404.
  const ctx = await vizOwner(request)
  if (ctx instanceof Response) return ctx
  try {
    const { id } = await params
    const created = await duplicateProjectForOwner(id, ctx)
    if (!created) {
      return NextResponse.json({ error: 'Projekt ne obstaja' }, { status: 404 })
    }
    // Datoteke kopiramo ŠELE, ko je metadata zapis potrjen z lastniško preverbo —
    // če kopiranje odpove, je metadata brez datotek; takrat ga pobrišemo
    // (compensating cleanup, enako načelo kot save-flow v S+4).
    try {
      const copied = await copyProjectFiles(id, created.id)
      if (copied === 0) {
        throw new Error(`Ni datotek za kopiranje (vir viz/projects/${id}/)`)
      }
    } catch (copyError) {
      console.error('Viz project duplicate file copy error:', copyError)
      const { deleteProject } = await import('@/lib/viz/repository')
      await deleteProject(created.id).catch(() => undefined)
      return NextResponse.json({ error: 'Podvajanje ni uspelo — projekta nismo spremenili' }, { status: 500 })
    }
    return NextResponse.json({
      project: { id: created.id, name: created.name, createdAt: created.createdAt },
    })
  } catch (error) {
    console.error('Viz project duplicate error:', error)
    return NextResponse.json({ error: 'Napaka pri podvajanju projekta' }, { status: 500 })
  }
}
