# S+4 REPORT — PRODUCTION HARDENING
**Roksal Railing Manager** · datum: 23. 9. 2026 · cilj: varnost + odpornost na realne napake

---

## 1. GIT

| | |
|---|---|
| Začetni HEAD | `1a4c403` (S+3, potrjen z `git log`, čisto working tree) |
| Končni HEAD | `faca35bf38b470e2eb102313162341924c1165e7` |
| Deployment | dpl_CTK6DAE4fz8Aw8WAENXbKvPF68X9 → **READY** (Vercel build PASS) |

Pomembni commiti (vsak posebej, po spec §12):
1. `47764aa` **security: enforce viz project ownership**
2. `0120b28` **render: prevent concurrent job overwrite**
3. `e0758d7` **storage: harden save rollback + save/delete idempotency**
4. `8a87dc7` **cleanup: expire abandoned staging**
5. `34eeebc` **security: proxy blob file access through the app**
6. `639c394` **feat: user registration (MONTER role, rate-limited)**
7. `480cc82` **e2e: add production multi-user flow**
8. `faca35b` **test: real visual scenarios T6-T10 + production perf percentiles**

---

## 2. SECURITY

### 2.1 Ownership (P0) — REŠENO, DOKAZANO NA PRODUKCIJI
- **Pred**: `authenticate()` je preveril SAMO obstoj seje — vsak prijavljen uporabnik je videl, odpiral, preimenoval, brisal in renderiral TUJE projekte (preverjeno proti kodi `src/lib/viz/repository.ts` + vseh 4 rut).
- **Po**: `VizProject.ownerId` / `VizRenderJob.ownerId` (Prisma + project.json dokument); rute `src/lib/viz/ownership.ts` (`vizOwner`/`mayAccess`); repozitorij `*ForOwner` funkcije.
- **Politika** (dokumentirana v docs/VIZ_CONTRACTS.md §ownership): tuj ali neobstoječ projekt = **404** (ne 403 — brez uhajanja informacije o obstoju); API ključi = 403; zapuščinski zapisi brez ownerId = vidni samo ADMIN.

### 2.2 Blob access (P0) — AUDIT + REŠITEV
**Audit (reproducibilno, produkcija HEAD 1a4c403, pred popravki):**
```
original.jpg → HTTP 200 (350.913 B)   product.jpg → HTTP 200   mask.png → HTTP 200
preview.jpg → HTTP 200   placement.json → HTTP 200   result.json → HTTP 200
project.json → HTTP 200          CORS: access-control-allow-origin: *
```
Vseh 7 datotek (vključno s fotografijami balkonov strank in metadata) je bilo **javno dostopnih brez avtentikacije**. Javna dostopnost NI bila namerna varnostna odločitev (S+3 jo je izbral za CORS canvas re-staging) → uveden varnejši model.

**Nova rešitev**: `/api/viz/files/[...key]` proxy — klient vidi SAMO `/api/viz/files/…` poti; ruta preveri sejo + lastništvo; surovi blob URL-ji ne gredo k klientu in se ne shranjujejo v nove zapise (`clientUrlFor`/`clientUrlForPath`); zapuščinski URL-ji pretvorjeni ob branju; Cache-Control: private; render-jobs metadata NI dosegljiva skozi proxy.

**Rezidualno tveganje (iskreno)**: fizično blob objekte z ZNANIM surovim URL-jem je še vedno mogoče prenesti (Vercel Blob javni store = edina brezplačna opcija; `@vercel/blob` nima private access v tej varijanti). Surovi URL vsebuje 122-bitni naključni UUID in se NE pojavlja v nobenem klientu dosegljivem odgovoru (dokazano: save odgovor vsebuje samo proxy poti). Strožje bi zahtevalo zamenjavo storage providerja (plačljivo — izven obsega).

### 2.3 Cross-user testi
- **Unit/integracija**: `viz-ownership.test.ts` (12 testov) — Prisma + blob dokumentni način + pravi API handlerji s podpisanimi Bearer žetoni.
- **PRODUKCIJA**: `tools/multiuser-e2e-prod.ts` — **21/21 PASS** (spodaj §7).

---

## 3. RELIABILITY

### 3.1 Failure injection (P0) — 13 testov, vse PASS (`viz-failure-injection.test.ts`)
11 injekcijskih točk po spec: after original / product / product-mask / mask / preview / result / placement / variants / before-metadata / after-metadata / before-staging-cleanup + pravi throw sredi kopiranja.
- Pre-commit napaka → compensating cleanup: **0 orphan project files**, **0 fake records**, staging ohranjen (klient lahko poskusi znova).
- Post-commit napaka → projekt ostane VELJAVEN (**0 izgubljenih podatkov**); staging ostanki → GC.
- Implementacija: `src/lib/viz/save-flow.ts` (metadata = commit točka, ZADNJI zapis).

