-- R144 (issue #5 §24 — Inventory lot/batch traceability).
-- Čista dodajanja: 2 NOVI tabeli (InventoryLot, LotAllocation) + 1 nullable
-- stolpec na StockLedger. Ni podatkovnih sprememb na obstoječih vrsticah,
-- RAZEN namernega backfilla: artikli z zalogo > 0 dobijo ENO "LEGACY" šaržo
-- (iskreno "neznano poreklo" — brez izmišljanja dobavitelja/cene).
-- FIFO pravilo (src/lib/lots.ts) postavi LEGACY šaržo PRVO (deliveryDate =
-- artikel.createdAt je najstarejši), kar hkrati ustreza skladiščni praksi:
-- najstarejša zaloga gre ven prva.

-- AlterTable
ALTER TABLE "StockLedger" ADD COLUMN "lotId" TEXT;

-- CreateTable
CREATE TABLE "InventoryLot" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "supplierId" TEXT,
    "orderId" TEXT,
    "orderItemId" TEXT,
    "deliveryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purchasePrice" DOUBLE PRECISION,
    "quantityInitial" DOUBLE PRECISION NOT NULL,
    "quantityRemaining" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotAllocation" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "ledgerId" TEXT,
    "eventType" TEXT NOT NULL,
    "kolicina" DOUBLE PRECISION NOT NULL,
    "projectId" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LotAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryLot_inventoryId_status_idx" ON "InventoryLot"("inventoryId", "status");

-- CreateIndex
CREATE INDEX "InventoryLot_supplierId_idx" ON "InventoryLot"("supplierId");

-- CreateIndex
CREATE INDEX "InventoryLot_orderId_idx" ON "InventoryLot"("orderId");

-- CreateIndex
CREATE INDEX "InventoryLot_deliveryDate_idx" ON "InventoryLot"("deliveryDate");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLot_inventoryId_lotNumber_key" ON "InventoryLot"("inventoryId", "lotNumber");

-- CreateIndex
CREATE INDEX "LotAllocation_lotId_createdAt_idx" ON "LotAllocation"("lotId", "createdAt");

-- CreateIndex
CREATE INDEX "LotAllocation_projectId_idx" ON "LotAllocation"("projectId");

-- CreateIndex
CREATE INDEX "LotAllocation_ledgerId_idx" ON "LotAllocation"("ledgerId");

-- CreateIndex
CREATE INDEX "StockLedger_lotId_idx" ON "StockLedger"("lotId");

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "InventoryLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MaterialOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "MaterialOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotAllocation" ADD CONSTRAINT "LotAllocation_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "InventoryLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotAllocation" ADD CONSTRAINT "LotAllocation_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "StockLedger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotAllocation" ADD CONSTRAINT "LotAllocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill (§24): artikli z zalogo > 0 brez šarže dobijo ENO LEGACY šaržo.
-- lotNumber vsebuje artikel.id (unikatno per artikel po unique (inventoryId,
-- lotNumber)), količini = trenutna zaloga, dobava = artikel.createdAt
-- (deterministično — brez naključja), supplier/cena NULL (neznano poreklo,
-- iskreno dokumentirano — brez izmišljanja podatkov).
INSERT INTO "InventoryLot" (
    "id", "inventoryId", "lotNumber", "deliveryDate",
    "quantityInitial", "quantityRemaining", "status", "note",
    "createdAt", "updatedAt"
)
SELECT
    'lotlegacy-' || "Inventory"."id",
    "Inventory"."id",
    'LOT-LEGACY-' || "Inventory"."id",
    "Inventory"."createdAt",
    "Inventory"."kolicinaZaloga",
    "Inventory"."kolicinaZaloga",
    'ACTIVE',
    'Zaloga pred uvedbo šarž (§24 backfill) — poreklo neznano',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Inventory"
WHERE "Inventory"."kolicinaZaloga" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "InventoryLot" WHERE "InventoryLot"."inventoryId" = "Inventory"."id"
  );
