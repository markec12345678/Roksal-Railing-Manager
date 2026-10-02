#!/usr/bin/env python3
# r373-register-write.py — R373 register scripts/qa-needles/r373.tsv
# (kanon: python write z \t — LEKCIJA R365; NF=3 validacija po zapisu).
# 4 need_static = val 56 NOVI className tokeni (male družine RAW pariteta —
# white ×3 + white/60 ×4 v photo-tab, roksal-green/40 ×1 v dashboard; INS
# offset-2 TIK ZA žetonom), vsi ×0 v HEAD pred rundo (fetch-first git grep -F
# na 777e84f components — GLASNO potrjeno); multiplicita v POJAVITVAH
# (grep -o, LEKCIJA R365 (2)): N1 ×1, N2 ×1, N3 ×1, N4 ×1.
# Izpuščeni kandidati (iskreno dokumentirano, kanon r366–r372):
#  - white/60 RAW orodjarna bratje ×2 (L2061/L2071 — enak niz kot L2048 brez
#    'font-medium' razločevalca... razločevalca NI v obeh; pokriti prek
#    vitest (A) guard — kanon 4 needleje/rundo);
#  - white RAW levo/desno puščici (L1129/L1137 — bratski nizi, pokriti prek
#    vitest (A) guard);
#  - ring/50 ×14 ui/* (shadcn kit fokus jezik), white/60 KIT ×4 (izjema #1),
#    top-bar white/60 ring-offset-0 ×3 (izjema #2), destructive/20+/40 ×4
#    (ui badge/button KIT), resizable ring O1 ×1 (ui KIT), navy ?INTERP ×1
#    (roksal-catalog L110 <Button — razrešeno v KIT) — DOKUMENTIRANE namerne
#    izjeme — ne tiho izpuščeno (LEKCIJA R366 (5)).
# must_miss: TODO-R373.
import pathlib, subprocess, sys

rows = [
    ("group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2",
     "R373 val 56 photo-tab L978 white RAW pika offset tik za zetonom (x1 pojavitev; 0 v HEAD)",
     "need_static"),
    ("hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2",
     "R373 val 56 photo-tab L1414 white/60 RAW zapri slikanje offset (x1 pojavitev; 0 v HEAD)",
     "need_static"),
    ("font-medium hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2",
     "R373 val 56 photo-tab L2048 white/60 RAW orodjarna shranjuj offset (x1 pojavitev; 0 v HEAD)",
     "need_static"),
    ("hover:text-roksal-green hover:bg-roksal-green/10 focus-visible:ring-2 focus-visible:ring-roksal-green/40 focus-visible:ring-offset-2 outline-none transition-colors",
     "R373 val 56 dashboard L1742 green RAW poklici stranko offset (x1 pojavitev; 0 v HEAD)",
     "need_static"),
    ("TODO-R373",
     "must_miss: razvojni ostanki (nesme biti v produkcijskih cankih)",
     "must_miss"),
]

HEAD = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
print(f"HEAD = {HEAD}")
if HEAD != "777e84f9443bf7ddbf3c9956888b2ffb438d8d19":
    # dopusti, da je HEAD kakšen kasnejši commit V lastni rundi — vendar
    # fetch-first preverba gre Vedno na zapisani R372 push 777e84f
    print("OPOZORILO: HEAD ≠ 777e84f (pričakovani R372 push) — preverba gre VSEENO na 777e84f")

# fetch-first + GLASNO preverba: vsak need_static ×0 v 777e84f components
BASE = "777e84f9443bf7ddbf3c9956888b2ffb438d8d19"
for needle, opis, vrsta in rows:
    if vrsta != "need_static":
        continue
    r = subprocess.run(
        ["git", "grep", "-F", "--", needle, BASE, "--", "src/components"],
        capture_output=True, text=True)
    if r.returncode == 0 and r.stdout.strip():
        sys.exit(f"FAILOVEDANO: needle ŽE v HEAD {BASE[:7]}: {needle[:70]} …")
    print(f"OK ×0 v 777e84f: {needle[:70]} …")

# multiplicita v POJAVITVAH (grep -o — LEKCIJA R365 (2)) na delovnem drevesu
for needle, opis, vrsta in rows:
    if vrsta != "need_static":
        continue
    r = subprocess.run(
        ["git", "grep", "-oF", needle, "--", "src/components"],
        capture_output=True, text=True)
    n = len(r.stdout.strip().splitlines()) if r.stdout.strip() else 0
    if n != 1:
        sys.exit(f"FAILOVEDANO: needle ×{n} ≠ ×1 v delovnem drevesu: {needle[:70]} …")
    print(f"OK ×1 v drevesu: {needle[:70]} …")

