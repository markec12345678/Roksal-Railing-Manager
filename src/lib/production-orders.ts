/**
 * R378 (issue #13, korak R167 iz §9 + §10) — ČISTO jedro proizvodnje in
 * as-installed zapisa: statusni stroji + deterministična izpeljava vrstic.
 * ---------------------------------------------------------------------------
 * Problem, ki ga to jedro zapira (issue #13 §10): do R376 je bila veriga
 * QUOTE → BOM zaključena na odobrenem BOM, nad njim pa NI bilo kanoničnega
 * proizvodnega objekta (§10) niti verzionirane "tretje resnice" o dejansko
 * VGRAJENEM (§9). To jedro je EN VIR statusnih strojev + izpeljav — brez
 * njega bi vsaka ruta pisala svojo matriko prehodov.
 *
 * Zasnova (isti vzorec kot bom-versions R376 — čisto jedro):
 *   • NIČ baze, NIČ ure, NIČ I/O — vsi vhodi so argumenti (determinizem:
 *     isti vhodi → bajtno identične vrstice, dokazljivo v testih);
 *   • §10 STRAŽAR GEOMETRIJE: produkcija NE SME ponovno izračunavati
 *     geometrije iz UI vhoda — snapshoti BOMLine so VHOD IN NIČ DRUGEGA.
 *     Ta modul ZAVESTNO ne uvaža railing-layout/quote-repro/quote (test
 *     r378-production-orders preverja VIR modula — statični pregled);
 *   • fail-closed: neznan status/prazna vrstica/nezdana količina → JAVNA
 *     napaka (ProductionOrdersError), NIKOLI tiha substitucija;
 *   • HONEST NULLs (§8): wasteQty/plannedDuration/actualDuration NULL, ko
 *     vir ne obstaja — nikoli izmišljene vrednosti.
 */

// ── Statusni stroj proizvodnega naročila (EN VIR, §10) ──────────────────────

export const PRODUCTION_ORDER_STATUSES = [
  'PLANNED',
  'RELEASED',
  'IN_PRODUCTION',
  'QC',
  'PRODUCED',
  'READY_FOR_INSTALLATION',
  'REWORK',
  'REJECTED',
  'SCRAPPED',
  'REPLACED',
] as const
export type ProductionOrderStatus = (typeof PRODUCTION_ORDER_STATUSES)[number]

/** Prioritete naročila (v repu NI obstoječega nabora — trije iskreni nivoji). */
export const PRODUCTION_ORDER_PRIORITIES = ['NIZKA', 'NORMALNA', 'URGENTNO'] as const
export type ProductionOrderPriority = (typeof PRODUCTION_ORDER_PRIORITIES)[number]

/**
 * Izidi (odmiki od načrta) — vsak ZAHTEVA razlog: odmik brez razloga je
 * tiha mutacija zgodovine, razlog pa je edini dokaz, ZAKAJ je naročilo
 * izstopilo iz verige. Naprej-paženi prehodi razloga NE zahtevajo.
 */
export const PRODUCTION_ORDER_OUTCOMES = ['REWORK', 'REJECTED', 'SCRAPPED', 'REPLACED'] as const
export type ProductionOrderOutcome = (typeof PRODUCTION_ORDER_OUTCOMES)[number]

