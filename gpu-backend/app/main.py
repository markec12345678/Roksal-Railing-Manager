"""Roksal GPU backend — FastAPI servis (spec §20 pogodba).

Arhitektura (spec §1):
    Vercel → POST /render → GPU inference server → Qwen-Image-Edit-2509 → result

Pogodba:
    POST /render               {projectId, original, product, mask?, aPreview?, mode?,
                                placement{corners?}, prompt?, seed, resolution,
                                steps?, trueCfg?}  → 202 {jobId, status:"queued"}
    GET  /jobs/{id}            → {jobId, status: queued|processing|completed|failed, …}
    GET  /jobs/{id}/result     → PNG (completed) | 404 (še ne) | 409 (failed)
    GET  /jobs/{id}/metadata   → polne meritve (§13/§14/§15/§17/§18)
    GET  /health               → {ok, mode, device, model_loaded, model_id, …}

Fail-safe (spec §21): napaka modela = job `failed`, servis ostane zdrav;
A-pipeline v aplikaciji ostane vedno na voljo (Qwen NIKOLI ni na poti do A-preview).
"""
import io
import json
import logging
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import JSONResponse

from . import inference, inference_mock, settings
from .jobs import Job, JobStore, Worker
from .metrics import Stopwatch
from .schemas import JobFailed, JobStatus, RenderAccepted, RenderRequest

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("gpu-backend")


def _torch_available() -> bool:
    try:
        import torch  # noqa: F401

        return True
    except Exception:
        return False


MODE = "mock" if (settings.MOCK or not _torch_available()) else "real"


app = FastAPI(
    title="Roksal Visualize GPU API",
    version="1.0.0",
    description="Qwen-Image-Edit-2509 finalization backend (S+6 proof-of-quality)",
)

store = JobStore(settings.OUTPUT_DIR)


def _decode(value: str, field: str):
    try:
        return inference_mock.decode_image(value)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"{field}: {e}") from e


def _run_job(job: Job) -> None:
    """Delavec: izvede en render (mock ali real) in nastavi končno stanje."""
    payload = job.request_payload
    mode = payload["mode"]
    prompt = payload["prompt"]
    seed = payload["seed"]
    steps = payload["steps"]
    cfg = payload["trueCfg"]

    sw = Stopwatch()
    try:
        if MODE == "real":
            inference.load_pipeline()
            pil_images = payload["_pil_images"]
            out, meta = inference.run_edit(
                images=pil_images,
                prompt=prompt,
                seed=seed,
                width=payload["_width"],
                height=payload["_height"],
                steps=steps,
                cfg=cfg,
                negative=settings.DEFAULT_NEGATIVE,
            )
        else:
            out, meta = inference_mock.run_mock_edit(
                images=payload["_pil_images"],
                mode=mode,
                seed=seed,
                width=payload["_width"],
                height=payload["_height"],
                corners=(payload.get("placement") or {}).get("corners"),
                steps=steps,
                cfg=cfg,
                prompt=prompt,
            )
        # artefakti
        d = settings.OUTPUT_DIR / job.job_id
        d.mkdir(parents=True, exist_ok=True)
        out.save(d / "result.png", "PNG")
        meta.update(
            {
                "model": settings.MODEL_ID if MODE == "real" else "mock-composite",
                "mode": mode,
                "resolution_label": payload["resolution"],
                "queue_wait_s": round((job.started_at or job.created_at) - job.created_at, 2),
                "total_job_s": round(sw.elapsed(), 2),
                "device": settings.DEVICE if MODE == "real" else "cpu",
                "backend_mode": MODE,
                "api_contract": "S+6 §20",
            }
        )
        store.set_metrics(job, meta)
        store.set_status(job, "completed")
        logger.info("job %s completed (%s, %.1f s)", job.job_id, mode, sw.elapsed())
    except Exception as e:  # fail-safe §21
        logger.exception("render ni uspel za job %s", job.job_id)
        store.set_status(job, "failed", error=f"{type(e).__name__}: {e}"[:500])


@app.on_event("startup")
def _startup() -> None:
    settings.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    w = getattr(app.state, "worker", None)
    # delavec mora ŽIVETI tudi po ponovnem startupu (npr. TestClient po shutdownu)
    if w is None or not w.alive:
        app.state.worker = Worker(store, _run_job)
        app.state.worker.start()
    logger.info("startup: mode=%s model=%s", MODE, settings.MODEL_ID if MODE == "real" else "mock")


