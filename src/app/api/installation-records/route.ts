// R378 (issue #13, korak R167 iz §9) — API: as-installed zapisi projekta
// (TRETJA RESNICA — kaj je DEJANSKO dostavljeno in vgrajeno).
// ---------------------------------------------------------------------------
// GET  — seznam VSEH verzij as-installed zapisov projekta (?projectId=;
//        dostop 'read' do projekta — ista vrata kot vse projektne rute).
//        Vrača minimalni seznam (status/verzija/vezave/lineCount — vrstice
//        in detajli so na GET /api/installation-records/[id]). Brez zapisov
//        → prazen seznam (iskrena praznina — kanon r277: še NI tretje
//        resnice, to ni napaka).
// POST — ustvari NOVO VERZIJO zapisa (DRAFT) proti ODOBRENI BOM verziji:
//          vhod  = { projectId, bomVersionId, scheduleId?, productionOrderId?,
//                    crewId?, monterId?, startedAt?, completedAt?,
//                    actualMeasurementsJson?, reworkNote?, defects?, lines } —
//                    vrstice so SUROV vhod (validira čisto jedro
//                    installationRecordLinesFromInputs: količina > 0, enota,
//                    internalSku, dedup bomLineId; VEZANA vrstica dobí SKU
//                    snapshot STREŽNIŠKO — klient ne izbira SKU-ja vezi);
//          vrata = dostop 'update' do projekta + pravica quotes.create
//                  (isti vzorec kot POST /api/bom in POST /api/production —
//                  katalog §10 »Izračun ponudbe (kalkulator/BOM)« pokriva
//                  izpeljane plasti verige ponudba→BOM→naročilo→vgradnja;
//                  RBAC matrika je ZAMRZNJENA);
//          stroj = ustvariInstallationRecordVTx (TRANSAKCIJSKO): projekt
//                  obstaja 404 / zaklenjen 409 (nova zaveza po zaklepu =
//                  change order teritorij §6/§7 — meja R167) / BOM verzija
//                  404 / prečni projekt 409 / status ≠ APPROVED 409 (§9:
//                  as-installed se izraža PROTI odobrenemu BOM) / prečne
//                  vezave (termin/naročilo/QC/dokazilo) 409 / kronologija
//                  completedAt ≥ startedAt 400 / verzija = max+1 atomsko +
//                  revizijski vpis ATOMSKO (§19).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticate, unauthorized, forbidden } from '@/lib/auth'
import { assertProjectAccess, lacksPermission, actorIdOf, AccessDeniedError } from '@/lib/access'
import { ProductionStoreError, ustvariInstallationRecordVTx } from '@/lib/production-store'
import { ProductionOrdersError } from '@/lib/production-orders'

import { zapisOmejitev } from '@/lib/rate-limit'
import { preberiJsonTelo } from '@/lib/api-telo'

// Vrstice so SUROV vhod (unknown) — čisto jedro validira fail-closed; zod
// tu zagotavlja SAMO obliko ovojnice (povezave + časi), ne vsebine vrstic
// (strict bi podvajal validacijo jedra — en vir resnice).
const novZapisSchema = z.object({
  projectId: z.string().min(1, 'projectId je obvezen').max(64),
  bomVersionId: z.string().min(1, 'bomVersionId je obvezen').max(64),
  scheduleId: z.string().min(1).max(64).optional().nullable(),
  productionOrderId: z.string().min(1).max(64).optional().nullable(),
  crewId: z.string().min(1).max(64).optional().nullable(),
  monterId: z.string().min(1).max(64).optional().nullable(),
  qcId: z.string().min(1).max(64).optional().nullable(),
  evidenceId: z.string().min(1).max(64).optional().nullable(),
  startedAt: z.string().datetime().optional().nullable(),
  completedAt: z.string().datetime().optional().nullable(),
  actualMeasurementsJson: z.string().max(10000).optional().nullable(),
  reworkNote: z.string().max(500).optional().nullable(),
  defects: z.array(z.unknown()).max(20).optional().nullable(),
  lines: z.array(z.unknown()).min(1, 'Zapis brez vrstic ni resnica — vnesite vgrajene količine.'),
})

