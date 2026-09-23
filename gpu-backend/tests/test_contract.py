"""Testi pogodbe gpu-backend (spec §20) — mock način, brez GPU-ja.

Poženi: cd gpu-backend && QWEN_MOCK=1 .venv/bin/pytest tests/ -v
"""
import base64
import io
import json
import os
import time

import pytest
from fastapi.testclient import TestClient
from PIL import Image

os.environ.setdefault("QWEN_MOCK", "1")
os.environ.setdefault("QWEN_OUTPUT_DIR", "/tmp/roksal-qwen-test-jobs")

from app.main import app  # noqa: E402
from app import settings  # noqa: E402


def _b64_img(w=256, h=256, color=(120, 90, 60), fmt="JPEG") -> str:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color).save(buf, fmt)
    return base64.b64encode(buf.getvalue()).decode()


def _render_body(**over) -> dict:
    body = {
        "projectId": "S6-T1-ravna-antracit",
        "original": _b64_img(),
        "product": _b64_img(220, 320, (40, 45, 50)),
        "mode": "compose",
        "seed": 250901,
        "resolution": "preview",
    }
    body.update(over)
    return body


def _wait_terminal(client: TestClient, job_id: str, timeout_s: float = 20.0) -> dict:
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        r = client.get(f"/jobs/{job_id}")
        assert r.status_code == 200
        st = r.json()
        if st["status"] in ("completed", "failed"):
            return st
        time.sleep(0.1)
    raise AssertionError("job ni zaključen v času")


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "OUTPUT_DIR", tmp_path)
    # ponastavi store z novim output dir (enostavneje: nov JobStore)
    from app.jobs import JobStore
    from app.main import store as main_store

    main_store.output_dir = tmp_path
    main_store._jobs.clear()
    main_store._queue.clear()
    with TestClient(app) as c:
        yield c


def test_health_mock(client):
    r = client.get("/health")
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is True
    assert d["mode"] == "mock"
    assert d["device"] == "cpu"


def test_render_contract_accepts_and_queues(client):
    r = client.post("/render", json=_render_body())
    assert r.status_code == 202
    d = r.json()
    assert d["status"] == "queued"
    assert len(d["jobId"]) >= 8


def test_job_lifecycle_only_valid_statuses(client):
    r = client.post("/render", json=_render_body())
    job_id = r.json()["jobId"]
    seen = []
    t0 = time.time()
    while time.time() - t0 < 20:
        st = client.get(f"/jobs/{job_id}").json()["status"]
        if not seen or seen[-1] != st:
            seen.append(st)
        if st in ("completed", "failed"):
            break
        time.sleep(0.05)
    assert st == "completed"
    for s in seen:
        assert s in ("queued", "processing", "completed", "failed")


def test_result_is_png_with_requested_dims(client):
    # velik vhod → §16 profili: preview (dolgi rob 896) in final (dolgi rob 1408)
    body = _render_body(resolution="preview")
    body["original"] = _b64_img(1600, 800)
    r = client.post("/render", json=body)
    st = _wait_terminal(client, r.json()["jobId"])
    assert st["status"] == "completed"
    res = client.get(f"/jobs/{r.json()['jobId']}/result")
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"
    img = Image.open(io.BytesIO(res.content))
    assert img.format == "PNG"
    assert img.size == (896, 448)  # ohranjeno razmerje 2:1, dolgi rob 896, snap16

    body["resolution"] = "final"
    r = client.post("/render", json=body)
    st = _wait_terminal(client, r.json()["jobId"])
    img = Image.open(io.BytesIO(client.get(f"/jobs/{r.json()['jobId']}/result").content))
    assert img.size == (1408, 704)  # §16: final profil


