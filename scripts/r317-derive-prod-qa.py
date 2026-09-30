#!/usr/bin/env python3
# R317 — derive r317-prod-qa.sh iz r316-prod-qa.sh (generacijski vzorec
# r305→…→r316). VSAKA zamenjava je NATANKO ena-n-točkovna (fail-closed:
# napačno število POJAVITEV → izpisek + exit 1; LEKCIJA R312/R314/R315/R316:
# štetje na POJAVITVE, ne grep -c vrstice; LEKCIJA R316 (stari r31xval): tudi
# window val spremenljivka v Z2b mora slediti generaciji).
# Transformacije:
#   1. Glava: R317 zapis (47. člen — izvoz avtomatizacijskega audita CSV +
#      STIL val 8 izrecni focus-visible ring žetoni izvozne družine)
#   2. EPOCH: R316_COMMIT_ISO/R316_PUSH → R317_*, awk '^R316 —' → '^R317 —',
#      guard R31[5] → R31[6], meja/deploy oznake
#   3. Generacijske poti: /tmp/r316- → /tmp/r317- (36) + stari val →
#      novi val (4 — LEKCIJA R316: val spremenljivka NI izjema)
#   4. R317 needle blok: splice PRED Z2b (CSV izvoz aria/title + STIL val 8
#      amber ring par + TODO-R317; deal-pipeline/rate-limit/site-survey
#      ring popravki = BUILD nivo needleji — LEKCIJA R316 signature)
#   5. Izhodna-stran asercija (LEKCIJA R310 5/6)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r316-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r317-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('# R316 — PRVA naloga (worklog R316): potrditi R290+…+R315+R316 SKUPAJ na produ.',
    '# R317 — PRVA naloga (worklog R317): potrditi R290+…+R316+R317 SKUPAJ na produ.\n'
    '#   🆕 R317 POPRAVKA QA ORODJJA (prvi LIVE tek r316-prod-qa — LEKCIJA R314 1\n'
    '#   kanon: prvi LIVE tek nove generacije je prvi tek novih needlejev;\n'
    '#   aplikacija ZDRAVA — dokazana z živo sejo + vir + build):\n'
    '#   (a) Z2b window val spremenljivka sledi generaciji (stari r31[45]val →\n'
    '#       novi val — derive LEKCIJA: val ni izjema; čista higiena);\n'
    '#   (b) R316 signature hint needle = build-nivo SAMO (R316 glava je že\n'
    '#       povedala: čank ni v harvestu) — iz harvest needlejev odstranjen,\n'
    '#       need_static r316-build-needles.sh ostaja avtoritativni dokaz.')
zam('#   Z0  build-guard (EPOCH): health build > R315 commit čas (git log —',
    '#   Z0  build-guard (EPOCH): health build > R317 commit čas (git log —')
zam('#       R280/R284), polni LIVE needle teki (R316 izvoz JSON ×2 + STIL ×5 +',
    '#       R280/R284), polni LIVE needle teki (R317 izvoz audit CSV ×3 +\n'
    '#       must_miss ×1 + R316 izvoz JSON ×2 + STIL ×5 +')
zam('#   Z2  čanki needleji: R316 ×7+6 + R315 ×21+6 + R314 ×18+6 + R313 ×4+6 + R312 ×5+3 +',
    '#   Z2  čanki needleji: R317 ×3+1 + R316 ×7+6 + R315 ×21+6 + R314 ×18+6 + R313 ×4+6 + R312 ×5+3 +')
zam("#   ('R31[5]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).",
    "#   ('R31[6]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).")

# ── 2. EPOCH + guard + oznake ──
zam('R316_TABS', 'R317_TABS', 3)
zam('R316_COMMIT_ISO', 'R317_COMMIT_ISO', 3)
zam('R316_PUSH', 'R317_PUSH', 5)
zam("awk -F' ::: ' '$2 ~ /^R316 —/ {print $1; exit}'", "awk -F' ::: ' '$2 ~ /^R317 —/ {print $1; exit}'", 1)
zam("[ -n \"$R317_COMMIT_ISO\" ] || { echo \"FAIL-CLOSED: R316 commita ni v git zgodovini — EPOCH guard brez meje\"; exit 1; }",
    "[ -n \"$R317_COMMIT_ISO\" ] || { echo \"FAIL-CLOSED: R317 commita ni v git zgodovini — EPOCH guard brez meje\"; exit 1; }", 1)
zam("if grep -qE 'R31[5]_PUSH|R315[_]COMMIT_ISO' \"$0\"; then",
    "if grep -qE 'R31[6]_PUSH|R316[_]COMMIT_ISO' \"$0\"; then", 1)
zam('echo "FAIL-CLOSED: derive ostanki R315 PUSH/COMMIT meje v r316-prod-qa.sh — popravi pred tekom"',
    'echo "FAIL-CLOSED: derive ostanki R316 PUSH/COMMIT meje v r317-prod-qa.sh — popravi pred tekom"', 1)
zam('echo "R316 meja (commit čas, UTC): $R317_PUSH"', 'echo "R317 meja (commit čas, UTC): $R317_PUSH"', 1)
zam('echo "R316 deploy potrjen (build $BUILD > R316 commit meja $R317_PUSH) — polni LIVE teki"',
    'echo "R317 deploy potrjen (build $BUILD > R317 commit meja $R317_PUSH) — polni LIVE teki"', 1)
