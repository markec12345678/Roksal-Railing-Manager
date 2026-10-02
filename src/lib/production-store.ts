/**
 * R378 (issue #13, korak R167 iz §9 + §10) — strežniška (transakcijska) plast
 * proizvodnje in as-installed zapisa: ProductionOrder/Line/Operation +
 * InstallationRecord/Line.
 * ---------------------------------------------------------------------------
 * Problem, ki ga ta plast zapira (issue #13 §9/§10): nad ODOBRENIM BOM
 * (R376) ni bilo kanonične izvedbene plasti — proizvodnja (§10) in dejansko
 * vgrajeno (§9 "tretja resnica") sta ostajala zunaj verige
 * QUOTE → BOM → PRODUCTION → INSTALLATION.
 *
 * Načela (delovni kanon repozitorija, enako kot bom-store R376):
 *   • EN VIR RESNICE — vsa ustvarjanja/prehodi/zapisi živijo SAMO tu (rute
 *     kličejo TE funkcije znotraj SVOJIH transakcij + revizija je ATOMSKA
 *     z dogodkom — auditInTx znotraj iste transakcije);
 *   • §10 STRAŽAR GEOMETRIJE — naročilo se izpelje IZKLJUČNO iz snapshotov
 *     vrstic obstoječe ODOBRENE BOMVersion (productionOrderLinesFromBom);
 *     NIC se ne izračunava iz UI vhoda, NIC se ne poizveduje živo po vrsticah
 *     naročila (internalSku je zmrznjen snapshot);
 *   • fail-closed — naročilo NAD neodobrenim BOM (DRAFT/SUPERSEDED) je JAVNA
 *     napaka 409 (§10: produkcija samo nad odobrenim BOM); prečni projekt
 *     409; terminalno naročilo ne zapisuje produkcije 409; klientovi totali
 *     (remainingQty) se NIKOLI ne sprejmejo — strežnik jih izračuna;
 *   • meja ZAKLEPANEGA projekta (dokumentirana odločitev R167): USTVARJANJE
 *     novega naročila/zapisa po zaklepu = 409 (nova zaveze = change-order
 *     teritorij, §6/§7), IZVEDBA obstoječega (prehodi + zapis produkcije +
 *     potrditev obstoječega zapisa) pa LAHKO teče naprej — fizično delo v
 *     teku se ne sme zadaviti z zaklepom papirja;
 *   • R294 F4 — stena ure živi v RUTI: `now` je obvezen argument.
 *
 * Plast je STREŽNIŠKA (uvozi db); čisto jedro (statusni stroji + izpeljave)
 * živi v src/lib/production-orders.ts.
 */

import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import type { SessionPayload } from './session'
import { auditInTx } from './audit'
import {
  PRODUCTION_ORDER_PRIORITIES,
  checkInstallationRecordTransition,
  checkProductionOrderTransition,
  installationRecordDefectsFromInput,
  installationRecordLinesFromInputs,
  isTerminalProductionStatus,
  productionOrderLinesFromBom,
  requiresTransitionReason,
} from './production-orders'

/** Napaka plasti — sporočilo je JAVNO (slovensko), status določi ruta. */
export class ProductionStoreError extends Error {
  /** Predlagani HTTP status (400 validacija; 404 manjka vir; 409 poslovno stanje). */
  readonly suggestedStatus: 400 | 404 | 409
  constructor(message: string, suggestedStatus: 400 | 404 | 409) {
    super(message)
    this.name = 'ProductionStoreError'
    this.suggestedStatus = suggestedStatus
  }
}

/** Revizijski kontekst — audit je OBVEZEN del vsake mutacije te plasti (§19). */
export interface RevizijskiKontekst {
  request: Request
  session: SessionPayload | null
  /** Profile.id akterja (ali null za servisni ključ). */
  userId: string | null
}

const zaokrozi3 = (v: number): number => Math.round(v * 1000) / 1000

// ── Ustvarjanje proizvodnega naročila (SAMO nad ODOBRENIM BOM, §10) ─────────

