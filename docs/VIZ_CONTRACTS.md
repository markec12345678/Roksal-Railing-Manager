# VIZ (Vizualizacija ograje) — S+2 CONTRACTS — SINGLE SOURCE OF TRUTH

Round S+2: mobile-first MVP for fence visualization on balcony photos.
Proven baseline (Round S+1, commit 0f4a283): variant A classical synthesis —
13=13 letvice identity, diff=0 outside mask, 1.37s CPU, RAL-safe luminance-only
harmonization. **The A-pipeline algorithm must be ported 1:1, NOT redesigned.**

## HARD INVARIANTS (read first)

1. NO new page routes. The wizard lives in the EXISTING app at `/` as a new tab
   (`viz`) in `src/components/roksal/bottom-nav.tsx` + rendered from
   `src/app/page.tsx` (dynamic import, `ssr:false`, same pattern as other tabs).
   API routes under `/api/viz/*` are allowed (`/api/projects` already exists —
   DO NOT touch it, do not collide).
2. NO new npm packages. Available: sharp, zustand, lucide-react, framer-motion,
   sonner, zod, all shadcn/ui in `src/components/ui`. Tests: vitest (existing).
3. A-pipeline = deterministic geometry + classical synthesis. Text in UI says
   "Pripravljam predogled …" — NEVER "AI ustvarja".
4. 4 corners = pure geometry (homography). No AI.
5. RAL guard: NO full-channel color transfer (repo ColorMatcher is FORBIDDEN,
   proven ΔE=38.4). Only luminance-only harmonization (a/b channels untouched).
6. Original image outside mask must remain pixel-identical (diff=0 by
   construction; verified by metrics + tests).
7. Never run `bun run build`. Dev server is ALREADY RUNNING on :3000 (do not
   start/kill/restart it; do not write port numbers into fetch URLs — relative
   paths only, e.g. `fetch('/api/viz/stage')`).
8. Mobile-first: min 44px touch targets, no horizontal scroll at 390px, safe-area
   aware. UI language: Slovenščina (labels given below).
9. Every agent MUST read `/home/z/my-project/worklog.md` before starting and
   append its section after finishing (template at top of file).

## DATA MODEL

### placement.json (stored per project; normalized coordinates 0..1, independent of screen size)

```json
{
  "version": 2,
  "corners": [[x,y],[x,y],[x,y],[x,y]],
  "rotation": 0,
  "scale": 1,
  "productQuad": [[x,y],[x,y],[x,y],[x,y]] | null
}
```

- `corners`: order TL, TR, BR, BL — fractions of ORIGINAL image width/height.
- `productQuad`: the fence plane inside the PRODUCT photo (TL,TR,BR,BL,
  normalized to product dims); `null` ⇒ auto: tight bbox of product cutout.
- TS types in `src/lib/viz/types.ts` (already written — import from there).

### Project folder layout (MVP spec) — STORAGE DRIVER (runda S+3)

Kanonična datoteka projekta: `original.jpg`, `product.jpg`, `product-mask.png`,
`mask.png`, `placement.json`, `preview.jpg`, `result.json` (+ `project.json`
samo v blob načinu = metadata dokument). Shramba je DRIVER-AGNOSTIČNA
(`src/lib/viz/storage.ts`):

- **local** (dev/test, privzet brez tokenov): datoteke na disku pod
  `public/viz/{staging,projects}/…`, javni URL-ji `/viz/…` (statično iz public/).
  Metadata = Prisma (SQLite) — kot v S+2.
- **blob** (produkcija na Vercelu; sproži ga `BLOB_READ_WRITE_TOKEN`,
  preglas z `VIZ_STORAGE_DRIVER=local|blob`): datoteke v Vercel Blob pod
  ključi `viz/staging/<token>/<ime>`, `viz/projects/<id>/<ime>`,
  `viz/render-jobs/<jobId>.json`; javni URL-ji so ABSOLUTNI blob URL-ji
  (CORS `*`, preverjeno). Metadata = `project.json` dokumenti v isti Blob
  shrambi (SQLite na serverless ni trajen). Seznam = list prefix
  `viz/projects/` + project.json (createdAt desc, max 50).

