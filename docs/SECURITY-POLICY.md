# Varnostna politika — resource-level avtorizacija (issue #4, §3)

Velja od: **S+9**. Modul: `src/lib/access.ts` (+ `src/lib/project-state.ts`).

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
| API ključ | vse (servis) | vse (servis) | vse (servis) | read | vse (servis) | vse | vse (servis) |

- "svoje" = `Project.monterId === session.sub || Project.vodjaId === session.sub`.
- API ključ = strojni servisni račun (mobilni klient). Ni uporabniške pripisnosti:
  `audit.userId = null`. Ustvari se z `bun run apikey`, hrani se samo SHA-256 hash.
- `dealLocked` projekt: monter ne more več urejati/spreminjati statusa
  (izključno vodstvo prek eksplicitnih workflow korakov).

## Preverjeno na (S+9)

- `api/projects` — GET filtrirano po vlogi; PATCH: 403/404 + state machine;
  POST: audit v transakciji.
- `api/measurements` — POST/GET: dostop = dostop do projekta.
- `api/invoices` — POST/PATCH/DELETE: samo vodstvo (uradni dokumenti);
  GET: monter samo svoji projekti.
- `api/material-orders` — POST: vodstvo; PATCH (prejem DOBLJENO): vodstvo +
  skladišče; GET: vsi poslovni principalci.
- `api/inventory` — premiki: vodstvo + skladišče; novo artikel: vodstvo.
- `api/customers` — POST: uporabniki (teren); API ključ ne.
- Statusni preskok iz mobilne sinhronizacije (`api/sync`) — samo veljavni prehodi.

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