export interface UstvariProductionOrderVhod {
  projectId: string
  bomVersionId: string
  /** NIZKA | NORMALNA (privzeto) | URGENTNO — validiran proti jedru. */
  priority?: string
  /** Rok izdelave — NULL = neznan (§8). */
  dueAt?: Date | null
  actorId: string | null
  /** R294 F4: stena ure živi v ruti — čas nastanka poda KLICATELJ. */
  now: Date
  revizija: RevizijskiKontekst
}

export interface UstvariProductionOrderIzhod {
  orderId: string
  status: string
  priority: string
  lineCount: number
  bomVersionId: string
}

/**
 * Ustvari proizvodni nalog ZNOTRAJ podane transakcije:
 *   1. vrata projekta: obstaja (404) + NI zaklenjen (409 — novo naročilo po
 *      zaklepu je nova zaveza = change-order teritorij, §6/§7);
 *   2. vrata BOM: verzija obstaja (404) + pripada TEM projektu (409 prečni) +
 *      status APPROVED (409 — §10 izrecno: produkcija samo nad odobrenim BOM;
 *      DRAFT je osnutek odločitve, ne vir izvedbe);
 *   3. vrstice = SNAPSHOT BOMLine prek čistega jedra (§10 stražar geometrije —
 *      NIČ se ne izračunava iz UI vhoda);
 *   4. naročilo PLANNED + vrstice + revizijski vpis — VSE atomsko.
 */
export async function ustvariProductionOrderVTx(
  tx: Prisma.TransactionClient,
  vhod: UstvariProductionOrderVhod,
): Promise<UstvariProductionOrderIzhod> {
  const projekt = await tx.project.findUnique({
    where: { id: vhod.projectId },
    select: { id: true, dealLocked: true },
  })
  if (!projekt) {
    throw new ProductionStoreError('Projekt ne obstaja.', 404)
  }
  if (projekt.dealLocked) {
    throw new ProductionStoreError(
      'Zaklenjen projekt — novo proizvodno naročilo je nova zaveza (sprememba = eksplicitni change order).',
      409,
    )
  }

  const verzija = await tx.bOMVersion.findUnique({
    where: { id: vhod.bomVersionId },
    include: { bom: { select: { projectId: true } }, lines: { orderBy: { lineOrder: 'asc' } } },
  })
  if (!verzija) {
    throw new ProductionStoreError('BOM verzija ne obstaja.', 404)
  }
  if (verzija.bom.projectId !== vhod.projectId) {
    throw new ProductionStoreError('BOM verzija ne pripada temu projektu (prečni dostop zavrnjen).', 409)
  }
  if (verzija.status !== 'APPROVED') {
    throw new ProductionStoreError(
      `Produkcija je mogoča samo nad odobreno BOM verzijo — trenutni status je ${verzija.status} (§10).`,
      409,
    )
  }

  const priority = vhod.priority ?? 'NORMALNA'
  if (!(PRODUCTION_ORDER_PRIORITIES as readonly string[]).includes(priority)) {
    throw new ProductionStoreError(
      `Neveljavna prioriteta '${priority}' (dovoljeno: ${PRODUCTION_ORDER_PRIORITIES.join('/')}).`,
      400,
    )
  }

  // §10: snapshoti vrstic SO vhod — jedro ne poizveduje, ne izračunava geometrije.
  const vrstice = productionOrderLinesFromBom(
    verzija.lines.map((l) => ({
      id: l.id,
      lineOrder: l.lineOrder,
      internalSku: l.internalSku,
      quantity: l.quantity.toNumber(),
      unit: l.unit,
    })),
  )

  const nalog = await tx.productionOrder.create({
    data: {
      projectId: vhod.projectId,
      bomVersionId: verzija.id,
      status: 'PLANNED',
      priority,
      dueAt: vhod.dueAt ?? null,
      createdById: vhod.actorId,
      createdAt: vhod.now,
    },
  })
  await tx.productionOrderLine.createMany({
    data: vrstice.map((l) => ({
      productionOrderId: nalog.id,
      bomLineId: l.bomLineId,
      lineOrder: l.lineOrder,
      internalSku: l.internalSku,
      plannedQty: l.plannedQty,
      producedQty: l.producedQty,
      rejectedQty: l.rejectedQty,
      scrappedQty: l.scrappedQty,
      remainingQty: l.remainingQty,
      unit: l.unit,
    })),
  })
  await auditInTx(tx, {
    request: vhod.revizija.request,
    session: vhod.revizija.session,
    userId: vhod.revizija.userId,
    projectId: vhod.projectId,
    akcija: 'PRODUCTION_ORDER_CREATED',
    oldValue: null,
    newValue: {
      orderId: nalog.id,
      status: 'PLANNED',
      priority,
      bomVersionId: verzija.id,
      lineCount: vrstice.length,
      dueAt: vhod.dueAt?.toISOString() ?? null,
    },
  })

  return {
    orderId: nalog.id,
    status: nalog.status,
    priority: nalog.priority,
    lineCount: vrstice.length,
    bomVersionId: verzija.id,
  }
}

