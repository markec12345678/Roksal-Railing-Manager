#!/usr/bin/env python3
# r368-census.py — R368 per-barvni census iz diska (LEKCIJA R364 (4)):
# za VSako 'focus-visible:ring-roksal-amber*' pojavitvijo poišči zapirajočo
# mejo className niza/template literala in poročaj, ali isti niz nosi
# focus-visible:ring-offset-2 / -1 / -0. Izhod: per-vrstica resnica + seštevki.
import re, sys, pathlib

ROOT = pathlib.Path("/home/z/my-project/src/components")
TOKEN = "focus-visible:ring-roksal-amber"

rows = []
for p in sorted(ROOT.rglob("*.tsx")):
    src = p.read_text(encoding="utf-8")
    lines = src.splitlines()
    for i, line in enumerate(lines, 1):
        for m in re.finditer(re.escape(TOKEN), line):
            # Poišči zapirajočo mejo className vrednosti: od mesta pojavitve
            # naprej prvi od: zapirajoči backtick (template), zapirajoči ' ali "
            # (closed string), ali konec JSX atributa ({). Skeniramo naprej po
            # (morebitni večvrstični) vsebini — do 3 vrstice naprej.
            start = m.end()
            window = line[start:]
            j = i  # 1-based indeks trenutne vrstice
            extra = 0
            while extra < 3 and not re.search(r"[`'\"]|\$\{|\{", window[:1] + window):
                j += 1
                if j > len(lines):
                    break
                window += "\n" + lines[j - 1]
                extra += 1
            # meja: prvi backtick/quote/${ after start — niz SE KONČA tam
            # (za template: začetek interpolacije pomeni, da statični segment
            # konča — offset v interpolaciji OBTEŽIMO posebej kot '?')
            endm = re.search(r"[`'\"]|\$\{", window)
            seg = window[: endm.start()] if endm else window
            has_o2 = "focus-visible:ring-offset-2" in seg or "focus-visible:ring-offset-2" in line[max(0, m.start() - 200):m.start()]
            has_o1 = "focus-visible:ring-offset-1" in seg
            has_o0 = "focus-visible:ring-offset-0" in seg
            inter = endm and endm.group() == "${"
            dark = f"dark:{TOKEN}" in line
            token_hit = line[m.start():m.start() + 60].split()[0] if " " in line[m.start():m.start() + 80] else line[m.start():m.start() + 60]
            rows.append((str(p.relative_to(ROOT)), i, token_hit[:70], "O2" if has_o2 else ("O1" if has_o1 else ("O0" if has_o0 else ("?INTERP" if inter else "NONE"))), "dark" if dark else ""))

print(f"{'file':<38} {'vr':>5}  {'žeton (60)':<62} {'offset':<8} dark")
for r in rows:
    print(f"{r[0]:<38} {r[1]:>5}  {r[2]:<62} {r[3]:<8} {r[4]}")

from collections import Counter
c = Counter(r[3] for r in rows)
print("\nSEŠTEVKA:", dict(c), "| SKUPAJ:", len(rows))
