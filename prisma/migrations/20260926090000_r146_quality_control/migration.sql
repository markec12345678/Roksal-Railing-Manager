-- R146 (issue #5 §27 — Quality control gate).
-- Čisto dodajanje: 1 NOVA tabela QualityControl. Ni podatkovnih sprememb,
-- ni sprememb obstoječih tabel. Kontrolni seznam živi V KODI (lib/qc-gate.ts,
-- QC_TEMPLATE + verzija) — ne v bazi; sprememba seznama = nova verzija
-- predloge, stare vrstice ostanejo berljive z templateVersion.
--
-- Fail-closed vrata so aplikacijska plast (PATCH /api/schedules): ZAKLJUCENO
-- brez prešle preverbe → 409, izrecen qcOverrideReason → reviziran QC_OVERRIDE.

-- CreateTable
CREATE TABLE "QualityControl" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "templateVersion" TEXT NOT NULL,
    "itemsJson" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "defectsCount" INTEGER NOT NULL,
    "note" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualityControl_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QualityControl_projectId_approvedAt_idx" ON "QualityControl"("projectId", "approvedAt");
CREATE INDEX "QualityControl_scheduleId_idx" ON "QualityControl"("scheduleId");

-- AddForeignKey
ALTER TABLE "QualityControl" ADD CONSTRAINT "QualityControl_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QualityControl" ADD CONSTRAINT "QualityControl_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "InstallationSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QualityControl" ADD CONSTRAINT "QualityControl_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
