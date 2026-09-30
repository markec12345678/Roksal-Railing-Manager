#!/usr/bin/env python3
# R308 — derive r308-prod-qa.sh IZ r307-prod-qa.sh (UNION harvest dedovan;
# R309 prva naloga). LEKCIJA R307 3: grep čistost preverba uporablja RAZRED
# ZNAKOV ('R30[7]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).
# Vsaka zamenjava MORA biti potrjena (grep -c) po generiranju (lekcija R303 2).
import sys

SRC = "/home/z/my-project/scripts/r307-prod-qa.sh"
DST = "/home/z/my-project/scripts/r308-prod-qa.sh"

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

# --- 1. Header (do set -u) ---
header_old = s[:s.index('set -u')]
header_new = """#!/bin/bash
# R308 — PRVA naloga (worklog R309): potrditi R290+…+R307+R308 SKUPAJ na produ.
#   Z0  build-guard (EPOCH): health build > R308 commit čas (git log —
#       self-contained meja; push sledi commitu v sekundah, zato je commit-čas
#       STROŽJA in pravilna meja: med commitom in pushom ni Vercel builda)
#       → R308 deploy potrjen (nosi R290+…+R308 — kanon R280/R284),
#       polni LIVE needle teki (R308 API I/O meja harmonizacija ×7 + R307 Konflikti dokaz ×11 +
#       R306 Oprema cikel dokaz ×11 + R305 Tedenski pregled po dnevih ×11 + R304 Vodja tedenski CSV ×11 +
#       R303 Vodja tedenski PDF ×11 + R302 Konflikti PDF ×11 + R301 Konflikti CSV ×11 + R300 mini ×11 +
#       R299 ICS po ekipah ×16 + R298 ICS ×13 + R297 Oprema CSV ×10 + R296 ICS ×11 + R295 ×9 + regresije).
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
#   Z2  čanki needleji: R308 ×7 + R307 ×11 + R306 ×11 + R295 ×8 + R294 ×9 +
#       R293 ×8 + R292 ×8 + R291 ×8 + R290 ×8 + R289/R288/… regresije.
#   Z3  v99 sync gate (R274). ZERO-MUTACIJA.
#   LEKCIJA R307 3 (derive): grep čistost preverba uporablja RAZRED ZNAKOV
#   ('R30[7]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).
"""
s = header_new + s[s.index('set -u'):]

# --- 2. Boundary spremenljivke ---
sub_all("R307_COMMIT_ISO", "R308_COMMIT_ISO", "R307_COMMIT_ISO→R308")
sub_once("awk -F' ::: ' '$2 ~ /^R307 —/ {print $1; exit}'", "awk -F' ::: ' '$2 ~ /^R308 —/ {print $1; exit}'", "awk R307—→R308—")
sub_all("R307_PUSH", "R308_PUSH", "R307_PUSH→R308_PUSH", expect_min=5)

# --- 3. grep čistost preverba (razred znakov — brez samozadetka) ---
sub_once("""if grep -qE 'R30[6]_PUSH|R306[_]COMMIT_ISO' "$0"; then
  echo "FAIL-CLOSED: derive ostanki R306 PUSH/COMMIT meje v r307-prod-qa.sh — popravi pred tekom"
  exit 1
fi
echo "derive čistost: OK (nič R306 boundary ostankov — razred znakov, brez samozadetka)\"""",
"""if grep -qE 'R30[7]_PUSH|R307[_]COMMIT_ISO' "$0"; then
  echo "FAIL-CLOSED: derive ostanki R307 PUSH/COMMIT meje v r308-prod-qa.sh — popravi pred tekom"
  exit 1
fi
echo "derive čistost: OK (nič R307 boundary ostankov — razred znakov, brez samozadetka)\"""",
"grep čistost preverba R306→R307")

# --- 4. EPOCH guard + deploy besedilo ---
sub_once('echo "R307 meja (commit čas, UTC): $R308_PUSH"', 'echo "R308 meja (commit čas, UTC): $R308_PUSH"', "meja echo")
sub_once("██ ESKALACIJA — PROD STALE: build $BUILD ≤ R307 commit meja ($R308_PUSH).",
         "██ ESKALACIJA — PROD STALE: build $BUILD ≤ R308 commit meja ($R308_PUSH).", "stale banner meja")
sub_once("██ R306 (ŽIVO) + R307 pričakujeta SKUPNI deploy (kanon R280/R284).",
         "██ R307 (ŽIVO) + R308 pričakujeta SKUPNI deploy (kanon R280/R284).", "stale banner generacije")
sub_once('echo "R307 deploy potrjen (build $BUILD > R307 commit meja $R308_PUSH) — polni LIVE teki"',
         'echo "R308 deploy potrjen (build $BUILD > R308 commit meja $R308_PUSH) — polni LIVE teki"', "deploy potrjen echo")
sub_once('echo "OPOMBA: deploy je nosil VSE generacije (R290+…+R307 — kanon R280/R284)"',
         'echo "OPOMBA: deploy je nosil VSE generacije (R290+…+R308 — kanon R280/R284)"', "OPOMBA generacije")

# --- 5. /tmp poti ---
sub_all("/tmp/r307-", "/tmp/r308-", "/tmp/r307-→/tmp/r308-", expect_min=10)

