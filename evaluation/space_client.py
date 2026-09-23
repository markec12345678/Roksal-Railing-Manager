#!/usr/bin/env python3
"""
S+6 — QWEN GPU PROOF-OF-QUALITY — official demo Space client (TEST INFRASTRUCTURE).

**Jasna označba (spec §2/§20):** ta odjemalec kliče JAVNI uradni Qwen demo Space
(https://huggingface.co/spaces/Qwen/Qwen-Image-Edit-2509, ZeroGPU A10G). To je
TESTNA INFRASTRUKTURA za dokazilo kakovosti — NI produkcijski servis in NI
lasten GPU backend (lasten backend = gpu-backend/, spec §1).

Klje modela: Qwen/Qwen-Image-Edit-2509 (Apache-2.0), multi-image editing.

Gradio API potek:
  1) POST /gradio_api/upload                     → server path(s)
  2) POST /gradio_api/call/infer  {data: [...]}  → event_id
  3) GET  /gradio_api/call/infer/<event_id>      → SSE: event complete + data [image, seed]

Determinizem (§17/§18): rewrite_prompt=False (kanoničen prompt ostane 1:1),
randomize_seed=False + fiksni seed iz manifest.json, true_guidance_scale=4.0,
num_inference_steps=40. Vse nastavitve + časi se zapišejo v metadata.

Uporaba:
  python3 evaluation/space_client.py --test S6-T1-ravna-antracit --mode finalize
  python3 evaluation/space_client.py --all            # vse teste iz manifest.json (oba načina)
  python3 evaluation/space_client.py --test S6-T1... --mode finalize --repeat-determinism
"""
import argparse
import io
import json
import sys
import time
from pathlib import Path

import httpx
from PIL import Image

SPACE_BASE = "https://qwen-qwen-image-edit-2509.hf.space"
API_UPLOAD = f"{SPACE_BASE}/gradio_api/upload"
API_CALL = f"{SPACE_BASE}/gradio_api/call/infer"

MODEL_ID = "Qwen/Qwen-Image-Edit-2509"
TRUE_CFG = 4.0
STEPS = 40
LONG_EDGE_CAP = 1024  # ZeroGPU kvota-prijazen (1MP rred)

HERE = Path(__file__).resolve().parent
DATASET = HERE / "dataset"
OUTPUT = HERE / "output"


def snap16(v: int) -> int:
    return max(16, int(round(v / 16)) * 16)


def target_dims(w: int, h: int) -> tuple[int, int]:
    """Ohrani razmerje stranic, dolgi rob ≤ LONG_EDGE_CAP, obe dimenzji deljivi s 16."""
    scale = min(1.0, LONG_EDGE_CAP / max(w, h))
    tw, th = snap16(int(w * scale)), snap16(int(h * scale))
    return tw, th


def load_image_b64_free(path: Path) -> bytes:
    return path.read_bytes()


def upload_file(client: httpx.Client, path: Path) -> str:
    with open(path, "rb") as fh:
        r = client.post(API_UPLOAD, files={"files": (path.name, fh, "application/octet-stream")}, timeout=120)
    r.raise_for_status()
    paths = r.json()
    if not paths:
        raise RuntimeError(f"upload vrnil prazno: {r.text[:200]}")
    return paths[0]


def call_infer(client: httpx.Client, data: list) -> tuple[bytes, float, float | None]:
    """Pošlji inferenco; vrni (png_bytes, stream_wall_s, seed_returned | None).

    SSE protokol: vrstice 'event: <type>' + 'data: <json>'.
    'complete' → data = [image_fileinfo, seed]; 'error' → data = opis napake.
    """
    r = client.post(API_CALL, json={"data": data}, timeout=120)
    r.raise_for_status()
    event_id = r.json().get("event_id")
    if not event_id:
        raise RuntimeError(f"manjka event_id: {r.text[:300]}")

    t0 = time.time()
    current_event = ""
    with client.stream("GET", f"{API_CALL}/{event_id}", timeout=httpx.Timeout(15.0, read=900.0)) as resp:
        resp.raise_for_status()
        for line in resp.iter_lines():
            if line.startswith("event:"):
                current_event = line.split(":", 1)[1].strip()
                continue
            if not line.startswith("data:"):
                continue
            payload = line[5:].strip()
            if current_event == "error":
                raise RuntimeError(f"Space napaka ({payload[:400]})")
            if current_event != "complete":
                continue  # heartbeat / generating progress
            try:
                result = json.loads(payload)
            except json.JSONDecodeError:
                continue
            if isinstance(result, list) and result and isinstance(result[0], dict):
                url = result[0].get("url") or (SPACE_BASE + "/gradio_api/file=" + str(result[0].get("path")))
                img_r = client.get(url, timeout=300)
                img_r.raise_for_status()
                seed_out = result[1] if len(result) > 1 else None
                return img_r.content, time.time() - t0, seed_out
            if isinstance(result, dict) and result.get("message"):
                raise RuntimeError(f"Space napaka: {str(result)[:400]}")
    raise RuntimeError(f"brez 'complete' eventa po {time.time() - t0:.0f}s (kvota/prekinek?)")


def filedata(server_path: str) -> dict:
    return {"path": server_path, "meta": {"_type": "gradio.FileData"}}


