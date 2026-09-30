// R326 — 53. člen issue #1 (§5 price history): GET zgodovine cen materiala.
// Brat GET /api/material-prices (ta ostaja resnica TRENUTNO veljavnih cen —
// veljavnostDo: null; ta route je edini bralec ZAPRTE zgodovine). Čista
// projekcija: Prisma vrstica → CenaZgodovinaVnos → buildCenaZgodovina
// (EN VIR lib — vsa pravila v libu, route je le bralec baze + ovojnica;
// vzorec kataloga R294: deterministic, brez AI, brez ugibanja).
//
// Postgres-only fail-closed: db napaka = iskren 500 z ovojnico { error } —
// nič tihe prazne resnice (kanon R152: prazno + vidna napaka, ne izmišljota).
// Nič pisanja (GET samo) — zapis ostaja pri POST /api/material-prices
// (R136 §19 transakcija + EXCLUDE material_price_no_overlap).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { buildCenaZgodovina } from '@/lib/cena-zgodovina'
import type { CenaZgodovinaVnos } from '@/lib/cena-zgodovina'
import { CENA_ZGO_VIR_NIZ } from '@/lib/cena-zgodovina'

export async function GET(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do cen (kanon).
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const vrstice = await db.materialPrice.findMany({
      include: {
        inventory: { select: { naziv: true } },
        supplier: { select: { naziv: true } },
      },
      orderBy: [{ veljavnostOd: 'desc' }],
    })
    const vnosi: CenaZgodovinaVnos[] = vrstice.map((r) => ({
      inventoryId: r.inventoryId,
      artikel: r.inventory.naziv,
      supplierId: r.supplierId,
      dobavitelj: r.supplier.naziv,
      cena: r.cena,
      veljavnostOd: r.veljavnostOd.toISOString(),
      veljavnostDo: r.veljavnostDo ? r.veljavnostDo.toISOString() : null,
      opomba: r.opomba,
    }))
    const pregled = buildCenaZgodovina(
      vnosi,
      'GET /api/material-prices/zgodovina',
    )
    return NextResponse.json({ pregled, vir: CENA_ZGO_VIR_NIZ })
  } catch (e) {
    // Fail-closed: struktura liba (fail-closed ×7) ali baza — iskren 500,
    // brez tihe prazne resnice; sporočilo VERBATIM nosi 'kje' graditelja.
    const sporocilo =
      e instanceof Error ? e.message : 'Neznana napaka pri branju zgodovine cen.'
    return NextResponse.json({ error: sporocilo }, { status: 500 })
  }
}