@app.on_event("shutdown")
def _shutdown() -> None:
    w = getattr(app.state, "worker", None)
    if w:
        w.stop()


@app.get("/")
def root() -> dict:
    return {"service": "roksal-gpu-backend", "version": "1.0.0", "mode": MODE}


@app.get("/health")
def health() -> dict:
    """Zdravstveno stanje; v realnem načinu še model_id + VRAM (izmerjeno)."""
    out: dict = {
        "ok": True,
        "mode": MODE,
        "device": settings.DEVICE if MODE == "real" else "cpu",
        "model_loaded": (inference.PIPELINE is not None) if MODE == "real" else True,
        "model_id": settings.MODEL_ID if MODE == "real" else None,
        "queue_len": store.queue_len(),
    }
    if MODE == "real":
        try:
            from .metrics import gpu_name, vram_total_mib

            out["gpu_name"] = gpu_name()
            out["vram_total_mib"] = vram_total_mib()
        except Exception:
            pass
    return out


@app.post("/render", response_model=RenderAccepted, status_code=202)
def render(req: RenderRequest) -> dict:
    # velikost vrste (zaščita)
    if store.queue_len() >= settings.MAX_QUEUE:
        raise HTTPException(status_code=429, detail="vrsta je polna — poskusite kasneje")

    mode = req.mode
    if mode == "auto":
        mode = "finalize" if req.aPreview else "compose"

    # dekodiraj vhode (mock decoder je skupen — b64/data URL + varnostne meje)
    pil_images: list = []
    if mode == "finalize":
        if not req.aPreview:
            raise HTTPException(status_code=422, detail="finalize zahteva aPreview")
        base = _decode(req.aPreview, "aPreview")
        ref = _decode(req.product, "product")
        pil_images = [base, ref]
    else:
        base = _decode(req.original, "original")
        ref = _decode(req.product, "product")
        if req.mask:
            _decode(req.mask, "mask")  # validacija brez uporabe (record-only, §20)
        pil_images = [base, ref]

    width, height = inference_mock.target_dims(base.width, base.height, req.resolution)
    seed = req.seed or 0
    if seed == 0:
        import random

        seed = random.randint(1, 2_147_483_647)  # naključen, vendar ZABELEŽEN (§18)

    payload = {
        "projectId": req.projectId,
        "original": req.original,
        "product": req.product,
        "mask": req.mask,
        "aPreview": req.aPreview,
        "mode": mode,
        "placement": req.placement.model_dump() if req.placement else None,
        "prompt": req.prompt or settings.CANONICAL_PROMPT,
        "seed": seed,
        "resolution": req.resolution,
        "steps": req.steps or settings.DEFAULT_STEPS,
        "trueCfg": req.trueCfg if req.trueCfg is not None else settings.DEFAULT_CFG,
        "_pil_images": pil_images,
        "_width": width,
        "_height": height,
    }
    job = store.create(req.projectId, payload)
    logger.info("render queued: job=%s project=%s mode=%s %dx%d seed=%d",
                job.job_id, req.projectId, mode, width, height, seed)
    return {"jobId": job.job_id, "status": "queued"}


@app.get("/jobs/{job_id}", response_model=JobStatus)
def job_status(job_id: str) -> dict:
    job = store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="neznan jobId")
    return job.to_status()


@app.get("/jobs/{job_id}/result")
def job_result(job_id: str) -> Response:
    job = store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="neznan jobId")
    if job.status == "failed":
        return JSONResponse(
            status_code=409,
            content=JobFailed(jobId=job.job_id, error=job.error or "neznan error").model_dump(),
        )
    if job.status != "completed":
        raise HTTPException(status_code=404, detail=f"rezultat še ni pripravljen (status={job.status})")
    p = settings.OUTPUT_DIR / job.job_id / "result.png"
    if not p.exists():
        raise HTTPException(status_code=404, detail="rezultat manjka na disku")
    return Response(content=p.read_bytes(), media_type="image/png")


@app.get("/jobs/{job_id}/metadata")
def job_metadata(job_id: str) -> dict:
    """Polne meritve (§13) — PLOŠČANA struktura: status + meritve + request."""
    job = store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="neznan jobId")
    p = settings.OUTPUT_DIR / job.job_id / "metadata.json"
    if p.exists():
        return json.loads(p.read_text())
    # fallback: ploščaj iz pomnilnika
    out = job.to_status()
    metrics = out.pop("metrics", None) or {}
    out.update(metrics)
    return out
