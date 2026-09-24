# OgrajaVizija → Roksal CV HARVEST (S+8.2, issue #6)

**Referenčni HEAD:** OgrajaVizija `ebc4a120ece71b42b4a61a85802898448158da2a` (main, 2026-09-24)
**Roksal izhodišče:** `6641ca5` (S+9 faza 1) → port commit (glej final report)
**Pravilo:** OgrajaVizija je laboratorij in referenca. Roksal je proizvod.
OgrajaVizija repo ni bil spreminjan (klon read-only, `git status` čist, HEAD nespremenjen)
in NI runtime dependency Roksala (noben submodule/npm/URL import — dokaz: `rg "ograjavizija" src/` = 0 zadetkov).

---

## A. Repository comparison — kaj je bilo pregledano

**OgrajaVizija (Kotlin/Android + Python backend), v celoti prebrano:**

| Datoteka | Vrstice | Funkcije |
|---|---|---|
| `android/.../imaging/Homography.kt` | 124 | `apply`, `inverse`, `fromRectToQuad`, `solve` (DLT + Gauss s parcialnim pivotiranjem), corner reprojection validacija |
| `android/.../imaging/PureCore.kt` | 665 | `composite`, `sampleAlpha`/`sampleArgb`/`bilinear`, `alphaBlend`, `darken`, `computeColorMatchModel`, `applyColorMatch`, `buildShadow`, `boxBlur`, `inpaintPyramid`, `fillHolesLocal`, `removeBackgroundLocal` (Otsu), `otsu`, `largestComponent`, `morphology`, `bboxOf`, `featherMask`, `rgbToLab`, `labToRgb`, `downscale`, `sideBySide`, `diffCount`, `meanAbsDelta` |
| `android/.../imaging/MaskEditor.kt` | 192 | čopič ±, pravokotnik, flood fill, undo/redo (Android UI) |
| `android/.../imaging/BackgroundRemover.kt` | 252 | LOCAL (Otsu+polariteta robov) / ONNX / SERVER odstranjevanje ozadja |
| `android/.../segmentation/OnDeviceSegmenter.kt` | 167 | MediaPipe Interactive Segmenter, fail-safe na ročni način |
| `tools/jvmtest/CoreTest.kt` | 360 | JVM testi: homografija, LAB, no-leakage, color match, senca, Otsu, inpaint |
| `backend/scripts/test_pipeline.py` | 142 | leakage gate: `changed_outside_mask`, `leakage_ratio`, `PASS_protection` |

**Roksal (TypeScript), v celoti prebrano:**

| Datoteka | Funkcije |
|---|---|
| `src/lib/viz/homography.ts` | `solveHomography` (DLT + Gauss + back-substitution), `computeInverse`, `applyHomography`, `warpImage`, `warpFloat`, `warpPremultiplied` |
| `src/lib/viz/color.ts` | `rgb2lab(Scalar)`, `lab2rgb(Scalar)` (OpenCV 8-bit konvencija) |
| `src/lib/viz/pipeline.ts` | `runPipeline` (A-pipeline: cutout → stolpična sinteza → warp → LUMA harmonizacija → feather → senca), `cutoutProduct`, `countLetvice`, `maskToCutout` |
| `src/lib/viz/imageops.ts` | `gaussBlur*`, `dilate/erode/morphClose`, `connectedComponents`, `fillPolygon`, `resizeNearestF32` |
| `src/lib/product-sdk/*` | S+8.1 hardeniran Product SDK (NI dotaknjen) |
| `src/components/viz/mask-editor.tsx` | ročni mask editor (858 vrstic, S+7) |
| `src/lib/viz/__tests__/viz-pipeline.test.ts` | obstoječi testi (homografija, outside-mask, RAL, letvice) |

Metodika: za vsak kandidat koda-na-kodo primerjava + numeričen benchmark
(scratch skripti, rezultati v sekciji H). Subjektivne ocene ne štejejo.

## B. Function mapping (OgrajaVizija → Roksal)

