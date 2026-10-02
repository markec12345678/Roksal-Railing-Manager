#!/usr/bin/env python3
# r370-dedup-scan.py — ISKREN e2e-lib dedup 10. val kandidat skan: vse
# agent-browser eval bloke (JSON.stringify) iz zamrznjenih spot skript
# r365–r369 normalizirano (whitespace collapse) md5-iraj in poročaj
# ponovitve ≥2 (prag LEKCIJE R352 = ×3; proaktiven kanon pri ×2 =
# LEKCIJA R362 (3) precedens). Nič ne mutira — SAMO poroča.
import re, hashlib, pathlib

SCRIPTS = [
    "scripts/r365-qa-spot.sh",
    "scripts/r366-qa-spot.sh",
    "scripts/r367-qa-spot.sh",
    "scripts/r368-qa-spot.sh",
    "scripts/r369-qa-spot.sh",
]
blocks = []
for s in SCRIPTS:
    p = pathlib.Path("/home/z/my-project") / s
    if not p.exists():
        continue
    src = p.read_text(encoding="utf-8")
    for m in re.finditer(r'agent-browser eval "JSON\.stringify\(\{(.*?)\}\)"', src, re.S):
        body = m.group(1)
        norm = re.sub(r"\s+", "", body)
        # normalizacija imen polj IZPUŠČENA (byte-navzkostna semantika je
        # del resnice) — normalizira se SAMO whitespace
        h = hashlib.md5(norm.encode()).hexdigest()
        blocks.append((s, h, norm[:60], len(norm)))

from collections import defaultdict
by_h = defaultdict(list)
for s, h, head, n in blocks:
    by_h[h].append((s, head, n))

dups = {h: v for h, v in by_h.items() if len(v) >= 2}
print(f"skupaj eval blokov: {len(blocks)}, unikatnih (normalizirano): {len(by_h)}, ponovitev ≥2: {len(dups)}")
for h, v in sorted(dups.items(), key=lambda kv: -len(kv[1])):
    print(f"  ×{len(v)} md5={h[:12]} bajtov={v[0][2]} glava={v[0][1][:55]}")
    for s, head, n in v:
        print(f"      - {s}")
if not dups:
    print("ISKREN SKLEP: NI kandidata ob ×2/×3 → e2e-lib dedup 10. val = IZPUŠČEN (kanon R368: 'NI prag — iskreno izpustiti če ni ponovitve')")
