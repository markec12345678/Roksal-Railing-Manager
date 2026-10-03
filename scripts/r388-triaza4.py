#!/usr/bin/env python3
# r388-triaza4.py — R388 inverzni census: OZKA transition lastnost + hover
# barva, ki je NI pokrita (hover:bg na transition-transform ali
# transition-[border-color,...] — bg se ne prehaja glatko = REALEN vizualni
# polžek). Tudi celoten className izraz (template literal) mora biti
# preverjen — ne samo vrstica.
import pathlib, re, sys

REPO = pathlib.Path("/home/z/my-project")
SRC = REPO / "src"
KOMPLETI = list(SRC.rglob("*.tsx")) + list(SRC.rglob("*.ts"))

gaps = []
for f in KOMPLETI:
    if "__tests__" in str(f):
        continue
    vir = f.read_text(encoding="utf-8")
    vrstice = vir.splitlines()
    for i, v in enumerate(vrstice, 1):
        # hover barva na vrstici
        hm = re.search(r"hover:(bg|text|border)-roksal-", v)
        if not hm:
            continue
        vrsta = hm.group(1)  # bg | text | border
        # najdi celoten className izraz: skeniraj nazaj do className={/"
        # in naprej do zaključka (poenostavljeno: okno ±6 vrstic znotraj
        # istega template literal ali istega atributa)
        zacetek = i
        for j in range(i, max(0, i - 8) - 1, -1):
            if re.search(r'className=\{?["`]', vrstice[j - 1]) or re.search(r'className=\{', vrstice[j - 1]):
                zacetek = j
                break
            zacetek = j
        # okno: od zacetek do i+6 (ali dokler ni nov className)
        okno = "\n".join(vrstice[max(0, zacetek - 1):i + 6])
        # katere transition lastnosti pokriva okno?
        pokrite = set()
        for m in re.finditer(r"transition-(colors|all|opacity|transform|shadow|\[[^\]]+\])", okno):
            t = m.group(1)
            if t == "all":
                pokrite |= {"bg", "text", "border"}
            elif t == "colors":
                pokrite |= {"bg", "text", "border"}
            elif t.startswith("["):
                inner = t.strip("[]")
                for part in inner.split(","):
                    part = part.strip()
                    if part == "background-color":
                        pokrite.add("bg")
                    elif part == "color":
                        pokrite.add("text")
                    elif part == "border-color":
                        pokrite.add("border")
        if vrsta in pokrite:
            continue
        # ui-kit Button baza ima transition-all → <Button vrstice pokrite
        if re.search(r"<(Button|Badge)\b", v) or re.search(r"<(Button|Badge)\b", vrstice[max(0, zacetek - 1)]):
            continue
        gaps.append((f, i, vrsta, sorted(pokrite), v.strip()[:160]))

print(f"=== OZKA transition + hover-roksal NI pokrita — disk resnica ===")
print(f"skupaj: {len(gaps)}")
for f, i, vrsta, pokrite, v in gaps:
    print(f"  {f.name}:{i}  hover:{vrsta} — pokrito: {pokrite or 'NIC'}")
    print(f"      {v}")
sys.exit(0)
