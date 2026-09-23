# Licenčni audit — GPU backend (S+6, spec §3)

> Načelo: **licenca modela ni dovolj** — pregledane so licence VSEH runtime
> odvisnosti in dodatnih komponent. Audit velja za različice, navedene spodaj;
> ob deploymentu ponovi s `pip-licenses` (ukaz na dnu) in shrani
> `LICENSES-INSTALLED.md`.

## Model

| Komponenta | Licenca | Poslovna uporaba | Vir |
|---|---|---|---|
| **Qwen/Qwen-Image-Edit-2509** (uteži, 20.4B MMDiT) | **Apache-2.0** | ✅ DA | HF model card (uradni Qwen repo) |

Multi-image editing (1–3 vhodne slike) je dokumentirana zmožnost 2509 verzije —
točno primer Roksal: original balkona + referenčna fotografija produkta (+ A-preview
kot vodilo položaja).

## Runtime odvisnosti (gpu-backend/requirements.txt)

| Paket | Licenca | Vloga |
|---|---|---|
| diffusers (>= 0.35.2) | Apache-2.0 | `QwenImageEditPlusPipeline` |
| transformers (>= 4.51.0) | Apache-2.0 | Qwen2.5-VL text encoder |
| accelerate | Apache-2.0 | (neobvezno) cpu-offload |
| safetensors | Apache-2.0 | nalaganje uteži |
| sentencepiece | Apache-2.0 | tokenizacija |
| protobuf | BSD-3-Clause | serializacija |
| PyTorch | BSD-3-Clause | tenzorski runtime |
| CUDA / cuDNN (NVIDIA runtime knjižnice) | NVIDIA EULA (brezplačna distribucija z GPU strojem) | GPU runtime |
| FastAPI | MIT | API (§20 pogodba) |
| uvicorn | BSD-3-Clause | ASGI strežnik |
| pydantic | MIT | sheme |
| Pillow | MIT-CMU / HPND | slikovne operacije |
| numpy | BSD-3-Clause | numerika |

## Dev/CI odvisnosti (requirements-dev.txt — mock način, brez GPU)

| Paket | Licenca |
|---|---|
| fastapi / uvicorn / pydantic | MIT / BSD-3 / MIT |
| httpx | BSD-3-Clause |
| pillow / numpy | MIT-CMU / BSD-3 |
| pytest | MIT |
| pytest-timeout | MIT |

## Zavrnjene / izključene komponente

| Komponenta | Razlog |
|---|---|
| ComfyUI | GPL-3.0 — smešen samo kot eksperimentalno orodje, NE v produkcijskem bundle-u (odločitev že iz S+1) |
| IP-Adapter uteži | CC BY-NC-SA — NEkomercialna (odločitev že iz S+1) |
| FLUX.1 Kontext dev | non-commercial licenca |
| OpenAI / Replicate / Midjourney / Adobe API | spec §2: brez plačljivih zunanjih AI API-jev |

## Sklep

- Celotna produkcijska pot (model + diffusers + PyTorch + FastAPI) je
  **poslovno uporabna** (Apache-2.0 / BSD / MIT).
- Plačljivo je le GPU strojevo (lasten strežnik ~40 €/mes. ali najeta instanca —
  najeta instanca = **TESTNA INFRASTRUKTURA** po spec §2, ne produkcijski servis).

## Ponovitev audita na deploymentu

```bash
pip install pip-licenses
pip-licenses --from=mixed --format=markdown > LICENSES-INSTALLED.md
```