API odgovori vračajo `url` iz driverja — klient NE SME sklepati na obliko
(relativna `/viz/…` ali absolutna `https://….public.blob.vercel-storage.com/…`).
Demo assets in `public/viz-demo/` ostajajo committed.

### Prisma (add to existing schema, do not modify existing models)

```prisma
model VizProject {
  id               String   @id @default(cuid())
  name             String
  originalPath     String
  productPath      String
  productMaskPath  String?
  maskPath         String
  previewPath      String?
  resultPath       String?
  resultImagePath  String?
  placement        String
  variants         String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  renderJobs       VizRenderJob[]
}

model VizRenderJob {
  id         String     @id @default(cuid())
  projectId  String
  project    VizProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  status     String     @default("queued")
  engine     String     @default("qwen-image-edit-2509")
  inputJson  String
  resultPath String?
  error      String?
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
}
```

## API CONTRACTS (all JSON errors: `{ error: string }`, proper HTTP codes)

### POST /api/viz/stage  (multipart/form-data)
- fields: `file` (Blob), `kind`: `"balcony" | "product" | "productMask" | "mask"`
- Validate: MIME ∈ {image/jpeg, image/png, image/webp}, size ≤ 12MB.
  Using sharp: `.rotate()` (EXIF auto-orient), images (balcony/product) resized
  to max 1600px on the long side, JPEG q90. Masks (productMask/mask) resized to
  max 1600px, saved as PNG (grayscale, white = area).
- Response 200: `{ "token": "...", "url": "/viz/staging/<token>/<name>", "w": 1024, "h": 1024, "bytes": 123456 }`
- Invalid → 400 `{ error }`.

### POST /api/viz/preview  (application/json)
```json
{
  "originalToken": "...", "productToken": "...",
  "productMaskToken": null, "maskToken": "...",
  "placement": { "version":2, "corners": [[0.23,0.45],[0.93,0.29],[0.93,0.65],[0.23,0.71]], "rotation":0, "scale":1, "productQuad": null }
}
```
- Loads staged files, runs the A-pipeline (`runPipeline` from `@/lib/viz/pipeline`),
  writes `preview.jpg` + `result.json` into the staging dir.
- Response 200: `{ "previewUrl": "/viz/staging/<t>/preview.jpg", "metrics": <PipelineMetrics> }`
- 400 on missing/invalid tokens; 500 on pipeline error `{ error }`.

### POST /api/viz/projects  (application/json)
```json
{ "name": "Balkon - testa 1", "stagingToken": "...", "variants": [ { "label": "Ograja B", "productToken": "...", "productMaskToken": null } ] }
```
- Moves staging dir → `public/viz/projects/<id>/`, creates VizProject row.
  `variants` optional; each variant gets its own product/product-mask files
  stored as `product-<i>.jpg` / `product-mask-<i>.png` + `variants` JSON with
  `{label, productPath, productMaskPath}` (data model ready for A/B/C).
- Response: `{ "projectId": "...", "urls": { original, product, mask, preview, ... } }`

### GET /api/viz/projects → `{ "projects": [ { id, name, previewPath, createdAt, placement (parsed) } ] }` (newest first, max 50)
### GET /api/viz/projects/[id] → `{ "project": { ...all fields, placement parsed, variants parsed, urls: {...} } }` | 404
### DELETE /api/viz/projects/[id] → `{ ok: true }` (delete files + row) | 404