/**
 * Dovoljeni prehodi statusa proizvodnega naročila (§10 — ŽIVLJENJSKI CIKL):
 *
 *   PLANNED → RELEASED    izpust v proizvodnjo (odobritev izvedbe —
 *                          napolni approvedById/approvedAt);
 *   RELEASED → IN_PRODUCTION  začetek izdelave;
 *   IN_PRODUCTION → QC     izdelava končana, v kontrolo kakovosti;
 *   QC → PRODUCED          kontrola uspešna;
 *   PRODUCED → READY_FOR_INSTALLATION  pripravljenost za montažo (konec
 *                          proizvodne verige §10 — nadaljevanje je §9);
 *
 * Izidi (odmiki) — dostopni IZ VSAKEGA živega stanja, kjer imajo smisel:
 *   {PLANNED,RELEASED,IN_PRODUCTION,QC,PRODUCED,READY_FOR_INSTALLATION,
 *    REWORK} → SCRAPPED    odpis naročila (dokončen);
 *   {PLANNED,RELEASED,IN_PRODUCTION,QC,PRODUCED,READY_FOR_INSTALLATION,
 *    REWORK} → REPLACED    nadomeščeno z drugim naročilom (dokončen);
 *   {IN_PRODUCTION,QC,PRODUCED,READY_FOR_INSTALLATION} → REWORK
 *                          odkrita napaka, zahteva popravilo (REWORK je
 *                          STANJE naročila, ne končni izid);
 *   QC → REJECTED          kontrola NEUSPEŠNA in NEpopravljiva (dokončen);
 *   REWORK → IN_PRODUCTION §10 izrecno: popravek se VRAČA v proizvodnjo;
 *                          kontrola sledi spet po običajni verigi.
 *
 * IZRECNO PREPOVEDANI robovi (dokumentirano, ne zgolj izpuščeno):
 *   PLANNED → IN_PRODUCTION   preskok izpusta — izpult JE vrata odobritve
 *                              (kdo je odobril izvedbo bi ostalo neznano);
 *   PLANNED → REWORK          nič izdelanega ni kaj popravljati — laž;
 *   RELEASED → REWORK         izplovljeno a neizdelano — odpis/nadomestitev,
 *                              ne "popravilo" nečesa, kar še ni nastalo;
 *   REWORK → QC               preskok — §10 določa POVRATEK v IN_PRODUCTION;
 *                              kontrola ponovno po verigi (IN_PRODUCTION→QC);
 *   PRODUCED → REJECTED       kontrola je ŽE uspešno prestala; odkritje po
 *                              kontroli je REWORK (popravljivo) ali SCRAP;
 *   REJECTED/SCRAPPED/REPLACED → karkoli  terminalno (mrto naročilo ne
 *                              oživi — sprememba je NOVO naročilo);
 *   vsak nazaj-pažen prehod   statusni stroj je usmerjen naprej; "razveljavitev"
 *                              izpusta/začetka bi izbrisala revizijsko sled.
 */
export const PRODUCTION_ORDER_TRANSITIONS: Readonly<
  Record<ProductionOrderStatus, readonly ProductionOrderStatus[]>
> = {
  PLANNED: ['RELEASED', 'SCRAPPED', 'REPLACED'],
  RELEASED: ['IN_PRODUCTION', 'SCRAPPED', 'REPLACED'],
  IN_PRODUCTION: ['QC', 'REWORK', 'SCRAPPED', 'REPLACED'],
  QC: ['PRODUCED', 'REWORK', 'REJECTED', 'SCRAPPED', 'REPLACED'],
  PRODUCED: ['READY_FOR_INSTALLATION', 'REWORK', 'SCRAPPED', 'REPLACED'],
  READY_FOR_INSTALLATION: ['REWORK', 'SCRAPPED', 'REPLACED'],
  REWORK: ['IN_PRODUCTION', 'SCRAPPED', 'REPLACED'],
  REJECTED: [],
  SCRAPPED: [],
  REPLACED: [],
}

export function allowedProductionOrderTransitions(from: string): readonly ProductionOrderStatus[] {
  return PRODUCTION_ORDER_TRANSITIONS[from as ProductionOrderStatus] ?? []
}

export function checkProductionOrderTransition(
  from: string,
  to: string,
): { ok: boolean; allowed: readonly ProductionOrderStatus[] } {
  const allowed = allowedProductionOrderTransitions(from)
  return { ok: (allowed as readonly string[]).includes(to), allowed }
}

/** Ali je status TERMINALEN (mrto — REJECTED/SCRAPPED/REPLACED)? */
export function isTerminalProductionStatus(status: string): boolean {
  return allowedProductionOrderTransitions(status).length === 0
}

/** Ali prehod v `to` zahteva razlog (odmik od načrta — §10 izidi)? */
export function requiresTransitionReason(to: string): boolean {
  return (PRODUCTION_ORDER_OUTCOMES as readonly string[]).includes(to)
}

// ── Statusni stroj operacije (§10 — enostavna operacijska matrika) ──────────

export const PRODUCTION_OPERATION_STATUSES = ['PLANNED', 'IN_PROGRESS', 'DONE', 'FAILED'] as const
export type ProductionOperationStatus = (typeof PRODUCTION_OPERATION_STATUSES)[number]

/**
 * Prehodi operacije: PLANNED → IN_PROGRESS → DONE | FAILED; FAILED → PLANNED
 * (ponovni posmek po neuspehu — izrecno dovoljen, saj je operacija fizično
 * isto delo); DONE terminalen (končana operacija se ne razveljavi — nova
 * operacija = nov vnos).
 */
export const PRODUCTION_OPERATION_TRANSITIONS: Readonly<
  Record<ProductionOperationStatus, readonly ProductionOperationStatus[]>
> = {
  PLANNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['DONE', 'FAILED'],
  FAILED: ['PLANNED'],
  DONE: [],
}

