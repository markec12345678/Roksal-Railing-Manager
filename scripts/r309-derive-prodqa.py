#!/usr/bin/env python3
# R309 — derive r309-prod-qa.sh IZ r308-prod-qa.sh (UNION harvest dedovan;
# R310 prva naloga). LEKCIJA R307 3: grep čistost preverba uporablja RAZRED
# ZNAKOV ('R30[8]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).
# LEKCIJA R309 1 (unesena runda): harvest dispatch VSEBUJE dashboard zavihek
# (popravek prvega teka r308-prod-qa.sh) — dedovan prek izvorne skripte.
# Vsaka zamenjava MORA biti potrjena (števec) po generiranju (lekcija R303 2).
import sys

SRC = "/home/z/my-project/scripts/r308-prod-qa.sh"
DST = "/home/z/my-project/scripts/r309-prod-qa.sh"

s = open(SRC, encoding="utf-8").read()

def sub_once(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        print(f"FAIL-CLOSED: '{label}' pričakovana 1 pojavnost, najdeno {n}")
        sys.exit(1)
    s = s.replace(old, new)
    print(f"OK   [{label}] 1 zamenjava")

def sub_all(old, new, label, expect_min=1):
    global s
    n = s.count(old)
    if n < expect_min:
        print(f"FAIL-CLOSED: '{label}' pričakovano >= {expect_min}, najdeno {n}")
        sys.exit(1)
    s = s.replace(old, new)
    print(f"OK   [{label}] {n} zamenjav")

# --- 1. Globalno preimenovanje markerjev (poti, logi, spremenljivke) ---
sub_all("r308-prod", "r309-prod", "poti skript r308→r309")
sub_all("R308_COMMIT_ISO", "R309_COMMIT_ISO", "meja spremenljivka")
sub_all("R308_PUSH", "R309_PUSH", "push meja spremenljivka")
sub_all("r308-chunkurls", "r309-chunkurls", "tmp chunk sezname")
sub_all("r308-", "r309-", "tmp/log prefiksi", 2)

# --- 2. COMMIT awk vzorec: meja išče R309 commit ---
sub_once("$2 ~ /^R308 —/", "$2 ~ /^R309 —/", "awk commit vzorec")

# --- 3. Stale-veja besedilo: kateri deploy pričakujemo ---
sub_once("R307 (ŽIVO) + R308 pričakujeta SKUPNI deploy", "R308 (ŽIVO) + R309 pričakujeta SKUPNI deploy", "stale eskalacija besedilo")

# --- 4. Z2 žig: seznam razširjen z R309 ×6+3 ---
sub_once(
    "R308 ×7 + R307 ×11 + R306 ×11 + R295 ×9 LIVE + R294 ×9 + R293 ×8 + R292 ×8 + R291 ×8 + R290 ×8 + regresije + must_miss",
    "R309 ×6+3 + R308 ×7 + R307 ×11 + R306 ×11 + R295 ×9 LIVE + R294 ×9 + R293 ×8 + R292 ×8 + R291 ×8 + R290 ×8 + regresije + must_miss",
    "Z2 naslov",
)

# --- 5. R309 blok VSTAVLJEN pred R308 blok; R308 blok postane regresija ---
sub_once(
    'echo "--- R308 MANDATORY — API I/O MEJA: HARMONIZIRANE OPOZORILNE POVRŠINE (LIVE — PRVA naloga R309) ---"',
    'echo "--- R309 MANDATORY — MIGRACIJSKI VAL I/O MEJE: EN VIR api-telo + STIL harmonizacija (LIVE — PRVA naloga R310) ---"\n'
    'need "Neveljavno telo zahteve — pričakovan JSON objekt" "R309 EN VIR sporočilo (string literal) — LIVE"\n'
    'need "preberiJsonTelo" "R309 uvožena funkcija (vezava preživi) — LIVE"\n'
    'need "bg-roksal-green/10 text-roksal-ink border-roksal-green/40" "R309 PLACAN značka (žeton + ink) — LIVE"\n'
    'need "border-roksal-green/30 bg-roksal-green/10" "R309 Plačano KPI kartica (žeton) — LIVE"\n'
    'need "bg-roksal-amber text-roksal-navy hover:bg-roksal-amber/90 press-scale" "R309 Nov račun CTA (žetona) — LIVE"\n'
    'need "border-l-roksal-green" "R309 vrstična letvica PLACAN (žeton) — LIVE"\n'
    'must_miss "bg-amber-500 text-navy-900" "R309 surov CTA par (izginil) — LIVE"\n'
    'must_miss "border-l-emerald-500" "R309 surova letvica (izginila) — LIVE"\n'
    'must_miss "border-emerald-200 dark:border-emerald-800 bg-emerald-50" "R309 surova KPI kartica (izginila) — LIVE"\n'
    'echo "--- R308 MANDATORY — API I/O MEJA: HARMONIZIRANE OPOZORILNE POVRŠINE (LIVE — regresija) ---"',
    "R309 blok + R308 regresija žig",
)

# --- 6. Čistost: nič R308 meja-ostankov (razred znakov, brez samozadetka) ---
import re
ostanki = [l for l in s.splitlines() if re.search(r"\bR308_COMMIT_ISO\b|\bR308_PUSH\b", l)]
if ostanki:
    print("FAIL-CLOSED: ostanki R308 mejnih spremenljivk:")
    for l in ostanki[:5]:
        print("  ", l[:120])
    sys.exit(1)
print("OK   [čistost] nič R308 mejnih ostankov (razred znakov preverba ne ujame sebe)")

open(DST, "w", encoding="utf-8").write(s)
print(f"OK: {DST} ({len(s.splitlines())} vrstic)")
