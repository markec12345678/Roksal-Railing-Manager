-- R319 (issue #5 §18 — ZAKLJUČEK odložene obveznosti iz R136)
-- VALIDATE CONSTRAINT za vseh 8 CHECK omejitev iz R136.
--
-- R136 je CHECKe namenoma dodal z NOT VALID (fail-closed brez tveganja
-- deploja: veljali so takoj za VSE NOVE zapise, obstoječe vrstice se niso
-- skenirale). R136 je v glavi migracije izrecno obljubil:
--   "VALIDATE CONSTRAINT sledi v ločeni rundi, ko je produkcijska data
--    enkrat preverjena."
-- Ta runda JE ta obljuba. Dokazi, da je zdaj varno:
--   • Testna baza (embedded PG :5433) zgradi CELO verigo migracij iz nič
--     (tools/vitest-global-setup.ts → prisma migrate deploy) — vsak zapis
--     po R136 je ŽE šel skozi CHECKe (vsota vseh testnih sutiov = 4422+).
--   • r319-validate-checks.test.ts (STRAŽAR): po migrate deploy mora biti
--     pg_constraint.convalidated = TRUE za vseh 8 imen — sicer veriga ni
--     cela (npr. ta migracija pobrisana) in test JAVNO pade.
--
-- Fail-closed poraz po zasnovi (R136 §18 komentar): če bi kdorkoli IMEL
-- legacy vrstico, ki krši omejitev, `migrate deploy` JAVNO pade na buildu
-- (Vercel) — brez tihe zaobvoze. To je izrecna preferenca lastnika:
-- integriteta > zunanji videz zelenega deploja.
--
-- Tehnično: VALIDATE CONSTRAINT drži LE SHARE UPDATE EXCLUSIVE zaklep na
-- tabeli (bralci/pisalci NISO blokirani), skenira obstoječe vrstice in
-- preklopi convalidated → true. Po uspehu so NOT VALID CHECKi dokončno
-- enakovredni običajnim CHECKom (isti zavrnitveni spor vsem potejem).
ALTER TABLE "Invoice" VALIDATE CONSTRAINT "invoice_amounts_nonnegative";
ALTER TABLE "Invoice" VALIDATE CONSTRAINT "invoice_status_allowed";
ALTER TABLE "Invoice" VALIDATE CONSTRAINT "invoice_tip_allowed";
ALTER TABLE "Inventory" VALIDATE CONSTRAINT "inventory_stock_nonnegative";
ALTER TABLE "MaterialOrderItem" VALIDATE CONSTRAINT "order_item_quantity_positive";
ALTER TABLE "MaterialOrder" VALIDATE CONSTRAINT "order_total_nonnegative";
ALTER TABLE "MaterialUsage" VALIDATE CONSTRAINT "usage_quantity_positive";
ALTER TABLE "MaterialPrice" VALIDATE CONSTRAINT "price_nonnegative";
