#!/usr/bin/env python3
# R308 — derive r307-prod-qa.sh IZ r306-prod-qa.sh (UNION harvest dedovan).
#   LEKCIJA R306 2 + R307 3: derive transformacija MORA imeti grep-preverbo
#   ostankov starega imena PRED tekom — in preverba sama uporablja RAZRED
#   ZNAKOV ('R30[6]_PUSH') da ne ujame svojega vzorca (samozadetek past).
#   Vsaka zamenjava MORA biti potrjena (grep -c) po generiranju (lekcija R303 2).
import re, sys

SRC = "/home/z/my-project/scripts/r306-prod-qa.sh"
DST = "/home/z/my-project/scripts/r307-prod-qa.sh"

s = open(SRC, encoding="utf-8").read()
orig = s

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

# --- 1. Header (prvih 15 vrstic) — popolnoma prepisan ---
header_old = s[:s.index('set -u')]
header_new = """#!/bin/bash
# R307 — PRVA naloga (worklog R308): potrditi R290+…+R306+R307 SKUPAJ na produ.
#   Z0  build-guard (EPOCH): health build > R307 commit čas (git log —
#       self-contained meja; push sledi commitu v sekundah, zato je commit-čas
#       STROŽJA in pravilna meja: med commitom in pushom ni Vercel builda)
#       → R307 deploy potrjen (nosi R290+…+R307 — kanon R280/R284),
#       polni LIVE needle teki (R307 Konflikti dokaz na zaslonu ×11 + R306 Oprema cikel dokaz ×11 +
#       R305 Tedenski pregled po dnevih ×11 + R304 Vodja tedenski CSV po ekipah ×11 +
#       R303 Vodja tedenski PDF po ekipah ×11 + R302 Konflikti PDF ×11 + R301 Konflikti CSV ×11 +
#       R300 Konfliktna mini ×11 + R299 Tedenski ICS po ekipah ×16 + R298 Tedenski ICS ×13 +
#       R297 Oprema CSV ×10 + R296 ICS ×11 + R295 ×9 + regresije).
#       build ≤ meja → **ESKALACIJA veja** (kanon R258: prod stale ni koda-bug
#       — lokalni buildi ✓; needleji bi lažno FAILali). Izvede se ISKREN
#       stale-dokaz: R289/R288/R287/R227 LIVE needleji (zdrav vzorec stale
#       builda) + R290/R291/R292/R293/R294 pilli LIVE (pogojno po EPOCH) +
#       Z1b + Z3 (ZERO-MUTACIJA). ZERO must_miss v stale veji —
#       skew protection lekcija R294: pill-level must_miss je vrstno ranljivo
#       po pushu; avtoritativni detektor = EPOCH build-guard.
#       EXIT=0 z ESKALACIJA žigom — runda nadaljuje lokalno, eskalacija gre
#       LASTNIKU (Vercel dashboard — stuck/limit).
#   Z1  meritve tab ŽIVO — sync žig POGOJNO (kanon r277).
#   Z1b verzije ruta 404 + 'Meritev ne obstaja' (R276+ regresa). ZERO-MUTACIJA.
#   Z1c zvonček POGOJNI DOM probe + Z1d presežek note POGOJNI (R287/R289).
#   Z2  čanki needleji: R307 ×11 + R306 ×11 + R295 ×8 + R294 ×9 + R293 ×8 +
#       R292 ×8 + R291 ×8 + R290 ×8 + R289/R288/… regresije.
#   Z3  v99 sync gate (R274). ZERO-MUTACIJA.
#   LEKCIJA R307 3 (derive): grep čistost preverba uporablja RAZRED ZNAKOV
#   ('R30[6]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).
"""
s = header_new + s[s.index('set -u'):]

# --- 2. Boundary spremenljivke ---
sub_all("R306_COMMIT_ISO", "R307_COMMIT_ISO", "R306_COMMIT_ISO→R307")
sub_once("awk -F' ::: ' '$2 ~ /^R306 —/ {print $1; exit}'", "awk -F' ::: ' '$2 ~ /^R307 —/ {print $1; exit}'", "awk R306—→R307—")
sub_all("R306_PUSH", "R307_PUSH", "R306_PUSH→R307_PUSH", expect_min=5)

