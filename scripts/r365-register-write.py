#!/usr/bin/env python3
# r365-register-write.py — piše scripts/qa-needles/r365.tsv (TSV, TAB ločilo)
# Kanon R340–R364: python write z \t (awk NF=3 čisto, prazne/komentar vrstice
# preskočene). 4 need_static = val 48 NOVI className nizi (vsak ×0 v HEAD
# fetch-first git show grep — GLASNO potrjeno ×4) + must_miss TODO-R365.
import os

REG = "scripts/qa-needles/r365.tsv"
rows = [
    ("h-7 shrink-0 px-2 text-2xs press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2",
     "R365 val 48 h-7 shrink-0 pilula ring offset-2 (x1; 0 v HEAD)", "need_static"),
    ("h-6 text-2xs bg-roksal-navy/5 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2",
     "R365 val 48 h-6 navy/5 pilula ring offset-2 (x1; 0 v HEAD)", "need_static"),
    ("mt-0.5 h-3.5 w-3.5 accent-roksal-navy focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2",
     "R365 val 48 checkbox accent pilula ring offset-2 (x3; 0 v HEAD)", "need_static"),
    ("bg-roksal-navy hover:bg-roksal-navy/90 text-white shadow-sm transition-all press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 disabled:opacity-50",
     "R365 val 48 dialog submit disabled bucket ring offset-2 (x5; 0 v HEAD)", "need_static"),
    ("TODO-R365",
     "must_miss: razvojni ostane (nesme biti v produkcijskih cankih)", "must_miss"),
]
header = """# qa-needles/r365.tsv — REGISTER needlejev runde R365 (STIL val 48:
# ring PARITETA logistics-tab družine — NAJVEČJI preostali gap po val 43–47;
# per-barvni split sken (LEKCIJA R364 kandidat): navy/40 družina V TEJ rundi,
# stray ring-red-400/50 x2 (L2732/L3081) = LOČENA barvna družina (bratje v
# photo-tab/sketch-canvas) — IZRECNO izven val 48, dokumentirano ne tiho).
# 35 x focus-visible:ring-offset-2 dodan [vedre ŠTEJANE IZ DISKA: 30 zaprti
# niz + 5 disabled bucket; 1 (L1302) že nosil offset-2] → 36/36 navy/40 nosi
# offset-2 (razcep števca = 0); in-place = 0 novih vrstic 3294→3294; 0 novih
# hex (števec 1 nespremenjen — r292 baseline). aria/title ZAMRZNJENI
# (ring-only runda — val 44/46/47 precedens). Stale pini PRED-SCAN čez VSE
# 43 testnih datotek, ki berejo logistics-tab: EDINI prelomljiv pin =
# r244 L231 substring 'navy/40 disabled:opacity-50' x5 (žeton vstavljen MED
# dva dela pina — LEKCIJA R363 vzorec) → shiftan V ISTI rundi (števec 5
# nespremenjen); r292 'pil' prefix pini preživijo; okenske dolžine: r317
# okno (i-8,i+6) NE seka logistics navy vrstic. Era-diskriminatorji = 4 NOVI
# className nizi [vsi x0 v HEAD fetch-first git show grep; multiplicita
# x1/x1/x3/x5 iskreno dokumentirana [LEKCIJA R365: multiplicita = grep -o
# POJAVITVE, ne grep -c VRSTICE — pomota pri prvem osnutku iskreno
# popravljena]; statični segmenti brez interpolacijske
# meje — LEKCIJA R361; v tej datoteki NI template literal bucketov].
# FEATURE: e2e-lib dedup 5. val — eb_sonda_zaloge (byte-identičen eval blok
# md5 d3da517025ad391c3646b0cc572a0045: r363 B + r364 B + r365 B = x3 — prag
# LEKCIJE R352 natanko ob 3.; poraba ob 1. uporabi v r365-qa-spot.sh V ISTI
# rundi ×2 teka; zamrznjeni NI mutirani).
# FORMAT (TSV; EN vrstica = EN needle; TAB je LOČILO) — kanon R340–R364.
#   <needle_string><TAB><opis><TAB><vrsta>
# vrsta: need_static (MORA biti ŽIV v čankih) | must_miss (NE SME biti)

# ── R365 lastni needleji ──
"""
with open(REG, "w", encoding="utf-8") as f:
    f.write(header)
    for needle, opis, vrsta in rows:
        f.write(f"{needle}\t{opis}\t{vrsta}\n")
print("written", REG)
