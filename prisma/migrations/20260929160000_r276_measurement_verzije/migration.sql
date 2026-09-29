-- R276 (issue #16 §6 — zgodovina verzij meritev; register #17-E).
-- Čisto dodajanje: 4 NOVI stolpci na Measurement (verzija/predhodnikId/
-- korenId/vir) + 1 UNIQUE indeks (predhodnikId = enojna veriga brez
-- razvejanja) + 2 NOVA indeksa (korenId+verzija = O(1) fetch verige;
-- projectId+verzija = pregled verzij projekta) + 1 NOV FK (samo-referenca
-- verige, onDelete SetNull = varovalo; kaskada projekta briše verigo celo).
--
-- Backfill: NIKOLI — null polja so ISKRENA resnica "nastalo pred
-- verzioniranjem" (odločitev O2/O9: docs/MEASUREMENT-HISTORY.md);
-- nič izmišljene zgodovine verzij.
--
-- Odločitve O1–O9 zapisane PRED razvojem: docs/MEASUREMENT-HISTORY.md.

-- AlterTable
ALTER TABLE "Measurement" ADD COLUMN "verzija" INTEGER;
ALTER TABLE "Measurement" ADD COLUMN "predhodnikId" TEXT;
ALTER TABLE "Measurement" ADD COLUMN "korenId" TEXT;
ALTER TABLE "Measurement" ADD COLUMN "vir" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Measurement_predhodnikId_key" ON "Measurement"("predhodnikId");
CREATE INDEX "Measurement_korenId_verzija_idx" ON "Measurement"("korenId", "verzija");
CREATE INDEX "Measurement_projectId_verzija_idx" ON "Measurement"("projectId", "verzija");

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_predhodnikId_fkey" FOREIGN KEY ("predhodnikId") REFERENCES "Measurement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
