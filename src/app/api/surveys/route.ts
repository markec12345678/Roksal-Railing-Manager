// Roksal Field - API: Terenski pregled (site survey) — zapisnik monterja pred montažo (runda Q)
// En zapisnik na projekt (upsert): tip objekta, pritrditev, podlaga, ovire, dostop,
// foto kontrolni seznam → UI iz tega generira pametni seznam "s seboj prinesti".
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { authenticate, unauthorized } from '@/lib/auth'

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
    const survey = await db.siteSurvey.findUnique({ where: { projectId } })
    return NextResponse.json(survey)
  } catch (error) {
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
    console.error('Survey POST error:', error)
    return NextResponse.json({ error: 'Napaka pri shranjevanju terenskega pregleda' }, { status: 500 })
  }
}
