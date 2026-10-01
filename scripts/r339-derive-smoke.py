#!/usr/bin/env python3
# R339 — derive r339-run-smoke.sh iz r338 generacije (KOLIZIJA #13).
# VSAKA zamenjava je NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312).
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r338-run-smoke.sh')
DOL = Path('/home/z/my-project/scripts/r339-run-smoke.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava (R338 FAZA 3 → R339 val 25; FAZA 3 opis ostane kot dedovina) ──
zam('''# R338 dimni test (vzorec r273/r296-r337) — standalone :3100 + javni health +
# prijavna rute + PWA manifest (brez DB mutacij — samo bralni pepperji).
# Potrjuje, da build z R338 spremembami (DEKOMPOZICIJA measurements-tab''',
'''# R339 dimni test (vzorec r273/r296-r338) — standalone :3100 + javni health +
# prijavna rute + PWA manifest (brez DB mutacij — samo bralni pepperji).
# Potrjuje, da build z R339 spremembami (STIL val 25 — hover parity
# revizijske sledi: EN VIR auditActionTitles v labels.ts + badge title +
# cursor-help — vzorec R280 tip badge + R281 sync žig; 0 novih hex;
# KOLIZIJA #13: samo val 25 plast ohranjena iz moje supersededirane izvedbe;
# R338 dedovina: DEKOMPOZICIJA measurements-tab''')

# ── 2. Sekret + strežniški log (sledita generaciji) ──
zam('R338-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!',
    'R339-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!', 1)
zam('/tmp/R338-server-smoke.log', '/tmp/R339-server-smoke.log', 1)

# ── 3. Poti ──
zam('/tmp/r338-', '/tmp/r339-', 7)

# ── 4. Footer ──
zam('echo "--- R338 SMOKE KONEC ---"', 'echo "--- R339 SMOKE KONEC ---"', 1)

# ── 5. čistost ──
if '/tmp/r338-' in text or '/tmp/R338-' in text or 'R338-smoke' in text:
    print('FAIL-CLOSED: R338 ostanki v r339-run-smoke.sh')
    sys.exit(1)
if text.count('R339 SMOKE KONEC') != 1:
    print('FAIL-CLOSED: R339 footer manjka')
    sys.exit(1)

DOL.write_text(text, encoding='utf-8')
print('r339-run-smoke.sh: OK (derive iz r338)')
