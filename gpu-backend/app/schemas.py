"""Pydantic sheme — pogodba API-ja (spec §20) + odgovori."""
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


class Placement(BaseModel):
    """Geometrijski vir resnice — 4 vogali (TL, TR, BR, BL), normalizirano 0..1 (spec §11)."""

    corners: Optional[list[list[float]]] = None


class RenderRequest(BaseModel):
    """POST /render — spec §20 + minimalen dodatek `aPreview` (način finalize)."""

    projectId: str = Field(min_length=1, max_length=200)
    original: str = Field(min_length=32)  # base64 ali data URL
    product: str = Field(min_length=32)
    mask: Optional[str] = None
    # Dodatek glede na §20 (aditivno, dokumentirano): A-pipeline preview.
    # Če je podan → finalize (Qwen finalizira A; spec §7 "Q — Qwen finalization").
    aPreview: Optional[str] = None
    mode: Literal["finalize", "compose", "auto"] = "auto"
    placement: Optional[Placement] = None
    prompt: Optional[str] = None
    seed: int = 0  # 0 → naključen (vendar ZABELEŽEN v metadata; spec §18)
    resolution: Literal["preview", "final"] = "final"
    steps: Optional[int] = Field(default=None, ge=4, le=100)
    trueCfg: Optional[float] = Field(default=None, ge=1.0, le=10.0)

    @field_validator("seed")
    @classmethod
    def seed_range(cls, v: int) -> int:
        if v < 0 or v > 2_147_483_647:
            raise ValueError("seed mora biti v [0, 2^31-1]")
        return v


class RenderAccepted(BaseModel):
    jobId: str
    status: Literal["queued"] = "queued"


class JobStatus(BaseModel):
    jobId: str
    projectId: str
    status: Literal["queued", "processing", "completed", "failed"]
    createdAt: float
    startedAt: Optional[float] = None
    finishedAt: Optional[float] = None
    error: Optional[str] = None
    metrics: Optional[dict] = None


class JobFailed(BaseModel):
    jobId: str
    status: Literal["failed"] = "failed"
    error: str
