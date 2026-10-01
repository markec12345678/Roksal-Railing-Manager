#!/usr/bin/env python3
# R339 — derive r339-build-needles.sh iz r338 generacije (KOLIZIJA #13).
# VSAKA zamenjava je NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312).
# R339 dev = STIL val 25 → NOV needle: revizijska sled title EN VIR
# (measurements chunk); R338 premik-needleji ×8 ostanejo regresija.
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r338-build-needles.sh')
DOL = Path('/home/z/my-project/scripts/r339-build-needles.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava (R338 FAZA 3 → R339 val 25 + KOLIZIJA #13) ──
zam('''# R338 — build needleji: DEKOMPOZICIJA measurements-tab FAZA 3''',
'''# R339 — build needleji: STIL val 25 (hover parity revizijske sledi — EN VIR
# auditActionTitles v labels.ts + badge title + cursor-help — vzorec R280/R281;
# 0 novih hex; KOLIZIJA #13: moja FAZA 3 izvedba SUPERSEDIRANA od njihove
# R338 [6a333ae] — ohranjena samo val 25 plast). Dedovina R338 DEKOMPOZICIJA
# measurements-tab FAZA 3''')

# ── 2. R339 needle blok PO R338 premik bloku ──
zam('''must_miss "TODO-R338" "R338 — brez razvojnih ostankov"''',
'''must_miss "TODO-R338" "R338 — brez razvojnih ostankov"
echo "--- R339 MANDATORY — STIL val 25: hover parity revizijske sledi (EN VIR auditActionTitles v labels.ts, vzorec R280/R281) ---"
need_static "Revizija: Dodano — nova meritev vnesena v ta projekt" "R339 val 25 revizijska sled title ADD (measurements chunk)"
must_miss "TODO-R339" "R339 — brez razvojnih ostankov"''')

# ── 3. Števec lastnih needlejev ──
zam('echo "R338 lastni needleji: FAIL=$FAIL (8 premik + 1 must_miss)"',
    'echo "R339 lastni needleji: FAIL=$FAIL (1 val 25 + 1 must_miss; R338 premik ×8 dedovani)"', 1)

# ── 4. Poti ──
zam('/tmp/r338-build-chunks', '/tmp/r339-build-chunks', 1)

# ── 5. Footer ──
zam('if [ "$FAIL" = "1" ]; then echo "R338 NEEDLEJI FAIL"; exit 1; fi',
    'if [ "$FAIL" = "1" ]; then echo "R339 NEEDLEJI FAIL"; exit 1; fi', 1)
zam('=== R338 BUILD NEEDLES VSE OK ===', '=== R339 BUILD NEEDLES VSE OK ===', 1)

# ── 6. čistost ──
if '/tmp/r338-' in text:
    print('FAIL-CLOSED: /tmp/r338- ostanki v r339-build-needles.sh')
    sys.exit(1)
if text.count('TODO-R338') != 1 or text.count('TODO-R339') != 1:
    print('FAIL-CLOSED: TODO žigi niso pravilno dedovani/vstavljeni')
    sys.exit(1)
if 'need_static "Revizija: Dodano' not in text:
    print('FAIL-CLOSED: val 25 needle manjka')
    sys.exit(1)

DOL.write_text(text, encoding='utf-8')
print('r339-build-needles.sh: OK (derive iz r338)')
