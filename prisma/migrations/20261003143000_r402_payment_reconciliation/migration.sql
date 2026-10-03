-- R402 — INVOICE → PAYMENT → RECONCILIATION (issue #13, korak R170 iz §19; KOLIZIJA #33: NJIHOVA R400 [val 74 slovar-raba] + R401 [val 75 color-scheme] sta pristali — MOJA runda preimenovana R400→R402).
-- ============================================================================
-- Kanonična domena plačil nad obstoječim računom:
--
--   1. Payment — en bančni/gotovinski promet (PLACILO/AVANS/DOBROPIST/
--      POVRACILO; znesek ≥ 0, smer nosi tip). PREKINJENO = storno knjižne
--      napake/dvojnika — NE briše se (pravna sled), njegove allocacije se
--      NE štejejo v izpeljavo plačilnega stanja.
--   2. PaymentAllocation — vir resnice o plačilu: ENA vrstica = del plačila
--      na EN račun. Delno plačilo, več-računov-porazdelitev, avans, dobropis
--      in povratilo se izrazijo S TEMI VRSTICAMI (spec §19).
--      @@unique(paymentId, invoiceId) — par se ne podvoji (idempotenca
--      porazdelitve na DB nivoju, zadnja črta za replay).
--   3. Invoice.poslanoAt — prehod IZDAN → POSLAN (dostavljeno kupcu).
--
-- IZPELJAVA (store-plast, src/lib/payments.ts): status DELNO_PLACAN/PLACAN
-- se ob vsakem zabeleženem/prekinjenem plačilu strežniško izpelje iz vsote
-- KNJIZENO allocacij — klient ga NE more nastaviti ročno (409 z navodilom
-- na /api/payments; »Ni UI-only status rules« §21).
--
-- BACKFILL (pravna kontinuiteta, spec §33 korak 6: »ohrani backward
-- compatibility, dokler ni izveden backfill«): legacy PLACAN računi so
-- status nosili BREZ plačilnih vrstic (placanoAt kot flag). Vsakemu
-- ustvarimo ENO kanonsko plačilo + allocacijo za celoten znesek, da
-- izpeljava ostane ZELA tudi po R400 (sicer bi uskladitev javila lažno
-- anomalijo »PLACAN brez plačila«). createdBy = NULL (sistemski vnos),
-- metoda = 'DRUGO', referenca = 'BACKFILL-R402-LEGACY' — odkrito
-- sledljivo, nič izmišljanja zgodovine (§8).
--
-- 2 novi tabeli + 1 novi stolpec + 8 indeksov + 2 FK + 1 partial UNIQUE.

-- ── 1. Payment ────────────────────────────────────────────────────────────
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "tip" TEXT NOT NULL DEFAULT 'PLACILO',
    "znesek" DECIMAL(12,2) NOT NULL,
    "valuta" TEXT NOT NULL DEFAULT 'EUR',
    "placanoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referenca" TEXT,
    "metoda" TEXT NOT NULL DEFAULT 'BANKA',
    "bankaPodatki" TEXT,
    "status" TEXT NOT NULL DEFAULT 'KNJIZENO',
    "prekinitevRazlog" TEXT,
    "prekinjenoAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Payment_projectId_idx" ON "Payment"("projectId");
CREATE INDEX "Payment_projectId_status_idx" ON "Payment"("projectId", "status");
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");
CREATE INDEX "Payment_placanoAt_idx" ON "Payment"("placanoAt");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 2. PaymentAllocation ──────────────────────────────────────────────────
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "znesek" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- En plačilo-račun par se ne podvoji (zadnja črta idempotence porazdelitve).
CREATE UNIQUE INDEX "PaymentAllocation_paymentId_invoiceId_key"
    ON "PaymentAllocation"("paymentId", "invoiceId");
CREATE INDEX "PaymentAllocation_invoiceId_idx" ON "PaymentAllocation"("invoiceId");
CREATE INDEX "PaymentAllocation_projectId_idx" ON "PaymentAllocation"("projectId");

ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 3. Invoice.poslanoAt — prehod IZDAN → POSLAN (§19 lifecycle) ─────────
ALTER TABLE "Invoice" ADD COLUMN "poslanoAt" TIMESTAMP(3);

-- ── 4. BACKFILL: legacy PLACAN → eno kanonsko plačilo + allocacija ────────
-- Pogoj: status = 'PLACAN' INI nima NOBENE allocacije (po backfillu te
-- vrstice idempotentno ne obstajajo več). Znesek = CEL znesek računa
-- (legacy model ni poznal delnih plačil — binarni PLACAN flag).
INSERT INTO "Payment" (
    "id", "projectId", "invoiceId", "tip", "znesek", "valuta", "placanoAt",
    "referenca", "metoda", "bankaPodatki", "status", "createdBy", "createdAt", "updatedAt"
)
SELECT
    'r402-backfill-' || substr(md5(i."id"), 1, 20),
    i."projectId",
    i."id",
    'PLACILO',
    i."znesek",
    'EUR',
    COALESCE(i."placanoAt", i."datumIzdaje"),
    'BACKFILL-R402-LEGACY',
    'DRUGO',
    NULL,
    'KNJIZENO',
    NULL,
    now(),
    now()
FROM "Invoice" i
WHERE i."status" = 'PLACAN'
  AND NOT EXISTS (
      SELECT 1 FROM "PaymentAllocation" pa WHERE pa."invoiceId" = i."id"
  );

INSERT INTO "PaymentAllocation" ("id", "paymentId", "invoiceId", "projectId", "znesek", "createdAt")
SELECT
    'r402-alloc-' || substr(md5(p."id"), 1, 20),
    p."id",
    p."invoiceId",
    p."projectId",
    p."znesek",
    now()
FROM "Payment" p
WHERE p."id" LIKE 'r402-backfill-%';
