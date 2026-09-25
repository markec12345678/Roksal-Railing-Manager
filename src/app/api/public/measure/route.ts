// Roksal Field - JAVNI API: samomeritev stranke prek povezave (/m/[token])
// Stranka brez prijave nariše črto ograje na satelitski karti (page /m/[token])
// in pošlje meritev. Povezava vsebuje scoped measureToken projekta (R133, §8) —
// LOČEN od portal žetona (clientToken).
//
// Varnost (§8 pogodba — glej src/lib/measure.ts):
//  - scoped token: Project.measureToken (potek/revokacija/onemogočeno preverjena);
//  - vsa neveljavna stanja → ISTA 404 'Povezava ni veljavna' (enumeration protection);
//  - shared rate limit (checkRate): GET 30/10min na IP, POST 6/h na žeton + 10/h na IP;
//  - idempotency: Idempotency-Key (R128 infrastruktura, principal 'public:measure');
//  - duplicate protection: dedupeHash, identična oddaja v 30 min → obstoječa meritev;
//  - anti-abuse: strop telesa 8 kB, max 300 točk, dnevnik vsakega poskusa;
//  - ownership: Measurement.createdBy = 'public:measure';
//  - omejene mutacije: javnost ustvari SAMO meritev;
//  - audit: MEASURE_VIEW / MEASURE_SUBMIT / MEASURE_DUPLICATE / MEASURE_REJECTED
//    z hashiranim IP (surov IP se NE shranjuje).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { checkRate } from '@/lib/rate-limit'
import {
  BeginIdempotency,
  IdempotencyRaceError,
  beginIdempotency,
  idempotencyReplayResponse,
  isValidIdempotencyKey,
  reserveIdempotencyIn,
  storeResponseIn,
} from '@/lib/idempotency'
import {
  MEASURE_DEDUPE_WINDOW_MS,
  MEASURE_GET_LIMIT,
  MEASURE_MAX_BODY_BYTES,
  MEASURE_SUBMIT_LIMIT_IP,
  MEASURE_SUBMIT_LIMIT_TOKEN,
  PUBLIC_MEASURE_OWNER,
  PUBLIC_MEASURE_PRINCIPAL,
  clientIpOf,
  hashIp,
  logMeasureEvent,
  measureDedupeHash,
  resolveMeasureToken,
} from '@/lib/measure'

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

/** Isti javni 404 za VSA neveljavna stanja (enumeration protection, §7/§8). */
function unavailable(): NextResponse {
  return NextResponse.json({ error: 'Povezava ni veljavna' }, { status: 404 })
}

function tooMany(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { error: 'Preveč zahtevkov, poskusite pozneje' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  )
}