// ── Prehod statusa naročila (matrika §10 + revizija ATOMSKO) ────────────────

export interface PrehodProductionOrderVhod {
  orderId: string
  to: string
  /** Obvezen za izide (REWORK/REJECTED/SCRAPPED/REPLACED) — odmik brez razloga je tiha mutacija. */
  reason?: string | null
  actorId: string | null
  now: Date
  revizija: RevizijskiKontekst
}

export interface PrehodProductionOrderIzhod {
  orderId: string
  from: string
  to: string
}

/**
 * Prehod statusa naročila PO MATRIKI (production-orders.ts EN VIR) + revizijski
 * vpis ATOMSKO. Pravila:
 *   • neznan/nedovoljen prehod → 409 z dovoljenimi cilji (javno, ne tiho);
 *   • izidi (REWORK/REJECTED/SCRAPPED/REPLACED) zahtevajo RAZLOG (400 brez);
 *   • PLANNED → RELEASED napolni approvedById/approvedAt (izpult v proizvodnjo
 *     JE odobritev izvedbe — dokumentirana odločitev);
 *   • zaklenjen projekt NE blokira prehodov obstoječega naročila (meja R167:
 *     izvedba v teku teče naprej — novo naročilo pa je 409).
 */
export async function prehodProductionOrderVTx(
  tx: Prisma.TransactionClient,
  vhod: PrehodProductionOrderVhod,
): Promise<PrehodProductionOrderIzhod> {
  const nalog = await tx.productionOrder.findUnique({
    where: { id: vhod.orderId },
    select: { id: true, status: true, projectId: true, priority: true },
  })
  if (!nalog) {
    throw new ProductionStoreError('Proizvodno naročilo ne obstaja.', 404)
  }
  const prehod = checkProductionOrderTransition(nalog.status, vhod.to)
  if (!prehod.ok) {
    throw new ProductionStoreError(
      `Prehod ${nalog.status} → ${vhod.to} ni dovoljen (matrika §10).` +
        (prehod.allowed.length > 0 ? ` Dovoljeni cilji: ${prehod.allowed.join(', ')}.` : ' Trenutni status je terminalen.'),
      409,
    )
  }
  const razlog = typeof vhod.reason === 'string' ? vhod.reason.trim() : ''
  if (requiresTransitionReason(vhod.to) && razlog.length === 0) {
    throw new ProductionStoreError(
      `Prehod v ${vhod.to} je odmik od načrta — razlog je obvezen (dokumentirana odločitev R167).`,
      400,
    )
  }

  // Izpult v proizvodnjo = odobritev izvedbe (approvedById/approvedAt).
  const odobritev = nalog.status === 'PLANNED' && vhod.to === 'RELEASED'
  const posodobljen = await tx.productionOrder.update({
    where: { id: nalog.id },
    data: {
      status: vhod.to,
      ...(odobritev ? { approvedById: vhod.actorId, approvedAt: vhod.now } : {}),
    },
  })
  await auditInTx(tx, {
    request: vhod.revizija.request,
    session: vhod.revizija.session,
    userId: vhod.revizija.userId,
    projectId: nalog.projectId,
    akcija: 'PRODUCTION_ORDER_TRANSITION',
    oldValue: { orderId: nalog.id, status: nalog.status, priority: nalog.priority },
    newValue: {
      orderId: nalog.id,
      status: posodobljen.status,
      reason: razlog.length > 0 ? razlog : null,
      ...(odobritev ? { approvedAt: vhod.now.toISOString() } : {}),
    },
  })

  return { orderId: nalog.id, from: nalog.status, to: posodobljen.status }
}

