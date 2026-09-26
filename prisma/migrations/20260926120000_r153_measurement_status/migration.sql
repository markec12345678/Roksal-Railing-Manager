-- R153 (issue #5 §19 — status meritev: perzistenten + revizijska sled).
-- Čisto dodajanje: 3 NOVI stolpci na Measurement (status/statusNote/
-- statusUpdatedAt) + 1 NOV indeks (projectId, status) za filtrirano branje.
--
-- Backfill: obstoječe vrstice → 'OSNUTEK' (iskren začetek — prej je bil
-- status izključno UI koncept, vse prikazane meritve so bile osnutki;
-- nič izmišljene zgodovine statusov).
--
-- Revizijska sled: spremembe statusa se beležijo v AuditLog
-- (akcija MEASUREMENT_STATUS, oldValue {status}, newValue {status, note,
-- statusUpdatedAt}) — brez ločene revisions tabele (AuditLog je vzpostavljen
-- vzorec §19, poizvedba po projektu + kronološko indeksirana od R136).

-- AlterTable
ALTER TABLE "Measurement" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'OSNUTEK';
ALTER TABLE "Measurement" ADD COLUMN "statusNote" TEXT;
ALTER TABLE "Measurement" ADD COLUMN "statusUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Measurement_projectId_status_idx" ON "Measurement"("projectId", "status");
