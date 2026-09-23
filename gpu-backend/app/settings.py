"""Nastavitve (env) — gpu-backend.

Vse nastavitve pridejo iz okolja; nič ni hardkodirano (12-factor).
"""
import os
from pathlib import Path

# Model (spec §3) — Apache-2.0, multi-image editing
MODEL_ID = os.environ.get("QWEN_MODEL_ID", "Qwen/Qwen-Image-Edit-2509")

# Mock način: 1 = brez modela/GPU (determinističen PIL/numpy kompozit) —
# za testiranje pogodbe API-ja na CPU sandboxu (spec §19: loči probleme)
MOCK = os.environ.get("QWEN_MOCK", "0") == "1"

# Naprava za realni način
DEVICE = os.environ.get("QWEN_DEVICE", "cuda")

# cpu-offload (spec §4: NE takoj — najprej NEoptimiziran bf16 na GPU in
# izmerjen vrh VRAM; offload je izbrana optimizacija, če je treba)
CPU_OFFLOAD = os.environ.get("QWEN_CPU_OFFLOAD", "0") == "1"

# Kje se shranjujejo artefakti jobov (result.png + metadata.json)
OUTPUT_DIR = Path(os.environ.get("QWEN_OUTPUT_DIR", "/tmp/roksal-qwen-jobs"))

# Skupni kanoničen prompt (spec §17) — uporabljen, če request ne poda svojega
CANONICAL_PROMPT = (
    "Preserve the exact reference railing design, geometry, color and structure. "
    "Integrate it into the marked railing area while preserving the original "
    "architecture and surroundings."
)

# Privzete generacijske nastavitve (nastavitve uradnega dema; §13 jih zapiše)
DEFAULT_STEPS = int(os.environ.get("QWEN_STEPS", "40"))
DEFAULT_CFG = float(os.environ.get("QWEN_CFG", "4.0"))
DEFAULT_NEGATIVE = os.environ.get("QWEN_NEGATIVE", " ")

# Resolucija (spec §16): preview = kvota-prijazna, final = do 1408 dolgi rob
RESOLUTION_LONG_EDGE = {"preview": 896, "final": 1408}
MAX_PIXEL_BUDGET = 1_600_000  # ~1.6MP, območje uradnih primerov (1664×928)

# Varnostne meje vhodov (DoS zaščita)
MAX_IMAGE_PIXELS = 30_000_000  # ~30MP decode omejitev
MAX_B64_BYTES = 25_000_000  # ~25MB base64 na vnos

# Delovna velikost job vrste (GPU = zaporedna obdelava)
MAX_QUEUE = int(os.environ.get("QWEN_MAX_QUEUE", "32"))

# TTL zaključenih jobov (sekunde) — cleanup po obdelavi
JOB_TTL_S = int(os.environ.get("QWEN_JOB_TTL_S", str(6 * 3600)))
