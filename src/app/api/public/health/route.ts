// R186 (issue #5 — javno zdravje: DB-alive sonda za zunanje monitore).
// ---------------------------------------------------------------------------
// Motiv: lastnik ne vidi izpadov baze (Neon) do trenutka, ko aplikacija v UI
// javi napake — zunanji monitor (UptimeRobot in podobno) ima do zdaj na
// voljo samo / (307) in /login (200), kar NE pinguje baze. Ta ruta pinguje
// bazo (SELECT 1) in poda ISKREN odgovor:
//   • 200 { ok: true, db: 'ok', build, generatedAt } — baza odgovarja;
//   • 503 { ok: false, db: 'fail', build, error, correlationId } — baza NE
//     odgovarja ALI ping preteče (3 s — monitor ne sme viseti).
// Fail-verbose (nič tihega zdravja): napaka je VIDNA v statusu in telesu.
//
// Varnost (javna ruta — ničesar ne izdaja):
//  • Pod potjo /api/public (proxy PUBLIC_PREFIXES) — brez seje, kot
//    /api/public/version (R181). Odgovor vsebuje IZKLJUČNO binarno stanje
//    baze + build žig (že javen prek version) — NIČ uporabniških podatkov,
//    NIČ sheme, NIČ PII; napaka = sporočilo + correlationId (§22) za dnevnik.
//  • no-store pride iz next.config headers() (/api/:path*) — zdravje je vedno
//    sveže (monitor prenaša zastarel odgovor z 304 bi lažno javil 'ok').
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { CORRELATION_HEADER, correlationFromRequest, logWithCorrelation } from '@/lib/correlation'

export const runtime = 'nodejs'

/** Zgornja meja pingo (ms) — obešena baza = 503 po 3 s, ne viseča zahteva. */
const PING_TIMEOUT_MS = 3000

export async function GET(request: Request): Promise<NextResponse> {
  const correlationId = correlationFromRequest(request)
  const build = process.env.NEXT_PUBLIC_BUILD_STAMP ?? null
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) => {
        const t = setTimeout(() => reject(new Error(`ping baze ni odgovoril v ${PING_TIMEOUT_MS} ms`)), PING_TIMEOUT_MS)
        if (typeof t === 'object' && t && 'unref' in t) t.unref()
      }),
    ])
    const res = NextResponse.json({
      ok: true,
      db: 'ok',
      build,
      generatedAt: new Date().toISOString(),
    })
    res.headers.set(CORRELATION_HEADER, correlationId)
    return res
  } catch (error) {
    logWithCorrelation('public.health.error', correlationId, error)
    const res = NextResponse.json(
      {
        ok: false,
        db: 'fail',
        build,
        error: 'Baza ni dosegljiva',
        correlationId,
        generatedAt: new Date().toISOString(),
      },
      { status: 503 },
    )
    res.headers.set(CORRELATION_HEADER, correlationId)
    return res
  }
}
