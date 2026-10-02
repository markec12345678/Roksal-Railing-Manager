// R382 (issue #13, korak R169 iz §13) — API: urejanje/brisanje naslova stranke.
// ---------------------------------------------------------------------------
// PATCH  — posodobi naslov (naslov/kraj/postnaSt/jePrivzet — tip se NE
//          spreminja: tip je ZAVEZA "kam pošiljamo/računamo/mondiramo",
//          naslov drugega tipa = NOVA vrstica; demote starih privzetih +legacy
//          sinhron KONTAKTNI sta v crm-store V ISTI transakciji);
// DELETE — zbriše naslov (če je bil PRIVZETI KONTAKTNI, legacy naslov se
//          preusmeri na najstarejši preostali KONTAKTNI — crm-store).
// RBAC: canManageCustomers (customers.write — R156 precedens; naslov je
//       podrejeni PODATEK stranke, ne entiteta — prag pisanja stranke).
//       Vsa mutacija gre IZKLJUČNO prek crm-store (EN VIR) + revizija (§19).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { canManageCustomers, actorIdOf } from '@/lib/access'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'
import { CrmStoreError, izbrisiNaslovVTx, posodobiNaslovVTx, revizijskiKontekst } from '@/lib/crm-store'

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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const zavrnjeno = zapisOmejitev(request, 'customer-addresses')
  if (zavrnjeno) return zavrnjeno

  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  if (!canManageCustomers(auth)) {
    return forbidden('Naslove urejajo uporabniki s pravico customers.write (prijava).')
  }
  const correlationId = correlationFromRequest(request)

  try {
    const { id } = await params
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const body = telo.telo as Record<string, unknown>

    const naslov = parseOptionalText(body.naslov, 'naslov', MAXNASLOV)
    if (!naslov.ok) return NextResponse.json({ error: naslov.error }, { status: 400 })
    const kraj = parseOptionalText(body.kraj, 'kraj', MAXKRAJ)
    if (!kraj.ok) return NextResponse.json({ error: kraj.error }, { status: 400 })
    const postnaSt = parseOptionalText(body.postnaSt, 'postnaSt', MAXPOSTNA)
    if (!postnaSt.ok) return NextResponse.json({ error: postnaSt.error }, { status: 400 })

    const jePrivzet = body.jePrivzet === undefined ? undefined : body.jePrivzet === true

    const now = new Date()
    const session = auth.kind === 'user' ? auth.session : null

    const izhod = await db.$transaction(async (tx) =>
      posodobiNaslovVTx(tx, {
        addressId: id,
        naslov: naslov.value ?? undefined,
        kraj: kraj.value ?? null,
        postnaSt: postnaSt.value ?? null,
        jePrivzet,
        actorId: actorIdOf(auth),
        now,
        revizija: revizijskiKontekst(request, session),
      }),
    )

    return NextResponse.json(izhod)
  } catch (error) {
    if (error instanceof CrmStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    logWithCorrelation('customer-addresses.patch.id', correlationId, error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju naslova', correlationId }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const zavrnjeno = zapisOmejitev(request, 'customer-addresses')
  if (zavrnjeno) return zavrnjeno

  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  if (!canManageCustomers(auth)) {
    return forbidden('Naslove brišejo uporabniki s pravico customers.write (prijava).')
  }
  const correlationId = correlationFromRequest(request)

  try {
    const { id } = await params
    const now = new Date()
    const session = auth.kind === 'user' ? auth.session : null

    const izhod = await db.$transaction(async (tx) =>
      izbrisiNaslovVTx(tx, {
        addressId: id,
        actorId: actorIdOf(auth),
        now,
        revizija: revizijskiKontekst(request, session),
      }),
    )

    return NextResponse.json(izhod)
  } catch (error) {
    if (error instanceof CrmStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    logWithCorrelation('customer-addresses.delete.id', correlationId, error)
    return NextResponse.json({ error: 'Napaka pri brisanju naslova', correlationId }, { status: 500 })
  }
}