### POST /api/viz/render  (application/json) — GPU job stub (Qwen NOT production yet)
```json
{ "projectId": "...", "prompt": "integrate the fence naturally" }
```
- Creates VizRenderJob(status "queued"). If `process.env.VIZ_GPU_URL` is set,
  attempts `fetch(VIZ_GPU_URL + "/render", {method:"POST", body})` with 3s
  timeout and stores `engine="qwen-image-edit-2509"`; if unset/fails, job stays
  `queued` with `error` note `GPU backend ni nastavljen (VIZ_GPU_URL) — caka na
  lasten GPU streznik`. NEVER claim Qwen works.
- Response: `{ "jobId": "...", "status": "queued" }`
### GET /api/viz/render/[jobId] → `{ "jobId", "status": "queued|processing|completed|failed", "resultPath": null, "error": "...|null" }`

## PIPELINE CONTRACT (`src/lib/viz/pipeline.ts`, pure TS, no cv2, ported from
`/home/z/my-project/baseline/variant_a.py` — READ IT, keep same params)

```ts
import type { ImageBuffer, Corners, PipelineMetrics, PipelineOptions } from '@/lib/viz/types'

export function runPipeline(input: {
  original: ImageBuffer; mask: ImageBuffer; product: ImageBuffer;
  productMask: ImageBuffer | null;          // null ⇒ auto cutout
  cornersPx: Corners;                       // pixels on original
  productQuadPx: Corners | null;            // pixels on product; null ⇒ bbox of alpha
  options?: PipelineOptions;
}): { preview: ImageBuffer; metrics: PipelineMetrics }

export function cutoutProduct(img: ImageBuffer, quadPx?: Corners | null): { alpha: Float32Array; w: number; h: number }
// usable in BROWSER too (pure TS) — UI uses it for product mask auto-preview
```

Pipeline steps (EXACT params from variant_a.py):
1. mask resized to original dims (nearest) if needed.
2. Background synthesis: per column of mask region — top band
   `[yt-20, yt-8)`, bottom band `[yb+8, yb+20)`, per-column MEDIAN color,
   linear vertical interpolation; then Gaussian σ3 blur blended inside mask
   with mask blurred σ2 as weight.
3. Product cutout: gray<115 → MORPH_CLOSE 7×7 → keep largest connected
   component + any component inside quad with area>4000 → Gaussian σ0.8 (3×3).
4. Homography (DLT solve from 4 correspondences) productQuadPx→cornersPx;
   inverse mapping + bilinear sampling for color and alpha.
5. Luminance-only harmonization in LAB (L 0..255 scale like OpenCV): ring =
   dilate(mask,61) − erode(mask,9); illum = Gaussian(L_scene, σ25);
   field = clip(illum / mean(illum[ring]), 0.85, 1.15);
   strength = Lmean_product<70 ? 0.6 : 1.0; L' = L·(1+strength·(field−1));
   a,b UNCHANGED.
6. Feather: alpha blur radius ≈3, composite over background.
7. Contact shadow band under bottom edge (as in python: 28 steps, max 0.22,
   blur 21 σ5, multiply 0.4) — applied ONLY near bottom edge span.
8. Metrics: `letviceProduct`/`letviceResult` via rectify-to-700×300, central
   strip 35–65%, row profile >0.5 rising edges; `outsideMax/outsideMean` = abs
   RGB diff outside mask (before shadow application vs original — shadow may
   bleed slightly outside, also report `outsideMaxPreShadow` = 0 target);
   `chroma`: mean a,b of product pixels before/after harmonization (RAL guard,
   target |Δ|<1.5); `timeMs` per step + total.

Performance budget: 1024×1024 ≤ 8s in sandbox (2 CPU). Use typed arrays,
avoid per-pixel closures where hot.

## TESTS (vitest, `src/lib/viz/__tests__/viz-pipeline.test.ts` + `viz-placement.test.ts`)
1. geometry: solveHomography maps 4 corners exactly (≤0.5px), synthetic rotation/scale quad warp preserves a rect.
2. compositing: synthetic scene+product → outsideMaxPreShadow === 0.
3. RAL guard: uniform illumination ⇒ |Δa|,|Δb| < 1.5; gradient illumination ⇒ chroma shift still < 1.5.
4. letvice counter: synthetic alpha with 5 bars ⇒ 5.
5. integration (real demo assets `public/viz-demo/`): letviceProduct === letviceResult, outsideMaxPreShadow === 0, chroma ok, total < 8s. Mark `as const` metrics in result.json.
6. placement roundtrip: normalize↔denormalize ↔ cornersPx stable.