| OgrajaVizija | Roksal ustreznik | Odločitev |
|---|---|---|
| `Homography.fromRectToQuad` | `solveHomography` | KEEP + **PORT validacija** |
| `Homography.apply` (w-guard 1e-12) | `applyHomography` | **PORT guard** |
| `Homography.inverse` | `computeInverse` | KEEP (identično: adjugate/det, prag 1e-14) |
| `Homography.solve` (Gauss + pivoting) | inline v `solveHomography` | KEEP (ekvivalentno: forward elim. + back-substitution) |
| `PureCore.bilinear` (RGBA, ločeno) | `warpImage` | KEEP |
| — (ni ustreznika — OV ima manjko) | `warpPremultiplied` (alpha-weighted barva) | **KEEP ROKSAL** (Roksal boljši: brez črnega robu) |
| `PureCore.sampleAlpha` feather ramp | feather = `gaussBlurFloat(warpA) × maskBin` | KEEP Roksal (clip na masko → izven = 0, dokazano) |
| `PureCore.composite` (`if (!inMask) cur = orig`) | `runPipeline` korak 6 (weight × maskBin) + metrike | KEEP + **PORT bit-exact testi** |
| `PureCore.rgbToLab/labToRgb` | `rgb2lab/lab2rgb` | KEEP rgb2lab; **PORT fix lab2rgb** (dokazan bug) |
| `PureCore.computeColorMatchModel` (LAB_STATS: gain/bias tudi na a/b) | LUMA-only harmonizacija (a/b ZAKLENJENA, RAL varnost) | **REJECT** (krši RAL-safeguard, dokumentiran prepovedan ColorMatcher) |
| `PureCore.LUMA_ONLY` | korak 5 illum-field harmonizacija | KEEP Roksal (clamp 0.85–1.15 + temni-izdelek guard) |
| `PureCore.buildShadow` + `boxBlur` | korak 7 kontaktna senca (pasovi + Gauss) | KEEP Roksal (drugačen, dokumentiran, determinističen mehanizem) |
| `PureCore.inpaintPyramid` | korak 3 stolpična linearna sinteza | KEEP Roksal (dokazan baseline 13=13 letvic); OV pristop → DEFER za clean-plate workflow |
| `PureCore.removeBackgroundLocal` (Otsu + polariteta) | `cutoutProduct` (fiksni prag 115, scenska stranska) | DEFER (različna naloga: izdelek-foto vs scena; glej F) |
| `OnDeviceSegmenter` (MediaPipe) | (ni CV runtime-a; mask-editor je ročen) | DEFER + adapter contract (glej E) |
| `BackgroundRemover` (LOCAL/ONNX/SERVER) | (ni ustreznika) | DEFER (glej F) |
| `MaskEditor.kt` (Android) | `mask-editor.tsx` | KEEP Roksal (bogatejši, že production) |
| `CoreTest.kt` + `test_pipeline.py` testne ideje | `viz-cv-harvest.test.ts` (30 testov) | **PORT TESTS** |

## C. KEEP — Roksal že boljši ali enakovreden (NI spreminjanja)

1. **`warpPremultiplied` alpha-weighted barvno vzorčenje** (`homography.ts:189-242`).
   OV `bilinear` vzorča RGBA kanale neodvisno → prosojni vir (A=0, RGB=0) daje črn
   rob. Roksal uteži barvo z alfo sosedov. Guard-test v `viz-cv-harvest.test.ts`
   ("KEEP-guard warpPremultiplied") to zaklene.
2. **DLT + Gauss + pivoting** (`solveHomography`) — enakovredno OV `solve`
   (isti sistem 8×8, h33=1; numerika primerjana: round-trip 2.8e-14).
3. **`computeInverse`** — identična formulacija (adjugate/det, prag 1e-14; singular → throw).
4. **LUMA-only harmonizacija z RAL zaščito** (`pipeline.ts` korak 5) — OV
   `LAB_STATS` prestavlja tudi a/b (dokazano ΔE=38.4 na RAL — PREPOVEDANO v
   Roksalu: uradna RAL barva ne sme zamenjati odtenka). OV `LUMA_ONLY` rešuje
   isti problem, Roksalova izvedba ima dodatno: illum-field, clamp 0.85–1.15,
   temni-izdelek guard 0.6, kroma-metriko. Enakovredno ali boljše → ostaja.
5. **Kontaktna senca** (`pipeline.ts` korak 7) — OV `buildShadow` izvede polno
   alpha-senco produkta; Roksalova je fizična kontaktna senca pod spodnjim robom
   (28 pasov, max 0.22, σ5, ×0.4), dokumentirana, deterministična. Prehod bi
   spremenil izhode brez dokazane koristi → KEEP (senca ostane reproducibilna:
   100× determinizem test).
6. **Stolpična sinteza ozadja** (korak 3) — dokazan python baseline (S+1: 13=13
   letvic, diff=0 izven maske). OV `inpaintPyramid` ni dokazano boljši za ta
   primer → KEEP; generalni inpaint → DEFER (F).
7. **`cutoutProduct`** prag 115 — del dokazanega baseline-a; brez productMask se
   pipeline ostane bajtno identičen (S+8 kontrakt). Sprememba = vizualna regresija
   brez naročila → KEEP.
