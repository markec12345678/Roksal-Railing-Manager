-- R376 (issue #13, korak R166 iz §5/§6/§11 + §7 BOM vezava) — KANONIČNI
-- BOM: BOM + BOMVersion + BOMLine + SignatureAudit.bomVersionId.
--
-- Problem, ki ga ta migracija zapira (issue #13 §5/§6):
--   • BOM je bil do R374 SAMO JSON polje na projektu (Project.bomDraftJson)
--     — brez verzij, brez actor/čas, brez sledljivosti na izvor; R374 ga je
--     sicer izračunal iz STRUKTURIRANIH postavk verzije ponudbe (konec
--     hevristike includes('wpc')/Math.ceil(EUR/50)), a je ostal JSON;
--   • sprevrnjene ponudbe BOM niso imele EXACT vezave na inventar/SKU —
--     nabava ni mogla načrtovati količin iz kanonske entitete;
--   • procurement pogled (§11) ni imel kanonske osnove (planned/reserved/
--     ordered/received/issued/consumed/returned/wasted/variance).
--
-- Rešitev (isti vzorec kot QuoteVersion R374 / DocumentVersion R121 —
-- immutable verzije nad nosilcem):
--   BOM                       = nosilec (EN na projekt, projectId UNIQUE);
--   BOMVersion                = NESPREMENLJIVA verzija z sledjo izvora
--                               (sourceQuoteVersionId, priceBookVersionId,
--                               productSdkVersion, layoutFingerprint);
--   BOMLine                   = materialna vrstica z EXACT inventarno vezavo
--                               (inventoryId prek sifraMateriala === internalSku)
--                               in HONEST NULL stroski (§8);
--   SignatureAudit.bomVersionId = veriga podpis → kanonična BOM verzija (§7).
--
-- CHECK omejitve (vzorec R374/R136/R145 — takoj VELJAVNE; vse nove tabele so
-- PRAZNE, backfill/seed NI potreben — prazno je iskreno, izmišljevanje
-- zgodovine za zaklenjene projekte prepoveduje §8):
--   • status BOM IN ('AKTIVEN','ZAPRT') — nosilec, življenjski cikel nosijo
--     verzije (ZAPRT rezerviran za zaključek, v R376 še brez prehoda);
--   • status BOMVersion IN ('DRAFT','APPROVED','SUPERSEDED') — matrika
--     prehodov v src/lib/bom-versions.ts (EN VIR);
--   • category BOMLine IN ('GLASS','PROFILES','POSTS','INFILL','FIXINGS',
--     'LABOUR','OTHER') — BomGroup enum iz src/lib/quote.ts (EN VIR);
--   • quantity BOMLine > 0 — količina 0/negativna je napaka podatka, ne
--     poslovno stanje (postavka iz buildQuote je vedno pozitivna);
--   • unitCost/totalCost >= 0 (denar) + wasteFactor >= 0 + grossQuantity > 0
--     (samo kadar so prisotni — NULL ostaja iskreno NEZNANO, §8);
--   • status BOMLine IN ('AKTIVEN','PREKINJAN') — PREKINJAN rezerviran za
--     change-order (v R376 še brez prehoda, iskreno dokumentirano).
--
-- Skalarne reference brez FK (createdById/approvedById): ista zasnova kot R374
-- (mehe revizijske reference na Profile — tujkov ne moremo vpisati prek
-- API-ja, rute berejo id iz seje). SignatureAudit.bomVersionId je prav tako
-- mehka referenca (isti vzorec kot quoteVersionId v R374).
-- FK sourceQuoteVersionId → ON DELETE CASCADE: brisanje projekta kaskadno
-- počisti Quote→QuoteVersion in BOM→BOMVersion V ISTI izjavi — RESTRICT bi
-- oviral brisanje projekta (vrstni red kaskad v PG ni zagotovljen).
-- FK priceBookVersionId → ON DELETE RESTRICT: verzije cenika se NE brišejo
-- (RETIRED je terminalen — isti vzorec kot QuoteVersion.priceBookVersionId).
-- FK inventoryId/supplierId → ON DELETE SET NULL: brisanje artikla/dobavitelja
-- (danes brez API poti) odvezje vezavo, vrstica z SKU/opisom OSTANE
-- (nespremenljiva zgodovina se ne briše).

-- CreateTable: nosilec BOM projekta (§6)
CREATE TABLE "BOM" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AKTIVEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BOM_pkey" PRIMARY KEY ("id")
);

-- CreateTable: NESPREMENLJIVE verzije BOM (§6)
CREATE TABLE "BOMVersion" (
    "id" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "sourceQuoteVersionId" TEXT NOT NULL,
    "priceBookVersionId" TEXT NOT NULL,
    "productSdkVersion" TEXT NOT NULL,
    "layoutFingerprint" TEXT NOT NULL,
    "createdById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "BOMVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable: materialne vrstice BOM verzije (§5)
CREATE TABLE "BOMLine" (
    "id" TEXT NOT NULL,
    "bomVersionId" TEXT NOT NULL,
    "lineOrder" INTEGER NOT NULL,
    "quoteLineKey" TEXT,
    "internalSku" TEXT NOT NULL,
    "supplierSku" TEXT,
    "inventoryId" TEXT,
    "category" TEXT NOT NULL,
    "descriptionSnapshot" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "wasteFactor" DECIMAL(6,4),
    "grossQuantity" DECIMAL(12,3),
    "unitCost" DECIMAL(12,2),
    "totalCost" DECIMAL(12,2),
    "supplierId" TEXT,
    "geometrySource" TEXT,
    "calculationRuleVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "BOMLine_pkey" PRIMARY KEY ("id")
);

-- AlterTable: veriga podpis → kanonična BOM verzija (§7; nullable — zapisi
-- pred R376 [tudi R374 zaklepi] ostanejo nespremenjeni: brez verzije, brez
-- izmišljanja zgodovine).
ALTER TABLE "SignatureAudit" ADD COLUMN "bomVersionId" TEXT;

-- CreateIndex (TOČNO zrcalijo @@index/@@unique iz prisma/schema.prisma)
CREATE UNIQUE INDEX "BOM_projectId_key" ON "BOM"("projectId");
CREATE INDEX "BOM_status_idx" ON "BOM"("status");

CREATE UNIQUE INDEX "BOMVersion_bomId_versionNumber_key" ON "BOMVersion"("bomId", "versionNumber");
CREATE INDEX "BOMVersion_bomId_idx" ON "BOMVersion"("bomId");
CREATE INDEX "BOMVersion_sourceQuoteVersionId_idx" ON "BOMVersion"("sourceQuoteVersionId");
CREATE INDEX "BOMVersion_priceBookVersionId_idx" ON "BOMVersion"("priceBookVersionId");
CREATE INDEX "BOMVersion_status_idx" ON "BOMVersion"("status");
CREATE INDEX "BOMVersion_createdAt_idx" ON "BOMVersion"("createdAt");

CREATE INDEX "BOMLine_bomVersionId_idx" ON "BOMLine"("bomVersionId");
CREATE INDEX "BOMLine_inventoryId_idx" ON "BOMLine"("inventoryId");
CREATE INDEX "BOMLine_supplierId_idx" ON "BOMLine"("supplierId");
CREATE INDEX "BOMLine_internalSku_idx" ON "BOMLine"("internalSku");

CREATE INDEX "SignatureAudit_bomVersionId_idx" ON "SignatureAudit"("bomVersionId");

-- AddForeignKey
ALTER TABLE "BOM" ADD CONSTRAINT "BOM_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BOMVersion" ADD CONSTRAINT "BOMVersion_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "BOM"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BOMVersion" ADD CONSTRAINT "BOMVersion_sourceQuoteVersionId_fkey" FOREIGN KEY ("sourceQuoteVersionId") REFERENCES "QuoteVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BOMVersion" ADD CONSTRAINT "BOMVersion_priceBookVersionId_fkey" FOREIGN KEY ("priceBookVersionId") REFERENCES "PriceBookVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BOMLine" ADD CONSTRAINT "BOMLine_bomVersionId_fkey" FOREIGN KEY ("bomVersionId") REFERENCES "BOMVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BOMLine" ADD CONSTRAINT "BOMLine_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BOMLine" ADD CONSTRAINT "BOMLine_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateConstraint: CHECK omejitve (statusni stroji + pozitivne količine +
-- nenegativni denar; takoj VALIDIRANE — vse nove tabele so prazne)
ALTER TABLE "BOM" ADD CONSTRAINT "bom_status_allowed"
  CHECK ("status" IN ('AKTIVEN', 'ZAPRT'));
ALTER TABLE "BOMVersion" ADD CONSTRAINT "bom_version_status_allowed"
  CHECK ("status" IN ('DRAFT', 'APPROVED', 'SUPERSEDED'));
ALTER TABLE "BOMLine" ADD CONSTRAINT "bom_line_category_allowed"
  CHECK ("category" IN ('GLASS', 'PROFILES', 'POSTS', 'INFILL', 'FIXINGS', 'LABOUR', 'OTHER'));
ALTER TABLE "BOMLine" ADD CONSTRAINT "bom_line_quantity_positive"
  CHECK ("quantity" > 0);
ALTER TABLE "BOMLine" ADD CONSTRAINT "bom_line_costs_nonneg"
  CHECK (("unitCost" IS NULL OR "unitCost" >= 0) AND ("totalCost" IS NULL OR "totalCost" >= 0));
ALTER TABLE "BOMLine" ADD CONSTRAINT "bom_line_waste_nonneg"
  CHECK ("wasteFactor" IS NULL OR "wasteFactor" >= 0);
ALTER TABLE "BOMLine" ADD CONSTRAINT "bom_line_gross_positive"
  CHECK ("grossQuantity" IS NULL OR "grossQuantity" > 0);
ALTER TABLE "BOMLine" ADD CONSTRAINT "bom_line_status_allowed"
  CHECK ("status" IN ('AKTIVEN', 'PREKINJAN'));