export function allowedProductionOperationTransitions(from: string): readonly ProductionOperationStatus[] {
  return PRODUCTION_OPERATION_TRANSITIONS[from as ProductionOperationStatus] ?? []
}

export function checkProductionOperationTransition(from: string, to: string): { ok: boolean } {
  return { ok: (allowedProductionOperationTransitions(from) as readonly string[]).includes(to) }
}

// ── Statusni stroj as-installed zapisa (§9 — verzionirana resnica) ──────────

export const INSTALLATION_RECORD_STATUSES = ['DRAFT', 'POTRJENO'] as const
export type InstallationRecordStatus = (typeof INSTALLATION_RECORD_STATUSES)[number]

/**
 * Dovoljeni prehodi zapisa as-installed (§9): DRAFT → POTRJENO (potrditev je
 * revizijsko sledena — approvedById/approvedAt + handover polja ob potrditvi);
 * POTRJENO TERMINALNO — sprememba potrjene resnice je NOVA VERZIJA zapisa
 * (isti kanon kot QuoteVersion R374 / BOMVersion R376, nikoli tiha mutacija).
 */
export const INSTALLATION_RECORD_TRANSITIONS: Readonly<
  Record<InstallationRecordStatus, readonly InstallationRecordStatus[]>
> = {
  DRAFT: ['POTRJENO'],
  POTRJENO: [],
}

export function allowedInstallationRecordTransitions(from: string): readonly InstallationRecordStatus[] {
  return INSTALLATION_RECORD_TRANSITIONS[from as InstallationRecordStatus] ?? []
}

export function checkInstallationRecordTransition(
  from: string,
  to: string,
): { ok: boolean; allowed: readonly InstallationRecordStatus[] } {
  const allowed = allowedInstallationRecordTransitions(from)
  return { ok: (allowed as readonly string[]).includes(to), allowed }
}

export function isTerminalInstallationStatus(status: string): boolean {
  return allowedInstallationRecordTransitions(status).length === 0
}

// ── Izpeljava proizvodnih vrstic iz SNAPSHOTOV BOMLine (§10) ────────────────

/** Fail-closed javna napaka jedra (validacija vhoda / matrike prehodov). */
export class ProductionOrdersError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProductionOrdersError'
  }
}

/**
 * §10 STRAŽAR GEOMETRIJE: vhod te izpeljave je SNAPSHOT obstoječe BOMLine
 * (id/lineOrder/internalSku/quantity/unit) — NIČ se ne izračunava iz UI
 * vhoda, NIČ se ne poizveduje. Količine, enote in SKU-ji živijo v odobreni
 * BOM verziji (nespremenljiva od R376) in so tu LE vhod.
 */
export interface BomLineSnapshotInput {
  id: string
  lineOrder: number
  internalSku: string
  quantity: number
  unit: string
}

/** Ena proizvodna vrstica (preslikava v ProductionOrderLine row). */
export interface ProductionOrderLineData {
  bomLineId: string
  lineOrder: number
  /** Snapshot SKU iz BOMLine (sledljivost — ne živa poizvedba). */
  internalSku: string
  /** plannedQty = BOMLine.quantity OB ustvarjanju (iskren snapshot, §10). */
  plannedQty: number
  unit: string
  producedQty: number
  rejectedQty: number
  scrappedQty: number
  /** planned − produced − scrapped (ob izpeljavi = plannedQty). */
  remainingQty: number
}

const zaokrozi3 = (v: number): number => Math.round(v * 1000) / 1000

/**
 * Izpeljava proizvodnih vrstic iz vrstic BOM (ČISTO — snapshoti so VHOD):
 *   plannedQty   = bomLine.quantity (snapshot trenutka izpeljave);
 *   internalSku/unit = snapshot iz BOMLine;
 *   produced/rejected/scrapped = 0 (nič ni laž — začetno dejstvo);
 *   remainingQty = plannedQty (nič še ni izdelano).
 *
 * Determinizem: isti vhodi (ISTI VRSTNI RED) → bajtno identične vrstice.
 * Fail-closed: prazen seznam / količina ≤ 0 / nekončna količina / prazen SKU
 * ali enota / podvojen bomLineId → ProductionOrdersError (javno, s številko
 * vrstice) — NIKOLI tiho preskočena vrstica.
 */