8. **mask-editor.tsx** — pokriva in presega OV `MaskEditor.kt`.

## D. PORT — dokazano boljše, preneseno (v Roksal tehnologiji, brez Kotlin kode)

1. **Corner reprojection validacija** v `solveHomography`
   (`src/lib/viz/homography.ts`, port logike `Homography.kt:81-98`):
   po rešitvi se vsi 4 vogali reprojektirajo; toleranca `max(1e-3, diag·1e-6)`;
   neuspeh → `Error('solveHomography: degenerate quad (corner i reprojects …)')`.
   Dokaz vrzeli (BEFORE, commit 6641ca5): podvojen vogal → tiho NAPAČEN H z NaN
   reprojekcijo; kolinearne točke → isto. AFTER: oba → throw; nearly-degenerate
   (0.5 px) še vedno rešljiv z napako 1e-11 (validacija ne pretirava).
2. **w-guard v `applyHomography`** (port `Homography.kt:19-26`):
   `|w| < 1e-12 → 1e-12`. BEFORE: točka na horizontu (w=0) → NaN širi v klicoce.
   AFTER: finite. Warp funkcije so varne že po konstruciji (bounds check), guard
   ščiti direktno point-mapping uporabo.
3. **lab2rgb fix — fy = (L*+16)/116 neodvisno od L*** (port `PureCore.labToRgb`,
   `src/lib/viz/color.ts`): prej je bil za L* ≤ 8 `fy = L* / 903.3 + 16/116`
   (manjkajoč K7787 faktor) → temne barve (RAL 9005 razred!) so imele round-trip
   napako do **34/255**. AFTER: **0/255** (mreža 16³ barv: 31 izboljšanih,
   0 poslabšanih; L* > 8 bitno identično — 0 sprememb).
   Odkrito ŠELE z portanim OV testom (CoreTest `testLab` round-trip ≤ 1/255).
4. **Testna matrica** `src/lib/viz/__tests__/viz-cv-harvest.test.ts` (30 testov):
   §4 obvezni vektorji (identity, translation, scale, affine, normal/strong
   perspektiva, nearly-degenerate, duplicate corner, collinear, reversed
   ordering, singular inverse, inverse round-trip, w-guard, rect→rect, mask
   warp, alpha warp), §6 bit-exact matrika, §12 portane ideje (LAB round-trip,
   senca), §16 determinizem 100×.

## E. DEFER — uporabno, ni še varno/primerno za production

1. **Segmentacija (adapter contract)** — princip iz `OnDeviceSegmenter.kt`
   (model na voljo → samodejno; ni modela → ročni čopič/pravokotnik; workflow se
   nikoli ne sesuje) je vreden prenosa KOT NAČELO, ne kot koda. Roksal še nima
   CV runtime-a. Definiran adapter contract za prihodnost (NI mock implementacije):

   ```
   // prihodnji modul (NI implementiran v tem issue-ju):
   interface SegmentationProvider {
     readonly available: boolean            // ali je provider dejansko na voljo
     segment(img: ImageBuffer, hints: Stroke[]): Promise<ImageBuffer | null>
   }
   // pipeline UI: available === false → UI skrije samodejni način in ostane
   // pri obstoječem ročnem mask-editor.tsx (fail-safe, kot v OV).
   // Kandidati: determinističen local provider (Otsu-ish), opcijsko CV provider.
   // Prepovedano: AI provider kot obvezna odvisnost; mock provider v production.
   ```

2. **Clean plate / generalni inpaint** (`inpaintPyramid`) — smiselno šele z
   workflow-om "odstrani staro ograjo → čist prizor → nova ograja". Današnja
   Roksalova stolpična sinteza je za to dovolj dokazana. Zahteva lasten issue
   z vizualno evalvacijo.

## F. REJECT — namerno se NE prenaša

1. **`LAB_STATS` full-channel color match** — prestavlja a/b kroma → krši RAL
   identiteto produkta (dokumentirano: repo ColorMatcher je bil testiran z
   ΔE=38.4 na RAL in je PREPOVEDAN, `pipeline.ts:19-20`). LUMA problem že rešen.
2. **Android MediaPipe / Kotlin infrastruktura** — platforma nezdružljiva,
   dependency na model download; portamo samo fail-safe princip (E1).
