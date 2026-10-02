#!/usr/bin/env python3
# r371-none-triage.py — R371 val 54 PRED-triaža: vse navy/40 'NONE' vrstice
# (census klasa — navy/40 focus žeton BREZ offseta v istem className nizu)
# klasificira po ELEMENIU: shadcn <Button> (kit override — namerna izjema
# #1 iz val 52, offset NAMERNO 0) vs surov <button>/<a>/<div> (resnični
# brand gap — val 54 kandidat). Metoda: od vrstice z žetonom hodim NAZAJ
# do 8 vrstic do prvega '<Button' / '<button' / '<a ' / '<Link' / '<div'.
# LEKCIJA R364 (4): klasifikacija = KODA iz diska, ne oči.
import re, pathlib

ROOT = pathlib.Path("/home/z/my-project/src/components")
FAM = re.compile(r"focus-visible:ring-(?!offset-)(?!\d)([a-z0-9-]+(?:/\d+)?)")
TARGET = "focus-visible:ring-roksal-navy/40"

rows = []
for p in sorted(ROOT.rglob("*.tsx")):
    src = p.read_text(encoding="utf-8")
    lines = src.splitlines()
    for i, line in enumerate(lines):
        if TARGET not in line:
            continue
        # samo navy/40 brez offseta na ISTI vrstici (poenostavitev census klase:
        # navy/40 je vedno enovrstični className — census je pokazal 0 večvrstičnih)
        if "ring-offset" in line:
            continue
        # element: hodim nazaj do 8 vrstic
        elem = "?"
        for back in range(1, 9):
            j = i - back
            if j < 0:
                break
            prev = lines[j]
            if "<Button" in prev:
                elem = "KIT"
                break
            if re.search(r"<button[\s>]", prev):
                elem = "RAW"
                break
            if "<a " in prev or "<Link" in prev:
                elem = "LINK"
                break
            if re.search(r"<(div|span|li|td)[\s>]", prev):
                elem = "DIV?"
                break
        rows.append((elem, str(p.relative_to(ROOT)), i + 1, line.strip()[:110]))

from collections import Counter
print("KLASIFIKACIJA:", dict(Counter(e for e, *_ in rows)))
print()
for elem, f, ln, txt in rows:
    print(f"{elem:<5} {f}:{ln}  {txt}")
