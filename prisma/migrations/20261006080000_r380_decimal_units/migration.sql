-- R380 (issue #13, korak R168 iz §12) — REAL UNITS + DECIMAL:
-- Float → Decimal za finančne/količinske poslovne vrednosti + konverzija
-- enot na Inventarju (purchaseUnit/stockUnit/consumptionUnit/
-- supplierPackSize/conversionFactor/precision/rounding).
--
-- Problem, ki ga ta migracija zapira (issue #13 §12):
--   • finančne vrednosti (cena, marža, DDV, popust, zneski) in količine
--     (zaloga, premiki, šarže) so bile v FLOAT8 — dvojična plavajoča
--     vejica ZGODOVINSKO laže: 0.1+0.2 = 0.30000000000000004, ROUND na
--     vsaki strani aplikacije različno; revizijska sled (StockLedger.
--     balanceAfter) je nosila vrednosti, ki jih NI MOGOČE točno
--     reproducirati;
--   • enota je bila prost string — 'm', 'M', 'm2', 'm²' so bile vse
--     "veljavne"; pretvorbe (kos v paketu, m v šarži) niso bile možne,
--     ker ni bilo podatka o razmerju.
--
-- Rešitev:
--   1) FLOAT8 → NUMERIC po domeni (pogodba s src/lib/decimal-policy.ts —
--      EN VIR preciznosti):
--        denar     DECIMAL(12,2)  — EUR vrednosti (cena, marža, DDV, …);
--        količina  DECIMAL(12,3)  — kos/m/m²/kg/l (zaloga, premiki, …);
--        odstotek  DECIMAL(5,2)   — Supplier.popust (%);
--        faktor    DECIMAL(12,6)  — Inventory.conversionFactor (novo).
--      Explicit USING cast: float8 → numeric je PRIREDITVENI cast v PG,
--      obstoječe vrednosti se prenesejo do deklarirane preciznosti
--      (12,3 zaokroži na 3 decimalke — seed vrednosti so celoštevilske,
--      ni izgube).
--   2) KONVERZIJA ENOT (§12): 7 novih NULLABLE stolpcev na Inventarju.
--      VSI nullable — obstoječi materiali teh podatkov NIMAJO in
--      izumljanje bi bilo laž (§8 honest NULL — enak vzorec kot
--      BOMLine.unitCost v R376). CHECK takoj VELJAVEN (vsi novi stolpci
--      so NULL na obstoječih vrsticah — NOT VALID ni potreben):
--        • kanonične enote EXACT: ('kos','m','m²','kg','l','komplet',
--          'ura','paket') — 'm²' ima SUPERSCRIPT 2 (U+00B2), NE 'm2';
--        • supplierPackSize > 0, conversionFactor > 0 (ničelni faktor bi
--          tiho uničil vsako pretvorbo);
--        • precision INTEGER 0–6 (ista meja kot decimal-policy
--          MAX_DECIMALKE);
--        • rounding IN ('GORI','DOL','NAJBLIZJE').
--
-- KAJ TA MIGRACIJA NE DELA (zavedne meje):
--   • Legacy 'enota' (Inventory) in 'unit' (BOMLine/ProductionOrderLine/
--     InstallationRecordLine/PriceBookItem) ostajajo PROSTI string —
--     produkcijski podatki so nastali PRED kanonom in prisilna
--     normalizacija bi bila fuzzy preslikava (§5 prepoveduje celo pri
--     SKU). Kanonični nabor velja za NOVA konverzijska polja.
--   • GEOGRAFSKE vrednosti (latitude/longitude/gps, Slope.kotStopinje)
--     ostajajo Float — NISO poslovne vrednosti (§12 govori o ceni/
--     količini; geo koordinate niso denar ne količina).
--   • Vseh 8 obstoječih CHECK omejitev (R136, validiranih R319) na
--     spreminjenih stolpcih prenese ALTER TYPE nespremenjeno — numerične
--     primerjave so semantično identične.
--   • BREZ seeda — prazni novi stolpci so iskreni (§8).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) FINANČNE VREDNOSTI → DECIMAL(12,2) / (5,2)
-- ═══════════════════════════════════════════════════════════════════════════

