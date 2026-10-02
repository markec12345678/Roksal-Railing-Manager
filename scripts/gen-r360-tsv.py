#!/usr/bin/env python3
# gen-r360-tsv.py — R360 register (kanon R340–R359: python write z \t —
# LEKCIJA: awk/sed pisani TSV-ji so kvarili stolpce; python je determinističen).
import os

VRSTICE = [
    ("Izdaj račun — status iz osnutka v izdan",
     "R360 val 43 Izdaj aria (akcija+cilj; ring kanon v istem commitu; rollback resnica v titleju)",
     "need_static"),
    ("Trajno izbriši osnutek računa — brisanje ni možno razveljaviti",
     "R360 val 43 Briši title (deleteInvoice je PRAVI DELETE — iskrena trajnost, za razliko od bulk meritev arhiviranja)",
     "need_static"),
    ("Uredi osnutek — osnutek se odstrani, dialog zapolni polja; shranjevanje ustvari nov račun",
     "R360 val 43 Uredi title (iskrena posledica: izbriši+zaključi osnutek vzorec)",
     "need_static"),
    ("TODO-R360",
     "must_miss: razvojni ostane (nesme biti v produkcijskih čankih)",
     "must_miss"),
]

TARG = "scripts/qa-needles/r360.tsv"
GLAVA = [
    "# r360.tsv — R360 register (MANDATORY STIL val 43: računovodske akcije družine,",
    "# invoice-manager.tsx — 9 gumbov; aria/title NOVI + ring kanon/pariteta; 0 novih",
    "# hex). ERA-DISKRIMINATORJI: vsi 3 need_static so enolični (×1 v virih,",
    "# preverjeno rg -F) in NOVI v val 43 — starejši registri jih ne smejo vsebovati.",
    "# must_miss TODO-R360 = razvojni ostane.",
]

with open(TARG, "w", encoding="utf-8") as f:
    for line in GLAVA:
        f.write(line + "\n")
    for needle, opis, vrsta in VRSTICE:
        f.write(f"{needle}\t{opis}\t{vrsta}\n")

print(f"NAPISANO: {TARG}")
