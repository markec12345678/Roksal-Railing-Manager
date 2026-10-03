#!/usr/bin/env python3
# r388-triaza2.py — R388 dopolnilna triaža: "mrtev-CSS navy" resnica.
# Definicija (iz R375 val 57 dokumentiranih izjem): navy focus ring vrstice
# z ring-2 + offset-2, ki NIMAJO border širine (border, border-N, border-x/
# y/t/b/l/r) → border-pariteta bi bla MRTVA CSS (barva brez širine ni
# vidna). Pričakovana statistika ~×20 (handover R387); disk resnica je
# avtoriteta. Ti tarči so ZAMRZENI kandidati — NE za val 66 (vizualni
# učinek = nič; LEKCIJA: statistika brez vizualnega učinka ne sme biti
# delana zaradi dela).
import pathlib, re, sys

REPO = pathlib.Path("/home/z/my-project")
SRC = REPO / "src"
KOMPLETI = list(SRC.rglob("*.tsx")) + list(SRC.rglob("*.ts"))

mrtev = []
for f in KOMPLETI:
    if "__tests__" in str(f):
        continue
    vrstice = f.read_text(encoding="utf-8").splitlines()
    for i, v in enumerate(vrstice, 1):
        if "focus-visible:ring-roksal-navy/40" in v and "focus-visible:ring-offset-2" in v:
            # border širina prisotna? (border-N, nativni 'border', ali
            # pogojni vejavec 'border ' / 'border-' kot token)
            tokeni = set(re.split(r"[\s`'\"${}()]+", v))
            ima_sirino = any(t == "border" or re.fullmatch(r"border-\d+", t) or re.fullmatch(r"border-(x|y|t|b|l|r)-\d+", t) for t in tokeni)
            ima_fbn = "focus-visible:border-roksal-navy/40" in v
            if not ima_sirino and not ima_fbn:
                mrtev.append((f, i, v.strip()[:150]))

print(f"=== MRTEV-CSS NAVY (ring+offset, BREZ border širine, brez FB) — disk resnica ===")
print(f"skupaj: {len(mrtev)}")
for f, i, v in mrtev:
    print(f"  {f.name}:{i}  {v}")
sys.exit(0)
