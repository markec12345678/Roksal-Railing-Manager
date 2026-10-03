-- R390 (issue #13, korak R170 iz §14) — PRODUKTNI KATALOG:
-- APLIKACIJSKI KONTEKST.
--
-- Problem, ki ga ta migracija zapira (issue #13 §14):
--   • Product SDK je ostal "flat profile dropdown" — 8 profilov BREZ
--     aplikacijskega konteksta (za KAJ se profil sme uporabljati) in BREZ
--     hierarhije (družina/produkt/varianta/dodatek/kompatibilnost);
--   • pravila (dimenzije/orientacija/pritrditev/interna okrepitev/max razmaki/
--     vijaki/dodatki/kompatibilne komponente/dobavitelji/pravice/verzija
--     kataloga/veljavnostni datumi) so živela v data/roksal-catalog.json
--     (viz SDK — kanon §1 NE rušimo) in so se v UI-jih podvajala kot
--     hardcode (§14: "Ne hardcodirati teh pravil v več UI-jih").
--
-- Rešitev (vzorec R374/R376/R378/R382 — NOVE tabele, obstoječi temelji
-- ostajajo; viz ostane na JSON SDK, poslovni katalog dobi STRUKTURO):
--   ProductCatalogVersion — DRAFT|ACTIVE|RETIRED + veljavnostOd/Do (§14
--                          "catalog version" + "effective dates"; isti stroj
--                          kot PriceBookVersion R373 — aktivacija transakcijsko
--                          upokoji prejšnjo ACTIVE);
--   ProductFamily         — WoodCore: material/garancija/barvna paleta
--                          (JSON)/splošna pravila montaže (JSON)/pravice;
--   Product               — profil z dimenzijami/pritrditvijo/vijaki/interno
--                          okrepitvijo/razmaki po orientaciji (§14 vsa polja);
--   ProductApplication    — EKSPPLICITNI kontekst: HORIZONTALNA_OGRAJA|
--                          POKONCNA_OGRAJA|TERASA|PREDELNA_STENA|FASADA|STROP
--                          × horizontal|vertical; ODSOTNOST vrstice =
--                          aplikacija NI dokumentirana (fail-closed; KUBO:
--                          uradni vir dokumentira SAMO fasado — balkonska
--                          ograja odkrito NE dokumentirana);
--   ProductVariant        — barvne/površinske izvedbe (seed PRAZEN — §8:
--                          colorsCount je ŠTEVEC, ne enumeracija);
--   ProductAccessory      — čepi/letve/pokrovčki/ročaj/steber (EXACT id-ji
--                          iz kataloga);
--   ProductCompatibility  — kompatibilne komponente (cilj = PRODUKT ALI
--                          DODATEK — CHECK XOR natanko en; partial UNIQUE
--                          po ciljni vrsti; samo KATALOGOM DOKUMENTIRANI pari);
--   ProductSupplierMapping— produkt ↔ dobavitelj z veljavnostnim intervalom
--                          (seed PRAZEN — §8: katalog ne dokumentira
--                          dobaviteljskih preslikav).
--
-- Seed (vzorec R374 — deterministični id + ON CONFLICT DO NOTHING): vrednosti
-- so z GENERATORJEM scripts/r390-seed-sql-gen.mjs izpeljane IZKLJUČNO iz
-- data/roksal-catalog.json (byte-exact — brez ročnega prepisovanja; generator
-- JE dokaz sledljivosti). Interna okrepitev = true SAMO kjer fixing besedilo
-- dokumentira cev v sredini profila (romb ×2, kubo, polna-57-32); opis cita
-- vir. Aplikacijske vrstice izpeljane iz kategorije + posebnosti + (KUBO)
-- uradnega fasadnega vira; maxRazmakMm = maxPostSpacing zapisa (KUBO: 1000 =
-- "podkonstrukcija razmak do 100 cm" s fasadne strani). Kompatibilnost samo
-- iz besedila dodatkov/posebnosti (ročaj za POLNE profile + romb zaključek,
-- čep/letvica/steber za romb, pokrovček za terasno desko).
--
-- CHECK omejitve (takoj VELJAVNE — vzorec R374/R376/R378/R382):
--   • ProductCatalogVersion.status IN ('DRAFT','ACTIVE','RETIRED')
--     + veljavnostDo > veljavnostOd kadar prisoten;
--   • ProductFamily.pravice / Product.pravice IN ('pending','granted',
--     'rejected') — pariteta SDK RightsStatus;
--   • Product.kategorija IN ('precna','pokoncna','precna+pokoncna');
--     faceWidthMm > 0; thicknessMm > 0; gapMinMm ≥ 0 AND gapMaxMm ≥ gapMinMm;
--     maxPostSpacingH/V + maxRailSpacingV IS NULL OR > 0;
--   • ProductApplication.aplikacija IN (§14 EXACT 6) + orientacija IN
--     ('horizontal','vertical') + maxRazmakMm IS NULL OR > 0;
--   • ProductCompatibility XOR — natanko EN cilj (produkt ali dodatek).

-- CreateTable: verzija kataloga (§14 catalog version + effective dates)
CREATE TABLE "ProductCatalogVersion" (
    "id" TEXT NOT NULL,
    "verzija" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "veljavnostOd" TIMESTAMP(3) NOT NULL,
    "veljavnostDo" TIMESTAMP(3),
    "opomba" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "ProductCatalogVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable: družina produktov (§14 ProductFamily)
CREATE TABLE "ProductFamily" (
    "id" TEXT NOT NULL,
    "sifra" TEXT NOT NULL,
    "naziv" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "garancija" TEXT,
    "uradnaStran" TEXT,
    "barvnaPaletaJson" TEXT NOT NULL,
    "splosnaPravilaJson" TEXT NOT NULL,
    "pravice" TEXT NOT NULL,
    "aktivna" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable: produkt v aplikacijskem kontekstu (§14 Product)
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "catalogVersionId" TEXT NOT NULL,
    "sifra" TEXT NOT NULL,
    "naziv" TEXT NOT NULL,
    "kategorija" TEXT NOT NULL,
    "faceWidthMm" INTEGER NOT NULL,
    "thicknessMm" DECIMAL(8,2) NOT NULL,
    "standardLengthsJson" TEXT NOT NULL,
    "fixingMetoda" TEXT NOT NULL,
    "screwsVisible" BOOLEAN NOT NULL,
    "interniOkrepitev" BOOLEAN NOT NULL DEFAULT false,
    "okrepitevOpis" TEXT,
    "maxPostSpacingH" INTEGER,
    "maxPostSpacingV" INTEGER,
    "maxRailSpacingV" INTEGER,
    "razmakKvalifikatorjiJson" TEXT NOT NULL,
    "gapMinMm" INTEGER NOT NULL,
    "gapMaxMm" INTEGER NOT NULL,
    "rocajJson" TEXT NOT NULL,
    "posebnostiJson" TEXT NOT NULL,
    "pravice" TEXT NOT NULL,
    "viriJson" TEXT NOT NULL,
    "aktivna" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable: eksplicitni aplikacijski kontekst (§14 Application)
CREATE TABLE "ProductApplication" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "aplikacija" TEXT NOT NULL,
    "orientacija" TEXT NOT NULL,
    "maxRazmakMm" INTEGER,
    "vir" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable: varianta produkta (§14 ProductVariant)
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sifra" TEXT NOT NULL,
    "naziv" TEXT NOT NULL,
    "barvaId" TEXT,
    "barvaHex" TEXT,
    "povrsina" TEXT,
    "aktivna" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable: pritrditve/dodatki (§14 Fixing/Accessory)
CREATE TABLE "ProductAccessory" (
    "id" TEXT NOT NULL,
    "sifra" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "naziv" TEXT NOT NULL,
    "dimenzijeJson" TEXT,
    "notranjeMereJson" TEXT,
    "opis" TEXT,
    "aktivna" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAccessory_pkey" PRIMARY KEY ("id")
);

-- CreateTable: kompatibilne komponente (§14 Compatibility)
CREATE TABLE "ProductCompatibility" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kompatibilenProductId" TEXT,
    "kompatibilenDodatekId" TEXT,
    "opis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCompatibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable: preslikava na dobavitelja (§14 supplier mapping)
CREATE TABLE "ProductSupplierMapping" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "veljavnostOd" TIMESTAMP(3) NOT NULL,
    "veljavnostDo" TIMESTAMP(3),
    "opomba" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductSupplierMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (TOČNO zrcalijo @@index/@@unique iz prisma/schema.prisma)
CREATE UNIQUE INDEX "ProductCatalogVersion_verzija_key" ON "ProductCatalogVersion"("verzija");
CREATE INDEX "ProductCatalogVersion_status_idx" ON "ProductCatalogVersion"("status");
CREATE INDEX "ProductCatalogVersion_createdAt_idx" ON "ProductCatalogVersion"("createdAt");

CREATE UNIQUE INDEX "ProductFamily_sifra_key" ON "ProductFamily"("sifra");

CREATE UNIQUE INDEX "Product_sifra_key" ON "Product"("sifra");
CREATE INDEX "Product_familyId_idx" ON "Product"("familyId");
CREATE INDEX "Product_catalogVersionId_idx" ON "Product"("catalogVersionId");
CREATE INDEX "Product_kategorija_idx" ON "Product"("kategorija");

CREATE UNIQUE INDEX "ProductApplication_productId_aplikacija_orientacija_key" ON "ProductApplication"("productId", "aplikacija", "orientacija");
CREATE INDEX "ProductApplication_aplikacija_idx" ON "ProductApplication"("aplikacija");
CREATE INDEX "ProductApplication_orientacija_idx" ON "ProductApplication"("orientacija");

CREATE UNIQUE INDEX "ProductVariant_sifra_key" ON "ProductVariant"("sifra");
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

CREATE UNIQUE INDEX "ProductAccessory_sifra_key" ON "ProductAccessory"("sifra");
CREATE INDEX "ProductAccessory_familyId_idx" ON "ProductAccessory"("familyId");

CREATE INDEX "ProductCompatibility_productId_idx" ON "ProductCompatibility"("productId");
CREATE INDEX "ProductCompatibility_kompatibilenProductId_idx" ON "ProductCompatibility"("kompatibilenProductId");
CREATE INDEX "ProductCompatibility_kompatibilenDodatekId_idx" ON "ProductCompatibility"("kompatibilenDodatekId");

CREATE UNIQUE INDEX "ProductSupplierMapping_productId_supplierId_veljavnostOd_key" ON "ProductSupplierMapping"("productId", "supplierId", "veljavnostOd");
CREATE INDEX "ProductSupplierMapping_productId_idx" ON "ProductSupplierMapping"("productId");
CREATE INDEX "ProductSupplierMapping_supplierId_idx" ON "ProductSupplierMapping"("supplierId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "ProductFamily"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_catalogVersionId_fkey" FOREIGN KEY ("catalogVersionId") REFERENCES "ProductCatalogVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductApplication" ADD CONSTRAINT "ProductApplication_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductAccessory" ADD CONSTRAINT "ProductAccessory_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "ProductFamily"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductCompatibility" ADD CONSTRAINT "ProductCompatibility_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductCompatibility" ADD CONSTRAINT "ProductCompatibility_kompatibilenProductId_fkey" FOREIGN KEY ("kompatibilenProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductCompatibility" ADD CONSTRAINT "ProductCompatibility_kompatibilenDodatekId_fkey" FOREIGN KEY ("kompatibilenDodatekId") REFERENCES "ProductAccessory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductSupplierMapping" ADD CONSTRAINT "ProductSupplierMapping_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductSupplierMapping" ADD CONSTRAINT "ProductSupplierMapping_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateConstraint: CHECK omejitve (domene + statusni stroji; takoj VALIDIRANE)
ALTER TABLE "ProductCatalogVersion" ADD CONSTRAINT "pcv_status_allowed"
  CHECK ("status" IN ('DRAFT', 'ACTIVE', 'RETIRED'));
ALTER TABLE "ProductCatalogVersion" ADD CONSTRAINT "pcv_veljavnost_interval"
  CHECK ("veljavnostDo" IS NULL OR "veljavnostDo" > "veljavnostOd");
ALTER TABLE "ProductFamily" ADD CONSTRAINT "product_family_pravice_allowed"
  CHECK ("pravice" IN ('pending', 'granted', 'rejected'));
ALTER TABLE "Product" ADD CONSTRAINT "product_kategorija_allowed"
  CHECK ("kategorija" IN ('precna', 'pokoncna', 'precna+pokoncna'));
ALTER TABLE "Product" ADD CONSTRAINT "product_pravice_allowed"
  CHECK ("pravice" IN ('pending', 'granted', 'rejected'));
ALTER TABLE "Product" ADD CONSTRAINT "product_dimensions_positive"
  CHECK ("faceWidthMm" > 0 AND "thicknessMm" > 0);
ALTER TABLE "Product" ADD CONSTRAINT "product_gap_sensible"
  CHECK ("gapMinMm" >= 0 AND "gapMaxMm" >= "gapMinMm");
ALTER TABLE "Product" ADD CONSTRAINT "product_spacing_positive"
  CHECK (("maxPostSpacingH" IS NULL OR "maxPostSpacingH" > 0)
     AND ("maxPostSpacingV" IS NULL OR "maxPostSpacingV" > 0)
     AND ("maxRailSpacingV" IS NULL OR "maxRailSpacingV" > 0));
ALTER TABLE "ProductApplication" ADD CONSTRAINT "product_application_allowed"
  CHECK ("aplikacija" IN ('HORIZONTALNA_OGRAJA', 'POKONCNA_OGRAJA', 'TERASA', 'PREDELNA_STENA', 'FASADA', 'STROP'));
ALTER TABLE "ProductApplication" ADD CONSTRAINT "product_application_orientacija_allowed"
  CHECK ("orientacija" IN ('horizontal', 'vertical'));
ALTER TABLE "ProductApplication" ADD CONSTRAINT "product_application_maxrazmak_positive"
  CHECK ("maxRazmakMm" IS NULL OR "maxRazmakMm" > 0);
ALTER TABLE "ProductCompatibility" ADD CONSTRAINT "product_compatibility_exactly_one_target"
  CHECK (("kompatibilenProductId" IS NULL) <> ("kompatibilenDodatekId" IS NULL));
ALTER TABLE "ProductSupplierMapping" ADD CONSTRAINT "psm_veljavnost_interval"
  CHECK ("veljavnostDo" IS NULL OR "veljavnostDo" > "veljavnostOd");

-- Partial UNIQUE: kompatibilnost (produkt, cilj) po vrsti cilja — ZADNJA
-- linija za vzporedne zapise (prva je store-plast z 409 v isti transakciji).
CREATE UNIQUE INDEX "ProductCompatibility_product_target_key"
  ON "ProductCompatibility"("productId", "kompatibilenProductId") WHERE "kompatibilenProductId" IS NOT NULL;
CREATE UNIQUE INDEX "ProductCompatibility_product_dodatek_key"
  ON "ProductCompatibility"("productId", "kompatibilenDodatekId") WHERE "kompatibilenDodatekId" IS NOT NULL;

-- ============================================================================
-- SEED — izključno iz data/roksal-catalog.json (generator:
-- scripts/r390-seed-sql-gen.mjs — byte-exact vrednosti, brez ročnega
-- prepisovanja). Deterministični id-ji + ON CONFLICT DO NOTHING (kanon R374).
-- ============================================================================
-- Verzija kataloga v1 — seed; vir: data/roksal-catalog.json
-- (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil); retrievedAt 2026-09-23; sha256[0:16] c3414b0ee3b174e6).
INSERT INTO "ProductCatalogVersion" ("id", "verzija", "status", "veljavnostOd", "opomba", "createdAt")
VALUES ('katalog-v1', 1, 'ACTIVE', CURRENT_TIMESTAMP, 'Seed v1 — TOČNO iz data/roksal-catalog.json (round S+8 — REMOVE GENERATIVE FENCE MODEL + DETERMINISTIC PRODUCT SDK (katalog = edini vir produktnih pravil), retrievedAt 2026-09-23); pravice: Vse fotografije = rights: pending (avtor: Roksal d.o.o., dokazano dovoljenje NE obstaja). Uporaba SAMO interni development/evalvacija. Prepovedano: produkcijski katalog, trditve o komercialni uporabi. Glej evaluation/ROKSAL-ASSET-RIGHTS.md.', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
-- Družina: WoodCore (edina v katalogu; paleta + splošna pravila = družinska resnica).
INSERT INTO "ProductFamily" ("id", "sifra", "naziv", "material", "garancija", "uradnaStran", "barvnaPaletaJson", "splosnaPravilaJson", "pravice", "aktivna", "createdAt", "updatedAt")
VALUES ('fam-woodcore', 'woodcore', 'WoodCore', 'WPC lesni kompozit (bambusova vlakna + HDPE)', '15 let', 'https://roksal.com/', '[{"id":"amazon-wood","name":"Amazon Wood","nameSl":"Amazon les","approxHex":null,"evidence":"reference-wpc-deske: ''Ograja s terasnimi deskami Amazon Wood''; datoteka wpc-woodcore-romb-amazon-precna-ograja2.jpg"},{"id":"ash-wood","name":"Ash Wood","nameSl":"Jesen","approxHex":null,"evidence":"reference-wpc-deske: ''Pokončna ograja širine 10 cm v odtenku Ash Wood''; terasna-ash-precna-ograja-vir3.jpg"},{"id":"burma-teak","name":"Burma Teak","nameSl":"Burma tik","approxHex":null,"evidence":"reference-wpc-deske: ''Pokončna ograja ... profilom polna 100 v odtenku Burma Teak (Knezdol/Trotovnik, 2022)''; ''Terasa v odtenku Burma Teak''"},{"id":"golden","name":"Golden Teak","nameSl":"Zlati tik","approxHex":null,"evidence":"datoteka wpc-woodcore-romb-golden-precna-ograja-or1.jpg (točno uradno ime odtenka je v paletni sliki — pravice pending)"},{"id":"rustic-oak","name":"Rustic Oak","nameSl":"Rustikni hrast","approxHex":null,"evidence":"reference-wpc-deske: ''Fasada v odtenku Rustic Oak''; precna-okraja-rustik-oak2.jpg; večbarvni videz — odtenek variira med serijami"},{"id":"rustic-walnut","name":"Rustic Walnut","nameSl":"Rustikni oreh","approxHex":null,"evidence":"reference-wpc-deske: ''Terasa v odtenku Rustic Walnut (Pizzeria Olivia Trzin, 2026)''; večbarvni videz"},{"id":"grey","name":"Grey","nameSl":"Siva","approxHex":null,"evidence":"alt: ''WPC balkonska ograja v sivem odtenku''"},{"id":"charcoal","name":"Charcoal / Antracit","nameSl":"Antracit","approxHex":null,"evidence":"alt: ''WPC polna deska za ograjo v antracit odtenku''; obstoječi projekt roksal-catalog-data.ts: WOODCORE_CHARCOAL"},{"id":"white","name":"White","nameSl":"Bela","approxHex":null,"evidence":"alt: ''Dvoriščna ograja z WPC deskami v beli barvi''; ''Ročaj na zalogi samo še v WHITE odtenku''"}]', '["Predvrtanje je obvezno pri VSEH profilih (luknja 1 mm večja od vijaka)","Minimalen odmik vijaka od roba reza: 3 cm","Konstrukcija na plošči (balkon/dvorišče): maksimalen odmik vijaka od roba reza 15 cm","Bočna montaža na ploč (balkon): maksimalen odmik vijaka od roba reza 10 cm","Obstoječi varjeni deli na stebrih se odstranijo (niso primerni za vijačenje)","Deske se spajajo na dolžino OBVEZNO na stebru","Stebri morajo biti v ravnini — deska se prilagodi ravnini konstrukcije","Priporočen razmak med deskami 0,2–3 cm (FAQ); možno prekrivanje desk — montaža iz obeh strani","WPC barvni odtenek s leti posvetli 5–10 % (sekundaren vir: montaze-mlakar.si)"]', 'pending', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
-- Produktni vrstice (8 profilov) — polja byte-exact iz kataloga;
-- razmakKvalifikatorji = NE-baza/h/v ključi maxPostSpacingMm zapisa.
INSERT INTO "Product" ("id", "familyId", "catalogVersionId", "sifra", "naziv", "kategorija", "faceWidthMm", "thicknessMm", "standardLengthsJson", "fixingMetoda", "screwsVisible", "interniOkrepitev", "okrepitevOpis", "maxPostSpacingH", "maxPostSpacingV", "maxRailSpacingV", "razmakKvalifikatorjiJson", "gapMinMm", "gapMaxMm", "rocajJson", "posebnostiJson", "pravice", "viriJson", "aktivna", "createdAt", "updatedAt")
VALUES ('prod-woodcore-romb-67', 'fam-woodcore', 'katalog-v1', 'woodcore-romb-67', 'ROMB DESKA-67', 'precna+pokoncna', 67, 26.00, '[5800]', 'RF (rostfrej) vijaki skozi L-kotnik na stebru v aluminijasto cev v sredini profila, pritrditev od zadnje strani', false, true, 'OBVEZNA aluminijasta cev v sredini romba — montaža brez nje NI mogoča (specialFeatures)', 1450, NULL, 1100, '[{"key":"horizontalWithMidConnection","maxSpacingMm":1800}]', 2, 30, '{"available":false,"note":"Ročaj 92×45×5800 (notranja 55×30) se uporablja kot vrhnji zaključek; samostojna prodaja ni možna"}', '["OBVEZNA aluminijasta cev v sredini romba — montaža brez nje NI mogoča (deska se kupi samo z alu cevjo, vključena v ceno)","Skrito vijačenje je mogoče IZKLJUČNO zaradi alu cevi","Predvrtanje obvezno: v romb 4,2–4,5 mm (vijak 3,9), v aluminij 3,2 mm — večja luknja v kompozitu zaradi raztezanja","Zaključek: levi/desni čep ALI letvica","Pokončno: pri razmaku med deskami je vidna alu cev — vsako desko zapreti s čepi ali rešiti v detajlu"]', 'pending', '["https://roksal.com/woodcore-wpc-deske/balkonske-ograje-in-dvoriscne-ograje/wpc-precna-ograja/","https://roksal.com/woodcore-wpc-deske/balkonske-ograje-in-dvoriscne-ograje/wpc-ograja-pokoncna/"]', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Product" ("id", "familyId", "catalogVersionId", "sifra", "naziv", "kategorija", "faceWidthMm", "thicknessMm", "standardLengthsJson", "fixingMetoda", "screwsVisible", "interniOkrepitev", "okrepitevOpis", "maxPostSpacingH", "maxPostSpacingV", "maxRailSpacingV", "razmakKvalifikatorjiJson", "gapMinMm", "gapMaxMm", "rocajJson", "posebnostiJson", "pravice", "viriJson", "aktivna", "createdAt", "updatedAt")
VALUES ('prod-woodcore-polna-128', 'fam-woodcore', 'katalog-v1', 'woodcore-polna-128', 'POLNA DESKA-128', 'precna+pokoncna', 128, 16.50, '[2200]', 'Vijačenje od spredaj — skozi desko v konstrukcijo (vidno na licu); vijak na sredini deske; predvrtanje obvezno (luknja 1 mm večja od vijaka)', true, false, NULL, 1100, 1800, 1000, '[{"key":"verticalOver150Cm","maxSpacingMm":1500}]', 5, 30, '{"available":true,"dimensionMm":[92,45,5800],"innerMm":[55,30],"screwsEveryMm":500,"screwsVisible":true,"maxSpliceMm":4000}', '["Polna deska za prečno IN pokončno ograjo","Desko se lahko zaokroži/obdeluje kot les","Priporočen razmak med deskami 0,5–3 cm; možno prekrivanje desk (montaža iz obeh strani)","V kovinsko cev: večja predvrtana luknja kot vijak (temperaturne razlike)"]', 'pending', '["https://roksal.com/woodcore-wpc-deske/balkonske-ograje-in-dvoriscne-ograje/wpc-precna-ograja/","https://roksal.com/woodcore-wpc-deske/balkonske-ograje-in-dvoriscne-ograje/wpc-ograja-pokoncna/"]', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Product" ("id", "familyId", "catalogVersionId", "sifra", "naziv", "kategorija", "faceWidthMm", "thicknessMm", "standardLengthsJson", "fixingMetoda", "screwsVisible", "interniOkrepitev", "okrepitevOpis", "maxPostSpacingH", "maxPostSpacingV", "maxRailSpacingV", "razmakKvalifikatorjiJson", "gapMinMm", "gapMaxMm", "rocajJson", "posebnostiJson", "pravice", "viriJson", "aktivna", "createdAt", "updatedAt")
VALUES ('prod-woodcore-deska-150', 'fam-woodcore', 'katalog-v1', 'woodcore-deska-150', 'DESKA-150 (terasna)', 'precna', 150, 25.00, '[4000,2200]', 'Vijaki od spredaj — skozi desko v konstrukcijo (vidni na licu); vijak na sredini deske kjer je rebro; predvrtanje obvezno (luknja 1 mm večja)', true, false, NULL, 1330, NULL, NULL, '[{"key":"horizontalUpperBound","maxSpacingMm":1400}]', 2, 30, '{"available":true,"dimensionMm":[92,45,5800],"innerMm":[55,30],"screwsEveryMm":500,"screwsVisible":true,"maxSpliceMm":4000}', '["Terasna deska KLASIK (rebrasta: ena stran gosto rebro, druga široko) / RUSTIK (ena stran popolnoma gladka, druga gosto rebričena, izgled staran les)","3 površine / 7 barvnih odtenkov","Zaključni pokrovček na voljo"]', 'pending', '["https://roksal.com/woodcore-wpc-deske/balkonske-ograje-in-dvoriscne-ograje/wpc-precna-ograja/"]', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Product" ("id", "familyId", "catalogVersionId", "sifra", "naziv", "kategorija", "faceWidthMm", "thicknessMm", "standardLengthsJson", "fixingMetoda", "screwsVisible", "interniOkrepitev", "okrepitevOpis", "maxPostSpacingH", "maxPostSpacingV", "maxRailSpacingV", "razmakKvalifikatorjiJson", "gapMinMm", "gapMaxMm", "rocajJson", "posebnostiJson", "pravice", "viriJson", "aktivna", "createdAt", "updatedAt")
VALUES ('prod-woodcore-polna-57-32', 'fam-woodcore', 'katalog-v1', 'woodcore-polna-57-32', 'POLNA DESKA-57/32', 'pokoncna', 57, 32.00, '[5800]', 'RF vijaki skozi cev iz zadnje strani — vijaki NISO vidni; vijak približno 2/3 globine profila; montirajo se na širino 57 mm ALI 32 mm (naleganje)', false, true, 'RF vijaki skozi cev iz zadnje strani — vijak približno 2/3 globine profila (fixing)', NULL, 1500, 1000, '[]', 2, 30, '{"available":true,"dimensionMm":[92,45,5800],"innerMm":[55,30],"screwsEveryMm":500,"screwsVisible":true,"maxSpliceMm":4000}', '["Posebnost: luknja v kompozitnem materialu MANJŠA od vijaka, v konstrukciji VEČJA (raztezanje materiala)","Estetsko lepši večji razmak (FAQ) — za zasebnost priporočajo drug profil"]', 'pending', '["https://roksal.com/woodcore-wpc-deske/balkonske-ograje-in-dvoriscne-ograje/wpc-ograja-pokoncna/"]', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Product" ("id", "familyId", "catalogVersionId", "sifra", "naziv", "kategorija", "faceWidthMm", "thicknessMm", "standardLengthsJson", "fixingMetoda", "screwsVisible", "interniOkrepitev", "okrepitevOpis", "maxPostSpacingH", "maxPostSpacingV", "maxRailSpacingV", "razmakKvalifikatorjiJson", "gapMinMm", "gapMaxMm", "rocajJson", "posebnostiJson", "pravice", "viriJson", "aktivna", "createdAt", "updatedAt")
VALUES ('prod-woodcore-polna-100', 'fam-woodcore', 'katalog-v1', 'woodcore-polna-100', 'POLNA DESKA-100', 'pokoncna', 100, 12.00, '[5800]', 'Vijačenje iz lica — vijaki vidni; v WoodCore desko zvrtati 1 mm večjo luknjo od vijaka', true, false, NULL, NULL, 1800, 800, '[{"key":"verticalOver150Cm","maxSpacingMm":1500}]', 5, 30, '{"available":true,"dimensionMm":[92,45,5800],"innerMm":[55,30],"screwsEveryMm":500,"screwsVisible":true,"maxSpliceMm":4000,"note":"Ročaj 95×45 na zalogi samo v WHITE; ostali v polnem profilu 92×45"}', '["Primerne SAMO za pokončno ograjo (ne za teraso/prečno)","Deska se lahko zaokroži ali obdeluje kot les","Priporočen razmak med deskami 0,5–3 cm; možno prekrivanje desk (montaža iz obeh strani)"]', 'pending', '["https://roksal.com/woodcore-wpc-deske/balkonske-ograje-in-dvoriscne-ograje/wpc-ograja-pokoncna/","https://roksal.com/reference-wpc-deske/"]', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Product" ("id", "familyId", "catalogVersionId", "sifra", "naziv", "kategorija", "faceWidthMm", "thicknessMm", "standardLengthsJson", "fixingMetoda", "screwsVisible", "interniOkrepitev", "okrepitevOpis", "maxPostSpacingH", "maxPostSpacingV", "maxRailSpacingV", "razmakKvalifikatorjiJson", "gapMinMm", "gapMaxMm", "rocajJson", "posebnostiJson", "pravice", "viriJson", "aktivna", "createdAt", "updatedAt")
VALUES ('prod-woodcore-polna-128-vertical', 'fam-woodcore', 'katalog-v1', 'woodcore-polna-128-vertical', 'POLNA DESKA-128 (pokončno)', 'pokoncna', 128, 16.00, '[2200]', 'Vijačenje iz lica — vijaki vidni; predvrtanje 1 mm večja luknja', true, false, NULL, NULL, 1800, 1000, '[{"key":"verticalOver150Cm","maxSpacingMm":1500}]', 5, 30, '{"available":true,"dimensionMm":[92,45,5800],"innerMm":[55,30],"screwsEveryMm":500,"screwsVisible":true,"maxSpliceMm":4000}', '["Isti fizični profil kot prečna varianta (16,5 mm debelina prečno / 16 mm pokončno po virih — toleranca zapisa)","Priporočen razmak 0,5–3 cm; možno prekrivanje"]', 'pending', '["https://roksal.com/woodcore-wpc-deske/balkonske-ograje-in-dvoriscne-ograje/wpc-ograja-pokoncna/"]', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Product" ("id", "familyId", "catalogVersionId", "sifra", "naziv", "kategorija", "faceWidthMm", "thicknessMm", "standardLengthsJson", "fixingMetoda", "screwsVisible", "interniOkrepitev", "okrepitevOpis", "maxPostSpacingH", "maxPostSpacingV", "maxRailSpacingV", "razmakKvalifikatorjiJson", "gapMinMm", "gapMaxMm", "rocajJson", "posebnostiJson", "pravice", "viriJson", "aktivna", "createdAt", "updatedAt")
VALUES ('prod-woodcore-romb-67-vertical', 'fam-woodcore', 'katalog-v1', 'woodcore-romb-67-vertical', 'ROMB DESKA-67 (pokončno)', 'pokoncna', 67, 26.00, '[5800]', 'Kotnik na vodoravni cevi, pritrditev skozi kotnik v alu cev v sredini romba od zadaj — vijak NI viden', false, true, 'Obvezna alu cev (kot prečna varianta) — pritrditev v alu cev v sredini romba od zadaj (specialFeatures + fixing)', NULL, 1450, 1100, '[]', 2, 30, '{"available":false}', '["Obvezna alu cev (kot prečna varianta)","Pokončno s razmaki: vidna alu cev — vsaka deska zaprta s čepi ali detajl konstrukcije"]', 'pending', '["https://roksal.com/woodcore-wpc-deske/balkonske-ograje-in-dvoriscne-ograje/wpc-ograja-pokoncna/"]', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Product" ("id", "familyId", "catalogVersionId", "sifra", "naziv", "kategorija", "faceWidthMm", "thicknessMm", "standardLengthsJson", "fixingMetoda", "screwsVisible", "interniOkrepitev", "okrepitevOpis", "maxPostSpacingH", "maxPostSpacingV", "maxRailSpacingV", "razmakKvalifikatorjiJson", "gapMinMm", "gapMaxMm", "rocajJson", "posebnostiJson", "pravice", "viriJson", "aktivna", "createdAt", "updatedAt")
VALUES ('prod-woodcore-kubo-80-42', 'fam-woodcore', 'katalog-v1', 'woodcore-kubo-80-42', 'KUBO DESKA-80/42', 'pokoncna', 80, 42.00, '[5800,5000]', 'Montažna ploščica privita z ZADNJE strani profila (vijaki NISO vidni); prva letvica pritrjena spodaj in zgoraj, naslednja se zadene za prejšnjo in se privije samo zgoraj; aluminijasta cev (surova ali eloksirana) v sredini profila', false, true, 'Alu cev v notranjosti (od leve proti desni): 20×60×2 mm, 25×25×2 mm, 20×20×2 mm (specialFeatures)', NULL, NULL, 1000, '[]', 2, 60, '{"available":false,"note":"Ročaj v fasadnem kontekstu ni omenjen; samostojna prodaja ni možna"}', '["S+8 §2 NOVO potrjen profil — uradni vir je FASADNA stran (proizvajalec dokumentira montažo SAMO vertikalno: ''Profil kubo se montira samo vertikalno''); uporaba kot balkonska ograja NI uradno dokumentirana — zabeleženo odkrito","Alu cev v notranjosti (od leve proti desni): 20×60×2 mm, 25×25×2 mm, 20×20×2 mm","Dolžina 5000 mm je na voljo SAMO za odtenka Amazon Wood in Rustic Walnut","Razmak med deskami pri fasadi: ''poljuben'' (uradni vir); profil se lahko obrača po želji (80 mm ali 42 mm ploskvica)","Podkonstrukcija (alu cevi) razmak do 100 cm","Facebook Roksal (2021): ''Profil je dimenzij 80x42mm in v tem primeru nalega deska na 42mm s 60mm razmakom. Odtenek: Oak Wood (na voljo tudi Amazon Wood)''"]', 'pending', '["https://roksal.com/woodcore-wpc-deske/wpc-deske-za-fasado/"]', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
-- Aplikacijske vrstice (§14 eksplicitni kontekst) — samo DOKUMENTIRANE
-- kombinacije; PREDELNA_STENA/STROP: noben produkt jih nima dokumentirane.
INSERT INTO "ProductApplication" ("id", "productId", "aplikacija", "orientacija", "maxRazmakMm", "vir", "createdAt")
VALUES ('app-01', 'prod-woodcore-romb-67', 'HORIZONTALNA_OGRAJA', 'horizontal', 1450, 'kategorija precna+pokoncna; maxPostSpacingMm.horizontal = 1450', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ProductApplication" ("id", "productId", "aplikacija", "orientacija", "maxRazmakMm", "vir", "createdAt")
VALUES ('app-02', 'prod-woodcore-romb-67', 'POKONCNA_OGRAJA', 'vertical', 1450, 'kategorija precna+pokoncna; maxPostSpacingMm.vertical = 1450', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ProductApplication" ("id", "productId", "aplikacija", "orientacija", "maxRazmakMm", "vir", "createdAt")
VALUES ('app-03', 'prod-woodcore-polna-128', 'HORIZONTALNA_OGRAJA', 'horizontal', 1100, 'kategorija precna+pokoncna; maxPostSpacingMm.horizontal = 1100', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ProductApplication" ("id", "productId", "aplikacija", "orientacija", "maxRazmakMm", "vir", "createdAt")
VALUES ('app-04', 'prod-woodcore-polna-128', 'POKONCNA_OGRAJA', 'vertical', 1800, 'kategorija precna+pokoncna; maxPostSpacingMm.vertical = 1800', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ProductApplication" ("id", "productId", "aplikacija", "orientacija", "maxRazmakMm", "vir", "createdAt")
VALUES ('app-05', 'prod-woodcore-deska-150', 'TERASA', 'horizontal', 1330, 'naziv "(terasna)"; posebnost "Terasna deska KLASIK/RUSTIK"; maxPostSpacingMm.horizontal = 1330', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ProductApplication" ("id", "productId", "aplikacija", "orientacija", "maxRazmakMm", "vir", "createdAt")
VALUES ('app-06', 'prod-woodcore-polna-57-32', 'POKONCNA_OGRAJA', 'vertical', 1500, 'kategorija pokoncna; maxPostSpacingMm.vertical = 1500', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ProductApplication" ("id", "productId", "aplikacija", "orientacija", "maxRazmakMm", "vir", "createdAt")
VALUES ('app-07', 'prod-woodcore-polna-100', 'POKONCNA_OGRAJA', 'vertical', 1800, 'posebnost "Primerne SAMO za pokončno ograjo (ne za teraso/prečno)"; maxPostSpacingMm.vertical = 1800', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ProductApplication" ("id", "productId", "aplikacija", "orientacija", "maxRazmakMm", "vir", "createdAt")
VALUES ('app-08', 'prod-woodcore-polna-128-vertical', 'POKONCNA_OGRAJA', 'vertical', 1800, 'kategorija pokoncna; maxPostSpacingMm.vertical = 1800', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ProductApplication" ("id", "productId", "aplikacija", "orientacija", "maxRazmakMm", "vir", "createdAt")
VALUES ('app-09', 'prod-woodcore-romb-67-vertical', 'POKONCNA_OGRAJA', 'vertical', 1450, 'kategorija pokoncna; maxPostSpacingMm.vertical = 1450', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ProductApplication" ("id", "productId", "aplikacija", "orientacija", "maxRazmakMm", "vir", "createdAt")
VALUES ('app-10', 'prod-woodcore-kubo-80-42', 'FASADA', 'vertical', 1000, 'uradni vir je FASADNA stran (montaža SAMO vertikalno); "Podkonstrukcija (alu cevi) razmak do 100 cm"', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
-- Dodatki: 5 kataloških (šifra = EXACT id dodatka iz kataloga).
INSERT INTO "ProductAccessory" ("id", "sifra", "familyId", "naziv", "dimenzijeJson", "notranjeMereJson", "opis", "aktivna", "createdAt", "updatedAt")
VALUES ('acc-rocaj-poln-92x45', 'rocaj-poln-92x45', 'fam-woodcore', 'Ročaj za ograjo – poln profil', '[92,45,5800]', '[55,30]', 'Vijačenje vidno, razmak vijakov 50 cm, od zgoraj navzdol skozi ročaj v nosilno cev; zvrtati 1 mm večjo luknjo; pri spajanju max 4 m; v kotih 1 mm razmak, na sredini dilatacijska reža; samostojna prodaja ni možna', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ProductAccessory" ("id", "sifra", "familyId", "naziv", "dimenzijeJson", "notranjeMereJson", "opis", "aktivna", "createdAt", "updatedAt")
VALUES ('acc-cep-romb-levo-desno', 'cep-romb-levo-desno', 'fam-woodcore', 'Levi/desni čep za zaključek romb profila', NULL, NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ProductAccessory" ("id", "sifra", "familyId", "naziv", "dimenzijeJson", "notranjeMereJson", "opis", "aktivna", "createdAt", "updatedAt")
VALUES ('acc-letvica-zakljucna', 'letvica-zakljucna', 'fam-woodcore', 'Zaključna letvica (opcija prečne romb ograje)', NULL, NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ProductAccessory" ("id", "sifra", "familyId", "naziv", "dimenzijeJson", "notranjeMereJson", "opis", "aktivna", "createdAt", "updatedAt")
VALUES ('acc-pokrovcek-terasna', 'pokrovcek-terasna', 'fam-woodcore', 'Zaključni pokrovček za terasno desko', NULL, NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ProductAccessory" ("id", "sifra", "familyId", "naziv", "dimenzijeJson", "notranjeMereJson", "opis", "aktivna", "createdAt", "updatedAt")
VALUES ('acc-stebricek-alu', 'stebricek-alu', 'fam-woodcore', 'Aluminijasti steber (prašno barvan)', NULL, NULL, 'Kotnik levo+desno za romb; spodnji del za nevidno pritrjevanje', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
-- Kompatibilnost: 12 DOKUMENTIRANIH parov (vir = besedilo kataloga);
-- KUBO nima nobenega (odkrito — fasadni kontekst dodatkov ne imenuje).
INSERT INTO "ProductCompatibility" ("id", "productId", "kompatibilenProductId", "kompatibilenDodatekId", "opis", "createdAt")
VALUES ('compat-01', 'prod-woodcore-romb-67', NULL, 'acc-rocaj-poln-92x45', 'handle.note: "Ročaj 92×45×5800 (notranja 55×30) se uporablja kot vrhnji zaključek"', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ProductCompatibility" ("id", "productId", "kompatibilenProductId", "kompatibilenDodatekId", "opis", "createdAt")
VALUES ('compat-02', 'prod-woodcore-romb-67', NULL, 'acc-cep-romb-levo-desno', 'posebnost: "Zaključek: levi/desni čep ALI letvica" + dodatek "Levi/desni čep za zaključek romb profila"', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ProductCompatibility" ("id", "productId", "kompatibilenProductId", "kompatibilenDodatekId", "opis", "createdAt")
VALUES ('compat-03', 'prod-woodcore-romb-67', NULL, 'acc-letvica-zakljucna', 'posebnost: "Zaključek: levi/desni čep ALI letvica" + dodatek "Zaključna letvica (opcija prečne romb ograje)"', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ProductCompatibility" ("id", "productId", "kompatibilenProductId", "kompatibilenDodatekId", "opis", "createdAt")
VALUES ('compat-04', 'prod-woodcore-romb-67', NULL, 'acc-stebricek-alu', 'dodatek: "Kotnik levo+desno za romb; spodnji del za nevidno pritrjevanje"', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ProductCompatibility" ("id", "productId", "kompatibilenProductId", "kompatibilenDodatekId", "opis", "createdAt")
VALUES ('compat-05', 'prod-woodcore-romb-67-vertical', NULL, 'acc-cep-romb-levo-desno', 'posebnost: "Pokončno s razmaki: vidna alu cev — vsaka deska zaprta s čepi ali detajl konstrukcije"', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ProductCompatibility" ("id", "productId", "kompatibilenProductId", "kompatibilenDodatekId", "opis", "createdAt")
VALUES ('compat-06', 'prod-woodcore-romb-67-vertical', NULL, 'acc-stebricek-alu', 'dodatek: "Kotnik levo+desno za romb" (pokončna romb varianta)', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ProductCompatibility" ("id", "productId", "kompatibilenProductId", "kompatibilenDodatekId", "opis", "createdAt")
VALUES ('compat-07', 'prod-woodcore-polna-128', NULL, 'acc-rocaj-poln-92x45', 'handle.available=true, dimenzije 92×45×5800 = dodatek "Ročaj za ograjo – poln profil"', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ProductCompatibility" ("id", "productId", "kompatibilenProductId", "kompatibilenDodatekId", "opis", "createdAt")
VALUES ('compat-08', 'prod-woodcore-deska-150', NULL, 'acc-rocaj-poln-92x45', 'handle.available=true, dimenzije 92×45×5800 = dodatek "Ročaj za ograjo – poln profil"', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ProductCompatibility" ("id", "productId", "kompatibilenProductId", "kompatibilenDodatekId", "opis", "createdAt")
VALUES ('compat-09', 'prod-woodcore-deska-150', NULL, 'acc-pokrovcek-terasna', 'posebnost: "Zaključni pokrovček na voljo" + dodatek "Zaključni pokrovček za terasno desko"', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ProductCompatibility" ("id", "productId", "kompatibilenProductId", "kompatibilenDodatekId", "opis", "createdAt")
VALUES ('compat-10', 'prod-woodcore-polna-57-32', NULL, 'acc-rocaj-poln-92x45', 'handle.available=true, dimenzije 92×45×5800 = dodatek "Ročaj za ograjo – poln profil"', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ProductCompatibility" ("id", "productId", "kompatibilenProductId", "kompatibilenDodatekId", "opis", "createdAt")
VALUES ('compat-11', 'prod-woodcore-polna-100', NULL, 'acc-rocaj-poln-92x45', 'handle.available=true (note: "Ročaj 95×45 na zalogi samo v WHITE; ostali v polnem profilu 92×45")', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ProductCompatibility" ("id", "productId", "kompatibilenProductId", "kompatibilenDodatekId", "opis", "createdAt")
VALUES ('compat-12', 'prod-woodcore-polna-128-vertical', NULL, 'acc-rocaj-poln-92x45', 'handle.available=true, dimenzije 92×45×5800 = dodatek "Ročaj za ograjo – poln profil"', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
-- ProductVariant + ProductSupplierMapping: seed PRAZEN (§8 — colorsCount
-- je ŠTEVEC ne enumeracija; dobaviteljske preslikave katalog NE dokumentira).
-- vpiše jih pisarca prek /api/catalog r390.
