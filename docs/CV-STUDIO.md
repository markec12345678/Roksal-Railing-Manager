# CV Studio — Computer Vision kot PREDLOG (issues #10 + #11)

> **Ključno pravilo:** Computer Vision = predlog/zaznava. Measurement/Geometry =
> **vir resnice**. CV nikoli ne določi končne mere, BOM-a, cene ali ponudbe
> brez potrditve uporabnika in strežniške validacije.

CV Studio je samostojen modul (Več → CV Studio) poleg obstoječega Merilnega
studia. Merilni studio NI spremenjen; CV Studio uporablja ISTO kanonično verigo
za shranjevanje (`POST /api/measurement/confirm`).

---

## 1. Kaj CV dejansko zazna (deterministično, brez AI)

Algoritmi: Sobel → Otsu robovi → dilacija → Hough (isti primitivi kot
Measurement SDK, `src/lib/measurement/cv.ts`) + povezane komponente
(`src/lib/viz/imageops.ts`, čista funkcija) + homografija (`src/lib/viz/homography.ts`).

| Tip zaznave | Kako | Stanje ob izpisu |
|---|---|---|
| `RAILING` | glavni pas (para najmočnejših horizontalnih črt z največjo skupno podporo) | PROPOSED |
| `BALCONY_EDGE` | spodnja črta glavnega pasu | PROPOSED |
| `RAILING_POST` | vertikalne črte znotraj pasu (prekrivanje ≥ 60 %, merge ±14 px) | PROPOSED |
| `STAIR` / `STAIR_EDGE` | družina ≥ 3 vzporednih diagonalnih črt (±5°) z pravilnim ρ razmakom (std/mean ≤ 0.35) | NEEDS_CONFIRMATION |
| `OBSTACLE` | povezane komponente robov znotraj pasu, izven stolpcev stebrov (min. velikost, izločene tanke vertikalne linije) | NEEDS_CONFIRMATION |
| `FLOOR`, `GROUND`, `WALL`, `OPENING`, `DOOR`, `OTHER_SURFACE` | **CV jih NE zaznava** — deterministična semantična segmentacija ni zanesljiva → samo ROČNA označba (2 klika = bbox) | ročno |

**Česa sistem NE zazna in tega NE simulira:** semantika površin, vrste materiala,
globina/3D brez senzorja, skrite ovire. Vse nezanesljivo ostane
`UNKNOWN`/ročno.

## 2. Merilo in mm

- Analiza prizora (`POST /api/vision/scene`) vrača **samo normalizirane
  koordinate (0..1)** — NI ene same mm vrednosti (test zakon: `valueMm`
  se ne pojavlja v odgovoru).
- Absolutne mere nastanejo IZKLJUČNO v obstoječem `buildSession` /
  `resolveScale` ob uporabnikovi referenčni meri (2 točki + znana mm).
  Brez reference → `SCALE_REQUIRED`, geometry = null (fail-closed, ni ugibanja).
- `POST /api/vision/placement` merilo računa STREŽNIŠKO iz referenčne mere
  (`resolveScale`) — klient ne more vbrizgati `mmPerUnit`.

## 3. PHOTO in LIVE način

- **PHOTO:** upload/kamera → `POST /api/vision/scene` → overlay + seznam
  zaznav → sprejmi/zavrni/popravi → referenca → produkt → placement →
  confirm (kanonično).
- **LIVE:** zadnja kamera (getUserMedia) → 2D CV predogled. Analiza kadra je
  ročna ali samodejna (throttle ≥ 3 s, en request naenkrat — zadnji rezultat
  ostane stabilen; UI NI blokiran). Overlay je **frame-relative**.
  Zajem kadra → prehod v PHOTO način (isti analizni core).
- **Capability-based** (`src/lib/cv-studio/capabilities.ts`):
  `camera`, `webxrAr`, `depth: 'unknown'|'unavailable'`. Brez kamere → LIVE
  ni ponujen (PHOTO ostane). WebXR AR ni podprt → iskren opis "2D CV predogled
  (frame-relative overlay); pravi AR ni simuliran". Depth je brez živega XR
  sessiona **nikoli** razglašen za 'available'. Pravi WebXR tracking ostaja v
  obstoječem AR skenerju (`WebXrArScanner`) — CV Studio ga ne podvaja.
- Pogodbe ponudnikov: `CameraProvider`, `SceneDetectionProvider`,
  `PlaneProvider`, `DepthProvider`, `PoseProvider`, `PlacementRenderer` —
  jedro ni vezano na platformo.

## 4. PWC Placement Engine (issue #11 §7)

`src/lib/cv-studio/placement.ts` + `POST /api/vision/placement` (strežnik-
avtoritativno). Vhod: produkt + orientacija + razmak + širina/višina (mm iz
potrjene meritve/reference) + opcijski stebri; izhod: **layout IZKLJUČNO iz
obstoječega `computeFenceLayout`** (fence-engine = en vir proizvodne
geometrije) + pravila iz Product SDK (`resolveMaxPostSpacingMm`,
`resolveMaxRailSpacingMm`, katalog gap meje).

- **Invalid placement** (neznan produkt, nepodprta orientacija, gap izven
  kataloga, razmak stebrov presega katalog max, neurejene/duplicirane
  pozicije, NaN, širina/višina izven 300..20000 / 300..3000, ročaj brez
  podpore) → `valid:false` + razlogi, **BREZ layouta → BOM ni mogoč**
  (test zakon: ista kršitev v `mapToGeometry` vrže napako).
- Profili brez dokumentiranega max razmaka stebrov (npr. KUBO 80/42)
  ZAHTEVAJO eksplicitne pozicije stebrov — ni tišega izvajanja.
