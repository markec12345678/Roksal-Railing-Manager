#!/usr/bin/env python3
# r371-val54-apply.py — R371 MANDATORY STIL val 54: ring OBLIKOVNA pariteta
# navy/40 NONE TRIAŽA — 13 SUROVIH brand gumbov (resnični gap) dobi
# ` focus-visible:ring-offset-2` TIK ZA navy/40 (per-barvni split kanon:
# navy = val 43–49 + val 52 pari + val 53 O1 rep, red = val 50, amber =
# val 51, navy NONE triaža = val 54). Disk resnica (scripts/r371-none-triage.py
# — element klasifikacija z nazaj-hodom do 15 vrstic):
#   navy NONE ×54 = KIT ×35 (shadcn <Button> + brand override — NAMERNA
#   izjema #1 iz val 52, offset po dizajnu 0) + RAW ×13 (val 54 tarče) +
#   INPUT ×2 (dashboard L1623 + roksal-catalog L95 — iskalni vnos, NE gumb;
#   own focus jezik — iskreno izven) + CMP ×5 (DropdownMenu/Command/Card
#   lastni fokus jezik — iskreno izven) + deal-pipeline L219 (drag handle
#   cn() — NE gumb — izven).
# BARVNI ŽIGI bajtno nespremenjeni (shape-only runda); in-place = 0 novih
# vrstic; 0 novih hex; aria/title ZAMRZNJENI. Stale-pini: PRED-skan ČIST —
# r370-window-scan.py delta +27 = 0 preozkih (65/65); r317 must_miss
# needle (hover:text+navy/40 sosledje brez ring-2) ostaja odsoten; r348
# steber toContain navy/40 preživi (vstavljanje ZA žetonom); r348/r346
# okna line/char-based vsebujejo anchorje — preživijo; r271/r272/r268
# handler pini nedotaknjeni. ZATO: 0 PIN SHIFTOV v tej rundi.
# Fail-closed: vsaka vrstica preverjena po (datoteka, št. vrstice, vsebuje
# navy/40, NE vsebuje ring-offset) PRED vstavitvijo; vsak fail = abort.
import pathlib, sys

TARGETS = [
    ("src/components/roksal/audit-trail-dialog.tsx", [249, 310]),
    ("src/components/roksal/calculator-tab.tsx", [860, 4439]),
    ("src/components/roksal/dashboard-tab.tsx", [1628, 1756]),
    ("src/components/roksal/inclinometer-tab.tsx", [341]),
    ("src/components/roksal/measurements/inline-inclinometer.tsx", [131]),
    ("src/components/roksal/measurements/inline-kotomer.tsx", [185]),
    ("src/components/roksal/measurements/steber-table.tsx", [69]),
    ("src/components/roksal/photo-tab.tsx", [2370]),
    ("src/components/roksal/punch-list.tsx", [531]),
    ("src/components/roksal/rate-limit-panel.tsx", [226]),
]
NAVY = "focus-visible:ring-roksal-navy/40"
INS = NAVY + " focus-visible:ring-offset-2"

total = 0
for path, lins in TARGETS:
    p = pathlib.Path(path)
    lines = p.read_text(encoding="utf-8").splitlines()
    for ln in lins:
        line = lines[ln - 1]
        if NAVY not in line:
            sys.exit(f"FAILOVEDANO: {path}:{ln} ne nosi navy/40 — abort")
        if "ring-offset" in line:
            sys.exit(f"FAILOVEDANO: {path}:{ln} že nosi ring-offset — abort (pričakovano NONE)")
        if line.count(NAVY) != 1:
            sys.exit(f"FAILOVEDANO: {path}:{ln} ima {line.count(NAVY)} navy/40 žetonov (pričakovano 1) — abort")
        lines[ln - 1] = line.replace(NAVY, INS, 1)
        total += 1
    p.write_text("\n".join(lines) + "\n", encoding="utf-8")

# POST guard: nihče od tarč ne sme biti NONE + navy/40+ring-offset stalen števec
for path, lins in TARGETS:
    p = pathlib.Path(path)
    lines = p.read_text(encoding="utf-8").splitlines()
    for ln in lins:
        if "ring-offset-2" not in lines[ln - 1]:
            sys.exit(f"FAILOVEDANO POST: {path}:{ln} brez offset-2 — abort")

print(f"=== val 54: {total}/13 surovih brand vrstic nosi offset-2 (razcep = 0 na tarčah) ===")
