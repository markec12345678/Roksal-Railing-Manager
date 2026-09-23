#!/usr/bin/env python3
"""S+6 — objektivne metrike kakovosti (spec §8–§13) — MERILNI INSTRUMENT.

Vse metrike so objektivne (izračunane iz slik), subjektivna ocena je DODATEK.
Instrument je validiran s syntetskimi fiksaturami (tests/test_metrics.py):
  - identični vhod → vse razlike = 0 (senzor mrtve točke ne sme laži)
  - pokvarjen izhod → metrike MORajo zaznati (sicer je instrument brezvreden)
  - sintetične letvice (znano število) → ocena štetja mora zadeti

Metrike:
  background_preservation(a, b, region)  — spremembe IZVEN regije ograje (§9)
  color_lab_delta(a, b, band)            — odmik barve v pasu ograje (§12, RAL)
  letvice_count(img, quad)               — ocena številа letvic (§8, identiteta)
  edge_profile_correlation(a, b, quad)   — geometrijska skladnost profilov (§11)
"""
from __future__ import annotations

import numpy as np
from PIL import Image


# ── osnovne pomožne funkcije ────────────────────────────────────────────────

def load_rgb(path: str) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.uint8)


def load_mask(path: str, size: tuple[int, int] | None = None) -> np.ndarray:
    """Bool maska (True = regija ograje), po potrebi spremenjena velikost."""
    m = Image.open(path).convert("L")
    if size:
        m = m.resize(size, Image.NEAREST)
    return np.asarray(m) > 127


def quad_polygon_mask(quad: list[list[float]], w: int, h: int) -> np.ndarray:
    """Rasterizacija kvadra (normalizirani vogali) → bool maska."""
    from PIL import ImageDraw

    pts = [(float(x) * w, float(y) * h) for x, y in quad]
    img = Image.new("L", (w, h), 0)
    ImageDraw.Draw(img).polygon(pts, fill=255)
    return np.asarray(img) > 127


def dilate(mask: np.ndarray, radius: int = 6) -> np.ndarray:
    """Hitra dilacija kvadratnim jedrom (brez scipy)."""
    if radius <= 0:
        return mask.copy()
    out = mask.copy()
    for _ in range(radius):
        out = out | np.roll(out, 1, 0) | np.roll(out, -1, 0) | np.roll(out, 1, 1) | np.roll(out, -1, 1)
    return out


def homography(src: np.ndarray, dst: np.ndarray) -> np.ndarray:
    """DLT homografija 3×3: src (4×2) → dst (4×2) (px)."""
    a = []
    for (x, y), (u, v) in zip(src, dst):
        a.append([x, y, 1, 0, 0, 0, -u * x, -u * y, -u])
        a.append([0, 0, 0, x, y, 1, -v * x, -v * y, -v])
    _, _, vt = np.linalg.svd(np.asarray(a, dtype=np.float64))
    return vt[-1].reshape(3, 3)


def rectify(img: np.ndarray, quad: list[list[float]], out_w: int = 700, out_h: int = 300) -> np.ndarray:
    """Preslikaj kvader (normalizirani vogali) v pravokotnik out_w×out_h (§8 rektifikacija)."""
    h, w = img.shape[:2]
    src = np.array([[x * w, y * h] for x, y in quad], dtype=np.float64)
    dst = np.array([[0, 0], [out_w, 0], [out_w, out_h], [0, out_h]], dtype=np.float64)
    inv = np.linalg.inv(homography(src, dst))
    yy, xx = np.mgrid[0:out_h, 0:out_w]
    ones = np.ones_like(xx, dtype=np.float64)
    pts = np.stack([xx, yy, ones], axis=0).reshape(3, -1)
    m = inv @ pts
    m /= m[2:3, :]
    sx = np.clip(m[0].reshape(out_h, out_w), 0, w - 1).astype(np.int32)
    sy = np.clip(m[1].reshape(out_h, out_w), 0, h - 1).astype(np.int32)
    return img[sy, sx]


# ── §9: ohranjenost okolice (izven maske ∪ kvadra) ──────────────────────────