out = pathlib.Path("scripts/qa-needles/r373.tsv")
with out.open("w", encoding="utf-8") as f:
    f.write("# qa-needles/r373.tsv — REGISTER needlejev runde R373 (STIL val 56:\n")
    f.write("# ring OBLIKOVNA pariteta MALIH družin — per-barvni split kanon\n")
    f.write("# nadaljevanje (navy = val 43–49+52+53+54, red = 50+55, amber = 51,\n")
    f.write("# white + white/60 + roksal-green/40 = val 56): 8 × INS\n")
    f.write("# ' focus-visible:ring-offset-2' TIK ZA žetonom (photo-tab white RAW\n")
    f.write("# ×3 [L978/L1129/L1137] + white/60 RAW ×4 [L1414/L2048/L2061/L2071],\n")
    f.write("# dashboard roksal-green/40 RAW ×1 [L1742 'Pokliči stranko']) —\n")
    f.write("# precedent val 54/55 INS (+28 znakov, in-place 0 novih vrstic).\n")
    f.write("# Orodje: NOVI r373-family-census.py (4. korak generalizacije:\n")
    f.write("# r369-census → r371-none-triage → r372-token-triage → TA —\n")
    f.write("# poljuben seznam družin + census + element triaža v eni prehoju;\n")
    f.write("# 1. uporaba V ISTI rundi; navzkrižna validacija: navy/40\n")
    f.write("# {'O2': 205, 'NONE': 43, '?INTERP': 1} = TOČNO r371 PO census).\n")
    f.write("# Census PRED → PO: white {'NONE': 3} → {'O2': 3} gap 3→0;\n")
    f.write("# white/60 {'NONE': 8, 'O0': 3} → {'NONE': 4, 'O0': 3, 'O2': 4}\n")
    f.write("# gap 8→4 — vsi 4 = KIT (izjema #1); O0 ×3 = top-bar izjema #2\n")
    f.write("# (zamrznjena v r369-stil-val52.test.ts); roksal-green/40\n")
    f.write("# {'NONE': 1} → {'O2': 1} gap 1→0. Dokumentirane izjeme BREZ\n")
    f.write("# sprememb: ring/50 ×14 (vse ui/* shadcn kit fokus jezik),\n")
    f.write("# white/60 KIT ×4, destructive/20+/40 ×4 (ui badge/button),\n")
    f.write("# resizable ring O1 ×1, navy ?INTERP ×1 → KIT (roksal-catalog L110).\n")
    f.write("# Stale-pin PRED-skan: r373-window-scan.py (klon r372, TARGETS =\n")
    f.write("# photo-tab + dashboard-tab) delta +28 ×3 žetona = 0 preozkih\n")
    f.write("# (14/14 PRED in PO); ŠTEVEC guard sken: r370 (A) navy-obsegani\n")
    f.write("# števci + r371/r372 per-datoteka hex/aria/title čisto (INS ne\n")
    f.write("# doda hex/aria/title/vrstic); r348/r346/r271/r272/r268 pini\n")
    f.write("# preživijo. Era preverba: r373-era-harvest.sh (ŠESTINDVJSETIJNA\n")
    f.write("# — 26 registrov r347–r372, ≥109 need_static) EXIT=0 ob 1. teku —\n")
    f.write("# vseh 26 er ŽIVO; val 55 vsi 4 needleji ŽIVO DIREKTNO; val 55\n")
    f.write("# POST-deploy spot (r373-qa-spot.sh spot-r167/18 + re-proba 18b):\n")
    f.write("# vse 4 val 55 površine podatkovno/napačno-gated v demo seji →\n")
    f.write("# iskreno NEmontirane z razlogom iz diska (kanon r277); sidra ŽIVO\n")
    f.write("# (CSV izvoz + 'Sistem — zdravje'); kolektor 0 errorjev.\n")
for i, (needle, opis, vrsta) in enumerate(rows):
    pass  # (priprava — pisanje spodaj znotraj with bloka)

with out.open("a", encoding="utf-8") as g:
    for needle, opis, vrsta in rows:
        g.write(f"{needle}\t{opis}\t{vrsta}\n")
print(f"OK: {out} zapisan ({len(rows)} vrstic)")

# NF=3 validacija po zapisu
dat = out.read_text(encoding="utf-8").splitlines()
data = [l for l in dat if l and not l.startswith("#")]
if len(data) != 5:
    sys.exit(f"FAILOVEDANO: NF={len(data)} ≠ 5 (4 need_static + 1 must_miss)")
ns = sum(1 for l in data if l.split("\t")[2] == "need_static")
mm = sum(1 for l in data if l.split("\t")[2] == "must_miss")
if ns != 4 or mm != 1:
    sys.exit(f"FAILOVEDANO: need_static={ns}, must_miss={mm}")
print(f"NF=3 validacija OK: {ns} need_static + {mm} must_miss, TAB ločilo čisto")