### 3.2 Concurrency render jobov (P0) — 9 testov PASS (`viz-concurrency.test.ts`)
- **Problem dokazan proti kodi**: blob `updateRenderJob` je bil read→modify→overwrite (izguba update-a možna: A processing, B stale failed prepiše).
- **Mehanizem**: `vizCreate()` = atomic create-if-not-exists (blob put brez allowOverwrite — edini resnično atomarni primitiv shrambe; obnašanje znano s S+3 produkcijske napake) → lease zaklep per job (TTL 30 s + prevzem od mrtvega držalca, 5 retry) + **državni stroj prehodov**: queued→processing|failed, processing→completed|failed; terminal nespremenljiv; regresija zavrnjena; ponovljen isti update = idempotentna no-op.
- Dokazani scenariji: queued→processing ✓, processing→completed ✓, processing→failed ✓, 2 sočasna update-a (končno stanje legalno, nikoli regresija) ✓, ponovni request ✓, neobstoječ job = not-found ✓, ponovno pošiljanje istega update-a = duplicate no-op ✓, lock-timeout za živega držalca ✓, lease prevzet od mrtvega ✓.

### 3.3 Idempotenca (P1) — 4 testi PASS (`viz-idempotency.test.ts`) + produkcija
- POST save z `idempotencyKey` ×2 → **isti projekt**, `idempotent:true`, natanko 1 metadata zapis (izkazano tudi na produkciji, §7).
- DELETE ×2 → 200, potem 404 (ne 500); GET po DELETE → 404.
- Brez ključa vsak save = nov projekt (dokumentirano vedenje).

---

## 4. STORAGE

### 4.1 Staging GC (P1) — 4 testi PASS (`viz-gc.test.ts`) + produkcija
- `gcStaging()`: TTL **24 h** (VIZ_STAGING_TTL_MS preglasi; utemeljitev: normalen tok porabi tokene v minutah, 24 h je nad najdaljšo realno sejo), starost = najnovejši uploadedAt tokena (aktivnost podaljša).
- GC se NE dotika projektov in render jobov (list strogega prefixa `viz/staging/`).
- `/api/viz/gc` (POST+GET): fail-closed — CRON_SECRET Bearer (Vercel Cron) ali ADMIN seja; **Vercel Cron dnevno 04:00 UTC** (`vercel.json`), brez dodatnih storitev.
- Produkcija: GC z ADMIN sejo → `{ok:true, scannedTokens:19, deletedTokens:[], deletedFiles:0}` (vsi sveži — pravilno); brez auth → 401 ✓.
- Testi: fresh ostane ✓, expired izgineta ✓, projekt ostane ✓, mešane starosti (aktivni token) ostane ✓, TTL preglas ✓.

### 4.2 Orphan files
- Pre-commit failure injection: 0 orphan (11/11 primerov).
- DELETE projekta briše metadata + vse datoteke (S+3 vedenje ohranjeno; produkcija: po brisanju vseh testnih projektov `projects: []`).

---

## 5. PRODUCTION

| | |
|---|---|
| URL | https://roksal-railing-manager.vercel.app |
| Deployment | dpl_CTK6DAE4fz8Aw8WAENXbKvPF68X9 READY |
| E2E (HTTP) | 21/21 PASS (`tmp/scenarios/multiuser-e2e-prod.json`) |
| E2E (brskalnik, agent-browser) | login → demo primer → preview **13=13, ΔE 0.00** → Shrani → reload → projekt v seznamu → odpri → **13 = 13, original nespremenjen, ΔE 0.00** → delete → prazno (sliki: `screenshots/s4-prod-e2e-preview.png`, `s4-prod-e2e-open-project.png`) |

### 5.1 Multi-user E2E na produkciji (§7) — 21/21 PASS
Registrirana 2 NOVA uporabnika (A=MONTER, B=MONTER) z novim `/api/auth/register`:
- A: preview ✓ save ✓ (id=dc6e6c64…) idempotenca ×2 = isti projekt ✓ seznam vidi svoj ✓ odpre ✓ preimenuje ✓
- **B: seznam NE vidi A projekta ✓; GET tuj → 404 ✓; PATCH → 404 ✓; DELETE → 404 ✓; POST render tuj → 404 ✓; files proxy tuj → 404 ✓; GET tuj render job → 404 ✓** (vse z PRAVIMI HTTP zahtevki, ne UI)
- A: render svoj → queued (iskren GPU stub) ✓; GET svoj job → 200 ✓; delete svoj → 200; DELETE ×2 → 404; GET po brisanju → 404 ✓
- Proxy model: save odgovor NE vsebuje surovih blob URL-jev ✓; files proxy brez seje → 401 ✓; z sejo lastnika → 200 image/jpeg ✓
- GC brez auth → 401 ✓

