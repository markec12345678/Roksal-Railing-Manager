#!/usr/bin/env python3
# r369-register-write.py — R369 register scripts/qa-needles/r369.tsv
# (kanon: python write z \t — LEKCIJA R365; NF=3 validacija po zapisu).
# 4 need_static = val 52 NOVI className tokeni (navy+ink PARIŠKA pariteta —
# offset med navy/40 in dark:ink/40), vsi ×0 v HEAD pred rundo (fetch-first
# git grep -F na 686c379 components — GLASNO potrjeno); multiplicita v
# POJAVITVAH (grep -o, LEKCIJA R365 (2)): N1 ×10, N2 ×1, N3 ×1, N4 ×1.
# Izpuščeni kandidati (iskreno dokumentirano, kanon r366/r367/r368):
#  - 'focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2
#    disabled:cursor-not-allowed' (brez hover: prefixa) — NI ×0 v HEAD
#    (×1 že obstaja iz starejše ere — isti sosledni vzorec);
#  - 'md:text-[11px] … ring-roksal-navy/40 focus-visible:ring-offset-2'
#    kot N4-brez-outline-none variant — NE obstaja (žeton vrstnega reda:
#    outline-none + ring-2 ležita MED md:text-[11px] in navy/40);
#  - ui/* ring/50 (×14) in top-bar white/60 ring-offset-0 (×3) —
#    DOKUMENTIRANA namerna izjema (shadcn kit fokus jezik ring-[3px] /
#    gosta površina) — ne tiho izpuščeno (LEKCIJA R366 (5)).
# must_miss: TODO-R369.
import pathlib

rows = [
    ("focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 dark:focus-visible:ring-roksal-ink/40",
     "R369 val 52 navy+ink pariske vrstice — offset med svetlo in temno varianto (x10 pojavitev; 0 v HEAD)",
     "need_static"),
    ("hover:text-roksal-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed",
     "R369 val 52 notification L855 split vrstica offset pred disabled (x1 pojavitev; 0 v HEAD)",
     "need_static"),
    ("focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 active:scale-[0.97]",
     "R369 val 52 notification L940 split vrstica offset pred active (x1 pojavitev; 0 v HEAD)",
     "need_static"),
    ("md:text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2",
     "R369 val 52 bottom-nav L123 glavni zavihek offset (x1 pojavitev; 0 v HEAD)",
     "need_static"),
    ("TODO-R369",
     "must_miss: razvojni ostanki (nesme biti v produkcijskih cankih)",
     "must_miss"),
]
out = pathlib.Path("scripts/qa-needles/r369.tsv")
with out.open("w", encoding="utf-8") as f:
    f.write("# qa-needles/r369.tsv — REGISTER needlejev runde R369 (STIL val 52:\n")
    f.write("# ring OBLIKOVNA pariteta navy+ink PARIŠKIH vrstic — per-barvni\n")
    f.write("# split kanon nadaljevanje (navy = val 43–49 površinsko, red = val\n")
    f.write("# 50, amber = val 51, navy+ink pari = val 52): 12 pariških vrstic\n")
    f.write("# × 4 datoteke (termini-card ×6, bottom-nav ×2, notification-center\n")
    f.write("# ×3, quick-actions-fab ×1) zdaj nosi EN focus-visible:ring-offset-2\n")
    f.write("# TIK ZA navy/40 — tema-neodvisen žeton pokrije svetlo navy/40 IN\n")
    f.write("# temno ink/40 varianto ISTEGA elementa (kanon R368 'EN offset\n")
    f.write("# pokrije svetlo+temno'). Census iz diska scripts/r369-census.py:\n")
    f.write("# ink/40 po = {'O2': 12} razcep = 0; navy gap 77 → 65 (točno 12\n")
    f.write("# parov rešenih — ostali navy rep = val 53+ kandidat, iskreno).\n")
    f.write("# In-place = 0 novih vrstic; 0 novih hex; aria/title ZAMRZNJENI\n")
    f.write("# (ring-only runda — val 44–51 precedens). Stale-pin PRED-scan\n")
    f.write("# ČIST: r167 regexa preživita (vstavljanje ZA navy/40, ne za ink),\n")
    f.write("# r214 števca 2/2 nespremenjena, r268 = team-tab izven tarče, r361\n")
    f.write("# (E) = crm-tab izven tarče — NIČ shiftano (iskreno nič).\n")
    f.write("# FEATURE e2e-lib dedup 9. val: eb_sonda_red_stetje (rdeči trio\n")
    f.write("# byte-identičen ×2 v r368-qa-spot A/C — per-blok md5\n")
    f.write("# 03c8497dc9baf54c87e78a7dcb6f8ad8 nad 449 bajti; skrajšani par ×3 —\n")
    f.write("# md5 640fec6de79293af75c9b021268b8a15 nad 278 bajti, prag R352\n")
    f.write("# izenačen; kanon = POLNI trio 3-poljni eval, B-okrnjena oblika se\n")
    f.write("# ne kanonizira; 1. uporaba v r369-qa-spot.sh V ISTI rundi;\n")
    f.write("# zamrznjeni NI mutirani — kanon R361–R368).\n")
    f.write("# Era preverba: kanonski skript r369-era-harvest.sh (22 registrov\n")
    f.write("# r347–r368, ≥93 need_static) + prod-qa re-run 368 ob začetku\n")
    f.write("# runde; val 51 POST-deploy spot (amber površine, spot-r167/14).\n")
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