def background_preservation(
    ref: np.ndarray, out: np.ndarray, region_mask: np.ndarray, *,
    dilate_px: int = 6, changed_threshold: int = 16,
) -> dict:
    """Spremembe IZVEN (maske ∪ kvader ∪ feather). ref=original, out=A ali Q.

    Vrne: mean_abs_diff, p99_abs_diff, frac_changed (>threshold/255 na RGB vsoti/3).
    A-vs-original je SANITY (pričakovano ~0); Q-vs-A je dejanski drift Qwen-a.
    """
    if ref.shape != out.shape:
        raise ValueError(f"različne mere: {ref.shape} vs {out.shape}")
    keep = ~dilate(region_mask, dilate_px)
    if keep.sum() < 100:
        raise ValueError("premalo točk izven regije za meritev")
    d = np.abs(ref.astype(np.int16) - out.astype(np.int16)).mean(axis=2)[keep]
    return {
        "pixels_outside": int(keep.sum()),
        "mean_abs_diff": round(float(d.mean()), 3),
        "p99_abs_diff": round(float(np.percentile(d, 99)), 2),
        "frac_changed": round(float((d > changed_threshold).mean()), 6),
    }


# ── §12: barva / RAL (LAB ΔE v pasu ograje) ────────────────────────────────

def _rgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    """sRGB → CIE LAB (D65). Vhod uint8 (H,W,3) → float (H,W,3) LAB."""
    rgb = rgb.astype(np.float64) / 255.0
    lin = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    m = np.array(
        [[0.4124564, 0.3575761, 0.1804375],
         [0.2126729, 0.7151522, 0.0721750],
         [0.0193339, 0.1191920, 0.9503041]]
    )
    xyz = lin @ m.T
    xyz /= np.array([0.95047, 1.0, 1.08883])
    eps, kap = 216 / 24389, 24389 / 27
    f = np.where(xyz > eps, np.cbrt(xyz), (kap * xyz + 16) / 116)
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], axis=-1)


def color_lab_delta(a_rect: np.ndarray, q_rect: np.ndarray, product_only: bool = True) -> dict:
    """ΔE (CIE76) med A-rect in Q-rect v pasu ograje (rektificirano 700×300).

    product_only: primerjaj samo temne piksle produkta (letvice) — za antracit;
    pri svetlih produktih podaj product_only=False (primerjava celega pasu).
    """
    if a_rect.shape != q_rect.shape:
        raise ValueError("rektificirani slici morata imeti isti size")
    la, lq = _rgb_to_lab(a_rect), _rgb_to_lab(q_rect)
    if product_only:
        sel = a_rect.mean(axis=2) < 115  # kot A-pipeline CUTOUT_GRAY_THRESHOLD
        if sel.sum() < 200:
            sel = np.ones(a_rect.shape[:2], dtype=bool)  # preklopi na cel pas
    else:
        sel = np.ones(a_rect.shape[:2], dtype=bool)
    de = np.sqrt(((la - lq) ** 2).sum(axis=2))[sel]
    return {
        "pixels_sampled": int(sel.sum()),
        "deltaE_mean": round(float(de.mean()), 2),
        "deltaE_p95": round(float(np.percentile(de, 95)), 2),
    }


# ── §8: identiteta — struktura letvic (rektificiran pas) ──────────────────

def slat_period(rect_gray: np.ndarray, min_lag: int = 4, max_lag: int = 80) -> int | None:
    """Dominantna perioda letvic v rektificiranem pasu (avtokorelacija profila).

    Robustno tudi pri temnem ozadju med letvicami (kjer štetje poteke odpove):
    primerjava period A vs Q zazna dodane/odvzete letvice (perioda se podvoji /
    prepolovi). Vrne None, če izrazite periodike ni.
    """
    g = rect_gray.astype(np.float64).mean(axis=2) if rect_gray.ndim == 3 else rect_gray.astype(np.float64)
    grad = np.abs(np.diff(g.mean(axis=1)))
    grad = grad - grad.mean()
    if grad.std() < 1e-6:
        return None
    ac = np.correlate(grad, grad, mode="full")[len(grad) - 1:]
    ac = ac / (ac[0] + 1e-9)
    hi = min(max_lag, len(ac) - 1)
    if hi <= min_lag:
        return None
    window = ac[min_lag:hi]
    peak = int(np.argmax(window)) + min_lag
    if ac[peak] < 0.15:
        return None  # plevelъ — brez izrazite periodike
    return peak


