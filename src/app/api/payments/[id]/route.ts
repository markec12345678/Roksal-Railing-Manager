// R402 (issue #13, korak R170 iz §19) — API: ENO PLAČILO (branje + prekinitev).
// ---------------------------------------------------------------------------
// GET   — plačilo z allocacijami (vrata: resource 'read' do projekta plačila;
//         API ključ zavrnjen — finančni uradni podatki, kanon R126).
// PATCH — PREKINITEV vnosa plačila (knjižna napaka/dvojnik/povratilo):
//           vhod  = { action: 'prekini', razlog } (discipliniran vnos —
//                   kanon R378 engineering-rules verzije);
//           vrata = pravica invoices.issue + resource 'update' + rate-limit;
//           stroj = prekiniPlaciloVTx: plačilo → PREKINJENO z razlogom
//                   (NE briše se — pravna sled), dotični računi se PONOVNO
//                   izpeljejo iz ostanka KNJIZENO allocacij + auditi ATOMSKO.
//           Ponovna prekinitev = 409 (plačilo je že prekinjeno).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import { lacksPermission, assertProjectAccess, actorIdOf, AccessDeniedError } from '@/lib/access'
import { decToPlain } from '@/lib/decimal-policy'
import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'
import { PaymentStoreError, prekiniPlaciloVTx } from '@/lib/payments'
import { InvalidInvoiceTransitionError } from '@/lib/invoice-lifecycle'

const prekiniSchema = z
  .object({
    action: z.literal('prekini', { message: 'Edini podprti action je "prekini"' }),
    razlog: z.string().min(3, 'Razlog prekinitve je obvezen (vsaj 3 znaki)').max(500),
  })
  .strict()

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  if (auth.kind === 'apikey') {
    return forbidden('Plačila so finančni uradni podatki — API ključ nima dostopa.')
  }
  const correlationId = correlationFromRequest(request)
  try {
    const { id } = await context.params
    const placilo = await db.payment.findUnique({
      where: { id },
      include: {
        allocations: { select: { id: true, invoiceId: true, znesek: true } },
        invoice: { select: { id: true, stevilka: true, status: true } },
      },
    })
    if (!placilo) {
      return NextResponse.json({ error: 'Plačilo ni najdeno' }, { status: 404 })
    }
    // Resource-level dostop prek projekta plačila (isti vzorec kot vse projektne rute).
    const project = await db.project.findUnique({
      where: { id: placilo.projectId },
      select: { id: true, monterId: true, vodjaId: true },
    })
    assertProjectAccess(auth, project, 'read')
    return NextResponse.json(decToPlain(placilo))
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logWithCorrelation('payments[id].get', correlationId, error)
    return NextResponse.json({ error: 'Napaka pri branju plačila', correlationId }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  // R191 — val 2 omejevanje hitrosti na pisanju (WRITE_LIMIT, kind `write`).
  const zavrnjeno = zapisOmejitev(request, 'payments')
  if (zavrnjeno) return zavrnjeno

  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  if (auth.kind === 'apikey') {
    return forbidden('Plačila so finančni uradni podatki — API ključ nima dostopa.')
  }
  if (lacksPermission(auth, 'invoices.issue')) {
    return forbidden('Prekinitev plačila zahteva pravico invoices.issue.')
  }
  const actor = actorIdOf(auth)
  const correlationId = correlationFromRequest(request)
  try {
    const { id } = await context.params
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const validated = prekiniSchema.parse(telo.telo)

    const obstojeco = await db.payment.findUnique({ where: { id }, select: { projectId: true } })
    if (!obstojeco) {
      return NextResponse.json({ error: 'Plačilo ni najdeno' }, { status: 404 })
    }
    const project = await db.project.findUnique({
      where: { id: obstojeco.projectId },
      select: { id: true, monterId: true, vodjaId: true },
    })
    assertProjectAccess(auth, project, 'update')

    const rezultat = await db.$transaction(async (tx) =>
      prekiniPlaciloVTx(tx, {
        paymentId: id,
        razlog: validated.razlog,
        now: new Date(),
        revizija: {
          request,
          session: auth.kind === 'user' ? auth.session : null,
          userId: actor,
        },
      }),
    )
    return NextResponse.json(decToPlain({ payment: rezultat.payment, spremembe: rezultat.spremembe }))
  } catch (error) {
    if (error instanceof PaymentStoreError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    if (error instanceof InvalidInvoiceTransitionError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Neveljavni podatki' }, { status: 400 })
    }
    logWithCorrelation('payments[id].patch', correlationId, error)
    return NextResponse.json({ error: 'Napaka pri prekinitvi plačila', correlationId }, { status: 500 })
  }
}