Run: `bun run test` (whole suite must stay green — existing tests too).

## UI CONTRACT (`src/components/viz/`) — Slovenian labels, mobile-first

Store: `src/components/viz/viz-store.ts` (zustand): `step`, balcony {token,url,w,h}, product {…}, productMask {…, edited}, mask {…, edited}, corners (normalized), productQuad (normalized|null), preview {url, metrics}, variants[], activeVariant, projectName, loading flags.

Steps (Stepper visible: 7 pikes, current highlighted):
1. **BALKON** — `step-balcony.tsx`: big card with two buttons [📷 Fotografiraj] (`<input type=file capture="environment" accept="image/*">`), [🖼 Iz galerije] (same input without capture), desktop drag&drop zone. After load: preview + [Zavrti 90°] + [Obreži] (simple draggable crop rect + [Potrdi]/[Prekliči]) + [Zamenjaj]. Client-side: canvas downscale ≤1600px + JPEG 0.9 → POST /api/viz/stage(kind=balcony). Also "Preizkusni primer" button (demo loader, see below) on start screen.
2. **IZDELEK** — `step-product.tsx`: card "MOJA OGRAJA" with photo, [Uporabi] (proceed), [Zamenjaj fotografijo]. Auto-cutout preview via `cutoutProduct()` (client), then [Uredi masko] → `mask-editor.tsx` (brush/erase/zoom/pan/undo/redo/reset; brush size slider; finger-size controls ≥44px; checkerboard bg for transparency; export PNG white=product) → stage(kind=productMask).
3. **STARA OGRAJA** — `step-mask.tsx`: tools: POLIGON (tap points, [Zapri poligon], ≥3 points), BRUSH, ERASE, UNDO, REDO, RESET, PONASTAVI VSE; pinch/pan on image; hint text "Označi staro ograjo — pobarvana območja bodo zamenjana". Export PNG white=area → stage(kind=mask).
4. **4 VOGALI** — `step-corners.tsx`: image with 4 big handles (≥44px touch, numbered ●), drag with pointer events; pinch zoom + 2-finger pan of viewport; [Ponastavi]; fine adjust panel (▲▼◀▶ nudge ±0.002 normalized, plus coarse ±0.01); live ghost preview of product warped into quad (canvas, two-triangle affine approximation, opacity 0.85); [Pripravi predogled] → text "Pripravljam predogled …" (NEVER "AI") → POST /api/viz/preview → step 5.
5. **PREDOGLED (PREJ|POTEM)** — `step-result.tsx`: before/after slider (pointer-draggable divider with handle, labels PREJ | POTEM), [Celozaslonsko] (Dialog fullscreen with slider + zoom +/− /reset + close), metrics panel: "Letvice: 13 = 13 ✓", "Original izven maske: nespremenjen ✓", "Barva (RAL): ΔE 0.4 ✓", "Čas: 1.9 s". [Shrani projekt] (name input + POST /api/viz/projects) → toast + project list refresh. Variants: section "VARIANTI" — current product = "Ograja A"; [Dodaj varianto] → pick another product photo (+optional mask edit) → run preview reusing same balcony/mask/corners → save → variants listed (A/B/C pills).
6. **AI FINISH (Qwen)** — small section, DISABLED state: "Qwen-Image-Edit-2509 — planirano / caka na GPU streznik" + [Zahtevaj AI finish] button that POSTs /api/viz/render and shows job status + honest note. Must NOT be labeled as working.
7. Start screen also lists saved projects (GET /api/viz/projects): card per project (name, preview thumb, date) → tap opens project (GET detail → loads images into state → jumps to PREJ|POTEM view; [Nadaljuj urejanje] available).

