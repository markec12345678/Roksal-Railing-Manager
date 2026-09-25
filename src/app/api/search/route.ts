// Roksal Field - API: Globalno iskanje (ukazna paleta)
//
// R138 (issue #5 §21): iskanje ne sme obiti avtorizacije. Prej je ta ruta
// za VSAKEGA prijavljenega vračala zadetke po VSEH strankah/projektih —
// MONTER z 0 projekti je videl tuje projekte + stranke (produkcija QA dokaz:
// ?q=ja → 3 tuji projekti). Zdaj:
//   • projekti — projectSearchWhereFor (isti where kot GET /api/projects),
//   • stranke + material — samo seje (API ključ nima customers/inventory
//     scope-a v katalogu → fail-closed),
//   • LIKE wildcard znaki v vnosu se escapajo (deterministično dobesedno
//     ujemanje, enako prejšnjemu .includes()).
//
// §17: select vrne SAMO minimalna polja za prikaz (brez PII presežka);
// §22: napaka vsebuje correlation ID (glavo dodeljuje proxy).
//
// Iskanje poteka ZDAJ v bazi (PostgreSQL `contains` + mode: 'insensitive'),
// ne v JS vzorcu take 200/300 — prej so zadetki lahko manjkali, če je bila
// vrstica zunaj vzorca (nedeterministično glede na velikost podatkov).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import {
  searchVisibilityFor,
  projectSearchWhereFor,
  escapeLikePattern,
} from '@/lib/search-access'

const MAX_QUERY_LENGTH = 80
const SECTION_LIMIT = 5

export async function GET(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()

  const correlationId = request.headers.get('x-correlation-id') ?? undefined

  try {
    const { searchParams } = new URL(request.url)
    const raw = (searchParams.get('q') ?? '').trim().toLowerCase()
    // Zgornja meja dolžine (§17): noben razumen iskalni niz ni daljši —
    // varuje bazo pred patološkimi vnosi iz URL-ja.
    const q = raw.slice(0, MAX_QUERY_LENGTH)

    // Manj kot 2 znaka — iskanje še ni smiselno, vrni prazen rezultat.
    if (q.length < 2) {
      return NextResponse.json({ customers: [], inventory: [], projects: [] })
    }

    const visibility = searchVisibilityFor(auth)
    const pattern = escapeLikePattern(q)
    const insensitive = { contains: pattern, mode: 'insensitive' as const }

    const [customers, inventory, projects] = await Promise.all([
      visibility.customers
        ? db.customer.findMany({
            where: { OR: [{ ime: insensitive }, { naslov: insensitive }] },
            select: { id: true, ime: true, naslov: true },
            orderBy: { ime: 'asc' },
            take: SECTION_LIMIT,
          })
        : Promise.resolve([]),
      visibility.inventory
        ? db.inventory.findMany({
            where: { OR: [{ naziv: insensitive }, { sifraMateriala: insensitive }] },
            select: { id: true, naziv: true, sifraMateriala: true },
            orderBy: { naziv: 'asc' },
            take: SECTION_LIMIT,
          })
        : Promise.resolve([]),
      visibility.projects
        ? db.project.findMany({
            where: {
              AND: [
                projectSearchWhereFor(auth),
                {
                  OR: [
                    { nazivProjekta: insensitive },
                    { customer: { ime: insensitive } },
                  ],
                },
              ],
            },
            select: {
              id: true,
              nazivProjekta: true,
              customer: { select: { ime: true } },
            },
            orderBy: { updatedAt: 'desc' },
            take: SECTION_LIMIT,
          })
        : Promise.resolve([]),
    ])

    return NextResponse.json({
      customers,
      inventory: inventory.map((i) => ({
        id: i.id,
        naziv: i.naziv,
        sifra: i.sifraMateriala,
      })),
      projects: projects.map((p) => ({
        id: p.id,
        nazivProjekta: p.nazivProjekta,
        customerIme: p.customer?.ime ?? '',
      })),
    })
  } catch (error) {
    // R139: skupni pomožnik (src/lib/correlation.ts) — ENA oblika loga čez
    // vse rute (prej je ta ruta nosila lasten prepis istega vzorca).
    logWithCorrelation('search.get.error', correlationId ?? correlationFromRequest(request), error)
    // §22: uporabniku NIKOLI stack trace / Prisma internals — samo sporočilo
    // + correlation ID za povezavo z logi.
    return NextResponse.json(
      { error: 'Napaka pri iskanju', correlationId },
      { status: 500 }
    )
  }
}
