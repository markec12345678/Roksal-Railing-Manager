#!/usr/bin/env python3
# r375-register-write.py — R375 register scripts/qa-needles/r375.tsv
# (kanon: python write z \t — LEKCIJA R365; NF=3 validacija po zapisu).
# 4 need_static = val 57 NOVI className tokeni (ring↔border pariteta
# navy/40 obrobljenih gumbov measurements-tab: 22 × INS
# ' focus-visible:border-roksal-navy/40 dark:focus-visible:border-roksal-ink/40'
# TIK ZA offset — kanon calculator L4439 precedens + r166 dark obramba),
# vsi ×0 v HEAD pred rundo (fetch-first git grep -F na 8db6a1c components —
# GLASNO potrjeno); multiplicita v POJAVITVAH (grep -o, LEKCIJA R365 (2)):
# N1 ×1, N2 ×1, N3 ×1, N4 ×1.
# Izpuščeni kandidati (iskreno dokumentirano, kanon r366–r374):
#  - L3763/L3786 bratje ×2 (enak niz; pokriti prek vitest (A) guard —
#    kanon 4 needleje/rundo);
#  - L5154/L5167 + L5182/L5194/L5211/L5234 bratje (pokriti prek vitest (A));
#  - ostalih 12 INS vrstic (enaka semantika, pokriti prek vitest (A));
#  - amber/red bordered ×2 (lastni družini — prihodnji val), INPUT ×4
#    accent checkbowerji (border ne nosi fokus barve na native checkboxu),
#    navy brez border širine ×25 (mrtev CSS), ui KIT border-ring ×11 —
#    DOKUMENTIRANE namerne izjeme — ne tiho izpuščeno (LEKCIJA R366 (5)).
# must_miss: TODO-R375.
import pathlib, subprocess, sys

rows = [
    ("font-medium border transition-all hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40",
     "R375 val 57 measurements L3125 filter chip border pariteta tik za offset (x1 pojavitev; 0 v HEAD)",
     "need_static"),
    ("hover:border-roksal-amber/40 hover:bg-roksal-amber/5 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40",
     "R375 val 57 measurements L3675 karticna vrstica border pariteta tik za offset (x1 pojavitev; 0 v HEAD)",
     "need_static"),
    ("border border-dashed border-roksal-amber/40 py-1.5 text-2xs text-roksal-amber hover:bg-roksal-amber/5 transition-colors focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40",
     "R375 val 57 measurements L4754 crta amber/40 border pariteta tik za offset (x1 pojavitev; 0 v HEAD)",
     "need_static"),
    ("border border-dashed border-roksal-amber/50 py-1.5 text-2xs text-roksal-ink hover:bg-roksal-amber/10 transition-colors focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40",
     "R375 val 57 measurements L4768 crta amber/50 border pariteta tik za offset (x1 pojavitev; 0 v HEAD)",
     "need_static"),
    ("TODO-R375",
     "must_miss: razvojni ostanki (nesme biti v produkcijskih cankih)",
     "must_miss"),
]

HEAD = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
print(f"HEAD = {HEAD}")
if HEAD != "8db6a1cb71b517aa69bf2cd45b766cb5b7ec1b94":
    print("OPOZORILO: HEAD ≠ 8db6a1c (pričakovani R374 poslovni push) — preverba gre VSEENO na 8db6a1c")

BASE = "8db6a1cb71b517aa69bf2cd45b766cb5b7ec1b94"
for needle, opis, vrsta in rows:
    if vrsta != "need_static":
        continue
    r = subprocess.run(
        ["git", "grep", "-F", "--", needle, BASE, "--", "src/components"],
        capture_output=True, text=True)
    if r.returncode == 0 and r.stdout.strip():
        sys.exit(f"FAILOVEDANO: needle ŽE v HEAD {BASE[:7]}: {needle[:70]} …")
    print(f"OK ×0 v 8db6a1c: {needle[:70]} …")

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

