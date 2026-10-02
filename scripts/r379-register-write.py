#!/usr/bin/env python3
# r379-register-write.py — R379 register scripts/qa-needles/r379.tsv
# (kanon: python write z \t — LEKCIJA R365; NF=3 validacija po zapisu).
# 4 need_static = val 59 NOVI kanon-strings (red/40 offset-2 PARITETA —
# 14 × INS ' focus-visible:ring-offset-2' TIK ZA red/40; val 52 pairing
# kanon generaliziran na rdečo družino; ciljni kanon = val 43 RED_KANON),
# ×0 v HEAD pred rundo (fetch-first git grep -F na aea8720 components —
# GLASNO potrjeno); multiplicita v POJAVITVAH (grep -o, LEKCIJA R365 (2)):
# N1 top-bar ×2, N2 sessions-dialog ×2, N3 dashboard ×2, N4
# termini-card ×1 + roksal-catalog ×1 (isti niz — per-datoteka kanon).
# Izpuščeni kandidati (iskreno dokumentirano, kanon r366–r377):
#  - floor-plan L1731 + inventory L1740 + quote-followup L641 — pokriti
#    prek vitest (A) in (C) [ostanek 0 čez vse roksal] — register vzame
#    4 reprezentativne per-datoteka needleje, ne vseh 14;
#  - red-400/60 sketch trio (val 50) = DRUGA družina, nedotaknjena;
#  - B/C/A gap družine (transition/border/offset na navy vrsticah v
#    crm-tab ×12/×13 itd.) — NASLEDNJI val kandidati, disk resnica
#    r379-census.sh shranjena (NI tiho).
# must_miss: TODO-R379.
import pathlib, subprocess, sys

rows = [
    ("gap-2 focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2",
     "R379 val 59 top-bar CMP par (L261+L268) — red/40 + offset-2 pariteta (x2 pojavitev v top-bar; 0 v HEAD)",
     "need_static"),
    ("press-scale focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2",
     "R379 val 59 sessions-dialog par (L316+L348) — red/40 + offset-2 pariteta (x2 pojavitev v sessions-dialog; 0 v HEAD)",
     "need_static"),
    ("h-7 border-roksal-red/40 text-roksal-red hover:bg-roksal-red/10 hover:text-roksal-red focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2",
     "R379 val 59 dashboard KIT par (L1914+L2059) — red/40 + offset-2 (x2 pojavitev v dashboard-tab; 0 v HEAD)",
     "need_static"),
    ("mt-2 h-7 border-roksal-red/40 text-roksal-red hover:bg-roksal-red/10 hover:text-roksal-red focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2",
     "R379 val 59 termini-card L474 (x1) + roksal-catalog L201 (x1) — isti niz per-datoteka (0 v HEAD)",
     "need_static"),
    ("TODO-R379",
     "must_miss: razvojni ostanki (nesme biti v produkcijskih cankih)",
     "must_miss"),
]

HEAD = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
print(f"HEAD = {HEAD}")
if not HEAD.startswith("aea8720"):
    print("OPOZORILO: HEAD ni 73d57b0 (njihov R378 push) — preverba gre VSEENO na 73d57b0 resolving")

BASE = subprocess.run(["git", "rev-parse", "73d57b0"], capture_output=True, text=True).stdout.strip()
if not BASE:
    sys.exit("FAILOVEDANO: aea8720 ni resolvljiv — kdo je premaknil zgodovino?")
for needle, opis, vrsta in rows:
    if vrsta != "need_static":
        continue
    r = subprocess.run(
        ["git", "grep", "-F", "--", needle, BASE, "--", "src/components"],
        capture_output=True, text=True)
    if r.returncode == 0 and r.stdout.strip():
        sys.exit(f"FAILOVEDANO: needle ŽE v HEAD {BASE[:7]}: {needle[:70]} …")
    print(f"OK ×0 v 73d57b0: {needle[:70]} …")

REG = pathlib.Path("/home/z/my-project/scripts/qa-needles/r379.tsv")
if REG.exists():
    sys.exit(f"FAILOVEDANO: register ŽE obstaja: {REG}")
with REG.open("w", encoding="utf-8") as f:
    f.write("# qa-needles/r379.tsv — REGISTER needlejev runde R379 (STIL val 59:\n")
    f.write("# red/40 offset-2 PARITETA — 14 × INS ' focus-visible:ring-offset-2'\n")
    f.write("# TIK ZA 'focus-visible:ring-roksal-red/40' na 8 datotekah; val 52\n")
    f.write("# pairing kanon (navy) generaliziran na rdečo družino; ciljni kanon\n")
    f.write("# = val 43 RED_KANON; 11 že-pariranih = dokazana konvencija;\n")
    f.write("# r372 val 55 izjema #1 (top-bar ×2 + dashboard KIT) RESOLVANA —\n")
    f.write("# r372 (D)/(E) PIN SHIFT/EVOLVED žigi. Orodja: r379-census.sh\n")
    f.write("# [disk resnica triaža: B/transition gap = NASLEDNJI val kandidat:\n")
    f.write("# crm-tab ×12 + dashboard ×3 + cena paneli ×4 …; C/border gap ×37;\n")
    f.write("# A/offset gap ×11] + r379-val59-apply.py fail-closed [scan→14,\n")
    f.write("# apply 14, idempotenca 0] + r379-window-scan.py [8. generalizacija:\n")
    f.write("# DEL 1 regex okna 53 + DEL 2 NOVO: needle pini iz registrov r340+\n")
    f.write("# 139 vseh ŽIVIH v src (LEKCIJA R377 (4) formalizacija) + DEL 3\n")
    f.write("# slice-okna 17; delta 28 → 0 preozkih] + spot-r167/22 [val 58\n")
    f.write("# POST-deploy ZELEN; vodič race 2-fazni post-pogoj storage='true'].\n")
    f.write("# KOLIZIJA #21: njihova poslovna R378 (73d57b0, PROIZVODNA DOMENA) je\n# pristala MED mojim delom — moja runda preimenovana R378→R379 po kanonu\n# KOLIZIJE #4/R323/#13–#20 (21. potrditev); fetch-first origin/main ==\n# HEAD 73d57b0 PO resetu + re-aplikaciji.\n")
    f.write("#\n")
    f.write("# FORMAT (TSV; EN vrstica = EN needle; TAB je LOČILO — presledki\n")
    f.write("# znotraj needleja so POMENNI, ker grep -F išče dobesedno).\n")
    f.write("# Vrste: need_static (MORA biti ŽIV v svežem buildu) | must_miss\n")
    f.write("# (NESME biti v produkcijskih čankih).\n")
    for needle, opis, vrsta in rows:
        f_line = f"{needle}\t{opis}\t{vrsta}\n"
        if len(f_line.rstrip("\n").split("\t")) != 3:
            sys.exit(f"FAILOVEDANO: NF != 3: {f_line[:60]}")
        f.write(f_line)

# NF=3 validacija po zapisu (kanon r375)
data = [l for l in REG.read_text(encoding="utf-8").splitlines() if l and not l.startswith("#")]
bad = [l for l in data if len(l.split("\t")) != 3]
if bad:
    sys.exit(f"FAILOVEDANO: {len(bad)} vrst z NF != 3")
need = [l for l in data if l.split("\t")[2] == "need_static"]
miss = [l for l in data if l.split("\t")[2] == "must_miss"]
print(f"OK: r379.tsv zapisan — {len(need)} need_static + {len(miss)} must_miss (NF=3 vsi)")
