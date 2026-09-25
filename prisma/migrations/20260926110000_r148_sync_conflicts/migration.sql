-- R148 (issue #5 §36 — Mobile sync conflict model).
-- Čisto dodajanje: 1 NOV stolpec Project.syncRevision (monotoni števec sync
-- zapisov — kurzor za delta sync + konflikti prek baseRevision; 0 = brez
-- sync zapisov, nič ne izmišljamo) + 2 NOVI tabeli SyncDevice (naprava
-- mobilnega klienta, deviceId generira klient) in SyncTombstone (grobnica —
-- preživi brisanje projekta, projectId SetNull, NI cascade).
--
-- Backfill: syncRevision privzeto 0 za vse obstoječe vrstice — iskren
-- začetek (nobenega izmišljenega štetja zgodovine).

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "syncRevision" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Project_syncRevision_idx" ON "Project"("syncRevision");

-- CreateTable
CREATE TABLE "SyncDevice" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "name" TEXT,
    "apiKeyId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncCursor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SyncDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SyncDevice_deviceId_key" ON "SyncDevice"("deviceId");

-- CreateTable
CREATE TABLE "SyncTombstone" (
    "id" TEXT NOT NULL,
    "mobileProjectId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "tombstonedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "projectId" TEXT,

    CONSTRAINT "SyncTombstone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SyncTombstone_mobileProjectId_key" ON "SyncTombstone"("mobileProjectId");
CREATE INDEX "SyncTombstone_tombstonedAt_idx" ON "SyncTombstone"("tombstonedAt");

-- AddForeignKey
ALTER TABLE "SyncDevice" ADD CONSTRAINT "SyncDevice_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SyncTombstone" ADD CONSTRAINT "SyncTombstone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SyncTombstone" ADD CONSTRAINT "SyncTombstone_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
