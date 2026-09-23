#!/usr/bin/env python3
"""Validacija MERILNEGA INSTRUMENTA (evaluation/metrics.py) — syntetske fiksature.

Pravilo (spec §13/§25): metrika, ki ne zazna vtaknjene napake, je brezvredna.
  1. identični slikо → vse razlike = 0 (mrtva točka ne sme laži)
  2. pokvarjena okolica → background_preservation MORa zaznati
  3. sintetične letvice (znano število) → letvice_count mora zadeti
  4. prebarvan produkt → color_lab_delta mora zaznati
  5. realna A-slika (S6-T1) → sanity: A-vs-original izven maske ≈ 0

Poženi: python3 evaluation/tests/test_metrics.py  (ali pytest evaluation/tests/)
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from metrics import (  # noqa: E402
    background_preservation,
    color_lab_delta,
    edge_profile_correlation,
    letvice_count,
    quad_polygon_mask,
    rectify,
    slat_period,
)

DATASET = HERE.parent / "dataset"
PASS: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, info: str = "") -> None:
    PASS.append((name, ok, info))
    print(f"{'PASS' if ok else 'FAIL'}: {name} {info}")


def _stripe_img(w=700, h=300, n=13, color=(40, 45, 50), bg=(200, 200, 200)) -> np.ndarray:
    """n horizontalnih letvic enakomerne debeline (syntetični produkt)."""
    img = np.zeros((h, w, 3), dtype=np.uint8)
    img[:] = bg
    band = h * 0.2
    step = (h - 2 * band) / n
    for i in range(n):
        y0 = int(band + i * step)
        img[y0 : y0 + max(2, int(step * 0.55))] = color
    return img


# ── 1: identični vhodi → nič razlik ────────────────────────────────────────
a = _stripe_img()
mask = np.zeros((300, 700), dtype=bool)
mask[60:240, 100:600] = True
res = background_preservation(a, a, mask)
check("identical → mean_abs_diff == 0", res["mean_abs_diff"] == 0.0, str(res))
check("identical → frac_changed == 0", res["frac_changed"] == 0.0)

# ── 2: pokvarjena okolica (izven regije) → zaznano ─────────────────────────
b = a.copy()
b[0:40, :] = 255  # zmaži nebo — 100 % IZVEN maske
res = background_preservation(a, b, mask)
check("corrupted outside → frac_changed > 0.1", res["frac_changed"] > 0.1, str(res["frac_changed"]))

# in obratno: pokvarjeno SAMO znotraj maske → izven ~ 0
c = a.copy()
c[80:200, 200:500] = (255, 0, 0)  # znotraj maske
res = background_preservation(a, c, mask)
check("corrupted inside → frac_changed ≈ 0", res["frac_changed"] < 0.005, str(res["frac_changed"]))

# ── 3: štetje letvic na sintetiki (znano = 13) ─────────────────────────────
n_est = letvice_count(_stripe_img(n=13))
check("stripes n=13 → count == 13", n_est == 13, f"got {n_est}")
n_est7 = letvice_count(_stripe_img(n=7, color=(10, 10, 10)))
check("stripes n=7 → count == 7", n_est7 == 7, f"got {n_est7}")

# perioda letvic (avtokorelacija) — sintetika in sprememba strukture
# (perioda meri razmik robov/letvic; pomembna je KONSISTENTNOST A-vs-Q in
#  zaznavanje spremembe strukture, ne absolutna semantika)
p13 = slat_period(_stripe_img(n=13))
p6 = slat_period(_stripe_img(n=6))
check("slat_period n=13 izrazit ∈ [4, 16]", p13 is not None and 4 <= p13 <= 16, f"got {p13}")
check("slat_period se podvoji pri n=6", p6 is not None and p13 is not None and p6 > p13 * 1.7, f"{p6} vs {p13}")

# ── 4: barvni odmik → zaznan ───────────────────────────────────────────────
ra = _stripe_img()
rq = _stripe_img(color=(40, 45, 50))  # enak
res = color_lab_delta(ra, rq)
check("same color → ΔE ≈ 0", res["deltaE_mean"] < 1.0, str(res["deltaE_mean"]))
rq2 = _stripe_img(color=(90, 110, 40))  # prebarvana "ograja" (zelena)
res = color_lab_delta(ra, rq2)
check("recolor → ΔE > 15", res["deltaE_mean"] > 15, str(res["deltaE_mean"]))

# ── 5: geometrijska korelacija ─────────────────────────────────────────────
corr_same = edge_profile_correlation(ra, rq)
check("same structure → corr ≈ 1", corr_same > 0.95, str(corr_same))
rq3 = _stripe_img(n=6)  # spremenjena struktura (6 širolečnih "letvic")
corr_diff = edge_profile_correlation(ra, rq3)
check("changed structure → corr padla", corr_diff < corr_same - 0.3, f"{corr_diff} vs {corr_same}")

# ── 6: rektifikacija realne slike (S6-T1) — quad se pravilno izreže ────────
t1 = DATASET / "S6-T1-ravna-antracit"
if (t1 / "a_preview.jpg").exists():
    import json

    man = json.loads((DATASET / "manifest.json").read_text())
    test = man["tests"][0]
    a_img = np.asarray(Image.open(t1 / "a_preview.jpg").convert("RGB"), dtype=np.uint8)
    orig = np.asarray(Image.open(t1 / "original.jpg").convert("RGB"), dtype=np.uint8)
    mask_img = np.asarray(Image.open(t1 / "mask.png").convert("L")) > 127
    region = quad_polygon_mask(test["corners"], a_img.shape[1], a_img.shape[0]) | mask_img
    res = background_preservation(orig, a_img, region)
    check(
        "REAL S6-T1: A-vs-original izven regije ≈ nespremenjen (p99 < 30)",
        res["p99_abs_diff"] < 30,
        str(res),
    )
    # rektificiran A-preview: perioda letvic mora biti izrazita in blizu
    # pričakovane (pas 300 px, 13 letvic → perioda ~ (300-2*rob)/13 ≈ 14–18)
    a_rect = rectify(a_img, test["corners"])
    pA = slat_period(a_rect)
    check("REAL S6-T1: slat_period(A) izrazit ∈ [8, 30]", pA is not None and 8 <= pA <= 30, f"got {pA}")
    # Q-vs-A instrument preveri run_suite (Q slike še ne obstajajo — GPU pending)

print()
ok = sum(1 for _, p, _ in PASS if p)
print(f"{ok}/{len(PASS)} instrument validacij PASS")
sys.exit(0 if ok == len(PASS) else 1)
