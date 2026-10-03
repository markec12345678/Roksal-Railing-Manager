-- R395 — SIGNATURE + DOCUMENT CHAIN (issue #13, korak R172 iz §16), 2/2.
-- ============================================================================
-- Vzpostavitev NEPREKINJENE verige:
--
--   QuoteVersion → DocumentVersion → dejanski PDF bajti → SHA-256 →
--   SignatureAudit → DealLock
--
-- Zagotovitve §16, vsaka NA VEČ LINIJAH (store/plast + BAZA — kanon
-- erv_uradno_zahteva_pregled iz R393):
--   1. PDF hash = hash DEJANSKIH PDF bajtov: API/plast ob zaklepu re-hashira
--      bajte IZ object storage (getObject → sha256Of) in jih primerja z
--      zabeleženim DocumentVersion.sha256; neujemanje → 409. Klientov
--      pdfHash NI VEČ vir resnice (samo preverba ujemanja, 409 ob razliki).
--   2. immutable DocumentVersion: trigger document_version_no_update zavrne
--      VSAKO UPDATE vrstico (nova vsebina = NOVA verzija, kanon R121).
--   3. signature references EXACT documentVersion: novi stolpec
--      SignatureAudit.documentVersionId + trigger
--      signature_audit_document_chain (pdfHash ≠ sha256 vezane verzije →
--      zavrnjena vrstica TUDI mimo store-plasti).
--   4. quoteVersion cannot silently change after signing: trigger
--      quote_version_signed_immutable — PODPISANA (APPROVED) verzija ima
--      zamrznjeno VSEBINO (IS DISTINCT FROM na vseh vsebinskih poljih) IN
--      terminalen status (prehod iz APPROVED zavrnjen).
--   5. signature audit DTO brez nepotrebnih občutljivih polj: API-plast
--      (rute) — allowlist, kanon deal-lock GET §17; isti kanon zdaj tudi na
--      /api/signature-audit (odstranjena polja: ipAddress/userAgent/
--      deviceFingerprint/geo — v bazi OSTANEJO, revizijska sled NI izbrisana).
--
-- 3 stolpci + 3 indeksi + 2 FK + partial UNIQUE + 3 triggerji.
-- Vsi obstoječi zapisi ostanejo NESPREMJENI (nove vezi so NULLable — brez
-- izmišljanja zgodovine, §8). Enum PONUDBA je dodan v 1/2 (ločena
-- transakcija — PostgreSQL "unsafe use of new value" nad delnim indeksom).

-- ── 1. Document.quoteVersionId — ZABOJNIK PONUDBA PDF-jev verzije ponudbe ─
ALTER TABLE "Document" ADD COLUMN "quoteVersionId" TEXT;
CREATE INDEX "Document_quoteVersionId_idx" ON "Document"("quoteVersionId");
ALTER TABLE "Document" ADD CONSTRAINT "Document_quoteVersionId_fkey"
  FOREIGN KEY ("quoteVersionId") REFERENCES "QuoteVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Partial UNIQUE: EN PONUDBA dokument na verzijo ponudbe (zadnja linija za
-- vzporedne zapise; prva = store/plast v ruti). NULL (ostali tipi dokumentov)
-- indeks ne vidi — WHERE pogoj jih izloči.
CREATE UNIQUE INDEX "Document_ponudba_quote_key"
  ON "Document"("quoteVersionId") WHERE "tipDokumenta" = 'PONUDBA';

-- ── 2. DocumentVersion.quoteVersionId — KANONIČNA §16 veriga ──────────────
ALTER TABLE "DocumentVersion" ADD COLUMN "quoteVersionId" TEXT;
CREATE INDEX "DocumentVersion_quoteVersionId_idx" ON "DocumentVersion"("quoteVersionId");
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_quoteVersionId_fkey"
  FOREIGN KEY ("quoteVersionId") REFERENCES "QuoteVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 3. SignatureAudit.documentVersionId — EXACT verzija podpisanega PDF-ja ─
-- (Mehka referenca BREZ FK — isti vzorec kot quoteVersionId/bomVersionId:
-- brisanje verzije dokumenta ne brše podpisne zgodovine.)
ALTER TABLE "SignatureAudit" ADD COLUMN "documentVersionId" TEXT;
CREATE INDEX "SignatureAudit_documentVersionId_idx" ON "SignatureAudit"("documentVersionId");

