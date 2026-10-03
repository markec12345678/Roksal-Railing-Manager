// R393 (issue #13, korak R171 iz §15) — API: DETAJL PRAVILA (GET-samo).
// ---------------------------------------------------------------------------
// GET — pravilo (id ALI EXACT šifra) + AKTIVNA verzija na dan + CELA zgodovina
//       verzij (provenanca je javna — §15 verzioniranje = dokaz) + opozorilo
//       o ločitvi. Prag: authenticate. Brez mutacij na tej ruti (kanon
//       /api/catalog/products/[id], R390).
import { NextResponse } from 'next/server'
import { authenticate, unauthorized } from '@/lib/auth'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import {
  EngineeringRulesStoreError,
  praviloDetail,
} from '@/lib/engineering-rules-store'

// GET — detajl pravila z zgodovino verzij
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const correlationId = correlationFromRequest(request)
  try {
    const { id } = await context.params
    // R294 F4: stena ure živi v ruti — asOf poda klicatelj store-plastim.
    const asOf = new Date()
    const detail = await praviloDetail(id, asOf)
    return NextResponse.json(detail)
  } catch (error) {
    if (error instanceof EngineeringRulesStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    logWithCorrelation('engineering-rules.detail.get', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri branju detajla tehničnega pravila', correlationId },
      { status: 500 },
    )
  }
}
