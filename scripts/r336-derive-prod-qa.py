#!/usr/bin/env python3
# R336 — derive r336-prod-qa.sh iz r335 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. Glava: R336 zapis (63. člen sistem zdravje CSV) PO naslovni vrstici
#   2. EPOCH guard: R335_TABS/R335_COMMIT_ISO/R335_PUSH → R336_* + awk
#      '^R335 —' → '^R336 —'
#   3. Guard razred znakov: 'R334[_]COMMIT_ISO|R334[_]PUSH|R334[_]TABS' →
#      'R335[_]COMMIT_ISO|R335[_]PUSH|R335[_]TABS' (prejšnja generacija =
#      R335; LEKCIJA R332 6 vzorec)
#   4. Z2b dispatch variable: __r334val → __r335val (sledi generaciji)
#   5. R336 needle blok (aria + testid + must_miss) — PO R335 bloku
#   6. Bannerji + footer: R335 → R336 (+R336 v UNION seznamih)
#   7. /tmp/r335- → /tmp/r336-
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r335-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r336-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava: R336 zapis PO naslovni vrstici, PRED R335 opisom ──
zam('''# R335 — PRVA naloga (worklog R335): potrditi R290+…+R321+R322+R323+R324+R325+R326+R327+R328+R329+R330+R331+R332+R333+R334+R335 SKUPAJ na produ.
#   🆕 R335 = 62. člen issue #1 (IZVOZI družina — MESEČNO POROČILO VODJE CSV):''',
'''# R336 — PRVA naloga (worklog R336): potrditi R290+…+R321+R322+R323+R324+R325+R326+R327+R328+R329+R330+R331+R332+R333+R334+R335+R336 SKUPAJ na produ.
#   🆕 R336 = 63. člen issue #1 (IZVOZI družina — SISTEM ZDRAVJE CSV):
#   NOVI lib sistem-zdravje-csv (CSV brat zaslona SistemZdravjeCard R187/R188/
#   R189 — zadnja vodja kartica brez izvoza; EN VIR: ISTA seja zgodovina
#   [zdravje-zgodovina] + ISTI odziviStatistika izračun [divergenca nemogoča]
#   + ISTI zigIzpis klic kot kartica [fail-soft vzorec R185] + BAZA_NIZ
#   kartica UVAŽA [precedens R335 STATUS_SL: const → export, zero-behavior];
#   BREZ časa — kanon R334 brez-časa [statičen izvoz te seje: isti zgodovina
#   + build = bajtno identična datoteka, nič 'Izvoženo ob']; filename
#   sistem-zdravje.csv — brez datuma, bratska simetrija z
#   koncna-verifikacija.csv; format kanon R136 toCsv [BOM + podpičje + CRLF
#   + RFC 4180]; fail-closed kanon R299); SistemZdravjeCard: pill navy/40
#   družina [val20 Material precedens — gumb v SESTAVLJENI kartici, izven
#   vodja datoteke → amber/50 register OSTANE ×10; val8 drevo 68 → 69; val9
#   taktilni ×17 NEPREMIKNJEN — file-scoped] + legenda medija + fail-verbose
#   toast. STIL val 23.
#   🆕 R335 = 62. člen issue #1 (IZVOZI družina — MESEČNO POROČILO VODJE CSV):''')

# ── 2. EPOCH guard ──
zam('R335_TABS', 'R336_TABS', 3)
zam('''R335_COMMIT_ISO="$(git log --format='%cI ::: %s' 2>/dev/null | awk -F' ::: ' '$2 ~ /^R335 —/ {print $1; exit}')"
[ -n "$R335_COMMIT_ISO" ] || { echo "FAIL-CLOSED: R335 commita ni v git zgodovini — EPOCH guard brez meje"; exit 1; }
R335_PUSH="$(date -u -d "$R335_COMMIT_ISO" +%Y-%m-%dT%H:%M:%S)"
echo "R335 meja (commit čas, UTC): $R335_PUSH"''',
'''R336_COMMIT_ISO="$(git log --format='%cI ::: %s' 2>/dev/null | awk -F' ::: ' '$2 ~ /^R336 —/ {print $1; exit}')"
[ -n "$R336_COMMIT_ISO" ] || { echo "FAIL-CLOSED: R336 commita ni v git zgodovini — EPOCH guard brez meje"; exit 1; }
R336_PUSH="$(date -u -d "$R336_COMMIT_ISO" +%Y-%m-%dT%H:%M:%S)"
echo "R336 meja (commit čas, UTC): $R336_PUSH"''')
zam('R335_PUSH', 'R336_PUSH', 3)  # preostale uporabe (python argv + ESKALACIJA + LIVE echo; def+meja echo sta v veliki zamenjavi)
zam('$R335_COMMIT_ISO', '$R336_COMMIT_ISO', 0)  # sanity: vse že preimenovane

