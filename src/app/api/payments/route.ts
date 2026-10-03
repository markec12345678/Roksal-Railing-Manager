// R402 (issue #13, korak R170 iz §19) — API: PLAČILA (Invoice → Payment).
// ---------------------------------------------------------------------------
// GET  — seznam plačil projekta (?projectId=) z allocacijami. Vrata: ista
//        širina branja kot /api/invoices (users.read/inventory.write = vse;
//        monter samo svoji projekti — resource-plast); API ključ ZAVRNJEN
//        (plačila so finančni uradni podatki — kanon R126 uradni dokumenti).
// POST — zabeleži plačilo (BANKA/GOTOVINA/KARTICA/DRUGO) s porazdelitvijo:
//          vhod  = { projectId, invoiceId?, tip, znesek, placanoAt, referenca?,
//                    metoda?, bankaPodatki?, allocacije? [{invoiceId, znesek}] };
//          vrata = pravica invoices.issue (finančno dejanje — vodstvo;
//                  isti katalog §10 kot izdaja/plačilo računa) + resource
//                  'update' dostop do projekta + rate-limit + Idempotency-Key
//                  (exactly-once — bančni promet se NE podvoji ob retry);
//          stroj = zabeleziPlaciloVTx (TRANSAKCIJSKO): plačilo + allocacije +
//                  IZPELJAVA statusa računov (DELNO_PLACAN/PLACAN — strežniško)
//                  + auditi (PAYMENT_RECORDED + INVOICE_STATUS) ATOMSKO.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import { hasPermission, lacksPermission, assertProjectAccess, actorIdOf, principalBindingOf, AccessDeniedError } from '@/lib/access'
import { decToPlain } from '@/lib/decimal-policy'
import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'
import {
  IdempotencyRaceError,
  beginIdempotency,
  idempotencyConflictResponse,
  idempotencyReplayResponse,
  isValidIdempotencyKey,
  reserveIdempotencyIn,
  storeResponseIn,
} from '@/lib/idempotency'
import { PaymentStoreError, PLACILO_METODE, PLACILO_TIPI, zabeleziPlaciloVTx } from '@/lib/payments'
import { InvalidInvoiceTransitionError } from '@/lib/invoice-lifecycle'

/** Banka podatki — allowlist (§17 kanon: le kar UI dejansko potrebuje). */
const bankaPodatkiSchema = z
  .object({
    iban: z.string().min(15).max(34).optional(),
    swift: z.string().min(8).max(11).optional(),
    nazivPrejemnika: z.string().min(1).max(200).optional(),
    datumKnjizenja: z.string().datetime().optional(),
    idTransakcije: z.string().min(1).max(100).optional(),
  })
  .strict()

const zabeleziPlaciloSchema = z
  .object({
    projectId: z.string().min(1, 'projectId je obvezen').max(64),
    invoiceId: z.string().min(1).max(64).optional().nullable(),
    tip: z.enum(PLACILO_TIPI).default('PLACILO'),
    znesek: z
      .number()
      .positive('Znesek mora biti pozitiven')
      .max(10_000_000)
      // Denarna politika R380: največ 2 decimalki — tretjo zavrnemo (ne tiho zaokrožimo klientovega vnosa).
      .refine((v) => Math.round(v * 100) === v * 100, { message: 'Znesek ima lahko največ 2 decimalki' }),
    valuta: z.literal('EUR').default('EUR'),
    placanoAt: z.string().datetime({ message: 'placanoAt mora biti ISO datum' }),
    referenca: z.string().min(1).max(200).optional().nullable(),
    metoda: z.enum(PLACILO_METODE).default('BANKA'),
    bankaPodatki: bankaPodatkiSchema.optional().nullable(),
    allocacije: z
      .array(
        z
          .object({
            invoiceId: z.string().min(1).max(64),
            znesek: z
              .number()
              .positive()
              .max(10_000_000)
              .refine((v) => Math.round(v * 100) === v * 100, { message: 'Znesek allocacije ima lahko največ 2 decimalki' }),
          })
          .strict(),
      )
      .max(20, 'Največ 20 allocacij na plačilo')
      .optional()
      .nullable(),
  })
  .strict()

