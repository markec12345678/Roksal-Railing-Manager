// R184 (issue #5 — telemetrija omejevanja hitrosti, R181 kandidat d):
// ADMIN pregled blokad brute-force zaščite na TRENUTNEM primerku strežnika.
//
// Zakaj: /api/jobs pokaže vzdrževalne posle, ampak NIČ ne pove, KDAJ in KOLIKO
// krat je zaščita (rate-limit) dejansko ZAVRLA zahteve — brute-force na prijavo
// ali zankast klient na pisanju je bil do zdaj neviden (samo posredno prek
// 429 odgovorov, ki jih uporabnik vidi, lastnik pa ne).
//
// Kontraktno:
//   • SAMO ADMIN (denyUnless ADMIN_ROLES — isti vzorec kot /api/jobs).
//   • Vrne IZKLJUČNO kategorijo omejitve (`kind`, npr. `login`) + deterministični
//     krajšani SHA-256 prstni odtis ključa — NIKOLI surovega ključa (IP +
//     e-naslov ostajata v pomnilniku strežnika; revizijska sled pokriva PII
//     tam, kjer je pravno umeščena).
//   • Brez lažnih trditev: števeci so v pomnilniku trenutnega primerka
//     (Vercel serverless = zaščita na primerek) — odgovor to izrecno pove
//     v `note`, da panel ne more prikazati zavajajočih "globalnih" številk.
//   • Fail-verbose: napaka → 500 s correlationId (nič tihega praznega stanja).
//   • no-store pokrije next.config (/api/:path*) — telemetrija je vedno sveža.
import { NextResponse } from 'next/server'
import { denyUnless, ADMIN_ROLES } from '@/lib/auth'
import { rateLimitDetail } from '@/lib/rate-limit'
import { CORRELATION_HEADER, correlationFromRequest, logWithCorrelation } from '@/lib/correlation'

export const runtime = 'nodejs'

export async function GET(request: Request): Promise<NextResponse> {
  const correlationId = correlationFromRequest(request)
  const denied = await denyUnless(request, ADMIN_ROLES)
  if (denied) return denied
  try {
    const detail = rateLimitDetail()
    const res = NextResponse.json({
      stats: { keys: detail.keys, hits: detail.hits },
      tripsTotal: detail.tripsTotal,
      // Zgornjih 10 je dovolj za diagnozo; panel prikaže 5 (rest je v API-ju).
      trips: detail.trips.slice(0, 10),
      note:
        'Števeci so v pomnilniku trenutnega primerka (serverless) — prikazujejo vzorec, ne globalnih absolutnih vrednosti. R190: kategorija `write` = zankasti klient na pisanju (val 1: calculator, quote, viz/*, measurement/*, sync).',
      generatedAt: new Date().toISOString(),
    })
    res.headers.set(CORRELATION_HEADER, correlationId)
    return res
  } catch (error) {
    logWithCorrelation('security.rate-limit.error', correlationId, error)
    const res = NextResponse.json(
      { error: 'Napaka pri branju telemetrije omejevanja hitrosti', correlationId },
      { status: 500 },
    )
    res.headers.set(CORRELATION_HEADER, correlationId)
    return res
  }
}
