-- R145 (issue #5 §31 — Equipment lifecycle).
-- Čista dodajanja: 7 nullable/boolean stolpcev na Equipment + NOVA tabela
-- EquipmentEvent + CHECK omejitev statusa (§18 vzorec, NOT VALID).
-- Namerni deterministični backfill: tip='MERSKA_OPREMA' →
-- calibrationRequired=true (§31 "merilna oprema potrebuje calibration";
-- ne izmišljamo datumov/potrdil — ti ostanejo null = iskreno "ni zabeleženo").

-- AlterTable (Equipment — življenjski cikl)
ALTER TABLE "Equipment" ADD COLUMN "serijskaStevilka" TEXT;
ALTER TABLE "Equipment" ADD COLUMN "pridobitev" TIMESTAMP(3);
ALTER TABLE "Equipment" ADD COLUMN "lastInspectionAt" TIMESTAMP(3);
ALTER TABLE "Equipment" ADD COLUMN "inspectionIntervalDays" INTEGER;
ALTER TABLE "Equipment" ADD COLUMN "calibrationRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Equipment" ADD COLUMN "calibrationDueDate" TIMESTAMP(3);
ALTER TABLE "Equipment" ADD COLUMN "calibrationCertificate" TEXT;

-- Deterministični backfill (§31): merska oprema ZAHTEVA kalibracijo.
-- Datumov/potrdil NE izmišljujemo — ostanejo null (UI pokaže "manjka potrdilo").
UPDATE "Equipment" SET "calibrationRequired" = true WHERE "tip" = 'MERSKA_OPREMA';

-- §18 vzorec: CHECK za status vključuje NOVO vrednost UPOKOJENO (§31 "retired").
-- NOT VALID = velja za vse NOVE zapise takoj; legacy vrstice (vse v starih
-- statusih) ne morejo prekiniti deploya. Prisma nivo varuje tudi aplikacija
-- (EQUIPMENT_TRANSITIONS — src/lib/equipment-lifecycle.ts).
ALTER TABLE "Equipment" ADD CONSTRAINT "equipment_status_allowed"
  CHECK ("status" IN ('NA_VOLJO', 'V_UPORABI', 'V_SERVISU', 'IZGUBLJENO', 'UPOKOJENO')) NOT VALID;

-- CreateTable — zgodovina pregledov/kalibracij/servisov/popravil.
-- Revizijska sled življenjskega cikla: se NE čišči (kot AuditLog).
CREATE TABLE "EquipmentEvent" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "result" TEXT NOT NULL DEFAULT 'V_REDU',
    "certificate" TEXT,
    "opomba" TEXT,
    "performedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EquipmentEvent" ADD CONSTRAINT "EquipmentEvent_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EquipmentEvent" ADD CONSTRAINT "EquipmentEvent_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "EquipmentEvent_equipmentId_performedAt_idx" ON "EquipmentEvent"("equipmentId", "performedAt");
