#!/usr/bin/env python3
# r369-ink-probe.py — R369 val 52 kandidat: ink+navy pariške vrstice —
# natančni konteksti ring žetonov (okno ±110 znakov okoli vsake pojavitve),
# da ocenimo deterministično operacijo (statik vs ?INTERP).
import re, pathlib

FILES = [
    "src/components/roksal/quick-actions-fab.tsx",
    "src/components/roksal/termini-card.tsx",
    "src/components/roksal/bottom-nav.tsx",
    "src/components/roksal/notification-center.tsx",
]
TOK = "focus-visible:ring-roksal-"

for f in FILES:
    p = pathlib.Path("/home/z/my-project") / f
    lines = p.read_text(encoding="utf-8").splitlines()
    for i, line in enumerate(lines, 1):
        if "focus-visible:ring-roksal-ink/40" not in line:
            continue
        print(f"=== {f}:{i} (dolžina {len(line)}) ===")
        for m in re.finditer(r"focus-visible:ring-roksal-(?:navy|ink)/40", line):
            s, e = max(0, m.start() - 110), min(len(line), m.end() + 110)
            seg = line[s:e].replace("\t", " ")
            print(f"  @{m.start()} …{seg}…")
        # poročaj o offset žetonih kjer koli v vrstici
        offs = re.findall(r"focus-visible:ring-offset-\d", line)
        print(f"  offset-žetoni v vrstici: {offs}")
