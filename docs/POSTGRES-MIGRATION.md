# PostgreSQL migracija — runbook (issue #4, korak 1) — DOKONČANA

Status: **DOKONČANA (S+8.2)** — lokalni dev/test teče na embedded PostgreSQL 18,
produkcija (Vercel) teče na **Neon PostgreSQL** (deploy b23424a READY,
E2E preverjen: prijava 200, /api/projects vrača realne podatke iz Neon CUID
baze). Prehodni SQLite način je **odstranjen iz kode**.

## Zgodovina prehoda

| Področje | Prej (≤ S+8) | Zdaj (S+9 + S+8.2) |
|---|---|---|
| Kanonična shema | SQLite (`provider = "sqlite"`) | **PostgreSQL** (`prisma/schema.prisma`) |
| Migracije | `prisma db push` (brez verzij) | **`prisma/migrations/` (verzionirane, reproducible)** |
| Lokalni dev | `db/custom.db` | embedded PG :5433 (`bun run db:up`), baza `roksal_dev` |
| Testi (vitest) | SQLite file | PG baza `roksal_test` (globalSetup zažene PG + `migrate deploy`) |
| Build (produkcija) | `db push` + seed | `prisma migrate deploy` + seed (`SEED_ON_DEPLOY=false` za izklop) |
| Vercel baza | SQLite `/tmp` kopija | **Neon PostgreSQL** (Vercel Storage store `store_QmcbC5fiV3mcKwsy`, attach prek API) |
| Backup/restore | `tools/backup-db.ts` (SQLite) | `pg_dump`/`psql` + `tools/migrate-data-to-postgres.ts` (SQLite → PG restore) |

## Čiščenje prehodne poti (korak 5 — IZVEDENO v S+8.2)

Odstranjeno:

1. `prisma/build-prepare.cjs` — sqliteMode veja (generiranje
   `schema.build.prisma` + `db push` za `file:*`) — **izbrisana**; brez
   `postgres://` URL-a gradnja JASNO failed (fail closed).
2. `src/lib/db.ts` — `resolveServerlessDatabaseUrl()` in `/tmp` kopija baze —
   **izbrisano**; edini vir je razrešen `postgres://` URL, sicer throw.
3. `src/lib/viz/db.ts` — serverless `/tmp` vejica — **izbrisana**.
4. `src/lib/db-url.ts` — `isSqliteUrl()` in file:* passthrough — **odstranjena**;
   pravilo: env postgres → .env postgres → `null` (fail closed).
5. `next.config.ts` — `outputFileTracingIncludes` za `./db/**` — **odstranjeno**
   (v serverless bundle ni več vgrajene baze).
6. `tools/db.ts` — file:* env NE upošteva več (fail closed).
7. `prisma/schema.prisma` in `prisma/seed.cjs` — zastareli komentarji o
   prehodnem načinu — posodobljeni.
8. README.md, deploy/README.md, deploy/roksal.service — navodila prenesena z
   SQLite (`file:../db/custom.db`) na PostgreSQL + `migrate deploy`.

`db/custom.db` NI v gitu (gitignore `/db/*.db`); datoteka ostane samo lokalno
kot vir za enkratni restore (`bun run migrate:to-postgres`).

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

## Produkcija (Neon) — kako je povezano

- Vercel → Storage → Neon store povezan na projekt; vbrizga `DATABASE_URL`
  (in `POSTGRES_PRISMA_URL`, `PGHOST`, …) za production+preview okolja.
- Build (`bun run build` → `prisma/build-prepare.cjs`): `prisma generate` +
  `prisma migrate deploy` + seed (idempotenten upsert; izklop z
  `SEED_ON_DEPLOY=false`).
- Brez `postgres://` URL-a gradnja ne uspe (namenoma — brez tihe zasilne poti).

## Backup / restore na PostgreSQL

```bash
# backup (priporočeno pg_dump na strežniku):
pg_dump "$DATABASE_URL" > backup-$(date +%F).sql

# restore na sveži bazi:
createdb roksal_restore
psql roksal_restore < backup-YYYY-MM-DD.sql
```

Restore-semantika SQLite → PG je praktično testirana: `tools/migrate-data-to-postgres.ts`
počisti ciljne tabele in jih obnovi 1:1 (id-ji, številke, e-pošte) + OPENING ledger.

## Kaj NI del tega koraka (iskreno)

- Object storage za binarne dokumente je ločen korak issue #4 (VIZ ima vzorec v
  `src/lib/viz/storage.ts`; poslovni dokumenti sledijo v naslednji rundi).
