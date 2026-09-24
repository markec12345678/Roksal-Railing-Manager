# MEASUREMENT — deterministični merilni sistem (issue #2)

Status: **implementirano (faza 1)** — samodejna CV zaznava + ročna meritev,
skupni Measurement Engine, brez AI v kritični poti. Stari `/api/ai-takeoff`
(VLM) je **odstranjen**.

## Arhitektura

```
Kamera/upload (UI: measurement-studio.tsx)
        │  dataURL JPEG ≤1280px (klient pomanjša)
        ▼
POST /api/measurement/detect ──── sharp decode → detectFeatures()
        │                          (Sobel → Otsu → Hough → črte/stebri)
        │  features + metrics + state (BREZ dimenzij)
        ▼
Uporabnik: potrdi/premakne točke + vpiše ZNANO mero (referenca)
        ▼
POST /api/measurement/confirm ─── buildSession() + mapToGeometry()
        │                          (merilo + geometrija + fence-engine)
        │  MeasurementSession + takeoffPreview
        ▼
Persist (projectId): Measurement (dolzinaMm/visinaMm + session JSON
v arMetadata) + AuditLog — ENA transakcija
```

## Moduli (`src/lib/measurement/`)

| Modul | Odgovornost |
|---|---|
| `types.ts` | tipi + konstante (QualityState, ScaleSourceKind, …) |
| `cv.ts` | čiste CV primitivke: gray, downscale, Sobel, Otsu, dilacija, Hough, NMS, extent |
| `detect.ts` | detekcija ograje: runs (horizontalni prekni), posts, corners, metrike |
| `scale.ts` | merilo IZ reference (nikoli izmišljeno) |
| `engine.ts` | MeasurementSession: stanja, dimenzije z izvorom + negotovostjo, guidance |
| `geometry.ts` | session → FenceRequest → **obstoječi** `computeFenceLayout` (en vir resnice) |

## Zakoni (neizogibni)

1. **Ni AI** v merilni kritični poti (guard test `sdk-s81-determinism-matrix` to dokazuje vsak push).
2. **Ni izmišljenih dimenzij**: brez veljavnega merila je `geometry = null`
   in stanje `SCALE_REQUIRED`. Nikoli ne vrni "točnih" mm brez referenčnega vira.
3. **Sledljivost**: vsaka vrednost ima `source` + `provenance`
   (npr. `detekcija (Hough runs × merilo iz user-known-measure)`).
4. **Determinizem**: enak vhod → bajtno identičen session JSON (100× test, SHA-256).
5. **En vir geometrijske resnice**: layout računa obstoječi fence-engine/Product SDK;
   Measurement SDK ga SAMO hrani z vhodom (ne podvaja logike).

## API

- `POST /api/measurement/detect` — `{ imageData | frames[1..3] }` →
  `{ features, metrics, state: 'DETECTED'|'INSUFFICIENT_DATA', guidance }`.
  Dimenzije SOBIH (merila ni mogoče določiti iz slike same).
- `POST /api/measurement/confirm` — `{ sessionId, source, features?, manual?,
  reference, manualCorrections?, confirmed?, projectId?, geometry? }` →
  `{ session, takeoffPreview?, layout?, savedMeasurementId? }`.
  Strežnik SAM izračuna merilo + geometrijo (klientu NE zaupamo izračunov).
  422, če se meritev brez merila poskuša shraniti.
- `GET /api/measurement/products` — katalog (SDK definicije) za izbiro
  uporabnika; profil se **nikoli ne ugiba** iz slike (§7).

## Stanja kakovosti (docs/MEASUREMENT-QUALITY.md)

`INSUFFICIENT_DATA → DETECTED → SCALE_REQUIRED → MEASUREMENT_READY →
USER_REVIEW_REQUIRED → VERIFIED` — prehodi so deterministične funkcije
vhodnih podatkov, ne ocen.

## Kaj je (zaenkrat) izven obsega — iskreno

- **Perspektivna korekcija** pri meritvi (v1: fronto-parallel predpostavka;
  zaznani kotniki so že shranjeni za prihodnjo homografsko rektifikacijo).
- **Živi video overlay** v realnem času (implementiran je zajem kadra iz
  kamere + detekcija zajetega kadra; `frames[1..3]` že podpira
  temporalno stabilnost).
- **Polna BOM + ponudba iz meritve**: `takeoffPreview` (deske, linearni metri,
  rezi, stebri) izhaja iz fence-engine; cenovna plast ostaja v obstoječem
  Ponudba/deal-lock toku (povezava = naslednja faza).
- **Roksal marker** (`roksal-marker`) in depth senzorji: tipi pripravljeni,
  detekcija markerjev ni implementirana.
