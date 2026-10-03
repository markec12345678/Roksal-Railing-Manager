#!/usr/bin/env python3
# r388-triaza.py — R388 sveža triaža (disk resnica — LEKCIJA R382 (1)):
#   K1: plain amber ring ostanki (amber ring vrstice BREZ focus-visible —
#       "plain" = non-focus ring: ring-roksal-amber/N brez focus-visible:)
#   K2: mrtev-CSS navy statistika (navy focus-visible ring vrstice na
#       NE-fokusabilnih elementih — div/span/li bez interakcije)
#   K3: dark-only ring pari — notification L748 vzorec (light ring
#       intenziveta ≠ dark ring intenziveta) čez VSE družine (navy/red/
#       amber) za focus-visible:ring
# Izhod: vsaka kandidatska vrstica z datoteko, vrstico, utemeljitvijo.
# Fail-closed: izpis + EXIT 1 če triaža ne najde ničesar (obvezna disk
# resnica za val 66 odločitev).
import pathlib, re, sys

REPO = pathlib.Path("/home/z/my-project")
SRC = REPO / "src"
KOMPLETI = list(SRC.rglob("*.tsx")) + list(SRC.rglob("*.ts"))

navy_plain, navy_dead, dark_pairs = [], [], []

for f in KOMPLETI:
    if "__tests__" in str(f):
        continue
    try:
        vrstice = f.read_text(encoding="utf-8").splitlines()
    except Exception as e:
        print(f"NAPAKA branja {f}: {e}")
        sys.exit(1)
    for i, v in enumerate(vrstice, 1):
        # K1: plain amber ring (amber ring brez focus-visible prefixa)
        for m in re.finditer(r"(?<![:\w-])ring-roksal-amber/\d+", v):
            # izključi, če je to del focus-visible (prefiks v isti žetoni)
            okoli = v[max(0, m.start()-40):m.start()]
            if "focus-visible:" not in okoli and "dark:" not in okoli and "hover:" not in okoli and "group-hover" not in okoli:
                navy_plain.append((f, i, v.strip()[:160]))
                break
        # K2: navy focus ring na ne-fokusabilnem elementu (preprosta
        # hevristika: vrstica SE ZAČNE z elementom div/span/p/section/li)
        if "focus-visible:ring-roksal-navy" in v:
            isk = v.lstrip()
            if re.match(r"(div|span|p|section|li|ul|h\d)\s", isk) or isk.startswith(("<div", "<span", "<p ", "<section", "<li", "<ul")):
                navy_dead.append((f, i, v.strip()[:160]))
        # K3: dark-only ring pari — light in dark ring intenziveta NA ISTI
        # vrstici in različna
        lm = re.search(r"(?<!dark:)focus-visible:ring-roksal-(navy|red|amber)/(\d+)", v)
        dm = re.search(r"dark:focus-visible:ring-roksal-(navy|red|amber)/(\d+)", v)
        if lm and dm and (lm.group(1), lm.group(2)) != (dm.group(1), dm.group(2)):
            dark_pairs.append((f, i, (lm.group(1), lm.group(2)), (dm.group(1), dm.group(2)), v.strip()[:140]))

print("=== K1: PLAIN AMBER RING ostanki (brez focus-visible/hover) ===")
print(f"skupaj: {len(navy_plain)}")
for f, i, v in navy_plain[:12]:
    print(f"  {f.name}:{i}  {v}")
print()
print("=== K2: MRTEV-CSS NAVY (focus ring na ne-fokusabilnem elementu — hevristika) ===")
print(f"skupaj: {len(navy_dead)}")
for f, i, v in navy_dead[:25]:
    print(f"  {f.name}:{i}  {v}")
print()
print("=== K3: DARK-ONLY RING PARI (light ≠ dark intenziveta) ===")
print(f"skupaj: {len(dark_pairs)}")
for f, i, l, d, v in dark_pairs:
    print(f"  {f.name}:{i}  light {l[0]}/{l[1]} vs dark {d[0]}/{d[1]}")
    print(f"      {v}")
sys.exit(0 if (navy_plain or navy_dead or dark_pairs) else 1)
