#!/usr/bin/env python3
# r379-val59-apply.py — R379 MANDATORY STIL val 59: red/40 offset-2 PARITETA
# (14 × INS ' focus-visible:ring-offset-2' TIK ZA 'focus-visible:ring-roksal-red/40'
# — val 52 pairing kanon (navy) generaliziran na rdečo družino; val 43 RED_KANON
# 'ring-2 ring-roksal-red/40 ring-offset-2' = ciljni kanon; 11 že-pariranih
# rdečih vrstic = dokazana konvencija; amber/50 100% parirana).
#
# NAČELA (fail-closed, kanon r375-val57-apply.py / r377-val58-apply.py):
#   - tarče IZ DISKA vsak tek (odporne na vrstične številke — KOLIZIJA
#     re-apply kanon);
#   - NEGATIVE LOOKAHEAD: vrstice, ki ŽE nosijo offset-2, se izpustijo
#     (idempotenca — drugi tek = 0 sprememb);
#   - POST preverba: natanko pričakovano število vstavljanj, 0 novih vrstic
#     (in-place), per-datoteka števec GLASNO;
#   - abrt PRED zapisom ob vsakem nesoglasju (zero-damage).
# Uporaba: python3 scripts/r379-val59-apply.py [scan]
import re, sys, pathlib

TOKEN = "focus-visible:ring-roksal-red/40"
INS = " focus-visible:ring-offset-2"
# 8 datotek iz disk censusa r379-census.sh (družina D); red/4xx (red-400/60
# sketch trio) izrecno IZVEN — druga družina (val 50, nedokazana potreba).
FILES = [
    "src/components/roksal/dashboard-tab.tsx",
    "src/components/roksal/floor-plan-tab.tsx",
    "src/components/roksal/inventory-tab.tsx",
    "src/components/roksal/quote-followup.tsx",
    "src/components/roksal/roksal-catalog.tsx",
    "src/components/roksal/sessions-dialog.tsx",
    "src/components/roksal/termini-card.tsx",
    "src/components/roksal/top-bar.tsx",
]
# token takoj za njim NE sme biti offset-2 (idempotenca) — in NE sme imeti
# že katerekoli oblike offseta (offset-1 je drug jezik; takih v družini ni,
# disk resnica censusa — če se pojavi, fail-closed, ker to ni napovedano)
PAT = re.compile(re.escape(TOKEN) + r"(?! focus-visible:ring-offset-2)(?! focus-visible:ring-offset-1)")

scan_only = len(sys.argv) > 1 and sys.argv[1] == "scan"

skupaj = 0
plan = []
for f in FILES:
    p = pathlib.Path(f)
    vir = p.read_text(encoding="utf-8")
    vrstice = vir.split("\n")
    najdene = []
    for i, l in enumerate(vrstice, 1):
        n = len(PAT.findall(l))
        if n:
            najdene.append((i, n))
    st = sum(n for _, n in najdene)
    skupaj += st
    if st:
        plan.append((f, najdene, st))
        print(f"{f}: {st} tarč na vrsticah {[i for i, _ in najdene]}")

print(f"SKUPAJ tarč: {skupaj} (pričakovano 14 po disk censusu)")
if skupaj != 14:
    sys.exit(f"FAILOVEDANO: disk resnica {skupaj} ≠ 14 — census ali vir spremenjen, pregledaj")

if scan_only:
    print("SCAN-only: nič ni spremenjeno.")
    sys.exit(0)

# Apply + POST preverba
for f, najdene, st in plan:
    p = pathlib.Path(f)
    vir = p.read_text(encoding="utf-8")
    vrstice_pre = len(vir.split("\n"))
    nov, n = PAT.subn(TOKEN + INS, vir)
    if n != st:
        sys.exit(f"FAILOVEDANO: {f} subn {n} ≠ plan {st} — abort PRED zapisom")
    vrstice_post = len(nov.split("\n"))
    if vrstice_pre != vrstice_post:
        sys.exit(f"FAILOVEDANO: {f} novo vrstic {vrstice_post - vrstice_pre} ≠ 0 — in-place kršen, abort")
    p.write_text(nov, encoding="utf-8")
    print(f"OK: {f} +{n} INS (in-place, vrstice {vrstice_post})")

# Idempotenca dokaz: drugi tek = 0
ostanek = 0
for f in FILES:
    vir = pathlib.Path(f).read_text(encoding="utf-8")
    ostanek += len(PAT.findall(vir))
print(f"IDEMPOTENCA: ostanek ne-pariranih po apply: {ostanek} (pričakovano 0)")
if ostanek != 0:
    sys.exit("FAILOVEDANO: ostanek ≠ 0")
print("=== val 59 apply ZAKLJUČEN: 14 × INS, in-place, idempotentno ===")
