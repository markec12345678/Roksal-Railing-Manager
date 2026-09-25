// Roksal Field - API: Installation Schedules (V6)
// Koledar montaže — termini, ekipe, status
//
// R136 (§19): POST in PATCH sta ATOMSKA — termin + status projekta + poraba
// zaloge (BOM draft) + revizijski vpis padejo v EN commit. Prej je crash med
// koraki lahko pustil: zaključen termin brez MONTIRANO projekta ALI delno
// odšteto zalogo (ne-idempotentno — ponovni zaključek bi odštel dvakrat).
// R136 (§18): odšteto zalogo NE SME pasti pod 0 — pogojni decrement
// (updateMany WHERE kolicinaZaloga >= kolicina); nezadostna zaloga → 409
// z imenom materiala, CELA transakcija se vrne (prej je šlo tiho v minus).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { denyWithoutPermission } from '@/lib/auth'
import { principalBindingOf } from '@/lib/access'
import { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'
import {
  isValidIdempotencyKey,
  reserveIdempotencyIn,
  storeResponseIn,
  beginIdempotency,
  IdempotencyRaceError,
  idempotencyReplayResponse,
  idempotencyConflictResponse,
} from '@/lib/idempotency'

// R139 (issue #5 §17): neomejen findMany → privzeta zgornja meja + opcijske
// strani (isti kontrakt kot /api/customers iz R138). Odzivna OBLIKA (polje)
// ostane ista — mobilni klient ni prelomen. Neveljavne številke → fail-closed
// na privzeti limit (patološki vnosi ne morejo vleči neomejeno vrstic).
const DEFAULT_LIMIT = 500
const MAX_LIMIT = 500

/** Nezadostna zaloga — signal za 409 (ne 500); rollback opravi $transaction. */
class InsufficientStockError extends Error {
  constructor(public materialNaziv: string, public potrebno: number, public naZalogi: number) {
    super(`Zaloga "${materialNaziv}" ni dovoljša (potrebno ${potrebno}, na zalogi ${naZalogi}).`)
    this.name = 'InsufficientStockError'
  }
}

// GET — termini (z option projectId, crewId, datum range, limit/offset)
export async function GET(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const correlationId = correlationFromRequest(request)
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const crewId = searchParams.get('crewId')
    const status = searchParams.get('status')
    const od = searchParams.get('od')
    const doD = searchParams.get('do')

    // R139 (§17): strani — neveljavne številke → privzeti limit (fail-closed).
    const limitRaw = Number.parseInt(searchParams.get('limit') ?? '', 10)
    const offsetRaw = Number.parseInt(searchParams.get('offset') ?? '', 10)
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(limitRaw, MAX_LIMIT)
        : DEFAULT_LIMIT
    const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0

    const where = {
      ...(projectId ? { projectId } : {}),
      ...(crewId ? { crewId } : {}),
      ...(status ? { status } : {}),
      ...(od || doD ? { datumZacetka: { ...(od ? { gte: new Date(od) } : {}), ...(doD ? { lte: new Date(doD) } : {}) } } : {}),
    }

    const schedules = await db.installationSchedule.findMany({
      where,
      include: {
        project: { select: { id: true, nazivProjekta: true, customer: { select: { ime: true, naslov: true } } } },
        crew: { select: { id: true, naziv: true, barva: true } },
        monter: { select: { id: true, ime: true } },
        equipment: { include: { equipment: { select: { id: true, naziv: true, tip: true } } } },
      },
      orderBy: { datumZacetka: 'asc' },
      take: limit,
      skip: offset,
    })

    return NextResponse.json(schedules)
  } catch (error) {
    logWithCorrelation('schedules.get', correlationId, error)
    return NextResponse.json({ error: 'Napaka pri branju terminov', correlationId }, { status: 500 })
  }
}