# ── 3. Guard razred znakov (prejšnja generacija = R335) ──
zam("""#   LEKCIJA R307 3 (derive): grep čistost preverba uporablja RAZRED ZNAKOV
#   ('R334[_]PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).""",
"""#   LEKCIJA R307 3 (derive): grep čistost preverba uporablja RAZRED ZNAKOV
#   ('R335[_]PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).""")
zam("""if grep -qE 'R334[_]COMMIT_ISO|R334[_]PUSH|R334[_]TABS' "$0"; then
  echo "FAIL-CLOSED: derive ostanki R334 PUSH/COMMIT/TABS meje v r335-prod-qa.sh — popravi pred tekom"
  exit 1
fi
echo "derive čistost: OK (nič R334 PUSH/COMMIT/TABS ostankov — razred znakov, brez samozadetka)\"""",
"""if grep -qE 'R335[_]COMMIT_ISO|R335[_]PUSH|R335[_]TABS' "$0"; then
  echo "FAIL-CLOSED: derive ostanki R335 PUSH/COMMIT/TABS meje v r336-prod-qa.sh — popravi pred tekom"
  exit 1
fi
echo "derive čistost: OK (nič R335 PUSH/COMMIT/TABS ostankov — razred znakov, brez samozadetka)\"""")

# ── 4. Z2b dispatch variable sledi generaciji ──
zam('__r334val', '__r335val', 4)

# ── 5. ESKALACIJA + LIVE bannerji + UNION seznami ──
zam('echo "██ ESKALACIJA — PROD STALE: build $BUILD ≤ R335 commit meja ($R336_PUSH)."',
    'echo "██ ESKALACIJA — PROD STALE: build $BUILD ≤ R336 commit meja ($R336_PUSH)."')
zam('echo "██ R318+R319+R320+R321+R322+R323+R324+R325+R326+R327+R328+R329+R330+R331+R332+R333+R334+R335 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest',
    'echo "██ R318+R319+R320+R321+R322+R323+R324+R325+R326+R327+R328+R329+R330+R331+R332+R333+R334+R335+R336 pričakujejo SKUPNI deploy (kanon R280/R284 — UNION harvest')
zam('echo "██ R335 PROD QA — ESKALACIJA POTRJENA IN DOKAZANA:"',
    'echo "██ R336 PROD QA — ESKALACIJA POTRJENA IN DOKAZANA:"')
zam('echo "R335 deploy potrjen (build $BUILD > R335 commit meja $R336_PUSH) — polni LIVE teki"',
    'echo "R336 deploy potrjen (build $BUILD > R336 commit meja $R336_PUSH) — polni LIVE teki"')

# ── 6. /tmp poti ──
zam('/tmp/r335-', '/tmp/r336-', 36)

# ── 7. R336 needle blok PO R335 bloku ──
zam('''need "Izvozi mesečno poročilo vodje kot CSV" "R335 mesečno poročilo CSV gumb aria (vodja chunk) — LIVE"
need "vodja-mesecni-csv-pill" "R335 mesečno poročilo CSV gumb testid (vodja chunk) — LIVE"
must_miss "TODO-R335" "R335 — brez razvojnih ostankov"''',
'''need "Izvozi mesečno poročilo vodje kot CSV" "R335 mesečno poročilo CSV gumb aria (vodja chunk) — LIVE"
need "vodja-mesecni-csv-pill" "R335 mesečno poročilo CSV gumb testid (vodja chunk) — LIVE"
must_miss "TODO-R335" "R335 — brez razvojnih ostankov"
echo "--- R336 MANDATORY — 63. člen: sistem zdravje CSV (IZVOZI družina — CSV brat zaslona SistemZdravjeCard, EN VIR seja zgodovina + odziviStatistika; LIVE) ---"
# IZVOZI: NOVI lib sistem-zdravje-csv — CSV brat zaslona SistemZdravjeCard
# (R187/R188/R189 — zadnja vodja kartica brez izvoza; EN VIR: ISTA seja
# zgodovina + ISTI odziviStatistika + ISTI zigIzpis + BAZA_NIZ kartica
# uvaža; BREZ časa — kanon R334 brez-časa; filename sistem-zdravje.csv —
# brez datuma; format kanon R136 toCsv; fail-closed kanon R299).
# SistemZdravjeCard: pill navy/40 družina (val20 Material precedens —
# izven vodja datoteke → amber/50 register OSTANE ×10; val8 drevo 69; val9
# taktilni ×17 NEPREMIKNJEN — file-scoped) + legenda medija + fail-verbose
# toast. STIL val 23.
need "Izvozi sistem zdravje kot CSV" "R336 sistem zdravje CSV gumb aria (sistem-zdravje-card chunk) — LIVE"
need "sistem-zdravje-csv-pill" "R336 sistem zdravje CSV gumb testid (sistem-zdravje-card chunk) — LIVE"
must_miss "TODO-R336" "R336 — brez razvojnih ostankov"''')

# ── 8. Footer ──
zam('echo "=== R335 PROD QA — R290+…+R335 ŽIVO SKUPAJ ==="',
    'echo "=== R336 PROD QA — R290+…+R336 ŽIVO SKUPAJ ==="')

DOL.write_text(text, encoding='utf-8')
print('r336-prod-qa.sh: OK (derive iz r335)')
