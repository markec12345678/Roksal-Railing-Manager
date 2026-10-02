#!/usr/bin/env python3
# r373-family-census.py — R373 FEATURE: ZDRUŽEN per-družinski census + triaža
# (4. korak generalizacijske verige: r369-census.py [per-družinski census]
#  → r371-none-triage.py [navy NONE triaža] → r372-token-triage.py [poljuben
#  žeton, element triaža] → TA orodje [poljuben seznam družin + census + triaža
#  v enem prehodu; 1. uporaba V ISTI rundi — kanon ne sme biti papir]).
#
# Semantika stanja = r369-census.py (O2/O1/O0/NONE/?INTERP; O0 IZVEN gap —
# izjema #2 top-bar je O0). Semantika elementa = r372-token-triage.py
# (nazaj-hod do 15 vrstic; LEKCIJA R372 (3): goli tag na koncu vrstice rabi
# (?![-\w]); LEKCIJA (4): komponentni prefiksi rabijo \w*).
#
# Uporaba: python3 scripts/r373-family-census.py <družina> [<družina> …] [--map]
#   družina = niz ZA 'focus-visible:ring-' (npr. 'roksal-navy/40', 'ring/50',
#   'white/60', 'white', 'roksal-green/40'). Meja: (?![/\w-]) za natančnost
#   ('white' NE ujame 'white/60'; 'ring/50' NE ujame 'ring/50X').
# Izhod: per-družina stanja + razredi + gap; --map doda per-vrstico drogovca.
# Fail-closed: 0 pojavitev družine → EXIT 1 (tipkarska napaka ni tih).
import re, pathlib, sys
from collections import Counter, defaultdict

ROOT = pathlib.Path("/home/z/my-project/src/components")
PREFIX = "focus-visible:ring-"

CMP_PAT = re.compile(r"<(DropdownMenu|Command|Card|Popover|Sheet|Tabs|Accordion|Dialog|Tooltip|Select|Calendar|Combobox)\w*")
DIV_PAT = re.compile(r"<(div|span|li|td|p|Badge|h[1-6])(?![-\w])")
meja = re.compile(r"(?![/\w-])")

def klasifikacija(lines, i):
    """Element razred: pregledaj vrstico i (0) + nazaj-hod do 15 vrstic."""
    for back in range(0, 16):
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
    args = [a for a in sys.argv[1:] if a != "--map"]
    show_map = "--map" in sys.argv[1:]
    if not args:
        sys.exit("UPORABA: r373-family-census.py <družina> [...] [--map]")
    for tok in args:
        if not re.fullmatch(r"[a-z0-9-]+(?:/\d+)?", tok):
            sys.exit(f"FAILOVEDANO: neveljavna družina: {tok}")
    datoteke = sorted(p for p in ROOT.rglob("*.tsx") if "__tests__" not in p.parts)
    if not datoteke:
        sys.exit("FAILOVEDANO: ni vhodnih datotek")

    per = defaultdict(lambda: {"stanja": Counter(), "razredi": Counter(), "vrstice": []})
    for p in datoteke:
        lines = p.read_text(encoding="utf-8").splitlines()
        rel = str(p.relative_to(ROOT))
        for i, line in enumerate(lines):
            for tok in args:
                pat = re.compile(re.escape(PREFIX + tok) + r"(?![/\w-])")
                m = pat.search(line)
                if not m:
                    continue
                start = m.end()
                window = line[start:]
                j, extra = i, 0
                while extra < 3 and j + 1 < len(lines) and not re.search(r"[`'\"]|\$\{", window):
                    j += 1
                    window += "\n" + lines[j]
                    extra += 1
                endm = re.search(r"[`'\"]|\$\{", window)
                seg = window[: endm.start()] if endm else window
                pre = line[max(0, m.start() - 200): m.start()]
                has_o2 = "focus-visible:ring-offset-2" in seg or "focus-visible:ring-offset-2" in pre
                has_o1 = "focus-visible:ring-offset-1" in seg or "focus-visible:ring-offset-1" in pre
                has_o0 = "focus-visible:ring-offset-0" in seg or "focus-visible:ring-offset-0" in pre
                inter = bool(endm and endm.group() == "${")
                stanje = "O2" if has_o2 else ("O1" if has_o1 else ("O0" if has_o0 else ("?INTERP" if inter else "NONE")))
                razred = klasifikacija(lines, i)
                per[tok]["stanja"][stanje] += 1
                per[tok]["razredi"][razred] += 1
                per[tok]["vrstice"].append((rel, i + 1, stanje, razred))

    skupaj_pojavitev = 0
    for tok in args:
        d = per[tok]
        n = sum(d["stanja"].values())
        skupaj_pojavitev += n
        gap = d["stanja"]["O1"] + d["stanja"]["NONE"] + d["stanja"]["?INTERP"]
        print(f"{tok:<22} skupaj={n:<3} stanja={dict(sorted(d['stanja'].items()))} razredi={dict(sorted(d['razredi'].items()))} gap(≠O2,≠O0)={gap}")
        if show_map:
            for rel, ln, stanje, razred in d["vrstice"]:
                print(f"    {rel:<38} vr={ln:<5} {stanje:<8} {razred}")
    if skupaj_pojavitev == 0:
        sys.exit("FAILOVEDANO: 0 pojavitev čez vse družine (tipkarska napaka?)")
    print(f"SKUPAJ pojavitev: {skupaj_pojavitev}")

if __name__ == "__main__":
    main()