- KUBO: posebnost montaže (brez alu cevi ni montаže pri ROMB itd.) so
  vidni v `docs/PWC-ASSETS.md` (generirano iz kataloga; unknown ostane unknown).

## 5. Projekcija na sliko (issue #11 §8)

- **S 4 potrjenimi kotniki** (uporabnik označi TL,TR,BR,BL): homografija
  (obstoječi `solveHomography`) — prava perspektivna preslikava enotnega
  kvadrata ograje na quad v sliki.
- **Brez kotnikov:** iskren **2D afina približek** ob potrjenem segmentu +
  merilu, z vidnim opozorilom `PERSPEKTIVNI PBLIŽEK`. Nikoli se ne izdaja
  za pravi 3D.
- Degenerirani kotniki → samodejni fallback na afin približek z opozorilom.
- Brez potrjenega merila → projekcija vrže napako (ni mm brez merila).

## 6. Ročni popravek je obvezen (issue #11 §9)

- Sprejmi/zavrni vsako zaznavo; zavrnjene so iz overlaya.
- Segment A–B (in vmesne točke za L/U) je vlečljiv (drag) in dodajljiv.
- Kotniki (4 kliki) in referenca (2 klika + mm) so uporabniški vhodi.
- Ročna označba površin/ovir (2 klika = bbox), brisanje zaznav.
- **ROČNO zavihek = popoln fail-safe:** celoten potek deluje brez kakršnegakoli
  CV rezultata (`features: null`, `source: 'manual'`). CV neuspeh NE blokira
  projekta.

## 7. Kanonična veriga (nedotaknjena)

```
PHOTO/LIVE → CV scene (predlog) → user confirmation → reference → scale
  → MeasurementSession (buildSession) → /api/measurement/confirm  ← EDINI zapis
  → Geometry (mapToGeometry/fence-engine) → BOM → Pricing → Quote → PDF
```

- CV Studio sam NE piše v bazo. Zapis meritve gre prek obstoječega confirm
  endpointa (zod shema, audit v transakciji) — `savedMeasurementId`.
- CV brez potrditve ne spremeni meritve (test: `confirmed:false` → nikoli
  `VERIFIED`); CV brez scale ne ustvari mm (test: geometry = null).

## 8. API contract (povzetek)

| Endpoint | Vhod | Izhod |
|---|---|---|
| `POST /api/vision/scene` | `{ imageData: dataURL ≤8 MB }` | `SceneAnalysis` (sessionId=sha256 pikslov, elements, features, quality, warnings, guidance, algorithmVersion) |
| `POST /api/vision/placement` | `PlacementInput` + `reference` + `segment` + `corners?` | `{ placement (valid/reason/violations/layout), projection, scale, scaleReason }` |
| `POST /api/measurement/confirm` | obstoječa zod shema | obstoječ odgovor (`session`, `takeoffPreview`, `savedMeasurementId`) |

Ločitev (issue #11 §11): **raw detection** = scene endpoint (stateless,
idempotenten); **user correction** = lokalno stanje UI (sprejem/zavrnitev/drag);
**confirmed geometry** = izključno confirm endpoint; **product placement** =
placement endpoint (ni endpointa, ki bi iz CV samodejno ustvaril proizvodno
geometrijo).

## 9. Determinizem

- `analyzeScene`: enak vhod → bajtno enak JSON (test 100×, sha256);
  `sessionId` = sha256 vhodnih pikslov (idempotenca).
- `evaluatePlacement`/`projectPlacement`: čisti funkciji (test bajtne
  stabilnosti); `algorithmVersion` v odgovoru (`cv-scene@1.0.0`,
  `pwc-placement@1.0.0`).
- Ni `Math.random`, ni `Date.now` v geometrijski poti, ni zunanjega API-ja.

## 10. Testi in validacija

- `src/lib/cv-studio/__tests__/cv-studio.test.ts` — scene (raven balkon,
  stopnice, ovira, prazna/temna/svetla/šumna slika, neveljaven vhod,
  determinizem 100×, sessionId idempotenca), placement (veljaven/invalid/
  katalog pravila/NaN/meje/ročaj), projekcija (afina, homografija, degenerirani
  kotniki, brez merila), safety chain (invalid placement ne pride v BOM;
  CV brez potrditve ni VERIFIED).
- Sintetični SDK benchmark: `bun run bench:measurement` (12 primerov, HARD zakoni).
- **Realne fotografije (#8):** `bun run bench:vision` nad
  `benchmarks/vision-real/` (manifest + fotke lastnika, gitignored).
  Samodejni pass/fail na realnih fotkah se NE izmišljuje — poročilo je za
  **ročno sprejembo lastnika**; HARD exit so samo infrastrukturne napake.

## 11. Znane meje (iskreno)

- Detekcija je optimizirana za jasne frontalne/diagonalne strukture; močno
  prekrivanje, ekstremna perspektiva in slaba svetloba → opozorila + ročni način.
- STAIR/OBSTACLE so GEOMETRIJSKI predlogi — semantiko potrdi uporabnik.
- Live overlay ni tracking (brez WebXR) — pri premiku kamere zaznave ostanejo
  frame-relative; zajem kadra za natančno analizo je priporočen potek.
- Katalog slike produktov so v `evaluation/` z rights `pending` — ne objavljajo
  se; `docs/PWC-ASSETS.md` izpisuje status 1:1.
- Izjemno ozki stebri (<~2 px v delovni resoluciji) lahko izginejo v
  downscale-u → manj zaznanih stebrov; UI dovoli ročni dodaž.
