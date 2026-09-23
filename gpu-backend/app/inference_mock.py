"""Mock inference — determinističen CPU kompozit (brez modela/GPU).

NAMEN (spec §19: loči probleme — najprej API/pogodba, šele nato model):
- dokazati pogodbo POST /render → queued → processing → completed → result
- determinizem (§18): isti seed + isti vhodi = bajtno identičen izhod
- metrics vrneta realne čase, VRAM polja pa so null (iskreno označeno)

Mock NE posnema kakovosti Qwen-a — zato je v poročilu vselej označen kot MOCK.
Finalize: rahlo ostrina + determinističen senčni gradient v kvadru.
Compose: perspektivni warp produkta v kvader (DLT homografija, numpy).
"""
import io
import base64
import binascii
from typing import Optional

import numpy as np
from PIL import Image

from . import settings
from .metrics import Stopwatch


def decode_image(value: str) -> Image.Image:
    """base64 / data URL → PIL RGB; varnostne meje (settings)."""
    raw = value.strip()
    if raw.startswith("data:"):
        _, _, raw = raw.partition(",")
    if len(raw) > settings.MAX_B64_BYTES:
        raise ValueError("slika presega dovoljeno velikost")
    try:
        data = base64.b64decode(raw, validate=False)
    except (binascii.Error, ValueError) as e:
        raise ValueError(f"neveljaven base64: {e}") from e
    img = Image.open(io.BytesIO(data))
    if img.width * img.height > settings.MAX_IMAGE_PIXELS:
        raise ValueError("slika presega dovoljene mere")
    return img.convert("RGB")


def _snap16(v: int) -> int:
    return max(16, int(round(v / 16)) * 16)


def target_dims(w: int, h: int, resolution: str) -> tuple[int, int]:
    long_edge = settings.RESOLUTION_LONG_EDGE.get(resolution, 1408)
    scale = min(1.0, long_edge / max(w, h))
    tw, th = _snap16(int(w * scale)), _snap16(int(h * scale))
    while tw * th > settings.MAX_PIXEL_BUDGET:
        tw, th = _snap16(int(tw * 0.9)), _snap16(int(th * 0.9))
    return tw, th


def homography(src: np.ndarray, dst: np.ndarray) -> np.ndarray:
    """DLT homografija 3×3: src (4×2) → dst (4×2)."""
    a = []
    for (x, y), (u, v) in zip(src, dst):
        a.append([x, y, 1, 0, 0, 0, -u * x, -u * y, -u])
        a.append([0, 0, 0, x, y, 1, -v * x, -v * y, -v])
    a = np.asarray(a, dtype=np.float64)
    _, _, vt = np.linalg.svd(a)
    return vt[-1].reshape(3, 3)


def _deterministic_noise(h: int, w: int, seed: int, amp: float = 1.5) -> np.ndarray:
    rng = np.random.RandomState(seed & 0x7FFFFFFF)
    return (rng.rand(h, w, 1).astype(np.float32) * 2 - 1) * amp


def _quad_from_corners(corners: Optional[list[list[float]]], w: int, h: int) -> np.ndarray:
    if corners and len(corners) == 4:
        return np.array([[c[0] * w, c[1] * h] for c in corners], dtype=np.float64)
    # privzeti osrednji pas (samo mock fallback)
    return np.array(
        [[0.15 * w, 0.55 * h], [0.85 * w, 0.55 * h], [0.85 * w, 0.8 * h], [0.15 * w, 0.8 * h]],
        dtype=np.float64,
    )


def run_mock_edit(
    *,
    images: list[Image.Image],
    mode: str,
    seed: int,
    width: int,
    height: int,
    corners: Optional[list[list[float]]],
    steps: int,
    cfg: float,
    prompt: str,
) -> tuple[Image.Image, dict]:
    """Determinističen "edit" — mock kakovost, realna pogodba + realni časi."""
    sw = Stopwatch()

    if mode == "finalize":
        from PIL import ImageFilter

        base = images[0].resize((width, height), Image.LANCZOS)
        arr = np.asarray(base, dtype=np.float32)
        # 1) rahla ostrina (simulira "finalizacijo" robov)
        blur = np.asarray(base.filter(ImageFilter.GaussianBlur(1.2)), dtype=np.float32)
        arr = np.clip(arr + (arr - blur) * 0.45, 0, 255)
        # 2) senčni gradient v spodnji tretjini kvadra (simulira kontaktno senco)
        quad = _quad_from_corners(corners, width, height)
        y0 = int(max(0, quad[:, 1].min()))
        y1 = int(min(height - 1, quad[:, 1].max()))
        x0 = int(max(0, quad[:, 0].min()))
        x1 = int(min(width - 1, quad[:, 0].max()))
        if y1 > y0 and x1 > x0:
            band = (arr[y0:y1, x0:x1, :3] * 0.97).astype(np.float32)
            arr[y0:y1, x0:x1, :3] = band
        # 3) determinističen šum (seed povezan, §18)
        arr = np.clip(arr + _deterministic_noise(height, width, seed), 0, 255).astype(np.uint8)
        out = Image.fromarray(arr, "RGB")
    else:  # compose: perspektivni warp produkta v kvader na originalu
        base = images[0].resize((width, height), Image.LANCZOS)
        product = images[1] if len(images) > 1 else images[0]
        pw, ph = product.size
        src = np.array([[0, 0], [pw, 0], [pw, ph], [0, ph]], dtype=np.float64)
        dst = _quad_from_corners(corners, width, height)
        hmat = homography(src, dst)
        parr = np.asarray(product, dtype=np.float32)
        # inverse map: za vsak piksel cilja poišči vir
        yy, xx = np.mgrid[0:height, 0:width]
        ones = np.ones_like(xx, dtype=np.float64)
        pts = np.stack([xx, yy, ones], axis=0).reshape(3, -1)
        inv = np.linalg.inv(hmat)
        mapped = inv @ pts
        mapped /= mapped[2:3, :]
        sx = np.clip(mapped[0].reshape(height, width), 0, pw - 1).astype(np.int32)
        sy = np.clip(mapped[1].reshape(height, width), 0, ph - 1).astype(np.int32)
        warped = parr[sy, sx]  # H×W×3
        # mehka maska kvadra (feather ~6 px, deterministično)
        from PIL import ImageDraw, ImageFilter

        poly = Image.new("L", (width, height), 0)
        ImageDraw.Draw(poly).polygon([tuple(p) for p in dst], fill=255)
        poly = poly.filter(ImageFilter.GaussianBlur(3))
        mask = (np.asarray(poly, dtype=np.float32) / 255.0)[..., None]
        barr = np.asarray(base, dtype=np.float32)
        arr = barr * (1 - mask) + warped * mask
        arr = np.clip(arr + _deterministic_noise(height, width, seed), 0, 255).astype(np.uint8)
        out = Image.fromarray(arr, "RGB")

    gen_s = sw.elapsed()
    meta = {
        "generation_time_s": round(gen_s, 2),
        "vram_peak_mib": None,
        "vram_total_mib": None,
        "ram_peak_mib": None,
        "gpu_name": None,
        "seed": seed,
        "steps": steps,
        "true_cfg_scale": cfg,
        "negative_prompt": " ",
        "prompt": prompt,
        "width": width,
        "height": height,
        "model_load_s": 0.0,
        "mock": True,
        "mock_note": "MOCK izhod — dokazuje pogodbo API-ja in determinizem, NE kakovosti Qwen-a (spec §19)",
        "determinism_note": "mock: isti seed + isti vhodi = bajtno identičen izhod",
    }
    return out, meta
