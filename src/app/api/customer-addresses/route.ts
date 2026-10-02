// R382 (issue #13, korak R169 iz §13) — API: NASLOVI STRANKE (CustomerAddress).
// ---------------------------------------------------------------------------
// §13: "Customer mora ločiti vsaj: contact/mailing address; billing address;
// installation/site address." Do R382 je obstajal SAMO flat Customer.naslov.
//
// GET  — naslovi (obvezno ?customerId=; sicer 400 — naslovi BREZ stranke so
//        nesmisel in IDOR vpitnik) razdeljeni PO TIPIH + legacy sinhron info;
// POST — ustvari naslov (tip STROGO iz nabora — 400 sicer, NE tiha
//        normalizacija; privzet: stari privzet tipa se demote-a V ISTI
//        transakciji; PRIVZETI KONTAKTNI sinhronizira legacy Customer.naslov).
//        MONTAZNI naslovi so lahko VEČ (upravniki imajo več objektov) —
//        več RazličNIH tipov NI omejenih, le EN privzet na (stranka, tip).
// RBAC: pisanje canManageCustomers (customers.write — R156 precedens);
//       branje authenticate (isti prag kot GET /api/customers).
//       Vsa mutacija gre IZKLJUČNO prek crm-store (EN VIR) + revizija (§19).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { canManageCustomers, actorIdOf } from '@/lib/access'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'
import { CrmStoreError, revizijskiKontekst, ustvariNaslovVTx } from '@/lib/crm-store'
import { CUSTOMER_ADDRESS_TYPES, razdeliNaslovePoTipih } from '@/lib/crm-pipeline'

const MAXNASLOV = 200
const MAXKRAJ = 100
const MAXPOSTNA = 20

/** Stroga (fail-closed) pretvorba neobveznega besedila s stropom (R156). */
function parseOptionalText(
  raw: unknown,
  field: string,
  max: number,
): { ok: true; value: string | null | undefined } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, value: raw === null ? null : undefined }
  if (typeof raw !== 'string') {
    return { ok: false, error: `Polje "${field}" mora biti niz ali null` }
  }
  const trimmed = raw.trim()
  if (trimmed.length === 0) return { ok: true, value: null }
  if (trimmed.length > max) {
    return { ok: false, error: `Polje "${field}" presega ${max} znakov` }
  }
  return { ok: true, value: trimmed }
}

// GET — naslovi stranke razdeljeni po tipih (§13 ločitev)
export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const correlationId = correlationFromRequest(request)
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')?.trim() ?? ''
    if (!customerId) {
      return NextResponse.json(
        { error: 'Parameter customerId je obvezen (naslovi so vedno last stranke).' },
        { status: 400 },
      )
    }

    const stranka = await db.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        ime: true,
        naslov: true,
        addresses: {
          orderBy: [{ tip: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            tip: true,
            naslov: true,
            kraj: true,
            postnaSt: true,
            jePrivzet: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    })
    if (!stranka) {
      return NextResponse.json({ error: 'Stranka ni najdena' }, { status: 404 })
    }

    const razdelitev = razdeliNaslovePoTipih(
      stranka.addresses.map((a) => ({
        tip: a.tip,
        naslov: a.naslov,
        kraj: a.kraj,
        postnaSt: a.postnaSt,
        jePrivzet: a.jePrivzet,
      })),
    )
    if (!razdelitev.ok) {
      logWithCorrelation('customer-addresses.get', correlationId, new Error(razdelitev.error))
      return NextResponse.json(
        { error: 'Podatkovna napaka naslovov stranke', correlationId },
        { status: 500 },
      )
    }

    return NextResponse.json({
      customerId: stranka.id,
      customerIme: stranka.ime,
      // Flat prikazno polje (legacy — mobilni klienti/PDF; sinhronizira ga
      // crm-store ob privzetem KONTAKTNI):
      legacyNaslov: stranka.naslov,
      naslovi: razdelitev.value,
    })
  } catch (error) {
    logWithCorrelation('customer-addresses.get', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri branju naslovov', correlationId },
      { status: 500 },
    )
  }
}

// POST — ustvari naslov stranke (§13 ločitev)
export async function POST(request: Request) {
  const zavrnjeno = zapisOmejitev(request, 'customer-addresses')
  if (zavrnjeno) return zavrnjeno

  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  if (!canManageCustomers(auth)) {
    return forbidden('Naslove urejajo uporabniki s pravico customers.write (prijava).')
  }
  const correlationId = correlationFromRequest(request)

  try {
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const body = telo.telo as Record<string, unknown>

    const customerId = typeof body.customerId === 'string' ? body.customerId.trim() : ''
    if (!customerId) {
      return NextResponse.json({ error: 'customerId je obvezen.' }, { status: 400 })
    }

    const tip = typeof body.tip === 'string' ? body.tip : ''
    if (!tip) {
      return NextResponse.json(
        { error: `tip je obvezen (dovoljeni: ${CUSTOMER_ADDRESS_TYPES.join(', ')}).` },
        { status: 400 },
      )
    }

    const naslov = parseOptionalText(body.naslov, 'naslov', MAXNASLOV)
    if (!naslov.ok) return NextResponse.json({ error: naslov.error }, { status: 400 })
    if (!naslov.value || naslov.value.length < 3) {
      return NextResponse.json({ error: 'Naslov je obvezen (min 3 znaki).' }, { status: 400 })
    }
    const kraj = parseOptionalText(body.kraj, 'kraj', MAXKRAJ)
    if (!kraj.ok) return NextResponse.json({ error: kraj.error }, { status: 400 })
    const postnaSt = parseOptionalText(body.postnaSt, 'postnaSt', MAXPOSTNA)
    if (!postnaSt.ok) return NextResponse.json({ error: postnaSt.error }, { status: 400 })

    const jePrivzet = body.jePrivzet === undefined ? false : body.jePrivzet === true

    const now = new Date()
    const session = auth.kind === 'user' ? auth.session : null

    const ustvarjen = await db.$transaction(async (tx) =>
      ustvariNaslovVTx(tx, {
        customerId,
        tip,
        naslov: naslov.value ?? '',
        kraj: kraj.value ?? null,
        postnaSt: postnaSt.value ?? null,
        jePrivzet,
        actorId: actorIdOf(auth),
        now,
        revizija: revizijskiKontekst(request, session),
      }),
    )

    return NextResponse.json(ustvarjen, { status: 201 })
  } catch (error) {
    if (error instanceof CrmStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    logWithCorrelation('customer-addresses.post', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri ustvarjanju naslova', correlationId },
      { status: 500 },
    )
  }
}