// ── Zapis produkcije po vrstici (strežniški recompute, klientovi totali NE) ─

export interface ZapisProdukcijeVhod {
  orderId: string
  bomLineId: string
  /** Novi ABSOLUTNI totali (ne delte — idempotenten popravek, staro→novo v reviziji). */
  producedQty?: number
  rejectedQty?: number
  scrappedQty?: number
  actorId: string | null
  now: Date
  revizija: RevizijskiKontekst
}

export interface ZapisProdukcijeIzhod {
  lineId: string
  bomLineId: string
  plannedQty: number
  producedQty: number
  rejectedQty: number
  scrappedQty: number
  /** STREŽNIŠKO izračunano: planned − produced − scrapped. */
  remainingQty: number
}

/**
 * Zapiše produkcijo (produced/rejected/scrapped) na VRSTICO naročila:
 *   • vrata: naročilo obstaja (404) + NI terminalno (409 — mrto naročilo ne
 *     zapisuje produkcije; fizična dejstva mrtvega naročila so zaklenjena);
 *   • vrstica {orderId, bomLineId} mora obstajati (404 — tuji bomLineId je laž);
 *   • vhodi so ABSOLUTNI totali (izpuščena polja ohranijo trenutno stanje),
 *     vsak ≥ 0 in končen (400 sicer) — BREZ clampov (clamp bi tiho lopotal);
 *   • INVARIANTI (javno 409/400, nikoli tiho):
 *       produced + scrapped ≤ planned (remaining ≥ 0 — ne moreš izdelati
 *         več kot je načrtovano brez spremembe BOM/change order);
 *       rejected ≤ produced (ne moreš zavrniti neizdelanega);
 *   • remainingQty izračuna STREŽNIK — klientovo polje ne obstaja v shemi
 *     vnosa (forged vhod se zavrne že v ruti, stroga validacija).
 */
export async function zapisProdukcijeVTx(
  tx: Prisma.TransactionClient,
  vhod: ZapisProdukcijeVhod,
): Promise<ZapisProdukcijeIzhod> {
  const nalog = await tx.productionOrder.findUnique({
    where: { id: vhod.orderId },
    select: { id: true, status: true, projectId: true },
  })
  if (!nalog) {
    throw new ProductionStoreError('Proizvodno naročilo ne obstaja.', 404)
  }
  if (isTerminalProductionStatus(nalog.status)) {
    throw new ProductionStoreError(
      `Naročilo je v terminalnem statusu ${nalog.status} — produkcija se ne zapisuje na mrtvo naročilo.`,
      409,
    )
  }
  const vrstica = await tx.productionOrderLine.findUnique({
    where: { productionOrderId_bomLineId: { productionOrderId: nalog.id, bomLineId: vhod.bomLineId } },
  })
  if (!vrstica) {
    throw new ProductionStoreError('BOM vrstica ni del tega proizvodnega naročila.', 404)
  }

  const preveriKolicino = (v: number | undefined, polje: string): number => {
    if (v === undefined) return NaN // nadomesti spodaj s trenutno vrednostjo
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw new ProductionStoreError(`${polje} mora biti končna količina ≥ 0 (dobili ${String(v)}).`, 400)
    }
    return zaokrozi3(v)
  }
  const producedQty = vhod.producedQty === undefined ? vrstica.producedQty.toNumber() : preveriKolicino(vhod.producedQty, 'producedQty')
  const rejectedQty = vhod.rejectedQty === undefined ? vrstica.rejectedQty.toNumber() : preveriKolicino(vhod.rejectedQty, 'rejectedQty')
  const scrappedQty = vhod.scrappedQty === undefined ? vrstica.scrappedQty.toNumber() : preveriKolicino(vhod.scrappedQty, 'scrappedQty')

  const plannedQty = vrstica.plannedQty.toNumber()
  if (rejectedQty > producedQty) {
    throw new ProductionStoreError(
      `rejectedQty (${rejectedQty}) ne sme presegati producedQty (${producedQty}) — ne moreš zavrniti neizdelanega.`,
      409,
    )
  }
  const remainingQty = zaokrozi3(plannedQty - producedQty - scrappedQty)
  if (remainingQty < 0) {
    throw new ProductionStoreError(
      `Zapis presega načrtovano količino: produced + scrapped (${producedQty + scrappedQty}) > planned (${plannedQty}) — sprememba načrta je change order, ne zapis produkcije.`,
      409,
    )
  }

  const posodobljena = await tx.productionOrderLine.update({
    where: { id: vrstica.id },
    data: { producedQty, rejectedQty, scrappedQty, remainingQty },
  })
  await auditInTx(tx, {
    request: vhod.revizija.request,
    session: vhod.revizija.session,
    userId: vhod.revizija.userId,
    projectId: nalog.projectId,
    akcija: 'PRODUCTION_LINE_RECORDED',
    oldValue: {
      lineId: vrstica.id,
      bomLineId: vrstica.bomLineId,
      producedQty: vrstica.producedQty.toNumber(),
      rejectedQty: vrstica.rejectedQty.toNumber(),
      scrappedQty: vrstica.scrappedQty.toNumber(),
      remainingQty: vrstica.remainingQty.toNumber(),
    },
    newValue: {
      lineId: vrstica.id,
      bomLineId: vrstica.bomLineId,
      producedQty,
      rejectedQty,
      scrappedQty,
      remainingQty,
    },
  })

  return {
    lineId: posodobljena.id,
    bomLineId: posodobljena.bomLineId,
    plannedQty,
    producedQty,
    rejectedQty,
    scrappedQty,
    remainingQty,
  }
}

