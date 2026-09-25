-- R134 (issue #5 §9): življenjski cikl uporabnikov — deaktivacija, zaklep,
-- povabilo + aktivacija, prisilna zamenjava gesla. Vse Null/false = aktiven.
-- Ni backfilla: obstoječi računi so po definiciji aktivni.

ALTER TABLE "Profile" ADD COLUMN "deactivatedAt" TIMESTAMP(3);
ALTER TABLE "Profile" ADD COLUMN "lockedAt" TIMESTAMP(3);
ALTER TABLE "Profile" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Profile" ADD COLUMN "inviteTokenHash" TEXT;
ALTER TABLE "Profile" ADD COLUMN "inviteExpiresAt" TIMESTAMP(3);
ALTER TABLE "Profile" ADD COLUMN "invitedBy" TEXT;
ALTER TABLE "Profile" ADD COLUMN "invitedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Profile_inviteTokenHash_key" ON "Profile"("inviteTokenHash");
