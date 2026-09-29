# Issue #17 — Production-readiness gate: Roksal Manager ↔ ar-android

**Status: V DELU — prvi sklop dokazov iz kode/testov (R274). Ta dokument je
živi register sekcij A–J: vsaka vrstica nosi DOKAZ (koda/test) ali izrecno
NI-DOKAZANO. Nič ni prikrito — terenske postavke ostanejo odkrito odprte.**

Pravilo issue-ja: dokaz je koda/test/teren, ne dokumentacija sama. Zaradi
tega vsaka "DOKAZANO" vrstica imenuje test ali datoteko; "DELNO" poimenuje,
kaj manjka; terensko (J) je nedotaknjeno.

---

## A. Shared contract

| Postavka | Stanje | Dokaz |
|---|---|---|
| canonical schema (projektni sync payload) | ✅ DOKAZANO (projektni nivo) | `mobileProjectSchema` v `src/app/api/sync/route.ts` — zod, per-item validacija, napačni tipi zavrnjeni per-item |
| contractVersion | ✅ DOKAZANO (R274) | `SYNC_CONTRACT_VERSION` (`src/lib/sync-conflicts.ts`) + neznana verzija zavrnjena fail-closed (`r274-issue17-gate.test.ts` — sekcija D) |
| neznana prihodnja polja brez korupcije | ✅ DOKAZANO | zod strip — `r274-issue17-gate.test.ts` (futureField odstranjen, projekt ustvarjen) |
| canonical schema (MeasurementSession, segmentId, appVersion, source enum ARCORE_DEPTH/MANUAL/PHOTO_CV, enote, coordinate frame, ARCore→shared transform, calibration, quality/confidence, photo refs, GLB refs) | ✅ DOKAZANO na Roksal strani (R274, druga polovica rundi) | `src/lib/ar-contract.ts` — kanonična zod strict shema v1 (`parseArSessionPayload`, `AR_CONTRACT_COMPATIBILITY`, migracijska kljuka) + `r274-ar-contract.test.ts` ×31 (verzije, enum, enote mm NEzaokrožene, ID-ji verbatim, frame/transform/kalibracija/quality/photo/glb, round-trip determinizem). ar-android sprejmem + poravnava z #16 ostajata odprta (#15/#16) |

## B. Android → Roksal

| Postavka | Stanje | Dokaz |
|---|---|---|
| Roksal payload validira | ✅ DOKAZANO | per-item zod + odpuščivost serije (`r148-sync.test.ts`, `r274-issue17-gate.test.ts`) |
| ID-ji ostanejo nespremenjeni | ✅ DOKAZANO | unique `mobileProjectId` (R121) + `r274-issue17-gate.test.ts` (stabilen projectId) |
| enote ostanejo nespremenjene | ✅ DOKAZANO (cm verbatim) | `r274-issue17-gate.test.ts` — lengthCm 345.5 verbatim v projectData, nič pretvorbe |
| napaka payload-a ne spremeni obstoječega projekta | ✅ DOKAZANO | per-item try/catch + test (napačen tip → 0 sprememb v bazi) |
| source ostane ARCORE_DEPTH/MANUAL/PHOTO_CV | ✅ DOKAZANO (Roksal-stranska validacija, R274 druga polovica) | `parseArSessionPayload` zavrne tuje vire (tudi SDK enuma 'automatic'/'manual' — DVA nivoja, preslikava izrecna, ne tiha); ar-android pošiljatelj = #15/#16 |
| coordinate transform / calibration se ne izgubi | ✅ DOKAZANO (Roksal-stranski validated passthrough, R274 druga polovica) | `parseArSessionPayload` — `transform` (anchorId + translationMm + rotationQ, ne-finite zavrnjen) + `calibration` (model enum + referenceMm) preživita round-trip (`r274-ar-contract.test.ts`); ar-android stran = #15/#16 |
| segmenti/fotografije/GLB preslikava | ✅ DOKAZANO (Roksal-stranski validated passthrough, R274 druga polovica) | `segments` (stabilen segmentId verbatim, NEzaokrožen lengthMm, per-segment source), `photoRefs`/`glbRefs` (stabilne reference + sha256) — strict shema + testi; ar-android preslikava = #15/#16 |

## C. Roksal → Android

| Postavka | Stanje | Dokaz |
|---|---|---|
| obstoječ projekt → Android session | ⚠️ DELNO | GET zrcalo obstaja in je testirano (skoping, delta, grobnice — `r148-sync.test.ts`); Android stran je ar-android repo (izven tega repozitorija) |
| konfiguracija profila/materiala/barve ostane | ⚠️ DELNO | colorHex/colorName/railingStyle potujejo prek projectData; per-test na Android strani ni v tem repozitoriju |
| re-anchor obstoječa identiteta | ❌ NI ŠE | measurementSession identiteta — **issue #16** |

