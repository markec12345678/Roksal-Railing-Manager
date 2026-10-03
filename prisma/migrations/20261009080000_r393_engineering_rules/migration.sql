-- R393 (issue #13, korak R171 iz §15) — ENGINEERING / COMPLIANCE
-- VERSIONING.
--
-- Problem, ki ga ta migracija zapira (issue #13 §15):
--   • tehnična pravila so živela kot hardcode: generalMountingRules v
--     data/roksal-catalog.json (9 besedil — SDK §1 kanon NE rušimo) in
--     kot KONSTANTE v src/lib/calculator.ts (checkCompliance: razmik 110 mm
--     "SIST EN 1264", višina 1000 mm "Pravilnik", razmak stebrov 1500 mm brez
--     standarda, horizontalna obremenitev "EVS EN 1991-1-1", veter "SIST EN
--     1991-1-4 NA Slovenija") — BREZ sledljivosti vira, BREZ verzioniranja,
--     BREZ reviewedAt/reviewer;
--   • standardne reference v kalkulatorju so NEPREVERJENE (npr. "krogla
--     100 mm ne sme pastiti" a maxGapAllowed=110; "SIST EN" brez številke) —
--     §15: "Ne uporabljati nepreverjenih ali napačnih standard reference kot
--     production compliance truth";
--   • informativni inženirski izračun NI bil jasno ločen od uradnega
--     projektantskega/statističnega preverjanja (§15 zahteva izrecno ločitev).
--
-- Rešitev (vzorec R374/R376/R378/R382/R390 — NOVE tabele, obstoječi
-- deterministični temelji ostajajo; SDK/kalkulator NE rušimo):
--   EngineeringRule        — identiteta pravila (stabilna EXACT šifra,
--                            kategorija, aplikacija §14 nabor, produkt,
--                            orientacija);
--   EngineeringRuleVersion — IMMUTABLE verzija z VSEMI §15 polji: vir (source),
--                            virZapis (citat), standardReferenca,
--                            standardVerzija, jurisdikcija, overitev
--                            (INFORMATIVNO | PROJEKTANTSKA | STATISTICNA),
--                            calculatorVerzija, veljavnostOd/Do (effectiveFrom),
--                            reviewedAt, reviewerId, createdById.
--
-- LOČITEV (§15): overitev != INFORMATIVNO ZAHTEVA reviewedAt + reviewerId
-- (store-plast guard ob ustvarjanju IN aktivaciji — nepreverjeno pravilo je
-- LAHKO samo INFORMATIVNO). Seed: VSA pravila so INFORMATIVNO, reviewedAt in
-- reviewerId so NULL (iskreno — NIČ od dokumentiranih virov ni uradno
-- preverjeno s strani projektanta/statika).
--
-- Seed (vzorec R374/R390 — deterministični id + ON CONFLICT DO NOTHING):
--   • 9 splošnih pravil montaže iz data/roksal-catalog.json
--     (generalMountingRules — byte-exact citati; 8 × KATALOG_PROIZVAJALCA +
--     1 × SEKUNDARNI_VIR za WPC odtenek, montaze-mlakar.si);
--   • 23 produktnih razmakov iz zapisov profilov (maxPostSpacing H/V,
--     maxRailSpacing V, recommendedGap — struktura {minMm,maxMm};
--     calculatorVerzija 'sdk-S+8': porablja jih Product SDK geometry;
--     KUBO pokončno BREZ maxPostSpacing → BREZ pravila — odkrita odsotnost);
--   • 5 pravil iz calculator.ts checkCompliance/veter (INTERNI_INZENIRING;
--     standardReferenca TOČNO kot jo citira vir — vključno z odkrito
--     zabeleženimi nedoslednostmi; calculatorVerzija NULL — checkCompliance
--     NIMA lastne verzije formule, odkrito zabeleženo).
--
-- CHECK omejitve (takoj VELJAVNE — vzorec R374/R376/R378/R382/R390):
--   • EngineeringRule.kategorija IN ('MONTAZA','RAZMAK','MATERIAL',
--     'OBREMENITEV','GEOMETRIJA'); aplikacija IN (§14 EXACT 6) ali NULL;
--     orientacija IN ('horizontal','vertical') ali NULL;
--   • EngineeringRuleVersion.status IN ('DRAFT','ACTIVE','RETIRED');
--     vir IN ('KATALOG_PROIZVAJALCA','URADNI_STANDARD','INTERNI_INZENIRING',
--     'SEKUNDARNI_VIR'); overitev IN ('INFORMATIVNO','PROJEKTANTSKA',
--     'STATISTICNA'); veljavnostDo > veljavnostOd kadar prisoten;
--     URADNO (ne-INFORMATIVNO) ZAHTEVA reviewedAt + reviewerId (CHECK —
--     baza ZAVRNE nepreverjeno "uradno" pravilo tudi mimo store-plasti).

-- CreateTable: identiteta tehničnega pravila (§15 rule id)
CREATE TABLE "EngineeringRule" (
    "id" TEXT NOT NULL,
    "sifra" TEXT NOT NULL,
    "naziv" TEXT NOT NULL,
    "kategorija" TEXT NOT NULL,
    "aplikacija" TEXT,
    "productId" TEXT,
    "orientacija" TEXT,
    "aktivno" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EngineeringRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable: verzija pravila (§15 provenance — IMMUTABLE snapshot)
CREATE TABLE "EngineeringRuleVersion" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "verzija" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "vsebina" TEXT NOT NULL,
    "strukturaJson" TEXT,
    "vir" TEXT NOT NULL,
    "virZapis" TEXT,
    "standardReferenca" TEXT,
    "standardVerzija" TEXT,
    "jurisdikcija" TEXT,
    "overitev" TEXT NOT NULL,
    "calculatorVerzija" TEXT,
    "veljavnostOd" TIMESTAMP(3) NOT NULL,
    "veljavnostDo" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewerId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngineeringRuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (TOČNO zrcalijo @@index/@@unique iz prisma/schema.prisma)
CREATE UNIQUE INDEX "EngineeringRule_sifra_key" ON "EngineeringRule"("sifra");
CREATE INDEX "EngineeringRule_kategorija_idx" ON "EngineeringRule"("kategorija");
CREATE INDEX "EngineeringRule_aplikacija_idx" ON "EngineeringRule"("aplikacija");
CREATE INDEX "EngineeringRule_productId_idx" ON "EngineeringRule"("productId");

CREATE UNIQUE INDEX "EngineeringRuleVersion_ruleId_verzija_key" ON "EngineeringRuleVersion"("ruleId", "verzija");
CREATE INDEX "EngineeringRuleVersion_status_idx" ON "EngineeringRuleVersion"("status");
CREATE INDEX "EngineeringRuleVersion_ruleId_status_idx" ON "EngineeringRuleVersion"("ruleId", "status");
CREATE INDEX "EngineeringRuleVersion_vir_idx" ON "EngineeringRuleVersion"("vir");
CREATE INDEX "EngineeringRuleVersion_overitev_idx" ON "EngineeringRuleVersion"("overitev");

-- AddForeignKey
ALTER TABLE "EngineeringRule" ADD CONSTRAINT "EngineeringRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EngineeringRuleVersion" ADD CONSTRAINT "EngineeringRuleVersion_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "EngineeringRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateConstraint: CHECK omejitve (domene + statusni stroj; takoj VALIDIRANE)
ALTER TABLE "EngineeringRule" ADD CONSTRAINT "engineering_rule_kategorija_allowed"
  CHECK ("kategorija" IN ('MONTAZA', 'RAZMAK', 'MATERIAL', 'OBREMENITEV', 'GEOMETRIJA'));
ALTER TABLE "EngineeringRule" ADD CONSTRAINT "engineering_rule_aplikacija_allowed"
  CHECK ("aplikacija" IS NULL OR "aplikacija" IN ('HORIZONTALNA_OGRAJA', 'POKONCNA_OGRAJA', 'TERASA', 'PREDELNA_STENA', 'FASADA', 'STROP'));
ALTER TABLE "EngineeringRule" ADD CONSTRAINT "engineering_rule_orientacija_allowed"
  CHECK ("orientacija" IS NULL OR "orientacija" IN ('horizontal', 'vertical'));
ALTER TABLE "EngineeringRuleVersion" ADD CONSTRAINT "erv_status_allowed"
  CHECK ("status" IN ('DRAFT', 'ACTIVE', 'RETIRED'));
ALTER TABLE "EngineeringRuleVersion" ADD CONSTRAINT "erv_vir_allowed"
  CHECK ("vir" IN ('KATALOG_PROIZVAJALCA', 'URADNI_STANDARD', 'INTERNI_INZENIRING', 'SEKUNDARNI_VIR'));
ALTER TABLE "EngineeringRuleVersion" ADD CONSTRAINT "erv_overitev_allowed"
  CHECK ("overitev" IN ('INFORMATIVNO', 'PROJEKTANTSKA', 'STATISTICNA'));
ALTER TABLE "EngineeringRuleVersion" ADD CONSTRAINT "erv_veljavnost_interval"
  CHECK ("veljavnostDo" IS NULL OR "veljavnostDo" > "veljavnostOd");
-- §15 LOČITEV na ravni BAZE: uradna overitev BREZ pregleda = zavrnjena vrstica.
ALTER TABLE "EngineeringRuleVersion" ADD CONSTRAINT "erv_uradno_zahteva_pregled"
  CHECK ("overitev" = 'INFORMATIVNO' OR ("reviewedAt" IS NOT NULL AND "reviewerId" IS NOT NULL));

-- Partial UNIQUE: natanko ENA ACTIVE verzija na pravilo — zadnja linija
-- za vzporedne zapise (prva je store-plast z 409 v isti transakciji).
CREATE UNIQUE INDEX "EngineeringRuleVersion_rule_active_key"
  ON "EngineeringRuleVersion"("ruleId") WHERE "status" = 'ACTIVE';


-- ============================================================================
-- SEED — izključno iz data/roksal-catalog.json + dokumentiranih konstant
-- src/lib/calculator.ts (generator: scripts/r393-seed-sql-gen.mjs —
-- byte-exact citati, brez ročnega prepisovanja). Deterministični id-ji +
-- ON CONFLICT DO NOTHING (kanon R374/R390). VSA verzija 1 = ACTIVE,
-- overitev INFORMATIVNO, reviewedAt/reviewerId NULL (§8 honest — NIČ
-- dokumentiranih virov NI uradno preverjeno s strani projektanta/statika).
-- ============================================================================
-- Splošna pravila montaže (9) — byte-exact citati generalMountingRules;
-- calculatorVerzija NULL = ročna navodila (NE porablja jih kalkulator);
-- standardReferenca NULL = katalog NE citira standardov (§8 — NE izmišljamo).
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-mont-splosno-01', 'MONT-SPLOSNO-01', 'Predvrtanje vseh profilov', 'MONTAZA', NULL, NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-mont-splosno-01-1', 'rule-mont-splosno-01', 1, 'ACTIVE', 'Predvrtanje je obvezno pri VSEH profilih (luknja 1 mm večja od vijaka)', NULL, 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); generalMountingRules[0]', NULL, NULL, NULL, 'INFORMATIVNO', NULL, CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-mont-splosno-02', 'MONT-SPLOSNO-02', 'Minimalni odmik vijaka od reza', 'MONTAZA', NULL, NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-mont-splosno-02-1', 'rule-mont-splosno-02', 1, 'ACTIVE', 'Minimalen odmik vijaka od roba reza: 3 cm', NULL, 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); generalMountingRules[1]', NULL, NULL, NULL, 'INFORMATIVNO', NULL, CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-mont-splosno-03', 'MONT-SPLOSNO-03', 'Odmik vijaka — konstrukcija na plošči', 'MONTAZA', NULL, NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-mont-splosno-03-1', 'rule-mont-splosno-03', 1, 'ACTIVE', 'Konstrukcija na plošči (balkon/dvorišče): maksimalen odmik vijaka od roba reza 15 cm', NULL, 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); generalMountingRules[2]', NULL, NULL, NULL, 'INFORMATIVNO', NULL, CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-mont-splosno-04', 'MONT-SPLOSNO-04', 'Odmik vijaka — bočna montaža na ploč', 'MONTAZA', NULL, NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-mont-splosno-04-1', 'rule-mont-splosno-04', 1, 'ACTIVE', 'Bočna montaža na ploč (balkon): maksimalen odmik vijaka od roba reza 10 cm', NULL, 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); generalMountingRules[3]', NULL, NULL, NULL, 'INFORMATIVNO', NULL, CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-mont-splosno-05', 'MONT-SPLOSNO-05', 'Odstranitev obstoječih varjenih delov', 'MONTAZA', NULL, NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-mont-splosno-05-1', 'rule-mont-splosno-05', 1, 'ACTIVE', 'Obstoječi varjeni deli na stebrih se odstranijo (niso primerni za vijačenje)', NULL, 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); generalMountingRules[4]', NULL, NULL, NULL, 'INFORMATIVNO', NULL, CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-mont-splosno-06', 'MONT-SPLOSNO-06', 'Spajanje desk na dolžino', 'MONTAZA', NULL, NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-mont-splosno-06-1', 'rule-mont-splosno-06', 1, 'ACTIVE', 'Deske se spajajo na dolžino OBVEZNO na stebru', NULL, 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); generalMountingRules[5]', NULL, NULL, NULL, 'INFORMATIVNO', NULL, CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-mont-splosno-07', 'MONT-SPLOSNO-07', 'Ravnina stebrov', 'MONTAZA', NULL, NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-mont-splosno-07-1', 'rule-mont-splosno-07', 1, 'ACTIVE', 'Stebri morajo biti v ravnini — deska se prilagodi ravnini konstrukcije', NULL, 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); generalMountingRules[6]', NULL, NULL, NULL, 'INFORMATIVNO', NULL, CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-razmak-deske-splosno', 'RAZMAK-DESKE-SPLOSNO', 'Priporočen razmak med deskami', 'RAZMAK', NULL, NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-razmak-deske-splosno-1', 'rule-razmak-deske-splosno', 1, 'ACTIVE', 'Priporočen razmak med deskami 0,2–3 cm (FAQ); možno prekrivanje desk — montaža iz obeh strani', NULL, 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); generalMountingRules[7]', NULL, NULL, NULL, 'INFORMATIVNO', NULL, CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-material-wpc-odtennek', 'MATERIAL-WPC-ODTENNEK', 'WPC barvni odtenek — staranje', 'MATERIAL', NULL, NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-material-wpc-odtennek-1', 'rule-material-wpc-odtennek', 1, 'ACTIVE', 'WPC barvni odtenek s leti posvetli 5–10 % (sekundaren vir: montaze-mlakar.si)', NULL, 'SEKUNDARNI_VIR', 'sekundaren vir: montaze-mlakar.si (citirano v data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); generalMountingRules[8])', NULL, NULL, NULL, 'INFORMATIVNO', NULL, CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
-- Produktni razmaki (23) — byte-exact iz zapisov profilov; struktura
-- {maxSpacingMm}/{minMm,maxMm}; calculatorVerzija sdk-S+8 = porablja
-- Product SDK geometry (src/lib/product-sdk/rules.ts resolve*); KUBO
-- pokončno BREZ maxPostSpacing → BREZ pravila (odkrito — SDK zahteva
-- eksplicitne pozicije, kanon S+8.1 §3).
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-razmak-podstebri-h-woodcore-romb-67', 'RAZMAK-PODSTEBRI-H-woodcore-romb-67', 'Max razmak stebrov (prečno) — ROMB DESKA-67', 'RAZMAK', NULL, 'prod-woodcore-romb-67', 'horizontal', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-razmak-podstebri-h-woodcore-romb-67-1', 'rule-razmak-podstebri-h-woodcore-romb-67', 1, 'ACTIVE', 'Max razmak stebrov (prečno) — ROMB DESKA-67 — katalog proizvajalca dokumentira: maxPostSpacingMm.horizontal = 1450 mm (vir porablja Product SDK geometry)', '{"maxSpacingMm":1450}', 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); maxPostSpacingMm.horizontal = 1450 mm', NULL, NULL, NULL, 'INFORMATIVNO', 'sdk-S+8', CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-razmak-podcevi-v-woodcore-romb-67', 'RAZMAK-PODCEVI-V-woodcore-romb-67', 'Max razmak cevi (pokončno) — ROMB DESKA-67', 'RAZMAK', NULL, 'prod-woodcore-romb-67', 'vertical', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-razmak-podcevi-v-woodcore-romb-67-1', 'rule-razmak-podcevi-v-woodcore-romb-67', 1, 'ACTIVE', 'Max razmak cevi (pokončno) — ROMB DESKA-67 — katalog proizvajalca dokumentira: maxRailSpacingMm.vertical = 1100 mm (vir porablja Product SDK geometry)', '{"maxSpacingMm":1100}', 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); maxRailSpacingMm.vertical = 1100 mm', NULL, NULL, NULL, 'INFORMATIVNO', 'sdk-S+8', CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-razmak-poddeskami-woodcore-romb-67', 'RAZMAK-PODDESKAMI-woodcore-romb-67', 'Priporočen razmak med deskami — ROMB DESKA-67', 'RAZMAK', NULL, 'prod-woodcore-romb-67', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-razmak-poddeskami-woodcore-romb-67-1', 'rule-razmak-poddeskami-woodcore-romb-67', 1, 'ACTIVE', 'Priporočen razmak med deskami — ROMB DESKA-67 — katalog proizvajalca dokumentira: recommendedGapMm = 2–30 mm (vir porablja Product SDK geometry)', '{"minMm":2,"maxMm":30}', 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); recommendedGapMm = 2–30 mm', NULL, NULL, NULL, 'INFORMATIVNO', 'sdk-S+8', CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-razmak-podstebri-h-woodcore-polna-128', 'RAZMAK-PODSTEBRI-H-woodcore-polna-128', 'Max razmak stebrov (prečno) — POLNA DESKA-128', 'RAZMAK', NULL, 'prod-woodcore-polna-128', 'horizontal', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-razmak-podstebri-h-woodcore-polna-128-1', 'rule-razmak-podstebri-h-woodcore-polna-128', 1, 'ACTIVE', 'Max razmak stebrov (prečno) — POLNA DESKA-128 — katalog proizvajalca dokumentira: maxPostSpacingMm.horizontal = 1100 mm (vir porablja Product SDK geometry)', '{"maxSpacingMm":1100}', 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); maxPostSpacingMm.horizontal = 1100 mm', NULL, NULL, NULL, 'INFORMATIVNO', 'sdk-S+8', CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-razmak-podstebri-v-woodcore-polna-128', 'RAZMAK-PODSTEBRI-V-woodcore-polna-128', 'Max razmak stebrov (pokončno) — POLNA DESKA-128', 'RAZMAK', NULL, 'prod-woodcore-polna-128', 'vertical', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-razmak-podstebri-v-woodcore-polna-128-1', 'rule-razmak-podstebri-v-woodcore-polna-128', 1, 'ACTIVE', 'Max razmak stebrov (pokončno) — POLNA DESKA-128 — katalog proizvajalca dokumentira: maxPostSpacingMm.vertical = 1800 mm (vir porablja Product SDK geometry)', '{"maxSpacingMm":1800}', 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); maxPostSpacingMm.vertical = 1800 mm', NULL, NULL, NULL, 'INFORMATIVNO', 'sdk-S+8', CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-razmak-podcevi-v-woodcore-polna-128', 'RAZMAK-PODCEVI-V-woodcore-polna-128', 'Max razmak cevi (pokončno) — POLNA DESKA-128', 'RAZMAK', NULL, 'prod-woodcore-polna-128', 'vertical', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-razmak-podcevi-v-woodcore-polna-128-1', 'rule-razmak-podcevi-v-woodcore-polna-128', 1, 'ACTIVE', 'Max razmak cevi (pokončno) — POLNA DESKA-128 — katalog proizvajalca dokumentira: maxRailSpacingMm.vertical = 1000 mm (vir porablja Product SDK geometry)', '{"maxSpacingMm":1000}', 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); maxRailSpacingMm.vertical = 1000 mm', NULL, NULL, NULL, 'INFORMATIVNO', 'sdk-S+8', CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-razmak-poddeskami-woodcore-polna-128', 'RAZMAK-PODDESKAMI-woodcore-polna-128', 'Priporočen razmak med deskami — POLNA DESKA-128', 'RAZMAK', NULL, 'prod-woodcore-polna-128', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-razmak-poddeskami-woodcore-polna-128-1', 'rule-razmak-poddeskami-woodcore-polna-128', 1, 'ACTIVE', 'Priporočen razmak med deskami — POLNA DESKA-128 — katalog proizvajalca dokumentira: recommendedGapMm = 5–30 mm (vir porablja Product SDK geometry)', '{"minMm":5,"maxMm":30}', 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); recommendedGapMm = 5–30 mm', NULL, NULL, NULL, 'INFORMATIVNO', 'sdk-S+8', CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-razmak-podstebri-h-woodcore-deska-150', 'RAZMAK-PODSTEBRI-H-woodcore-deska-150', 'Max razmak stebrov (prečno) — DESKA-150 (terasna)', 'RAZMAK', NULL, 'prod-woodcore-deska-150', 'horizontal', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-razmak-podstebri-h-woodcore-deska-150-1', 'rule-razmak-podstebri-h-woodcore-deska-150', 1, 'ACTIVE', 'Max razmak stebrov (prečno) — DESKA-150 (terasna) — katalog proizvajalca dokumentira: maxPostSpacingMm.horizontal = 1330 mm (vir porablja Product SDK geometry)', '{"maxSpacingMm":1330}', 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); maxPostSpacingMm.horizontal = 1330 mm', NULL, NULL, NULL, 'INFORMATIVNO', 'sdk-S+8', CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-razmak-poddeskami-woodcore-deska-150', 'RAZMAK-PODDESKAMI-woodcore-deska-150', 'Priporočen razmak med deskami — DESKA-150 (terasna)', 'RAZMAK', NULL, 'prod-woodcore-deska-150', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-razmak-poddeskami-woodcore-deska-150-1', 'rule-razmak-poddeskami-woodcore-deska-150', 1, 'ACTIVE', 'Priporočen razmak med deskami — DESKA-150 (terasna) — katalog proizvajalca dokumentira: recommendedGapMm = 2–30 mm (vir porablja Product SDK geometry)', '{"minMm":2,"maxMm":30}', 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); recommendedGapMm = 2–30 mm', NULL, NULL, NULL, 'INFORMATIVNO', 'sdk-S+8', CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-razmak-podstebri-v-woodcore-polna-57-32', 'RAZMAK-PODSTEBRI-V-woodcore-polna-57-32', 'Max razmak stebrov (pokončno) — POLNA DESKA-57/32', 'RAZMAK', NULL, 'prod-woodcore-polna-57-32', 'vertical', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-razmak-podstebri-v-woodcore-polna-57-32-1', 'rule-razmak-podstebri-v-woodcore-polna-57-32', 1, 'ACTIVE', 'Max razmak stebrov (pokončno) — POLNA DESKA-57/32 — katalog proizvajalca dokumentira: maxPostSpacingMm.vertical = 1500 mm (vir porablja Product SDK geometry)', '{"maxSpacingMm":1500}', 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); maxPostSpacingMm.vertical = 1500 mm', NULL, NULL, NULL, 'INFORMATIVNO', 'sdk-S+8', CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-razmak-podcevi-v-woodcore-polna-57-32', 'RAZMAK-PODCEVI-V-woodcore-polna-57-32', 'Max razmak cevi (pokončno) — POLNA DESKA-57/32', 'RAZMAK', NULL, 'prod-woodcore-polna-57-32', 'vertical', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-razmak-podcevi-v-woodcore-polna-57-32-1', 'rule-razmak-podcevi-v-woodcore-polna-57-32', 1, 'ACTIVE', 'Max razmak cevi (pokončno) — POLNA DESKA-57/32 — katalog proizvajalca dokumentira: maxRailSpacingMm.vertical = 1000 mm (vir porablja Product SDK geometry)', '{"maxSpacingMm":1000}', 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); maxRailSpacingMm.vertical = 1000 mm', NULL, NULL, NULL, 'INFORMATIVNO', 'sdk-S+8', CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-razmak-poddeskami-woodcore-polna-57-32', 'RAZMAK-PODDESKAMI-woodcore-polna-57-32', 'Priporočen razmak med deskami — POLNA DESKA-57/32', 'RAZMAK', NULL, 'prod-woodcore-polna-57-32', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-razmak-poddeskami-woodcore-polna-57-32-1', 'rule-razmak-poddeskami-woodcore-polna-57-32', 1, 'ACTIVE', 'Priporočen razmak med deskami — POLNA DESKA-57/32 — katalog proizvajalca dokumentira: recommendedGapMm = 2–30 mm (vir porablja Product SDK geometry)', '{"minMm":2,"maxMm":30}', 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); recommendedGapMm = 2–30 mm', NULL, NULL, NULL, 'INFORMATIVNO', 'sdk-S+8', CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-razmak-podstebri-v-woodcore-polna-100', 'RAZMAK-PODSTEBRI-V-woodcore-polna-100', 'Max razmak stebrov (pokončno) — POLNA DESKA-100', 'RAZMAK', NULL, 'prod-woodcore-polna-100', 'vertical', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-razmak-podstebri-v-woodcore-polna-100-1', 'rule-razmak-podstebri-v-woodcore-polna-100', 1, 'ACTIVE', 'Max razmak stebrov (pokončno) — POLNA DESKA-100 — katalog proizvajalca dokumentira: maxPostSpacingMm.vertical = 1800 mm (vir porablja Product SDK geometry)', '{"maxSpacingMm":1800}', 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); maxPostSpacingMm.vertical = 1800 mm', NULL, NULL, NULL, 'INFORMATIVNO', 'sdk-S+8', CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-razmak-podcevi-v-woodcore-polna-100', 'RAZMAK-PODCEVI-V-woodcore-polna-100', 'Max razmak cevi (pokončno) — POLNA DESKA-100', 'RAZMAK', NULL, 'prod-woodcore-polna-100', 'vertical', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-razmak-podcevi-v-woodcore-polna-100-1', 'rule-razmak-podcevi-v-woodcore-polna-100', 1, 'ACTIVE', 'Max razmak cevi (pokončno) — POLNA DESKA-100 — katalog proizvajalca dokumentira: maxRailSpacingMm.vertical = 800 mm (vir porablja Product SDK geometry)', '{"maxSpacingMm":800}', 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); maxRailSpacingMm.vertical = 800 mm', NULL, NULL, NULL, 'INFORMATIVNO', 'sdk-S+8', CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-razmak-poddeskami-woodcore-polna-100', 'RAZMAK-PODDESKAMI-woodcore-polna-100', 'Priporočen razmak med deskami — POLNA DESKA-100', 'RAZMAK', NULL, 'prod-woodcore-polna-100', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-razmak-poddeskami-woodcore-polna-100-1', 'rule-razmak-poddeskami-woodcore-polna-100', 1, 'ACTIVE', 'Priporočen razmak med deskami — POLNA DESKA-100 — katalog proizvajalca dokumentira: recommendedGapMm = 5–30 mm (vir porablja Product SDK geometry)', '{"minMm":5,"maxMm":30}', 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); recommendedGapMm = 5–30 mm', NULL, NULL, NULL, 'INFORMATIVNO', 'sdk-S+8', CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-razmak-podstebri-v-woodcore-polna-128-vertical', 'RAZMAK-PODSTEBRI-V-woodcore-polna-128-vertical', 'Max razmak stebrov (pokončno) — POLNA DESKA-128 (pokončno)', 'RAZMAK', NULL, 'prod-woodcore-polna-128-vertical', 'vertical', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-razmak-podstebri-v-woodcore-polna-128-vertical-1', 'rule-razmak-podstebri-v-woodcore-polna-128-vertical', 1, 'ACTIVE', 'Max razmak stebrov (pokončno) — POLNA DESKA-128 (pokončno) — katalog proizvajalca dokumentira: maxPostSpacingMm.vertical = 1800 mm (vir porablja Product SDK geometry)', '{"maxSpacingMm":1800}', 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); maxPostSpacingMm.vertical = 1800 mm', NULL, NULL, NULL, 'INFORMATIVNO', 'sdk-S+8', CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-razmak-podcevi-v-woodcore-polna-128-vertical', 'RAZMAK-PODCEVI-V-woodcore-polna-128-vertical', 'Max razmak cevi (pokončno) — POLNA DESKA-128 (pokončno)', 'RAZMAK', NULL, 'prod-woodcore-polna-128-vertical', 'vertical', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-razmak-podcevi-v-woodcore-polna-128-vertical-1', 'rule-razmak-podcevi-v-woodcore-polna-128-vertical', 1, 'ACTIVE', 'Max razmak cevi (pokončno) — POLNA DESKA-128 (pokončno) — katalog proizvajalca dokumentira: maxRailSpacingMm.vertical = 1000 mm (vir porablja Product SDK geometry)', '{"maxSpacingMm":1000}', 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); maxRailSpacingMm.vertical = 1000 mm', NULL, NULL, NULL, 'INFORMATIVNO', 'sdk-S+8', CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-razmak-poddeskami-woodcore-polna-128-vertical', 'RAZMAK-PODDESKAMI-woodcore-polna-128-vertical', 'Priporočen razmak med deskami — POLNA DESKA-128 (pokončno)', 'RAZMAK', NULL, 'prod-woodcore-polna-128-vertical', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-razmak-poddeskami-woodcore-polna-128-vertical-1', 'rule-razmak-poddeskami-woodcore-polna-128-vertical', 1, 'ACTIVE', 'Priporočen razmak med deskami — POLNA DESKA-128 (pokončno) — katalog proizvajalca dokumentira: recommendedGapMm = 5–30 mm (vir porablja Product SDK geometry)', '{"minMm":5,"maxMm":30}', 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); recommendedGapMm = 5–30 mm', NULL, NULL, NULL, 'INFORMATIVNO', 'sdk-S+8', CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-razmak-podstebri-v-woodcore-romb-67-vertical', 'RAZMAK-PODSTEBRI-V-woodcore-romb-67-vertical', 'Max razmak stebrov (pokončno) — ROMB DESKA-67 (pokončno)', 'RAZMAK', NULL, 'prod-woodcore-romb-67-vertical', 'vertical', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-razmak-podstebri-v-woodcore-romb-67-vertical-1', 'rule-razmak-podstebri-v-woodcore-romb-67-vertical', 1, 'ACTIVE', 'Max razmak stebrov (pokončno) — ROMB DESKA-67 (pokončno) — katalog proizvajalca dokumentira: maxPostSpacingMm.vertical = 1450 mm (vir porablja Product SDK geometry)', '{"maxSpacingMm":1450}', 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); maxPostSpacingMm.vertical = 1450 mm', NULL, NULL, NULL, 'INFORMATIVNO', 'sdk-S+8', CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-razmak-podcevi-v-woodcore-romb-67-vertical', 'RAZMAK-PODCEVI-V-woodcore-romb-67-vertical', 'Max razmak cevi (pokončno) — ROMB DESKA-67 (pokončno)', 'RAZMAK', NULL, 'prod-woodcore-romb-67-vertical', 'vertical', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-razmak-podcevi-v-woodcore-romb-67-vertical-1', 'rule-razmak-podcevi-v-woodcore-romb-67-vertical', 1, 'ACTIVE', 'Max razmak cevi (pokončno) — ROMB DESKA-67 (pokončno) — katalog proizvajalca dokumentira: maxRailSpacingMm.vertical = 1100 mm (vir porablja Product SDK geometry)', '{"maxSpacingMm":1100}', 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); maxRailSpacingMm.vertical = 1100 mm', NULL, NULL, NULL, 'INFORMATIVNO', 'sdk-S+8', CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-razmak-poddeskami-woodcore-romb-67-vertical', 'RAZMAK-PODDESKAMI-woodcore-romb-67-vertical', 'Priporočen razmak med deskami — ROMB DESKA-67 (pokončno)', 'RAZMAK', NULL, 'prod-woodcore-romb-67-vertical', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-razmak-poddeskami-woodcore-romb-67-vertical-1', 'rule-razmak-poddeskami-woodcore-romb-67-vertical', 1, 'ACTIVE', 'Priporočen razmak med deskami — ROMB DESKA-67 (pokončno) — katalog proizvajalca dokumentira: recommendedGapMm = 2–30 mm (vir porablja Product SDK geometry)', '{"minMm":2,"maxMm":30}', 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); recommendedGapMm = 2–30 mm', NULL, NULL, NULL, 'INFORMATIVNO', 'sdk-S+8', CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-razmak-podcevi-v-woodcore-kubo-80-42', 'RAZMAK-PODCEVI-V-woodcore-kubo-80-42', 'Max razmak cevi (pokončno) — KUBO DESKA-80/42', 'RAZMAK', NULL, 'prod-woodcore-kubo-80-42', 'vertical', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-razmak-podcevi-v-woodcore-kubo-80-42-1', 'rule-razmak-podcevi-v-woodcore-kubo-80-42', 1, 'ACTIVE', 'Max razmak cevi (pokončno) — KUBO DESKA-80/42 — katalog proizvajalca dokumentira: maxRailSpacingMm.vertical = 1000 mm (vir porablja Product SDK geometry)', '{"maxSpacingMm":1000}', 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); maxRailSpacingMm.vertical = 1000 mm', NULL, NULL, NULL, 'INFORMATIVNO', 'sdk-S+8', CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-razmak-poddeskami-woodcore-kubo-80-42', 'RAZMAK-PODDESKAMI-woodcore-kubo-80-42', 'Priporočen razmak med deskami — KUBO DESKA-80/42', 'RAZMAK', NULL, 'prod-woodcore-kubo-80-42', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-razmak-poddeskami-woodcore-kubo-80-42-1', 'rule-razmak-poddeskami-woodcore-kubo-80-42', 1, 'ACTIVE', 'Priporočen razmak med deskami — KUBO DESKA-80/42 — katalog proizvajalca dokumentira: recommendedGapMm = 2–60 mm (vir porablja Product SDK geometry)', '{"minMm":2,"maxMm":60}', 'KATALOG_PROIZVAJALCA', 'data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6; officialSite https://roksal.com/); recommendedGapMm = 2–60 mm', NULL, NULL, NULL, 'INFORMATIVNO', 'sdk-S+8', CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
-- Pravila iz calculator.ts (5) — INTERNI_INZENIRING; standardReferenca
-- TOČNO kot jo citira vir (NE popravljamo tiho — §15); NEDOSLEDNOSTI
-- (110 mm vs krogla 100 mm; "SIST EN" brez številke; EVS namesto SIST)
-- odkrito zabeležene v vsebini; overitev INFORMATIVNO + reviewedAt NULL.
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-razmik-odprine-110', 'RAZMIK-ODPRINE-110', 'Max odprina med palicami (110 mm)', 'RAZMAK', NULL, NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-razmik-odprine-110-1', 'rule-razmik-odprine-110', 1, 'ACTIVE', 'Razmik med palicami (odprina) ≤ 110 mm — vir citira "SIST EN 1264" z utemeljitvijo "krogla 100mm ne sme pastiti". NEDOSLEDNOST odkrito zabeležena: krogla ⌀100 mm BI padla skozi odprino 110 mm — citirana referenca in vrednost se NE ujemata z utemeljitvijo; referenca NI preverjena (§15).', '{"maxGapMm":110,"utemeljitevKroglaMm":100}', 'INTERNI_INZENIRING', 'src/lib/calculator.ts:581-592 (checkCompliance, maxGapAllowed = 110) — checkCompliance NIMA lastne verzije formule (calc-engineering R150 verzionira samo railing/anchoring/wind ovojnice)', 'SIST EN 1264', NULL, NULL, 'INFORMATIVNO', NULL, CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-visina-ograje-1000', 'VISINA-OGRAJE-1000', 'Min višina ograje (1000 mm)', 'GEOMETRIJA', NULL, NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-visina-ograje-1000-1', 'rule-visina-ograje-1000', 1, 'ACTIVE', 'Višina ograje ≥ 1000 mm (balkoni, lože, terase in podobno — neodvisno od višine padca; nad 20 m: 1100 mm). Vir sam opozarja: "Vrednost je namenoma konservativna — preveri jo z veljavno zakonodajo in projektnimi pogoji."', '{"minHeightMm":1000,"minHeightAbove20mMm":1100}', 'INTERNI_INZENIRING', 'src/lib/calculator.ts:594-611 (checkCompliance, minHeight) — checkCompliance NIMA lastne verzije formule (calc-engineering R150 verzionira samo railing/anchoring/wind ovojnice)', 'Pravilnik o minimalnih tehničnih zahtevah za graditev stanovanjskih stavb', NULL, 'SI', 'INFORMATIVNO', NULL, CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-razmak-stebrov-1500', 'RAZMAK-STEBROV-1500', 'Max razmak stebrov (1500 mm)', 'RAZMAK', NULL, NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-razmak-stebrov-1500-1', 'rule-razmak-stebrov-1500', 1, 'ACTIVE', 'Razmak med stebri ≤ 1500 mm — vir NE imenuje standarda (komentar "(SIST EN)" BREZ številke — odkrito nezvezno). Izpis "Skladno statika stebrov" NE pomeni statične preverbe: statike NI bilo (§15 ločitev — informativno).', '{"maxPostSpacingMm":1500}', 'INTERNI_INZENIRING', 'src/lib/calculator.ts:613-624 (checkCompliance, maxPostSpacing = 1500) — checkCompliance NIMA lastne verzije formule (calc-engineering R150 verzionira samo railing/anchoring/wind ovojnice)', NULL, NULL, NULL, 'INFORMATIVNO', NULL, CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-obremenitev-horizontalna-knm', 'OBREMENITEV-HORIZONTALNA-KNM', 'Horizontalna obremenitev po kategorijah', 'OBREMENITEV', NULL, NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-obremenitev-horizontalna-knm-1', 'rule-obremenitev-horizontalna-knm', 1, 'ACTIVE', 'Horizontalna obremenitev: kategorija A = 0,74 kN/m (stanovanjsko), B = 1,0 kN/m (javno), C = 1,5 kN/m (intenzivno javno). Vir citira "EVS EN 1991-1-1" in IZRECNO priznava ločitev §15 v samem izpisu: "informativno — predpostavimo da statiko naredi odgovorni projektant".', '{"kategorijaAKnM":0.74,"kategorijaBKnM":1,"kategorijaCKnM":1.5}', 'INTERNI_INZENIRING', 'src/lib/calculator.ts:626-635 (checkCompliance, requiredLoad) — checkCompliance NIMA lastne verzije formule (calc-engineering R150 verzionira samo railing/anchoring/wind ovojnice)', 'EVS EN 1991-1-1', NULL, NULL, 'INFORMATIVNO', NULL, CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")
VALUES ('rule-veter-sist-1991-1-4', 'VETER-SIST-1991-1-4', 'Vetrni izračun po lokaciji (SI)', 'OBREMENITEV', NULL, NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")
VALUES ('rulever-veter-sist-1991-1-4-1', 'rule-veter-sist-1991-1-4', 1, 'ACTIVE', 'Vetrni izračun po lokaciji — vir citira "SIST EN 1991-1-4 NA Slovenija" in opozarja, da je določanje cone "poenostavljeno za Slovenijo"; terenske kategorije I–IV s faktorji 1,0 / 0,91 / 0,82 / 0,73.', '{"terenskiFaktorji":{"I":1,"II":0.91,"III":0.82,"IV":0.73}}', 'INTERNI_INZENIRING', 'src/lib/calculator.ts:927-971 (calculateWindLoadByLocation) + 139-140 (terrainFactors) — calculateWindLoadByLocation NIMA lastne verzije formule (calc-engineering R150 verzionira samo railing/anchoring/wind ovojnice)', 'SIST EN 1991-1-4', NULL, 'SI', 'INFORMATIVNO', NULL, CURRENT_TIMESTAMP, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
-- SKUPAJ: 37 pravil (9 splošnih + 23 produktnih + 5 kalkulatorjevih),
-- vsako s točno ENO verzijo 1 ACTIVE, overitev INFORMATIVNO,
-- reviewedAt/reviewerId NULL (§8 honest — uradne projektantske/statistične
-- preverbe ŠE NI — vpišejo se prek /api/engineering-rules z overitev
-- PROJEKTANTSKA/STATISTICNA + reviewerId + reviewedAt).
