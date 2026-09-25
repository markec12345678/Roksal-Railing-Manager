-- R132 (issue #5 §7): varnost portala stranke — clientToken ni več trajni javni ključ.
-- Prej: žeton je veljal VEČNO, brez revokacije, brez dostopnega dnevnika,
-- brez omejitve hitrosti; generateToken() je uporabljal Math.random() (ni kripto).

-- 1) Žeton dobi življenjski cikel: potek, revokacija, zadnji dostop.
ALTER TABLE "Project" ADD COLUMN "clientTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "clientTokenRevokedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "clientTokenLastUsedAt" TIMESTAMP(3);

-- 2) Dostopni dnevnik portala (javna površina — vsak poskus se zabeleži).
--    ipHash = sha256(IP + pepper) — zasebnost: ne hranimo surovega IP-ja.
CREATE TABLE "PortalAccess" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "status" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalAccess_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PortalAccess_projectId_createdAt_idx" ON "PortalAccess"("projectId", "createdAt");
CREATE INDEX "PortalAccess_createdAt_idx" ON "PortalAccess"("createdAt");
CREATE INDEX "PortalAccess_ipHash_createdAt_idx" ON "PortalAccess"("ipHash", "createdAt");

-- 3) Backfill: ŽE omogočeni portali dobijo potek 90 dni od migracije
--    (pre-R132 žetoni so veljali večno — §7 to prepoveduje).
UPDATE "Project"
SET "clientTokenExpiresAt" = now() + interval '90 days'
WHERE "clientPortalEnabled" = true AND "clientTokenExpiresAt" IS NULL;
