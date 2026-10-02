#!/usr/bin/env python3
# r368-register-write.py — R368 register scripts/qa-needles/r368.tsv
# (kanon: python write z \t — LEKCIJA R365; NF=3 validacija po zapisu).
# 4 need_static = val 51 NOVI className tokeni (amber OBLIKOVNA pariteta),
# vsi ×0 v HEAD pred rundo (fetch-first git grep -F na HEAD components —
# GLASNO potrjeno ×4 kandidatov); multiplicita v POJAVITVAH (grep -o,
# LEKCIJA R365 (2)): N1 ×1, N2 ×3, N3 ×2, N4 ×2.
# Izpuščena kandidata (iskreno dokumentirano, kanon r366/r367):
#  - inclinometer '…/50 focus-visible:ring-offset-2' — NI ×0 v HEAD (vodja
#    blok glave ×13 je prefix — r317 needle veriga že ŽIVO);
#  - step-corners 'transition-colors …' plain-amber variant ×1 — isti
#    čanek/družina kot N4, redundanten (isti vzorec kot r366 N1 izpuščeni);
#  - inventory offset-1→2 + dashboard 1946/vodja 2093 normalizacije — brez
#    NOVEGA statičnega žetona (oblikovni shift, pin shift kanon).
# must_miss: TODO-R368.
import pathlib

rows = [
    ("focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2 focus-visible:outline-none",
     "R368 val 51 photo L740 kategorija offset-2 med barvo in outline-none (x1; 0 v HEAD)",
     "need_static"),
    ("focus-visible:ring-roksal-amber/60 focus-visible:ring-offset-2",
     "R368 val 51 photo debelina/orodja + notification kartica offset-2 (x3 pojavitve; 0 v HEAD)",
     "need_static"),
    ("focus-visible:ring-roksal-amber/40 focus-visible:ring-offset-2 focus-visible:outline-none",
     "R368 val 51 measurements poglej-foto + cenovni label offset-2 (x2 pojavitve; 0 v HEAD)",
     "need_static"),
    ("outline-hidden focus-visible:ring-2 focus-visible:ring-roksal-amber focus-visible:ring-offset-2",
     "R368 val 51 viz before-after + viz-tab rocaji plain amber offset-2 (x2 pojavitve; 0 v HEAD)",
     "need_static"),
    ("TODO-R368",
     "must_miss: razvojni ostanki (nesme biti v produkcijskih cankih)",
     "must_miss"),
]
out = pathlib.Path("scripts/qa-needles/r368.tsv")
with out.open("w", encoding="utf-8") as f:
    f.write("# qa-needles/r368.tsv — REGISTER needlejev runde R368 (STIL val 51:\n")
    f.write("# ring OBLIKOVNA pariteta roksal-AMBER focus družine — per-barvni\n")
    f.write("# split kanon nadaljevanje (navy = val 43–49, red = val 50, amber =\n")
    f.write("# val 51): 31 žetonov / 30 površin čez 11 datotek zdaj VSE nosijo\n")
    f.write("# focus-visible:ring-offset-2 (razcep števca = 0; census iz diska\n")
    f.write("# scripts/r368-census.py — 14 že O2, 3 × offset-1→2, 13 × dodan).\n")
    f.write("# In-place = 0 novih vrstic (19250 skupaj — wc -l kanon); 0 novih hex\n")
    f.write("# (števci 12/1); aria/title ZAMRZNJENI (ring-only runda — val 44–50\n")
    f.write("# precedens). Stale pini PRED-scan → 25 pojavitev v 14 zamrznjenih\n")
    f.write("# skriptah shiftanih V ISTI RUNDI (inventory offset-1 pin ×14:\n")
    f.write("# r243–r255 build-needles + r244-prod-qa; notification izjema pin ×11:\n")
    f.write("# r245–r255 — žig [PIN SHIFT R368 val 51: …] v opisu).\n")
    f.write("# FEATURE e2e-lib dedup 8. val: eb_sonda_navy_stetje (3-poljni\n")
    f.write("# navy/40 števec byte-identičen ×3 v r366/r367 spotih — md5\n")
    f.write("# d1f0004c299648ab1ff88f06bdafc889; prag R352 izenačen; 1. uporaba v\n")
    f.write("# r368-qa-spot.sh V ISTI rundi; zamrznjeni NI mutirani — kanon\n")
    f.write("# R361–R367).\n")
    f.write("# Era preverba: kanonski skript r368-era-harvest.sh (21 registrov\n")
    f.write("# r347–r367, ≥89 need_static) — EXIT=0 ob 1. teku; R367 val 50 vsi 4\n")
    f.write("# needleji ŽIVO (3 direktno + sketch prek hash rezolucije\n")
    f.write("# 1085983bcb110e2c.js) → val 50 deploy potrjen v celoti.\n")
    for needle, opis, vrsta in rows:
        f.write(f"{needle}\t{opis}\t{vrsta}\n")
print("zapisano:", out)

# Validacija NF=3 (LEKCIJA R366 (4): python, ne for/awk word-splitting)
bad = 0
for i, line in enumerate(out.read_text(encoding="utf-8").splitlines(), 1):
    if line.startswith("#") or not line.strip():
        continue
    if len(line.split("\t")) != 3:
        print(f"POKVARJENA vrstica {i}: NF={len(line.split(chr(9)))}")
        bad += 1
print("NF=3 validacija:", "ČISTO" if bad == 0 else f"{bad} pokvarjenih")
assert bad == 0
