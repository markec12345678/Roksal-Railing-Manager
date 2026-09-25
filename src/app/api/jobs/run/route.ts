// R141 (issue #5 §23 — Background jobs): zagon vzdrževalnih poslov.
//
// Dostop (fail-closed, ruta preverja sama — proxy je javen samo zato, da
// Vercel Cron sploh pride do nje; isti vzorec kot /api/viz/gc):
//   1. CRON_SECRET nastavljen → `Authorization: Bearer <CRON_SECRET>`
//      (to pošilja Vercel Cron; sejni piškotkov cron nima) ALI ADMIN seja
//      (ročni zagon prek UI "Vzdrževanje").
//   2. CRON_SECRET ni nastavljen → samo ADMIN seja (ročni zagon).
//   3. API ključi → 403 (posli so strežniška nit, ključ je za merilne
//      kliente — fail-closed brez izjem).
//
// Idempotenco dela runMaintenanceJobs (okno = UTC dan): dvakrat isti dan =
// replay, brez dvojnega dela. Vse zahteve §23 (job ID, owner, input, status,
// attempts, retry policy, error, idempotency, correlation ID) zapisuje JobRun.
import { NextResponse } from 'next/server'
import { authenticate, forbidden, unauthorized } from '@/lib/auth'
import { runMaintenanceJobs } from '@/lib/jobs'
import { CORRELATION_HEADER, correlationFromRequest, logWithCorrelation } from '@/lib/correlation'

export const runtime = 'nodejs'

async function isAdminSession(request: Request): Promise<boolean> {
  const ctx = await authenticate(request)
  return ctx?.kind === 'user' && ctx.session.vloga === 'ADMIN'
}

async function authorized(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET
  const header = request.headers.get('authorization')
  if (secret && header === `Bearer ${secret}`) return true
  // Bearer, ki ni CRON_SECRET: če je API ključ (rkm_), ga route spodaj
  // zavrne s 403 (ključ nima poslov); sicer preveri ADMIN sejo.
  return await isAdminSession(request)
}

/** Owner za JobRun: "cron" pri cron zagonu, sicer e-mail ADMIN seje. */
async function resolveOwner(request: Request): Promise<string> {
  const secret = process.env.CRON_SECRET
  const isCron = Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
  if (isCron && !(await isAdminSession(request))) return 'cron'
  const ctx = await authenticate(request)
  return ctx?.kind === 'user' ? ctx.session.email : 'unknown'
}

async function handle(request: Request): Promise<NextResponse> {
  const correlationId = correlationFromRequest(request)
  if (!(await authorized(request))) {
    const ctx = await authenticate(request)
    if (ctx?.kind === 'apikey') {
      return forbidden('API ključ ne sproža vzdrževalnih poslov — potrebna je ADMIN seja ali CRON_SECRET.')
    }
    if (ctx?.kind === 'user') {
      // Prijavljen, a brez vloge ADMIN → 403 (ne 401): identiteta je znana,
      // manjka pa pravica — enotna pogodba z denyUnless (§10).
      return forbidden(`Za zagon poslov je potrebna vloga ADMIN. Tvoja vloga: ${ctx.session.vloga}.`)
    }
    return unauthorized('Za zagon poslov je potreben ADMIN ali CRON_SECRET.')
  }
  try {
    const owner = await resolveOwner(request)
    const run = await runMaintenanceJobs({ owner, correlationId })
    const res = NextResponse.json({ ok: true, ...run })
    res.headers.set(CORRELATION_HEADER, correlationId)
    return res
  } catch (error) {
    logWithCorrelation('jobs.run.error', correlationId, error)
    const res = NextResponse.json(
      { error: 'Napaka pri zagonu vzdrževalnih poslov', correlationId },
      { status: 500 },
    )
    res.headers.set(CORRELATION_HEADER, correlationId)
    return res
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  return handle(request)
}

/** Vercel Cron pošilja GET. */
export async function GET(request: Request): Promise<NextResponse> {
  return handle(request)
}
