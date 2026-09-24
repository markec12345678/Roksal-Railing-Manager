-- AlterTable
ALTER TABLE "ArSnapshot" ADD COLUMN     "mime" TEXT,
ADD COLUMN     "sha256" TEXT,
ADD COLUMN     "sizeBytes" INTEGER,
ADD COLUMN     "storageKey" TEXT,
ALTER COLUMN "imageUrl" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "sha256" TEXT,
ADD COLUMN     "storageKey" TEXT;

-- AlterTable
ALTER TABLE "GalleryItem" ADD COLUMN     "slikaPoKey" TEXT,
ADD COLUMN     "slikaPoMime" TEXT,
ADD COLUMN     "slikaPoSha256" TEXT,
ADD COLUMN     "slikaPoSize" INTEGER,
ADD COLUMN     "slikaPredKey" TEXT,
ADD COLUMN     "slikaPredMime" TEXT,
ADD COLUMN     "slikaPredSha256" TEXT,
ADD COLUMN     "slikaPredSize" INTEGER;

-- AlterTable
ALTER TABLE "ProjectPhoto" ADD COLUMN     "mime" TEXT,
ADD COLUMN     "sha256" TEXT,
ADD COLUMN     "sizeBytes" INTEGER,
ADD COLUMN     "storageKey" TEXT,
ALTER COLUMN "imageData" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Sketch" ADD COLUMN     "mime" TEXT,
ADD COLUMN     "sha256" TEXT,
ADD COLUMN     "sizeBytes" INTEGER,
ADD COLUMN     "storageKey" TEXT,
ALTER COLUMN "pngData" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mime" TEXT NOT NULL DEFAULT 'application/pdf',
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentVersion_documentId_idx" ON "DocumentVersion"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_version_key" ON "DocumentVersion"("documentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Project_mobileProjectId_key" ON "Project"("mobileProjectId");

-- CreateIndex
CREATE INDEX "ProjectPhoto_storageKey_idx" ON "ProjectPhoto"("storageKey");

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

