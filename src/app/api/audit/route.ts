// Roksal — revizijska sled za projekt
// ---------------------------------------------------------------------------
// Za sistem z digitalnim podpisom ponudbe in zaklepanjem dogovora je sled
// "kdo, kaj, kdaj, iz katerega IP" pravno pomembna. AuditLog je bil v shemi,
// a ga ni bilo mogoče prebrati — ta ruta ga odpre.
//
// Dostop: prijavljen uporabnik; za tuji projekt samo VODJA/ADMIN (monter vidi
// svoje projekte, ne pa vseh — a ker tabela Project nima neposredne povezave na
// "moje", preverimo vlogo ali monterId).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden, MANAGER_ROLES, hasRole } from '@/lib/auth'
import { readAudit } from '@/lib/audit'

const querySchema = z.object({
  projectId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(500).default(100),
})

export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth || auth.kind !== 'user') return unauthorized()

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({
    projectId: searchParams.get('projectId') ?? '',
    limit: searchParams.get('limit') ?? '100',
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Manjka ali je neveljaven projectId.' }, { status: 400 })
  }

  const project = await db.project.findUnique({
    where: { id: parsed.data.projectId },
    select: { id: true, monterId: true, vodjaId: true },
  })
  if (!project) return NextResponse.json({ error: 'Projekt ne obstaja.' }, { status: 404 })

  const isManager = hasRole(auth.session, MANAGER_ROLES)
  const isMine = project.monterId === auth.session.sub || project.vodjaId === auth.session.sub
  if (!isManager && !isMine) {
    return forbidden('Sled tega projekta lahko vidita samo vodja ali dodeljeni monter.')
  }

  const entries = await readAudit(parsed.data.projectId, parsed.data.limit)
  return NextResponse.json({ projectId: parsed.data.projectId, count: entries.length, entries })
}