export async function GET(request: Request) {
  const ipHash = hashIp(clientIpOf(request))
  const userAgent = request.headers.get('user-agent')

  // §8: shared rate limit — prva vrsta, pred bazo (pošteno tudi do baze).
  const rate = checkRate(`measure-get:${ipHash}`, MEASURE_GET_LIMIT)
  if (!rate.ok) {
    await logMeasureEvent({
      projectId: null,
      akcija: 'MEASURE_REJECTED',
      ipHash,
      userAgent,
      podrobnosti: JSON.stringify({ reason: 'RATE_LIMITED', surface: 'GET' }),
    })
    return tooMany(rate.retryAfterSeconds)
  }

  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token') ?? ''

    const resolved = await resolveMeasureToken(token)
    if (resolved.status !== 'OK') {
      await logMeasureEvent({
        projectId: null,
        akcija: 'MEASURE_REJECTED',
        ipHash,
        userAgent,
        podrobnosti: JSON.stringify({ reason: resolved.status, surface: 'GET' }),
      })
      return unavailable()
    }

    await logMeasureEvent({
      projectId: resolved.project.id,
      akcija: 'MEASURE_VIEW',
      ipHash,
      userAgent,
    })

    // Minimalni DTO: samo naziv + ime stranke (nič drugega).
    return NextResponse.json({
      nazivProjekta: resolved.project.nazivProjekta,
      stranka: resolved.project.customer?.ime ?? null,
    })
  } catch (error) {
    console.error('Public measure GET error:', error)
    return NextResponse.json({ error: 'Napaka strežnika' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const ipHash = hashIp(clientIpOf(request))
  const userAgent = request.headers.get('user-agent')

  // §8: shared rate limit — prva vrsta (pred razčlenjevanjem telesa).
  // Dva žebrka: enega delita vse pošiljanje na ta IP, drugi samo žeton
  // (iz telesa, kadar ga je sploh moč prebrati).
  const rateIp = checkRate(`measure-post-ip:${ipHash}`, MEASURE_SUBMIT_LIMIT_IP)
  if (!rateIp.ok) {
    await logMeasureEvent({
      projectId: null,
      akcija: 'MEASURE_REJECTED',
      ipHash,
      userAgent,
      podrobnosti: JSON.stringify({ reason: 'RATE_LIMITED_IP', surface: 'POST' }),
    })
    return tooMany(rateIp.retryAfterSeconds)
  }

  // §8 anti-abuse: strop surove velikosti (prej samo v komentarju).
  const rawBody = await request.text()
  if (rawBody.length > MEASURE_MAX_BODY_BYTES) {
    await logMeasureEvent({
      projectId: null,
      akcija: 'MEASURE_REJECTED',
      ipHash,
      userAgent,
      podrobnosti: JSON.stringify({ reason: 'BODY_TOO_LARGE', bytes: rawBody.length }),
    })
    return NextResponse.json({ error: 'Zahtevek je prevelik' }, { status: 413 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 })
  }

  const token = typeof (body as { token?: unknown })?.token === 'string' ? (body as { token: string }).token : ''
  const rateToken = checkRate(`measure-post-token:${token}`, MEASURE_SUBMIT_LIMIT_TOKEN)
  if (!rateToken.ok) {
    await logMeasureEvent({
      projectId: null,
      akcija: 'MEASURE_REJECTED',
      ipHash,
      userAgent,
      podrobnosti: JSON.stringify({ reason: 'RATE_LIMITED_TOKEN', surface: 'POST' }),
    })
    return tooMany(rateToken.retryAfterSeconds)
  }

  // §8 idempotency: ključ je opcijski (stranke ga pošljejo od tega deploya
  // naprej), a ko pride, je obveza — neveljaven format → 400.
  const idemKey = request.headers.get('Idempotency-Key')
  if (idemKey !== null && !isValidIdempotencyKey(idemKey)) {
    return NextResponse.json(
      { error: 'Neveljaven Idempotency-Key' },
      { status: 400 },
    )
  }

  try {
    const validated = submitSchema.parse(body)

    const resolved = await resolveMeasureToken(validated.token)
    if (resolved.status !== 'OK') {
      await logMeasureEvent({
        projectId: null,
        akcija: 'MEASURE_REJECTED',
        ipHash,
        userAgent,
        podrobnosti: JSON.stringify({ reason: resolved.status, surface: 'POST' }),
      })
      return unavailable()
    }
    const projectId = resolved.project.id

    // §8 duplicate protection: identična oddaja v oknu 30 min → obstoječa
    // meritev (200, duplicate:true). Best-effort zraven idempotence (ta lovi
    // iste ključe, ta lovi isti vsebini z različnima ključema). Ožja tekma
    // (dva vzporedna PRVA pošiljanja) je dokumentirano okno — idempotence
    // ključ stranke ga zapre v praksi.
    const dedupeHash = measureDedupeHash(
      projectId,
      validated.points,
      validated.skupajM,
      validated.visinaMm ?? 1800,
    )
    const cutoff = new Date(Date.now() - MEASURE_DEDUPE_WINDOW_MS)
    const duplicate = await db.measurement.findFirst({
      where: { projectId, dedupeHash, createdAt: { gt: cutoff } },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    })
    if (duplicate) {
      await logMeasureEvent({
        projectId,
        akcija: 'MEASURE_DUPLICATE',
        ipHash,
        userAgent,
        podrobnosti: JSON.stringify({ existingId: duplicate.id }),
      })
      return NextResponse.json(
        { ok: true, id: duplicate.id, duplicate: true },
        { status: 200 },
      )
    }

    // §8 idempotency: transakcija = rezervacija ključa → meritev → snapshot
    // odgovora (exactly-once, R128 vzorec). Ključ se rezervira ŠELE po
    // validaciji (napaka 400 ne sme zapreti ključa v večni conflict).
    const first = validated.points[0]
    const visinaMm = validated.visinaMm ?? 1800
    const arMetadata = JSON.stringify({
      source: 'customer-map',
      lokacija: `Samomeritev stranke — ${resolved.project.nazivProjekta}`,
      tocke: validated.points,
      skupajM: validated.skupajM,
      opombaStranke: validated.opomba ?? null,
      imeStranke: validated.imeStranke ?? null,
      telefonStranke: validated.telefonStranke ?? null,
      submittedAt: new Date().toISOString(),
    })

    const result = await db.$transaction(async (tx) => {
      if (idemKey) await reserveIdempotencyIn(tx, idemKey, 'public-measure', PUBLIC_MEASURE_PRINCIPAL)
      const measurement = await tx.measurement.create({
        data: {
          projectId,
          dolzinaMm: Math.round(validated.skupajM * 1000),
          visinaMm,
          gpsLokacija: JSON.stringify({ lat: first[0], lng: first[1] }),
          arMetadata,
          dedupeHash,
          createdBy: PUBLIC_MEASURE_OWNER,
        },
      })
      const responseBody = JSON.stringify({ ok: true, id: measurement.id })
      if (idemKey) await storeResponseIn(tx, idemKey, 201, responseBody)
      return { id: measurement.id, responseBody }
    })

    // Telemetrija pisarne + audit (uspeh). lastUsed je AWAIT z lovljenjem
    // napak: ne sme porušiti oddaje (napaka ostane v logu), a je
    // determinističen ob zaključku rute (brez tekmovanja z odgovorom).
    await db.project
      .update({
        where: { id: projectId },
        data: { measureTokenLastUsedAt: new Date() },
      })
      .catch((error) => console.error('[measure] lastUsed NI posodobljen:', error))

    await logMeasureEvent({
      projectId,
      akcija: 'MEASURE_SUBMIT',
      ipHash,
      userAgent,
      podrobnosti: JSON.stringify({ measurementId: result.id, idempotent: !!idemKey }),
    })

    return new NextResponse(result.responseBody, {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? 'Neveljavni podatki' },
        { status: 400 },
      )
    }
    if (error instanceof IdempotencyRaceError && idemKey) {
      // Vzporedni poizkus ISTEGA ključa: transakcija je bila prekinjena
      // (ni dvojnika) — vrni replay/conflict po R128 pogodbi.
      const outcome: BeginIdempotency = await beginIdempotency(idemKey, 'public-measure', PUBLIC_MEASURE_PRINCIPAL)
      if (outcome.kind === 'replay') return idempotencyReplayResponse(outcome)
      return NextResponse.json(
        { error: 'Zapis s tem Idempotency-Key je že v obdelavi — poskusite znova čez trenutek' },
        { status: 409 },
      )
    }
    console.error('Public measure POST error:', error)
    return NextResponse.json({ error: 'Napaka pri pošiljanju meritve' }, { status: 500 })
  }
}