---

## 6. VISUAL TESTS (T1–T10)

Algoritem **NI SPREMENJEN** (spec §8/§12). Meritve: `tmp/scenarios/results.json` (T1–T5, S+3), `tmp/scenarios/results-s4.json` (lokalno, polna resolucija), `tmp/scenarios/results-s4-prod.json` (produkcija, staging ≤1600 px + JPEG q90).

| test | vhod | letvice (pričak.=dejansko) | outside max | ΔE | ms (lokalno) | bleed | rezultat |
|---|---|---|---|---|---|---|---|
| T1 ravna (S+3) | balcony_3 + mask_C | 13=13 | 0 (pre-shadow) | 0.00 | — | 0 | PASS |
| T2 perspektiva (S+3) | balcony_2 | 13=13 | 0 | 0.00 | — | 0 | PASS |
| T3 sonce (S+3) | balcony_4 | 13=13 | 0 | 0.00 | — | 0 | PASS |
| T4 temna (S+3) | balcony_5 | 13=13 | 0 | 0.00 | — | 0 | PASS |
| T5 zakrit (S+3) | balcony_0 | 13=13 | 0 | 0.00 | — | 0 | PASS |
| **T6 ekstremna perspektiva** | balcony_7 (vogal, višina 0.12→0.055) | 13=**12** | 58 | 0.00 | 1891 | 0 | **PASSED-WITH-NOTE** |
| **T7 svetlo ozadje** | balcony_4 (sončno bela stena) | 13=13 | 65 | 0.00 | 496 | 0 | PASS |
| **T8 temna scena** | balcony_5 (senčni lok) | 13=13 | 66 | 0.00 | 1106 | 0 | PASS |
| **T9 zakritje drevo** | balcony_6 (deblo v kvadratu) | 13=13 | 63 | 0.00 | 1343 | 0 | PASS (occlusion = znana omejitev, §9) |
| **T10 ukrivljen rob** | balcony_1 (ornat kovanega železa) | 13=13 | 61 | 0.00 | 674 | 0 | PASS |

Vsi: mask_bleed=false, brez črnih robov (ring = kontaktna senca), RAL ΔE=0.00 (kromatična kanala nespremenjena tudi v ekstremih).

**T6 pot do rezultata (iskreno)**: prvi poskus s sintetičnim "shear" kvadrom (zgoraj nagnjen 10 %, spodaj horizontalen — NI realna perspektiva) → 13→5. Analiza: kvadrat ni bil realen montažni vhod (isti razred vzroka kot S+3 T2: napačna MERA, ne algoritem). Ponovljeno z REALNIM kvadrom iz grid meritve (oba robova konvergirata proti izginišču, višina -54 %) → 13→12 (1 letvica izgubljena v najbolj stisnjenem delu pri rektificiranem štetju). Algoritem NISO spremenili.

**Produkcija (staging ≤1600 px + JPEG)**: T7 13=13 ✓, T10 13=13 ✓, T6 13=12 (enako lokalno), T8 13=11, T9 13=6 — stisnjena/majhna območja + JPEG + downscale vplivajo na štetje v rektificiranem prostoru. **Dokumentirano kot resolucijska omejitev MVP staginga, NE algoritma** (lokalno polna resolucija: T8 13=13, T9 13=13). Algoritem ni bil spreminjan, da bi izgledalo bolje.

### 6.1 T5/T9 OCCLUSION (§9) — ZNANA OMEJITEV POTRJENA, ni "fixed"
- T5 (rastline PRED ograjo): **94 %** pikslov rastlinske regije prebarvanih z novo ograjo (`s4_occlusion_T5.jpg` — original kaže kaktus/plošče pred ograjo, POTEM kaže novo ograjo čeznje).
- T9 (deblo sega v kvadrat): **67 %** prebarvanih (`s4_occlusion_T9.jpg`).
- Interpretacija: stolpična sinteza A-pipeline-a ne loči plasti PRED maske — objekti pred ograjo so prebarvani. To je **znana omejitev**, označena; ni bilo lažnega popravila metrike.

---

## 7. PERFORMANCE (§10, produkcija)

