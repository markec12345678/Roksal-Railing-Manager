#!/usr/bin/env python3
# r389-triaza.py — R389 sveža element-točna triaža za val 67 (hover-bg
# gladkost ZAKLJUČEK — handover kandidat 1 R388: hover:bg-roksal na
# nativnih elementih izven val 66 obsega: step-* čarovnik, mask-editor,
# viz-tab ostanki, product-* ostali, product-projects).
# Metoda = LEKCIJA R388 (1) kanon (r388-triaza5.py): pokritost na NIVOJU
# ODPIRALNEGA TAGA (per-vrstični census je lažno pozitiven — className na
# pokončinjeni vrstici + cva baza izven vrstica). Val 66 tarče (že
# popravljene, r388.tsv) so IZKLJUČENE iz kandidatov.
# Izkrene izključitve (kanon R388): mrtvi hover žetoni (hover:bg == bg),
# pointer-events-none, transition-transform konflikt (NI aditivno rešljiv),
# mrtvi izvozi (brez .tsx potrošnika).
import pathlib, re, sys

REPO = pathlib.Path("/home/z/my-project")
SRC = REPO / "src"
KOMPLETI = list(SRC.rglob("*.tsx")) + list(SRC.rglob("*.ts"))

UI_KIT = {"Button", "Badge", "Card", "Input", "DropdownMenuItem", "Alert",
          "AlertDialogAction", "AlertDialogCancel", "Checkbox", "Switch",
          "Label", "Textarea", "SelectTrigger", "TabsTrigger", "Toggle",
          "DropdownMenuTrigger", "TooltipTrigger", "ToastAction"}

def najdi_tag(vrstice, hit_i):
    for j in range(hit_i, 0, -1):
        prej_vrst = vrstice[j - 1]
        if j < hit_i and (re.search(r"/>\s*$", prej_vrst) or re.search(r"</[A-Za-z][A-Za-z0-9]*>\s*$", prej_vrst)):
            return None
        m = re.search(r"<([A-Za-z][A-Za-z0-9]*)", prej_vrst)
        if m:
            ime = m.group(1)
            tekst = []
            for k in range(j - 1, min(len(vrstice), j + 11)):
                tekst.append(vrstice[k])
                t = "\n".join(tekst)
                if re.search(r"(?:^|[^=\-])>\s*$", vrstice[k]) or re.search(r"/>\s*$", vrstice[k]) or re.search(r">(?://)?\s*\}$", vrstice[k]):
                    break
            return ime, j, "\n".join(tekst)
    return None

POKRITOST = {"bg": {"all", "colors", "bg"}, "text": {"all", "colors", "text"}, "border": {"all", "colors", "border"}}

def pokritost(tekst, vrsta):
    pokrite = set()
    for m in re.finditer(r"transition-(all|colors|opacity|transform|shadow|none|\[[^\]]+\])", tekst):
        t = m.group(1)
        if t == "all" or t == "colors":
            pokrite |= {"bg", "text", "border"}
        elif t.startswith("["):
            for part in t.strip("[]").split(","):
                part = part.strip()
                if part == "background-color": pokrite.add("bg")
                elif part == "color": pokrite.add("text")
                elif part == "border-color": pokrite.add("border")
    return vrsta in pokrite

def hover_bg_iston(vrstica, hit):
    """Mrtvi žeton: hover:bg-X == bg-X na istem elementu (kanon R388)."""
    for m in re.finditer(r"(?<![:\w-])bg-([\w./\[\]-]+)", vrstica):
        if f"hover:bg-{m.group(1)}" in vrstica:
            return True
    return False

gaps = []
izkljuceni = {"mrtvi": 0, "pointer": 0, "transform": 0, "pokriti": 0, "ui_kit": 0, "val66": 0}
VAL66_ZIG = "transition-colors"
for f in KOMPLETI:
    if "__tests__" in str(f):
        continue
    vrstice = f.read_text(encoding="utf-8").splitlines()
    for i, v in enumerate(vrstice, 1):
        hm = re.search(r"hover:(bg|text|border)-roksal-", v)
        if not hm:
            continue
        vrsta = hm.group(1)
        tag = najdi_tag(vrstice, i)
        if tag is None:
            continue
        ime, tag_vrstica, tekst = tag
        if ime in UI_KIT or (ime[0].isupper() and "transition-all" in tekst):
            izkljuceni["ui_kit"] += 1
            continue
        if pokritost(tekst, vrsta):
            izkljuceni["pokriti"] += 1
            continue
        # val 66 tarče: vrstica ŽE nosi val 66 INS (transition-colors tik okoli
        # hover žetona) — vseeno bi pokritost ujela, ampak izrecno za gotovost:
        if vrsta == "bg" and re.search(r"transition-colors\s+hover:bg-roksal-|hover:bg-roksal-[\w/]+\s+transition-colors", v):
            izkljuceni["val66"] += 1
            continue
        if hover_bg_iston(v, hm.group(0)):
            izkljuceni["mrtvi"] += 1
            continue
        if "pointer-events-none" in v:
            izkljuceni["pointer"] += 1
            continue
        if "transition-transform" in tekst and "transition-colors" not in tekst:
            izkljuceni["transform"] += 1
            continue
        gaps.append((f, i, ime, tag_vrstica, vrsta, v.strip()[:160]))

print("=== R389 ELEMENT-TOČNA triaža (val 67 kandidati — hover-roksal NI pokrit) ===")
print(f"skupaj REALNIH gapov: {len(gaps)}")
print(f"izključeni: {izkljuceni}")
for f, i, ime, tv, vrsta, v in gaps:
    print(f"  {f.relative_to(REPO)}:{i}  <{ime}> tag@{tv}  hover:{vrsta}")
    print(f"      {v}")
sys.exit(0)
