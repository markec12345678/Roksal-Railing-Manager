#!/usr/bin/env python3
# r363 register writer — kanon R340+ (python write z \t; awk NF=3 verifikacija
# klicatelj). 4 need_static (val 46 era-diskriminatorji: NOVI className nizi
# inventory-tab — vsi ×0 v HEAD pred rundo, fetch-first git grep; multiplicita
# ×1/×1/×2/×1 iskreno dokumentirana) + 1 must_miss (TODO-R363).
rows = [
    ("h-8 shrink-0 gap-1.5 text-[11px] font-medium tabular-nums press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 active:scale-[0.96]",
     "R363 val 46 inventory premik-gumb CTA ring offset-2 (×1; 0 v HEAD)",
     "need_static"),
    ("inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-2xs font-semibold text-roksal-ink/70 transition-colors hover:bg-secondary hover:text-roksal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2",
     "R363 val 46 inventory filter čip ring offset-2 (×1; 0 v HEAD)",
     "need_static"),
    ("bg-roksal-navy hover:bg-roksal-navy/90 text-white shadow-sm transition-all press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 disabled:opacity-50",
     "R363 val 46 inventory Shrani osnutek primarni ring offset-2 (×2; 0 v HEAD)",
     "need_static"),
    ("h-8 gap-1.5 text-[11px] press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2",
     "R363 val 46 inventory header pilule ring offset-2 (×1; 0 v HEAD)",
     "need_static"),
    ("TODO-R363",
     "must_miss: razvojni ostane (nesme biti v produkcijskih čankih)",
     "must_miss"),
]
with open("scripts/qa-needles/r363.tsv", "w", encoding="utf-8") as f:
    f.write("# qa-needles/r363.tsv — REGISTER needlejev runde R363 (STIL val 46:\n")
    f.write("# ring PARITETA inventory-tab družine — 22 × focus-visible:ring-offset-2\n")
    f.write("# dodan [12 vrstic-rep + 5 template + 4 disabled + 1 active:scale]; 23/23\n")
    f.write("# navy/40 nosi offset-2 [razcep števca = 0]; aria/title ZAMRZNJENI\n")
    f.write("# (ring-only runda — val 44 precedens). LEKCIJA R362 (1): 'družina ≠\n")
    f.write("# datoteka' — ta runda skenira TUDI vir datoteko po datoteki [fetch-first\n")
    f.write("# rg sken: 23 navy/40, 0 non-focus]. Stale pini shiftani V ISTI rundi:\n")
    f.write("# r242 L176/177 (eksaktna invSrc pina) + r237:230 (substring pin —\n")
    f.write("# offset se vstavi MED niza). Era-diskriminatorji = 4 NOVI className\n")
    f.write("# nizi [vsi ×0 v HEAD fetch-first git grep; multiplicita ×1/×1/×2/×1;\n")
    f.write("# statični segmenti brez interpolacijske meje — LEKCIJA R361]. 0 novih\n")
    f.write("# hex (števec = 0). FEATURE: e2e-lib dedup 3. val — eb_pocakaj_csv_pilli\n")
    f.write("# (prag ×7 presežen; poraba ob 1. uporabi v r363-qa-spot.sh).\n")
    f.write("# FORMAT (TSV; EN vrstica = EN needle; TAB je LOČILO) — kanon R340–R362.\n")
    f.write("#   <needle_string><TAB><opis><TAB><vrsta>\n")
    f.write("# vrsta: need_static (MORA biti ŽIV v čankih) | must_miss (NE SME biti)\n\n")
    f.write("# ── R363 lastni needleji ──\n")
    for needle, opis, vrsta in rows:
        f.write(f"{needle}\t{opis}\t{vrsta}\n")
print("r363.tsv zapisan: 4 need_static + 1 must_miss")
