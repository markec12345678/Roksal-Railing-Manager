// R382 (issue #13, korak R169 iz §13) — API: DETAJL STRANKE z ločenimi naslovi.
// ---------------------------------------------------------------------------
// Do R382 /api/customers NI imel detajl poti (seznam + ?id= na /api/crm je
// Projekt-centricen). §13 zahteva ločitev naslovov (kontaktni/računski/
// montažni) — ta ruta je kanonični DETAJL stranke:
//   GET /api/customers/[id] — stranka + naslovi RAZDELJENI po tipih
//   (razdeliNaslovePoTipih — fail-closed na neznan tip iz baze, ne tiho
//   premetavanje) + priložnosti (§13) + števci projektov/ponudb.
//   Decimal DTO: estimatedPrice/ocenjenaVrednost → number (kanon R380).
// Prag: authenticate (isti kot GET /api/customers).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import { razdeliNaslovePoTipih } from '@/lib/crm-pipeline'
import { decToPlain } from '@/lib/decimal-policy'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const correlationId = correlationFromRequest(request)
  try {
    const { id } = await params

    const stranka = await db.customer.findUnique({
      where: { id },
      include: {
        addresses: {
          orderBy: [{ tip: 'asc' }, { createdAt: 'asc' }],
          select: { id: true, tip: true, naslov: true, kraj: true, postnaSt: true, jePrivzet: true, createdAt: true },
        },
        opportunities: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            naziv: true,
            stage: true,
            ocenjenaVrednost: true,
            verjetnost: true,
            razlogIzgube: true,
            convertedProjectId: true,
            createdAt: true,
          },
        },
        _count: { select: { projects: true, quotes: true } },
      },
    })

    if (!stranka) {
      return NextResponse.json({ error: 'Stranka ni najdena' }, { status: 404 })
    }

    // Fail-closed razdelitev po tipih (neznan tip v bazi → 500 z javno
    // napako, NE tiho zmet v "ostalo"):
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
      logWithCorrelation('customers.get.id', correlationId, new Error(razdelitev.error))
      return NextResponse.json(
        { error: 'Podatkovna napaka naslovov stranke', correlationId },
        { status: 500 },
      )
    }

    return NextResponse.json(
      decToPlain({
        customer: {
          id: stranka.id,
          ime: stranka.ime,
          naslov: stranka.naslov,
          telefon: stranka.telefon,
          email: stranka.email,
          status: stranka.status,
          kontaktnaOseba: stranka.kontaktnaOseba,
          kategorija: stranka.kategorija,
          opomnikDatum: stranka.opomnikDatum,
          opomnikOpis: stranka.opomnikOpis,
          zadnjiKontakt: stranka.zadnjiKontakt,
          opombeCRM: stranka.opombeCRM,
          createdAt: stranka.createdAt,
        },
        naslovi: razdelitev.value,
        opportunities: stranka.opportunities,
        stevci: {
          projektov: stranka._count.projects,
          ponudb: stranka._count.quotes,
          priloznosti: stranka.opportunities.length,
        },
      }),
    )
  } catch (error) {
    logWithCorrelation('customers.get.id', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri branju stranke', correlationId },
      { status: 500 },
    )
  }
}
