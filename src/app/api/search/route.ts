// Roksal Field - API: Globalno iskanje (ukazna paleta)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'

// GET /api/search?q=… — hkratno iskanje čez stranke, zalogo in projekte.
//
// SQLite v Prisma NE podpira `mode: 'insensitive'`, zato ne filtriramo v bazi,
// ampak vzamemo omejen vzorec vrstic (take 200/300) in primerjamo v JS prek
// `.toLowerCase().includes()` — preprosto in zanesljivo ne glede na bazo.
export async function GET(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') ?? '').trim().toLowerCase()

    // Manj kot 2 znaka — iskanje še ni smiselno, vrni prazen rezultat.
    if (q.length < 2) {
      return NextResponse.json({ customers: [], inventory: [], projects: [] })
    }

    const [customers, inventory, projects] = await Promise.all([
      db.customer.findMany({
        select: { id: true, ime: true, naslov: true },
        orderBy: { ime: 'asc' },
        take: 200,
      }),
      db.inventory.findMany({
        select: { id: true, naziv: true, sifraMateriala: true },
        orderBy: { naziv: 'asc' },
        take: 300,
      }),
      db.project.findMany({
        select: {
          id: true,
          nazivProjekta: true,
          customer: { select: { ime: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 200,
      }),
    ])

    const matches = (value: string | null | undefined): boolean =>
      Boolean(value && value.toLowerCase().includes(q))

    return NextResponse.json({
      customers: customers
        .filter((c) => matches(c.ime) || matches(c.naslov))
        .slice(0, 5),
      inventory: inventory
        .filter((i) => matches(i.naziv) || matches(i.sifraMateriala))
        .slice(0, 5)
        .map((i) => ({ id: i.id, naziv: i.naziv, sifra: i.sifraMateriala })),
      projects: projects
        .filter((p) => matches(p.nazivProjekta) || matches(p.customer?.ime))
        .slice(0, 5)
        .map((p) => ({
          id: p.id,
          nazivProjekta: p.nazivProjekta,
          customerIme: p.customer?.ime ?? '',
        })),
    })
  } catch (error) {
    console.error('Search GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri iskanju' }, { status: 500 })
  }
}
