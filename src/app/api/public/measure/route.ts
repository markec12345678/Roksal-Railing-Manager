// Roksal Field - JAVNI API: samomeritev stranke prek povezave (/m/[token])
// Stranka brez prijave nariše črto ograje na satelitski karti (page /m/[token])
// in pošlje meritev. Povezava vsebuje clientToken projekta (isti kot portal).
//
// Varnost:
//  - token (cuid) mora obstajati v Project.clientToken
//  - omejitve: max 6 predlog na token/uro (in-memory), max 300 točk, max 8 kB body
//  - API NE razkrije nič drugega kot naziv projekta + ime stranke
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const pointSchema = z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)])

const submitSchema = z.object({
  token: z.string().min(10).max(64),
  points: z.array(pointSchema).min(2, 'Narišite vsaj 2 točki').max(300),
  skupajM: z.number().min(0.1).max(100000),
  opomba: z.string().max(500).optional().nullable(),
  imeStranke: z.string().max(120).optional().nullable(),
  telefonStranke: z.string().max(40).optional().nullable(),
  visinaMm: z.number().int().min(300).max(3000).optional(),
})

// Zelo preprost rate limiter v pomnilniku (resetira se ob restartu — dovolj za zlorabo)
const rateMap = new Map<string, { count: number; windowStart: number }>()
const RATE_LIMIT = 6
const RATE_WINDOW_MS = 60 * 60 * 1000

function rateLimited(key: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(key)
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateMap.set(key, { count: 1, windowStart: now })
    return false
  }
  entry.count += 1
  return entry.count > RATE_LIMIT
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    if (!token) {
      return NextResponse.json({ error: 'Manjka token' }, { status: 400 })
    }
    if (rateLimited(`get:${token}`)) {
      return NextResponse.json({ error: 'Preveč zahtevkov, poskusite pozneje' }, { status: 429 })
    }
    const project = await db.project.findUnique({
      where: { clientToken: token },
      select: {
        nazivProjekta: true,
        customer: { select: { ime: true } },
      },
    })
    if (!project) {
      return NextResponse.json({ error: 'Povezava ni veljavna' }, { status: 404 })
    }
    return NextResponse.json({
      nazivProjekta: project.nazivProjekta,
      stranka: project.customer?.ime ?? null,
    })
  } catch (error) {
    console.error('Public measure GET error:', error)
    return NextResponse.json({ error: 'Napaka strežnika' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'neznan'
    const body = await request.json()
    const token = typeof body?.token === 'string' ? body.token : ''
    if (rateLimited(`post:${token}:${ip}`)) {
      return NextResponse.json({ error: 'Preveč poskusov, poskusite pozneje' }, { status: 429 })
    }

    const validated = submitSchema.parse(body)
    const project = await db.project.findUnique({
      where: { clientToken: validated.token },
      select: { id: true, nazivProjekta: true },
    })
    if (!project) {
      return NextResponse.json({ error: 'Povezava ni veljavna' }, { status: 404 })
    }

    const first = validated.points[0]
    const visinaMm = validated.visinaMm ?? 1800
    const measurement = await db.measurement.create({
      data: {
        projectId: project.id,
        dolzinaMm: Math.round(validated.skupajM * 1000),
        visinaMm,
        gpsLokacija: JSON.stringify({ lat: first[0], lng: first[1] }),
        arMetadata: JSON.stringify({
          source: 'customer-map',
          lokacija: `Samomeritev stranke — ${project.nazivProjekta}`,
          tocke: validated.points,
          skupajM: validated.skupajM,
          opombaStranke: validated.opomba ?? null,
          imeStranke: validated.imeStranke ?? null,
          telefonStranke: validated.telefonStranke ?? null,
          submittedAt: new Date().toISOString(),
        }),
      },
    })

    // Status projekta: priprava ponudbe se nadaljuje (ostane NACRTOVANO/V_TEKU — ne spreminjamo)

    return NextResponse.json({ ok: true, id: measurement.id }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? 'Neveljavni podatki' },
        { status: 400 },
      )
    }
    console.error('Public measure POST error:', error)
    return NextResponse.json({ error: 'Napaka pri pošiljanju meritve' }, { status: 500 })
  }
}
