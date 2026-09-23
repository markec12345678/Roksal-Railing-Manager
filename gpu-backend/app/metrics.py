"""Meritve časa/VRAM (spec §14/§15) — realni način.

Vse meritve so DEJANSKE (izmerjene ob delu), ne ocene.
"""
import resource
import time
from typing import Any, Optional

try:  # torch je prisoten samo v realnem načinu
    import torch
except Exception:  # pragma: no cover — mock/CI brez torch
    torch = None  # type: ignore[assignment]


def ram_peak_mib() -> Optional[float]:
    """Dejanski vrh RSS procesa (Linux ru_maxrss je v KiB)."""
    try:
        return round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 1)
    except Exception:
        return None


class GpuWatcher:
    """Meri vrh VRAM med enim jobom (reset → meri → preberi)."""

    def __init__(self) -> None:
        self.enabled = torch is not None and torch.cuda.is_available()
        self.peak_mib: Optional[float] = None

    def __enter__(self) -> "GpuWatcher":
        if self.enabled:
            torch.cuda.reset_peak_memory_stats()
            torch.cuda.synchronize()
        return self

    def __exit__(self, *exc: Any) -> None:
        if self.enabled:
            torch.cuda.synchronize()
            self.peak_mib = round(torch.cuda.max_memory_allocated() / (1024 * 1024), 1)


def vram_total_mib() -> Optional[float]:
    if torch is not None and torch.cuda.is_available():
        free, total = torch.cuda.mem_get_info()
        return round(total / (1024 * 1024), 1)
    return None


def gpu_name() -> Optional[str]:
    if torch is not None and torch.cuda.is_available():
        return torch.cuda.get_device_name(0)
    return None


class Stopwatch:
    def __init__(self) -> None:
        self.t0 = time.perf_counter()

    def elapsed(self) -> float:
        return round(time.perf_counter() - self.t0, 3)