def run_test(test: dict, mode: str, out_dir: Path) -> dict:
    tdir = DATASET / test["id"]
    product = tdir.parent / test["product"]

    if mode == "finalize":
        images = [tdir / "a_preview.jpg", product]
    else:  # compose
        images = [tdir / "original.jpg", product]

    im = Image.open(images[0])
    tw, th = target_dims(im.width, im.height)
    prompt = test["prompt"]
    seed = int(test["seed"])

    meta_common = {
        "test_id": test["id"],
        "mode": mode,
        "model": MODEL_ID,
        "infra": "OFFICIAL QWEN DEMO SPACE (ZeroGPU A10G) — TEST INFRASTRUKTURA, ni produkcija (spec §2)",
        "space": SPACE_BASE,
        "prompt": prompt,
        "seed_requested": seed,
        "randomize_seed": False,
        "rewrite_prompt": False,
        "true_guidance_scale": TRUE_CFG,
        "num_inference_steps": STEPS,
        "resolution": {"width": tw, "height": th},
        "input_images": [p.name for p in images],
    }

    print(f"[{test['id']}/{mode}] upload {len(images)} slik …")
    t_start = time.time()
    with httpx.Client(follow_redirects=True) as client:
        # Gallery format: vsak vnos je [image, caption] — app.py bere item[0]
        handles = [[filedata(upload_file(client, p))] for p in images]
        data = [
            handles,
            prompt,
            seed,
            False,  # randomize_seed → determinizem §18
            TRUE_CFG,
            STEPS,
            th,
            tw,
            False,  # rewrite_prompt → kanoničen prompt §17
        ]
        print(f"[{test['id']}/{mode}] inferenca (steps={STEPS}, cfg={TRUE_CFG}, {tw}×{th}, seed={seed}) …")
        try:
            png_bytes, wall_s, seed_out = call_infer(client, data)
            if seed_out is not None:
                meta_common["seed_returned"] = seed_out
        except RuntimeError as e:
            msg = str(e)
            meta_common.update({"status": "failed", "error": msg, "queue_infer_wall_s": round(time.time() - t_start, 1)})
            out_dir.mkdir(parents=True, exist_ok=True)
            (out_dir / f"q_{mode}_error.json").write_text(json.dumps(meta_common, indent=2, ensure_ascii=False))
            print(f"[{test['id']}/{mode}] NAPAKA: {msg[:220]}")
            return meta_common

    out_dir.mkdir(parents=True, exist_ok=True)
    out_png = out_dir / f"q_{mode}.png"
    out_png.write_bytes(png_bytes)
    out_jpg = out_dir / f"q_{mode}.jpg"
    Image.open(io.BytesIO(png_bytes)).convert("RGB").save(out_jpg, "JPEG", quality=92)

    total_s = time.time() - t_start
    result_seed = None
    meta_common.update(
        {
            "status": "completed",
            "output": str(out_png.relative_to(HERE)),
            "output_jpg": str(out_jpg.relative_to(HERE)),
            "inference_wall_s": round(wall_s, 2),
            "total_wall_s": round(total_s, 2),
        }
    )
    (out_dir / f"q_{mode}_meta.json").write_text(json.dumps(meta_common, indent=2, ensure_ascii=False))
    print(f"[{test['id']}/{mode}] OK — {out_png.name} (inferenca {wall_s:.1f}s, skupaj {total_s:.1f}s)")
    return meta_common


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--test", help="test id iz manifest.json")
    ap.add_argument("--mode", choices=["finalize", "compose", "both"], default="both")
    ap.add_argument("--all", action="store_true", help="vse teste iz manifest.json")
    ap.add_argument("--repeat-determinism", action="store_true", help="test 1 še enkrat z istim seedom (§18)")
    args = ap.parse_args()

    manifest = json.loads((DATASET / "manifest.json").read_text())
    tests = manifest["tests"]
    if args.test:
        tests = [t for t in tests if t["id"] == args.test]
        if not tests:
            print(f"test {args.test} ni v manifestu", file=sys.stderr)
            return 2
    if not args.all and not args.test:
        ap.error("podaj --test ali --all")

    results = []
    for t in tests:
        modes = ["finalize", "compose"] if args.mode == "both" else [args.mode]
        for mode in modes:
            results.append(run_test(t, mode, OUTPUT / t["id"]))

    if args.repeat_determinism and results and results[0].get("status") == "completed":
        import hashlib

        t = tests[0]
        print(f"[determinizem §18] ponovitev {t['id']}/finalize z istim seedom {t['seed']} …")
        out_dir = OUTPUT / t["id"]
        p1 = out_dir / "q_finalize.png"
        h1 = hashlib.sha256(p1.read_bytes()).hexdigest()
        r2 = run_test(t, "finalize", out_dir)
        if r2.get("status") == "completed":
            # premakni nov izhod na _repeat, da ne prepiše prvega
            p2 = out_dir / "q_finalize_repeat.png"
            (out_dir / "q_finalize.png").rename(p2)
            (out_dir / "q_finalize.jpg").rename(out_dir / "q_finalize_repeat.jpg")
            h2 = hashlib.sha256(p2.read_bytes()).hexdigest()
            r2["output"] = str(p2.relative_to(HERE))
            r2["determinism"] = {"sha_first": h1, "sha_repeat": h2, "identical": h1 == h2}
            (out_dir / "q_finalize_repeat_meta.json").write_text(json.dumps(r2, indent=2, ensure_ascii=False))
            print(f"[determinizem §18] identična izhoda: {h1 == h2}")
        results.append(r2)

    (OUTPUT / "space_client_results.json").write_text(json.dumps(results, indent=2, ensure_ascii=False))
    ok = sum(1 for r in results if r.get("status") == "completed")
    print(f"\n{ok}/{len(results)} renderjev uspešno → evaluation/output/")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