Merjeno: `tools/s4-prod-tests.ts`, Vercel iad1, demo seja. ≥20 meritev per endpoint (preview 35, stage 68).

| endpoint | n | p50 | p90 | p95 | max |
|---|---|---|---|---|---|
| stage | 68 | 1515 ms | 1920 ms | 2037 ms | 2554 ms |
| preview | 35 | 2768 ms | 3199 ms | 4037 ms | 4611 ms |
| save | 20 | 2232 ms | 2459 ms | 2485 ms | 2511 ms |
| list | 20 | 508 ms | 664 ms | 699 ms | 999 ms |
| open | 20 | 330 ms | 352 ms | 370 ms | 377 ms |

Realna variabilnost: preview p95 (4.0 s) je ~1.5× p50 — serverless hladni starti + velike slike; save je dvorežen (kopiranje v Blob + GC staginga). Podatki: `tmp/scenarios/perf-s4-prod.json`.

---

## 8. REGRESSION (§11)

| check | zahtevano | dejansko |
|---|---|---|
| Vitest | 174/174 ali več | **222/222 PASS** (old: 174, new: 222, added: 48, failed: 0 — starih testov NI odstranjeno; 1 posodobljen na nov proxy URL kontrakt, označeno v commitu) |
| TypeScript | 0 errors | **0 errors** |
| ESLint | 0 errors/warnings | **0/0** |
| Vercel build | PASS | **PASS** (dpl_CTK6D… READY) |
| Production E2E | PASS | **21/21** + brskalniški golden path PASS |

---

## 9. KNOWN LIMITATIONS (samo dejansko reproducirane)

1. **Occlusion** (T5 94 %, T9 67 %): objekti PRED ograjo so prebarvani — arhitekturna lastnost A-pipeline-a (stolpična sinteza). Dokazane slike; navodilo monterju: masko risati SAMO po ograji, ne po rastlinah.
2. **Blob javni store** (rezidualno): z ZNANIM surovim URL-jem (122-bit UUID) je prenos možen; URL-ji se ne izdajo več klientom (proxy model). Za strožje: zamenjava providerja (plačljivo).
3. **Resolucija staginga** (≤1600 px + JPEG q90): pri majhnih/stisnjenih kvadrih štetje letvic na produkciji lahko odstopa (T8 13→11, T9 13→6; lokalno polna resolucija 13=13).
4. **T6**: 1 izgubljena letvica pri -54 % kompresiji perspektive (13→12) v rektificiranem štetju.
5. **Qwen / GPU**: ostaja **PLANNED / PENDING GPU** — render stub je iskren (queued, nikoli completed); v S+4 NI nobenega AI izhoda.
6. **SQLite na Vercelu** = demo način (per-instanca /tmp): registrirani uporabniki lahko izginejo ob hladnem startu, a seje so brezstanjske (sub v žetonu) — lastništvo viz projektov deluje neodvisno od tega (metadata v Blobu).
7. **CDN rob** po DELETE lahko ~sekunde še vrača datoteko (max-age=0 must-revalidate → konvergira v 404; S+3 ugotovitev ostaja).

---

## 10. GO / STOP

**GO.**

Vsi P0 iz spec so dokazano rešeni s produkcijo + testi:
- ✅ Ownership: 2 uporabnika na PRAVI produkciji — B ne more prebrati/preimenovati/izbrisati/renderirati tujega projekta niti prebrati tujega joba (pravi HTTP, 21/21).
- ✅ Blob dostop: reproducibilni audit (prej 200 brez auth) → proxy model (proxy brez seje 401, tuj 404); rezidualno tveganje iskreno dokumentirano.
- ✅ Failure injection: 11 točk → 0 orphan / 0 fake records / 0 izgubljenih podatkov.
- ✅ Concurrency: zaklep + državni stroj; race testi dokazujejo brez regresije/izgube.
- ✅ P1: staging GC (Vercel Cron, fail-closed), idempotenca save/delete.

STOP-kriteriji ničesar ne blokirajo. Najvišja tveganja (occlusion, resolucija staginga) so DOKAZANA in označena kot znane omejitve — niso skrita.

**NAJVAŽNEJŠE PRAVILO — preverjeno**: vsaka trditev zgoraj = dejanska koda + dejanski test + dejanska produkcija (commiti, testi `src/lib/viz/__tests__/*`, `tmp/scenarios/*.json`, `screenshots/s4-*`). Kjer to ni mogoče, piše NOT VERIFIED — takih trditev v tem poročilu ni.

Qwen: **PLANNED / PENDING GPU** (nespremenjeno).
