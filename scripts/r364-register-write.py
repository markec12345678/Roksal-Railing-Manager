#!/usr/bin/env python3
# r364 register writer — kanon R340+ (python write z \t; awk NF=3 verifikacija
# klicatelj). 4 need_static (val 47 era-diskriminatorji: NOVI className nizi
# measurements-tab — vsi ×0 v HEAD pred rundo, fetch-first git grep; multiplicita
# ×1/×1/×5/×1 iskreno dokumentirana) + 1 must_miss (TODO-R364).
rows = [
    ("text-3xs font-medium border transition-all hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2",
     "R364 val 47 status cikel chip ring offset-1→2 normalizacija (×1; 0 v HEAD)",
     "need_static"),
    ("px-2.5 py-1 text-[11px] font-medium hover:bg-roksal-navy/90 active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2",
     "R364 val 47 primarni navy akcijski gumb ring offset-2 (×1; 0 v HEAD)",
     "need_static"),
    ("focus-visible:ring-inset focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:outline-none transition-colors",
     "R364 val 47 ring-inset druzina (filtri/ckipi) ring offset-2 (×5; 0 v HEAD)",
     "need_static"),
    ("h-8 px-3 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2\"",
     "R364 val 47 h-8 pilula zaprti niz ring offset-2 (×1; 0 v HEAD)",
     "need_static"),
    ("TODO-R364",
     "must_miss: razvojni ostane (nesme biti v produkcijskih čankih)",
     "must_miss"),
]
with open("scripts/qa-needles/r364.tsv", "w", encoding="utf-8") as f:
    f.write("# qa-needles/r364.tsv — REGISTER needlejev runde R364 (STIL val 47:\n")
    f.write("# ring PARITETA measurements-tab družine — 29 × popravkov [28 ×\n")
    f.write("# focus-visible:ring-offset-2 dodan + 1 × ring-offset-1→2 normalizacija\n")
    f.write("# (val 44 precedens)]; 47/47 navy/40 nosi offset-2 [razcep števca = 0;\n")
    f.write("# 18 je ŽE nosilo pred rundom]. aria/title ZAMRZNJENI (ring-only runda —\n")
    f.write("# val 44/46 precedens); r172 prst 6051 POTRJEN IZ DISKA [ring-only\n")
    f.write("# in-place = 0 novih vrstic: 6232→6232]. LEKCIJA R362 (1) aplikirana:\n")
    f.write("# vir sken datoteko po datoteki [fetch-first rg sken: 47 navy/40, 0\n")
    f.write("# non-focus, 29 brez offset vključno ring-inset družina ×5]. Stale pini\n")
    f.write("# PRED-SCAN: exact-quote pini (r242:157 → material-intelligence-tab,\n")
    f.write("# r268:290 → team-tab) NE kažejo na measurements-tab → 0 shiftov\n")
    f.write("# potrebnih; substring pini preživijo in-place razširitev. Era-\n")
    f.write("# diskriminatorji = 4 NOVI className nizi [vsi ×0 v HEAD fetch-first\n")
    f.write("# git grep; multiplicita ×1/×1/×5/×1; statični segmenti brez\n")
    f.write("# interpolacijske meje — LEKCIJA R361]. 0 novih hex (števec = 0).\n")
    f.write("# FEATURE: e2e-lib dedup 4. val — eb_pocakaj_zalogo (identičen predikat\n")
    f.write("# ×2 + ×1 O-R brat; proaktiven pri 2. ponovitvi, LEKCIJA R362 (3);\n")
    f.write("# poraba ob 1. uporabi v r364-qa-spot.sh V ISTI rundi).\n")
    f.write("# FORMAT (TSV; EN vrstica = EN needle; TAB je LOČILO) — kanon R340–R363.\n")
    f.write("#   <needle_string><TAB><opis><TAB><vrsta>\n")
    f.write("# vrsta: need_static (MORA biti ŽIV v čankih) | must_miss (NE SME biti)\n\n")
    f.write("# ── R364 lastni needleji ──\n")
    for needle, opis, vrsta in rows:
        f.write(f"{needle}\t{opis}\t{vrsta}\n")
print("r364.tsv zapisan: 4 need_static + 1 must_miss")
