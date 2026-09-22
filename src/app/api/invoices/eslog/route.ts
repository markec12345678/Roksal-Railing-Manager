// Roksal Field - API: eSlog 2.1 eRačun XML (UBL 2.1 / EN 16931)
// GET /api/invoices/eslog?id=<invoiceId> → XML download (attachment)
// Javni naročnik v Sloveniji je obvezen prejemnik eRačunov — izvoz pripravi
// XML za oddajo prek ponudnika (Gateway/eRačun.si/Čebelica).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { buildUblInvoiceXml, type EslogInvoice, type EslogKupec, type EslogPostavka } from '@/lib/eslog-xml'

export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id je obvezen' }, { status: 400 })
    }

    const inv = await db.invoice.findUnique({
      where: { id },
      select: {
        id: true, tip: true, stevilka: true, datumIzdaje: true, datumStoritve: true,
        rokPlacilaDni: true, status: true, postavke: true, kupec: true,
        osnova: true, ddv: true, znesek: true, opombe: true,
      },
    })
    if (!inv) {
      return NextResponse.json({ error: 'Račun ni najden' }, { status: 404 })
    }
    // Storniran račun nima gospodarskega učinka — eRačun ne smemo izdati
    if (inv.status === 'STORNIRAN') {
      return NextResponse.json({ error: 'Storniranega računa ni mogoče izvoziti kot eRačun' }, { status: 409 })
    }

    let postavke: EslogPostavka[] = []
    try {
      const arr = JSON.parse(inv.postavke)
      if (Array.isArray(arr)) postavke = arr
    } catch {
      return NextResponse.json({ error: 'Postavke računa so okvarjene' }, { status: 500 })
    }

    let kupec: EslogKupec | null = null
    if (inv.kupec) {
      try {
        kupec = JSON.parse(inv.kupec) as EslogKupec
      } catch {
        kupec = null
      }
    }

    const payload: EslogInvoice = {
      stevilka: inv.stevilka,
      tip: inv.tip as EslogInvoice['tip'],
      datumIzdaje: inv.datumIzdaje.toISOString(),
      datumStoritve: inv.datumStoritve ? inv.datumStoritve.toISOString() : null,
      rokPlacilaDni: inv.rokPlacilaDni,
      postavke,
      kupec,
      osnova: inv.osnova,
      ddv: inv.ddv,
      znesek: inv.znesek,
      opombe: inv.opombe,
    }

    const xml = buildUblInvoiceXml(payload)
    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="eracun-${inv.stevilka}.xml"`,
      },
    })
  } catch (error) {
    console.error('eSlog XML GET error:', error)
    return NextResponse.json({ error: 'Napaka pri generiranju eRačuna' }, { status: 500 })
  }
}
