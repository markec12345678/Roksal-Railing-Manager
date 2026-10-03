// R402 (issue #13, korak R170 iz §19) — API: USKLANJANJE PLAČIL (poročilo).
// ---------------------------------------------------------------------------
// GET ?projectId= — samo-bralno poročilo uskladitve (uskladiPlacila):
//   • po računu: status, znesek, placiloZnesek (vsota KNJIZENO allocacij —
//     vir resnice), odprta razlika, ali je rok plačila pretekel;
//   • po plačilu: porazdeljeno, neporazdeljeni ostanek, prekinitevRazlog;
//   • anomalije: status ≠ izpeljava, placanoAt brez statusa, neporazdeljeni
//     ostanki, storno s plačili — poroča, NE popravlja (isti fail-closed
//     kanon kot GET /api/storage/reconcile R399).
// Vrata: pravica invoices.read + resource 'read' do projekta; API ključ
// zavrnjen (finančni podatki). GET-samo — BREZ rate-limit vrata (kanon
// catalog/products/[id] R390: samo-bralne rute se ne štejejo v val2).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import { assertProjectAccess, AccessDeniedError } from '@/lib/access'
import { uskladiPlacila } from '@/lib/payments'

export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  if (auth.kind === 'apikey') {
    return forbidden('Uskladitev plačil je finančni podatek — API ključ nima dostopa.')
  }
  const correlationId = correlationFromRequest(request)
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, monterId: true, vodjaId: true, nazivProjekta: true },
    })
    assertProjectAccess(auth, project, 'read')

    const porocilo = await uskladiPlacila(projectId, new Date())
    return NextResponse.json(porocilo)
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logWithCorrelation('payments.reconciliation.get', correlationId, error)
    return NextResponse.json({ error: 'Napaka pri uskladitvi plačil', correlationId }, { status: 500 })
  }
}
