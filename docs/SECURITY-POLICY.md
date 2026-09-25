# Varnostna politika — resource-level avtorizacija (issue #4, §3; R120; R125; R126; R127)

Velja od: **S+9**, razširjeno **R120** (security pass), **R125** (session revocation), **R126** (API-key lifecycle), **R127** (demo production-safe). Modul: `src/lib/access.ts` (+ `src/lib/project-state.ts`, `src/lib/api-keys.ts`).

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

## Servisni principal MOBILE_SYNC (R120; R126 — scope model)

API ključ (`rkm_…`) NI več "manager na ravni VODJA" (to je bil R120 najdeni
problem: en ključ je lahko bral vse, spreminjal projekte, ustvarjal projekte z
poljubnim statusom, vplival na stranke). Je **namenski servisni principal**:

| Pravica (scope) | Dovoljeno? | Opomba |
|---|---|---|
| `projects:read` — read projektov (sync zrcalo) | ✅ z scope-om | dokumentirana servisna pogodba (`projectWhereForPrincipal`); brez scope-a → 403 |
| `projects:write` — sync update/create projektov | ✅ z scope-om | status SAMO prek statusnega stroja, nikoli čez deal-lock; nov projekt IZKLJUČNO `NACRTOVANO` |
| `measurements:create` — ustvarjanje meritev | ✅ z scope-om | `assertProjectAccess` velja tudi tu |
| `photos:write` — nalaganje fotodokumentacije | ✅ z scope-om | POST zahteva 'read' na projektu; DELETE zahteva 'update' (= `projects:write`) |
| `photos:read` — branje fotodokumentacije | ✅ z scope-om | GET zahteva 'read' na projektu |
| brez scope-a (nič od zgoraj) | ❌ | 403 na vsaki sodelujoči ruti |
| brisanje projektov/strank | ❌ | 403 |
| zaklep/odklep (lock) | ❌ | 403 |
| računi (uradni dokumenti) | ❌ | **401 na proxy + 403 v ruti** — R126 je popravil pukljavo: prej je `invoices` spustil apikey kot "manager" |
| naročila / zaloga / dobavitelji | ❌ | **401 na proxy + 403 v ruti** — R126: prej je `material-orders` GET/PATCH smel apikey (bral naročila s cenami, spreminjal status) |
| obhod statusnega stroja | ❌ | `assertTransition`: servis NI manager |

### Lifecycle ključa (R126 — issue #5 §3)

Vsak ključ v bazi nosi:

| Polje | Pomen |
|---|---|
| `purpose` | namenska raba (samo oznaka, ne vpliva na pravice) |
| `scopes` | izrazna scope lista (katalog: `src/lib/api-keys.ts`); neznane vrednosti se spustijo (fail-closed) |
| `projectScope` | omejitev na projekte (ID-ji); null = vsi (sync zrcalo podjetja); z listi → samo ti (tako v `assertProjectAccess` kot v `projectWhereForPrincipal` — seznami in asserti) |
| `expiresAt` | po poteku preverba zavrne (`expired`) — fail-closed |
| `rateLimitPerMin` | per-key proračun zahtevkov/min (privzeto 120); čez → `rate_limited` |
| `rotatedFrom` | povezava na predhodnika pri rotaciji |
| `lastUsedAt` | osveženo ob vsaki uspešni preverbi |

- **Ustvarjanje**: `bun run apikey "ime" [--purpose …] [--scopes …] [--projects id1,id2] [--expires 2027-06-30 | --expires-in-days 365] [--rate-limit 120]`. Poln ključ je viden SAMO ob izpisu (one-time display secret); v bazi je pepper+HMAC-SHA-256.
- **Rotacija**: `bun run apikey -- --rotate <id>` — nov ključ z ISTIMI pravicami (name, purpose, scopes, projectScope, expiry, rate limit), predhodnik se prekliče, `rotatedFrom` poveže. Poln novi ključ je viden samo tokrat. Preglasitev poteka: `--expires`.
- **Preklic**: `bun run apikey -- --revoke <id>`.
- **Pregled**: `bun run apikey -- --list` (stanja: ŽIV / PREKLICAN / POTEKEL + scope-i, projectScope, rotacija).
- **Audit**: `APIKEY_*` življenjski dogodki so v dnevniku lastnika; vsaka neuspešna preverba piše `AUTH_APIKEY_FAIL` z razlogom (`unknown` / `revoked` / `expired` / `rate_limited`) — vmejeno na 30/min/IP, da brute-force ne napolni dnevnika.
- **Plasti**: proxy (Edge) preveri samo OBLIKO žetona za `/api/sync`, `/api/measurement/confirm`, `/api/photos`; ruta je avtoriteta (hash, scope-i, projectScope, potek, rate limit). Vse ostale rute so za API ključe na proxy sploh nedosegljive (401).

