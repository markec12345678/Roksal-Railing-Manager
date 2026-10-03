// R390 (issue #13, korak R170 iz §14) — API: DETAJL PRODUKTA.
// ---------------------------------------------------------------------------
// GET — detajl produkta (vse aplikacije/kompatibilnost v obe smeri/
//      variante/dobavitelji/kataloška verzija). Prag: authenticate (teren
//      potrebuje aplikacijski kontekst produkta; 404 za manjkajočega —
//      politika vir NE obstaja → 404).
import { NextResponse } from 'next/server'
import { authenticate, unauthorized } from '@/lib/auth'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import { CatalogStoreError, produktDetajl } from '@/lib/catalog-store'

// GET — detajl produkta (id)
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const correlationId = correlationFromRequest(request)
  try {
    const { id } = await context.params
    const detajl = await produktDetajl(id)
    if (!detajl) {
      return NextResponse.json({ error: `Produkt '${id}' ne obstaja` }, { status: 404 })
    }
    return NextResponse.json(detajl)
  } catch (error) {
    if (error instanceof CatalogStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    logWithCorrelation('catalog.product.get', correlationId, error)
    return NextResponse.json(
      { error: 'Napaka pri branju produkta', correlationId },
      { status: 500 },
    )
  }
}