export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  // Plačila so finančni uradni podatki — API ključ nima dostopa (kanon R126).
  if (auth.kind === 'apikey') {
    return forbidden('Plačila so finančni uradni podatki — API ključ nima dostopa.')
  }
  const correlationId = correlationFromRequest(request)
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }

    // Resource-level dostop (ista vrata kot /api/invoices): monter vidi SAMO
    // svoje projekte; vodstvo/skladišče vse.
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, monterId: true, vodjaId: true, nazivProjekta: true },
    })
    assertProjectAccess(auth, project, 'read')

    const placila = await db.payment.findMany({
      where: { projectId },
      include: {
        allocations: { select: { id: true, invoiceId: true, znesek: true } },
        invoice: { select: { id: true, stevilka: true } },
      },
      orderBy: { placanoAt: 'desc' },
    })
    return NextResponse.json(decToPlain(placila))
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logWithCorrelation('payments.get', correlationId, error)
    return NextResponse.json({ error: 'Napaka pri branju plačil', correlationId }, { status: 500 })
  }
}

export async function POST(request: Request) {
  // R191 — val 2 omejevanje hitrosti na pisanju (WRITE_LIMIT, kind `write`).
  const zavrnjeno = zapisOmejitev(request, 'payments')
  if (zavrnjeno) return zavrnjeno

  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  // Beleženje plačila = finančno dejanje: pravica invoices.issue (§10 —
  // isti katalog kot izdaja/označitev plačila računa; RBAC matrika ZAMRZNJENA).
  if (auth.kind === 'apikey') {
    return forbidden('Plačila so finančni uradni podatki — API ključ nima dostopa.')
  }
  if (lacksPermission(auth, 'invoices.issue')) {
    return forbidden('Beleženje plačil zahteva pravico invoices.issue.')
  }
  const actor = actorIdOf(auth)
  const correlationId = correlationFromRequest(request)

  // R128/§19: bančni promet se NE podvoji ob retry — rezervacija + odgovor
  // v ISTI transakciji (exactly-once replay, vzorec measurements/material-orders).
  const idemHeader = request.headers.get('Idempotency-Key')
  const idemKey = idemHeader !== null && isValidIdempotencyKey(idemHeader) ? idemHeader : null
  if (idemHeader !== null && !idemKey) {
    return NextResponse.json({ error: 'Neveljaven Idempotency-Key' }, { status: 400 })
  }
  const idemBinding = idemKey ? principalBindingOf(auth) : null

  try {
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const validated = zabeleziPlaciloSchema.parse(telo.telo)

    // Resource-level dostop 'update' do projekta (isti vzorec kot POST /api/production).
    const project = await db.project.findUnique({
      where: { id: validated.projectId },
      select: { id: true, monterId: true, vodjaId: true },
    })
    if (!project) {
      return NextResponse.json({ error: 'Projekt ni najden' }, { status: 404 })
    }
    assertProjectAccess(auth, project, 'update')

    const responseBody = await db.$transaction(async (tx) => {
      if (idemKey) await reserveIdempotencyIn(tx, idemKey, 'payments', idemBinding)
      const rezultat = await zabeleziPlaciloVTx(tx, {
        projectId: validated.projectId,
        invoiceId: validated.invoiceId ?? null,
        tip: validated.tip,
        znesek: validated.znesek,
        valuta: validated.valuta,
        placanoAt: new Date(validated.placanoAt),
        referenca: validated.referenca ?? null,
        metoda: validated.metoda,
        bankaPodatki: validated.bankaPodatki ? JSON.stringify(validated.bankaPodatki) : null,
        allocacije: validated.allocacije ?? null,
        revizija: {
          request,
          session: auth.kind === 'user' ? auth.session : null,
          userId: actor,
        },
      })
      const body = JSON.stringify(decToPlain({ payment: rezultat.payment, spremembe: rezultat.spremembe }))
      if (idemKey) await storeResponseIn(tx, idemKey, 201, body)
      return body
    })
    return new NextResponse(responseBody, { status: 201, headers: { 'Content-Type': 'application/json' } })
  } catch (error) {
    if (error instanceof IdempotencyRaceError) {
      // Vzporedni/retry poizkus istega ključa — replay ali conflict (R128).
      if (idemKey) {
        const odlocitev = await beginIdempotency(idemKey, 'payments', idemBinding)
        if (odlocitev.kind === 'replay') return idempotencyReplayResponse(odlocitev)
        return idempotencyConflictResponse()
      }
      return NextResponse.json({ error: 'Zapis je že v obdelavi — poskusite znova' }, { status: 409 })
    }
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
    logWithCorrelation('payments.post', correlationId, error)
    return NextResponse.json({ error: 'Napaka pri beleženju plačila', correlationId }, { status: 500 })
  }
}
