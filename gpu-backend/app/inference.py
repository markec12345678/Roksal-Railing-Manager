"""Realni inference — Qwen-Image-Edit-2509 prek diffusers (spec §1/§3/§4).

NAČELOVAN (spec §4): brez kvantizacije/offloadinga po privzetem — bf16 na GPU,
izmerjen vrh VRAM. Optimizacija (QWEN_CPU_OFFLOAD=1) je izbira, ne privzeto.

Delovni nalog:
  - finalize (primarni, spec §7 "Qwen finalization"): vhoda = [A-preview, produkt] —
    geometrija/položaj prihaja iz našega determinističnega A-pipeline-a, Qwen
    izboljša robove/sence/integracijo.
  - compose (sekundarni): vhoda = [original, produkt] — Qwen sam sintetizira vgradnjo.

Prompt (spec §17): minimalen in determinističen (privzeto CANONICAL_PROMPT),
negative prompt " " (uradni demo), seed via torch.Generator (spec §18).
"""
import io
import logging
from typing import Optional

from PIL import Image, ImageFile

from . import settings
from .metrics import GpuWatcher, Stopwatch, gpu_name, ram_peak_mib, vram_total_mib

logger = logging.getLogger("gpu-backend.inference")

ImageFile.LOAD_TRUNCATED_IMAGES = False

PIPELINE = None
LOAD_SECONDS: Optional[float] = None


class InferenceUnavailable(RuntimeError):
    """Realni način zahteva torch/diffusers + GPU."""


def _snap16(v: int) -> int:
    return max(16, int(round(v / 16)) * 16)


def target_dims(w: int, h: int, resolution: str) -> tuple[int, int]:
    """Ohrani razmerje stranic; dolgi rob po profilih §16; obe dim. deljivi s 16."""
    long_edge = settings.RESOLUTION_LONG_EDGE.get(resolution, 1408)
    scale = min(1.0, long_edge / max(w, h))
    tw, th = _snap16(int(w * scale)), _snap16(int(h * scale))
    # varnostni proračun (~1.6MP) — če presežen, pomanjšaj po dolgem robu
    while tw * th > settings.MAX_PIXEL_BUDGET:
        tw, th = _snap16(int(tw * 0.9)), _snap16(int(th * 0.9))
    return tw, th


def load_pipeline() -> float:
    """Naloži model 1× ob zagonu; vrni čas nalaganja (spec §14 loči load od inference)."""
    global PIPELINE, LOAD_SECONDS
    if PIPELINE is not None:
        return LOAD_SECONDS or 0.0
    try:
        import torch  # noqa: WPS433 — odvisnost le v realnem načinu
        from diffusers import QwenImageEditPlusPipeline
    except Exception as e:  # pragma: no cover — sandbox brez torch
        raise InferenceUnavailable(
            f"realni način zahteva torch + diffusers ({e}); "
            "za CPU test pogodbe uporabi QWEN_MOCK=1"
        ) from e

    if not torch.cuda.is_available():
        raise InferenceUnavailable("CUDA ni dosegljiva — realni način zahteva NVIDIA GPU")

    sw = Stopwatch()
    logger.info("nalagam %s (bf16, device=%s) …", settings.MODEL_ID, settings.DEVICE)
    pipe = QwenImageEditPlusPipeline.from_pretrained(
        settings.MODEL_ID, torch_dtype=torch.bfloat16
    )
    if settings.CPU_OFFLOAD:
        pipe.enable_model_cpu_offload()  # izbrana optimizacija (spec §4)
    else:
        pipe.to(settings.DEVICE)
    PIPELINE = pipe
    LOAD_SECONDS = sw.elapsed()
    logger.info("model naložen v %.1f s", LOAD_SECONDS)
    return LOAD_SECONDS


def _to_pil(data: bytes) -> Image.Image:
    img = Image.open(io.BytesIO(data))
    if img.width * img.height > settings.MAX_IMAGE_PIXELS:
        raise ValueError("slika presega dovoljene mere")
    return img.convert("RGB")


def run_edit(
    *,
    images: list[Image.Image],
    prompt: str,
    seed: int,
    width: int,
    height: int,
    steps: int,
    cfg: float,
    negative: str = " ",
) -> tuple[Image.Image, dict]:
    """Izvedi en edit; vrni (slika, meritve). Determinizem: fiksni seed (§18)."""
    if PIPELINE is None:
        load_pipeline()
    import torch  # odvisnost dokazana v load_pipeline

    generator = torch.Generator(device=settings.DEVICE).manual_seed(seed)
    with GpuWatcher() as watcher:
        sw = Stopwatch()
        result = PIPELINE(
            image=images,
            prompt=prompt,
            negative_prompt=negative,
            true_cfg_scale=cfg,
            num_inference_steps=steps,
            width=width,
            height=height,
            generator=generator,
        )
        gen_s = sw.elapsed()

    img = result.images[0]
    # proračun meritev (§13/§14/§15) — vse DEJANSKO izmerjeno
    meta = {
        "generation_time_s": round(gen_s, 2),
        "vram_peak_mib": watcher.peak_mib,
        "vram_total_mib": vram_total_mib(),
        "ram_peak_mib": ram_peak_mib(),
        "gpu_name": gpu_name(),
        "seed": seed,
        "steps": steps,
        "true_cfg_scale": cfg,
        "negative_prompt": negative,
        "prompt": prompt,
        "width": width,
        "height": height,
        "model_load_s": round(LOAD_SECONDS or 0.0, 1),
        "determinism_note": "isti seed + isti vhodi = ponovljiv rezultat na istem stroju/hardveru (§18); "
        "sprememba hardvera/različic kernelov lahko da bitno drugačen izhod",
    }
    return img, meta
