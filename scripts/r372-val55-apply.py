#!/usr/bin/env python3
# r372-val55-apply.py — val 55 apply, fail-closed per vrstica (kanon
# r371-val54-apply.py): vsaka vrstica preverjena PRED vstavitvijo/substitucijo
# po (datoteka, št. vrstica, red/40 prisoten točno 1×, offset stanje
# pričakovano, žeton točno 1×). Operacije:
#   SUB ×2 (O1→O2, DOLŽINSKO NEVTRALNO 27→27): dashboard-tab L1987,
#     vodja-dashboard L2122 (precedent val 53 O1 rep);
#   INS ×6 (+27 znakov, ' focus-visible:ring-offset-2' TIK ZA red/40):
#     material-intelligence L1408, measurements L3351+L4032,
#     notification-center L703, photo-tab L717, sistem-zdravje L228.
# In-place (0 novih vrstic); aria/title/hex NIČ; abort na NAJMANJŠem odmiku.
import pathlib, sys

BASE = pathlib.Path("/home/z/my-project/src/components/roksal")
RED = "focus-visible:ring-roksal-red/40"
O2 = "focus-visible:ring-offset-2"
O1 = "focus-visible:ring-offset-1"

SUB = [  # (file, line, pričakovano stanje)
    ("dashboard-tab.tsx", 1987),
    ("vodja-dashboard.tsx", 2122),
]
INS = [
    ("material-intelligence-tab.tsx", 1408),
    ("measurements-tab.tsx", 3351),
    ("measurements-tab.tsx", 4032),
    ("notification-center.tsx", 703),
    ("photo-tab.tsx", 717),
    ("sistem-zdravje-card.tsx", 228),
]

def vrstica(f, ln):
    lines = (BASE / f).read_text(encoding="utf-8").split("\n")
    return lines, lines[ln - 1]

napake = []
# --- PRED-checks
for f, ln in SUB + INS:
    lines, v = vrstica(f, ln)
    if v.count(RED) != 1:
        napake.append(f"{f}:{ln}: red/40 = {v.count(RED)} (pričakovano 1)")
for f, ln in SUB:
    _, v = vrstica(f, ln)
    if v.count(O1) != 1:
        napake.append(f"{f}:{ln}: offset-1 = {v.count(O1)} (pričakovano 1)")
    if O2 in v:
        napake.append(f"{f}:{ln}: offset-2 že prisoten")
for f, ln in INS:
    _, v = vrstica(f, ln)
    if "ring-offset" in v:
        napake.append(f"{f}:{ln}: ring-offset že prisoten")
if napake:
    print("FAILOVEDANO (PRED):")
    for n in napake:
        print("  " + n)
    sys.exit(1)

# --- SUB ×2 (27→27, nevtralno)
for f, ln in SUB:
    lines, v = vrstica(f, ln)
    nova = v.replace(O1, O2)
    assert len(nova) == len(v), f"{f}:{ln}: dolžina spremenjena"
    lines[ln - 1] = nova
    (BASE / f).write_text("\n".join(lines), encoding="utf-8")
    print(f"SUB {f}:{ln} O1→O2 (27→27)")

# --- INS ×6 (+27, TIK ZA red/40)
for f, ln in INS:
    lines, v = vrstica(f, ln)
    idx = v.index(RED) + len(RED)
    nova = v[:idx] + " " + O2 + v[idx:]
    assert len(nova) == len(v) + 1 + len(O2), f"{f}:{ln}: dolžina"
    lines[ln - 1] = nova
    (BASE / f).write_text("\n".join(lines), encoding="utf-8")
    print(f"INS {f}:{ln} +{1 + len(O2)} znakov TIK ZA red/40")

# --- PO-checks
napake = []
for f, ln in SUB:
    _, v = vrstica(f, ln)
    if O1 in v or v.count(O2) != 1:
        napake.append(f"{f}:{ln}: PO stanje napačno (o1={v.count(O1)}, o2={v.count(O2)})")
for f, ln in INS:
    _, v = vrstica(f, ln)
    if v.count(O2) != 1 or v.index(O2) != v.index(RED) + len(RED) + 1:
        napake.append(f"{f}:{ln}: PO vstavitvena pozicija napačna")
if napake:
    print("FAILOVEDANO (PO):")
    for n in napake:
        print("  " + n)
    sys.exit(1)
print("OK: val 55 apliciran (2 SUB + 6 INS, in-place, 0 novih vrstic)")
