-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'VODJA', 'MONTER', 'SKLADISCE');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('NACRTOVANO', 'V_TEKU', 'ZAKLJUCENO', 'USTAVLJENO', 'ZA_MONTAZO', 'V_IZDELAVI', 'MONTIRANO');

-- CreateEnum
CREATE TYPE "StockLedgerEventType" AS ENUM ('OPENING', 'PURCHASE', 'RECEIPT', 'RETURN', 'RESERVATION', 'RELEASE', 'ISSUE', 'WASTE', 'DAMAGE', 'ADJUSTMENT', 'PROJECT_ALLOCATION');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('TEHNICNI_LIST', 'PRIMOPREDAJA', 'E_RACUN', 'ZAPISNIK_NAVORA');

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "ime" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "vloga" "UserRole" NOT NULL DEFAULT 'MONTER',
    "passwordHash" TEXT,
    "telefon" TEXT,
    "ekipaId" TEXT,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "ime" TEXT NOT NULL,
    "naslov" TEXT NOT NULL,
    "telefon" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'AKTIVEN',
    "kontaktnaOseba" TEXT,
    "opomnikDatum" TIMESTAMP(3),
    "opomnikOpis" TEXT,
    "zadnjiKontakt" TIMESTAMP(3),
    "opombeCRM" TEXT,
    "kategorija" TEXT,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "nazivProjekta" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'NACRTOVANO',
    "monterId" TEXT,
    "vodjaId" TEXT,
    "ekipaId" TEXT,
    "datumMontaze" TIMESTAMP(3),
    "opombe" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mobileProjectId" TEXT,
    "originalImagePath" TEXT,
    "geminiEstimate" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "projectData" TEXT,
    "clientToken" TEXT NOT NULL,
    "clientPortalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "clientNotes" TEXT,
    "estimatedPrice" DOUBLE PRECISION,
    "dealLocked" BOOLEAN NOT NULL DEFAULT false,
    "dealLockedAt" TIMESTAMP(3),
    "dealSignedBy" TEXT,
    "dealSignedByMonter" TEXT,
    "dealSignatureIp" TEXT,
    "dealSignatureDevice" TEXT,
    "bomDraftJson" TEXT,
    "marginLocked" DOUBLE PRECISION,
    "followUpDate" TIMESTAMP(3),
    "followUpOpomba" TEXT,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Measurement" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "dolzinaMm" INTEGER NOT NULL,
    "visinaMm" INTEGER NOT NULL,
    "lidarScanUrl" TEXT,
    "arMetadata" TEXT,
    "gpsLokacija" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "Measurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "sifraMateriala" TEXT NOT NULL,
    "naziv" TEXT NOT NULL,
    "tip" TEXT NOT NULL,
    "kolicinaZaloga" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "enota" TEXT NOT NULL,
    "minimalnaZaloga" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialUsage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "porabljenaKolicina" DOUBLE PRECISION NOT NULL,
    "datumVpisa" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "projectId" TEXT,
    "orderId" TEXT,
    "kolicina" DOUBLE PRECISION NOT NULL,
    "tipPremika" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLedger" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "eventType" "StockLedgerEventType" NOT NULL,
    "kolicina" DOUBLE PRECISION NOT NULL,
    "enota" TEXT NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "orderId" TEXT,
    "orderItemId" TEXT,
    "projectId" TEXT,
    "actorId" TEXT,
    "reason" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NumberSequence" (
    "id" TEXT NOT NULL,
    "seqKey" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NumberSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "signatureUrl" TEXT,
    "tipDokumenta" "DocumentType" NOT NULL DEFAULT 'TEHNICNI_LIST',
    "status" TEXT NOT NULL DEFAULT 'GENERIRANO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "projectId" TEXT,
    "akcija" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "naslov" TEXT NOT NULL,
    "sporocilo" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profil" (
    "id" TEXT NOT NULL,
    "sifra" TEXT NOT NULL,
    "naziv" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "kategorija" TEXT NOT NULL,
    "visinaMm" INTEGER NOT NULL DEFAULT 1100,
    "sirinaMm" INTEGER NOT NULL DEFAULT 140,
    "cenaM" DOUBLE PRECISION NOT NULL,
    "barvaRal" TEXT,
    "slikaUrl" TEXT,
    "aktivna" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "profilId" TEXT,
    "imageUrl" TEXT NOT NULL,
    "tocke" TEXT NOT NULL,
    "meritve" TEXT,
    "kalibracija" TEXT,
    "opombe" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sketch" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "naziv" TEXT NOT NULL,
    "pngData" TEXT NOT NULL,
    "povzetek" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sketch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "profilId" TEXT,
    "naslov" TEXT NOT NULL,
    "opis" TEXT,
    "lokacija" TEXT,
    "slikaPred" TEXT,
    "slikaPo" TEXT,
    "javno" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GalleryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Slope" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kotStopinje" DOUBLE PRECISION NOT NULL,
    "smer" TEXT,
    "lokacija" TEXT,
    "veljaven" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Slope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPhoto" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kategorija" TEXT NOT NULL,
    "imageData" TEXT NOT NULL,
    "opomba" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureAudit" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "signatureType" TEXT NOT NULL,
    "signedByName" TEXT NOT NULL,
    "signedByRole" TEXT,
    "signatureImage" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceFingerprint" TEXT,
    "geoLatitude" DOUBLE PRECISION,
    "geoLongitude" DOUBLE PRECISION,
    "pdfUrl" TEXT,
    "pdfHash" TEXT,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignatureAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "naziv" TEXT NOT NULL,
    "kontakt" TEXT,
    "email" TEXT,
    "telefon" TEXT,
    "naslov" TEXT,
    "iban" TEXT,
    "dobavniRok" INTEGER NOT NULL DEFAULT 7,
    "popust" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aktivna" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialPrice" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "cena" DOUBLE PRECISION NOT NULL,
    "veljavnostOd" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "veljavnostDo" TIMESTAMP(3),
    "opomba" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialOrder" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "supplierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OSNUTEK',
    "skupajCena" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "datumNarocila" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "datumDobave" TIMESTAMP(3),
    "opombe" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "kolicina" DOUBLE PRECISION NOT NULL,
    "cena" DOUBLE PRECISION NOT NULL,
    "naziv" TEXT NOT NULL,
    "enota" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Crew" (
    "id" TEXT NOT NULL,
    "naziv" TEXT NOT NULL,
    "vodjaId" TEXT,
    "aktivna" BOOLEAN NOT NULL DEFAULT true,
    "barva" TEXT NOT NULL DEFAULT '#1d2b3e',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Crew_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "naziv" TEXT NOT NULL,
    "tip" TEXT NOT NULL,
    "sifra" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NA_VOLJO',
    "lokacija" TEXT,
    "zadnjiServis" TIMESTAMP(3),
    "opomba" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstallationSchedule" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "crewId" TEXT,
    "monterId" TEXT,
    "datumZacetka" TIMESTAMP(3) NOT NULL,
    "datumKonca" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NAVRTENO',
    "predvideneUre" INTEGER NOT NULL DEFAULT 8,
    "dejanskeUre" INTEGER,
    "opombe" TEXT,
    "lokacija" TEXT,
    "gpsLat" DOUBLE PRECISION,
    "gpsLon" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallationSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentAssignment" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "datumOd" TIMESTAMP(3) NOT NULL,
    "datumDo" TIMESTAMP(3) NOT NULL,
    "opomba" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PunchItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "naslov" TEXT NOT NULL,
    "opomba" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PunchItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "tip" TEXT NOT NULL DEFAULT 'RACUN',
    "stevilka" TEXT NOT NULL,
    "datumIzdaje" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "datumStoritve" TIMESTAMP(3),
    "rokPlacilaDni" INTEGER NOT NULL DEFAULT 8,
    "status" TEXT NOT NULL DEFAULT 'OSNUTEK',
    "placanoAt" TIMESTAMP(3),
    "postavke" TEXT NOT NULL,
    "kupec" TEXT,
    "osnova" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ddv" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "znesek" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "opombe" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSurvey" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "tipObjekta" TEXT NOT NULL DEFAULT 'balkon',
    "oblika" TEXT NOT NULL DEFAULT 'ravno',
    "pritrditev" TEXT NOT NULL DEFAULT 'obrobna',
    "podlaga" TEXT NOT NULL DEFAULT 'neznan',
    "razponNajdaljsiMm" INTEGER,
    "skupnaDolzinaMm" INTEGER,
    "visinaMm" INTEGER,
    "steviloStopnic" INTEGER,
    "razhodMm" INTEGER,
    "ovire" TEXT,
    "dvigalo" BOOLEAN NOT NULL DEFAULT false,
    "dostopOpomba" TEXT,
    "fotoPosneto" TEXT,
    "ralCode" TEXT,
    "opombe" TEXT,
    "zakljuceno" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VizProject" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "originalPath" TEXT NOT NULL,
    "productPath" TEXT NOT NULL,
    "productMaskPath" TEXT,
    "maskPath" TEXT NOT NULL,
    "previewPath" TEXT,
    "resultPath" TEXT,
    "resultImagePath" TEXT,
    "placement" TEXT NOT NULL,
    "variants" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VizProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VizRenderJob" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "projectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "engine" TEXT NOT NULL DEFAULT 'qwen-image-edit-2509',
    "inputJson" TEXT NOT NULL,
    "resultPath" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VizRenderJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_email_key" ON "Profile"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Project_clientToken_key" ON "Project"("clientToken");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_sifraMateriala_key" ON "Inventory"("sifraMateriala");