// POST — ustvari termin montaže
export async function POST(request: Request) {
  // Spreminjanje cen, zalog, naročil in razporedov je vodstveno opravilo.
  // Monter bere (za delo na terenu), pisati pa ne sme.
  const denied = await denyWithoutPermission(request, 'production.manage')
  if (denied) return denied
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const correlationId = correlationFromRequest(request)

  // R140 (issue #5 §20): idempotenca — pisarna/offline klient pošilja stabilen
  // `Idempotency-Key`; retry po mrežni napaki NE SME ustvariti dvojnika
  // termina (prej: isti ključ ni bil upoštevan → dva termina za isti klik).
  // Rezervacija + odgovor v ISTI transakciji (exactly-once replay, isti
  // vzorec kot customers/measurements).
  const idemHeader = request.headers.get('Idempotency-Key')
  const idemKey = idemHeader !== null && isValidIdempotencyKey(idemHeader) ? idemHeader : null
  if (idemHeader !== null && !idemKey) {
    return NextResponse.json({ error: 'Neveljaven Idempotency-Key' }, { status: 400 })
  }
  const idemBinding = idemKey ? principalBindingOf(auth) : null

  try {
    const body = await request.json()
    const { projectId, crewId, monterId, datumZacetka, datumKonca, predvideneUre, opombe, lokacija } = body

    if (!projectId || !datumZacetka || !datumKonca) {
      return NextResponse.json({ error: 'projectId, datumZacetka, datumKonca so obvezni' }, { status: 400 })
    }

    // Preveri konflikte (isti crew ali monter v istem času)
    if (crewId) {
      const conflict = await db.installationSchedule.findFirst({
        where: {
          crewId,
          status: { in: ['NAVRTENO', 'V_TEKU'] },
          OR: [
            { datumZacetka: { lte: new Date(datumKonca) }, datumKonca: { gte: new Date(datumZacetka) } },
          ],
        },
      })
      if (conflict) {
        return NextResponse.json({ error: 'Ekipa ima že termin v tem času', conflict }, { status: 409 })
      }
    }

    const schedule = await db.$transaction(async (tx) => {
      // R140 (§20): rezervacija idempotenčnega ključa = PRVI stavek —
      // vzporedni poizkus istega ključa povzroči rollback cele transakcije.
      if (idemKey) await reserveIdempotencyIn(tx, idemKey, 'schedules', idemBinding)

      const created = await tx.installationSchedule.create({
        data: {
          projectId,
          crewId: crewId || null,
          monterId: monterId || null,
          datumZacetka: new Date(datumZacetka),
          datumKonca: new Date(datumKonca),
          predvideneUre: predvideneUre || 8,
          opombe: opombe || null,
          lokacija: lokacija || null,
          status: 'NAVRTENO',
        },
        include: {
          project: { select: { nazivProjekta: true, customer: { select: { ime: true, naslov: true } } } },
          crew: { select: { naziv: true, barva: true } },
        },
      })

      // Posodobi projekt status na V_IZDELAVI če je bil ZA_MONTAZO
      await tx.project.updateMany({
        where: { id: projectId, status: 'ZA_MONTAZO' },
        data: { status: 'V_IZDELAVI' },
      })

      // Revizijski vpis ATOMSKO s terminom (userId mora obstajati v Profile —
      // API-ključ pade nazaj na ADMIN profil; 'system' ni veljaven FK).
      let auditUserId: string | null = null
      if (auth.kind === 'user') {
        auditUserId = auth.session.sub
      } else {
        const fallback = await tx.profile.findFirst({ where: { vloga: 'ADMIN' }, select: { id: true } })
        auditUserId = fallback?.id ?? null
      }
      await tx.auditLog.create({
        data: {
          userId: auditUserId,
          projectId,
          akcija: 'SCHEDULE_CREATED',
          newValue: JSON.stringify({ scheduleId: created.id, datumZacetka, crewId }),
        },
      })

      // R140 (§20): odgovor se shrani v ISTI transakciji — replay vrne
      // originalni 201 z originalnim telesom (exactly-once).
      if (idemKey) await storeResponseIn(tx, idemKey, 201, JSON.stringify(created))

      return created
    })

    return NextResponse.json(schedule, { status: 201 })
  } catch (error) {
    // R140 (§20): P2002 na rezervaciji (vzporedni poizkus istega ključa) →
    // odloči replay/conflict — ISTA odločitev kot customers/measurements.
    if (error instanceof IdempotencyRaceError && idemKey) {
      const begun = await beginIdempotency(idemKey, 'schedules', idemBinding)
      if (begun.kind === 'replay') return idempotencyReplayResponse(begun)
      return idempotencyConflictResponse()
    }
    logWithCorrelation('schedules.post', correlationId, error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju termina', correlationId }, { status: 500 })
  }
}

// PATCH — spremeni status termina
export async function PATCH(request: Request) {
  // Spreminjanje cen, zalog, naročil in razporedov je vodstveno opravilo.
  // Monter bere (za delo na terenu), pisati pa ne sme.
  const denied = await denyWithoutPermission(request, 'production.manage')
  if (denied) return denied
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const correlationId = correlationFromRequest(request)
  try {
    const body = await request.json()
    const { id, status, dejanskeUre, opombe } = body

    if (!id || !status) {
      return NextResponse.json({ error: 'id in status sta obvezna' }, { status: 400 })
    }

    const validStatusi = ['NAVRTENO', 'V_TEKU', 'ZAKLJUCENO', 'PREKlicANO', 'PRELOZENO']
    if (!validStatusi.includes(status)) {
      return NextResponse.json({ error: 'Neveljaven status' }, { status: 400 })
    }

    const updated = await db.$transaction(async (tx) => {
      const row = await tx.installationSchedule.update({
        where: { id },
        data: {
          status,
          ...(dejanskeUre !== undefined ? { dejanskeUre } : {}),
          ...(opombe !== undefined ? { opombe } : {}),
        },
        include: { project: { select: { id: true, nazivProjekta: true } }, crew: { select: { naziv: true } } },
      })

      // Če je ZAKLJUCENO → posodobi projekt status na MONTIRANO + odštej
      // material iz zaloge (iz BOM draft) — VSE v isti transakciji.
      if (status === 'ZAKLJUCENO') {
        await tx.project.update({
          where: { id: row.projectId },
          data: { status: 'MONTIRANO' },
        })
        const project = await tx.project.findUnique({ where: { id: row.projectId }, select: { bomDraftJson: true } })
        if (project?.bomDraftJson) {
          const bom = JSON.parse(project.bomDraftJson)
          for (const item of bom.items || []) {
            // R138: po migraciji SQLite→PostgreSQL je `contains` postal
            // case-sensitive — ujemanje imena BOM artikla z zalogo je lahko
            // tihon odpadlo (npr. "inox vijak" v BOM ne bi več našlo
            // "Inox Vijak" → zaloga NI bila odšteta). Izrecno
            // mode: 'insensitive' obnovi vedenje iz SQLite obdobja.
            const firstWord = item.naziv.split(' ')[0]
            const inv = await tx.inventory.findFirst({
              where: { naziv: { contains: firstWord, mode: 'insensitive' } },
            })
            if (inv) {
              // §18: pogojni decrement — zaloga ne sme pasti pod 0. Neuspeh →
              // InsufficientStockError → CELA transakcija rollback (tudi status
              // termina in projekta; ni delne porabe).
              const decremented = await tx.inventory.updateMany({
                where: { id: inv.id, kolicinaZaloga: { gte: item.kolicina } },
                data: { kolicinaZaloga: { decrement: item.kolicina } },
              })
              if (decremented.count === 0) {
                throw new InsufficientStockError(inv.naziv, item.kolicina, inv.kolicinaZaloga)
              }
              await tx.inventoryMovement.create({
                data: { inventoryId: inv.id, kolicina: -item.kolicina, tipPremika: 'PORABA', projectId: row.projectId },
              })
            }
          }
        }
      }

      // Revizijski vpis ATOMSKO s spremembo (prej: ločen write, crash = sprememba
      // brez sledi; 'system' ni veljaven FK → API-ključ pade na ADMIN profil).
      let auditUserId: string | null = null
      if (auth.kind === 'user') {
        auditUserId = auth.session.sub
      } else {
        const fallback = await tx.profile.findFirst({ where: { vloga: 'ADMIN' }, select: { id: true } })
        auditUserId = fallback?.id ?? null
      }
      await tx.auditLog.create({
        data: {
          userId: auditUserId,
          projectId: row.projectId,
          akcija: 'SCHEDULE_STATUS',
          newValue: JSON.stringify({ scheduleId: row.id, status }),
        },
      })

      return row
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      // Fail-closed, javno razložljivo: materiala ni dovolj — nič ni spremenjeno.
      return NextResponse.json(
        {
          error: error.message,
          detail: 'Termin NI bil zaključen — zaloga materiala je nezadostna. Dopolnite zalogo ali prilagodite BOM.',
        },
        { status: 409 },
      )
    }
    logWithCorrelation('schedules.patch', correlationId, error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju termina', correlationId }, { status: 500 })
  }
}

// DELETE — izbriši termin
export async function DELETE(request: Request) {
  // Spreminjanje cen, zalog, naročil in razporedov je vodstveno opravilo.
  // Monter bere (za delo na terenu), pisati pa ne sme.
  const denied = await denyWithoutPermission(request, 'production.manage')
  if (denied) return denied
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const correlationId = correlationFromRequest(request)
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id je obvezen' }, { status: 400 })
    await db.installationSchedule.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    logWithCorrelation('schedules.delete', correlationId, error)
    return NextResponse.json({ error: 'Napaka pri brisanju termina', correlationId }, { status: 500 })
  }
}