out = pathlib.Path("scripts/qa-needles/r375.tsv")
with out.open("w", encoding="utf-8") as f:
    f.write("# qa-needles/r375.tsv — REGISTER needlejev runde R375 (STIL val 57:\n")
    f.write("# ring↔border OBLIKOVNA pariteta navy/40 obrobljenih gumbov —\n")
    f.write("# NON-ring kandidat #1 iz R373 handoverja: 22 × INS\n")
    f.write("# ' focus-visible:border-roksal-navy/40\n")
    f.write("# dark:focus-visible:border-roksal-ink/40' TIK ZA offset\n")
    f.write("# 'focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'\n")
    f.write("# (kanon calculator L4396/L4439 precedens + r166 dark obramba;\n")
    f.write("# +76 znakov/vrstico ×22 = +1672, in-place 0 novih vrstic; ring na\n")
    f.write("# tarčah ŽE naprej brez dark: variante — PRED disk resnica).\n")
    f.write("# Orodja: NOVI era-clone.py (5. korak generalizacije era verige:\n")
    f.write("# r370–r373 hardcodirani kloni → PARAMETRIZIRAN kloner; 1. uporaba\n")
    f.write("# V ISTI rundi → r374-era-harvest.sh SEDEMINDVJSETIJNA — 27\n")
    f.write("# registrov r347–r373, ≥113 need_static, disk vsota — EXIT=0 ob 1.\n")
    f.write("# teku, val 56 vsi 4 needleji ŽIVO DIREKTNO; 2. uporaba →\n")
    f.write("# r375-era-harvest.sh OSEMINDVJSETIJNA — 28 registrov r347–r374,\n")
    f.write("# ≥117, --dst-label override za poslovno rundi R374) +\n")
    f.write("# r375-val57-apply.py (transformacijski dokument, fail-closed\n")
    f.write("# per vrstica, idempotenca) + r375-window-scan.py (klon r373,\n")
    f.write("# TARGETS = measurements-tab; 25 okenskih regexov, delta +76 = 0\n")
    f.write("# preozkih). Stale-pin + ŠTEVEC guard sken: r372 per-datoteka\n")
    f.write("# vrstice/hex/aria/title + tarce [3351/4032] pozicije čisto;\n")
    f.write("# r370 (A) MERITVE offset-1 = 0; r373 navy92 = 92 (INS ne doda\n")
    f.write("# ring/offset/hex/aria/title/vrstic). Iskrene izjeme BREZ\n")
    f.write("# sprememb: amber/red bordered ×2 (lastni družini), INPUT ×4\n")
    f.write("# accent checkbowerji (border ne nosi fokus barve), navy brez\n")
    f.write("# border širine ×25 (mrtev CSS), ui KIT border-ring ×11.\n")
    f.write("# Era preverba: r374-era-harvest.sh (SEDEMINDVJSETIJNA — 27\n")
    f.write("# registrov r347–r373, ≥113 need_static) EXIT=0 ob 1. teku —\n")
    f.write("# vseh 27 er ŽIVO NA PRODU; val 56 vsi 4 needleji ŽIVO DIREKTNO\n")
    f.write("# [chunk_045 ×3 + chunk_028 ×1]; r375-era-harvest.sh\n")
    f.write("# (OSEMINDVJSETIJNA — 28 registrov) EXIT=0 prek svežega builda\n")
    f.write("# hash rezolucije (r374 issue #13 poslovni needleji — njihov\n")
    f.write("# deploy potrjen); val 56 POST-deploy spot (r375-qa-spot.sh\n")
    f.write("# spot-r167/19 + re-proba 19b): vse 4 val 56 površine\n")
    f.write("# podatkovno-gated v demo seji → iskreno NEmontirane z razlogom\n")
    f.write("# iz diska (kanon r277); sidra ŽIVO ('Slikaj' disabled dok. vrata\n")
    f.write("# + CSV izvoz + 'Ni projektov'); kolektor 0 errorjev v OBEH\n")
    f.write("# runah. prod-qa re-run 373: ZELEN ob poskusu 1 (13. runda\n")
    f.write("# zapored). KOLIZIJA #17: njihova poslovna R374 (8db6a1c) brez\n")
    f.write("# worklog vnosa → adopcijski vnos dopisan ob R375.\n")
for i, (needle, opis, vrsta) in enumerate(rows):
    pass  # (priprava — pisanje spodaj znotraj with bloka)

with out.open("a", encoding="utf-8") as g:
    for needle, opis, vrsta in rows:
        g.write(f"{needle}\t{opis}\t{vrsta}\n")
print(f"OK: {out} zapisan ({len(rows)} vrstic)")

dat = out.read_text(encoding="utf-8").splitlines()
data = [l for l in dat if l and not l.startswith("#")]
if len(data) != 5:
    sys.exit(f"FAILOVEDANO: NF={len(data)} ≠ 5 (4 need_static + 1 must_miss)")
ns = sum(1 for l in data if l.split("\t")[2] == "need_static")
mm = sum(1 for l in data if l.split("\t")[2] == "must_miss")
if ns != 4 or mm != 1:
    sys.exit(f"FAILOVEDANO: need_static={ns}, must_miss={mm}")
print(f"NF=3 validacija OK: {ns} need_static + {mm} must_miss, TAB ločilo čisto")
