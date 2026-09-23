"""Job vrsta + delavec — zaporedna GPU obdelava, fail-safe (spec §21).

- In-memory trgovina + JSON persistenca metadata (OUTPUT_DIR/<jobId>/metadata.json)
- Statusni stroj: queued → processing → completed | failed (brez drugih prehodov)
- Napaka modela NIKOLI ne ugasne servisa (worker loví vse izjeme)
"""
import json
import logging
import threading
import time
import uuid
from pathlib import Path
from typing import Optional

from . import settings

logger = logging.getLogger("gpu-backend.jobs")

_TERMINAL = {"completed", "failed"}


class Job:
    def __init__(self, job_id: str, project_id: str) -> None:
        self.job_id = job_id
        self.project_id = project_id
        self.status = "queued"
        self.created_at = time.time()
        self.started_at: Optional[float] = None
        self.finished_at: Optional[float] = None
        self.error: Optional[str] = None
        self.metrics: Optional[dict] = None
        self.request_payload: dict = {}

    def to_status(self) -> dict:
        return {
            "jobId": self.job_id,
            "projectId": self.project_id,
            "status": self.status,
            "createdAt": self.created_at,
            "startedAt": self.started_at,
            "finishedAt": self.finished_at,
            "error": self.error,
            "metrics": self.metrics,
        }


class JobStore:
    def __init__(self, output_dir: Path) -> None:
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self._jobs: dict[str, Job] = {}
        self._queue: list[str] = []
        self._lock = threading.Lock()
        self._wake = threading.Event()

    def create(self, project_id: str, payload: dict) -> Job:
        job = Job(uuid.uuid4().hex, project_id)
        job.request_payload = payload
        with self._lock:
            self._jobs[job.job_id] = job
            self._queue.append(job.job_id)
        self._persist(job)
        self._wake.set()
        return job

    def next_queued(self) -> Optional[Job]:
        with self._lock:
            while self._queue:
                job_id = self._queue.pop(0)
                job = self._jobs.get(job_id)
                if job and job.status == "queued":
                    return job
        return None

    def set_status(self, job: Job, status: str, error: Optional[str] = None) -> None:
        if job.status in _TERMINAL and status not in _TERMINAL:
            return  # ni prehodov iz terminalnega stanja nazaj
        job.status = status
        if status == "processing" and job.started_at is None:
            job.started_at = time.time()
        if status in _TERMINAL:
            job.finished_at = time.time()
        if error:
            job.error = error
        self._persist(job)

    def set_metrics(self, job: Job, metrics: dict) -> None:
        job.metrics = metrics
        self._persist(job)

    def get(self, job_id: str) -> Optional[Job]:
        return self._jobs.get(job_id)

    def queue_len(self) -> int:
        return len([j for j in self._queue if self._jobs[j].status == "queued"])

    def _persist(self, job: Job) -> None:
        d = self.output_dir / job.job_id
        d.mkdir(parents=True, exist_ok=True)
        status = job.to_status()
        metrics = status.pop("metrics", None) or {}
        data = {**status, **metrics}  # ploščano (§13: en zapis = ena vrstica poročila)
        data["request"] = {
            k: ("<b64>" if k in ("original", "product", "mask", "aPreview") else v)
            for k, v in job.request_payload.items()
            if not k.startswith("_")  # _pil_images itd. niso za JSON
        }
        try:
            (d / "metadata.json").write_text(json.dumps(data, indent=2, ensure_ascii=False))
        except Exception:
            logger.warning("persist ni uspela za %s", job.job_id)

    def purge_expired(self) -> int:
        """Izbriši zaključene jobe starejše od TTL (vrni število)."""
        cutoff = time.time() - settings.JOB_TTL_S
        removed = 0
        with self._lock:
            for job_id in list(self._jobs):
                job = self._jobs[job_id]
                if job.status in _TERMINAL and (job.finished_at or job.created_at) < cutoff:
                    self._jobs.pop(job_id, None)
                    removed += 1
        return removed


class Worker:
    """En delavec (GPU = zaporedna obdelava); počaka na wake signal."""

    def __init__(self, store: JobStore, runner) -> None:
        self.store = store
        self.runner = runner  # callable(job) -> None (izvede in nastavi status/metrics)
        self._thread = threading.Thread(target=self._loop, name="qwen-worker", daemon=True)
        self._stop = threading.Event()

    def start(self) -> None:
        self._thread.start()

    @property
    def alive(self) -> bool:
        return self._thread.is_alive()

    def stop(self, timeout: float = 5.0) -> None:
        self._stop.set()
        self.store._wake.set()
        # POČAKAJ izhod niti — sicer naslednji startup vidi umirajočega delavca
        # kot "alive" in ne ustvari novega (vrsta potem ostane brez delavca)
        if self._thread.is_alive():
            self._thread.join(timeout=timeout)

    def _loop(self) -> None:
        last_purge = time.time()
        while not self._stop.is_set():
            job = self.store.next_queued()
            if job is None:
                self.store._wake.wait(timeout=1.0)
                self.store._wake.clear()
                if time.time() - last_purge > 600:
                    self.store.purge_expired()
                    last_purge = time.time()
                continue
            try:
                self.store.set_status(job, "processing")
                self.runner(job)  # runner nastavi completed/failed
            except Exception as e:  # fail-safe §21: servis živi naprej
                logger.exception("job %s je padel", job.job_id)
                self.store.set_status(job, "failed", error=str(e)[:500])
