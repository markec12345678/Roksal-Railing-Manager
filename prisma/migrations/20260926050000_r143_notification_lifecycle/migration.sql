-- R143 (issue #5 §29 — Notifications): življenjski cikel obvestil.
-- Čista dodajanja: NOV enum + stolpci + indeksi na obstoječi tabeli
-- Notification (brez podatkovnih sprememb, brez brisanja).
-- Legacy vrstice (userId 'skladisce', zapisane pred R143): template = 'LEGACY',
-- status = 'QUEUED' (privzeto) — dispatcher jih poslje kot vse ostale (SENT),
-- bralcu pa so vidne samo prek recipientRole, ki jih legacy ne nosi → ostanejo
-- orphan (iskreno dokumentirano v schema.prisma; brez tihe izbriše).

CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'OPENED', 'FAILED');

ALTER TABLE "Notification" ADD COLUMN "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED';
ALTER TABLE "Notification" ADD COLUMN "templateVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Notification" ADD COLUMN "recipientRole" "UserRole";
ALTER TABLE "Notification" ADD COLUMN "entityType" TEXT;
ALTER TABLE "Notification" ADD COLUMN "entityId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "correlationId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Notification" ADD COLUMN "maxRetries" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "Notification" ADD COLUMN "lastError" TEXT;
ALTER TABLE "Notification" ADD COLUMN "sentAt" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN "deliveredAt" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN "openedAt" TIMESTAMP(3);

-- template: dodaj kot nullable, backfill legacy, šele nato zahtevaj.
ALTER TABLE "Notification" ADD COLUMN "template" TEXT;
UPDATE "Notification" SET "template" = 'LEGACY' WHERE "template" IS NULL;
ALTER TABLE "Notification" ALTER COLUMN "template" SET NOT NULL;

-- userId opcijski: role-naslovljene vrstice (recipientRole) nimajo enojnega uporabnika.
ALTER TABLE "Notification" ALTER COLUMN "userId" DROP NOT NULL;

CREATE INDEX "Notification_status_createdAt_idx" ON "Notification"("status", "createdAt");
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
CREATE INDEX "Notification_recipientRole_createdAt_idx" ON "Notification"("recipientRole", "createdAt");
