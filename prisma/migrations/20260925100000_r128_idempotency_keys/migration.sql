-- R128 (issue #5 §4): idempotenca offline vrste.
-- Terenski klient pošilja zapise s stabilnim Idempotency-Key; strežnik shrani
-- snapshot odgovora — ponovitev ključa vrne originalni odgovor (brez dvojnikov).
-- Ključ je vezan na profil (profileId) — tuji replay ne razkrije odgovora.

CREATE TABLE "IdempotencyKey" (
    "key" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "profileId" TEXT,
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "IdempotencyKey_createdAt_idx" ON "IdempotencyKey"("createdAt");
