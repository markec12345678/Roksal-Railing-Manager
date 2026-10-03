// R399 (issue #13 §18 — OBJECT STORAGE PRIVATE BY DEFAULT) — storage
// spravna poročila ruta.
// ---------------------------------------------------------------------------
//   GET /api/storage/reconcile
//
// Vrni celovit orphan-reconciliation pregled (sirote / pretrgane vezave /
// checksum neujemanja po VSEH 6 družinah) — isto jedro kot skript
// scripts/r399-storage-reconcile.ts (src/lib/object-reconciliation.ts,
// EN VIR). Poročilo JE spletna površina brez bajtov in brez osebnih
// podatkov (ključi so notranji prostori files/<resource>/<id>/<ime>;
// sha256 zabeleženi hashi — javna integritetna vrednost).
//
// Varnost:
//   • avtentikacija (seja ali API ključ) — anonimno NI dostopa;
//   • RBAC: vodstvo (ADMIN/VODJA — isManager) — pregled čez VSE projekte
//     je vodstvena vidljivost (isti prag kot ostale globalne rute);
//     MONTER/SKLADISČE dobijo 403 (teren ne vidi tujih artefaktov);
//   • samo-bralno: RUTA NE BRIŠE (prune živi v skriptu — izrecna lastniška
//     akcija nad točno izbranimi sirotami; kanon "GET-samo brez
//     rate-limit vrata" R390/R393);
//   • fail-closed: napaka → 500 z javnim sporočilom.
import { NextResponse } from 'next/server'
import { authenticate, unauthorized } from '@/lib/auth'
import { isManager, AccessDeniedError } from '@/lib/access'
import { reconcileStorage } from '@/lib/object-reconciliation'

export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    if (!isManager(auth)) {
      return NextResponse.json(
        { error: 'Spravo shrambe urejajo uporabniki z vodstveno vlogo' },
        { status: 403 }
      )
    }
    const report = await reconcileStorage()
    return NextResponse.json(report, {
      headers: { 'cache-control': 'no-store' },
    })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Storage Reconcile GET Error:', error)
    return NextResponse.json(
      { error: 'Napaka pri spravi shrambe — poženi skript r399-storage-reconcile za podrobnosti' },
      { status: 500 }
    )
  }
}
