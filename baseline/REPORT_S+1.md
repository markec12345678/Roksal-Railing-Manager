# Round S+1 — ML BASELINE poročilo (BASELINE → VERCEL WEB)

**Datum:** 2026-09-23 · **Repo testiran:** `nazarpalamarenkoo-ui/AI-Photo-Object-Editor` (MIT)
**Zahteva uporabnika:** ne zaupaj README — kloniraj, preberi kodo, poženi, DOKAŽI z dokazili.

## 1. Repo — dejansko preverjeno (ne iz README)

| Trditev | Preverjeno v kodi | Licenca | Odločitev |
|---|---|---|---|
| SD1.5-inpainting (`stable-diffusion-v1-5/stable-diffusion-inpainting`) | `diffuser_inpainter.py:47` | OpenRAIL-M ✅ | OBDRŽI |
| IP-Adapter (`h94/IP-Adapter`, plus variant) | `diffuser_inpainter.py:49` + `settings.py:61` | **CC BY-NC-SA 🔴** | **IZLOČI** (nekomercialno) |
| YOLOv10m (Ultralytics) | `detector.py:39` | **AGPL-3.0 🔴** | **IZLOČI** (MVP ne potrebuje — monter riše poligon) |
| MobileSAM (ViT-T) | `segmentor.py` | Apache-2.0 ✅ | OBDRŽI |
| LaMa prek `iopaint` | `inpainter.py` | Apache-2.0 ✅ | OBDRŽI |
| rembg / u2net (izrez) | `background_remover.py:7` | Apache-2.0 ✅ | OBDRŽI (nadgradnja: BiRefNet MIT) |
| FLUX.1 Kontext dev | — (v repotu ni) | Non-Commercial 🔴 | IZLOČEN vnaprej |
| Qwen-Image-Edit-2509 | — (naša nadgradnja) | **Apache-2.0 ✅** | PRIPOROČENO za generativni finish |

Dokumentacija (`docs/ML_PIPELINE.md`) je **točna** — koda ustreza opisu (dve poti: YOLO→LaMa, SAM→LaMa/Diffusion; diffusion samo prek SAM maske). Procesorji (`EdgeBlender`, `ColorMatcher`, ...) so čisti cv2/numpy — poženi na CPU brez torch in ponovno uporabljeni v naši baseline skripti.

## 2. Varianta A — klasična sinteza: **PASSED** (dokazano)

Pipeline: izrez produkta → odstranitev stare ograje (stolpična sinteza ozadja) → **4-točkovna perspektiva = geometrija** (`getPerspectiveTransform`, NE AI) → **RAL-varna luminance-only harmonizacija** (samo L polje ±15 %, kroma (a/b) nespremenjena) → feather blend z repo `EdgeBlender` → kontaktna senca.

**Izmerjeni dokazila** (`A_metrics.json`, slike v `baseline/`):

| Kriterij | Rezultat |
|---|---|
| Identiteta ograje (štetje letvic, rektificiran prostor) | **produkt 13 = rezultat 13 ✓** |
| Barva izdelka (RAL) | ohranjena — kroma nespremenjena po konstrukciji |
| Original fotografija izven maske | **diff = 0** (pred kontaktno senco, ki je dovoljen robni učinek) |
| Čas celotnega pipeline (CPU, 2 jedra) | **1.37 s** |
| Repo `ColorMatcher` (mean/std vseh kanalov) — PRIMERJAVA | **ΔE = 38.4** na izdelku → uniči RAL → NE uporabljati; naša luminance-only metoda je obvezna izboljšava |

Opozorilo (svetloba): sunlit produktna fotografija daje svetlejši "srebrn" videz — v MVP izbrati produktno foto v primerljivi svetlobi ali dodati ekspozicijski drsnik.

## 3. Varianta B — SD1.5-inpainting: **TEST PENDING GPU** (2× OOM dokaz)

Sandbox: brez GPU, 2.0 GB prosto RAM. Oba poskusa OOM-killed med fetch/load (fp16 + `low_cpu_mem_usage` + `MALLOC_ARENA_MAX=2`) — fizično nemogoče. Skripta `variant_b_sd15.py` pripravljena za GPU (cuda, 30 korakov, ~20–60 s). IP-Adapter **izpuščen** (licenca) → text-only pogoj, pričakovano ne ohrani identitete → dokaz za potrebo po referenčni poti (A/C).

## 4. Varianta C — Qwen-Image-Edit-2509: **deployment pripravljen**, test na GPU strežniku

Apache-2.0 (edina komercialno čista referenčno-vodena pot). 20.4B → v sandboxu nemogoče (GGUF Q4 ~12 GB > 4 GB RAM). Polen plan: `QWEN_DEPLOY_PLAN.md` (Dockerfile, FastAPI servis z masko + referenčno sliko, VRAM tabela, arhitektura **Vercel (mobile web) → lasten GPU Docker strežnik → rezultat**; ni plačljivih AI API).

## 5. MVP podatkovni model — že materializiran

`project_demo/`: `original.jpg · product.jpg · mask.png · placement.json (4 vogali, verzija) · preview.jpg · result.json` — točno po specifikaciji.

## 6. STOP/GO

> **GO (pogojno):** Varianta A je dokazano uporabna "instant preview" (identiteta ✓, original ✓, 1.4 s). Generativni finish (C Qwen na lastnem GPU) se dokaže na GPU strežniku z istimi 5 realnimi testi — za MVP mobile web na Vercelu je arhitektura jasna in licenčno čista.

**Naslednji koraki:** 1) GPU strežnik: deploy Qwen plana + variant B/C testi + 5 realnih primerov; 2) Vercel MVP: 7-korakovni mobile tok (slika → izdelek → poligon → 4 vogali → preview A → AI finish C → PREJ/POTEM).
