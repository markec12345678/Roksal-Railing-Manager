/**
 * R376 (issue #13, korak R166 iz §5/§6/§11 + §7 vezava) — strežniška plast
 * kanoničnega BOM: BOM + BOMVersion + BOMLine.
 * ---------------------------------------------------------------------------
 * Problem, ki ga ta plast zapira (issue #13 §6): BOM je bil do R374 samo
 * Project.bomDraftJson (legacy read-model) — brez verzij, brez actor/čas,
 * brez EXACT inventarne vezave. Od R376 je kanonični vir resnice BOMVersion
 * (NESPREMENLJIVA verzija nad nosilcem BOM — isti vzorec kot QuoteVersion
 * nad Quote, R374).
 *
 * Načela (delovni kanon repozitorija):
 *   • EN VIR RESNICE — ustvarjanje verzij BOM živi SAMO tu (deal-lock §7
 *     in POST /api/bom uporabljata ISTO funkcijo ustvariBomVerzijoVTx);
 *   • EXACT vezava (§5) — inventarni artikel se veže SAMO prek
 *     Inventory.sifraMateriala === QuoteItem.code (unikatna vozlica IN;
 *     BREZ fuzzy, BREZ includes, BREZ normalizacije); neujemana postavka
 *     ostane NEVEZANA (NULL + javni razlog v procurement pogledu §11);
 *   • fail-closed — prazna/praštevilčna verzija ponudbe je JAVNA napaka
 *     (BomStoreError 409), NIKOLI tiho prazen BOM;
 *   • supersede po matriki (bom-versions.ts EN VIR) — nova verzija postavi
 *     prejšnje DRAFT verzije v SUPERSEDED; APPROVED je TERMINALNO (§6:
 *     odobren BOM se ne spreminja — sprememba je nova verzija/change order);
 *   • R294 F4 — stena ure živi v RUTI: `now` je obvezen argument.
 *
 * Plast je STREŽNIŠKA (uvozi db); deterministično jedro generacije vrstic
 * (brez baze) živi v src/lib/bom-versions.ts.
 */

import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { checkBomVersionTransition, type ComputedBomVersion } from './bom-versions'

/** Napaka BOM plasti — sporočilo je JAVNO (slovensko), status določi ruta. */
export class BomStoreError extends Error {
  /** Predlagani HTTP status (409 = pokvarjeno stanje vhoda; 400 = validacija). */
  readonly suggestedStatus: 400 | 409
  constructor(message: string, suggestedStatus: 400 | 409) {
    super(message)
    this.name = 'BomStoreError'
    this.suggestedStatus = suggestedStatus
  }
}

// ── EXACT inventarne vezave (§5) ─────────────────────────────────────────────

/** Minimalna oblika postavke, ki jo vezava potrebuje (code = internalSku). */
export interface VezavaLineInput {
  code: string
}

/**
 * Naloži EXACT inventarne vezave za postavke: artikel, katerega sifraMateriala
 * je NATANKO code postavke (WHERE sifraMateriala IN (…codes) — unikatna
 * vozlica, brez fuzzy). supplierId = ZADNJA MaterialPrice vezava artikla
 * (veljavnostOd desc, createdAt desc — dobavitelj iz zgodovine cen) ali NULL;
 * supplierSku = NULL (vir v bazi še ne obstaja — iskreno NEZNANO, §8).
 */
export async function naloziInventarneVezave(lines: readonly VezavaLineInput[]): Promise<
  ReadonlyArray<{ id: string; sifraMateriala: string; supplierId: string | null; supplierSku: null }>
> {
  const kode = [...new Set(lines.map((l) => l.code))]
  if (kode.length === 0) return []
  const artikli = await db.inventory.findMany({
    where: { sifraMateriala: { in: kode } },
    select: { id: true, sifraMateriala: true },
  })
  if (artikli.length === 0) return []
  const cene = await db.materialPrice.findMany({
    where: { inventoryId: { in: artikli.map((a) => a.id) } },
    orderBy: [{ veljavnostOd: 'desc' }, { createdAt: 'desc' }],
    select: { inventoryId: true, supplierId: true },
  })
  // Prva cena po vrsti = ZADNJA veljavna vezava na tega dobavitelja.
  const zadnjiDobavitelj = new Map<string, string>()
  for (const c of cene) {
    if (!zadnjiDobavitelj.has(c.inventoryId)) zadnjiDobavitelj.set(c.inventoryId, c.supplierId)
  }
  return artikli.map((a) => ({
    id: a.id,
    sifraMateriala: a.sifraMateriala,
    supplierId: zadnjiDobavitelj.get(a.id) ?? null,
    supplierSku: null,
  }))
}

// ── Ustvarjanje verzije BOM (TRANSAKCIJSKO — kliče ga deal-lock §7 in
//    POST /api/bom iz LASTNIH transakcij) ────────────────────────────────────

export interface UstvariBomVerzijoVhod {
  projectId: string
  /** Kanonična QuoteVersion, iz katere je BOM izpeljan (§6 sled izvora). */
  sourceQuoteVersionId: string
  /** Vezana verzija cenika (PREPISAN iz izvorne verzije — isti vir stroškov). */
  priceBookVersionId: string
  /** DRAFT (POST /api/bom — osnutek za nabavo) ali APPROVED (deal-lock §7). */
  status: 'DRAFT' | 'APPROVED'
  /** Izračun kanoničnega jedra (bomVersionFromQuoteVersion — vrstice + sled). */
  computed: ComputedBomVersion
  /** Id prijavljenega uporabnika (mehka referenca; servisni ključ → null). */
  actorId: string | null
  /** R294 F4: stena ure živi v ruti — čas nastanka/odobritve poda KLICATELJ. */
  now: Date
}

