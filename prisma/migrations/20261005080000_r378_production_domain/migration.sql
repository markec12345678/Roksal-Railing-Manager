-- R378 (issue #13, korak R167 iz §9 + §10) — PRODUKCIJA + AS-INSTALLED:
-- ProductionOrder/ProductionOrderLine/ProductionOperation (§10) +
-- InstallationRecord/InstallationRecordLine (§9).
--
-- Problem, ki ga ta migracija zapira (issue #13 §9/§10):
--   • do R376 je bila veriga resnice QUOTE → BOM zaključena na ODOBRENEM
--     BOM — NAD njim ni bilo kanoničnega proizvodnega objekta (Roksal je
--     moral izvajanje voditi prek razporedov/QC/dokazil BREZ proizvodnega
--     naročila z vrsticami);
--   • AS-INSTALLED ("tretja resnica", §9) ni obstajal — dejansko vgrajene
--     količine so živele raztresene po InstallationEvidence/StockLedger brez
--     verzioniranega zapisa, proti kateremu bi se računala varianca;
--   • količinska veriga QUOTE → BOM → PRODUCTION → INSTALLATION (§9) ni bila
--     dokazljiva PO VRSTICI.
--
-- Rešitev (isti vzorec kot BOMVersion R376 — nad ODOBRENIM BOM):
--   ProductionOrder      = proizvodni nalog nad ODOBRENO BOMVersion (RESTRICT);
--   ProductionOrderLine  = SNAPSHOT vrstic BOMLine (plannedQty = quantity ob
--                          ustvarjanju; remainingQty STREŽNIŠKO izračunano);
--   ProductionOperation  = operacija (rezanje/bušenje/… — PROST niz ≤ 100,
--                          izumljeni enum bi bil izum §8; trajanja v minutah);
--   InstallationRecord   = verzionirana TRETJA RESNICA (DRAFT → POTRJENO,
--                          terminalno; revizija = NOVA verzija — isti kanon
--                          kot QuoteVersion R374 / BOMVersion R376);
--   InstallationRecordLine = dejansko vgrajene vrstice (bomLineId NULL =
--                          vgrajen material IZVEN BOM — iskreno, §8).
--
-- CHECK omejitve (vzorec R374/R376 — takoj VELJAVNE; vse nove tabele so
-- PRAZNE, backfill/seed NI potreben — prazno je iskreno, izmišljevanje
-- zgodovine za zaklenjene projekte prepoveduje §8):
--   • status ProductionOrder IN (10 stanj §10: PLANNED/RELEASED/IN_PRODUCTION/
--     QC/PRODUCED/READY_FOR_INSTALLATION + izidi REWORK/REJECTED/SCRAPPED/
--     REPLACED) — matrika prehodov v src/lib/production-orders.ts (EN VIR);
--   • priority ProductionOrder IN ('NIZKA','NORMALNA','URGENTNO') — v repu NI
--     obstoječega prioritetnega nabora (pregledano), zato trije iskreni
--     nivoji brez izumljenih vmesnih stopenj;
--   • plannedQty > 0 (vrstica z 0 ni proizvodnja) + produced/rejected/scrapped/
--     remaining ≥ 0 (količine so dejstva, ne morejo biti negativne);
--   • status ProductionOperation IN ('PLANNED','IN_PROGRESS','DONE','FAILED')
--     + sequence > 0 + trajanja NULL ali ≥ 0 (NULL = NEZNANO, §8);
--   • status InstallationRecord IN ('DRAFT','POTRJENO') + versionNumber > 0
--     (verzioniranost);
--   • installedQty > 0 (0 bi bila laž "vgrajeno nič") + wasteQty NULL ali ≥ 0.
--
-- Skalarne reference brez FK (createdById/approvedById na obeh nosilcih):
-- ista zasnova kot R374/R376 (mehe revizijske reference na Profile — tujkov
-- ne moremo vpisati prek API-ja, rute berejo id iz seje).
-- FK bomVersionId (ProductionOrder + InstallationRecord) → ON DELETE RESTRICT:
-- odobren BOM je vir resnice (§10) — naročilo/zapis NE smeta tiho preživeti
-- svoje verzije. FK bomLineId (obe vrstici) → RESTRICT iz istega razloga
-- (vrstica ne laže o svojem izvoru). Brisanje projekta kaskadno počisti VSE
-- (Project → ProductionOrder/InstallationRecord → vrstice V ISTI izjavi) —
-- RESTRICT na verzijah/vrsticah BOM pri tem NE ovira, saj vrstni red kaskad
-- nosijo vrstice naročil/zapisov, ki umirajo Z njimi (isti precedens kot
-- InstallationSchedule_projectId_fkey RESTRICT iz init migracije).
-- FK productionOrderId na InstallationRecord → ON DELETE SET NULL (NE
-- CASCADE): as-installed zapis je TRAJNEJŠI od proizvodnega naročila —
-- montaža se je FIZIČNO zgodila; brisanje naročila (danes brez API poti)
-- odveže povezavo, resnica pa OSTANE. FK scheduleId/crewId/monterId/qcId/
-- evidenceId → SET NULL (isti kanon kot QualityControl/InstallationEvidence).

-- CreateTable: proizvodni nalog nad ODOBRENIM BOM (§10)
CREATE TABLE "ProductionOrder" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "bomVersionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "priority" TEXT NOT NULL DEFAULT 'NORMALNA',
    "dueAt" TIMESTAMP(3),
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable: proizvodne vrstice = SNAPSHOT vrstic BOM (§10)
CREATE TABLE "ProductionOrderLine" (
    "id" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "bomLineId" TEXT NOT NULL,
    "lineOrder" INTEGER NOT NULL,
    "internalSku" TEXT NOT NULL,
    "plannedQty" DECIMAL(12,3) NOT NULL,
    "producedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "rejectedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "scrappedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "remainingQty" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,

    CONSTRAINT "ProductionOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable: proizvodne operacije (§10)
CREATE TABLE "ProductionOperation" (
    "id" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "plannedDurationMin" INTEGER,
    "actualDurationMin" INTEGER,
    "operatorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "result" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AS-INSTALLED — verzionirana tretja resnica (§9)
CREATE TABLE "InstallationRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "productionOrderId" TEXT,
    "crewId" TEXT,
    "monterId" TEXT,
    "bomVersionId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "defectsJson" TEXT NOT NULL DEFAULT '[]',
    "reworkNote" TEXT,
    "qcId" TEXT,
    "evidenceId" TEXT,
    "handoverName" TEXT,
    "handoverAt" TIMESTAMP(3),
    "actualMeasurementsJson" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "InstallationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable: dejansko vgrajene vrstice (§9)
CREATE TABLE "InstallationRecordLine" (
    "id" TEXT NOT NULL,
    "installationRecordId" TEXT NOT NULL,
    "bomLineId" TEXT,
    "internalSku" TEXT NOT NULL,
    "installedQty" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "wasteQty" DECIMAL(12,3),
    "note" TEXT,

    CONSTRAINT "InstallationRecordLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (TOČNO zrcalijo @@index/@@unique iz prisma/schema.prisma)
CREATE INDEX "ProductionOrder_projectId_idx" ON "ProductionOrder"("projectId");
CREATE INDEX "ProductionOrder_bomVersionId_idx" ON "ProductionOrder"("bomVersionId");
CREATE INDEX "ProductionOrder_status_idx" ON "ProductionOrder"("status");
CREATE INDEX "ProductionOrder_createdAt_idx" ON "ProductionOrder"("createdAt");

CREATE UNIQUE INDEX "ProductionOrderLine_productionOrderId_bomLineId_key" ON "ProductionOrderLine"("productionOrderId", "bomLineId");
CREATE INDEX "ProductionOrderLine_bomLineId_idx" ON "ProductionOrderLine"("bomLineId");

CREATE INDEX "ProductionOperation_productionOrderId_idx" ON "ProductionOperation"("productionOrderId");
CREATE INDEX "ProductionOperation_operatorId_idx" ON "ProductionOperation"("operatorId");

CREATE UNIQUE INDEX "InstallationRecord_projectId_versionNumber_key" ON "InstallationRecord"("projectId", "versionNumber");
CREATE INDEX "InstallationRecord_projectId_idx" ON "InstallationRecord"("projectId");
CREATE INDEX "InstallationRecord_bomVersionId_idx" ON "InstallationRecord"("bomVersionId");
CREATE INDEX "InstallationRecord_scheduleId_idx" ON "InstallationRecord"("scheduleId");
CREATE INDEX "InstallationRecord_productionOrderId_idx" ON "InstallationRecord"("productionOrderId");
CREATE INDEX "InstallationRecord_status_idx" ON "InstallationRecord"("status");

CREATE INDEX "InstallationRecordLine_installationRecordId_idx" ON "InstallationRecordLine"("installationRecordId");
CREATE INDEX "InstallationRecordLine_bomLineId_idx" ON "InstallationRecordLine"("bomLineId");

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_bomVersionId_fkey" FOREIGN KEY ("bomVersionId") REFERENCES "BOMVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionOrderLine" ADD CONSTRAINT "ProductionOrderLine_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionOrderLine" ADD CONSTRAINT "ProductionOrderLine_bomLineId_fkey" FOREIGN KEY ("bomLineId") REFERENCES "BOMLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionOperation" ADD CONSTRAINT "ProductionOperation_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionOperation" ADD CONSTRAINT "ProductionOperation_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstallationRecord" ADD CONSTRAINT "InstallationRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstallationRecord" ADD CONSTRAINT "InstallationRecord_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "InstallationSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstallationRecord" ADD CONSTRAINT "InstallationRecord_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstallationRecord" ADD CONSTRAINT "InstallationRecord_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "Crew"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstallationRecord" ADD CONSTRAINT "InstallationRecord_monterId_fkey" FOREIGN KEY ("monterId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstallationRecord" ADD CONSTRAINT "InstallationRecord_bomVersionId_fkey" FOREIGN KEY ("bomVersionId") REFERENCES "BOMVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InstallationRecord" ADD CONSTRAINT "InstallationRecord_qcId_fkey" FOREIGN KEY ("qcId") REFERENCES "QualityControl"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstallationRecord" ADD CONSTRAINT "InstallationRecord_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "InstallationEvidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstallationRecordLine" ADD CONSTRAINT "InstallationRecordLine_installationRecordId_fkey" FOREIGN KEY ("installationRecordId") REFERENCES "InstallationRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstallationRecordLine" ADD CONSTRAINT "InstallationRecordLine_bomLineId_fkey" FOREIGN KEY ("bomLineId") REFERENCES "BOMLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateConstraint: CHECK omejitve (statusni stroji + količine; takoj
-- VALIDIRANE — vse nove tabele so prazne)
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "production_order_status_allowed"
  CHECK ("status" IN ('PLANNED', 'RELEASED', 'IN_PRODUCTION', 'QC', 'PRODUCED', 'READY_FOR_INSTALLATION', 'REWORK', 'REJECTED', 'SCRAPPED', 'REPLACED'));
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "production_order_priority_allowed"
  CHECK ("priority" IN ('NIZKA', 'NORMALNA', 'URGENTNO'));
ALTER TABLE "ProductionOrderLine" ADD CONSTRAINT "production_order_line_planned_positive"
  CHECK ("plannedQty" > 0);
ALTER TABLE "ProductionOrderLine" ADD CONSTRAINT "production_order_line_qty_nonneg"
  CHECK ("producedQty" >= 0 AND "rejectedQty" >= 0 AND "scrappedQty" >= 0 AND "remainingQty" >= 0);
ALTER TABLE "ProductionOperation" ADD CONSTRAINT "production_operation_status_allowed"
  CHECK ("status" IN ('PLANNED', 'IN_PROGRESS', 'DONE', 'FAILED'));
ALTER TABLE "ProductionOperation" ADD CONSTRAINT "production_operation_sequence_positive"
  CHECK ("sequence" > 0);
ALTER TABLE "ProductionOperation" ADD CONSTRAINT "production_operation_duration_nonneg"
  CHECK (("plannedDurationMin" IS NULL OR "plannedDurationMin" >= 0) AND ("actualDurationMin" IS NULL OR "actualDurationMin" >= 0));
ALTER TABLE "InstallationRecord" ADD CONSTRAINT "installation_record_status_allowed"
  CHECK ("status" IN ('DRAFT', 'POTRJENO'));
ALTER TABLE "InstallationRecord" ADD CONSTRAINT "installation_record_version_positive"
  CHECK ("versionNumber" > 0);
ALTER TABLE "InstallationRecordLine" ADD CONSTRAINT "installation_record_line_qty_positive"
  CHECK ("installedQty" > 0);
ALTER TABLE "InstallationRecordLine" ADD CONSTRAINT "installation_record_line_waste_nonneg"
  CHECK ("wasteQty" IS NULL OR "wasteQty" >= 0);