- "svoje" = `Project.monterId === session.sub || Project.vodjaId === session.sub`.
- API ključ = strojni servisni principal MOBILE_SYNC. Ni uporabniške pripisnosti:
  `audit.userId = null`; akcije v sync so kljub temu auditirane
  (`SYNC_PROJECT_CREATED` / `SYNC_PROJECT_UPDATED` v ISTI transakciji kot posel).
  Lifecycle (scope-i, projectScope, potek, rotacija, rate limit) — zgoraj.
- `dealLocked` projekt: monter IN servis ne moreta več urejati/spreminjati statusa
  (izključno vodstvo prek eksplicitnih workflow korakov).

## Preverjeno na (S+9 + R120)

- `api/projects` — GET filtrirano po vlogi; PATCH: 403/404 + state machine;
  POST: audit v transakciji.
- `api/measurements` — POST/GET: dostop = dostop do projekta.
- `api/invoices` — POST/PATCH/DELETE: samo vodstvo (uradni dokumenti);
  GET: monter samo svoji projekti.
- `api/material-orders` — POST: vodstvo; PATCH (prejem DOBLJENO): vodstvo +
  skladišče; GET: uporabniški principalci (R126: API ključ → 403).
- `api/inventory` — premiki: vodstvo + skladišče; novo artikel: vodstvo.
- `api/customers` — POST: uporabniki (teren); API ključ ne (niti brisanje).
- `api/sync` (R120) — GET: `projectWhereForPrincipal` skoping (monter = svoje);
  POST: zod shema payloada, per-item rezultati, začetni status samo `NACRTOVANO`,
  prehodi prek statusnega stroja, audit v transakciji.
- `api/photos` (R120) — zaprt cross-project IDOR: GET/POST = 'read' na projektu,
  DELETE = 'update'.
- `api/sketches`, `api/ar-snapshots`, `api/gallery`, `api/documents` (R121) —
  isti IDOR vzorec zaprt (prej samo avtentikacija!): GET/POST = 'read',
  DELETE = 'update'; galerija zahteva guard samo, če ima `projectId`.

## Adversarial testi (vitest, `src/lib/__tests__/`)

- `access.test.ts` — matrika vlog, 403/404 pravila, IDOR scenariji
  (User A → tuj projekt, deal-lock zaščita, apikey semantika).
- `project-state.test.ts` — prehodna matrika, preskoki, vloge.
- `inventory-ledger.test.ts` — transakcijska zaloga, idempotenten prejem
  (1×/10×/vzporedno 8×), negativna zaloga, invarianta vsote.
- `numbering.test.ts` — 10 vzporednih računov = 10 unikatnih zaporednih številk.
- `audit-durability.test.ts` — audit v isti transakciji, rollback brez fantomov.

## Seje — registracija in revokacija (R125, issue #5 §2)

Žeton ostane brezstanjski HMAC (middleware/Edge preveri samo podpis + potek),
ampak `authenticate()` v rutah zahteva ŽIVO vrstico v tabeli `UserSession`
("sejni register"). Fail-closed:

| Scenarij | Rezultat |
|---|---|
| Žeton brez `jti` (izdan pred registrom) | neveljaven → 401 |
| Odjava ene naprave (`POST /api/auth/logout`) | `revokedAt` te seje → isti žeton 401 |
| Odjava vseh ostalih naprava (`{ all: true }`) | ostale žive seje revoke, trenutna ostane |
| Odjava vseh naprava (`{ all: true, current: true }`) | vse žive seje revoke |
| Menjava gesla (`POST /api/auth/password`) | VSE žive seje revoke v isti transakciji (ukraden žeton ne preživi); odgovor `relogin: true` |
| Brisanje profila | cascade briše seje → vsi žetoni mrtvi |
| Potekla vrstica registra | neveljavno (četudi žeton še ni potekel) |