## D. Versioning

| Postavka | Stanje | Dokaz |
|---|---|---|
| contractVersion za shared payload | ✅ DOKAZANO (R274) | shema + per-item zavrnitev neznane verzije; pre-kontraktni klient naprej brez novega warninga (r148 kanon: warnings smiselni, ne hrup) |
| sledljivost deklarirane verzije | ✅ DOKAZANO (R274) | audit newValue nosi `contractVersion` (v1 kot 1, odsotna kot null) — testirano |
| unknown future fields ne pokvarijo | ✅ DOKAZANO | zod strip test |
| napačna verzija zavrnjena | ✅ DOKAZANO | `Nepodprta pogodbena verzija 99 — strežnik podpira 1`, retryable false, 0 v bazi |
| compatibility matrix + migracijska pot | ✅ DOKAZANO (AR kontrakt) / 📋 POLITIKA (projektni sync) | AR: `AR_CONTRACT_COMPATIBILITY` + migracijska kljuka `migrateArSessionPayload` (v1 identiteta; napačna verzija → izrecna napaka z ORIGINALOM — ni izgube); sync: ena verzija (1): razširitev = NOVA veja vrednosti + izrecna migracijska faza; NE-spreminjanje pomena starih polj; originalni payload ostane pri klientu (zavrnitev ne briše nič) |
| stari projekti ostanejo berljivi | ✅ DOKAZANO | pre-kontraktni sync test (created brez warninga) |

## E. History

| Postavka | Stanje | Dokaz |
|---|---|---|
| spremembe projekt-nivoja sledljive | ✅ DOKAZANO | AuditLog SYNC_PROJECT_CREATED/UPDATED v ISTI transakciji (oldValue/newValue); G-test šteje 2→3 zapisa, konfliktni poskus NE piše |
| meritve se ne prepisujejo brez zgodovinske verzije; aktivna verzija; derived-data source verzija | ❌ NI ŠE | meritev-history plast = **issue #16**; sync payload trenutno nosi samo projekt-nivo polja |

## F. Sync (obstoječi model — uporabljen, ne podvojen)

| Postavka | Stanje | Dokaz |
|---|---|---|
| mutationId, deviceId, syncRevision, baseRevision, baseUpdatedAt | ✅ DOKAZANO | `r148-sync.test.ts` (§36 sklop) |
| idempotency | ✅ DOKAZANO | Idempotency-Key replay (`r148`) + replay BREZ ključa (`r274` — created→updated, nikoli dvojnik) |
| conflict response | ✅ DOKAZANO | `r148` + polni G scenarij (`r274`) |
| tombstone | ✅ DOKAZANO | `r148` (DELETE + ponovni POST + GET izključitev) |
| delta sync | ✅ DOKAZANO | `r148` (sinceRevision + nextCursor + hasMore + limit strop) |
| audit v isti transakciji | ✅ DOKAZANO | koda (`auditInTx`) + G-test štetje |
| replay test | ✅ DOKAZANO | `r274` sekcija F |
| parallel sync test | ✅ DOKAZANO | `r274` — Promise.all dveh naprav, P2002 race, točno 1 projekt |
| offline queue na Android strani | ❌ ar-android repo | izven tega repozitorija |

## G. Conflict (namerni scenarij)

✅ **DOKAZANO v celoti** — `r274-issue17-gate.test.ts`, describe
"issue #17 G": rev N → B piše (2) → A piše (3) → A pošlje zastarel base 1 →
konflikt (retryable, serverState {syncRevision,status,updatedAt}) → baza nosi
rev 3 → NIČ tihe izgube → refresh prek GET ?sinceRevision=2 → ponovitev z
base 3 uspe (rev 4) → audit: 3 uspešne spremembe, konfliktni poskus ni zapisan.

## H. Canonical geometry

✅ **DOKAZANO (obstoječi)** — `src/lib/__tests__/canonical-chain.test.ts`:
Measurement → fence-engine + railing-layout → buildQuote EN VIR RESNICE +
determinizem (bajtno identično) + zakon "brez merila NI proizvodne verige".
Native Android RoksalFence ostaja native (ar-android). Izvozi (PDF/CSV) gradijo
iz FRESH API virov ob kliku (družina 29 členov, needle testi per runda) — ni
zastarelega stanja.

## I. Regression (AFTER >= BEFORE)

