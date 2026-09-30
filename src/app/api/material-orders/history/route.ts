// Roksal Field - API: Zgodovina prehodov naročila (R209, P1 kandidat (i))
// ---------------------------------------------------------------------------
// Kartica naročila prikaže sled prehodov (OSNUTEK → POSLANO → POTRJENO →
// DOBLJENO / PREKlicANO) iz AuditLog. Dve resnici, ki ju ruta ISKRENO loči:
//
//   1. NOVEJŠI dogodki (od R209) nosijo orderId v oldValue/newValue JSON —
//      `audit()` v PATCH /api/material-orders zapisuje { orderId, status }.
//   2. STAREJŠI dogodki so zapisali gol status brez povezave na naročilo —
//      teh ruta NE more pripisati in jih NE izmišljuje (fail-closed družina
//      R201/R203: brez izmišljenih podatkov). UI pokaže iskreno prazno
//      stanje z razlago.
//
// Določanje pripadnosti je DETERMINISTIČNO: substring `contains` je LE
// predizbor kandidatov; prava odločitev je razčlenjen JSON z TOČNO
// enakostjo parsed orderId. Odgovor: najnovejši najprej, zgornja meja 50.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'

// Isti kontrakt kot GET /api/material-orders (R126): naročila in njihova
// sled so poslovni podatki — API ključ nima dostopa.
const AKCIJA_PREHODOV = [
  'MATERIAL_ORDER_CREATED',
  'MATERIAL_ORDER_STATUS',
  'MATERIAL_RECEIPT',
  'MATERIAL_RECEIPT_DUPLICATE',
] as const

const MAX_DOGEVKI = 50

/** Razčleni staro/novo vrednost audit zapisa — pričakuj { orderId?, status? }. */
function razcleniVrednost(vrednost: string | null): { orderId: string | null; status: string | null } {
  if (!vrednost) return { orderId: null, status: null }
  try {
    const raz = JSON.parse(vrednost) as unknown
    if (raz && typeof raz === 'object' && !Array.isArray(raz)) {
      const obj = raz as Record<string, unknown>
      return {
        orderId: typeof obj.orderId === 'string' ? obj.orderId : null,
        status: typeof obj.status === 'string' ? obj.status : null,
      }
    }
  } catch {
    // starejši zapisi: gol status string (npr. "POSLANO") — brez orderId.
    // R308 meja: iskrena resnica je IZRAZ v kodi (ne samo komentar) —
    // pokvarjen zapis → izrecen null padec, nikoli tiha izguba.
    return { orderId: null, status: null }
  }
  return { orderId: null, status: null }
}

export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  if (auth.kind === 'apikey') {
    return forbidden('Zgodovina naročil je poslovni podatek — API ključ nima dostopa.')
  }
  const correlationId = correlationFromRequest(request)
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId') ?? ''
    if (orderId.length < 8) {
      return NextResponse.json({ error: 'Manjka ali je prekratek orderId.' }, { status: 400 })
    }

    const order = await db.materialOrder.findUnique({ where: { id: orderId }, select: { id: true } })
    if (!order) {
      return NextResponse.json({ error: 'Naročilo ne obstaja.' }, { status: 404 })
    }

    // Predizbor: kandidati z akcijo prehodov, kjer se orderId pojavi kot
    // podniz v oldValue/newValue (id je dolg naključen niz — podniz je samo
    // optimizacija, prava odločitev je spodaj po razčlenitvi).
    const kandidati = await db.auditLog.findMany({
      where: {
        akcija: { in: [...AKCIJA_PREHODOV] },
        OR: [{ oldValue: { contains: orderId } }, { newValue: { contains: orderId } }],
      },
      orderBy: { timestamp: 'desc' },
      take: 200,
      include: { user: { select: { ime: true, email: true, vloga: true } } },
    })

    // Deterministični post-filter: TOČNA enakost razčlenjenega orderId —
    // podniz nikoli ne odloča (brez lažnih pripisov, 100% določljivo).
    const dogodki = kandidati
      .map((k) => {
        const staro = razcleniVrednost(k.oldValue)
        const novo = razcleniVrednost(k.newValue)
        return {
          id: k.id,
          timestamp: k.timestamp.toISOString(),
          akcija: k.akcija,
          statusPrej: staro.orderId === orderId ? staro.status : null,
          statusPotem: novo.orderId === orderId ? novo.status : null,
          uporabnik: k.user
            ? { ime: k.user.ime, email: k.user.email, vloga: k.user.vloga }
            : null,
        }
      })
      .filter((d) => d.statusPrej !== null || d.statusPotem !== null)
      .slice(0, MAX_DOGEVKI)

    return NextResponse.json({ orderId, count: dogodki.length, dogodki })
  } catch (error) {
    logWithCorrelation('material-orders.history', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri branju zgodovine naročila', correlationId },
      { status: 500 },
    )
  }
}