// ── Ustvarjanje as-installed zapisa (§9 — verzionirana tretja resnica) ──────

export interface UstvariInstallationRecordVhod {
  projectId: string
  bomVersionId: string
  scheduleId?: string | null
  productionOrderId?: string | null
  crewId?: string | null
  monterId?: string | null
  startedAt?: Date | null
  completedAt?: Date | null
  /** Surov vhod vrstic (validira čisto jedro — installationRecordLinesFromInputs). */
  lines: unknown
  /** Surov vhod napak (validira čisto jedro — installationRecordDefectsFromInput). */
  defects?: unknown
  reworkNote?: string | null
  qcId?: string | null
  evidenceId?: string | null
  /** JSON niz dejanskih mer — NULL ali VELJAVEN JSON (parse preverba, §8). */
  actualMeasurementsJson?: string | null
  actorId: string | null
  now: Date
  revizija: RevizijskiKontekst
}

export interface UstvariInstallationRecordIzhod {
  recordId: string
  versionNumber: number
  status: string
  lineCount: number
}

/**
 * Ustvari NOVO VERZIJO as-installed zapisa (DRAFT) znotraj transakcije:
 *   1. vrata projekta: obstaja (404) + NI zaklenjen (409 — novo zavezo po
 *      zaklepu = change order teritorij; §6/§7 meja R167);
 *   2. vrata BOM: verzija obstaja (404) + TEM projektu (409 prečni) +
 *      APPROVED (409 — as-installed resnica se izraža PROTI odobrenemu BOM);
 *   3. vrstice validira čisto jedro (fail-closed); NE-NULL bomLineId mora
 *      biti VRSTICA TE verzije (409 — pripet na tujo verzijo bi bila laž) in
 *      internalSku vezanih vrstic STREŽNIK PREPISHE z snapshotom BOMLine
 *      (klient ne izbira SKU-ja vezane vrstice);
 *   4. vezave (schedule/productionOrder/qc/evidence) morajo pripadati TEMU
 *      projektu (409 prečni) oz. obstajati (404) — NE tiho odvzete;
 *   5. verzija = max + 1 na projekt (paralelna ustvarjanja odbije unique);
 *   6. zapis DRAFT + vrstice + revizija — VSE atomsko.
 */
