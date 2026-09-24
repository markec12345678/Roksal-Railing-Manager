# PostgreSQL migracija — runbook (issue #4, korak 1)

Status: **Lokalni dev/test teče na PostgreSQL 18 (embedded, brez root).**
Produkcija (Vercel) še vedno teče na prehodnem SQLite demo načinu, dokler
lastnik ne ustvari zunanje baze. Ta dokument opisuje postopek.

## Kaj je spremenjeno (S+9)

| Področje | Prej | Zdaj |
|---|---|---|
| Kanonična shema | SQLite (`prisma/schema.prisma`) | **PostgreSQL** (`provider = "postgresql"`) |
| Migracije | `prisma db push` (brez verzij) | **`prisma/migrations/` (verzionirane, reproducible)** |
| Lokalni dev | `db/custom.db` | embedded PG :5433 (`bun run db:up`), baza `roksal_dev` |
| Testi (vitest) | SQLite file | PG baza `roksal_test` (globalSetup zažene PG + `migrate deploy`) |
| Build (produkcija) | `db push` + seed | `prisma migrate deploy` + seed (SEED_ON_DEPLOY=false za izklop) |
| Vercel demo | SQLite `/tmp` kopija | **nespremenjeno (PREHODNO)** — `prisma/build-prepare.cjs` generira sqlite varianto sheme IZKLJUČNO ko je `DATABASE_URL=file:*` |
| Backup/restore | `tools/backup-db.ts` (SQLite) | `tools/migrate-data-to-postgres.ts` = restore SQLite → PG na sveži bazi |

Nova pravila razreševanja vira: `src/lib/db-url.ts`
(process env postgres → `.env` postgres → env kot je → fail).

## Lokalno (peskovnik ali lastni računalnik)

```bash
bun install
bun run db:up          # zažene embedded PostgreSQL :5433 (brez root)
bun run db:deploy      # prisma migrate deploy na roksal_dev
bun run db:seed        # demo podatki (+ OPENING ledger vnosi)
bun run dev            # Next.js — [db] vir: postgresql (produkcija)
bun run migrate:to-postgres   # enkratno: restore db/custom.db → PG (na sveži bazi)
```

Testi sami zagotovijo PG: `bun run test` (vitest globalSetup).

## PRODUKCIJA — koraki, ki jih mora izvesti LASTNIK

Sandbox nima poverilnic za Vercel/Neon, zato teh korakov ni mogoče izvesti
namesto tebe. Ko jih opraviš, prehodna SQLite pot avtomatsko izgine (koda je
pripravljena):

1. **Vercel Postgres ali Neon baza** (free tier zadostuje):
   - Vercel Dashboard → Storage → Create Database → Postgres (ali neon.tech)
2. **Poveži z repozitorijem**: Vercel → Project → Settings → Environment
   Variables — `DATABASE_URL` naj kaže na `postgres://…` URL (vse tri
   okolja: production/preview/development imajo ločene baze ali vsaj ločene
   sheme — priporočeno: ločena baza na okolje).
3. **Deploy**: `bun run build` na Vercelu zazna `postgres://` in sam zažene
   `prisma migrate deploy` (brez `db push`) + seed. Seed na produkciji izklopiš
   z env `SEED_ON_DEPLOY=false`.
4. **Podatkovna migracija** (če imate realne podatke v SQLite):
   - lokalno: `bun run migrate:to-postgres` (restore na sveži PG bazi)
   - ali: `pg_dump`/`pg_restore` med bazo.
5. **Očisti prehodno pot** (ko produkcijski `DATABASE_URL` kaže na PG):
   - izbriši `prisma/schema.build.prisma` generiranje v `prisma/build-prepare.cjs`
     (vejica `sqliteMode`),
   - izbriši `/tmp` serverless vejico v `src/lib/db.ts` (resolveServerlessDatabaseUrl),
   - odstrani `db/custom.db` iz repozitorija in `outputFileTracingIncludes` v next.config.ts.

## Backup / restore na PostgreSQL

```bash
# backup (vseeno kje teče pg client — priporočeno pg_dump na strežniku):
pg_dump "$DATABASE_URL" > backup-$(date +%F).sql

# restore na sveži bazi (dokazano v testih tools/migrate-data-to-postgres.ts):
createdb roksal_restore
psql roksal_restore < backup-YYYY-MM-DD.sql
```

Restore-semantika SQLite → PG je praktično testirana: `tools/migrate-data-to-postgres.ts`
počisti ciljne tabele in jih obnovi 1:1 (id-ji, številke, e-pošte) + OPENING ledger.

## Kaj NI del tega koraka (iskreno)

- Vercel produkcija še teče na SQLite demo načinu (korak zgoraj je lastnikov).
- Object storage za binarne dokumente je ločen korak issue #4 (VIZ ima vzorec v
  `src/lib/viz/storage.ts`; poslovni dokumenti sledijo v naslednji rundi).