Demo loader: button "Preizkusni primer" on step 1 fetches `/viz-demo/demo.json`, fetches its images as blobs, stages them via /api/viz/stage (kind=balcony/product/mask), sets corners+productQuad from demo.json (already normalized), skips mask/product-mask editing (mask ready, productQuad measured) → jumps to step 4.

Tab integration: add `viz` to `TabId` + `mainTabs` (icon `Wand2`, label "Vizualizacija", position right after `dashboard`, `highlight: true`), render `VizTab` in page.tsx tab switch via `dynamic(..., { ssr:false, loading: TabLoading })`.

Style: use existing roksal design tokens (bg-white cards, rounded-2xl, roksal-navy/amber), consistent padding p-4, gap-4, buttons h-11 min; NO horizontal scroll at 390px; images `object-contain` max-h; long lists max-h-96 overflow-y-auto.

## DEMO ASSETS (already prepared by orchestrator — do not regenerate)
`public/viz-demo/balcony.jpg` (1024×1024), `product.jpg` (1600×1200),
`mask.png` (1024×1024, L, white=old fence), `demo.json`
(balcony/product dims + normalized corners + normalized productQuad).

## FILES BY TASK
- S2-a: `src/lib/viz/homography.ts`, `color.ts`, `imageops.ts` (blur/morph/cc/resize helpers), `pipeline.ts`, `src/lib/viz/__tests__/*.test.ts`
- S2-b: `prisma/schema.prisma` (append models only), `src/app/api/viz/**`, `src/lib/viz/storage.ts`, `src/lib/viz/validate.ts`, `.gitignore` (add `public/viz/staging/`, `public/viz/projects/`), run `bun run db:push`
- S2-c: `src/components/viz/**`, integration edits in `src/app/page.tsx` + `src/components/roksal/bottom-nav.tsx`
- Orchestrator: `docs/VIZ_CONTRACTS.md`, `src/lib/viz/types.ts`, `public/viz-demo/*`

Conflict rules: each agent only touches its own files; shared imports only via
`@/lib/viz/types` (orchestrator-written) and contracts above. If you need a
change to a shared file, note it in worklog instead of editing.

## S+4 — OWNERSHIP POLICY (P0, security)

Vsak viz projekt in render job je vezan na **uporabniško sejo**, ki ga je ustvarila:

- `ownerId = SessionPayload.sub` (Profile.id) — zapisan v Prisma (`VizProject.ownerId`,
  `VizRenderJob.ownerId`) oziroma v `project.json`/job dokumentu (blob način).
- **API ključi (rkm_…) NIMAJO dostopa do /api/viz/*** — 403. Viz je vezan na prijavo
  (API ključi so namenjeni samo sinhronizaciji izmere, ne vizualizacijam).
- **Tuj ali neobstoječ projekt → 404** (NE 403) — ena konsistentna politika, ne puščamo
  informacije, ali projekt z danim id obstaja. Vsi /api/viz/* handlerji preverjajo
  lastništvo na backendu (frontend je samo udobje, nikoli varnost).
- **Zapuščinski zapisi** (`ownerId = null`, ustvarjeni pred S+4): vidni/administrirajo
  samo uporabniki z vlogo ADMIN. Vsak nov projekt vedno dobi ownerId.
  (R127: demo račun je MONTER — zapuščinskih zapisov ne vidi, kar je po matriki
  pravilno.)
- Vrsta dostopov (matrica §1): user A vidi/odpre/preimenuje/zbriše SAMO svoje;
  user B za A-jev projekt vedno dobi 404 — tudi za `POST /api/viz/render` in
  `GET /api/viz/render/[jobId]` (jobi imajo svoj ownerId).
- Implementacija: `src/lib/viz/ownership.ts` (`vizOwner`, `mayAccess`),
  repozitorij `*ForOwner` funkcije, rute `src/app/api/viz/**`.
