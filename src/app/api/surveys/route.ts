// Roksal Field - API: Terenski pregled (site survey) — zapisnik monterja pred montažo (runda Q)
// En zapisnik na projekt (upsert): tip objekta, pritrditev, podlaga, ovire, dostop,
// foto kontrolni seznam → UI iz tega generira pametni seznam "s seboj prinesti".
// R155 (P1 bug fix — zaključek IDOR pregleda): do zdaj je ruta preverila SAMO
// prijavo — vsak avtenticiran uporabnik je lahko BRAL terenski pregled TUJEGA
// projekta in GA PREGAL (upsert) brez da bi projekt sploh videl. Zdaj isti
// vrata kot sestrske rute (slopes R154, sketches R120, measurements):
//   • GET  → assertProjectAccess(auth, project, 'read')
//   • POST → assertProjectAccess(auth, project, 'update') — upsert je mutacija
//     projektne podatkovne zbirke (isti prag kot dodajanje meritve).
// Neznani projectId → 404 (prej tihi Prisma FK P2003 → 500), tuj projekt → 403.
// Nič ni zapisano, preden vrata prestanejo (fail-closed red).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticate, unauthorized } from '@/lib/auth'
import { assertProjectAccess, AccessDeniedError } from '@/lib/access'

const TIP_OBJEKTA = ['balkon', 'stopnice', 'terasa', 'loggia', 'friz', 'prehod'] as const
const OBLIKA = ['ravno', 'L', 'U', 'krog'] as const
const PRITRDITEV = ['obrobna', 'tloris', 'stena', 'mesano'] as const
const PODLAGA = ['beton', 'estrih', 'les', 'kovina', 'plocice', 'neznan'] as const
const RAL_CODES = ['7016', '9005', '9016', '6005', '8017'] as const

const surveySchema = z.object({
  projectId: z.string().min(1, 'ID projekta je obvezen'),
  tipObjekta: z.enum(TIP_OBJEKTA).default('balkon'),
  oblika: z.enum(OBLIKA).default('ravno'),
  pritrditev: z.enum(PRITRDITEV).default('obrobna'),
  podlaga: z.enum(PODLAGA).default('neznan'),
  ralCode: z.enum(RAL_CODES).nullable().optional(),
  razponNajdaljsiMm: z.number().int().min(0).max(20000).nullable().optional(),
  skupnaDolzinaMm: z.number().int().min(0).max(100000).nullable().optional(),
  visinaMm: z.number().int().min(0).max(10000).nullable().optional(),
  steviloStopnic: z.number().int().min(0).max(200).nullable().optional(),
  razhodMm: z.number().int().min(0).max(500).nullable().optional(),
  ovire: z.string().max(200).nullable().optional(),
  dvigalo: z.boolean().default(false),
  dostopOpomba: z.string().max(500).nullable().optional(),
  fotoPosneto: z.string().max(120).nullable().optional(),
  opombe: z.string().max(1000).nullable().optional(),
  zakljuceno: z.boolean().default(false),
})

export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }
    // R155: dostop do terenskega pregleda = dostop do projekta (404 neznana, 403 tuja).
    const project = await db.project.findUnique({ where: { id: projectId } })
    assertProjectAccess(auth, project, 'read')
    const survey = await db.siteSurvey.findUnique({ where: { projectId } })
    return NextResponse.json(survey)
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Survey GET error:', error)
    return NextResponse.json({ error: 'Napaka pri branju terenskega pregleda' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const body = await request.json()
    const validated = surveySchema.parse(body)
    const { projectId, ...data } = validated

    // R155: upsert pregleda = mutacija projekta (isti prag kot meritve POST);
    // vrata PRED zapisom — po 403 je baza NESPREMENJENA.
    const project = await db.project.findUnique({ where: { id: projectId } })
    assertProjectAccess(auth, project, 'update')

    const survey = await db.siteSurvey.upsert({
      where: { projectId },
      create: { projectId, ...data },
      update: data,
    })
    return NextResponse.json(survey)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Neveljavni podatki', details: error.issues }, { status: 400 })
    }
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Survey POST error:', error)
    return NextResponse.json({ error: 'Napaka pri shranjevanju terenskega pregleda' }, { status: 500 })
  }
}
