-- R141 (issue #5 §23 — Background jobs)
-- Register poslov (job ledger): vsak zagon vzdrževalnega posla dobi vrstico
-- z job ID, owner, input, status, attempts, retry policy (maxAttempts),
-- error, idempotenco (UNIQUE type+okno) in correlation ID — vse zahteve §23
-- na ENEM mestu, berljivo prek /api/jobs (samo ADMIN).
--
-- Brez podatkovnih sprememb (čista nova tabela) — deploy ni ogrožen, ni
-- NOT VALID/VALIDATE plesa. Fail-closed: aplikacija deluje tudi, če tabela
-- (začasno) ni dosegljiva — posli javijo FAILED z lastError, klient pa
-- prejme strukturiran 5xx s correlationId (§22 pogodba).

-- ----------------------------------------------------------------------
CREATE TABLE "JobRun" (
    "id"             TEXT NOT NULL,
    "type"           TEXT NOT NULL,
    "owner"          TEXT NOT NULL,
    "input"          TEXT,
    "status"         TEXT NOT NULL,
    "attempts"       INTEGER NOT NULL DEFAULT 0,
    "maxAttempts"    INTEGER NOT NULL DEFAULT 3,
    "lastError"      TEXT,
    "correlationId"  TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "result"         TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt"      TIMESTAMP(3),
    "finishedAt"     TIMESTAMP(3),
    "durationMs"     INTEGER,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- Idempotenca poslov: dvakrat isti okno (dan) = replay, ne dvojno delo.
CREATE UNIQUE INDEX "JobRun_idempotencyKey_key" ON "JobRun"("idempotencyKey");

-- Zgodovina po tipu posla (UI: zadnji zagon vsakega tipa) + splošni pregled.
CREATE INDEX "JobRun_type_createdAt_idx" ON "JobRun"("type", "createdAt");
CREATE INDEX "JobRun_createdAt_idx" ON "JobRun"("createdAt");