✅ **DOKAZANO per runda** — verifikacijska veriga R274: tsc 0 · eslint 0 ·
vitest 3577/3577 (199 datotek, +41 glede na R273: +10 sync-pogodbeni gate,
+31 MeasurementSession kontrakt) · build ✓ · needleji FAIL=0 (r274-build-needles,
server+client chunks, Z-STRUCT 0/0) · smoke ✓ (health/200/307/403) ·
prod QA R273 LIVE (10 needlejev + prvi LIVE klik vrednostnega pill-a s spot
sejo). 0 padajočih testov po R274 spremembah (r148 regresija potrjena zeleno).
**E2E ŽIVO EXIT=0 čisti tek** (`scripts/r274-e2e-browser.sh`, standalone :3100,
ADMIN; UNION obeh polovic rundi): a11y sweep role="status" na mini-vrsticah
(Z1) + fail-closed veja prek stuba [] s restavriranim stubom (Z1b) + dinamična
mini IZ ISTEGA API '13 artiklov · Σ 239.85 EUR' + žetona + RED dot (Z2) +
toast agregat ISTA resnica + PDF 58525 bajtna reprodukcija R273 determinizem
(Z2b) + R272/R271/R269 pill regresije ŽIVO (Z3) + temna (Z4) → RESTORE →
ODTIS BAJTNATO IDENTIČEN pre==post (ZERO-MUTACIJA) + port sproščen.

## J. Field validation

❌ **NI DOKAZANO — izrecno odprto.** Terenski test (balkon ~3 m + 90°,
stopnice, vrtna ograja 10–20 m, drift, re-anchor, calibration point C, depth
confidence, glossy/steklene površine, primerjava s fizično merilom) zahteva
FIZIČNO izvedbo. Unit test NI dokaz fizične natančnosti (izrecno pravilo
issue-ja). Ta sekcija se zapre šele s terenskim rezultatom.

---

## STOP-pogled (issue #17)

Nič od R274 dela ne krši STOP pogojev: obstoječa funkcija ni izgubljena
(r148/kanon zelen), pomen meritev ni spremenjen, ID-ji/grobnice ostajajo,
NI tihe LWW (konflikt je ekspliciten), sync protokol NI podvojen (isti
`/api/sync`), noben sistem ni postal odvisen od drugega za osnovno delovanje.

## Naslednji koraki (zaporedje rund)

1. **#16**: shared data contract — MeasurementSession payload, segmentId,
   source enum, enote/coordinate frame v shemi (potem A/B/C preostanek).
2. **#15/#17-B/C**: dvosmerni dvokanalski testi (Roksal → Android consume),
   ko ar-android stran deklarira branje zrcala.
3. **J**: terenska validacija — lastniška akcija, ni AI-izvedljiva.

---

## Dodatek (druga polovica R274 — MeasurementSession kontrakt)

**Namen:** register se dopolni — druga polovica istega R274 implementira
točno tisto vrstico, ki je bila tu označena "❌ NI ŠE — odvisno od issue #16":
kanonično shemo MeasurementSession na Roksal strani.

**Nobeno obstoječe vedenje ni spremenjeno:**
- sync/`mobileProjectSchema` (projektni nivo) ostaja zod-strip semantika
  (dokumentirana že od začetka te rute) — testirano z `r274-issue17-gate.test.ts`;
- MeasurementSession kontrakt (`src/lib/ar-contract.ts`) je NOV nivo z
  IZRECNO strict semantiko (neznana polja zavrnjena, ne utišano stripirana;
  napačna verzija zavrnjena z originalnim payload-om na napaki — ni izgube).
  Dvojnost je dokumentirana v glavi modula (odločitve 3 in 7) in v worklogu
  R274 — NI protislovja: dva nivoja, dve različni, vsaka svoja izrecna
  dokumentirana semantika;
- route gate: `POST /api/measurements` validira kontrakt-payloade (nosi
  `contractVersion`) PRED transakcijo — 400 + žična koda, NIČ zapisov,
  projekt status nespremenjen, Idempotency-Key neizkoriščen (čist retry);
  legacy payloadi (balkonar blok) grejo po stari poti verbatim.

**Dokazi:** `src/lib/ar-contract.ts` · `src/lib/__tests__/r274-ar-contract.test.ts`
(31) · route gate testi (6 integracijskih, roksal_test) · needleji
`scripts/r274-build-needles.sh` (server chunks: ARCORE_DEPTH, LOCAL_NORMALIZED,
AR_CONTRACT_*, 'Neveljaven AR skupni kontrakt') · verifikacijska veriga I.

**Ostaja odprto (iskreno):** ar-android pošiljatelj (Kotlin serializacija po
tem kontraktu = #15/#16), E (meritev-history plast), J (terensko).
