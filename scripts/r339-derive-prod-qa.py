#!/usr/bin/env python3
# R339 — derive r339-prod-qa.sh iz r338 generacije (KOLIZIJA #13:
# re-derivacija iz NJIHOVE r338 po kanonu KOLIZIJE #4/R323). VSAKA zamenjava
# je NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# R339 dev = STIL val 25 (hover parity revizijske sledi — EN VIR
# auditActionTitles) → NOV needle; R338 premik-needleji ostanejo regresija.
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r338-prod-qa.sh')
DOL = Path('/home/z/my-project/scripts/r339-prod-qa.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Guard class (R337/R336 ostanki v r339 — LEKCIJA R307 3: razred znakov) ──
zam("""if grep -qE 'R33[6]_PUSH|R337[_]COMMIT_ISO' "$0"; then
  echo "FAIL-CLOSED: derive ostanki R336 PUSH/COMMIT meje v r338-prod-qa.sh — popravi pred tekom"
  exit 1
fi
echo "derive čistost: OK (nič R336 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)\"""",
"""if grep -qE 'R33[7]_PUSH|R338[_]COMMIT_ISO' "$0"; then
  echo "FAIL-CLOSED: derive ostanki R337 PUSH/COMMIT meje v r339-prod-qa.sh — popravi pred tekom"
  exit 1
fi
echo "derive čistost: OK (nič R337 PUSH/COMMIT ostankov — razred znakov, brez samozadetka)\"""")

# ── 2. TABS var ──
zam('R338_TABS', 'R339_TABS', 3)

# ── 3. EPOCH meja (R338 → R339 commit čas — self-contained git log) ──
zam('R338_COMMIT_ISO', 'R339_COMMIT_ISO', 3)
zam('/^R338 —/', '/^R339 —/', 1)
zam('R338 commita ni v git zgodovini', 'R339 commita ni v git zgodovini', 1)
zam('R338_PUSH', 'R339_PUSH', 5)
zam('R338 meja (commit čas, UTC):', 'R339 meja (commit čas, UTC):', 1)
zam('R338 deploy potrjen (build $BUILD > R338 commit meja $R339_PUSH) — polni LIVE teki',
    'R339 deploy potrjen (build $BUILD > R339 commit meja $R339_PUSH) — polni LIVE teki', 1)

# ── 4. ESKALACIJA banner (UNION harvest seznam +R339) ──
zam('██ ESKALACIJA — PROD STALE: build $BUILD ≤ R338 commit meja ($R339_PUSH).',
    '██ ESKALACIJA — PROD STALE: build $BUILD ≤ R339 commit meja ($R339_PUSH).', 1)
zam('+R337+R338 pričakujejo SKUPNI deploy', '+R337+R338+R339 pričakujejo SKUPNI deploy', 1)
zam('██ R338 PROD QA — ESKALACIJA POTRJENA IN DOKAZANA:',
    '██ R339 PROD QA — ESKALACIJA POTRJENA IN DOKAZANA:', 1)

# ── 5. R339 needle blok (val 25) PO R338 premik bloku ──
zam('''need "roksal_primary_unit" "R338 format.ts loadPrimaryUnit ključ (premik živ) — LIVE"
must_miss "TODO-R338" "R338 — brez razvojnih ostankov"''',
'''need "roksal_primary_unit" "R338 format.ts loadPrimaryUnit ključ (premik živ) — LIVE"
must_miss "TODO-R338" "R338 — brez razvojnih ostankov"
need "Revizija: Dodano — nova meritev vnesena v ta projekt" "R339 val 25 revizijska sled title ADD (measurements chunk) — LIVE"
must_miss "TODO-R339" "R339 — brez razvojnih ostankov"''')

# ── 6. Z2b val var (sledi generaciji: __r337val → __r338val) ──
zam('__r337val', '__r338val', 4)

# ── 7. Poti ──
zam('/tmp/r338-', '/tmp/r339-', 36)

# ── 8. Footer ──
zam('=== R338 PROD QA — R290+…+R338 ŽIVO SKUPAJ ===',
    '=== R339 PROD QA — R290+…+R339 ŽIVO SKUPAJ ===', 1)

# ── 9. čistost ──
import re
if re.search(r'R338[_](COMMIT_ISO|PUSH|TABS)', text):
    print('FAIL-CLOSED: R338_PUSH/COMMIT_ISO/TABS ostanki v r339-prod-qa.sh')
    sys.exit(1)
if '__r337val' in text:
    print('FAIL-CLOSED: __r337val ostanki v r339-prod-qa.sh')
    sys.exit(1)
n = text.count('/tmp/r338-')
if n != 0:
    print(f'FAIL-CLOSED: {n} /tmp/r338- ostankov v r339-prod-qa.sh')
    sys.exit(1)
if 'TODO-R338' not in text or text.count('TODO-R338') != 1:
    print('FAIL-CLOSED: R338 needle blok ni pravilno dedovan (TODO-R338 mora ostati ×1 kot regresija)')
    sys.exit(1)
if text.count('TODO-R339') != 1:
    print('FAIL-CLOSED: R339 needle blok ni vstavljen (TODO-R339 mora biti ×1)')
    sys.exit(1)

DOL.write_text(text, encoding='utf-8')
print('r339-prod-qa.sh: OK (derive iz r338)')
