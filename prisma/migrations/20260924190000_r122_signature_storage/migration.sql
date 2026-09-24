-- AlterTable
ALTER TABLE "SignatureAudit" ADD COLUMN     "mime" TEXT,
ADD COLUMN     "sha256" TEXT,
ADD COLUMN     "sizeBytes" INTEGER,
ADD COLUMN     "storageKey" TEXT,
ALTER COLUMN "signatureImage" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "SignatureAudit_storageKey_idx" ON "SignatureAudit"("storageKey");