-- Project: predvidena cena (stranki vidna) + ZAKLENJENA MARŽA ob podpisu
-- (issue #13 srce — marža, vezana na podpis, mora biti točna do centa).
ALTER TABLE "Project" ALTER COLUMN "estimatedPrice" TYPE DECIMAL(12,2) USING "estimatedPrice"::DECIMAL(12,2);
ALTER TABLE "Project" ALTER COLUMN "marginLocked" TYPE DECIMAL(12,2) USING "marginLocked"::DECIMAL(12,2);

-- Profil: linearna cena (EUR/m) — vhod v kalkulator ponudbe.
ALTER TABLE "Profil" ALTER COLUMN "cenaM" TYPE DECIMAL(12,2) USING "cenaM"::DECIMAL(12,2);

-- Supplier: pogodbeni popust v % — DECIMAL(5,2) (0–999.99 %).
ALTER TABLE "Supplier" ALTER COLUMN "popust" TYPE DECIMAL(5,2) USING "popust"::DECIMAL(5,2);

-- MaterialPrice: (zgodična) cena EUR/enoto — primerjalni cenik.
ALTER TABLE "MaterialPrice" ALTER COLUMN "cena" TYPE DECIMAL(12,2) USING "cena"::DECIMAL(12,2);

-- InventoryLot: nabavna cena šarže (strošek v FIFO).
ALTER TABLE "InventoryLot" ALTER COLUMN "purchasePrice" TYPE DECIMAL(12,2) USING "purchasePrice"::DECIMAL(12,2);

-- MaterialOrder + postavke: skupna cena naročila + cena na enoto.
ALTER TABLE "MaterialOrder" ALTER COLUMN "skupajCena" TYPE DECIMAL(12,2) USING "skupajCena"::DECIMAL(12,2);
ALTER TABLE "MaterialOrderItem" ALTER COLUMN "cena" TYPE DECIMAL(12,2) USING "cena"::DECIMAL(12,2);

-- Invoice: osnova / DDV / znesek — eRačun zahteva centno točnost.
ALTER TABLE "Invoice" ALTER COLUMN "osnova" TYPE DECIMAL(12,2) USING "osnova"::DECIMAL(12,2);
ALTER TABLE "Invoice" ALTER COLUMN "ddv" TYPE DECIMAL(12,2) USING "ddv"::DECIMAL(12,2);
ALTER TABLE "Invoice" ALTER COLUMN "znesek" TYPE DECIMAL(12,2) USING "znesek"::DECIMAL(12,2);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2) KOLIČINE → DECIMAL(12,3) (kos · m · m² · kg · l — tri decimalke)
-- ═══════════════════════════════════════════════════════════════════════════

-- Inventory: stanje + minimalna zaloga.
ALTER TABLE "Inventory" ALTER COLUMN "kolicinaZaloga" TYPE DECIMAL(12,3) USING "kolicinaZaloga"::DECIMAL(12,3);
ALTER TABLE "Inventory" ALTER COLUMN "minimalnaZaloga" TYPE DECIMAL(12,3) USING "minimalnaZaloga"::DECIMAL(12,3);

-- MaterialUsage: poraba na projektu.
ALTER TABLE "MaterialUsage" ALTER COLUMN "porabljenaKolicina" TYPE DECIMAL(12,3) USING "porabljenaKolicina"::DECIMAL(12,3);

-- InventoryMovement: količina premika.
ALTER TABLE "InventoryMovement" ALTER COLUMN "kolicina" TYPE DECIMAL(12,3) USING "kolicina"::DECIMAL(12,3);

