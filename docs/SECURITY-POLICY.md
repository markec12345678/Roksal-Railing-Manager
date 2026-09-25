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

## CSRF / Origin — centralna preverba (R130, issue #5 §6)

Sejni piškotek je `SameSite=Lax`, kar v sodobnih brskalnikih že blokira
klasični cross-site form POST — a Lax sam ni dovolj (starejši brskalniki,
same-site ≠ same-origin, top-level GET navigacija pošlje piškotek). R130 doda
EKSPPLICITNO centralno plast (`src/lib/csrf.ts`, vgrajena v `proxy()` kot
PRVA vrsta — pred vsemi javnimi preusmeritvami):

| Zahteva (§6) | Implementacija |
|---|---|
| centralna Origin/Referer validation | vsaka mutacija (POST/PATCH/PUT/DELETE) na `/api/*` mora dokazati izvor: `Origin` (odloča izključno, kadar je prisoten) ali `Referer` (rezerva) — gostitelj mora ustrezati `x-forwarded-host`/`Host` ali listi `CSRF_ALLOWED_ORIGINS`; manjka oboje → **403 (fail-closed)** |
| CSRF zaščito, kjer je potrebna | vse `/api/*` mutacije, TUDI javne rute (prijava, demo, register, portal, public measure) — prijava/demo so prav tako cookie-mutacije, ki jih je treba braniti (login-CSRF) |
| ločeno obravnavo Bearer/API-key | klient z `Authorization: Bearer …` je IZJET — ni ambientnega piškotka (CSRF zlori prav piškotek, ki ga brskalnik pošlje sam); cross-site napadalec NE more nastaviti tujega `Authorization` (prepovedana glava brez CORS odobritve) |
| cross-origin POST/PATCH/DELETE teste | 24 vitest primerov (čisto jedro + pravi NextRequest skozi `csrfGuard`) + dimni test [12] na živem strežniku (tuj Origin → 403, brez Origin → 403, isti izvor doseže ruto, Bearer izjema, GET nedotaknjen) + brskalniški E2E (prava prijava s pravim Origin brskalnika) |

Podrobnosti politike (vrstni red pravil je pomemben):

1. varne metode (GET/HEAD/OPTIONS) → dovoljene (branje ni CSRF površina);
2. Bearer overitev → dovoljena (glej zgoraj);
3. `Origin` prisoten → odloča izključno on (Referer je slabši signal:
   `referrer-policy` ga lahko odreže, Origin ne);
4. `Origin` manjka → `Referer` rezerva z enako preverbo;
5. oboje manjka → 403 (brskalnik na mutaciji VEDNO pošlje Origin; klient brez
   obeh je po dokumentirani pogodbi dolžan Bearer).

Normalizacija: male črke, odrezana privzeta vrata (`:443`/`:80`), `x-forwarded-host`
prvi vnos ima prednost pred `Host` (proxy/prembla), literal `null` in nesposobne
sheme (`data:`, `blob:`, `ftp:`) so zavrnjene. `CSRF_ALLOWED_ORIGINS` (veja/lista
polnih izvorov, ločenih z vejico) razširi dostop na točno določene gostitelje
(npr. ločena landinja na lastni domeni); pokvarjeni vnosi ne razširijo ničesar.
Strani (ne-`/api/`) niso predmet preverbe — server actions se ne uporabljajo,
Next pa svoje akcije ščiti sam.

Legitimni ne-brskalniški klienti (E2E orodja, dimni test) na mutacijah
eksplicitno pošiljajo `Origin: <baza>` — enako kot brskalnik; to je dokumentirana
pogodba (enako obnašanje kot Django/Rails CSRF zaščita).

## PWA / cache izolacija (R131, issue #5 §5)

Dokazana pukljava (pred R131): service worker je cacheiral VSE uspešne
`/api/*` GET odgovore v `roksal-v2` in jih nikoli ne počistil — uporabnik A →
odjava → uporabnik B (ali kdorkoli z dostopom do naprave ob mrežni napaki)
je lahko videl A-jeve privatne podatke iz SW cache-a. API odgovori poleg tega
niso imeli `Cache-Control` glave (brskalniški HTTP cache je bil odprt za
heuristiko), odjava pa ni čistila nobenega brskalniškega stanja.

