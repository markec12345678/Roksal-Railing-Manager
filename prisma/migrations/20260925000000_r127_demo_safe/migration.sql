-- R127 (issue #5 §1) — demo profil je varnostno nevtralen.
--
-- Zahtevi iz issue-ja:
--   • "demo uporabnik nikoli ni production ADMIN" → vloga MONTER
--     (MONTER vidi samo svoje projekte, ne vidi računov/zalog/cen —
--     matrika pravic v src/lib/access.ts),
--   • "credentials niso v source/README" → znano geslo iz starih verzij
--     (demo prijava) se UNIČI: passwordHash = NULL pomeni, da prijava prek
--     /login forme ni mogoča (shema: "Null = račun brez gesla"); demo dostop
--     je izključno prek /api/auth/demo ("vstop brez prijave"), ki ga je na
--     produkciji od R127 privzeto IZKLOPLJENEGA (DEMO_ACCESS=on vklopi).
--
-- Migracija je idempotentna (pogoj WHERE), zato je ponovni zagon neškodljiv.
UPDATE "Profile"
SET "vloga" = 'MONTER'::"UserRole",
    "passwordHash" = NULL
WHERE "email" = 'demo@roksal.si'
  AND ("vloga" <> 'MONTER'::"UserRole" OR "passwordHash" IS NOT NULL);