-- CreateIndex
CREATE INDEX "InventoryMovement_orderId_idx" ON "InventoryMovement"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "StockLedger_idempotencyKey_key" ON "StockLedger"("idempotencyKey");

-- CreateIndex
CREATE INDEX "StockLedger_inventoryId_createdAt_idx" ON "StockLedger"("inventoryId", "createdAt");

-- CreateIndex
CREATE INDEX "StockLedger_eventType_idx" ON "StockLedger"("eventType");

-- CreateIndex
CREATE INDEX "StockLedger_orderId_idx" ON "StockLedger"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "NumberSequence_seqKey_key" ON "NumberSequence"("seqKey");

-- CreateIndex
CREATE UNIQUE INDEX "Profil_sifra_key" ON "Profil"("sifra");

-- CreateIndex
CREATE INDEX "SignatureAudit_projectId_idx" ON "SignatureAudit"("projectId");

-- CreateIndex
CREATE INDEX "SignatureAudit_createdAt_idx" ON "SignatureAudit"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_naziv_key" ON "Supplier"("naziv");

-- CreateIndex
CREATE INDEX "MaterialPrice_inventoryId_supplierId_idx" ON "MaterialPrice"("inventoryId", "supplierId");

-- CreateIndex
CREATE INDEX "MaterialPrice_veljavnostOd_idx" ON "MaterialPrice"("veljavnostOd");