export async function ustvariInstallationRecordVTx(
  tx: Prisma.TransactionClient,
  vhod: UstvariInstallationRecordVhod,
): Promise<UstvariInstallationRecordIzhod> {
  const projekt = await tx.project.findUnique({
    where: { id: vhod.projectId },
    select: { id: true, dealLocked: true },
  })
  if (!projekt) {
    throw new ProductionStoreError('Projekt ne obstaja.', 404)
  }
  if (projekt.dealLocked) {
    throw new ProductionStoreError(
      'Zaklenjen projekt — nov zapis as-installed je nova zaveza (sprememba = eksplicitni change order).',
      409,
    )
  }

  const verzija = await tx.bOMVersion.findUnique({
    where: { id: vhod.bomVersionId },
    include: { bom: { select: { projectId: true } }, lines: { select: { id: true, internalSku: true } } },
  })
  if (!verzija) {
    throw new ProductionStoreError('BOM verzija ne obstaja.', 404)
  }
  if (verzija.bom.projectId !== vhod.projectId) {
    throw new ProductionStoreError('BOM verzija ne pripada temu projektu (prečni dostop zavrnjen).', 409)
  }
  if (verzija.status !== 'APPROVED') {
    throw new ProductionStoreError(
      `Zapis as-installed se izraža proti odobreni BOM verziji — trenutni status je ${verzija.status} (§9).`,
      409,
    )
  }

  // Vrstice (fail-closed validacija čistega jedra) + EXACT vezava bomLineId:
  const vrsticeVhoda = installationRecordLinesFromInputs(vhod.lines)
  const poId = new Map(verzija.lines.map((l) => [l.id, l.internalSku]))
  for (const v of vrsticeVhoda) {
    if (v.bomLineId !== null && !poId.has(v.bomLineId)) {
      throw new ProductionStoreError(
        'Vgrajena vrstica se sklicuje na bomLineId, ki NI vrstica te BOM verzije (prečna vezava zavrnjena).',
        409,
      )
    }
  }
  // Klient NE izbira SKU-ja VEZANE vrstice — snapshot strežniški (sled ne laže).
  const vrstice = vrsticeVhoda.map((v) => ({
    ...v,
    internalSku: v.bomLineId !== null ? (poId.get(v.bomLineId) as string) : v.internalSku,
  }))
  const napake = installationRecordDefectsFromInput(vhod.defects)

  // Vezave na obstoječe entitete — vse ENAKO projektno področje (prečni dostop 409):
  if (vhod.scheduleId != null) {
    const termin = await tx.installationSchedule.findUnique({ where: { id: vhod.scheduleId }, select: { projectId: true } })
    if (!termin) throw new ProductionStoreError('Termin montaže ne obstaja.', 404)
    if (termin.projectId !== vhod.projectId) throw new ProductionStoreError('Termin montaže ne pripada temu projektu.', 409)
  }
  if (vhod.productionOrderId != null) {
    const nalog = await tx.productionOrder.findUnique({ where: { id: vhod.productionOrderId }, select: { projectId: true } })
    if (!nalog) throw new ProductionStoreError('Proizvodno naročilo ne obstaja.', 404)
    if (nalog.projectId !== vhod.projectId) throw new ProductionStoreError('Proizvodno naročilo ne pripada temu projektu.', 409)
  }
  if (vhod.crewId != null) {
    const ekipa = await tx.crew.findUnique({ where: { id: vhod.crewId }, select: { id: true } })
    if (!ekipa) throw new ProductionStoreError('Ekipa ne obstaja.', 404)
  }
  if (vhod.monterId != null) {
    const profil = await tx.profile.findUnique({ where: { id: vhod.monterId }, select: { id: true } })
    if (!profil) throw new ProductionStoreError('Monter ne obstaja.', 404)
  }
  if (vhod.qcId != null) {
    const qc = await tx.qualityControl.findUnique({ where: { id: vhod.qcId }, select: { projectId: true } })
    if (!qc) throw new ProductionStoreError('Preverba kakovosti ne obstaja.', 404)
    if (qc.projectId !== vhod.projectId) throw new ProductionStoreError('Preverba kakovosti ne pripada temu projektu.', 409)
  }
  if (vhod.evidenceId != null) {
    const dokazilo = await tx.installationEvidence.findUnique({ where: { id: vhod.evidenceId }, select: { projectId: true } })
    if (!dokazilo) throw new ProductionStoreError('Montažno dokazilo ne obstaja.', 404)
    if (dokazilo.projectId !== vhod.projectId) throw new ProductionStoreError('Montažno dokazilo ne pripada temu projektu.', 409)
  }

  let reworkNote: string | null = null
  if (vhod.reworkNote != null && typeof vhod.reworkNote === 'string') {
    const trimmed = vhod.reworkNote.trim()
    if (trimmed.length > 500) throw new ProductionStoreError('Opomba o popravilu presega 500 znakov.', 400)
    reworkNote = trimmed.length > 0 ? trimmed : null
  }
  let actualMeasurementsJson: string | null = null
  if (vhod.actualMeasurementsJson != null && typeof vhod.actualMeasurementsJson === 'string') {
    if (vhod.actualMeasurementsJson.length > 10000) {
      throw new ProductionStoreError('JSON dejanskih mer presega 10.000 znakov.', 400)
    }
    try {
      JSON.parse(vhod.actualMeasurementsJson)
    } catch {
      throw new ProductionStoreError('actualMeasurementsJson ni veljaven JSON (fail-closed, ne tiho).', 400)
    }
    actualMeasurementsJson = vhod.actualMeasurementsJson
  }
  if (
    vhod.startedAt != null && vhod.completedAt != null &&
    vhod.completedAt.getTime() < vhod.startedAt.getTime()
  ) {
    throw new ProductionStoreError('completedAt ne more biti pred startedAt — kronologija ne laže.', 400)
  }

  // Zaporedna verzija znotraj TRANSAKCIJE (dva vzporedna klica odbije unique).
  const zadnja = await tx.installationRecord.aggregate({
    where: { projectId: vhod.projectId },
    _max: { versionNumber: true },
  })
  const versionNumber = (zadnja._max.versionNumber ?? 0) + 1

  const zapis = await tx.installationRecord.create({
    data: {
      projectId: vhod.projectId,
      scheduleId: vhod.scheduleId ?? null,
      productionOrderId: vhod.productionOrderId ?? null,
      crewId: vhod.crewId ?? null,
      monterId: vhod.monterId ?? null,
      bomVersionId: verzija.id,
      startedAt: vhod.startedAt ?? null,
      completedAt: vhod.completedAt ?? null,
      versionNumber,
      status: 'DRAFT',
      defectsJson: JSON.stringify(napake),
      reworkNote,
      qcId: vhod.qcId ?? null,
      evidenceId: vhod.evidenceId ?? null,
      actualMeasurementsJson,
      createdById: vhod.actorId,
      createdAt: vhod.now,
    },
  })
  await tx.installationRecordLine.createMany({
    data: vrstice.map((l) => ({
      installationRecordId: zapis.id,
      bomLineId: l.bomLineId,
      internalSku: l.internalSku,
      installedQty: l.installedQty,
      unit: l.unit,
      wasteQty: l.wasteQty,
      note: l.note,
    })),
  })
  await auditInTx(tx, {
    request: vhod.revizija.request,
    session: vhod.revizija.session,
    userId: vhod.revizija.userId,
    projectId: vhod.projectId,
    akcija: 'INSTALLATION_RECORD_CREATED',
    oldValue: null,
    newValue: {
      recordId: zapis.id,
      versionNumber,
      status: 'DRAFT',
      bomVersionId: verzija.id,
      lineCount: vrstice.length,
      defectsCount: napake.length,
      scheduleId: vhod.scheduleId ?? null,
      productionOrderId: vhod.productionOrderId ?? null,
      qcId: vhod.qcId ?? null,
      evidenceId: vhod.evidenceId ?? null,
    },
  })

  return { recordId: zapis.id, versionNumber, status: zapis.status, lineCount: vrstice.length }
}

