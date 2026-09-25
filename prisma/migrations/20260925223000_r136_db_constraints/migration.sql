-- R136 (issue #5 §18 — Database constraints)
-- Vse omejitve so DOKUMENTIRANE dvoplaščno: tukaj + docs/SECURITY-POLICY.md.
--
-- Strategija fail-closed brez tveganja deploja:
--   • CHECK omejitve grejo z NOT VALID — veljajo takoj za VSE NOVE zapise
--     (INSERT/UPDATE), obstoječe vrstice se NE skenirajo (ni blokade ni tveganja,
--     da legacy podatek prekine deploy). VALIDATE CONSTRAINT sledi v ločeni
--     rundi, ko je produkcijska data enkrat preverjena (dev: 0 kršitev —
--     scripts/r136-constraint-audit.cjs).
--   • EXCLUDE (prekrivanje veljavnosti cen) je VALIDATED takoj — dev baza ima
--     0 prekrivanj; zapisni vzorec API-ja (zapri staro + ustvari novo v ENI
--     transakciji, R136 §19) prekrivanja ne more ustvariti. Če legacy podatek
--     vseeno krši, migracija JAVNO pade (fail-closed, brez tihe zaobvozi).

-- ----------------------------------------------------------------------
-- btree_gist — omogoča gist index na skalarnih stolpcih (za EXCLUDE).
-- Lastnik baze ga lahko ustvari (Neon superuser / Render owner).
-- ----------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ----------------------------------------------------------------------
-- §18 "price validity overlap protection": za isti par (material, dobavitelj)
-- sta dve ceni z istega trenutka naprej NEDOVOLJENI. Polodprt interval '[)'
-- (odprt konec) je usklajen z API vzorcem zapiranja (veljavnostDo = čas nove).
--
-- Opomba: Prisma DateTime = timestamp(3) WITHOUT time zone → range mora biti
-- tsrange (tstzrange bi zahteval implicitni cast timestamp→timestamptz, ki je
-- STABLE — PostgreSQL zato zavrne indeksni izraz: "must be marked IMMUTABLE").
-- ----------------------------------------------------------------------
ALTER TABLE "MaterialPrice" ADD CONSTRAINT "material_price_no_overlap"
  EXCLUDE USING gist (
    "inventoryId" WITH =,
    "supplierId" WITH =,
    tsrange("veljavnostOd", "veljavnostDo", '[)') WITH &&
  );

-- ----------------------------------------------------------------------
-- §18 "positive quantity/price rules" — CHECK omejitve (NOT VALID).
-- API plasti že validirajo (zod + R136 dopolnitve); baza je ZADNJA linija
-- obrambe proti vsem drugim potem (skripte, ročni SQL, prihodnje rute).
-- ----------------------------------------------------------------------
ALTER TABLE "Invoice" ADD CONSTRAINT "invoice_amounts_nonnegative"
  CHECK ("osnova" >= 0 AND "ddv" >= 0 AND "znesek" >= 0 AND "rokPlacilaDni" >= 0) NOT VALID;

ALTER TABLE "Invoice" ADD CONSTRAINT "invoice_status_allowed"
  CHECK ("status" IN ('OSNUTEK', 'IZDAN', 'PLACAN', 'STORNIRAN')) NOT VALID;

ALTER TABLE "Invoice" ADD CONSTRAINT "invoice_tip_allowed"
  CHECK ("tip" IN ('PREDRACUN', 'RACUN', 'PREDPLACILNI')) NOT VALID;

ALTER TABLE "Inventory" ADD CONSTRAINT "inventory_stock_nonnegative"
  CHECK ("kolicinaZaloga" >= 0 AND "minimalnaZaloga" >= 0) NOT VALID;

ALTER TABLE "MaterialOrderItem" ADD CONSTRAINT "order_item_quantity_positive"
  CHECK ("kolicina" > 0 AND "cena" >= 0) NOT VALID;

ALTER TABLE "MaterialOrder" ADD CONSTRAINT "order_total_nonnegative"
  CHECK ("skupajCena" >= 0) NOT VALID;

ALTER TABLE "MaterialUsage" ADD CONSTRAINT "usage_quantity_positive"
  CHECK ("porabljenaKolicina" > 0) NOT VALID;

ALTER TABLE "MaterialPrice" ADD CONSTRAINT "price_nonnegative"
  CHECK ("cena" >= 0) NOT VALID;

-- ----------------------------------------------------------------------
-- §18 "invoice sequence uniqueness" — že pokrito z obstoječima unique
-- omejitvama Invoice.stevilka in NumberSequence.seqKey (pregledano, brez
-- sprememb). "unique idempotency keys" — StockLedger.idempotencyKey unique
-- (R128). "FK/onDelete policy" — PortalAccess.projectId FK je bil mankal
-- (R132); Prisma migrate ga doda zgoraj (ON DELETE SET NULL).
-- ----------------------------------------------------------------------