-- CreateIndex
CREATE INDEX "MaterialOrderItem_orderId_idx" ON "MaterialOrderItem"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Crew_naziv_key" ON "Crew"("naziv");

-- CreateIndex
CREATE INDEX "Crew_aktivna_idx" ON "Crew"("aktivna");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_naziv_key" ON "Equipment"("naziv");

-- CreateIndex
CREATE INDEX "Equipment_status_idx" ON "Equipment"("status");

-- CreateIndex
CREATE INDEX "InstallationSchedule_datumZacetka_idx" ON "InstallationSchedule"("datumZacetka");

-- CreateIndex
CREATE INDEX "InstallationSchedule_crewId_idx" ON "InstallationSchedule"("crewId");

-- CreateIndex
CREATE INDEX "InstallationSchedule_status_idx" ON "InstallationSchedule"("status");

-- CreateIndex
CREATE INDEX "EquipmentAssignment_scheduleId_idx" ON "EquipmentAssignment"("scheduleId");

-- CreateIndex
CREATE INDEX "EquipmentAssignment_equipmentId_idx" ON "EquipmentAssignment"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_stevilka_key" ON "Invoice"("stevilka");

-- CreateIndex
CREATE INDEX "Invoice_projectId_idx" ON "Invoice"("projectId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SiteSurvey_projectId_key" ON "SiteSurvey"("projectId");

-- CreateIndex
CREATE INDEX "SiteSurvey_zakljuceno_idx" ON "SiteSurvey"("zakljuceno");

-- CreateIndex
CREATE INDEX "VizProject_ownerId_idx" ON "VizProject"("ownerId");

-- CreateIndex
CREATE INDEX "VizRenderJob_projectId_idx" ON "VizRenderJob"("projectId");

-- CreateIndex
CREATE INDEX "VizRenderJob_status_idx" ON "VizRenderJob"("status");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_ekipaId_fkey" FOREIGN KEY ("ekipaId") REFERENCES "Crew"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_monterId_fkey" FOREIGN KEY ("monterId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_vodjaId_fkey" FOREIGN KEY ("vodjaId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialUsage" ADD CONSTRAINT "MaterialUsage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialUsage" ADD CONSTRAINT "MaterialUsage_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArSnapshot" ADD CONSTRAINT "ArSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArSnapshot" ADD CONSTRAINT "ArSnapshot_profilId_fkey" FOREIGN KEY ("profilId") REFERENCES "Profil"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sketch" ADD CONSTRAINT "Sketch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryItem" ADD CONSTRAINT "GalleryItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryItem" ADD CONSTRAINT "GalleryItem_profilId_fkey" FOREIGN KEY ("profilId") REFERENCES "Profil"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slope" ADD CONSTRAINT "Slope_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPhoto" ADD CONSTRAINT "ProjectPhoto_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureAudit" ADD CONSTRAINT "SignatureAudit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialPrice" ADD CONSTRAINT "MaterialPrice_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialPrice" ADD CONSTRAINT "MaterialPrice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialOrder" ADD CONSTRAINT "MaterialOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialOrder" ADD CONSTRAINT "MaterialOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialOrderItem" ADD CONSTRAINT "MaterialOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MaterialOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialOrderItem" ADD CONSTRAINT "MaterialOrderItem_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Crew" ADD CONSTRAINT "Crew_vodjaId_fkey" FOREIGN KEY ("vodjaId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallationSchedule" ADD CONSTRAINT "InstallationSchedule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallationSchedule" ADD CONSTRAINT "InstallationSchedule_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "Crew"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallationSchedule" ADD CONSTRAINT "InstallationSchedule_monterId_fkey" FOREIGN KEY ("monterId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "InstallationSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PunchItem" ADD CONSTRAINT "PunchItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteSurvey" ADD CONSTRAINT "SiteSurvey_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VizRenderJob" ADD CONSTRAINT "VizRenderJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VizProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

