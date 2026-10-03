-- R402 — RAZŠIRITEV CHECK "invoice_status_allowed" (issue #13 §19, 2/2).
-- ============================================================================
-- Prva migracija (r400_payment_reconciliation) dodaja tabele + stolpec;
-- TA pa razširi obstoječi CHECK (R136: "obramba v globino — status po
-- številčenju NE sme priti mimo nabora") na 9-statusni finančni stroj:
--
--   OSNUTEK → IZDAN → POSLAN → DELNO_PLACAN → PLACAN        (plačilna pot)
--   IZDAN/POSLAN → ZAPADLO → OPOZORILO → IZTERJAVA          (izterjevalna)
--   STORNIRAN                                                 (terminalen)
--
-- Ločena migracija po precedensu R395 (enum v 1/2): zamenjava CHECK-a je
-- varna TUKAJ, ker je nabor STROGO nadskupina starega (vsa obstoječa
-- vrstica ostane skladna — VALIDATE na koncu tega dokazuje).
-- Delno plačilo/dunning statusi nastanejo IZKLJUČNO prek plasti plačil
-- (payments.ts izpeljava) ali statusnega stroja (invoices PATCH) — CHECK
-- je zadnja črta proti ročnemu SQL/skriptam, ki bi vpisale izmišljene
-- vrednosti.

ALTER TABLE "Invoice" DROP CONSTRAINT "invoice_status_allowed";

ALTER TABLE "Invoice" ADD CONSTRAINT "invoice_status_allowed"
  CHECK ("status" IN (
    'OSNUTEK', 'IZDAN', 'POSLAN', 'DELNO_PLACAN', 'PLACAN',
    'ZAPADLO', 'OPOZORILO', 'IZTERJAVA', 'STORNIRAN'
  ));

-- Dokaz: VSE obstoječe vrstice (stari 4-statusni nabor) so skladne.
ALTER TABLE "Invoice" VALIDATE CONSTRAINT "invoice_status_allowed";