Active-session pregled: `GET /api/auth/sessions` (žive seje lastnika, `current`
oznaka); posamezna naprava: `DELETE /api/auth/sessions/[id]` (tuj `jti` → 404,
ne razkriva obstoja). Lenobno čiščenje poteklih vrstic ob novi prijavi istega
profila. UI: gumb Odjava v TopBar (Ta naprava / Vse naprave).

Testi: `src/lib/__tests__/session-revocation.test.ts` (9 primerov čez prave
route handlerje: legacy žeton, logout, logout-all, menjava gesla + ponovna
prijava, pregled, DELETE tuje seje, potekla vrstica).

## API-key lifecycle (R126, issue #5 §3)

Testi: `src/lib/__tests__/api-key-lifecycle.test.ts` (21 primerov: unknown/
revoked/expired/rate_limited, authenticate context s scope-i, AUTH_APIKEY_FAIL
audit, rotacija (podeduje pravice, predhodnik mrtv, preglasitev poteka),
scope vrata na pravih handlerjih (sync/measurement/photos), projektne omejitve
na ravni vrstic in seznamov, regresiji pukljav: invoices in material-orders
za API ključ → 403).

E2E (dev, HTTP): read-only ključ — sync GET 200 / sync POST 403 /
measurement+photos 403; polni scope — sync POST 200, measurement 400 (zod =
vrata prehojena), photos 404 (vir ne obstaja); neznani ključ 401; rotacija —
stari 401, novi 200; audit vidi `unknown` in `revoked` razloge.

## Demo dostop — production-safe (R127, issue #5 §1)

Modul: `src/lib/demo-access.ts` (edina avtoriteta), ruta `src/app/api/auth/demo/route.ts`.