# --- 3. grep čistost preverba (razred znakov — brez samozadetka) ---
sub_once("""if grep -qE 'R30[5]_PUSH|R305[_]COMMIT_ISO' "$0"; then
  echo "FAIL-CLOSED: derive ostanki R305 PUSH/COMMIT meje v r306-prod-qa.sh — popravi pred tekom"
  exit 1
fi
echo "derive čistost: OK (nič R305 boundary ostankov)\"""",
"""if grep -qE 'R30[6]_PUSH|R306[_]COMMIT_ISO' "$0"; then
  echo "FAIL-CLOSED: derive ostanki R306 PUSH/COMMIT meje v r307-prod-qa.sh — popravi pred tekom"
  exit 1
fi
echo "derive čistost: OK (nič R306 boundary ostankov — razred znakov, brez samozadetka)\"""",
"grep čistost preverba R305→R306")

# --- 4. EPOCH guard + deploy detekcija besedilo ---
sub_once('echo "R306 meja (commit čas, UTC): $R307_PUSH"', 'echo "R307 meja (commit čas, UTC): $R307_PUSH"', "meja echo")
sub_once("██ ESKALACIJA — PROD STALE: build $BUILD ≤ R306 commit meja ($R307_PUSH).",
         "██ ESKALACIJA — PROD STALE: build $BUILD ≤ R307 commit meja ($R307_PUSH).", "stale banner meja")
sub_once("██ R305 (ŽIVO) + R306 pričakujeta SKUPNI deploy (kanon R280/R284).",
         "██ R306 (ŽIVO) + R307 pričakujeta SKUPNI deploy (kanon R280/R284).", "stale banner generacije")
sub_once('echo "R306 deploy potrjen (build $BUILD > R306 commit meja $R307_PUSH) — polni LIVE teki"',
         'echo "R307 deploy potrjen (build $BUILD > R307 commit meja $R307_PUSH) — polni LIVE teki"', "deploy potrjen echo")
sub_once('echo "OPOMBA: deploy je nosil VSE generacije (R290+…+R306 — kanon R280/R284)"',
         'echo "OPOMBA: deploy je nosil VSE generacije (R290+…+R307 — kanon R280/R284)"', "OPOMBA generacije")

# --- 5. /tmp poti ---
sub_all("/tmp/r306-", "/tmp/r307-", "/tmp/r306-→/tmp/r307-", expect_min=10)

# --- 6. Z2 header needle inventar ---
sub_once('echo "=== Z2: čanki — klient needleji (R295 ×9 LIVE + R294 ×9 + R293 ×8 + R292 ×8 + R291 ×8 + R290 ×8 + regresije + must_miss) ==="',
         'echo "=== Z2: čanki — klient needleji (R307 ×11 + R306 ×11 + R295 ×9 LIVE + R294 ×9 + R293 ×8 + R292 ×8 + R291 ×8 + R290 ×8 + regresije + must_miss) ==="',
         "Z2 header inventar")

# --- 7. R307 needle blok — vstavljen PRED R306 blok; R306 oznaka → regresija ---
r307_block = """echo "--- R307 MANDATORY — KONFLIKTNI DOKAZ NA ZASLONU (LIVE — PRVA naloga R308) ---"
need "konflikti-dokaz" "R307 blok testid (dokaz parov) — LIVE"
need "konfliktiDokaz: " "R307 lib graditelj prek TypeError STRING kanona (R302 lekcija 1) — LIVE"
need "Dokazani pari prekrivanj ekipe" "R307 aria-label (blok) — LIVE"
need "Dokazani pari prekrivanj" "R307 naslov (vidno besedilo) — LIVE"
need "Pregledanih " "R307 sklep števec (WYSIWYG s CSV meta/PDF KPI) — LIVE"
need "ISTI pari in ISTI vrstni red kot Konflikti CSV in Konflikti PDF" "R307 definicijski naslov EN VIR pravilo — LIVE"
need "ZASLON = takoj na pogled" "R307 definicijski naslov razlika medija — LIVE"
need "poli-odprto pravilo" "R307 definicijski naslov pravilo — LIVE"
need "nazaj-na-nazaj" "R307 definicijski naslov konkretno pravilo — LIVE"
need "Pregledanih = aktivni termini" "R307 sklep title obsega resnica — LIVE"
need "font-medium text-roksal-red" "R307 ekipa RED žig (pariteta CSV/PDF) — LIVE"
"""
sub_once('echo "--- R306 MANDATORY — OPREMA CIKEL DOKAZ NA ZASLONU (LIVE — PRVA naloga R307) ---"',
         r307_block + 'echo "--- R306 MANDATORY — OPREMA CIKEL DOKAZ NA ZASLONU (LIVE — regresija) ---"',
         "R307 blok vstavitev + R306 oznaka")

