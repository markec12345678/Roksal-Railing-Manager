# Roksal GPU backend — Qwen-Image-Edit-2509 (S+6)

Samostojen inference servis (spec §1): **Vercel ostane frontend; GPU strežnik je
ločen.** Pogodba = spec §20, implementirana in testirana (15/15 pogodbnih testov,
mock način — `tests/test_contract.py`).

```
Vercel (frontend, A-pipeline = produkcija)
   ↓  POST /render        ← spec §20 pogodba
GPU inference server (ta repo: gpu-backend/)
   ↓  Qwen-Image-Edit-2509 (Apache-2.0, bf16, diffusers)
result.png + metadata.json (§13 meritve: VRAM, časi, seed, settings)
```

## Načini delovanja

| Način | Kdaj | Kaj dokazuje |
|---|---|---|
| `QWEN_MOCK=1` (mock) | CPU, brez modela | pogodbo API-ja, cevovod jobov, determinizem — **NE kakovosti** |
| realni (privzeti) | stroj z NVIDIA GPU | dejansko kakovost Qwen-Image-Edit-2509 + meritve |

## Način finalize (primarni, spec §7 "Qwen finalization")

Qwen dobi **[A-preview, produkt]** — geometrija in položaj prihajata iz našega
determinističnega A-pipeline-a; Qwen izboljša robove/sence/integracijo.
Način compose (`[original, produkt]`) je sekundarni (popolna sinteza).

## Pogodba (§20)

```
POST /render
{ "projectId": "...", "original": "<b64>", "product": "<b64>",
  "mask": "<b64>?", "aPreview": "<b64>?",        # aPreview → finalize način
  "placement": {"corners": [[x,y]…]}, "prompt": "…?", "seed": 123,
  "resolution": "preview"|"final", "steps": 40, "trueCfg": 4.0 }
→ 202 { "jobId": "…", "status": "queued" }

GET /jobs/{id}          → queued | processing | completed | failed (+error, +metrics)
GET /jobs/{id}/result   → PNG (200) | 404 (še ne) | 409 (failed — JSON z napako)
GET /jobs/{id}/metadata → §13 zapis (model, VRAM, časi, seed, prompt, settings)
GET /health             → {ok, mode, device, model_loaded, model_id, vram_total_mib}
```

Fail-safe (§21): napaka modela → job `failed`, servis ostane zdrav; v aplikaciji
A-preview VEDNO ostane na voljo (Qwen ni nikoli na poti do A-preview).

## Hitri zagon — GPU stroj

### Docker (priporočeno)

```bash
cd gpu-backend
docker compose up -d --build      # prvi zagon: ~40 GB model se prenese 1× v volume
curl http://localhost:8000/health # mode:"real", vram_total_mib: <izmerjeno>
```

### RunPod / Vast.ai (najeta instanca — **TESTNA INFRASTRUKTURA**, spec §2)

```bash
# instanca: RTX 4090 (24 GB) ali L40S/A6000; image: pytorch/pytorch:2.6.0-cuda12.4-cudnn9-runtime
git clone https://github.com/markec12345678/Roksal-Railing-Manager && cd Roksal-Railing-Manager/gpu-backend
pip install -r requirements.txt
QWEN_OUTPUT_DIR=/workspace/jobs HF_HOME=/workspace/hf uvicorn app.main:app --host 0.0.0.0 --port 8000
# nato od zunaj:  python3 evaluation/run_suite.py --backend http://<IP>:8000 --determinism
```

### Merjenje, ki ga zahteva spec §14/§15 (izvede se SAMODEJNO v metadata)

- model load (ločen od inference), prvi render, naslednji render, povprečje, p95 → `run_suite` +
  `q_*_meta.json`
- vrh VRAM (`torch.cuda.max_memory_allocated`), skupni VRAM, vrh RAM, ime GPU
- **ne ugibamo** ("4090 bi morala zadostovati") — vse številke prihajajo iz meritev

## Optimizacije — ŠELE po prvem merjenju (spec §4)

1. prvi run: bf16, brez offloadinga → izmerjen vrh VRAM (metadata `vram_peak_mib`)
2. če ne gre v 24 GB: `QWEN_CPU_OFFLOAD=1` → ponovi meritve (vpliv na čas zapiši)
3. šele nato: kvantizacija (GGUF/Nunchaku), batching, caching

## Testi (brez GPU-ja)

```bash
cd gpu-backend
python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
QWEN_MOCK=1 .venv/bin/pytest tests/ -v      # 15 pogodbnih testov (§20/§21/§18)
```

## Licenčni audit

Glej [LICENSES.md](LICENSES.md) — model Apache-2.0, celotna produkcijska pot
poslovno uporabna; ponovi `pip-licenses` ob deploymentu.

## Varnost (za javno izpostavitev — S+7, NE prej)

- API ključ / mTLS / rate-limit (Caddy/Nginx TLS), `ai.roksal.si` hostname
- velikostne meje vhodov so vgrajene (`MAX_B64_BYTES`, `MAX_IMAGE_PIXELS`, `MAX_QUEUE`)
- Vercel ↔ GPU: samo strežniško (skrivnost v env, ne v brskalniku)