| Zahteva (#5 §1) | Stanje |
|---|---|
| demo ruta production privzeto OFF | ✅ `demoAccessState()`: brez `DEMO_ACCESS` produkcija → **403** (fail-closed); `on`/`off` eksplicitno; neznana vrednost → OFF |
| demo uporabnik nikoli production ADMIN | ✅ `DEMO_ROLE = 'MONTER'` (matrika: samo svoji projekti, brez cen/računov/zalog); upsert tudi **sniža** obstoječega ADMIN demo profila |
| demo podatki ločeni | ✅ demo (MONTER) vidi IZKLJUČNO projekte, kjer je monter/vodja — realni poslovni podatki so nedosegljivi (`projectWhereForPrincipal`) |
| credentials niso v source/README | ✅ geslo NE obstaja: `passwordHash = NULL` (seed) / naključno zrotirano na vsak demo vstop; prijava prek `/login` forme za demo račun nemogoča; CI secret scan (zgodovinsko demo geslo ne sme obstajati nikjer v repozitoriju) |
| CI secret scan | ✅ korak v `ci.yml` (verify job) |
| production deploy security gate | ✅ migracija `20260925000000_r127_demo_safe` (downgrade ADMIN→MONTER + NULL geslo na že naseljenih bazah, samodejno prek Vercel builda) + smoke [11] |
| test: demo endpoint ne omogoči privileged access | ✅ `src/lib/__tests__/demo-access.test.ts` (11 primerov) + dimni test `tools/security-smoke.py` [11] (demo vloga MONTER na živem strežniku, prijava prek forme → 401) |

Prijavna stran poštuje zastavico `GET /api/auth/demo → { enabled }`: ko je
demo izklopljen, se gumb ne prikaže (noben vabil v slepo ulico). Demo vstop
ostane preklicljiv kot vsaka seja (R125 register: logout/password revoke).

## Offline vrsta — IndexedDB + idempotenca (R128, issue #5 §4)

Terenski zapis (meritev, AR posnetek) NE SME izginiti brez signala. R128
zamenja localStorage z IndexedDB in doda produkcjsko pogodbo
(`src/lib/offline-queue.ts`, `src/lib/idempotency.ts`):

| Zahteva (§4) | Implementacija |
|---|---|
| IndexedDB | `roksal-offline` / store `requests` (indeksi: status, seq, nextAttemptAt); legacy localStorage vrsta se enkrat uvozri in izbriše (nadgradnja brez izgube) |
| brez persistent bearer/API credentialov | vrsta NE shranjuje NOBENE glave — ponovitev pošlje samo httpOnly sejni piškotek + `Idempotency-Key`; kredenciali ne morejo ostati na disku |
| client mutation ID + Idempotency-Key | vsak čakajoč zapis dobi stabilen `mutationId`, poslan kot `Idempotency-Key` ob VSAKEM poizkusu; strežnik shrani snapshot odgovora (`IdempotencyKey` model) — ponovitev vrne ORIGINALNI odgovor (`Idempotent-Replay: true`), brez dvojnika |
| pending/sending/succeeded/failed/conflict | vsa pet stanj; succeeded 24 h (potrdilo), failed/conflict do ročne odločitve (max 7 dni) |
| retry/backoff | 30 s → 1 min → 2 min → … → 15 min strop; flush pošilja samo zapadle |
| conflict resolution | 409 → status `conflict` — UI pas z opozorilom, ročni retry ali ekspliciten izbris (s potrditvijo); tuji principal ne more replayati ključa (vezava na profil/principal → 409, brez razkritja) |
| ordering | monotoni `seq` — flush zaporedno v vrstnem redu nastanka |
| attachment retry | AR posnetki (base64 v JSON telesu) gredo skozi isto vrsto (`webxr-scanner`) — retry z ISTIM ključem, storage write + DB vrstica brez dvojnika (rezervacija pred zapisom) |
| 4xx se ne sme tiho izgubiti | 4xx → `failed` z napako + statusCode — OHRANJEN v pasu do ročne odločitve (prej: localStorage flush je 400/401/422 tiho zavržel) |
| manual retry/recovery | UI pas (PwaStatus): seznam neuspelih z napako/časom/številom poizkusov, retry posameznega/vseh, ekspliciten izbris s potrditvijo; crash recovery: stale `sending` > 5 min → pending |
| test reconnecta za kritične terenske tokove | 12 vitest primerov (fake-indexeddb): enqueue/migracija/sanitizacija/2xx/4xx/409/backoff/vrstni red/recovery/kapaciteta/ročno upravljanje + 5 idempotence primerov čez pravo ruto (isti ključ = natanko ena vrstica, tuj profil 409, neveljaven ključ 400, brez ključa starejša pogodba) + agent-browser E2E (legacy seed → migracija → flush → 400 → pas → retry → izbris) |

Dodatno: kapaciteta 200 vnosov — polna vrsta vrne iskren sintetičen
503 `{ queued:false }` (ni tihe izgube); flush-on-mount (app odprta zjutraj s
signalom → vrsta iz terena odide); GC `IdempotencyKey` vrstic > 30 dni (lenobno,
brez cron odvisnosti); rezervacija ključa je PRVI stavek transakcije meritve —
vzporedni poizkus istega ključa rollbacka celotno mutacijo (exactly-once).

## Še ni pokrito (iskreno, naslednje runde)

- customers/measurements/documents/inventory posamezne IDOR rute imajo guard na
  nivoju modula; END-TO-END HTTP testi (pravi requesti čez strežnik) so del
  acceptance rund za preostale korake issue #4.
- Portal (clientToken) ima lasten model dostopa (javna stranka) — ločena politika.
- `mobileProjectId`: UNIQUE constraint v bazi (R121, dodan po preverbi —
  produkcija 0 duplikatov + lokalno 0). Route-level: `findUnique` + P2002
  catch → idempotentna posodobitev (replay/vzporedni sync NE ustvari
  dvojnika). Duplikati znotraj ENEGA requesta gredo vsak svojo pot.
- Replay zaščita sync POST: trenutno idempotentna po `mobileProjectId`
  (isti payload = update istega zapisa); časovni žig / nonce NI implementiran.