export interface UstvariBomVerzijoIzhod {
  bomId: string
  versionId: string
  versionNumber: number
  status: 'DRAFT' | 'APPROVED'
  lineCount: number
}

/**
 * Ustvari novo verzijo BOM ZNOTRAJ podane transakcije (EN VIR — deal-lock jo
 * kliče ATOMSKO s podpisoma, POST /api/bom pa s svojo revizijo):
 *   1. upsert nosilca BOM (projectId UNIQUE — EN nosilec na projekt);
 *   2. zaporedna številka = max + 1 (paralelna ustvarjanja odbije
 *      @@unique([bomId, versionNumber]) na DB nivoju);
 *   3. SUPERSEDE prejšnjih DRAFT verzij (matrika DRAFT → SUPERSEDED;
 *      APPROVED je terminalno — se NE superseda, §6);
 *   4. verzija (DRAFT/APPROVED + approvedById/approvedAt samo ob odobritvi);
 *   5. vrstice (lineOrder = deterministični vrstni red iz jedra).
 *
 * Fail-closed: prazna verzija ponudbe (0 vrstic) → BomStoreError 409 —
 * prazen BOM ni poslovno stanje, tiha praznina pa bi bila laž.
 */
export async function ustvariBomVerzijoVTx(tx: Prisma.TransactionClient, vhod: UstvariBomVerzijoVhod): Promise<UstvariBomVerzijoIzhod> {
  if (vhod.computed.lines.length === 0) {
    throw new BomStoreError('Verzija ponudbe nima postavk — BOM brez vrstic je pokvarjen vhod.', 409)
  }

  // 1) Nosilec: EN na projekt (projectId UNIQUE); obstoječega pusti pri miru.
  const bom = await tx.bOM.upsert({
    where: { projectId: vhod.projectId },
    update: {},
    create: { projectId: vhod.projectId, status: 'AKTIVEN' },
  })

  // 2) Zaporedna številka znotraj TRANSAKCIJE (dva vzporedna klica → enako
  //    številko odbije unique constraint; klicatelj ponovi).
  const zadnja = await tx.bOMVersion.aggregate({
    where: { bomId: bom.id },
    _max: { versionNumber: true },
  })
  const versionNumber = (zadnja._max.versionNumber ?? 0) + 1

  // 3) Supersede prejšnjih DRAFT verzij (po matriki — APPROVED ostane).
  const zamenjane = await tx.bOMVersion.updateMany({
    where: { bomId: bom.id, status: 'DRAFT' },
    data: { status: 'SUPERSEDED' },
  })

  // 4) Verzija s sledjo izvora (§6): izvorna ponudba + vezana knjiga +
  //    verzija izračuna + odtis geometrije.
  const verzija = await tx.bOMVersion.create({
    data: {
      bomId: bom.id,
      versionNumber,
      status: vhod.status,
      sourceQuoteVersionId: vhod.sourceQuoteVersionId,
      priceBookVersionId: vhod.priceBookVersionId,
      productSdkVersion: vhod.computed.productSdkVersion,
      layoutFingerprint: vhod.computed.layoutFingerprint,
      createdById: vhod.actorId,
      approvedById: vhod.status === 'APPROVED' ? vhod.actorId : null,
      approvedAt: vhod.status === 'APPROVED' ? vhod.now : null,
      createdAt: vhod.now,
    },
  })

  // 5) Vrstice — deterministične iz jedra (lineOrder = vrstni red).
  await tx.bOMLine.createMany({
    data: vhod.computed.lines.map((l) => ({
      bomVersionId: verzija.id,
      lineOrder: l.lineOrder,
      quoteLineKey: l.quoteLineKey,
      internalSku: l.internalSku,
      supplierSku: l.supplierSku,
      inventoryId: l.inventoryId,
      category: l.category,
      descriptionSnapshot: l.descriptionSnapshot,
      quantity: l.quantity,
      unit: l.unit,
      wasteFactor: l.wasteFactor,
      grossQuantity: l.grossQuantity,
      unitCost: l.unitCost,
      totalCost: l.totalCost,
      supplierId: l.supplierId,
      geometrySource: l.geometrySource,
      calculationRuleVersion: l.calculationRuleVersion,
      status: l.status,
    })),
  })

  // Interni invariant (stražar razvoju): supersede sledi matriki prehodov —
  // če bi bilo kdaj treba supersedati APPROVED, je to IZRECNA sprememba
  // statusnega stroja (ta vrstica se glasnjavo zlomi, ne tiho spremeni).
  if (zamenjane.count > 0) {
    // DRAFT → SUPERSEDED je edini dovoljeni supersede prehod (EN VIR).
    if (!checkBomVersionTransition('DRAFT', 'SUPERSEDED').ok) {
      throw new BomStoreError('Statusni stroj BOM ne dovoljuje supersede DRAFT verzij — stanje je pokvarjeno.', 409)
    }
  }

  return {
    bomId: bom.id,
    versionId: verzija.id,
    versionNumber,
    status: vhod.status,
    lineCount: vhod.computed.lines.length,
  }
}
