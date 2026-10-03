#!/usr/bin/env python3
# r388-triaza5.py — R388 KONČNA element-točna triaža transition pokritosti.
# Za vsako vrstico s hover:(bg|text|border)-roksal-*:
#   1. najdi ELEMENT odpiralni tag (skeniraj nazaj do najbližje <Tag vrstice
#      brez />/</ vmes);
#   2. če je tag ui-kit (Button/Badge/Card/...) → cva baza nosi transition
#      (button.tsx transition-all, badge.tsx transition-[color,box-shadow])
#      → pokrito, izpuščeno;
#   3. če je tag NATIVNI (lowercase) → zberi VSA tekst taga (od < do >) in
#      preveri transition pokritost za hover vrsto (bg=background-color,
#      text=color, border=border-color);
#   4. hover vrsta NI pokrita → REALen gap (snap hover).
# Izhod = definitivni kandidatski seznam za val 66.
import pathlib, re, sys

REPO = pathlib.Path("/home/z/my-project")
SRC = REPO / "src"
KOMPLETI = list(SRC.rglob("*.tsx")) + list(SRC.rglob("*.ts"))

UI_KIT = {"Button", "Badge", "Card", "Input", "DropdownMenuItem", "Alert",
          "AlertDialogAction", "AlertDialogCancel", "Checkbox", "Switch",
          "Label", "Textarea", "SelectTrigger", "TabsTrigger", "Toggle",
          "DropdownMenuTrigger", "TooltipTrigger", "ToastAction"}

def najdi_tag(vrstice, hit_i):
    """Vrne (ime_taga, zacetek_vrstica, tekst_taga_do_including_close)."""
    for j in range(hit_i, 0, -1):
        prej_vrst = vrstice[j - 1]
        # Zaključek prejšnjega elementa → tag ne more biti višje
        if j < hit_i and (re.search(r"/>\s*$", prej_vrst) or re.search(r"</[A-Za-z][A-Za-z0-9]*>\s*$", prej_vrst)):
            return None
        m = re.search(r"<([A-Za-z][A-Za-z0-9]*)", prej_vrst)
        if m:
            ime = m.group(1)
            # zberi tekst taga od j do najdaljšega zaključka (do 12 vrstic)
            tekst = []
            for k in range(j - 1, min(len(vrstice), j + 11)):
                tekst.append(vrstice[k])
                t = "\n".join(tekst)
                # zaključek odpiralnega taga: > ki ni del => ali -> ali arrow
                if re.search(r"(?:^|[^=\-])>\s*$", vrstice[k]) or re.search(r"/>\s*$", vrstice[k]) or re.search(r">(?://)?\s*\}$", vrstice[k]):
                    break
            return ime, j, "\n".join(tekst)
    return None

POKRITOST = {
    "bg": {"all", "colors", "bg"},
    "text": {"all", "colors", "text"},
    "border": {"all", "colors", "border"},
}

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

gaps = []
ui_kit_skip = 0
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
            ui_kit_skip += 1
            continue
        if pokritost(tekst, vrsta):
            continue
        gaps.append((f, i, ime, tag_vrstica, vrsta, v.strip()[:150]))

print(f"=== ELEMENT-TOČNA triaža: hover-roksal NI pokrit s transition ===")
print(f"skupaj REALNIH gapov: {len(gaps)} (ui-kit/pokriti izpuščeni: {ui_kit_skip})")
for f, i, ime, tv, vrsta, v in gaps:
    print(f"  {f.name}:{i}  <{ime}> tag@{tv}  hover:{vrsta}")
    print(f"      {v}")
sys.exit(0)
