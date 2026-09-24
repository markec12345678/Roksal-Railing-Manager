# Varnostna politika — resource-level avtorizacija (issue #4, §3; R120)

Velja od: **S+9**, razširjeno **R120** (security pass). Modul: `src/lib/access.ts` (+ `src/lib/project-state.ts`).

## Načelo

`authenticate()` pove SAMO, kdo si. Vsak business API mora ZA vsakim klicem
preveriti tudi dostop do konkretnejšega vira (project/customer/invoice/…).
Avtentikacija brez avtorizacije vira je IDOR ranljivost, ne varnost.

## Politika odgovorov (konsistentna za VSE business API-je)

| Stanje | Odgovor |
|---|---|
| Vir ne obstaja | **404** (ne razkrivamo obstoja) |
| Vir obstaja, dostop ni dovoljen | **403** (eksplicitno) |
| Brez/veljavne seje ali ključa | **401** |
| Neveljaven prehod statusa | **409** (state machine) |

## Matrika vlog (dejanske role: ADMIN, VODJA, MONTER, SKLADISCE)

| Vloga | Project read | Project write | Project delete/lock | Customer | Invoice/Račun | Zaloga | Status projekta |
|---|---|---|---|---|---|---|---|
| ADMIN | vse | vse | vse | vse | vse | vse | vse |
| VODJA | vse | vse | vse | vse | vse | vse | vse |
| MONTER | svoje | svoje (brez deal-lock) | ne | ustvari/uredi | svojih projektov (read) | read | dovoljeni prehodi |
| SKLADISCE | vse | ne | ne | read | read | vse (prejem, premiki) | ne |

## Servisni principal MOBILE_SYNC (R120 — API ključ, najmanjše pravice)

API ključ (`rkm_…`) NI več "manager na ravni VODJA" (to je bil R120 najdeni
problem: en ključ je lahko bral vse, spreminjal projekte, ustvarjal projekte z
poljubnim statusom, vplival na stranke). Je **namenski servisni principal**:

| Pravica | Dovoljeno? | Opomba |
|---|---|---|
| read projektov (sync zrcalo) | ✅ | dokumentirana servisna pogodba (`projectWhereForPrincipal → {}` SAMO v `/api/sync`) |
| sync update projektov (polja + status) | ✅ | status SAMO prek statusnega stroja, nikoli čez deal-lock |
| sync create projekt | ✅ | IZKLJUČNO z začetnim statusom `NACRTOVANO` (korekcija se javi v `results`) |
| ustvarjanje meritev (measurement) | ✅ | `assertProjectAccess` velja tudi tu |
| nalaganje fotodokumentacije | ✅ | `/api/photos` POST zahteva 'read' na projektu (terenško dejanje); DELETE zahteva 'update' |
| brisanje projektov/strank | ❌ | 403 |
| zaklep/odklep (lock) | ❌ | 403 |
| urejanje cen / dobaviteljev / zaloge | ❌ | 403 (in `denyUnless` blokira že na vstopu) |
| obhod statusnega stroja | ❌ | `assertTransition`: servis NI manager |

- "svoje" = `Project.monterId === session.sub || Project.vodjaId === session.sub`.
- API ključ = strojni servisni principal MOBILE_SYNC. Ni uporabniške pripisnosti:
  `audit.userId = null`; akcije v sync so kljub temu auditirane
  (`SYNC_PROJECT_CREATED` / `SYNC_PROJECT_UPDATED` v ISTI transakciji kot posel).
  Ustvari se z `bun run apikey`, hrani se samo SHA-256 hash, preklic = `revokedAt`.
- `dealLocked` projekt: monter IN servis ne moreta več urejati/spreminjati statusa
  (izključno vodstvo prek eksplicitnih workflow korakov).

## Preverjeno na (S+9 + R120)

- `api/projects` — GET filtrirano po vlogi; PATCH: 403/404 + state machine;
  POST: audit v transakciji.
- `api/measurements` — POST/GET: dostop = dostop do projekta.
- `api/invoices` — POST/PATCH/DELETE: samo vodstvo (uradni dokumenti);
  GET: monter samo svoji projekti.
- `api/material-orders` — POST: vodstvo; PATCH (prejem DOBLJENO): vodstvo +
  skladišče; GET: vsi poslovni principalci.
- `api/inventory` — premiki: vodstvo + skladišče; novo artikel: vodstvo.
- `api/customers` — POST: uporabniki (teren); API ključ ne (niti brisanje).
- `api/sync` (R120) — GET: `projectWhereForPrincipal` skoping (monter = svoje);
  POST: zod shema payloada, per-item rezultati, začetni status samo `NACRTOVANO`,
  prehodi prek statusnega stroja, audit v transakciji.
- `api/photos` (R120) — zaprt cross-project IDOR: GET/POST = 'read' na projektu,
  DELETE = 'update'.

## Adversarial testi (vitest, `src/lib/__tests__/`)

- `access.test.ts` — matrika vlog, 403/404 pravila, IDOR scenariji
  (User A → tuj projekt, deal-lock zaščita, apikey semantika).
- `project-state.test.ts` — prehodna matrika, preskoki, vloge.
- `inventory-ledger.test.ts` — transakcijska zaloga, idempotenten prejem
  (1×/10×/vzporedno 8×), negativna zaloga, invarianta vsote.
- `numbering.test.ts` — 10 vzporednih računov = 10 unikatnih zaporednih številk.
- `audit-durability.test.ts` — audit v isti transakciji, rollback brez fantomov.

## Še ni pokrito (iskreno, naslednje runde)

- customers/measurements/documents/inventory posamezne IDOR rute imajo guard na
  nivoju modula; END-TO-END HTTP testi (pravi requesti čez strežnik) so del
  acceptance rund za preostale korake issue #4.
- Portal (clientToken) ima lasten model dostopa (javna stranka) — ločena politika.
- `mobileProjectId` še NIMA unique constrainta v bazi (preveriti je treba
  obstoječe produkcije podatke na duplikate, preden se doda) — Route-level
  dedup je rešen prek `findFirst`, duplikati znotraj ENEGA requesta pa gredo
  vsak svojo pot (R121 kandidat).
- Replay zaščita sync POST: trenutno idempotentna po `mobileProjectId`
  (isti payload = update istega zapisa); časovni žig / nonce NI implementiran.
