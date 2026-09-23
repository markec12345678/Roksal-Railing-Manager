# S+3 STATUS — VERCEL PRODUKCIJA + REALNI MONTAŽNI TESTI

Datum: 23. 9. 2026 · Repo: markec12345678/Roksal-Railing-Manager

## Git
- **HEAD:** `9982b74` (+ `c3f8ad4` scenariji, `050412b` allowOverwrite, `4392a19` build fixi) — vse na origin/main
- **Base commit:** `e52eead` (potrjen iz naloge, nič ponavljanja S+1/S+2)
- **Changed files (jedro):**
  - `src/lib/viz/storage.ts` — storage driver abstrakcija (local FS + Vercel Blob)
  - `src/lib/viz/repository.ts` — **NOVO**: metadata (local = Prisma, blob = project.json)
  - `src/app/api/viz/{stage,preview,projects,projects/[id],render,render/[jobId]}/route.ts` — driver-agnostične
  - `src/lib/viz/db.ts` — serverless /tmp URL reuse
  - `src/lib/viz/pipeline.ts` — SAMO debug profil (algoritem 1:1 nespremenjen)
  - `src/lib/viz/__tests__/viz-storage.test.ts`, `viz-repository.test.ts` — **NOVO** (+19 testov)
  - `docs/VIZ_CONTRACTS.md` — storage driver poglavje
  - `tools/real-scenarios.ts`, `tools/real-scenarios-prod.ts` — merilni orodji
  - `tmp/scenarios/` — maske, product_bay.jpg, results.json, results-prod.json, rezultatne slike
  - `screenshots/s3-prod-01…12.png` — browser E2E na produkciji

## Vercel
- **Build:** PASS (3× popravljen: 2× začasni orodji z absolutnimi potmi/tip, dokazano v logih)
- **Deployment:** `dpl_BBzDyHAvAVcv2TtK9XyEm3xSTKHo` READY
- **Production URL:** https://roksal-railing-manager.vercel.app
- **Storage:** Vercel Blob store `roksal-viz2` (`store_CIDgCFdqpr3TvP7w`, iad1, public access)
  - Env: `BLOB_READ_WRITE_TOKEN` (production+preview, nastavljen prek `vercel blob create-store --yes --environment`, NI v Gitu)
  - Če env manjka → samodejni fallback na local driver (dev ostaja delujoč brez česa koli)
  - Brez novih plačljivih servisov (Blob = del obstoječega deploymenta; ne Firebase/Supabase/AWS/AI API)
- **Persistent save:** ✓ (save → project.json + 7 datotek v Blob; API + brskalnik dokazano)
- **Reload:** ✓ (nov HTTP request → projekt v seznamu, sličica + metrike iz Blob)
- **Delete:** ✓ (metadata + datoteke izgledene; store list = 0; javni URL konvergira v 404 — CDN rob nekaj sekund, max-age=0 must-revalidate, dokumentirano)

## Testi
| Vrsta | Rezultat |
|---|---|
| Unit/integration (vitest) | **174/174 PASS** (155 prejšnjih + 19 novih: driver, repo, blob-mock) |
| Pipeline regresija (S+1/S+2 dokazi) | 8/8 PASS (13=13, diff=0, RAL, homografija ≤0.75px) |
| E2E produkcija — API (curl) | PASS (stage→preview→save→list→open→reload→render→delete→404) |
| E2E produkcija — brskalnik (agent-browser 390px) | PASS (celoten uporabniški tok, 12 slikek) |
| TypeScript (`tsc --noEmit`) | 0 napak |
| ESLint | 0 napak / 0 opozoril |
| Build (Vercel) | PASS |

## Realni testi (5 montažnih scenarijev — meritve, ne samo PASS)

Realne fotografije (S+1 vhodi), realen produkt (fence_0 S+1 bay 460×660), maske izmerjene po mreži; DOKAZANI A-pipeline ALGORITEM NE SPREMENJEN.

| Test | Geometrija | Letvice | Outside diff (pre-shadow) | ΔE | Čas (lokalno / Vercel) | Rezultat |
|---|---|---|---|---|---|---|
| T1-ravna (balcony_3, jeklena) | quad = S+1 dokazani vogali; brez črnega roba, bleed 0 | **13 = 13** | **0** (max diff izven maske 66 = kontaktna senca pasu) | **0.00** | 1.45 s / 2.34 s | **PASS** |
| T2-perspektiva (balcony_2) | močna perspektiva, diagonalni kvad; bleed 0 | **13 = 13** | **0** | **0.00** | 0.72 s / 2.40 s | **PASS** |
| T3-sonce (balcony_4, gradient) | sonce z leve; svetlobni gradient prenesen SAMO v L; bleed 0 | **13 = 13** | **0** | **0.00** (Δa=Δb=0.00) | 0.53 s / 1.96 s | **PASS** |
| T4-temna (balcony_5, antracit+opeka) | temen produkt na temnem fondu; ringMaxDiff 6 (najtišji rob vseh); bleed 0 | **13 = 13** | **0** | **0.00** | 1.91 s / 2.99 s | **PASS** |
| T5-zakrit (balcony_0, rastline) | rastline prekrijejo ograjo; stolpična sinteza ozadja; bleed 0; znana omejitev: sintezni madeži na mestu rastlin (occlusion) | **13 = 13** | **0** | **0.00** | 1.29 s / 2.41 s | **PASS** |

