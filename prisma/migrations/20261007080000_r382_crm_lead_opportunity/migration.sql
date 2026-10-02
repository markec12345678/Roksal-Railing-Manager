-- R382 (issue #13, korak R169 iz §13) — CRM: LEAD + OPPORTUNITY + LOČENI
-- NASLOVI STRANKE (CustomerAddress).
--
-- Problem, ki ga ta migracija zapira (issue #13 §13):
--   • trenutni Customer model je "preveč blizu končni stranki" — vsako
--     povpraševanje se je zapisovalo DIREKTNO v stranke, brez sledea
--     (odkod je prišlo, kdo ga vodi, kdaj je naslednji korak), brez
--     prodajne cevi in brez razloga izgube;
--   • Customer je imel NASAMO en flat naslov — kontakt/račun/monaža so
--     bila ISTA resnica (§13: "Customer mora ločiti vsaj: contact/mailing
--     address; billing address; installation/site address").
--
-- Rešitev (isti vzorec kot R374/R376/R378 — NOVE tabele, obstoječe
-- deterministične temelje NE rušimo, kanon §1):
--   Lead             = surovi stik PRED stranko (source/kontakt/tip
--                      povpraševanja/status/owner/nextActionAt);
--   Opportunity      = poslovna priložnost (leadId?/customerId?/naziv/
--                      ocenjena vrednost/stage/verjetnost/razlogIzgube/
--                      convertedProjectId) — stage lifecycle §13 EXACT:
--                      NEW → CONTACTED → SITE_SURVEY → QUOTE → FOLLOW_UP
--                      → ACCEPTED / LOST (matrika = src/lib/crm-pipeline.ts
--                      EN VIR; LOST zahteva razlog; ACCEPTED = terminalno +
--                      transakcijska pretvorba v Project prek crm-store);
--   CustomerAddress  = ločeni naslovi (KONTAKTNI | RACUNSKI | MONTAZNI),
--                      več MONTAZNI naslovov na stranko je dovoljenih
--                      (upravniki stanovanjskih skupnosti imajo več
--                      objektov).
--
-- CHECK omejitve (vzorec R374/R378 — takoj VELJAVNE; nove tabele so
-- PRAZNE razen CustomerAddress backfill, ki konsolidira OBSTOJEČE
-- naslove — izmišljevanje zgodovine je prepovedano §8, zato RACUNSKI/
-- MONTAZNI ostanejo ISKRENO odsotni, dokler pisarna ne vpiše resničnih):
--   • Lead.source IN ('WEB','TELEFON','EMAIL','PREPOROKA',
--     'OBSTOJECA_STRANKA','SEJEM','DRUGO') — starter nabor + DRUGO (v repu
--     NI obstoječega CRM nabora virov; enaka iskrena odločitev kot
--     prioritete R378: trije nivoji iz nič);
--   • Lead.tipPovprasevanja IN ('BALKON','TERASA','STOPNISCE','OGRAJA',
--     'DRUGO') — konteksti ograj, ki jih rep DEJANSKO podpira (kalkulator/
--     merilne površine), + DRUGO izhod;
--   • Lead.status IN ('NOV','KONTAKTIRAN','PRETVORJEN','ZAVRNJEN') —
--     PREDkvalifikacijski nabor (§13 lifecycle živi na Opportunity.stage,
--     ki ima v specu polje "stage"; Lead.status NI druga kopija cevi);
--   • Opportunity.stage IN (§13 lifecycle EXACT, 7 stopenj);
--   • Opportunity.verjetnost IS NULL OR (0..100) — §13: "probability ni
--     potrebna kot napoved, lahko pa kot CRM polje brez poslovne logike"
--     — int mnenje, NIKOLI vhod v izračun (denar/odstotki so domena
--     decimal-policy R380);
--   • Opportunity.ocenjenaVrednost ≥ 0 (denar ni negativen; NULL = ocena
--     NEZNANA — §8: nikoli 0 kot lažni "neznano");
--   • CustomerAddress.tip IN ('KONTAKTNI','RACUNSKI','MONTAZNI').
--
-- Partial UNIQUE (customerId, tip) WHERE jePrivzet: največ EN privzet
-- naslov na (stranka, tip). Strežniška plast (crm-store) stari privzeti
-- demote-a V ISTI transakciji — DB index je ZADNJA linija (tekma dveh
-- vzporednih POST-ov pada GLASNO na P2002-equivalent, ne tiho).
--
-- Skalarne reference brez FK (createdById-vzorec R374/R378): Lead.ownerId
-- ima mehki FK na Profile (SET NULL — odhod lastnika NE pobije sleada,
-- a lastnik je DOKAZ, zato ostaja referenca). FK customerId → RESTRICT
-- (stranka z priložnostmi se ne briše brez njih — kanon canDeleteCustomer
-- vodstvo + pregled pred brisanjem). FK convertedProjectId → RESTRICT:
-- invariant stage=ACCEPTED ⇒ projekt OBSTAJA ne sme tiho razpasti; DELETE
-- pot za projekt v APIju NE obstaja (pregledano R382).
--
-- Backfill (konsolidacija §13, NE izmišljanje): vsak obstoječi
-- Customer.naslov postane PRIVZETI KONTAKTNI CustomerAddress (deterministični
-- id 'custaddr-' || customer.id — ponovljivo, brez pgcrypto odvisnosti).
-- Customer.naslov OSTANE (NOT NULL od init migracije — mobilni klienti/PDF
-- ga berejo; kanon §1 "ne ruši obstoječih determinističnih temeljev") kot
-- FLAT PRIKAZNO polje: crm-store ga drži usklajenega z privzetim KONTAKTNI
-- naslovom v isti transakciji (dokumentirana meja, ne tiha dvojna resnica).

-- CreateTable: surovi stik PRED stranko (§13 Lead)
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'DRUGO',
    "ime" TEXT NOT NULL,
    "telefon" TEXT,
    "email" TEXT,
    "tipPovprasevanja" TEXT NOT NULL DEFAULT 'DRUGO',
    "status" TEXT NOT NULL DEFAULT 'NOV',
    "ownerId" TEXT,
    "nextActionAt" TIMESTAMP(3),
    "opombe" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable: poslovna priložnost (§13 Opportunity)
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "customerId" TEXT,
    "naziv" TEXT NOT NULL,
    "opis" TEXT,
    "ocenjenaVrednost" DECIMAL(12,2),
    "stage" TEXT NOT NULL DEFAULT 'NEW',
    "verjetnost" INTEGER,
    "razlogIzgube" TEXT,
    "convertedProjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ločeni naslovi stranke (§13 CustomerAddress)
CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tip" TEXT NOT NULL DEFAULT 'KONTAKTNI',
    "naslov" TEXT NOT NULL,
    "kraj" TEXT,
    "postnaSt" TEXT,
    "jePrivzet" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (TOČNO zrcalijo @@index/@@unique iz prisma/schema.prisma)
CREATE INDEX "Lead_status_nextActionAt_idx" ON "Lead"("status", "nextActionAt");
CREATE INDEX "Lead_ownerId_idx" ON "Lead"("ownerId");

CREATE INDEX "Opportunity_stage_createdAt_idx" ON "Opportunity"("stage", "createdAt");
CREATE INDEX "Opportunity_customerId_idx" ON "Opportunity"("customerId");
CREATE INDEX "Opportunity_leadId_idx" ON "Opportunity"("leadId");
CREATE UNIQUE INDEX "Opportunity_convertedProjectId_key" ON "Opportunity"("convertedProjectId");

CREATE INDEX "CustomerAddress_customerId_tip_idx" ON "CustomerAddress"("customerId", "tip");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_convertedProjectId_fkey" FOREIGN KEY ("convertedProjectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateConstraint: CHECK omejitve (statusni stroji + domene; takoj VALIDIRANE)
ALTER TABLE "Lead" ADD CONSTRAINT "lead_source_allowed"
  CHECK ("source" IN ('WEB', 'TELEFON', 'EMAIL', 'PREPOROKA', 'OBSTOJECA_STRANKA', 'SEJEM', 'DRUGO'));
ALTER TABLE "Lead" ADD CONSTRAINT "lead_enquiry_type_allowed"
  CHECK ("tipPovprasevanja" IN ('BALKON', 'TERASA', 'STOPNISCE', 'OGRAJA', 'DRUGO'));
ALTER TABLE "Lead" ADD CONSTRAINT "lead_status_allowed"
  CHECK ("status" IN ('NOV', 'KONTAKTIRAN', 'PRETVORJEN', 'ZAVRNJEN'));
ALTER TABLE "Opportunity" ADD CONSTRAINT "opportunity_stage_allowed"
  CHECK ("stage" IN ('NEW', 'CONTACTED', 'SITE_SURVEY', 'QUOTE', 'FOLLOW_UP', 'ACCEPTED', 'LOST'));
ALTER TABLE "Opportunity" ADD CONSTRAINT "opportunity_verjetnost_range"
  CHECK ("verjetnost" IS NULL OR ("verjetnost" >= 0 AND "verjetnost" <= 100));
ALTER TABLE "Opportunity" ADD CONSTRAINT "opportunity_vrednost_nonneg"
  CHECK ("ocenjenaVrednost" IS NULL OR "ocenjenaVrednost" >= 0);
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "customer_address_tip_allowed"
  CHECK ("tip" IN ('KONTAKTNI', 'RACUNSKI', 'MONTAZNI'));

-- Backfill: konsolidacija obstoječih flat naslovov v PRIVZETE KONTAKTNE
-- (deterministični id iz customer.id — ponovljivo, brez pgcrypto).
-- RACUNSKI/MONTAZNI se NE izmišljujejo (§8) — vpiše jih pisarna, ko jih
-- bo dejansko preverila.
INSERT INTO "CustomerAddress" ("id", "customerId", "tip", "naslov", "jePrivzet", "createdAt", "updatedAt")
SELECT 'custaddr-' || c."id", c."id", 'KONTAKTNI', c."naslov", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Customer" c
WHERE c."naslov" IS NOT NULL AND c."naslov" <> '';

-- Partial UNIQUE: največ EN privzet naslov na (stranka, tip) — ZADNJA
-- linija za vzporedne zapise (prva je crm-store demote v isti tx).
CREATE UNIQUE INDEX "CustomerAddress_customerId_tip_privzet_key"
  ON "CustomerAddress"("customerId", "tip") WHERE "jePrivzet";
