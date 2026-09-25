-- R147 (issue #5 §28 — Structured installation evidence).
-- Čisto dodajanje: 1 NOVA tabela InstallationEvidence. Ni podatkovnih
-- sprememb, ni sprememb obstoječih tabel. Kontrolni seznam živi V KODI
-- (lib/installation-evidence.ts, IEV_TEMPLATE + verzija) — ne v bazi.
--
-- GPS po policyju: gpsLat/gpsLng so shranjeni IZKLJUČNO z izrecnim
-- dovoljenjem (gpsConsentAt = čas soglasja). Brez soglasja = null —
-- aplikacijska plast zavrača GPS brez soglasja (fail-closed, ne tiho).
--
-- Poraba materiala se NE shranjuje — IZVEDENA je s strežnika iz StockLedger
-- (deterministični agregat po artikel), nikoli iz klienta.
--
-- Dokaz predaje (handoverName + handoverAt) zaklene dokazilo — aplikacijska
-- plast zavrača nadaljnje spremembe zaklenjenega dokazila (409).

-- CreateTable
CREATE TABLE "InstallationEvidence" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "templateVersion" TEXT NOT NULL,
    "lokacija" TEXT NOT NULL,
    "beforePhotoId" TEXT,
    "afterPhotoId" TEXT,
    "gpsLat" DOUBLE PRECISION,
    "gpsLng" DOUBLE PRECISION,
    "gpsConsentAt" TIMESTAMP(3),
    "checklistJson" TEXT NOT NULL,
    "measurementId" TEXT,
    "defectsJson" TEXT NOT NULL,
    "handoverName" TEXT,
    "handoverAt" TIMESTAMP(3),
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallationEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstallationEvidence_projectId_createdAt_idx" ON "InstallationEvidence"("projectId", "createdAt");
CREATE INDEX "InstallationEvidence_scheduleId_idx" ON "InstallationEvidence"("scheduleId");

-- AddForeignKey
ALTER TABLE "InstallationEvidence" ADD CONSTRAINT "InstallationEvidence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstallationEvidence" ADD CONSTRAINT "InstallationEvidence_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "InstallationSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstallationEvidence" ADD CONSTRAINT "InstallationEvidence_beforePhotoId_fkey" FOREIGN KEY ("beforePhotoId") REFERENCES "ProjectPhoto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstallationEvidence" ADD CONSTRAINT "InstallationEvidence_afterPhotoId_fkey" FOREIGN KEY ("afterPhotoId") REFERENCES "ProjectPhoto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstallationEvidence" ADD CONSTRAINT "InstallationEvidence_measurementId_fkey" FOREIGN KEY ("measurementId") REFERENCES "Measurement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstallationEvidence" ADD CONSTRAINT "InstallationEvidence_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