# --- 8. must_miss: dopolniti R305/R306/R307 ---
sub_once('must_miss "TODO-R301" "R301 — brez razvojnih ostankov (izginil)"',
         'must_miss "TODO-R307" "R307 — brez razvojnih ostankov (izginil)"\n'
         'must_miss "TODO-R306" "R306 — brez razvojnih ostankov (izginil)"\n'
         'must_miss "TODO-R305" "R305 — brez razvojnih ostankov (izginil)"\n'
         'must_miss "TODO-R301" "R301 — brez razvojnih ostankov (izginil)"',
         "must_miss dopolnitev R305/R306/R307")

# --- 9. Finalni banner ---
sub_once('echo "=== R306 PROD QA — R290+…+R306 ŽIVO SKUPAJ ==="',
         'echo "=== R307 PROD QA — R290+…+R307 ŽIVO SKUPAJ ==="', "finalni banner")

# --- 10. Stale banner needle inventar omenja R301 — dopolni do R307 ---
sub_once("██ vse generacije — needleji pokrijejo R290+R291+R292+R293+R294+R295+R296+R297+R298+R299+R300+R301).",
         "██ vse generacije — needleji pokrijejo R290+…+R307 — kanon R280/R284).", "stale banner inventar")

open(DST, "w", encoding="utf-8").write(s)
print(f"\nNAPISANO: {DST} ({len(s)} bajtov, izvirnik {len(orig)} bajtov)")

# --- 11. Potrditve (lekcija R303 2: vsaka zamenjava potrjena) ---
import subprocess
def sh(*args):
    return subprocess.run(args, capture_output=True, text=True).stdout.strip()

checks = [
    (f"grep -c 'R307_PUSH' {DST}", lambda n: int(n) >= 5, "R307_PUSH >= 5"),
    (f"grep -c 'TODO-R307' {DST}", lambda n: int(n) == 1, "TODO-R307 must_miss = 1"),
    (f"grep -c 'TODO-R306' {DST}", lambda n: int(n) == 1, "TODO-R306 must_miss = 1"),
    (f"grep -c 'TODO-R305' {DST}", lambda n: int(n) == 1, "TODO-R305 must_miss = 1"),
    (f"grep -c '/tmp/r307-' {DST}", lambda n: int(n) >= 10, "/tmp/r307- >= 10"),
    (f"grep -c 'konflikti-dokaz' {DST}", lambda n: int(n) >= 1, "R307 needle blok prisoten"),
    (f"grep -cE 'R30[6]_PUSH' {DST}", lambda n: int(n) == 0, "NIČ R306_PUSH ostankov (preverba sama uporablja razred znakov)"),
    (f"grep -c 'R306_COMMIT_ISO' {DST}", lambda n: int(n) == 0, "NIČ R306_COMMIT_ISO ostankov"),
    (f"grep -c '/tmp/r306-' {DST}", lambda n: int(n) == 0, "NIČ /tmp/r306- ostankov"),
    (f"grep -c 'R30[5]_PUSH' {DST}", lambda n: int(n) == 0, "NIČ R305 čistost preverbe ostankov"),
]
ok = True
for cmd, pred, label in checks:
    out = sh("bash", "-c", cmd) or "0"
    good = pred(out)
    print(("OK   " if good else "FAIL ") + f"[{label}] = {out}")
    ok = ok and good
print("\nDERIVE ČISTOST: " + ("VSE ZELENE — r307-prod-qa.sh pripravljen" if ok else "FAIL-CLOSED"))
sys.exit(0 if ok else 1)
