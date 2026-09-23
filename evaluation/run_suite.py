#!/usr/bin/env python3
"""S+6 — zaganjalnik evalvacijske zbirke + generator poročila (spec §7/§13/§24).

Načini:
  --backend http://gpu:8000   → pošlji vse teste na LASTEN GPU backend (spec §20 pogodba)
  --import DIR                → uvozi zunaj pridobljene Q slike (npr. z Space UI
                                ali ročnimi runi): DIR/<test_id>/q_finalize.png
  --determinism               → (samo --backend) ponovi T1 z istim seedom (§18)

Za vsak test: ORIGINAL | A | QWEN primerjava + objektivne metrike (metrics.py)
+ metadata (§13: test_id, model, resolution, VRAM, čas, seed, settings, …).

Izhod: evaluation/output/results.json + evaluation/output/REPORT.md
       (tabela §24 + trakovi ORIGINAL|A|QWEN po testu)

Uporaba (na GPU stroju ali proti njemu):
  python3 evaluation/run_suite.py --backend http://10.0.0.5:8000
  python3 evaluation/run_suite.py --import evaluation/output/space-runs
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from metrics import evaluate_pair, load_mask, load_rgb  # noqa: E402

DATASET = HERE / "dataset"
OUTPUT = HERE / "output"

CANONICAL_PROMPT = (
    "Preserve the exact reference railing design, geometry, color and structure. "
    "Integrate it into the marked railing area while preserving the original "
    "architecture and surroundings."
)


def b64_image(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode()


def post_render(backend: str, test: dict, mode: str) -> dict:
    """POST /render (spec §20) → {jobId, status}."""
    tdir = DATASET / test["id"]
    body: dict = {
        "projectId": test["id"],
        "original": b64_image(tdir / "original.jpg"),
        "product": b64_image(DATASET / test["product"]),
        "mask": b64_image(tdir / "mask.png"),
        "placement": {"corners": test["corners"]},
        "prompt": test.get("prompt", CANONICAL_PROMPT),
        "seed": int(test["seed"]),
        "resolution": test.get("resolutionTarget", "final"),
        "mode": mode,
    }
    if mode == "finalize":
        body["aPreview"] = b64_image(tdir / "a_preview.jpg")
    req = urllib.request.Request(
        f"{backend.rstrip('/')}/render",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.loads(r.read())


def poll_job(backend: str, job_id: str, timeout_s: float = 900.0) -> dict:
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        with urllib.request.urlopen(f"{backend.rstrip('/')}/jobs/{job_id}", timeout=30) as r:
            st = json.loads(r.read())
        if st["status"] in ("completed", "failed"):
            return st
        time.sleep(2.0)
    raise TimeoutError(f"job {job_id} ni zaključen v {timeout_s}s")


def fetch_result_and_meta(backend: str, job_id: str, out_dir: Path, mode: str) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    png_path = out_dir / f"q_{mode}.png"
    with urllib.request.urlopen(f"{backend.rstrip('/')}/jobs/{job_id}/result", timeout=120) as r:
        png_path.write_bytes(r.read())
    Image.open(png_path).convert("RGB").save(out_dir / f"q_{mode}.jpg", "JPEG", quality=92)
    with urllib.request.urlopen(f"{backend.rstrip('/')}/jobs/{job_id}/metadata", timeout=30) as r:
        meta = json.loads(r.read())
    (out_dir / f"q_{mode}_meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False))
    return meta


def run_backend_mode(backend: str, tests: list[dict], modes: list[str], determinism: bool) -> list[dict]:
    results: list[dict] = []
    for test in tests:
        for mode in modes:
            print(f"[{test['id']}/{mode}] POST /render …")
            try:
                acc = post_render(backend, test, mode)
                job_id = acc["jobId"]
                st = poll_job(backend, job_id)
                if st["status"] == "failed":
                    results.append({"test_id": test["id"], "mode": mode, "status": "failed",
                                    "error": st.get("error")})
                    print(f"[{test['id']}/{mode}] FAILED: {st.get('error')}")
                    continue
                meta = fetch_result_and_meta(backend, job_id, OUTPUT / test["id"], mode)
                meta["test_id"] = test["id"]
                meta["mode"] = mode
                meta["status"] = "completed"
                results.append(meta)
                print(f"[{test['id']}/{mode}] completed — {meta.get('generation_time_s')} s "
                      f"(VRAM {meta.get('vram_peak_mib')} MiB)")
            except (urllib.error.URLError, TimeoutError, KeyError) as e:
                results.append({"test_id": test["id"], "mode": mode, "status": "failed",
                                "error": str(e)[:400]})
                print(f"[{test['id']}/{mode}] NAPAKA: {e}")

    if determinism and results:
        first = next((r for r in results if r.get("status") == "completed" and r.get("mode") == "finalize"), None)
        if first:
            import hashlib

            test = next(t for t in tests if t["id"] == first["test_id"])
            print(f"[determinizem §18] ponovitev {test['id']}/finalize (seed {test['seed']}) …")
            acc = post_render(backend, test, "finalize")
            st = poll_job(backend, acc["jobId"])
            if st["status"] == "completed":
                out_dir = OUTPUT / test["id"]
                with urllib.request.urlopen(f"{backend.rstrip('/')}/jobs/{acc['jobId']}/result", timeout=120) as r:
                    b2 = r.read()
                p1 = out_dir / "q_finalize.png"
                h1 = hashlib.sha256(p1.read_bytes()).hexdigest()
                h2 = hashlib.sha256(b2).hexdigest()
                (out_dir / "q_finalize_repeat.png").write_bytes(b2)
                results.append({"test_id": test["id"], "mode": "finalize-repeat", "status": "completed",
                                "determinism": {"sha_first": h1, "sha_repeat": h2, "identical": h1 == h2}})
                print(f"[determinizem §18] identična izhoda: {h1 == h2}")
    return results


def run_import_mode(import_dir: Path, tests: list[dict]) -> list[dict]:
    results: list[dict] = []
    for test in tests:
        tdir = import_dir / test["id"]
        for mode in ("finalize", "compose"):
            src = tdir / f"q_{mode}.png"
            if not src.exists():
                src = tdir / f"q_{mode}.jpg"
            if src.exists():
                out_dir = OUTPUT / test["id"]
                out_dir.mkdir(parents=True, exist_ok=True)
                (out_dir / f"q_{mode}.png").write_bytes(src.read_bytes())
                Image.open(src).convert("RGB").save(out_dir / f"q_{mode}.jpg", "JPEG", quality=92)
                side = tdir / f"q_{mode}_meta.json"
                meta = json.loads(side.read_text()) if side.exists() else {}
                meta.update({"test_id": test["id"], "mode": mode, "status": "completed",
                             "imported_from": str(src)})
                results.append(meta)
                print(f"[{test['id']}/{mode}] uvoženo: {src.name}")
    return results


def compute_metrics(tests: list[dict], results: list[dict]) -> list[dict]:
    """Objektivne metrike (§8–§13) za vsak uspel Q-rezultat."""
    rows: list[dict] = []
    for test in tests:
        tdir = DATASET / test["id"]
        a_img = load_rgb(tdir / "a_preview.jpg")
        orig = load_rgb(tdir / "original.jpg")
        mask = load_mask(tdir / "mask.png", (a_img.shape[1], a_img.shape[0]))
        for res in results:
            if res.get("test_id") != test["id"] or res.get("status") != "completed":
                continue
            if res.get("mode") not in ("finalize", "compose"):
                continue
            q_path = OUTPUT / test["id"] / f"q_{res['mode']}.jpg"
            if not q_path.exists():
                continue
            q_img = load_rgb(q_path)
            if q_img.shape[:2] != a_img.shape[:2]:
                # Qwen vrača svojo resolucijo — poravnaj na A za metrike (dokumentirano)
                q_img = np.asarray(
                    Image.fromarray(q_img).resize((a_img.shape[1], a_img.shape[0]), Image.LANCZOS),
                    dtype=np.uint8,
                )
                res["note_resolution_resized_for_metrics"] = True
            try:
                m = evaluate_pair(
                    a_img=a_img, q_img=q_img, original=orig, mask=mask,
                    quad=test["corners"], occlusion_region=test.get("occlusionRegion"),
                )
            except ValueError as e:
                res["metrics_error"] = str(e)
                continue
            res["metrics"] = m
            rows.append(res)
            print(f"[{test['id']}/{res['mode']}] bg={m['background_preservation_Q_vs_A']['mean_abs_diff']} "
                  f"ΔE={m['color_Q_vs_A']['deltaE_mean']} period={m['slat_period_A']}→{m['slat_period_Q']} "
                  f"corr={m['edge_profile_correlation']}")
    return rows


def side_by_side(test: dict, mode: str) -> Path | None:
    """ORIGINAL | A | QWEN trak (spec §7/§24 — ključni vizualni dokaz)."""
    tdir = DATASET / test["id"]
    q_path = OUTPUT / test["id"] / f"q_{mode}.jpg"
    if not q_path.exists():
        return None
    imgs = [
        Image.open(tdir / "original.jpg").convert("RGB"),
        Image.open(tdir / "a_preview.jpg").convert("RGB"),
        Image.open(q_path).convert("RGB"),
    ]
    H = 420
    resized = [im.resize((int(im.width * H / im.height), H), Image.LANCZOS) for im in imgs]
    W = sum(im.width for im in resized) + 20 * (len(resized) + 1)
    strip = Image.new("RGB", (W, H + 40), (245, 245, 245))
    x = 20
    for im in resized:
        strip.paste(im, (x, 30))
        x += im.width + 20
    out = OUTPUT / test["id"] / f"strip_{mode}.jpg"
    out.parent.mkdir(parents=True, exist_ok=True)
    strip.save(out, "JPEG", quality=88)
    return out


def verdict(row: dict) -> str:
    """Združena odločitev za eno vrstico (IDENTITETA pred lepotо — spec §8)."""
    m = row.get("metrics")
    if not m:
        return "N/A (brez metrik)"
    bg = m["background_preservation_Q_vs_A"]["frac_changed"] < 0.02
    color = m["color_Q_vs_A"]["deltaE_mean"] < 6.0
    per = (m.get("slat_period_rel_diff") is None) or (m["slat_period_rel_diff"] < 0.25)
    corr = m["edge_profile_correlation"] > 0.6
    if bg and color and per and corr:
        return "PASS kandidat (potrdi vizualno)"
    fails = []
    if not bg:
        fails.append("okolica spremenjena")
    if not color:
        fails.append("barvni odmik")
    if not per:
        fails.append("struktura letvic")
    if not corr:
        fails.append("geometrija")
    return "FAIL: " + ", ".join(fails)


def write_report(manifest: dict, results: list[dict]) -> Path:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "results.json").write_text(json.dumps(results, indent=2, ensure_ascii=False))
    is_mock = any(r.get("backend_mode") == "mock" or r.get("mock") is True for r in results)
    lines: list[str] = [
        "# S+6 — Qwen GPU Proof-of-Quality: REZULTATI",
        "",
    ]
    if is_mock:
        lines += [
            "> **⚠️ MOCK REHEARSAL** — izhodi iz determinističnega mock backend-a "
            "(`QWEN_MOCK=1`). To dokazuje pogodbo API-ja (§20), evalvacijsko cevovod "
            "in merilni instrument (§13) — NE kakovosti Qwen-Image-Edit-2509. "
            "Realni run: `run_suite.py --backend <GPU-URL>` (glej gpu-backend/README.md).",
            "",
        ]
    lines += [
        f"Generirano: {time.strftime('%Y-%m-%d %H:%M:%S')}",
        f"Prompt (§17, kanoničen): `{CANONICAL_PROMPT}`",
        "",
        "| Test | Način | Identiteta (perioda A→Q) | Geometrija (corr) | Barva (ΔE) | Okolica (frac) | Occlusion | Čas (s) | Sklep |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for test in manifest["tests"]:
        for mode in ("finalize", "compose"):
            row = next((r for r in results if r.get("test_id") == test["id"] and r.get("mode") == mode), None)
            if row is None:
                lines.append(f"| {test['id']} | {mode} | — PENDING GPU — | — | — | — | — | — | — |")
                continue
            if row.get("status") != "completed":
                lines.append(f"| {test['id']} | {mode} | FAILED: {row.get('error', '')[:60]} | | | | | | |")
                continue
            m = row.get("metrics", {})
            strip = side_by_side(test, mode)
            lines.append(
                f"| {test['id']} | {mode} "
                f"| {m.get('slat_period_A')}→{m.get('slat_period_Q')} "
                f"| {m.get('edge_profile_correlation')} "
                f"| {m.get('color_Q_vs_A', {}).get('deltaE_mean')} "
                f"| {m.get('background_preservation_Q_vs_A', {}).get('frac_changed')} "
                f"| {'izmerjeno' if test.get('occlusionRegion') else 'n/a'} "
                f"| {row.get('generation_time_s', '?')} "
                f"| {verdict(row)} |"
            )
            if strip:
                rel = Path("output") / strip.relative_to(OUTPUT)  # pot relativna na evaluation/
                lines.append(f"| | | | | | | | | ![trak ORIGINAL|A|QWEN]({rel}) |")
    lines += [
        "",
        "## Meritve po testu (§13)",
        "",
    ]
    for res in results:
        lines.append(f"### {res.get('test_id')} / {res.get('mode')}")
        lines.append("```json")
        lines.append(json.dumps(res, indent=2, ensure_ascii=False))
        lines.append("```")
        lines.append("")
    report = HERE / "REPORT.md"  # evaluation/REPORT.md; slike relativno na evaluation/
    report.write_text("\n".join(lines), encoding="utf-8")
    print(f"\nREPORT.md → {report}")
    print(f"results.json → {OUTPUT / 'results.json'}")
    return report


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--backend", help="URL lastnega GPU backend-a (spec §20)")
    ap.add_argument("--import", dest="import_dir", type=Path, help="uvoz zunanjih Q slik")
    ap.add_argument("--test", help="samo en test (id)")
    ap.add_argument("--modes", default="finalize,compose")
    ap.add_argument("--determinism", action="store_true", help="§18 ponovitev T1")
    args = ap.parse_args()
    if not args.backend and not args.import_dir:
        ap.error("podaj --backend ali --import")

    manifest = json.loads((DATASET / "manifest.json").read_text())
    tests = [t for t in manifest["tests"] if not args.test or t["id"] == args.test]
    modes = [m.strip() for m in args.modes.split(",")]

    OUTPUT.mkdir(parents=True, exist_ok=True)
    if args.backend:
        results = run_backend_mode(args.backend, tests, modes, args.determinism)
    else:
        results = run_import_mode(args.import_dir, tests)

    compute_metrics(tests, results)
    write_report(manifest, results)
    ok = sum(1 for r in results if r.get("status") == "completed")
    print(f"\n{ok}/{len(results)} rezultatov uspešno")
    return 0


if __name__ == "__main__":
    sys.exit(main())
