#!/usr/bin/env python3
# r369-census.py — R369 per-barvni census VSEH focus-visible:ring- družin iz
# diska (LEKCIJA R364 (4) — handover domneva ≠ disk resnica; kanon R368
# r368-census.py generaliziran): za VSako 'focus-visible:ring-<družina>'
# pojavitvijo poišči zapirajočo mejo className niza/template literala in
# poročaj, ali isti niz nosi focus-visible:ring-offset-2 / -1 / -0.
# Družina = token ZA 'focus-visible:ring-' (izključi ring-offset in čiste
# širine ring-1/2/4/8). Izhod: per-družina seštevke + per-vrstica drogovca.
import re, pathlib
from collections import Counter, defaultdict

ROOT = pathlib.Path("/home/z/my-project/src/components")
PREFIX = "focus-visible:ring-"
FAM = re.compile(r"focus-visible:ring-(?!offset-)(?!\d)([a-z0-9-]+(?:/\d+)?)")

rows = []
per_fam = defaultdict(Counter)

for p in sorted(ROOT.rglob("*.tsx")):
    src = p.read_text(encoding="utf-8")
    lines = src.splitlines()
    for i, line in enumerate(lines, 1):
        for m in FAM.finditer(line):
            fam = m.group(1)
            start = m.end()
            window = line[start:]
            j = i
            extra = 0
            while extra < 3 and not re.search(r"[`'\"]|\$\{|\{", window[:1] + window):
                j += 1
                if j > len(lines):
                    break
                window += "\n" + lines[j - 1]
                extra += 1
            endm = re.search(r"[`'\"]|\$\{", window)
            seg = window[: endm.start()] if endm else window
            pre = line[max(0, m.start() - 200) : m.start()]
            has_o2 = "focus-visible:ring-offset-2" in seg or "focus-visible:ring-offset-2" in pre
            has_o1 = "focus-visible:ring-offset-1" in seg or "focus-visible:ring-offset-1" in pre
            has_o0 = "focus-visible:ring-offset-0" in seg or "focus-visible:ring-offset-0" in pre
            inter = endm and endm.group() == "${"
            cls = "O2" if has_o2 else ("O1" if has_o1 else ("O0" if has_o0 else ("?INTERP" if inter else "NONE")))
            dark = "dark:" in line[max(0, m.start() - 6) : m.start()] or line.startswith("dark:")
            per_fam[fam][cls] += 1
            rows.append((fam, str(p.relative_to(ROOT)), i, cls, "dark" if dark else ""))

print("PER-DRUŽINA SEŠTEVKE (O2/O1/O0/NONE/?INTERP):")
for fam in sorted(per_fam, key=lambda f: -sum(per_fam[f].values())):
    c = per_fam[fam]
    total = sum(c.values())
    gap = c["O1"] + c["NONE"] + c["?INTERP"]
    print(f"  {fam:<28} skupaj={total:<3} {dict(c)}  gap(≠O2)={gap}")

print("\nDRUGAČNE OD O2 (per-vrstica):")
for fam, f, i, cls, dark in rows:
    if cls != "O2":
        print(f"  {fam:<26} {f:<38} vr={i:<5} {cls:<8} {dark}")
print("\nSKUPAJ pojavitev:", len(rows))
