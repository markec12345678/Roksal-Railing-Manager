#!/usr/bin/env python3
# r391-triaza.py — R391 element-točna triaža press-scale dvojnega mehanizma
# (LEKCIJA R388 (1) kanon: per-vrstični census je lažno pozitiven — className
# lahko sega čez več vrstic; triaža PARSA elemente, ne vrstic).
#
# Resnica iz diska:
#   - .press-scale:active { transform: scale(.97) }  (globals.css @layer … →
#     zgrajeno: .press-scale:active{transform:scale(.97)})
#   - .active\:scale-\[0\.9X\]:active { scale: .9X }  (Tailwind v4 `scale`
#     LASTNOST — neodvisna od `transform`!)
#   - element z OBEIMA: :active → 0.97 (transform) × 0.9X (scale) =
#     MNOŽIČEN dvojni skrček (npr. 0.96 → 0.9312). REALen vizualen bug.
#
# Izhod: seznam elementov (datoteka, vrstica className začetka, žetoni)
# z OBEIMA mehanizma na istem elementu + kontekst transition-*.
import pathlib
import re
import sys

ROOT = pathlib.Path("/home/z/my-project/src/components/roksal")
# className span: className={` … `} ali className=" … " (ali {'…'} → redko)
RE_SPAN = re.compile(r"className=(\{`|`|\"|')", re.M)

def span_konec(text: str, po_odprtju: int, odprt: str) -> int:
    """Vrni indeks ZA zaključnim znakom spana (backtick ali narekovaj).

    po_odprtju = indeks PRVEGA znaka ZA odpiralnim delimiterjem (m.end())."""
    zakljuc = "`" if odprt in ("{`", "`") else odprt
    i = po_odprtju
    while i < len(text):
        if text[i] == "\\":
            i += 2
            continue
        if text[i] == zakljuc:
            return i + 1
        i += 1
    return len(text)

dual = []
press_only = 0
active_only = 0
for f in sorted(ROOT.glob("*.tsx")):
    text = f.read_text(encoding="utf-8")
    for m in RE_SPAN.finditer(text):
        end = span_konec(text, m.end(), m.group(1))
        span = text[m.start():end]
        vrstica = text.count("\n", 0, m.start()) + 1
        has_ps = "press-scale" in span
        has_as = re.search(r"active:scale-\[?([0-9.]+)\]?", span)
        if has_ps and has_as:
            # komentarji znotraj spana lahko omenjajo press-scale brez
            # className žetona — odstrani /* … */ komentarje pred oceno
            kodni_span = re.sub(r"/\*.*?\*/", "", span, flags=re.S)
            has_ps_koda = "press-scale" in re.sub(r'"[^"]*"', "", kodni_span) or \
                          bool(re.search(r'["\'`\s]press-scale["\'`\s]', kodni_span))
            if not has_ps_koda:
                continue
            trans = sorted(set(re.findall(r"transition-(?:all|colors|opacity|shadow|transform|\[[^\]]+\])", kodni_span)))
            dual.append((f.name, vrstica, has_as.group(1), trans, "press-scale" in kodni_span))
        elif has_ps:
            press_only += 1
        elif has_as:
            active_only += 1

print(f"dual (oba mehanizma na istem elementu): {len(dual)}")
print(f"press-scale only: {press_only}   active:scale only: {active_only}")
for name, vr, val, trans, ps in dual:
    print(f"  {name}:{vr}  active:scale-[{val}]  transition={trans}  pressScaleZeton={ps}")
if len(sys.argv) > 1 and sys.argv[1] == "--strict":
    if not dual:
        sys.exit("FAILOVEDANO: dual seznam prazen — pričakovano ≥8 (disk resnica)")
print("OK: r391-triaza.py")