// ── Potrditev as-installed zapisa (§9 — DRAFT → POTRJENO, terminalno) ───────

export interface PotrdiInstallationRecordVhod {
  recordId: string
  /** Dokaz predaje — nastavljiv OB potrditvi (ne obvezno: NULL = nezabeležen, §8). */
  handoverName?: string | null
  handoverAt?: Date | null
  actorId: string | null
  now: Date
  revizija: RevizijskiKontekst
}

export interface PotrdiInstallationRecordIzhod {
  recordId: string
  versionNumber: number
  status: string
  approvedAt: Date
  /** Dokaz predaje PO potezi (klientovo stanje pred potezo ni resnica). */
  handoverName: string | null
  handoverAt: Date | null
}

/**
 * Potrdi zapis as-installed: DRAFT → POTRJENO (edini prehod; POTRJENO
 * TERMINALNO — sprememba potrjene resnice = NOVA verzija zapisa, nikoli
 * tiha mutacija — §9, isti kanon kot QuoteVersion/BOMVersion).
 *
 * Zaklenjen projekt potrditve NE blokira (meja R167): zapis je nastal PRED
 * zaklepom, potrjevanje pa je IZVEDBENA resnica (fizika se ni ustavila) —
 * novo verzijo po zaklepu pa blokira ustvarjanje (409 zgoraj).
 * Revizijski vpis ATOMSKO s potrditvijo (§19).
 */