-- ── 4. IMMUTABLE DocumentVersion (trigger — BAZA linija) ───────────────────
-- NIKOLI več UPDATE vrstice: vsebina verzije dokumenta je zapečatena ob
-- nastanku (sha256 over bajtov v storage). Do R395 je bila nespremenljivost
-- SAMO konvencija (nobena koda ni delala update — a nič je ni preprečil).
CREATE OR REPLACE FUNCTION document_version_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'DocumentVersion % je NEIZBRISLJIV ARTEFAKT (R395 §16): posodobitev ni dovoljena — nova vsebina = NOVA verzija dokumenta', OLD."id";
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER document_version_no_update
  BEFORE UPDATE ON "DocumentVersion"
  FOR EACH ROW EXECUTE FUNCTION document_version_immutable();

-- ── 5. PODPISANA QuoteVersion = ZAMRZNJENA (trigger — BAZA linija) ─────────
-- APPROVED (terminalno, podpisano): brez tihih sprememb vsebine IN brez
-- prehodov ven. DRAFT/ISSUED ostajata mutabilni (urejanje osnutka +
-- ISSUED→APPROVED ob podpisu; integriteta nad njima:
-- verifyQuoteVersionIntegrity v kodi — matrika v src/lib/quote-versions.ts).
CREATE OR REPLACE FUNCTION quote_version_signed_immutable() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'APPROVED' THEN
    IF NEW."status" <> 'APPROVED' THEN
      RAISE EXCEPTION 'QuoteVersion % je PODPISANA (APPROVED — terminalno, R395 §16): prehod v % ni dovoljen', OLD."id", NEW."status";
    END IF;
    IF NEW."quoteId" IS DISTINCT FROM OLD."quoteId"
       OR NEW."versionNumber" IS DISTINCT FROM OLD."versionNumber"
       OR NEW."inputsJson" IS DISTINCT FROM OLD."inputsJson"
       OR NEW."linesJson" IS DISTINCT FROM OLD."linesJson"
       OR NEW."subtotal" IS DISTINCT FROM OLD."subtotal"
       OR NEW."vat" IS DISTINCT FROM OLD."vat"
       OR NEW."total" IS DISTINCT FROM OLD."total"
       OR NEW."currency" IS DISTINCT FROM OLD."currency"
       OR NEW."inputHash" IS DISTINCT FROM OLD."inputHash"
       OR NEW."priceBookVersionId" IS DISTINCT FROM OLD."priceBookVersionId" THEN
      RAISE EXCEPTION 'QuoteVersion % je PODPISANA (APPROVED — vsebina zamrznjena, R395 §16): tiha sprememba zavrnjena', OLD."id";
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quote_version_signed_immutable
  BEFORE UPDATE ON "QuoteVersion"
  FOR EACH ROW EXECUTE FUNCTION quote_version_signed_immutable();

-- ── 6. VERIGA podpisa (trigger — BAZA linija, kanon R393) ──────────────────
-- SignatureAudit z documentVersionId: referencirana DocumentVersion MORA
-- obstajati IN njen sha256 MORA biti ENAK pdfHash zapisa (hash dejanskih
-- PDF bajtov). Zavrnjeno TUDI mimo store-plasti — isti vzorec kot
-- erv_uradno_zahteva_pregled (R393): pokvarjena vrstica NE more v bazo.
CREATE OR REPLACE FUNCTION signature_audit_document_chain() RETURNS trigger AS $$
DECLARE
  dv_sha256 TEXT;
BEGIN
  IF NEW."documentVersionId" IS NOT NULL THEN
    SELECT "sha256" INTO dv_sha256 FROM "DocumentVersion" WHERE "id" = NEW."documentVersionId";
    IF dv_sha256 IS NULL THEN
      RAISE EXCEPTION 'SignatureAudit: DocumentVersion % ne obstaja (R395 §16 veriga — podpis mora referencirati EXACT verzijo dokumenta)', NEW."documentVersionId";
    END IF;
    IF NEW."pdfHash" IS DISTINCT FROM dv_sha256 THEN
      RAISE EXCEPTION 'SignatureAudit: pdfHash se NE ujema s sha256 DocumentVersion % (R395 §16 — PDF hash je hash DEJANSKIH PDF bajtov)', NEW."documentVersionId";
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER signature_audit_document_chain
  BEFORE INSERT OR UPDATE ON "SignatureAudit"
  FOR EACH ROW EXECUTE FUNCTION signature_audit_document_chain();
