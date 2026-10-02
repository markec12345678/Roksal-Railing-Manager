#!/usr/bin/env python3
# r362 register writer — kanon R340+ (python write z \t; awk NF=3 verifikacija
# klicatelj). 4 need_static (val 45 era-diskriminatorji: 1 className token ×3
# + 3 aria statična segmenta ×1 — vsi ×0 v HEAD pred rundo, preverjeno
# fetch-first) + 1 must_miss (TODO-R362).
rows = [
    ("h-8 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2",
     "R362 val 45 h-8 akcije trojica ring offset-2 (×3 v quote-followup; 0 v HEAD)",
     "need_static"),
    ("Pokliči — spomnik za ",
     "R362 val 45 Pokliči per-item aria statični predpon (×1; 0 v HEAD)",
     "need_static"),
    (" na +3 dni",
     "R362 val 45 +3 dni per-item aria statični pripon (×1; 0 v HEAD)",
     "need_static"),
    (" na +7 dni",
     "R362 val 45 +7 dni per-item aria statični pripon (×1; 0 v HEAD)",
     "need_static"),
    ("TODO-R362",
     "must_miss: razvojni ostane (nesme biti v produkcijskih čankih)",
     "must_miss"),
]
with open("scripts/qa-needles/r362.tsv", "w", encoding="utf-8") as f:
    f.write("# qa-needles/r362.tsv — REGISTER needlejev runde R362 (STIL val 45:\n")
    f.write("# ring PARITETA zaključek quote-followup družine — 3 izvozna brata\n")
    f.write("# (press-scale) + 3 h-8 akcije dobili focus-visible:ring-offset-2; + 3\n")
    f.write("# NOVI per-item aria-label z nazivProjekta (kanon R346/R356; 'Datum\n")
    f.write("# spomnika:' precedent v isti datoteki). QA-dokazano R362 spot-r167/6:\n")
    f.write("# val 44 je pokril SAMO crm-tab.tsx (1 datoteka × 1 družina) —\n")
    f.write("# quote-followup = isti CRM pogled, druga datoteka, 3 brata brez\n")
    f.write("# offseta. Era-diskriminatorji: className token (×3) + aria statična\n")
    f.write("# segmenta brez interpolacijske meje (LEKCIJA R361 — SWC transpilira\n")
    f.write("# template literal v konkatenacijo). 0 novih hex (števec = 0).\n")
    f.write("# FORMAT (TSV; EN vrstica = EN needle; TAB je LOČILO) — kanon R340–R361.\n")
    f.write("#   <needle_string><TAB><opis><TAB><vrsta>\n")
    f.write("# vrsta: need_static (MORA biti ŽIV v čankih) | must_miss (NE SME biti)\n\n")
    f.write("# ── R362 lastni needleji ──\n")
    for needle, opis, vrsta in rows:
        f.write(f"{needle}\t{opis}\t{vrsta}\n")
print("r362.tsv zapisan: 4 need_static + 1 must_miss")
