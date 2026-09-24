-- R126 — issue #5 §3: API-key lifecycle
-- Novi polji za namen, scope, projektni obseg, potek, rotacijo in per-key
-- omejitev hitrosti. Obstoječi ključi ostanejo delujoči: scopes dobi privzeti
-- nabor MOBILE_SYNC (istega obsega kot dosedanja pogodba), ostalo je null.

ALTER TABLE "ApiKey" ADD COLUMN "purpose" TEXT;
ALTER TABLE "ApiKey" ADD COLUMN "scopes" TEXT NOT NULL DEFAULT 'projects:read,projects:write,measurements:create,photos:read,photos:write';
ALTER TABLE "ApiKey" ADD COLUMN "projectScope" TEXT;
ALTER TABLE "ApiKey" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "ApiKey" ADD COLUMN "rotatedFrom" TEXT;
ALTER TABLE "ApiKey" ADD COLUMN "rateLimitPerMin" INTEGER;