def letvice_count(rect_gray: np.ndarray, dark: bool = True) -> int:
    """Ocena številа letvic v rektificiranem pasu (štetje poteke vrstic).

    dark=True: temne letvice (antracit); dark=False: svetle letvice.
    DELUJE le pri kontrastu letvice↔vrzeli (svetlo ozadje); pri temnem ozadju
    za primerjavo Q-vs-A uporabi slat_period (avtokorelacija). OCENA
    (estimate) — zanesljiva identiteta ostaja A countLetvice na produktu
    (alpha kanal), dokazano = 13.
    """
    g = rect_gray.astype(np.float64).mean(axis=2) if rect_gray.ndim == 3 else rect_gray.astype(np.float64)
    row = g.mean(axis=1)
    row = np.convolve(row, np.ones(3) / 3, mode="same")  # glajenje 1px šuma
    lo, hi = np.percentile(row, 5), np.percentile(row, 95)
    if hi - lo < 8:
        return 0  # brez izrazite strukture
    thr = (lo + hi) / 2
    sel = row < thr if dark else row > thr
    edges = np.diff(np.concatenate([[0], sel.view(np.int8), [0]]))
    return int((edges == 1).sum())


# ── §11: geometrijska skladnost (korelacija profilov robov) ────────────────

def edge_profile_correlation(a_rect: np.ndarray, q_rect: np.ndarray) -> float:
    """Pearsonova korelacija vertikalnih-gradientnih profilov (A vs Q, rektificirano).

    1.0 = enaka geometrija letvic; ~0 = Qwen je spremenil strukturo.
    """
    ga = a_rect.astype(np.float64).mean(axis=2) if a_rect.ndim == 3 else a_rect.astype(np.float64)
    gq = q_rect.astype(np.float64).mean(axis=2) if q_rect.ndim == 3 else q_rect.astype(np.float64)
    pa = np.abs(np.diff(ga.mean(axis=1)))
    pq = np.abs(np.diff(gq.mean(axis=1)))
    if pa.std() == 0 or pq.std() == 0:
        return 0.0
    return round(float(np.corrcoef(pa, pq)[0, 1]), 4)


# ── združeni izračun za en test ─────────────────────────────────────────────

def evaluate_pair(
    *,
    a_img: np.ndarray,
    q_img: np.ndarray,
    original: np.ndarray | None,
    mask: np.ndarray | None,
    quad: list[list[float]],
    occlusion_region: list[list[float]] | None = None,
) -> dict:
    """Izračunaj vse metrike za (A → Q) na enem testu + sanity (original → A)."""
    h, w = a_img.shape[:2]
    quad_mask = quad_polygon_mask(quad, w, h)
    region = quad_mask | mask if mask is not None else quad_mask

    out: dict = {}
    if original is not None:
        out["sanity_A_vs_original"] = background_preservation(original, a_img, region)
    out["background_preservation_Q_vs_A"] = background_preservation(a_img, q_img, region)

    a_rect = rectify(a_img, quad)
    q_rect = rectify(q_img, quad)
    out["color_Q_vs_A"] = color_lab_delta(a_rect, q_rect)
    out["letvice_A_estimate"] = letvice_count(a_rect)
    out["letvice_Q_estimate"] = letvice_count(q_rect)
    p_a, p_q = slat_period(a_rect), slat_period(q_rect)
    out["slat_period_A"] = p_a
    out["slat_period_Q"] = p_q
    if p_a and p_q:
        out["slat_period_rel_diff"] = round(abs(p_a - p_q) / p_a, 3)
    else:
        out["slat_period_rel_diff"] = None
    out["edge_profile_correlation"] = edge_profile_correlation(a_rect, q_rect)

    if occlusion_region is not None:
        occ = quad_polygon_mask(occlusion_region, w, h)
        out["occlusion_region_preservation_Q_vs_A"] = background_preservation(
            a_img, q_img, occ, dilate_px=3
        )
    return out
