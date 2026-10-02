-- R374 (issue #13, korak R165 iz §32/§2–§8/§16/§17) — KANONIČNA POSLOVNA
-- RESNICA PONUDB. Štiri nove tabele + dve nullable koloni na SignatureAudit.
--
-- Problem, ki ga ta migracija zapira (issue #13 §2/§3/§4):
--   • deal-lock je do R372 sprejemal KLIENTOV quoteData (items, seštevki) kot
--     vir resnice → podpis se ni vezal na nobeno strežniško verzijo ponudbe;
--   • cenik je bil samo privzeta konstanta v kodi (defaultPriceBook) — brez
--     verzij, brez lastnika, brez sledljivosti sprememb;
--   • marža ob zaklepu je bila LAŽNI model (60 % material / 15 % delo).
--
-- Rešitev (isti vzorec kot DocumentVersion R121 — immutable verzije):
--   PriceBookVersion + PriceBookItem  = strežniško avtoritativni cenik (§4),
--   Quote + QuoteVersion              = immutable verzije ponudb (§3),
--   SignatureAudit.quoteVersionId     = veriga podpis → verzija (§16).
--
-- CHECK omejitve (vzorec R136/R145, takoj VELJAVNE — vse nove tabele so prazne,
-- razen idempotentnega seeda, ki vrednosti že izpolnjuje):
--   • status PriceBookVersion IN ('DRAFT','ACTIVE','RETIRED') — statusni stroj
--     živi v src/lib/price-book-store.ts (EN VIR);
--   • status QuoteVersion IN ('DRAFT','ISSUED','APPROVED','REJECTED',
--     'SUPERSEDED') — matrika prehodov v src/lib/quote-versions.ts (EN VIR);
--   • salesPrice/subtotal/vat/total >= 0 — negativna cena/seštevek je napaka
--     podatka, ne poslovno stanje (fail-closed na pisanju).
--
-- Skalarne reference brez FK (createdById/approvedById, currentVersionId):
--   ista zasnova kot JobRun.owner/SignatureAudit — mehke revizijske reference
--   na Profile/QuoteVersion, ki ne ovirajo brisanja in ne silijo cikla
--   Quote→QuoteVersion→Quote. Tujkov ne moremo vpisati prek API-ja (rute
--   berejo id iz seje, nikoli iz telesa zahteve).
--
-- SEED v1 cenika (IDEMPOTENTEN — fiksni ID-ji + ON CONFLICT DO NOTHING):
--   PriceBookVersion {version: 1, status: ACTIVE, currency: EUR} + 25 postavk
--   z vrednostmi TOČNO iz defaultPriceBook() (src/lib/quote.ts — preverjeno
--   proti viru; numerični ključi vključujejo vatPercent/discountPercent/
--   smallMaterialPercent, ker vplivajo na izračun ponudbe). 26. kanon cenika
--   je currency, ki živi na verziji (PriceBookItem.salesPrice je Decimal).
--   referenceCost = NULL POVsod — marža je iskreno NEZNANA, dokler lastnik ne
--   vnese realnih nabavnih cen (§8: placeholder 60 %/15 % je IZBRISAN iz
--   poslovne logike deal-locka v isti rundi).

-- CreateTable: verzije cenika (§4)
CREATE TABLE "PriceBookVersion" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "note" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "PriceBookVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable: postavke cenika (§4)
CREATE TABLE "PriceBookItem" (
    "id" TEXT NOT NULL,
    "priceBookVersionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "salesPrice" DECIMAL(12,2) NOT NULL,
    "referenceCost" DECIMAL(12,2),

    CONSTRAINT "PriceBookItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ponudbe projekta (§3)
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "customerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ODPRTA',
    "currentVersionId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable: NESPREMENLJIVE verzije ponudb (§3)
CREATE TABLE "QuoteVersion" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "inputsJson" JSONB NOT NULL,
    "linesJson" JSONB NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "vat" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "inputHash" TEXT NOT NULL,
    "priceBookVersionId" TEXT NOT NULL,
    "createdById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "QuoteVersion_pkey" PRIMARY KEY ("id")
);

-- AlterTable: veriga podpis → kanonična verzija (§16; nullable — legacy vrstice
-- pred R374 ostanejo nespremenjene: nimajo verzije in se NE izmišljujemo).
ALTER TABLE "SignatureAudit" ADD COLUMN "quoteVersionId" TEXT,
ADD COLUMN "quoteInputHash" TEXT;

-- CreateIndex (TOČNO zrcalijo @@index/@@unique iz prisma/schema.prisma)
CREATE UNIQUE INDEX "PriceBookVersion_version_key" ON "PriceBookVersion"("version");
CREATE INDEX "PriceBookVersion_status_idx" ON "PriceBookVersion"("status");
CREATE INDEX "PriceBookVersion_createdAt_idx" ON "PriceBookVersion"("createdAt");

CREATE UNIQUE INDEX "PriceBookItem_priceBookVersionId_key_key" ON "PriceBookItem"("priceBookVersionId", "key");
CREATE INDEX "PriceBookItem_priceBookVersionId_idx" ON "PriceBookItem"("priceBookVersionId");

CREATE INDEX "Quote_projectId_idx" ON "Quote"("projectId");

CREATE UNIQUE INDEX "QuoteVersion_quoteId_versionNumber_key" ON "QuoteVersion"("quoteId", "versionNumber");
CREATE INDEX "QuoteVersion_quoteId_idx" ON "QuoteVersion"("quoteId");
CREATE INDEX "QuoteVersion_priceBookVersionId_idx" ON "QuoteVersion"("priceBookVersionId");
CREATE INDEX "QuoteVersion_status_idx" ON "QuoteVersion"("status");

CREATE INDEX "SignatureAudit_quoteVersionId_idx" ON "SignatureAudit"("quoteVersionId");

-- AddForeignKey
ALTER TABLE "PriceBookItem" ADD CONSTRAINT "PriceBookItem_priceBookVersionId_fkey" FOREIGN KEY ("priceBookVersionId") REFERENCES "PriceBookVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuoteVersion" ADD CONSTRAINT "QuoteVersion_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuoteVersion" ADD CONSTRAINT "QuoteVersion_priceBookVersionId_fkey" FOREIGN KEY ("priceBookVersionId") REFERENCES "PriceBookVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateConstraint: CHECK omejitve (statusni stroji + nenegativni denar)
ALTER TABLE "PriceBookVersion" ADD CONSTRAINT "pricebook_version_status_allowed"
  CHECK ("status" IN ('DRAFT', 'ACTIVE', 'RETIRED'));
ALTER TABLE "QuoteVersion" ADD CONSTRAINT "quote_version_status_allowed"
  CHECK ("status" IN ('DRAFT', 'ISSUED', 'APPROVED', 'REJECTED', 'SUPERSEDED'));
ALTER TABLE "PriceBookItem" ADD CONSTRAINT "pricebook_item_sales_price_nonneg"
  CHECK ("salesPrice" >= 0);
ALTER TABLE "QuoteVersion" ADD CONSTRAINT "quote_version_subtotal_nonneg"
  CHECK ("subtotal" >= 0);
ALTER TABLE "QuoteVersion" ADD CONSTRAINT "quote_version_vat_nonneg"
  CHECK ("vat" >= 0);
ALTER TABLE "QuoteVersion" ADD CONSTRAINT "quote_version_total_nonneg"
  CHECK ("total" >= 0);

-- ============================================================================
-- SEED v1: aktivna verzija cenika iz defaultPriceBook() (§4 — strežniški vir).
-- Fiksni ID-ji ('pricebook-v1', 'pbitem-<key>') + ON CONFLICT DO NOTHING =
-- idempotentno (ponovni deploy ne podvoji; vzorec seed migracij r127).
-- Vrednosti so bile izpeljane IZKLJUČNO iz src/lib/quote.ts defaultPriceBook()
-- in so proti viru preverjene s testom r374-price-book-store (anti-stale).
-- referenceCost NULL = NEZNANO (iskrena marža, §8) — nikoli placeholder.
-- ============================================================================
INSERT INTO "PriceBookVersion" ("id", "version", "status", "currency", "effectiveFrom", "note", "createdAt")
VALUES (
  'pricebook-v1',
  1,
  'ACTIVE',
  'EUR',
  CURRENT_TIMESTAMP,
  'Seed v1 — vrednosti TOČNO iz defaultPriceBook() (src/lib/quote.ts); referenceCost NULL = iskreno NEZNANO (§8 R374)',
  CURRENT_TIMESTAMP
) ON CONFLICT ("id") DO NOTHING;

INSERT INTO "PriceBookItem" ("id", "priceBookVersionId", "key", "label", "unit", "category", "salesPrice", "referenceCost") VALUES
  ('pbitem-vatPercent',            'pricebook-v1', 'vatPercent',            'DDV',                                     '%',       'OTHER',    22.00,  NULL),
  ('pbitem-discountPercent',       'pricebook-v1', 'discountPercent',       'Popust',                                  '%',       'OTHER',     0.00,  NULL),
  ('pbitem-baseProfilePerM',       'pricebook-v1', 'baseProfilePerM',       'Osnovni U-profil',                        'm',       'PROFILES', 46.90,  NULL),
  ('pbitem-coverRailPerM',         'pricebook-v1', 'coverRailPerM',         'Pokrovna letev (U / pravokotna)',         'm',       'PROFILES', 19.50,  NULL),
  ('pbitem-roundHandrailPerM',     'pricebook-v1', 'roundHandrailPerM',     'Okrogla pokrovna letev',                  'm',       'PROFILES', 24.80,  NULL),
  ('pbitem-woodHandrailPerM',      'pricebook-v1', 'woodHandrailPerM',      'Lesena pokrovna letev',                   'm',       'PROFILES', 34.00,  NULL),
  ('pbitem-glassPerM2',            'pricebook-v1', 'glassPerM2',            'Steklo',                                  'm2',      'GLASS',   158.00,  NULL),
  ('pbitem-polishedEdgePerM',      'pricebook-v1', 'polishedEdgePerM',      'Obdelava robov stekla',                   'm',       'GLASS',     6.50,  NULL),
  ('pbitem-postPerEach',           'pricebook-v1', 'postPerEach',           'Stebriček',                               'kos',     'POSTS',    38.50,  NULL),
  ('pbitem-postBasePlatePerEach',  'pricebook-v1', 'postBasePlatePerEach',  'Osnovna plošča stebrička',                'kos',     'POSTS',    12.90,  NULL),
  ('pbitem-postSideBracketPerEach','pricebook-v1', 'postSideBracketPerEach','Bočni nosilec stebrička',                 'kos',     'POSTS',    18.50,  NULL),
  ('pbitem-anchorPerEach',         'pricebook-v1', 'anchorPerEach',         'Sidro / vijak M8–M10',                    'kos',     'FIXINGS',   1.35,  NULL),
  ('pbitem-endCapPerEach',         'pricebook-v1', 'endCapPerEach',         'Zaključna kapica letev',                  'kos',     'FIXINGS',   7.50,  NULL),
  ('pbitem-cornerElementPerEach',  'pricebook-v1', 'cornerElementPerEach',  'Kotni element / varjeni vogal letev',      'kos',     'FIXINGS',  24.00,  NULL),
  ('pbitem-barPerM',               'pricebook-v1', 'barPerM',               'Palica polnila',                          'm',       'INFILL',    9.80,  NULL),
  ('pbitem-meshPerM2',             'pricebook-v1', 'meshPerM2',             'Mreža / polnilo',                         'm2',      'INFILL',   62.00,  NULL),
  ('pbitem-woodPerM2',             'pricebook-v1', 'woodPerM2',             'Leseno polnilo',                          'm2',      'INFILL',   88.00,  NULL),
  ('pbitem-gasketPerM',            'pricebook-v1', 'gasketPerM',            'Tesnilo / podložna letev',                'm',       'FIXINGS',   3.40,  NULL),
  ('pbitem-siliconeJointPerM',     'pricebook-v1', 'siliconeJointPerM',     'Silikon za steklene fuge',                'm',       'FIXINGS',   2.20,  NULL),
  ('pbitem-customElementPerEach',  'pricebook-v1', 'customElementPerEach',  'Element po meri (lasten model)',          'kos',     'INFILL',   95.00,  NULL),
  ('pbitem-demolitionPerM',        'pricebook-v1', 'demolitionPerM',        'Demontaža obstoječe ograje',              'm',       'LABOUR',    9.50,  NULL),
  ('pbitem-mountingPerM',          'pricebook-v1', 'mountingPerM',          'Montaža in nastavljanje',                 'm',       'LABOUR',   38.00,  NULL),
  ('pbitem-transportFlat',         'pricebook-v1', 'transportFlat',         'Prevoz in logistika',                     'komplet', 'LABOUR',   35.00,  NULL),
  ('pbitem-surveyFlat',            'pricebook-v1', 'surveyFlat',            'Izmera na objektu',                       'komplet', 'LABOUR',    0.00,  NULL),
  ('pbitem-smallMaterialPercent',  'pricebook-v1', 'smallMaterialPercent',  'Droben montažni material',                '%',       'OTHER',     3.00,  NULL)
ON CONFLICT ("id") DO NOTHING;