export function productionOrderLinesFromBom(bomLines: readonly BomLineSnapshotInput[]): ProductionOrderLineData[] {
  if (!Array.isArray(bomLines)) {
    throw new ProductionOrdersError('Vrstice BOM niso seznam — proizvodno naročilo ni mogoče izpeljati.')
  }
  if (bomLines.length === 0) {
    throw new ProductionOrdersError('BOM verzija nima vrstic — proizvodno naročilo brez vrstic je pokvarjen vhod.')
  }
  const videni = new Set<string>()
  return bomLines.map((l, i) => {
    if (typeof l.id !== 'string' || l.id.length === 0) {
      throw new ProductionOrdersError(`BOM vrstica #${i + 1} nima id — izpeljava proizvodnih vrstic ni mogoča.`)
    }
    if (videni.has(l.id)) {
      throw new ProductionOrdersError(`BOM vrstica #${i + 1} podvaja id ${l.id} — ena BOM vrstica = ena proizvodna vrstica.`)
    }
    videni.add(l.id)
    if (typeof l.internalSku !== 'string' || l.internalSku.length === 0) {
      throw new ProductionOrdersError(`BOM vrstica #${i + 1} nima internalSku — izpeljava ni mogoča.`)
    }
    if (typeof l.unit !== 'string' || l.unit.length === 0) {
      throw new ProductionOrdersError(`BOM vrstica #${i + 1} nima enote — izpeljava ni mogoča.`)
    }
    if (typeof l.quantity !== 'number' || !Number.isFinite(l.quantity) || l.quantity <= 0) {
      throw new ProductionOrdersError(
        `BOM vrstica #${i + 1} ima neveljavno količino (${String(l.quantity)}) — proizvodnja ne sme ugibati.`,
      )
    }
    const plannedQty = zaokrozi3(l.quantity)
    return {
      bomLineId: l.id,
      lineOrder: i + 1,
      internalSku: l.internalSku,
      plannedQty,
      unit: l.unit,
      producedQty: 0,
      rejectedQty: 0,
      scrappedQty: 0,
      remainingQty: plannedQty,
    }
  })
}

// ── Validacija vrstic as-installed zapisa (§9) ──────────────────────────────

/** Največ vgrajenih vrstic na en zapis (isti strop kot dokazila R147 − legitimna meja vnosa). */
export const MAX_INSTALLATION_RECORD_LINES = 200
/** Največ napak na zapis (isti vzorec kot InstallationEvidence.defectsJson). */
export const MAX_INSTALLATION_RECORD_DEFECTS = 20

/** Ena vgrajena vrstica (preslikava v InstallationRecordLine row). */
export interface InstallationRecordLineData {
  /** NULL = vgrajen material IZVEN BOM (iskreno — ne tiho pripet na BOM vrstico). */
  bomLineId: string | null
  internalSku: string
  installedQty: number
  unit: string
  /** NULL = odpadek nezabeležen (§8 — NIKOLI izmišljen). */
  wasteQty: number | null
  note: string | null
}

/**
 * Validacija/izpeljava vrstic as-installed (fail-closed):
 *   • seznam 1..200 vrstic (prazen zapis ni "nič vgrajeno", je pomanjkljiv
 *     vhod — zapis brez vrstic ne dokazuje ničesar);
 *   • installedQty > 0 (0 bi bila laž "vgrajeno nič" — kaj sploh počne tu);
 *   • unit/internalSku neprazna (sledljivost);
 *   • wasteQty NULL ali ≥ 0 (§8);
 *   • podvojen NE-NULL bomLineId → napaka (dvojni števec v §9 verigi bi
 *     pokvaril vsoto installedQty — ena BOM vrstica = ena vgrajena vrstica);
 *     dvojniki z bomLineId NULL (neizvirščan material) so DOVOLJENI — v
 *     verigo ne vplivajo (nemajo števca);
 *   • note izrecno NULL ali neprazen niz ≤ 500 znakov.
 */