export async function potrdiInstallationRecordVTx(
  tx: Prisma.TransactionClient,
  vhod: PotrdiInstallationRecordVhod,
): Promise<PotrdiInstallationRecordIzhod> {
  const zapis = await tx.installationRecord.findUnique({
    where: { id: vhod.recordId },
    select: { id: true, status: true, projectId: true, versionNumber: true },
  })
  if (!zapis) {
    throw new ProductionStoreError('Zapis as-installed ne obstaja.', 404)
  }
  const prehod = checkInstallationRecordTransition(zapis.status, 'POTRJENO')
  if (!prehod.ok) {
    throw new ProductionStoreError(
      `Potrjeno je terminalno — zapis verzije ${zapis.versionNumber} je že ${zapis.status} (sprememba = nova verzija zapisa).`,
      409,
    )
  }

  let handoverName: string | null | undefined = undefined
  if (vhod.handoverName !== undefined && vhod.handoverName !== null) {
    const trimmed = typeof vhod.handoverName === 'string' ? vhod.handoverName.trim() : ''
    if (trimmed.length > 200) throw new ProductionStoreError('Ime prevzemnika presega 200 znakov.', 400)
    handoverName = trimmed.length > 0 ? trimmed : null
  }

  const posodobljen = await tx.installationRecord.update({
    where: { id: zapis.id },
    data: {
      status: 'POTRJENO',
      approvedById: vhod.actorId,
      approvedAt: vhod.now,
      ...(handoverName !== undefined ? { handoverName } : {}),
      ...(vhod.handoverAt !== undefined && vhod.handoverAt !== null ? { handoverAt: vhod.handoverAt } : {}),
    },
  })
  await auditInTx(tx, {
    request: vhod.revizija.request,
    session: vhod.revizija.session,
    userId: vhod.revizija.userId,
    projectId: zapis.projectId,
    akcija: 'INSTALLATION_RECORD_APPROVED',
    oldValue: { recordId: zapis.id, status: zapis.status, versionNumber: zapis.versionNumber },
    newValue: {
      recordId: zapis.id,
      status: 'POTRJENO',
      versionNumber: zapis.versionNumber,
      approvedAt: vhod.now.toISOString(),
      handoverName: posodobljen.handoverName,
      handoverAt: posodobljen.handoverAt?.toISOString() ?? null,
    },
  })

  return {
    recordId: zapis.id,
    versionNumber: zapis.versionNumber,
    status: posodobljen.status,
    approvedAt: vhod.now,
    handoverName: posodobljen.handoverName,
    handoverAt: posodobljen.handoverAt,
  }
}

// ── Branja za rute (strežniški DTO prevodi) ─────────────────────────────────

/** Naloži proizvodno naročilo z vrsticami in operacijami (GET detajl). */
export async function naloziProductionOrder(orderId: string) {
  return db.productionOrder.findUnique({
    where: { id: orderId },
    include: {
      lines: { orderBy: { lineOrder: 'asc' } },
      operations: { orderBy: { sequence: 'asc' } },
    },
  })
}