| Zahteva §5 | Implementacija | Dokaz |
|---|---|---|
| privatni API podatki niso javno cacheirani | `next.config.ts headers()`: vsak `/api/*` odgovor nosi `Cache-Control: no-store` (tudi 401/403/404). Next 16 Cache-Control iz middleware-a na route handlerjih odvzame (sonda v E2E je to dokazala), zato je točka prepričanja na nivoju strežnika; middleware nastavi glavo še na lastnih 401 odgovorih | brskalniški fetch `/api/projects` (seja) → `no-store`; dimni [13] na 3 anon površinah |
| logout počisti občutljiv cache | `top-bar.handleLogout`: purge VSI `roksal-*` cache-i (`caches.delete`), `sessionStorage.clear()`, sejski `localStorage` ključ (`roksal_open_photo_id`), identiteta vrste → null. SW poleg tega posluša `ROKSAL_PURGE_CACHES` sporočilo | agent-browser: odjava → `/login`, sessionStorage prazen |
| user A → logout → user B ne vidi A podatkov | SW v3 (`roksal-v3`): `/api/*` GET je **network-only** — ničesar ne shrani in iz cache-a ne servoira. Skupaj z `no-store` HTTP glavo ne obstaja več nobena plast, ki bi hranila API odgovore čez seje | `public/sw.js` — API veja eksplicitno `return` (brez `respondWith`) |
| cache versioning | `CACHE_NAME = 'roksal-v3'`; `activate` izbriše vse starejše cache-e (nadgradnja uniči zastarele podatke); purge handler izbriše VSE | sw.js + stale-cache purge v `activate` |
| stale-data policy | dokazana politika: API odgovori se NIKOLI ne servoajo zastareli (network-only + no-store). Offline navigacija → `/offline.html` — eksplicitno označena zastarela stran, ne silent-stale podatki | offline.html + sw.js komentarji |
| offline retention | pisanje: IndexedDB vrsta (R128) — pending/failed/conflict ostanejo čez odjavo (GC 24 h / 7 dni). Branje: NE retencira. **Lastništvo vrste (novo R131):** vsak zapis nosi `queuedBy`; flush zadrži tuje zapise (uporabnik B ne pošlje tiho A-jevih meritev pod svojo sejo — napačna pripisnost); prevzem je EKSPliciten | vitest 3 nova (zadrži/prevzemi/neznan lastnik) + agent-browser vijoličen pas |
| multi-user browser/device test | agent-browser: A-jev zapis v vrsti → prijava B → vijoličen pas z lastnikom → „Prevzemi in pošlji" → flush pod B-jevo sejo → iskren 400 v rožnatem pasu (4xx nikoli tiho izgubljen) → odjava z varovalko (dialog s števcem, prekinitev ob preklicu) → `/login` + čiščenje | pas s `peter-terenski@roksal.si`, prevzem → `queuedBy: demo@roksal.si` |

Odjava ne počisti: napravnih nastavitev kalkulatorja (`roksal_calc_*`, enote,
laser, RAL — delovno orodje ekipe, ne osebni podatki) in NE izbriše offline
vrste (ni tihe izgube; lastništvo rešuje pripisnost).

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

## Portal stranke — clientToken življenjski cikl (R132, issue #5 §7)

Dokazana pukljava (pred R132): clientToken je bil TRAJNI javni ključ — veljal
večno, brez revokacije, brez dostopnega dnevnika, brez omejitve hitrosti;
generiran z `Math.random()` (ni kripto). Upravljanje (/api/portal) je imelo
projektni IDOR (brez assertProjectAccess) in je delilo žetone z API ključi.