export function installationRecordLinesFromInputs(raw: unknown): InstallationRecordLineData[] {
  if (!Array.isArray(raw)) {
    throw new ProductionOrdersError('Vrstice as-installed zapisa morajo biti seznam.')
  }
  if (raw.length === 0) {
    throw new ProductionOrdersError('Zapis as-installed brez vrstic ni resnica — vnesite vgrajene količine.')
  }
  if (raw.length > MAX_INSTALLATION_RECORD_LINES) {
    throw new ProductionOrdersError(`Največ ${MAX_INSTALLATION_RECORD_LINES} vgrajenih vrstic na zapis.`)
  }
  const videniBomLine = new Set<string>()
  return raw.map((entry, i) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new ProductionOrdersError(`Vgrajena vrstica #${i + 1} ni objekt.`)
    }
    const e = entry as Record<string, unknown>
    const bomLineId =
      e.bomLineId === null || e.bomLineId === undefined
        ? null
        : typeof e.bomLineId === 'string' && e.bomLineId.length > 0
          ? e.bomLineId
          : null
    if (e.bomLineId !== null && e.bomLineId !== undefined && bomLineId === null) {
      throw new ProductionOrdersError(`Vgrajena vrstica #${i + 1} ima neveljaven bomLineId (prazen/nizčni).`)
    }
    if (bomLineId !== null) {
      if (videniBomLine.has(bomLineId)) {
        throw new ProductionOrdersError(
          `Vgrajena vrstica #${i + 1} podvaja bomLineId — ena BOM vrstica = ena vgrajena vrstica (§9 števec).`,
        )
      }
      videniBomLine.add(bomLineId)
    }
    const internalSku = typeof e.internalSku === 'string' ? e.internalSku.trim() : ''
    if (internalSku.length === 0 || internalSku.length > 100) {
      throw new ProductionOrdersError(`Vgrajena vrstica #${i + 1} zahteva internalSku (1–100 znakov).`)
    }
    const installedQty = e.installedQty
    if (typeof installedQty !== 'number' || !Number.isFinite(installedQty) || installedQty <= 0) {
      throw new ProductionOrdersError(
        `Vgrajena vrstica #${i + 1} ima neveljavno količino (${String(installedQty)}) — vgrajeno 0/negativno ni resnica.`,
      )
    }
    const unit = typeof e.unit === 'string' ? e.unit.trim() : ''
    if (unit.length === 0 || unit.length > 20) {
      throw new ProductionOrdersError(`Vgrajena vrstica #${i + 1} zahteva enoto (1–20 znakov).`)
    }
    let wasteQty: number | null = null
    if (e.wasteQty !== null && e.wasteQty !== undefined) {
      if (typeof e.wasteQty !== 'number' || !Number.isFinite(e.wasteQty) || e.wasteQty < 0) {
        throw new ProductionOrdersError(`Vgrajena vrstica #${i + 1} ima neveljaven odpadek (${String(e.wasteQty)}) — NULL ali ≥ 0.`)
      }
      wasteQty = zaokrozi3(e.wasteQty)
    }
    let note: string | null = null
    if (e.note !== null && e.note !== undefined) {
      if (typeof e.note !== 'string') {
        throw new ProductionOrdersError(`Vgrajena vrstica #${i + 1} ima opombo, ki ni niz.`)
      }
      const trimmed = e.note.trim()
      if (trimmed.length === 0 || trimmed.length > 500) {
        throw new ProductionOrdersError(`Opomba vgrajene vrstice #${i + 1} mora biti neprazna in ≤ 500 znakov.`)
      }
      note = trimmed
    }
    return {
      bomLineId,
      internalSku,
      installedQty: zaokrozi3(installedQty),
      unit,
      wasteQty,
      note,
    }
  })
}

/** Ena napaka as-installed zapisa (isti obraz kot InstallationEvidence). */
export interface InstallationRecordDefect {
  opomba: string
  reseno: boolean
}

/**
 * Validacija napak as-installed (§9) — ISTI fail-closed vzorec kot
 * validateIEVDefects (InstallationEvidence.defectsJson): seznam ≤ 20,
 * opomba NEPRAZNA ≤ 300 znakov (napaka brez opombe se ne zapiše), reseno
 * obvezen boolean. NULL/undefined → prazen seznam (iskren privzetek).
 */
export function installationRecordDefectsFromInput(raw: unknown): InstallationRecordDefect[] {
  if (raw === null || raw === undefined) return []
  if (!Array.isArray(raw)) {
    throw new ProductionOrdersError('Napake as-installed zapisa morajo biti seznam.')
  }
  if (raw.length > MAX_INSTALLATION_RECORD_DEFECTS) {
    throw new ProductionOrdersError(`Največ ${MAX_INSTALLATION_RECORD_DEFECTS} napak na zapis.`)
  }
  return raw.map((entry, i) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new ProductionOrdersError(`Napaka #${i + 1} as-installed zapisa ni objekt.`)
    }
    const e = entry as Record<string, unknown>
    const opomba = typeof e.opomba === 'string' ? e.opomba.trim() : ''
    if (opomba.length === 0) {
      throw new ProductionOrdersError(`Napaka #${i + 1} brez opombe se ne zapiše.`)
    }
    if (opomba.length > 300) {
      throw new ProductionOrdersError(`Opomba napake #${i + 1} presega 300 znakov.`)
    }
    if (typeof e.reseno !== 'boolean') {
      throw new ProductionOrdersError(`Napaka #${i + 1} zahteva reseno = boolean.`)
    }
    return { opomba, reseno: e.reseno }
  })
}