- `geometry_error_px`: za realne fotografije ni objektivne ground truth — namesto tega: (a) sintetični test homografije ≤ 0.75 px (obstoječi test PASS), (b) quad vs maska poligon iz istih izmerjenih točk, (c) vizualna prevera na označenih rezultatnih slikah (`tmp/scenarios/result_T*.jpg` — rdeči quad). T2 je ujel NAJINO napako postavitve (pregeneren quad) — popravljena na dejansko ograjo (lekcija za monterje: natančni vogali).
- `expected_slats` = 13 (izmerjeno na produktu v S+1; preverjeno tudi z `countLetvice` na bay cropu).
- Meritve v `tmp/scenarios/results.json` (lokalno) in `results-prod.json` (produkcija).

## Sončni test (§7) — izmerjeno
- Kromatična ohranjenost produkta na VSEH 5 scenarijev: **a: Δ0.00, b: Δ0.00** (OpenCV 8-bit LAB) — luminance-only harmonizacija se NE dotika barve (RAL varno).
- T3 (močan sončni gradient): svetlobno polje modulira samo L (clip 0.85–1.15); gradient se prenese v letvice; ΔE = 0.00.
- Odsevi/različne svetlosti: zunanji pas produkta ohrani identiteto (13=13 v T3 s senco na desni strani kvadra).
- Algoritm NI bil spremenjen "da bi lepše izgledalo" — samo izmerjeno.

## Najdene napake (samo dejansko reproducirane)
1. **Produkcija: stage 500** — zapis v public/ = bralen FS (curl dokaz: `{"error":"Napaka pri nalaganju slike"}`).
2. **Produkcija: render job 500** — "blob already exists" pri update queued→… (runtime logi `vercel logs`).
3. **T2 FAIL 15≠13** — pregeneren quad/maska (moja mera postavitve, NE algoritem).
4. **Vercel build FAIL ×2** — začasni probe orodja z absolutnimi potmi; `countLetvice` tip (number vs objekt).
5. **Login na produkciji NI deloval z admin@roksal.si** — demo račun je `demo@roksal.si` / `RoksalDemo2026!` (seed; dokumentirano).

## Popravljene napake
1. stage 500 → **storage driver** (local + Vercel Blob); dokaz: produkcija stage 200 z blob URL; testi: viz-storage (14), viz-repository (5).
2. render 500 → **allowOverwrite: true** pri metadata zapisih; dokaz: produkcija render stub queued + status GET; test: blob-driver test zahteva allowOverwrite.
3. T2 → **natančen quad** (0.347,0.588)/(0.612,0.580)/(0.614,0.748)/(0.349,0.756) + zategnjena maska; dokaz: profil `countLetviceDebug.lastProfile` = 13 čistih ON tekov @0.5; alternativni števci (median-3, histereza) so ZAVRŽENI — zlivajo prave vrzeli; algoritem ostal 1:1.
4. Build → odstranjena začasna orodja z absolutnimi potmi + tip fix; dokaz: tsc 0 napak + Vercel build PASS.
5. viz/db.ts → reuse `resolveServerlessDatabaseUrl()` (serverless /tmp kopija) — preventivno za local-driver na Vercelu.

## Kaj še manjka
- **Za produkcijski MVP:** nič blokirajočega — celoten tok deluje na produkciji. (Opcijsko: GC za neshranjene staging zapise; izvoz projekta; prikaz lastnika projekta.)
- **Izboljšave:** variante B/C primerjave v UI; ekspozicijski drsnik za sončne produktne fotografije (S+1 učenje); večproduktne knjižnice.
- **Qwen/GPU (PLANNED — PENDING GPU):** GPU strežnik po `baseline/QWEN_DEPLOY_PLAN.md` (Docker + FastAPI + QwenImageEditPlusPipeline; RTX 4090 bf16 / 16GB Q4); `/api/viz/render` forward obstaja (VIZ_GPU_URL), statusi ostajajo iskreni. **Nič ni označeno "AI generated" brez GPU inference.**
- **Prihodnja funkcija:** skupna raba projektov, več variant na projekt (UI okvir obstaja).

## STOP/GO

**GO**

Dokazljivi razlogi:
1. Produkcija (pravi deployment, ne localhost): persistent save → reload → open → delete = DELOJE (API + brskalnik E2E + 12 slikek + blob store list = 0 po brisanju).
2. 5 realnih montažnih scenarijev z MERITVAMI: 13=13 letvice (identiteta), izven maske 0 (pre-shadow), ΔE 0.00 (RAL), brez bleed/črnih robov, 2–3 s na Vercelu.
3. 174/174 testov (nič odstranjenih), tsc/eslint/build čisto.
4. A-pipeline algoritem 1:1 nespremenjen; ColorMatcher še vedno izključen; Qwen iskreno PLANNED.
