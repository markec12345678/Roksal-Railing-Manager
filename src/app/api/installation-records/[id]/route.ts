// R378 (issue #13, korak R167 iz §9) — API: detajl + potrditev as-installed.
// ---------------------------------------------------------------------------
// GET   — detajl zapisa (dostop 'read' do projekta): zapis + VSE vrstice
//         (internalSku/installedQty/unit/wasteQty — NULL = nezabeležen §8)
//         + minimalne vezave. defectsJson se vrača POVPREK (parsed) — kupec
//         DTO ne razrešuje strune ročno (§17 minimalni discipliniran odgovor).
// PATCH — SAMO dejanje approve: DRAFT → POTRJENO (terminalno — sprememba
//         potrjene resnice = NOVA verzija zapisa, §9). Ob potrditvi se
//         lahko nastavi dokaz predaje { handoverName?, handoverAt? } —
//         OBVEZNOSTNI prag NE (NULL = nezabeležen, §8 iskreno).
//         Zaklenjen projekt potrditve NE blokira (meja R167 — fizika se ni
//         ustavila ob zaklepu; NOVA verzija po zaklepu pa je blokirana v
//         POST). RBAC: dostop 'update' do projekta; potrditev = revizijski
//         vpis ATOMSKO s prehodom (§19; zapisuje ga plast production-store).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { assertProjectAccess, actorIdOf, AccessDeniedError } from '@/lib/access'
import { ProductionStoreError, potrdiInstallationRecordVTx } from '@/lib/production-store'

import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'

const patchSchema = z
  .object({
    action: z.literal('approve', { message: "Podprto dejanje: 'approve' (DRAFT → POTRJENO, §9)." }),
    handoverName: z.string().max(200).optional().nullable(),
    handoverAt: z.string().datetime().optional().nullable(),
  })
  .strict()

/** Vrstica DTO (§17 minimalni odgovor — brez notranjih zapisov revizije). */
interface InstallationLineDto {
  id: string
  bomLineId: string | null
  internalSku: string
  installedQty: number
  unit: string
  wasteQty: number | null
  note: string | null
}

interface InstallationDefectDto {
  opomba: string
  reseno: boolean
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { id } = await params
    const zapis = await db.installationRecord.findUnique({
      where: { id },
      include: {
        lines: { orderBy: { id: 'asc' } },
        // CEL projekt (monterId/vodjaId) za projektna vrata — NE golih
        // { id } (monter vidi SAMO svoje projekte; kanon access.ts):
        project: { select: { id: true, monterId: true, vodjaId: true } },
      },
    })
    if (!zapis) {
      return NextResponse.json({ error: 'Zapis as-installed ne obstaja' }, { status: 404 })
    }
    assertProjectAccess(auth, zapis.project, 'read')

    // defectsJson: strogo vnaprej validiran ob pisanju (jedro) — branje ga
    // razreši POVPREK; neveljaven JSON pomeni pokvarjen zapis (klient NE
    // popravlja tiho — javna napaka, fail-closed).
    let defects: InstallationDefectDto[]
    try {
      const parsed = JSON.parse(zapis.defectsJson)
      if (!Array.isArray(parsed)) throw new Error('ni seznam')
      defects = parsed
    } catch {
      return NextResponse.json(
        { error: 'defectsJson zapisa je pokvarjen — zapis zahteva popravek (fail-closed, ne tiho).' },
        { status: 500 },
      )
    }

    const lines: InstallationLineDto[] = zapis.lines.map((l) => ({
      id: l.id,
      bomLineId: l.bomLineId,
      internalSku: l.internalSku,
      installedQty: l.installedQty.toNumber(),
      unit: l.unit,
      wasteQty: l.wasteQty !== null ? l.wasteQty.toNumber() : null,
      note: l.note,
    }))

    return NextResponse.json({
      record: {
        id: zapis.id,
        projectId: zapis.projectId,
        versionNumber: zapis.versionNumber,
        status: zapis.status,
        bomVersionId: zapis.bomVersionId,
        scheduleId: zapis.scheduleId,
        productionOrderId: zapis.productionOrderId,
        crewId: zapis.crewId,
        monterId: zapis.monterId,
        qcId: zapis.qcId,
        evidenceId: zapis.evidenceId,
        startedAt: zapis.startedAt,
        completedAt: zapis.completedAt,
        reworkNote: zapis.reworkNote,
        actualMeasurementsJson: zapis.actualMeasurementsJson,
        handoverName: zapis.handoverName,
        handoverAt: zapis.handoverAt,
        approvedById: zapis.approvedById,
        approvedAt: zapis.approvedAt,
        createdAt: zapis.createdAt,
        defects,
        lines,
      },
    })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Installation record GET error:', error)
    return NextResponse.json({ error: 'Napaka pri branju as-installed zapisa' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // R378 — val 2 omejevanje hitrosti na pisanju (WRITE_LIMIT, kind `write`)
  const zavrnjeno = zapisOmejitev(request, 'installation-records/[id]')
  if (zavrnjeno) return zavrnjeno

  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { id } = await params
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const parsed = patchSchema.safeParse(telo.telo)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Neveljavni podatki', detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
        { status: 400 },
      )
    }
    const data = parsed.data

    // Vrata na ravni vira: potrditev je poslovna odločitev NA projektu.
    const zapis = await db.installationRecord.findUnique({
      where: { id },
      select: { id: true, project: { select: { id: true, monterId: true, vodjaId: true } } },
    })
    if (!zapis) {
      return NextResponse.json({ error: 'Zapis as-installed ne obstaja' }, { status: 404 })
    }
    assertProjectAccess(auth, zapis.project, 'update')

    const actor = actorIdOf(auth)
    // R294 F4: stena ure živi v ruti — en trenutek za celo transakcijo.
    const zdaj = new Date()
    const potrjeno = await db.$transaction(async (tx) =>
      potrdiInstallationRecordVTx(tx, {
        recordId: id,
        handoverName: data.handoverName ?? undefined,
        handoverAt: data.handoverAt != null ? new Date(data.handoverAt) : undefined,
        actorId: actor,
        now: zdaj,
        revizija: { request, session: auth.kind === 'user' ? auth.session : null, userId: actor },
      }),
    )

    return NextResponse.json({
      success: true,
      record: {
        id: potrjeno.recordId,
        versionNumber: potrjeno.versionNumber,
        status: potrjeno.status,
        approvedAt: potrjeno.approvedAt,
        handoverName: potrjeno.handoverName,
        handoverAt: potrjeno.handoverAt,
      },
    })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof ProductionStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    console.error('Installation record PATCH error:', error)
    return NextResponse.json({ error: 'Napaka pri potrditvi as-installed zapisa' }, { status: 500 })
  }
}
