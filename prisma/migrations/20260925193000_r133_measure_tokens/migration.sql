-- R133 (issue #5 §8): javna samomeritev — scoped žeton, življenjski cikl,
-- dedupe hash. Nič ne izbrišemo; samo nove stolpce + indeks + določen backfill.

-- 1) Project: scoped merilni žeton (LOČEN od portal clientToken)
ALTER TABLE "Project" ADD COLUMN "measureToken" TEXT;
ALTER TABLE "Project" ADD COLUMN "measureEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "measureTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "measureTokenRevokedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "measureTokenLastUsedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Project_measureToken_key" ON "Project"("measureToken");

-- 2) Measurement: deterministični hash za duplicate protection
ALTER TABLE "Measurement" ADD COLUMN "dedupeHash" TEXT;
CREATE INDEX "Measurement_projectId_dedupeHash_idx" ON "Measurement"("projectId", "dedupeHash");

-- 3) Backfill (kontinuiteta obstoječih povezav, določen — ne tih):
--    Prej je /m/<clientToken> deloval za VSAK projekt (žeton portal = žeton
--    meritve). Da obstoječe merilne povezave v divjini ne umrejo ob deployu,
--    vsak projekt dobi measureToken = clientToken in measureEnabled = true,
--    s potekom now() + 90 dni (isti fail-closed privzeti kot portal R132).
--    Po 90 dneh nepregledane povezave potečejo; pisarna lahko v UI izda novo
--    kripto merilno povezavo (Nova povezava) z želenim potekom.
UPDATE "Project"
SET "measureToken" = "clientToken",
    "measureEnabled" = true,
    "measureTokenExpiresAt" = now() + interval '90 days'
WHERE "measureToken" IS NULL;