-- StockLedger: količina dogodka + saldo po dogodku (revizijska sled —
-- točnost obvezna: saldo se VERIŽNO izpeljuje iz prejšnjega).
ALTER TABLE "StockLedger" ALTER COLUMN "kolicina" TYPE DECIMAL(12,3) USING "kolicina"::DECIMAL(12,3);
ALTER TABLE "StockLedger" ALTER COLUMN "balanceAfter" TYPE DECIMAL(12,3) USING "balanceAfter"::DECIMAL(12,3);

-- InventoryLot: začetna + preostala količina šarže.
ALTER TABLE "InventoryLot" ALTER COLUMN "quantityInitial" TYPE DECIMAL(12,3) USING "quantityInitial"::DECIMAL(12,3);
ALTER TABLE "InventoryLot" ALTER COLUMN "quantityRemaining" TYPE DECIMAL(12,3) USING "quantityRemaining"::DECIMAL(12,3);

-- LotAllocation: dodeljena količina iz šarže (§11 rezervacija).
ALTER TABLE "LotAllocation" ALTER COLUMN "kolicina" TYPE DECIMAL(12,3) USING "kolicina"::DECIMAL(12,3);

-- MaterialOrderItem: naročena količina.
ALTER TABLE "MaterialOrderItem" ALTER COLUMN "kolicina" TYPE DECIMAL(12,3) USING "kolicina"::DECIMAL(12,3);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3) KONVERZIJA ENOT na Inventarju (§12) — 7 novih NULLABLE stolpcev
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "Inventory" ADD COLUMN "purchaseUnit" TEXT;
ALTER TABLE "Inventory" ADD COLUMN "stockUnit" TEXT;
ALTER TABLE "Inventory" ADD COLUMN "consumptionUnit" TEXT;
ALTER TABLE "Inventory" ADD COLUMN "supplierPackSize" DECIMAL(12,3);
ALTER TABLE "Inventory" ADD COLUMN "conversionFactor" DECIMAL(12,6);
ALTER TABLE "Inventory" ADD COLUMN "precision" INTEGER;
ALTER TABLE "Inventory" ADD COLUMN "rounding" TEXT;

-- CHECK: kanonične enote EXACT (nabor zamrznjen v src/lib/units.ts).
-- 'm²' = U+00B2 superscript — 'm2' ZAVRNJEN (EXACT kanon, brez fuzzy §5).
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_purchaseUnit_kanon"
  CHECK ("purchaseUnit" IS NULL OR "purchaseUnit" IN ('kos', 'm', 'm²', 'kg', 'l', 'komplet', 'ura', 'paket'));
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_stockUnit_kanon"
  CHECK ("stockUnit" IS NULL OR "stockUnit" IN ('kos', 'm', 'm²', 'kg', 'l', 'komplet', 'ura', 'paket'));
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_consumptionUnit_kanon"
  CHECK ("consumptionUnit" IS NULL OR "consumptionUnit" IN ('kos', 'm', 'm²', 'kg', 'l', 'komplet', 'ura', 'paket'));

-- CHECK: pozitivne konverzijske vrednosti (ničelni faktor = tiha pokvaritev
-- vsake pretvorbe; negativni pack size ne obstaja fizično).
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_supplierPackSize_positive"
  CHECK ("supplierPackSize" IS NULL OR "supplierPackSize" > 0);
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_conversionFactor_positive"
  CHECK ("conversionFactor" IS NULL OR "conversionFactor" > 0);

-- CHECK: preciznost 0–6 (ista meja kot decimal-policy MAX_DECIMALKE).
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_precision_range"
  CHECK ("precision" IS NULL OR ("precision" >= 0 AND "precision" <= 6));

-- CHECK: način zaokroževanja (nabor GORI/DOL/NAJBLIZJE — EN VIR
-- src/lib/decimal-policy.ts NACINI_ZAOKROZEVANJA).
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_rounding_nacin"
  CHECK ("rounding" IS NULL OR "rounding" IN ('GORI', 'DOL', 'NAJBLIZJE'));
