#!/usr/bin/env python3
# R337 — derive r337-prod-qa.sh iz r336 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije: EPOCH guard (R336 → R337 meja), guard class (R335 → R336
# ostanki), TABS var, R337 needle blok (LIVE veja), __rNNNval, poti, footer.
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r336-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r337-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Guard class (R336 ostanki v r337 — LEKCIJA R307 3: razred znakov) ──
zam("""if grep -qE 'R335[_]COMMIT_ISO|R335[_]PUSH|R335[_]TABS' "$0"; then
  echo "FAIL-CLOSED: derive ostanki R335 PUSH/COMMIT/TABS meje v r336-prod-qa.sh — popravi pred tekom"
  exit 1
fi
echo "derive čistost: OK (nič R335 PUSH/COMMIT/TABS ostankov — razred znakov, brez samozadetka)\"""",
"""if grep -qE 'R336[_]COMMIT_ISO|R336[_]PUSH|R336[_]TABS' "$0"; then
  echo "FAIL-CLOSED: derive ostanki R336 PUSH/COMMIT/TABS meje v r337-prod-qa.sh — popravi pred tekom"
  exit 1
fi
echo "derive čistost: OK (nič R336 PUSH/COMMIT/TABS ostankov — razred znakov, brez samozadetka)\"""")

# ── 2. TABS var ──
zam('R336_TABS', 'R337_TABS', 3)

# ── 3. EPOCH meja (R336 → R337 commit čas — self-contained git log) ──
zam('R336_COMMIT_ISO', 'R337_COMMIT_ISO', 3)
zam('/^R336 —/', '/^R337 —/', 1)
zam('R336 commita ni v git zgodovini', 'R337 commita ni v git zgodovini', 1)
zam('R336_PUSH', 'R337_PUSH', 5)
zam('R336 meja (commit čas, UTC):', 'R337 meja (commit čas, UTC):', 1)
zam('R336 deploy potrjen (build $BUILD > R336 commit meja $R337_PUSH) — polni LIVE teki',
    'R337 deploy potrjen (build $BUILD > R337 commit meja $R337_PUSH) — polni LIVE teki', 1)

# ── 4. ESKALACIJA banner (UNION harvest seznam +R337) ──
zam('██ ESKALACIJA — PROD STALE: build $BUILD ≤ R336 commit meja ($R337_PUSH).',
    '██ ESKALACIJA — PROD STALE: build $BUILD ≤ R337 commit meja ($R337_PUSH).', 1)
zam('R334+R335+R336 pričakujejo SKUPNI deploy', 'R334+R335+R336+R337 pričakujejo SKUPNI deploy', 1)
zam('██ R336 PROD QA — ESKALACIJA POTRJENA IN DOKAZANA:',
    '██ R337 PROD QA — ESKALACIJA POTRJENA IN DOKAZANA:', 1)

# ── 5. R337 needle blok (LIVE veja) PO R336 bloku ──
zam('''need "Izvozi sistem zdravje kot CSV" "R336 sistem zdravje CSV gumb aria (sistem-zdravje-card chunk) — LIVE"
need "sistem-zdravje-csv-pill" "R336 sistem zdravje CSV gumb testid (sistem-zdravje-card chunk) — LIVE"
must_miss "TODO-R336" "R336 — brez razvojnih ostankov"''',
'''need "Izvozi sistem zdravje kot CSV" "R336 sistem zdravje CSV gumb aria (sistem-zdravje-card chunk) — LIVE"
need "sistem-zdravje-csv-pill" "R336 sistem zdravje CSV gumb testid (sistem-zdravje-card chunk) — LIVE"
must_miss "TODO-R336" "R336 — brez razvojnih ostankov"
need "Izvozi pregled AI rabe kot CSV" "R337 AI raba pregled CSV gumb aria (vodja chunk) — LIVE"
need "ai-raba-csv-pill" "R337 AI raba pregled CSV gumb testid (vodja chunk) — LIVE"
must_miss "TODO-R337" "R337 — brez razvojnih ostankov"''')

# ── 6. Z2b val var (sledi generaciji: __r335val → __r336val) ──
zam('__r335val', '__r336val', 4)

# ── 7. Poti ──
zam('/tmp/r336-', '/tmp/r337-', 36)

# ── 8. Footer (R336 PROD QA ×2: ESKALACIJA + LIVE footer) ──
zam('=== R336 PROD QA — R290+…+R336 ŽIVO SKUPAJ ===',
    '=== R337 PROD QA — R290+…+R337 ŽIVO SKUPAJ ===', 1)

# ── 9. čistost: nič R336 PUSH/COMMIT/TABS/function ostankov, nič __r335val ──
import re
if re.search(r'R336[_](COMMIT_ISO|PUSH|TABS)', text):
    print('FAIL-CLOSED: R336_PUSH/COMMIT_ISO/TABS ostanki v r337-prod-qa.sh')
    sys.exit(1)
if '__r335val' in text:
    print('FAIL-CLOSED: __r335val ostanki v r337-prod-qa.sh')
    sys.exit(1)
n = text.count('/tmp/r336-')
if n != 0:
    print(f'FAIL-CLOSED: {n} /tmp/r336- ostankov v r337-prod-qa.sh')
    sys.exit(1)
if 'TODO-R336"' in text and text.count('TODO-R336') != 1:
    print('FAIL-CLOSED: R336 needle blok ni pravilno dedovan (TODO-R336 mora ostati ×1 kot regresija)')
    sys.exit(1)

DOL.write_text(text, encoding='utf-8')
print('r337-prod-qa.sh: OK (derive iz r336)')
