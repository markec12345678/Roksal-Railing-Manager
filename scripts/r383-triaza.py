#!/usr/bin/env python3
# r383-triaza.py — R382 disk resnica triaža družine C/border-pariteta
# (val 61 kandidat, kanon R382 handover kandidat 1; LEKCIJA R381 (1):
# polna triaža PRED scopingom — repvidljivi podnizi ≠ disk resnica).
#
# VAL 57 PRECEDENS (R375, kanon): element z VIDLJIVIM border-om + focus
# ring nosi ' focus-visible:border-roksal-navy/40' TIK ZA
# 'focus-visible:ring-offset-2' — border se na keyboard focusu obarva
# ISTO kot ring (dvojna pariteta ring+border).
#
# TRIAŽA (deterministična, disk-only, brez mutacij):
#   vrstica z ring-2 + navy/40 BREZ 'focus-visible:border' → element
#   ima VIDLJIV border?
#     (a) eksplicitni border class na vrstici (token 'border' ali
#         'border-*'), ALI
#     (b) <Button variant="outline"> — border IZ BAZE (ui/button.tsx
#         outline variant 'border border-input');
#     elementi BREZ borderja = N/A (ni česa obarvati).
#   + tag klasifikacija (retrograde walk, kanon r381-triaza.py).
import pathlib
import re

REPO = pathlib.Path("/home/z/my-project")
ROKSAL = REPO / "src/components/roksal"
NAVY = "focus-visible:ring-roksal-navy/40"
RING2 = "focus-visible:ring-2"
O2 = "focus-visible:ring-offset-2"
TAG_PAT = re.compile(r"<([A-Za-z][A-Za-z0-9.]*)")
BORDER_PAT = re.compile(r"(?<![\w-])(border(?:-[a-zA-Z0-9./\[\]%-]+)?)(?![\w-])")


def klasificiraj(vrstice, idx):
    for j in range(idx, max(-1, idx - 40), -1):
        m = TAG_PAT.search(vrstice[j])
        if m:
            return m.group(1), vrstice[j]
    return "?", ""


def ima_border(vrstica):
    toks = BORDER_PAT.findall(vrstica)
    return any(t == "border" or (t.startswith("border-") and "focus-visible" not in t) for t in toks)


def main() -> None:
    datoteke = sorted(ROKSAL.glob("*.tsx"))
    tarce = []          # (file, line, tag, border_vir)
    na = 0              # ring brez borderja (N/A)
    per_dat = {}
    for f in datoteke:
        vrstice = f.read_text(encoding="utf-8").splitlines()
        for i, line in enumerate(vrstice):
            if RING2 not in line or NAVY not in line:
                continue
            if "focus-visible:border" in line:
                continue  # že-parirana (val 57 družina)
            tag, tagline = klasificiraj(vrstice, i)
            var_line = ima_border(line)
            var_variant = "outline" in tagline and tag == "Button"
            if not var_variant and tag == "Button":
                for j in range(i, max(-1, i - 6), -1):
                    if 'variant="outline"' in vrstice[j]:
                        var_variant = True
                        break
            if var_line or var_variant:
                vir = "border-class" if var_line else "outline-variant"
                tarce.append((f.name, i + 1, tag, vir))
                per_dat.setdefault(f.name, []).append((i + 1, tag, vir))
            else:
                na += 1
    print("=== R383 TRIAŽA družine C/border-pariteta (navy ring + ring-2, brez focus-visible:border) ===")
    for ime in sorted(per_dat):
        najdene = per_dat[ime]
        print(f"--- {ime}: TARČE={len(najdene)}")
        for ln, tag, vir in najdene:
            print(f"   L{ln}: <{tag}> ({vir})")
    print("=== REZIME ===")
    print(f"TARČE (z vidnim borderjem): {len(tarce)}")
    print(f"N/A (brez borderja): {na}")
    viri = {}
    for _, _, _, vir in tarce:
        viri[vir] = viri.get(vir, 0) + 1
    for k in sorted(viri):
        print(f"  {k}: {viri[k]}")


if __name__ == "__main__":
    main()
