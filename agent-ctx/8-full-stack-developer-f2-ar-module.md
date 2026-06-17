# Task 8 — Faza 2 — AR Scanner Module

**Agent:** full-stack-developer (F2 AR module)
**Date:** 2026-06-17
**Status:** ✅ Complete — ESLint 0 errors, TypeScript clean, Next.js compiles successfully

## Files Created

| File | Lines | Description |
|------|-------|-------------|
| `src/components/roksal/ar-scanner.tsx` | 1706 | Main AR scanner — full-screen camera + canvas overlay |
| `src/components/roksal/ar-scanner-launcher.tsx` | 65 | Wrapper with "Odpri AR kamero" button |

No existing files modified (per task constraints).

## Architecture

### Component tree
```
<ArScannerLauncher projectId>
  └── <ArScanner projectId onClose>   (when open, fixed inset-0 z-50)
        ├── <header>  Top bar: close · profile Select · calibrate · capture · history
        ├── <div containerRef>  Camera + Canvas overlay
        │     ├── <video>      Rear camera (getUserMedia, facingMode: 'environment')
        │     ├── <canvas>     Transparent overlay — points, railing, measurements
        │     ├── empty-state hint
        │     └── status banner
        ├── <footer> Mode bar: Točke · Izbriši · Premakni · Meri · Počisti vse
        ├── <Dialog>  Calibration (enter real mm, then tap 2 points)
        ├── <Dialog>  Measurement label (enter oznaka, save)
        └── <Sheet>   History of saved AR snapshots (list + delete)
```

### State machine (mode)
- `ADD` (default) — tap canvas → append `{x, y, label}` to `tocke[]`
- `REMOVE` — tap within 30px of a point → remove it, renumber labels
- `MOVE` — pointerdown near a point starts drag (setPointerCapture); pointermove updates coords; pointerup ends drag
- `MEASURE` — tap point A → tap point B → opens label dialog → saves `Meritev`
- Calibration (orthogonal to modes, takes priority) — tap point A → tap point B → computes `pixelsPerMm = pixelDist / realMm`

### Canvas drawing pipeline
`useEffect` redraws whenever `[tocke, meritve, selectedProfil, kalibracija, mode, measureFirstPoint, calibrateActive, calFirstPoint]` change.

Order of operations (back to front):
1. Clear canvas
2. `drawRailing()` (if 2+ points and profile selected) — infill first, then posts, then top rail
3. `drawMeasurement()` for each saved measurement
4. Pending markers (first point for measure/calibrate)
5. `drawAnchorPoint()` for each post — amber for middle, navy for end posts

### Railing visualization (per profile.kategorija)
| Category | Infill |
|----------|--------|
| `WPC vodoravno` | Horizontal brown slats (#8b5a2b) spaced `110mm × pixelsPerMm` apart (or 18px fallback) |
| `WPC pokončno` | Vertical brown balusters, same spacing |
| `Inox` (any) | Vertical silver balusters (#c0c4cc) |
| `Steklo` (any) | Translucent blue-white panel `rgba(186,230,253,0.35)` with white highlight |
| `Alu klasično` | Navy bottom rail + gray vertical pickets |

Post height = `profil.visinaMm × pixelsPerMm` (capped at 600px), or 200px fallback when uncalibrated.

### Calibration
- Click `Crosshair` icon → opens Dialog with Input for `realMm` (default 600)
- Click "Izberi 2 točki" → `calibrateActive = true`, status banner updates
- Tap canvas: first tap stores `calFirstPoint`; second tap computes `pixelsPerMm` and saves `Kalibracija`
- Once calibrated: green badge `✓ {px/mm}` in top-right; icon click resets

### Capture & save
- Click `Camera` icon → builds a composite canvas at displayed size:
  - Fill black background
  - Draw video frame with `object-cover` semantics (scale = max(cw/vw, ch/vh), centered)
  - Draw overlay canvas scaled 1:1 onto composite
  - `toDataURL('image/png')` → base64 PNG
- POST `/api/ar-snapshots` with `{projectId, profilId, imageUrl, tocke, meritve, kalibracija, opombe: null}`
- Loading spinner on button while saving; toast on success/error
- Disabled when 0 points or already saving

### History sheet
- Right-side Sheet, fetches `/api/ar-snapshots?projectId=…`
- Each `SnapshotCard` shows thumbnail (base64 PNG), profile name, timestamp, delete button
- Click thumbnail to expand and see točke/meritve/kalibracija counts (parsed from JSON strings)
- "Osveži" button to re-fetch

### Camera error handling
Catches DOMException by name:
- `NotAllowedError`/`SecurityError` → "Dostop do kamere je zavrnjen…"
- `NotFoundError`/`OverconstrainedError` → "Kamera ni najdena…"
- `NotReadableError` → "Kamera je v uporabi v drugem programu…"
- Other → "Napaka kamere: {message}"

Full-screen error card with `RotateCcw` retry button (re-requests getUserMedia).

### Cleanup
- `streamRef.current.getTracks().forEach(t => t.stop())` on unmount
- ResizeObserver + window resize/orientationchange listeners disconnected
- Pointer capture released on pointerup

## Key Technical Decisions

1. **DPR-aware canvas** — `canvas.width = displayWidth × devicePixelRatio`, then `ctx.setTransform(dpr,0,0,dpr,0,0)` so all drawing uses CSS pixels (matches pointer event coordinates).
2. **`touch-action: none`** on canvas — prevents iOS Safari from scrolling/zooming during canvas interactions.
3. **Pointer events (not mouse/touch)** — unified handler works for mouse, touch, pen; `setPointerCapture` ensures we get pointermove/up outside canvas during drag.
4. **`roundRect` fallback** — uses feature-detection to fall back to `fillRect` for older Safari.
5. **Profile loaded on mount, first auto-selected** — instant railing visualization once user adds 2 points.
6. **`'use client'`** directive on both files (camera/canvas require browser APIs).
7. **`useToast` from `@/hooks/use-toast`** (not sonner) — matches existing app's Toaster wired in `layout.tsx`.
8. **All buttons `type="button"`** — critical Next.js 16 / shadcn pattern.
9. **No indigo/blue** — pure Roksal theme (navy #1d2b3e, amber #f59e0b, green #10b981, red #ef4444).

## Verification

- ✅ `bun run lint` — 0 errors, 0 warnings
- ✅ `tsc --noEmit` — no errors specific to my files (pre-existing errors in `examples/` and `src/app/api/sync/route.ts` are not my concern)
- ✅ Temporary `/tmp-ar-test` route compiled successfully (649ms compile, HTTP 200); route deleted after verification
- ✅ Dev log shows no errors related to `ar-scanner`

## How to wire into navigation (later task)

```tsx
import { ArScannerLauncher } from '@/components/roksal/ar-scanner-launcher'

// Inside any tab where projectId is known:
<ArScannerLauncher projectId={selectedProjectId} />
```

When `projectId` is null, the launcher shows a "Najprej izberite projekt" prompt instead of the button.