| Zahteva §7 | Implementacija | Dokaz |
|---|---|---|
| expiry | `clientTokenExpiresAt`: enable/regenerate nastavita privzeto **90 dni** (payload `expiresInDays`, clamp 1..365); migracija r132 je ŽE omogočenim portalom backfillala 90 dni | vitest (89–91 dni, clamp) |
| revoke | akcija `revoke`: `clientTokenRevokedAt` → žeton MRTAV (stran 404), UI gumb z potrditvijo | vitest + brskalniški E2E (reload → „Stran ni na voljo") |
| regenerate | NOV kripto žeton (`randomBytes(18)` base64url), stari mrtav, revokedAt počiščen, svež potek; enable ROTIRA zastarele pre-R132 žetone (cuid ni kripto) | vitest (nov ≠ star, stari → 404) |
| access log | NOV model `PortalAccess`: vsak poskus (OK / NOT_FOUND / DISABLED / EXPIRED / REVOKED / RATE_LIMITED / INVALID) z **hashiranim IP** (sha256+pepper, brez surovega IP) in UA; `clientTokenLastUsedAt` za pisarno | vitest + dev baza (OK+REVOKED vrstici) |
| shared rate limit | `checkRate('portal:<ipHash>', 60/10 min)` — EN vzvratni števec za stran in JSON, pred bazo; 429 + `Retry-After` + dnevnik | vitest (61. zahtevek 429) |
| minimalni DTO | `select` namesto `include` — samo polja za izris; timeline = kurirani naslovi (brez surovih AuditLog zapisov, oldValue/newValue nikoli v odgovoru) | vitest (raw nima oldValue/ipAddress) |
| private photo access | zapisi z `storageKey` hydrata strežnik prek `getObject` (stran); JSON ruta prenasa samo meta + zapuščinski imageData; manjkajoč artefakt = slika izpuščena z napako v logu (ni taji) | obstoječi R121 tok, potrjen |
| cache protection | `/api/portal/*` pod centralnim `no-store` (R131); stran = HTML brez uporabniških podatkov | dimni [14] |
| share/read-only policy | portal je izključno GET (branje); vse mutacije ostanejo za sejo + assertProjectAccess | koda + smoke |
| enumeration protection | vsa neveljavna stanja (neznan/potekel/preklican/onemogočen) = **ISTA 404** z istim telesom (`PORTAL_UNAVAILABLE`); visoka entropija žetona + rate limit | vitest (isti JSON) |
| upravljanje (dodatno) | samo uporabniške seje (API ključ → 403); `assertProjectAccess` na GET (read) in POST (update) — IDOR zaprt; audit z pravim akterjem (prej 'system') | vitest (IDOR 403, apikey 403) |

Enotni vir resnice: `src/lib/portal.ts` (veljavnost, žeton, potek, ipHash,
dnevnik) — uporablja jo HTML stran `/portal/[token]` IN JSON ruta
`/api/portal/[token]` (prej sta imeli RAZLIČNI validaciji).

## Javna samomeritev — scoped žeton (R133, issue #5 §8)

Površina `/api/public/measure` + stran `/m/[token]` (stranka sama nariše črto
ograje na satelitski karti in pošlje meritev) je prej uporabljala
`Project.clientToken` — ISTI žeton kot portal stranke — brez preverbe poteka/
revokacije, z lastnim in-memory limiterjem (resetira se ob restartu), brez
idempotence (retry stranke = dvojnik), brez zaščite pred duplikati in brez
audit sledi. Poleg tega je merilni klient (Leaflet) padel med SSR za VELJAVNE
povezave (`window is not defined` → 500) — napaka, ki jo neveljavne poti
nikoli niso razkrile (dolgo skrit bug, najden z E2E tokom te runde).

| Zahteva §8 | Implementacija | Dokaz |
|---|---|---|
| scoped token | NOV ločen `Project.measureToken` (migracija r133): merilna povezava NI več portal žeton — revokacija/potek portala ne vpliva nanj in obratno; backfill = kopija clientToken + 90 dni (kontinuiteta obstoječih povezav, določen — ne tih) | vitest + E2E (ločena akcija, ločen URL) |
| expiry/revoke | `measureTokenExpiresAt` (privzeto 90 dni, clamp 1..365) + `measureTokenRevokedAt`; `measureValidity`: REVOKED > DISABLED > EXPIRED > OK; enable na preklicanem žetonu izda NOVEGA (revokacija je trajna — popravljeno tudi pri portal enable, ki je pustil revokedAt postavljen) | vitest (veljavnost + enable-after-revoke) |
| shared rate limit | skupni `checkRate` žebrki (src/lib/rate-limit.ts, isti vir kot prijava/portal): GET 30/10 min na IP, POST 6/h na žeton + 10/h na IP; 429 + `Retry-After` + dnevnik | vitest (31. GET → 429) |
| idempotency | `Idempotency-Key` (opcijski, a ko pride, je obveza — neveljaven → 400) prek R128 infrastrukture: transakcijska rezervacija = PRVI stavek (po validaciji), snapshot odgovora v ISTI transakciji, principal `public:measure`; replay = ISTI odgovor + `Idempotent-Replay: true` | vitest (race → replay, natanko 1 vrstica) |
| duplicate protection | determinističen `dedupeHash` (projekt + točke 6 dec. + skupajM 1 dec. + višina, pepper) — identična oddaja v 30 min vrne OBSTOJEČO meritev (200, `duplicate:true`); ščiti pred dvojnim tap-om in retry-i z novim ključem | vitest (isti id, count=1) |
| anti-abuse | strop surovega telesa 8 kB → 413 (prej samo v komentarju); max 300 točk (zod); dva neodvisna žebrka (IP + žeton); vsak zavrnjen poskus v dnevniku z razlogom | vitest (413/400/404) |
| ownership | `Measurement.createdBy = 'public:measure'` (jasen izvor, ločen od terenskih meritev) + `dedupeHash` na vrstici | vitest |
| omejene mutacije | javna površina ustvari SAMO meritev (nič drugega ni dosegljivo brez seje); GET vrne izključno naziv projekta + ime stranke | koda + smoke [15] |
| audit | vsak poskus (VIEW/SUBMIT/DUPLICATE/REJECTED) v AuditLog z **hashiranim IP** (sha256+pepper, 32 hex — surov IP se NE shranjuje, isti dogovor kot PortalAccess) + UA; vzdržljiv (await — naučen v R132) | vitest + E2E (audit-check) |
| SSR popravek | merilni klient se naloži LEN prek `dynamic(..., { ssr: false })` (`measure-lazy.tsx`) — Leaflet na uvozu zahteva `window`; prej je veljavna povezava vrwala 500 | E2E (stran 200 + Leaflet renderan) |

Enotni vir resnice: `src/lib/measure.ts` (veljavnost, resolve, dnevnik,
dedupe hash, omejitve) — uporabljata ga HTML stran `/m/[token]` IN obe rute
`/api/public/measure`. Upravljanje (enable/disable/regenerate/revoke +
`measureExpiresInDays`) je v `/api/portal` (seja + assertProjectAccess),
z novimi akcijami `measure*` (audit: `MEASURE_ENABLE` … `MEASURE_REVOKE`).

Znan meji (iskreno): dedupe je best-effort poleg idempotence — dva VZPOREDNA
prva pošiljanja z različnima ključema in identično vsebino imata majhno okno
za tekmo (obračunava se z idempotence ključem stranke, ki ga pošilja naša
stranka). Rate limiter ostane in-memory (dokumentirano pri `checkRate`) —
za več vozlišč se zamenja shramba, vmesnik ostane.

## Življenjski cikl uporabnikov (R134, issue #5 §9)

Prej so imeli profili SAMO vlogo: brez deaktivacije, zaklepa, povabil ali
prisilne zamenjave gesla. Deaktiviran uporabnik je lahko nadaljeval z že
izdanim žetonom (seje so žive do poteka); edini "izklop" je bilo brisanje
profila (cascade — uniči revizijske sledi). E-poštne infrastrukture ni, zato
je povabilo/aktivacija in reset gesla rešeno z enkratnimi povezavami/gesli,
ki jih pisarna posreduje po SMS/telefonu (deterministično, brez zunanjih
odvisnosti).

| Zahteva §9 | Implementacija | Dokaz |
|---|---|---|
| invite | akcija `invite` (samo ADMIN): profil BREZ gesla + aktivacijski žeton (crypto 24 base64url); v bazi IZKLJUČNO sha256 hash (+ pepper, unique), čistega NIKOLI; poteče 7 dni; odgovor vrne povezavo ENKRAT | vitest (hash ≠ žeton, 6–7 dni, 409 dvojnik) |
| activation | javna ruta `/api/users/activate` + stran `/aktivacija/[token]` (obe javni prek proxy, fail-closed): nastavi geslo + počisti žeton (enkratna uporaba); neznanski/potečen/porabljen/deaktiviran → ISTA 400/istа stran (enumeration protection); rate limit 6/h/IP | vitest (replay = neznanski) + E2E |
| deactivate/reactivate | `deactivatedAt` + revoke vseh živih sej; **assertSessionAlive preverja status ob VSAKEM zahtevku** → že izdani žeton deaktiviranega uporabnika preneha delovati TAKOJ (hard requirement); reactivate vrne račun v delo | vitest + E2E (token → 401 takoj) |
| password reset | brez e-pošte: admin `resetPassword` izda kripto začasno geslo (ENKRAT v odgovoru; v dnevniku NIKOLI) + `mustChangePassword=true` + revoke vseh sej; prijava dela, `GET /api/auth` nosi zastavico; menjava gesla (/api/auth/password) jo počisti | vitest (stari žeton mrtev, gesla brez sledi) |
| email change | samo-servis `/api/auth/email`: TRENUTNO geslo obvezno (ukradena seja ne zadostuje), unikatenost (409), revoke drugih sej (trenutna ostane), audit staro/novo | vitest (403/409/200 + prijava z novo) |
| role change | `setRole` (samo ADMIN): žeton nosi vlogo (snapshot) → vse seje revoke (nova vloga velja po ponovni prijavi); audit vsebuje novo vlogo | vitest (žeton po spremembi 401) |
| account lock | `lock`/`unlock` (samo ADMIN): prijava → 403 z jasnim sporočilom + LOGIN_BLOCKED dnevnik; blokiran račun ne upravlja z identiteto | vitest |
| session revoke | prejšnje runde (§2 register sej) — deaktivacija/zaklep/role-change/reset/email-change VSI revoke-ajo seje; assertSessionAlive je avtoritativna plast | vitest + E2E |
| offboarding | deaktivacija = offboarding: blokada + revoke + ohranjene revizijske sledi (proti brisanju profila); self-guard: ADMIN ne deaktivira/zaklene/spremeni vloge sebi | vitest (400) |
| dostop | upravljanje = samo ADMIN seja (VODJA bere, MONTER/SKLADISCE/API ključ → 403); login preverja blokado ŠELE za uspešnim geslom (brez pravic ne izveš statusa tujega računa) | vitest (matrica) |

UI: nova površina **Ekipa** (Več meni) — seznam računov s statusi (Aktiven /
Deaktiviran / Zaklenjen / Čaka aktivacijo / mora zamenjati geslo), akcije z
varovalkami, ENKRATNI prikaz aktivacijske povezave in začasnega gesla (dialog
s kopiranjem). Pas prisilne zamenjave gesla (PasswordChangeBanner) se prikaže
na vseh zavihkih, dokler uporabnik gesla ne zamenja.

Znan meji (iskreno): povabila/reset brez e-pošte — povezavo/geslo posreduje
pisarna offline (dokumentirano v UI); brez e-poštne infrastrukture je to
edini determinističen potek. Deaktivacija NE briše podatkov (revizijska
sled ostane; brisanje je ločena, nevarnejša akcija).

## Matrika dovoljenj — vsaka ruta preverja konkretno pravico (R135, issue #5 §10)

Do R135 je večina poslovnih rut preverjala VLOGO (`denyUnless(request, MANAGER_ROLES)`),
kar je delovalo, a ni bilo formalizirano: pravice so bile razpršene po rutah, sporočila
403 nespecifična, UI pa je ugibal po vlogah. §10 zahteva **katalog dovoljenj**, kjer
vsak endpoint preverja KONKRETNO pravico.

**Enoten vir resnice: `src/lib/permissions.ts`** — katalog (28 pravic: 26 iz §10 spec +
2 read-dodatka `users.read`/`invoices.read` za natančen izraz obstoječe matrike branja),
vloga → pravice (frozen, deterministično), API-ključ scope-i → pravice, pomožniki
(`hasPermission`, `permissionsForPrincipal`, `describePermission`).

**Vrata na ravni zahtevka: `denyWithoutPermission(request, permission)`** (auth.ts) —
401 anon / 403 API ključ / 403 z imenom manjkajoče pravice (slovenska oznaka + tehnično
ime) v `detail`. Odjemalec dobi svoje pravice prek `GET /api/auth` (`permissions: []`),
zato UI skriva akcije, ki jih uporabnik ne more izvesti, in pošteno pokaže stanje
"Ureja pisarna" namesto mrtvega gumba (strežnik bi vseeno vrnil 403 — UI je le
izkustvena plast, NE varnostna).

| Vloga | Pravice |
|---|---|
| ADMIN | vseh 28 |
| VODJA | 27 (vse razen `users.manage`) |
| MONTER | terenskih 11: projects.*, customers.*, quotes.create, deal.lock, inventory.read, invoices.read, documents.* (read/generate/sign) |
| SKLADISCE | skladiščnih 7: projects.read, customers.read, inventory.read/write, procurement.receive, invoices.read, documents.read |
| API ključ (MOBILE_SYNC) | izključno preslikava scope-ov: `projects:read`→projects.read, `projects:write`→projects.write; uradne površine (računi, dokumenti, portal, users, cene) NIKOLI |

| Ruta | Prej (vloga) | Zdaj (konkretna pravica) |
|---|---|---|
| POST/PATCH `/api/material-prices` | MANAGER | `price.override` |
| POST `/api/profili`, `/api/suppliers` | MANAGER | `catalog.manage` |
| POST `/api/inventory` (nov artikel) | MANAGER | `catalog.manage` |
| POST `/api/inventory` (premik) | MANAGER+SKLADISCE | `inventory.write` |
| POST `/api/material-orders` | MANAGER | `procurement.create` |
| PATCH `/api/material-orders` | MANAGER+SKLADISCE (vsi prehodi) | `procurement.approve` (vodstvo: vsi prehodi); SKLADISCE samo `procurement.receive` (status → DOBLJENO) — usklajeno s komentarjem "prejem je skladiščna operacija" |
| `/api/schedules`, `/api/crews` (mutacije) | MANAGER | `production.manage` |
| GET `/api/invoices` | vse vloge (monter svoje) | `invoices.read` (monter še vedno vidi svoje projekte) |
| POST/DELETE `/api/invoices` (osnutek) | MANAGER | `invoices.create` |
| PATCH `/api/invoices` → IZDAN/PLAČAN | MANAGER | `invoices.issue` |
| PATCH `/api/invoices` → STORNIRAN | MANAGER | `invoices.cancel` |
| GET `/api/users` | ADMIN+VODJA | `users.read` |
| POST `/api/users` | ADMIN | `users.manage` |
| POST `/api/portal` (upravljanje) | user + project update | `portal.manage` + project update (IZRECNA ZOŽITEV: monter ne upravlja portalov — pisarna; UI to pošteno prikaže) |
| POST `/api/deal-lock` | user + project update | `deal.lock` + project update (monter OHRANI pravico — podpis poteka na terenu) |
| POST `/api/documents` | user + project read | `documents.generate` + project read (IZRECNA ZOŽITEV: API ključ ne generira uradnih dokumentov) |
| POST `/api/signature-audit` | user + project update | `documents.sign` + project update |
| POST `/api/quote` | user | `quotes.create` (IZRECNA ZOŽITEV: API ključ ne izdeluje ponudb) |
| POST `/api/customers` | user | `customers.write` (isti set, formaliziran) |

Rezervirane pravice (v katalogu, brez rute — dokumentirano, da UI/dokumentacija govorita
isti jezik, ko bo površina nastala): `measurements.approve`, `quotes.approve`,
`inventory.adjust`, `warranty.manage`.

Dokazi: `src/lib/__tests__/permissions.test.ts` (18 testov — katalog integrity, matrika,
fail-closed neznana vloga, API-ključ preslikava, vrata 401/403 z imenom pravice, spot-testi
rut: portal MONTER → 403 `portal.manage`, users VODJA → 403 `users.manage`, invoices MONTER
→ 403 `invoices.create`/`invoices.issue`, material-orders SKLADISCE receive-only, prices
MONTER → 403 `price.override`) + varnostni smoke [17] (4 preverjanja).

## DB integriteta + atomske transakcije (R136, issue #5 §18 + §19)

### §18 — Database constraints (baza kot ZADNJA linija obrambe)

Migracija `20260925223000_r136_db_constraints` (PostgreSQL-only; brez nje gradnja FAIL):

| Omejitev | Tip | Namen |
|---|---|---|
| `invoice_amounts_nonnegative` | CHECK (NOT VALID) | osnova, DDV, znesek, rok ≥ 0 |
| `invoice_status_allowed` | CHECK (NOT VALID) | status ∈ {OSNUTEK, IZDAN, PLACAN, STORNIRAN} |
| `invoice_tip_allowed` | CHECK (NOT VALID) | tip ∈ {PREDRACUN, RACUN, PREDPLACILNI} |
| `inventory_stock_nonnegative` | CHECK (NOT VALID) | zaloga in min. zaloga ≥ 0 (negative stock NI tiho dovoljen) |
| `order_item_quantity_positive` | CHECK (NOT VALID) | količina > 0, cena ≥ 0 |
| `order_total_nonnegative` | CHECK (NOT VALID) | skupajCena ≥ 0 |
| `usage_quantity_positive` | CHECK (NOT VALID) | porabljena količina > 0 |
| `price_nonnegative` | CHECK (NOT VALID) | cena ≥ 0 |
| `material_price_no_overlap` | **EXCLUDE (validated)** | za isti (material, dobavitelj) se veljavnostni okni NE SMESTA prekrivati (`tsrange '[)'`, btree_gist) |
| `PortalAccess_projectId_fkey` | FK (bila R132 vrzel) | referenčna integriteta dostopov portala |
| kompozitni indeksi | 3 | AuditLog (projectId+timestamp, akcija+timestamp), Invoice (projectId+status) — revizija brez sekvenčnih skenov |

**NOT VALID strategija** (fail-closed brez tveganja deploja): CHECK veljajo takoj za VSE NOVE
zapise; legacy vrstice se ne skenirajo (ni dolge blokade, ni deploja, ki pade na star podatek).
Dev baza: 0 kršitev (skripta `scripts/r136-constraint-audit.cjs`). `VALIDATE CONSTRAINT` sledi
kot ločen korak, ko je produkcijska data enkrat preverjena (follow-up, ne tiha zaobvoz).

**EXCLUDE tehnična opomba**: Prisma DateTime = `timestamp(3) WITHOUT time zone` → range mora
biti `tsrange` (ne `tstzrange` — implicitni cast na timestamptz je STABLE, PostgreSQL zato
zavrne indeksni izraz). Polodprt interval `[)` je usklajen z API vzorcem zapiranja cen.

### §19 — Atomske poslovne transakcije (crash = rollback, nikoli delno stanje)

| Operacija | Prej (riziko) | Zdaj |
|---|---|---|
| `/api/users` vse akcije (invite/deactivate/lock/setRole/resetPassword) | profil + revoke sej + audit = 2–3 ločena write-a → crash pusti deaktiviranega z ŽIVIMI žetoni (kršitev §9) | ENA transakcija: profil + revoke (`revokeAllForUser(…, tx)`) + `auditInTx` |
| `/api/schedules` PATCH → ZAKLJUČENO | termin + projekt + N×(zaloga−, premik) ločeno → delna poraba, ne-idempotentno (ponovni zaključek = dvojni odštevek) | ENA transakcija; **pogojni decrement** (`WHERE kolicinaZaloga >= kolicina`) — nezadostna zaloga → 409 z imenom materiala, ČISTA rollback |
| `/api/schedules` POST | termin + status projekta + audit ločeno | ENA transakcija (+ audit API-ključ → ADMIN profil namesto FK-invalid 'system') |
| `/api/material-prices` POST | zapri staro ceno + ustvari novo = 2 write-a → crash pusti DVE odprti ceni (= edini možen kršitelj EXCLUDE) | ENA transakcija + `GREATEST(veljavnostOd, zdaj)` proti odmiku ur (veljaven range tudi pri clock skew) |
| `/api/portal` POST | žetoni + audit ločeno (audit lahko pade tiho) | ENA transakcija |
| `/api/customers` POST | stranka BREZ vsakega revizijskega vpisa | ENA transakcija + `CUSTOMER_CREATED` z akterjem |
| `/api/material-orders` POST | nevalidni količini/cena → surov 500 (DB CHECK), neznani inventoryId → FK 500 | 400 z jasnim sporočilom (app plast pred bazo); OBSTOJEČA transakcija nespremenjena |

**Sprememba vedenja (izrecna, ne tiha)**: zaključek termina ne more več spraviti zaloge pod 0.
Prej je šlo tiho v minus (ne-idempotentno in zmeda v bilanci); zdaj → 409 „Zaloga … ni dovoljša"
in CELO transakcija se vrne. Pisarna najprej dopolni zalogo (ali prilagodi BOM), nato zaključi
termin. Že izdani MATERIAL_ZALOGA ledger ostane konsistenten.

Dokazi: `src/lib/__tests__/db-integrity.test.ts` (10 testov — omejitve v pg_constraint, direktni
SQL kršitve zavrnjene, EXCLUDE par/dobavitelj semantika, 409 + ČISTA rollback na nezadostni
zalogi, točen odštevek + premik + MONTIRANO + revizija atomsko, 400 polja naročil, GREATEST
zapiranje cen, schema higiena) + varnostni smoke [18] (4 preverjanja).

## Nastavitvena konzola — lastnikova varovalka (R137)

**Problem:** na produkciji ni bilo mogoče pridobiti ADMIN dostopa iz aplikacije same — registracija daje izključno MONTER, upravljanje uporabnikov pa zahteva ADMIN sejo. Izgubljeno geslo lastnika ali prazen production sistem je pomenil trajno izključenost (produkcija baza je dosegljiva izključno prek Vercel env).

**Rešitev:** `/setup` + `POST /api/setup`, zaščitena z žetonom iz okolja. Dva env var-ja (oba lastniška, oba NESTA v repozitoriju):

| Env var | Pomen |
| --- | --- |
| `ROKSAL_SETUP_TOKEN` | Dolg naključen žeton (min 16 znakov). Ni nastavljen ALI prekratek → konzola POPOLNOMA izklopljena (POST 404, GET `{enabled:false}`). |
| `ROKSAL_SETUP_EMAIL` | Opcijsko ožilje: nastavljen → sme konzola ustvariti ALI obnoviti IZKLJUČNO ta račun. Pokvarjen vnos = kot da ni nastavljen (ne razširi ničesar). |

| Zahteva | Izvedba |
| --- | --- |
| Fail-closed privzeto | brez žetona v okolju ruta vrne 404 in stran iskreno pokaže "izklopljena" (brez lažne forme) |
| Konstantnočasna primerjava žetona | sha256 obeh strani + `timingSafeEqual` (dolžina ne povzroči izjeme) |
| Rate limit | 5/uro/IP — šteje TUDI napačne žetone; veljavne uspešne/ne-uganitvene napake sprostijo žeton (`releaseRate`) |
| Ožilje obstoječih računov | BREZ `ROKSAL_SETUP_EMAIL` obstoječih računov NIKOLI ne dotakne (žeton ni mojstrski ključ za prevzem); z ožiljem samo točen e-naslov → RECOVER |
| RECOVER atomsko (§19) | novo geslo + vloga ADMIN + odpeljane blokade (deactivatedAt/lockedAt) + počiščena povabila + REVOKE VSEH sej v ENI transakciji |
| BOOTSTRAP atomsko (§19) | nov ADMIN profil + audit v ENI transakciji; geslo hashano izven tx (R136 vzorec) |
| Revizija vsakega poskusa | `SETUP_BOOTSTRAP` / `SETUP_RECOVER` / `SETUP_DENIED` / `SETUP_FAILED` z hashiranim IP (32 hex, surov IP nikoli) — vzorec §7/§8 |
| Enumeracija | 403 na politiki ožilja NE razkriva, ali račun obstaja |
| Javna površina | GET razkrije samo `{enabled}`; vrata so v proxy dodana kot javna (mutacije vseeno prek CSRF/Origin, R130) |

Znan mejnik: uspešna uporaba konzole je revizijsko vidna, žeton pa ostane veljaven, dokler ga lastnik ne odstrani iz okolja — priporočilo (izpisano tudi na strani): po uporabi žeton odstrani.