# --- 6. Z2 header inventar ---
sub_once('echo "=== Z2: čanki — klient needleji (R307 ×11 + R306 ×11 + R295 ×9 LIVE + R294 ×9 + R293 ×8 + R292 ×8 + R291 ×8 + R290 ×8 + regresije + must_miss) ==="',
         'echo "=== Z2: čanki — klient needleji (R308 ×7 + R307 ×11 + R306 ×11 + R295 ×9 LIVE + R294 ×9 + R293 ×8 + R292 ×8 + R291 ×8 + R290 ×8 + regresije + must_miss) ==="',
         "Z2 header inventar")

# --- 7. R308 needle blok — vstavljen PRED R307 blok; R307 oznaka → regresija ---
r308_block = """echo "--- R308 MANDATORY — API I/O MEJA: HARMONIZIRANE OPOZORILNE POVRŠINE (LIVE — PRVA naloga R309) ---"
need "border-roksal-amber/60 text-roksal-ink hover:bg-roksal-amber/10" "R308 punch-list Ponovni poskus gumb (nov žetonski razred) — LIVE"
need "bg-roksal-amber/10 px-3 py-2 ring-1 ring-roksal-amber/30" "R308 site-survey opozorila povzetek (nov žetonski razred) — LIVE"
need "rounded-lg border border-roksal-amber/40 bg-roksal-amber/10 p-2 text-2xs text-roksal-ink" "R308 invoice-manager mesečna napaka (nov žetonski razred) — LIVE"
need "px-2.5 py-2 text-[11px] font-medium text-roksal-ink" "R308 weather-card demo opozorilo (nov žetonski razred) — LIVE"
need "Zapisnika ni bilo mogoče naložiti" "R308 regresa: napaka nalaganja zapisnika (besedilo ohranjeno) — LIVE"
need "Prihodki po mesecih iz teh podatkov ni mogoče razčleniti" "R308 regresa: fail-verbose razčlenitvena napaka — LIVE"
need "Demo podatki — živi vremenski servis trenutno ni dosegljiv." "R308 regresa: demo vreme opozorilo (iskrena resnica) — LIVE"
"""
sub_once('echo "--- R307 MANDATORY — KONFLIKTNI DOKAZ NA ZASLONU (LIVE — PRVA naloga R308) ---"',
         r308_block + 'echo "--- R307 MANDATORY — KONFLIKTNI DOKAZ NA ZASLONU (LIVE — regresija) ---"',
         "R308 blok vstavitev + R307 oznaka")

# --- 8. must_miss: dopolniti R308 (polni vsebnik — lekcija R308: natančno) ---
sub_once('must_miss "TODO-R307" "R307 — brez razvojnih ostankov (izginil)"',
         'must_miss "TODO-R308" "R308 — brez razvojnih ostankov (izginil)"\n'
         'must_miss "TODO-R307" "R307 — brez razvojnih ostankov (izginil)"',
         "must_miss dopolnitev R308")

# --- 9. Finalni banner ---
sub_once('echo "=== R307 PROD QA — R290+…+R307 ŽIVO SKUPAJ ==="',
         'echo "=== R308 PROD QA — R290+…+R308 ŽIVO SKUPAJ ==="', "finalni banner")

# --- 10. Stale banner inventar ---
sub_once("██ vse generacije — needleji pokrijejo R290+…+R307 — kanon R280/R284).",
         "██ vse generacije — needleji pokrijejo R290+…+R308 — kanon R280/R284).", "stale banner inventar")

open(DST, "w", encoding="utf-8").write(s)
print(f"\nNAPISANO: {DST} ({len(s)} bajtov)")

# --- 11. Potrditve ---
import subprocess
def sh(*args):
    return subprocess.run(args, capture_output=True, text=True).stdout.strip()

checks = [
    (f"grep -c 'R308_PUSH' {DST}", lambda n: int(n) >= 5, "R308_PUSH >= 5"),
    (f"grep -c 'TODO-R308' {DST}", lambda n: int(n) == 1, "TODO-R308 must_miss = 1"),
    (f"grep -c '/tmp/r308-' {DST}", lambda n: int(n) >= 10, "/tmp/r308- >= 10"),
    (f"grep -c 'border-roksal-amber/60 text-roksal-ink' {DST}", lambda n: int(n) >= 1, "R308 needle blok prisoten"),
    (f"grep -cE 'R30[7]_PUSH' {DST}", lambda n: int(n) == 0, "NIČ R307_PUSH ostankov (razred znakov — brez samozadetka)"),
    (f"grep -c 'R307_COMMIT_ISO' {DST}", lambda n: int(n) == 0, "NIČ R307_COMMIT_ISO ostankov"),
    (f"grep -c '/tmp/r307-' {DST}", lambda n: int(n) == 0, "NIČ /tmp/r307- ostankov"),
    (f"grep -c 'TODO-R307' {DST}", lambda n: int(n) == 1, "TODO-R307 must_miss ohranjen = 1"),
]
ok = True
for cmd, pred, label in checks:
    out = sh("bash", "-c", cmd) or "0"
    good = pred(out)
    print(("OK   " if good else "FAIL ") + f"[{label}] = {out}")
    ok = ok and good
print("\nDERIVE ČISTOST: " + ("VSE ZELENE — r308-prod-qa.sh pripravljen (R309 prva naloga)" if ok else "FAIL-CLOSED"))
sys.exit(0 if ok else 1)