export async function GET(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, monterId: true, vodjaId: true, dealLocked: true },
    })
    assertProjectAccess(auth, project, 'read')

    const zapisi = await db.installationRecord.findMany({
      where: { projectId },
      orderBy: { versionNumber: 'desc' },
      select: {
        id: true,
        versionNumber: true,
        status: true,
        bomVersionId: true,
        scheduleId: true,
        productionOrderId: true,
        crewId: true,
        monterId: true,
        startedAt: true,
        completedAt: true,
        handoverName: true,
        handoverAt: true,
        approvedAt: true,
        createdAt: true,
        _count: { select: { lines: true } },
      },
    })
    return NextResponse.json({
      projectId,
      dealLocked: project!.dealLocked,
      records: zapisi.map((z) => ({
        id: z.id,
        versionNumber: z.versionNumber,
        status: z.status,
        bomVersionId: z.bomVersionId,
        scheduleId: z.scheduleId,
        productionOrderId: z.productionOrderId,
        crewId: z.crewId,
        monterId: z.monterId,
        startedAt: z.startedAt,
        completedAt: z.completedAt,
        handoverName: z.handoverName,
        handoverAt: z.handoverAt,
        approvedAt: z.approvedAt,
        createdAt: z.createdAt,
        lineCount: z._count.lines,
      })),
    })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Installation records GET error:', error)
    return NextResponse.json({ error: 'Napaka pri branju as-installed zapisov' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  // R378 — val 2 omejevanje hitrosti na pisanju (WRITE_LIMIT, kind `write`)
  const zavrnjeno = zapisOmejitev(request, 'installation-records')
  if (zavrnjeno) return zavrnjeno

  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  // §10 (R135): as-installed zapis izpelje ISTA pravica kot BOM in proizvodno
  // naročilo (quotes.create — izpeljana plast verige ponudba→BOM→naročilo→
  // vgradnja; monter jo ima — teren izraža DEJANSKO izvedbo).
  if (lacksPermission(auth, 'quotes.create')) {
    return forbidden('Ustvarjanje as-installed zapisa zahteva uporabniško pravico quotes.create.')
  }
  try {
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const parsed = novZapisSchema.safeParse(telo.telo)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Neveljavni podatki', detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
        { status: 400 },
      )
    }
    const v = parsed.data

    // Vrata na ravni vira: zapis je poslovna resnica NA projektu.
    const project = await db.project.findUnique({
      where: { id: v.projectId },
      select: { id: true, monterId: true, vodjaId: true, dealLocked: true },
    })
    assertProjectAccess(auth, project, 'update')

    const actor = actorIdOf(auth)
    // R294 F4: stena ure živi v ruti — en trenutek za celo transakcijo.
    const zdaj = new Date()
    const ustvarjeno = await db.$transaction(async (tx) =>
      ustvariInstallationRecordVTx(tx, {
        projectId: v.projectId,
        bomVersionId: v.bomVersionId,
        scheduleId: v.scheduleId ?? null,
        productionOrderId: v.productionOrderId ?? null,
        crewId: v.crewId ?? null,
        monterId: v.monterId ?? null,
        qcId: v.qcId ?? null,
        evidenceId: v.evidenceId ?? null,
        startedAt: v.startedAt != null ? new Date(v.startedAt) : null,
        completedAt: v.completedAt != null ? new Date(v.completedAt) : null,
        actualMeasurementsJson: v.actualMeasurementsJson ?? null,
        reworkNote: v.reworkNote ?? null,
        defects: v.defects ?? undefined,
        lines: v.lines,
        actorId: actor,
        now: zdaj,
        revizija: { request, session: auth.kind === 'user' ? auth.session : null, userId: actor },
      }),
    )

    return NextResponse.json(
      {
        success: true,
        record: {
          id: ustvarjeno.recordId,
          versionNumber: ustvarjeno.versionNumber,
          status: ustvarjeno.status,
          bomVersionId: v.bomVersionId,
          lineCount: ustvarjeno.lineCount,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof ProductionStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.suggestedStatus })
    }
    if (error instanceof ProductionOrdersError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Installation records POST error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju as-installed zapisa' }, { status: 500 })
  }
}
