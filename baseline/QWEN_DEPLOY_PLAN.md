# Qwen-Image-Edit-2509 — Deployment plan za lasten GPU strežnik (Varianta C)

## Zakaj Qwen-Image-Edit-2509
- **Licenca: Apache-2.0** ✅ komercialna uporaba OK (za razliko od IP-Adapter uteži CC BY-NC-SA in FLUX.1 Kontext dev non-commercial)
- **Referenčna slika = vir resničnosti**: model ureja obstoječo fotografijo z upoštevanjem referenčne slike izdelka
  (multi-image editing v 2509 verziji: 1+ referenčnih slik) — točno Roksal primer: "zamenjaj ograjo na tej fotografiji
  z ograjo iz referenčne fotografije, ostalo pusti nespremenjeno"
- Zmogljivost: 20.4B MMDiT (DualDiT), izhod 1MP+, odličnatext render + identiteta ohranitev

## Zahteve
| Nastavitev | VRAM | Opomba |
|---|---|---|
| bf16 (polna) | ~20–23 GB | RTX 4090 24GB / A6000 / L40S — prva izbira |
| GGUF Q4_K_M kvantizacija | ~12–13 GB | RTX 4060 Ti 16GB / T4 16GB — budget opcija |
| Q8 GGUF | ~16–18 GB | kompromis kakovost/VRAM |

## Docker deploy (enačni servis, NE Vercel — Vercel je samo frontend)

```dockerfile
# Dockerfile
FROM pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir "diffusers>=0.35.1" transformers accelerate safetensors \
    fastapi uvicorn[standard] python-multipart pillow
WORKDIR /app
COPY service.py .
EXPOSE 8000
CMD ["uvicorn", "service.py:app", "--host", "0.0.0.0", "--port", "8000"]
```

```python
# service.py — minimalen referenčni servis (TEST ONLY dokazilo koncepta)
import io, torch
from fastapi import FastAPI, UploadFile, Form, File
from fastapi.responses import JSONResponse
from diffusers import QwenImageEditPlusPipeline  # 2509 = multi-image
from PIL import Image
import numpy as np, time

app = FastAPI(title="Roksal Visualize API")
pipe = None

@app.on_event("startup")
def load():
    global pipe
    pipe = QwenImageEditPlusPipeline.from_pretrained(
        "Qwen/Qwen-Image-Edit-2509", torch_dtype=torch.bfloat16)
    pipe.enable_model_cpu_offload()          # varno za 24GB, zmanjša vrh
    # GPU server: možno še pipe.to("cuda") če bf16 celoten pride

@app.post("/visualize")
async def visualize(
    balcony: UploadFile = File(...),         # original fotografija balkona
    product: UploadFile = File(...),         # referenčna fotografija ograje (RAZEN maske)
    mask: UploadFile = File(...),            # maska stare ograje (user poligon)
    prompt: str = Form("Replace the old railing in the masked area with the fence "
                       "from the reference image. Keep everything else unchanged. "
                       "Photorealistic, same lighting and perspective.")):
    t0 = time.time()
    b = Image.open(io.BytesIO(await balcony.read())).convert("RGB")
    p = Image.open(io.BytesIO(await product.read())).convert("RGB")
    m = Image.open(io.BytesIO(await mask.read())).convert("L")
    out = pipe(image=[b, p], prompt=prompt, mask_image=m,  # maska omejuje urejanje (samo ograja)
               true_cfg_scale=4.0, num_inference_steps=40, guidance_scale=1.0,
               negative_prompt=" ")
    img = out.images[0]
    buf = io.BytesIO(); img.save(buf, "JPEG", quality=95)
    return JSONResponse({"image": buf.getvalue().hex(), "took_s": round(time.time()-t0,1)})

@app.get("/health")
def health():
    return {"ok": True, "gpu": torch.cuda.is_available(),
            "vram_gb": round(torch.cuda.mem_get_info()[1]/1e9, 1) if torch.cuda.is_available() else 0}
```

```yaml
# docker-compose.yml (GPU strežnik, npr. Hetzner dedicated + RTX 4090 / ~40 €/mes)
services:
  qwen-edit:
    build: .
    ports: ["8000:8000"]
    volumes:
      - hf-cache:/root/.cache/huggingface   # model ~40GB bf16 se prenese 1x
    deploy:
      resources:
        reservations:
          devices: [{driver: nvidia, count: 1, capabilities: [gpu]}]
volumes:
  hf-cache:
```

## Varnost + arhitektura
- Vercel frontend (mobile web) → `POST https://ai.roksal.si/visualize` (Caddy/Nginx TLS, rate-limit IP, API key)
- **Ni plačljivih AI API** — vse na lastnem GPU; OpenAI/Replicate/Midjourney izključeni
- Čas odgovora: ~30–60 s/slika (40 korakov, 1MP) — frontend prikaže "preverjamo…" progres
- GGUF pot (16GB GPU): `city96/Qwen-Image-Edit-2509-GGUF` + `diffusers` GGUF loader ali ComfyUI (TEST ONLY — ComfyUI je GPL-3.0, samo eksperimentalno orodje, ne produkcijska komponenta)
- Verification protokol (kot zahteva S+1): isti 5 testnih primerov kot pri A/B; kriteriji: 13 letvic = 13 letvic, RAL barvna točka ΔE<6 na letvicah, diff izven maske ≈ 0 (model ureja SAMO regijo maske — preveriti z diff metrics), PREJ/POTEM slider

##zakaj je C rezerviran za GPU strežnik (ne ta sandbox)
- Ta sandbox: 4GB RAM, brez GPU — 20B model je fizično nemogoče naložiti (že GGUF Q4 = ~12GB > RAM)
- Zato Varianta C tukaj = deployment plan + service koda (gor), test na GPU strežniku = naslednji korak pred MVP