zam('echo "OPOMBA: deploy je nosil VSE generacije (R290+…+R316 — kanon R280/R284)"',
    'echo "OPOMBA: deploy je nosil VSE generacije (R290+…+R317 — kanon R280/R284)"', 1)
zam('echo "=== Z0: prod build-guard — R316 deploy detekcija (EPOCH primerjava) ==="',
    'echo "=== Z0: prod build-guard — R317 deploy detekcija (EPOCH primerjava) ==="', 1)
zam('echo "██ ESKALACIJA — PROD STALE: build $BUILD ≤ R316 commit meja ($R317_PUSH)."',
    'echo "██ ESKALACIJA — PROD STALE: build $BUILD ≤ R317 commit meja ($R317_PUSH)."', 1)
zam('echo "██ R316 pričakuje SKUPNI deploy (kanon R280/R284)."',
    'echo "██ R317 pričakuje SKUPNI deploy (kanon R280/R284)."', 1)
zam('echo "=== R316 PROD QA — R290+…+R316 ŽIVO SKUPAJ ==="',
    'echo "=== R317 PROD QA — R290+…+R317 ŽIVO SKUPAJ ==="', 1)

# ── Z2 LIVE echo glava: dodaj R317 + R316 števca (LEKCIJA R316: zastarela
#    oznaka R314 — zdaj popravljena vsakokrat) ──
zam('echo "=== Z2: čanki — klient needleji (R314 ×18+6 + R313 ×4+6 + R312 ×5+3 + R311 ×7+1 + R310 ×5+1 + R309 ×4+3 + R308 ×7 + R307 ×11 + R306 ×11 + R295 ×9 LIVE + R294 ×9 + R293 ×8 + R292 ×8 + R291 ×8 + R290 ×8 + regresije + must_miss) ==="',
    'echo "=== Z2: čanki — klient needleji (R317 ×3+1 + R316 ×7+5 + R315 ×21+6 + R314 ×18+6 + R313 ×4+6 + R312 ×5+3 + R311 ×7+1 + R310 ×5+1 + R309 ×4+3 + R308 ×7 + R307 ×11 + R306 ×11 + R295 ×9 LIVE + R294 ×9 + R293 ×8 + R292 ×8 + R291 ×8 + R290 ×8 + regresije + must_miss) ==="', 1)

# ── 3. Generacijske poti + Z2b val spremenljivka ──
zam('/tmp/r316-', '/tmp/r317-', 36)
zam('__r316val', '__r317val', 4)

# ── 4. R317 needle blok: splice PRED Z2b ──
SIDRO = 'echo "=== Z2b: EN VIR ŽIVO NA ŽICI (val-1 ×4 + val-3 ×9 × pokvarjen JSON → 400 z ISTO ovojnico + users 403 deny-first POZITIVNI dokaz; ZERO-MUTACIJA — guard strelja PRED db zapisom) ==="'
BLOK = '''echo "--- R317 MANDATORY — 47. člen: izvoz avtomatizacijskega audita (CSV) + STIL val 8 (LIVE) ---"
# IZVOZI družina: CSV gumb v avtomatizacija-dokaz bloku (vodja chunk) —
# deterministični CSV izvoz (EN VIR — avtomatizacijaAuditCsv prek
# avtomatizacijaPregled validacije; vitest r317-avtomatizacija-audit-csv +
# E2E Z0ao DETERMINIZEM: dva izvoza bajtno enaka). STIL val 8: IZRECNI
# focus-visible ring žetoni po IZVOZNI družini (53 gumbov; amber/50 vodja
# blok glave ×3 [dnevni R163 + JSON R316 + CSV R317] — r317-stil-val8
# STRAŽAR; deal-pipeline/rate-limit/site-survey ring-2 popravki = BUILD
# nivo needleji r317-build-needles — čanki po potrebi izven harvesta,
# LEKCIJA R316 signature: build-nivo SAMO).
need "Izvozi avtomatizacijski audit kot CSV" "R317 CSV izvoz gumb aria (vodja chunk) — LIVE"
need "kot deterministični CSV" "R317 CSV izvoz title fragment (vodja chunk) — LIVE"
need "focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2" "R317 STIL val 8 vodja amber ring par (blok glave ×3) — LIVE"
must_miss "TODO-R317" "R317 — brez razvojnih ostankov"

'''
n = text.count(SIDRO)
if n != 1:
    print(f'FAIL-CLOSED: Z2b sidro najdeno {n}× (pričakovano 1)')
    sys.exit(1)
text = text.replace(SIDRO, BLOK + SIDRO)

# ── 5. Izhodna-stran asercija ──
assert 'R317_TABS' in text and '__r317val' in text
for ostarelo in ('/tmp/r316-', '__r316val', 'R316_TABS', 'R316_COMMIT_ISO', 'R316_PUSH'):
    if ostarelo in text:
        print(f'FAIL-CLOSED: ostalo {ostarelo!r} v izhodu')
        sys.exit(1)
if 'R31[5]_PUSH|R315[_]COMMIT_ISO' in text:
    print('FAIL-CLOSED: stari guard vzorec R31[5] še v izhodu')
    sys.exit(1)

DOL.write_text(text, encoding='utf-8')
print(f'r317-prod-qa.sh zapisan ({len(text.splitlines())} vrstic)')
