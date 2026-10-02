#!/usr/bin/env python3
# r372-token-triage.py — R372 val 55 PRED-triaža, GENERALIZACIJA
# r371-none-triage.py (LEKCIJA R364 (4): klasifikacija = KODA iz diska, ne
# oči) na POLJUBEN focus-visible:ring- žeton:
#   python3 r372-token-triage.py <žeton> [dodatni-žeton ...]
# Za vsako vrstico, ki nosi žeton (npr. roksal-red/40), poroča offset stanje
# (O2/O1/O0/NONE) + ELEMENT klasifikacijo z nazaj-hodom do 15 vrstic:
#   KIT   = shadcn <Button  (kit override — NAMERNA izjema #1, offset po dizajnu 0)
#   RAW   = surov <button  (resnični brand gumb — val kandidat)
#   INPUT = <Input/<input/<Textarea (iskalni vnosi — lastni fokus jezik, izven)
#   LINK  = <a /<Link
#   CMP   = sestavljene shadcn komponente (DropdownMenu/Command/Card/Popover/
#           Sheet/Tabs/Accordion/Dialog/Tooltip — lastni fokus jezik, izven)
#   DIV?  = <div/<span/<li/<td/<p/<Badge (ni gumb — ročna preverba)
# Tool NE spreminja datotek — samo disk resnica (fail-closed: brez žetona
# usage + exit 1).
import re, sys, pathlib
from collections import Counter

ROOT = pathlib.Path("/home/z/my-project/src/components")

CMP_PAT = re.compile(r"<(DropdownMenu|Command|Card|Popover|Sheet|Tabs|Accordion|Dialog|Tooltip|Select|Calendar|Combobox)\w*")
DIV_PAT = re.compile(r"<(div|span|li|td|p|Badge|h[1-6])(?![-\w])")

def klasificiraj(lines, i):
    """Nazaj-hod do 15 vrstic do prvega znanega elementa (LEKCIJA R364 (4)).
    (?![-\\w]) namesto [\\s>]: 'goli' tag na koncu vrstice (<button / <div)
    se MORA ujemati — 1. teek je 5 takih vrstic lažno označil DIV?/?."""
    for back in range(1, 16):
        j = i - back
        if j < 0:
            break
        prev = lines[j]
        if "<Button" in prev:
            return "KIT"
        if re.search(r"<button(?![-\w])", prev):
            return "RAW"
        if re.search(r"<(Input|input|Textarea|textarea)(?![-\w])", prev):
            return "INPUT"
        if re.search(r"<a(?![-\w])", prev) or "<Link" in prev:
            return "LINK"
        if CMP_PAT.search(prev):
            return "CMP"
        if DIV_PAT.search(prev):
            return "DIV?"
    return "?"

def main():
    if len(sys.argv) < 2:
        print("UPORABA: r372-token-triage.py <žeton> [dodatni-žeton ...]  (npr. roksal-red/40)")
        sys.exit(1)
    tokens = sys.argv[1:]
    for token in tokens:
        target = f"focus-visible:ring-{token}"
        rows = []
        for p in sorted(ROOT.rglob("*.tsx")):
            src = p.read_text(encoding="utf-8")
            lines = src.splitlines()
            for i, line in enumerate(lines):
                if target not in line:
                    continue
                if "focus-visible:ring-offset-2" in line:
                    stanje = "O2"
                elif "focus-visible:ring-offset-1" in line:
                    stanje = "O1"
                elif "focus-visible:ring-offset-0" in line:
                    stanje = "O0"
                else:
                    stanje = "NONE"
                elem = klasificiraj(lines, i) if stanje != "O2" else "-"
                rows.append((stanje, elem, str(p.relative_to(ROOT)), i + 1, line.strip()[:110]))
        print(f"=== žeton {token}: skupaj {len(rows)} vrstic ===")
        print("OFFSET stanja:", dict(Counter(r[0] for r in rows)))
        gap = [r for r in rows if r[0] != "O2"]
        print("GAP elementi:", dict(Counter(r[1] for r in gap)))
        print()
        for stanje, elem, f, ln, txt in rows:
            print(f"{stanje:<5} {elem:<5} {f}:{ln}  {txt}")
        print()

if __name__ == "__main__":
    main()