3. **`BackgroundRemover` LOCAL/ONNX/SERVER** — OV Otsu-cutout je za fotografije
   IZDELKA na kontrastnem ozadju; Roksal trenutno nima integracijske točke
   (produktne slike prihajajo iz kataloga z ročno masko). Avto-Otsu je
   kontrast-odvisen (OV lasten komentar: "kakovost odvisna od kontrasta").
   Ocena ločeno od Product SDK (issue #6 §10): brez dokazane integracijske
   koristi DANES → ne uvajamo mrtve kode; ob prihodnjem asset-ingest workflow-u
   je prvi port-kandidat.
4. **`sideBySide`/`downscale`/`diffCount`/`meanAbsDelta`** — debug/orodne
   funkcije; Roksal ima sharp + metrike.
5. **OV test infrastruktura (JVM runner, Python skripta)** — Roksal Vitest stack
   zadostuje; portane so samo testne IDEJE (D4).

## G. Tests — prenešeni v Roksal Vitest

Nova datoteka: `src/lib/viz/__tests__/viz-cv-harvest.test.ts` (30 testov):

- iz `CoreTest.testHomography`: natančnost vogalov, inverz na (w,h), degeneriran
  štirikotnik → throw (razširjeno: duplicate/collinear/reversed/strong/nearly)
- iz `CoreTest.testLab`: round-trip ≤ 1/255 mreža, L(črna)=0, L(bela)=max,
  siva≈L50 (prilagojeno OpenCV 8-bit konvenciji) + NOV dark-color benchmark
- iz `CoreTest.testNoLeakage` + `test_pipeline.py` leakage gate: bit-exact
  outside-mask matrika (normalna/feather 0/feather 8/brez harmonizacije/1-px
  maska/maska izven bbox/prosojni produkt/ekstremna perspektiva; senca omejena
  na pas pod robom; `outsideMaskDiffPixels = 0`, `outsideMaskMaxChannelDiff = 0`)
- iz `CoreTest.testShadow`: senca potemni + determinizem
- NOVO §16: 100× runPipeline → identičen sha256

## H. Benchmarks (Before / Reference / After)

### H1 — Homography validacija (§4/§15)
| Primer | Before (Roksal 6641ca5) | Reference (OV ebc4a12) | After (port) |
|---|---|---|---|
| duplicate corner | tiho napačen H, reproj. napaka **NaN** | throw | **throw** `degenerate quad` |
| collinear dst | tiho napačen H, napaka **NaN** | throw | **throw** |
| nearly degenerate 0.5 px | rešljiv, napaka 1.1e-11 | rešljiv | rešljiv, napaka 1.1e-11 (nespremenjeno) |
| inverse round-trip | 2.8e-14 | (ekvivalent) | 2.8e-14 (nespremenjeno) |
| `applyHomography` w=0 | **NaN** | finite (guard 1e-12) | **finite** |

### H2 — lab2rgb fix (§7/§15)
Mreža 16×16×16 RGB korakov (L* razporeditev realistična):
| | Before (Roksal 6641ca5) | Reference (OV) | After (port) |
|---|---|---|---|
| worst round-trip L* ≤ 8 | **34/255** | ≤ 1/255 | **0/255** |
| izboljšanih / poslabšanih | — | — | 31 / 0 |
| L* > 8 RGB spremembe | — | — | **0** (bitno identično → brez vizualne regresije) |

Najhujši pred popravkom: `rgb(0,0,90)` → `(0,20,75)`. Prizadene temne izdelke
(RAL 9005 jet black, L* ≈ 5.7) v harmonizacijskem koraku A-pipelinea.

### H3 — Determinizem (§16)
100× `runPipeline` (senca ON): identičen sha256 preview bajtov — 100/100 ✓.
Obstoječi S+8.1 determinizem (product preview 100×, H+V) ostaja zelen.

## I. Architecture boundary — zakaj OgrajaVizija ostane ločen repo

- **Ni merge-a repojev** (issue #6 §2): noben submodule, npm/Android/Python
  dependency, skupna baza ali kopija projekta. Preneseno je bilo izključno:
  algoritmična specifikacija (2 funkciji + 1 fix), testne ideje in benchmarki.
- **Ni drugega source-of-truth**: geometrija/izdelki ostanejo izključno v
  Product SDK (`src/lib/product-sdk/*` ni dotaknjen — dokaz: git diff). CV
  plast (`src/lib/viz`) ostane vizualizacijski sloj NAD FenceLayout-om.
- **Ni AI v determinističnem jedru**: portane funkcije so čista matematika
  (brez `Math.random`/`Date.now`/network/AI). AI takeoff ostaja nedotaknjen
  za issue #2.
- **OgrajaVizija ni bil spreminjan**: klon `ebc4a12`, read-only, `git status`
  čist po vsem delu; Roksal nima nobenega import-a, URL-ja ali sklica nanj.

---

*S+8.2 izvedel Z.ai Code agent, 2026-09-24. Vsi rezultati reproducibilni
(skripti in testi v repozitoriju Roksal-Railing-Manager).*