def test_metadata_has_required_fields(client):
    r = client.post("/render", json=_render_body(prompt="Test prompt §17", seed=4242))
    job_id = r.json()["jobId"]
    _wait_terminal(client, job_id)
    md = client.get(f"/jobs/{job_id}/metadata").json()
    for k in ("model", "mode", "generation_time_s", "vram_peak_mib", "seed", "steps",
              "true_cfg_scale", "prompt", "width", "height", "device", "backend_mode"):
        assert k in md, f"manjka {k} (spec §13)"
    assert md["seed"] == 4242
    assert md["prompt"] == "Test prompt §17"
    # mock: VRAM polja iskreno null (nismo merili na GPU — ne lažemo)
    assert md["vram_peak_mib"] is None
    assert md["mock"] is True


def test_seed_determinism_same_seed_identical_output(client):
    r1 = client.post("/render", json=_render_body(seed=777))
    st1 = _wait_terminal(client, r1.json()["jobId"])
    r2 = client.post("/render", json=_render_body(seed=777))
    st2 = _wait_terminal(client, r2.json()["jobId"])
    assert st1["status"] == st2["status"] == "completed"
    b1 = client.get(f"/jobs/{r1.json()['jobId']}/result").content
    b2 = client.get(f"/jobs/{r2.json()['jobId']}/result").content
    assert b1 == b2  # §18: isti seed + isti vhodi = identičen izhod (mock)


def test_finalize_mode_requires_a_preview(client):
    r = client.post("/render", json=_render_body(mode="finalize"))
    assert r.status_code == 422


def test_finalize_mode_uses_a_preview(client):
    r = client.post("/render", json=_render_body(mode="finalize", aPreview=_b64_img(300, 200, (90, 90, 90))))
    st = _wait_terminal(client, r.json()["jobId"])
    assert st["status"] == "completed"
    md = client.get(f"/jobs/{r.json()['jobId']}/metadata").json()
    assert md["mode"] == "finalize"


def test_invalid_image_b64_job_fails_but_service_survives(client):
    body = _render_body()
    body["product"] = "to-ni-base64!!!"
    r = client.post("/render", json=body)
    assert r.status_code == 422  # zavrnjeno že pri vnosu
    # fail-safe: servis še vedno zdrav
    assert client.get("/health").json()["ok"] is True


def test_truncated_image_job_fails_gracefully(client):
    body = _render_body()
    # veljaven base64, a ne veljavna slika
    body["original"] = base64.b64encode(b"ne-slika").decode()
    r = client.post("/render", json=body)
    assert r.status_code == 422
    assert client.get("/health").json()["ok"] is True


def test_unknown_job_404(client):
    assert client.get("/jobs/neobstaja").status_code == 404
    assert client.get("/jobs/neobstaja/result").status_code == 404
    assert client.get("/jobs/neobstaja/metadata").status_code == 404


def test_data_url_input_accepted(client):
    raw = _b64_img()
    r = client.post("/render", json=_render_body(original=f"data:image/jpeg;base64,{raw}"))
    st = _wait_terminal(client, r.json()["jobId"])
    assert st["status"] == "completed"


def test_auto_mode_defaults_to_compose_without_a_preview(client):
    r = client.post("/render", json=_render_body(mode="auto"))
    st = _wait_terminal(client, r.json()["jobId"])
    md = client.get(f"/jobs/{r.json()['jobId']}/metadata").json()
    assert md["mode"] == "compose"


def test_canonical_prompt_default(client):
    from app.settings import CANONICAL_PROMPT

    r = client.post("/render", json=_render_body(prompt=None))
    st = _wait_terminal(client, r.json()["jobId"])
    md = client.get(f"/jobs/{r.json()['jobId']}/metadata").json()
    assert md["prompt"] == CANONICAL_PROMPT  # §17: kanoničen prompt shranjen z rezultatom


def test_random_seed_is_recorded(client):
    r = client.post("/render", json=_render_body(seed=0))
    st = _wait_terminal(client, r.json()["jobId"])
    md = client.get(f"/jobs/{r.json()['jobId']}/metadata").json()
    assert isinstance(md["seed"], int) and md["seed"] > 0  # §18: naključen seed se ZABELEŽI
