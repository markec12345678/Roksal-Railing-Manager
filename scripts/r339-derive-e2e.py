#!/usr/bin/env python3
# R339 — derive r339-e2e-browser.sh iz r338 generacije (KOLIZIJA #13).
# VSAKA zamenjava je NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312).
# R339 = val 25 runda (title = statičen EN VIR niz — pokritost needles +
# vitest; NOV Z-blok NI dodan — kanon R322/R338) → polna Z-blok regresija.
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r338-e2e-browser.sh')
DOL = Path('/home/z/my-project/scripts/r339-e2e-browser.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. R339 opomba v glavo (za #!/bin/bash — pred R310 narativ) ──
zam('''#!/bin/bash
# R310 E2E ŽIVO (lokalni :3100, ADMIN) — API I/O MEJA ŽIVO (38. člen issue #1:''',
'''#!/bin/bash
# R339 — STIL val 25 runda (hover parity revizijske sledi; KOLIZIJA #13:
#   moja FAZA 3 izvedba SUPERSEDIRANA od njihove R338 — ohranjena samo val 25
#   plast; NOV Z-blok NI dodan — kanon R322/R338: statičen EN VIR niz brez
#   nove žive interakcije; pokritost r339-build-needles + vitest r339;
#   polne E2E regresije Z0be/…/Z0ag + ZERO-MUTACIJA ODTIS).
# R310 E2E ŽIVO (lokalni :3100, ADMIN) — API I/O MEJA ŽIVO (38. člen issue #1:''')

# ── 2. Poti ──
zam('/tmp/r338-', '/tmp/r339-', 170)
zam('/tmp/R338-server-e2e.log', '/tmp/R339-server-e2e.log', 1)

# ── 3. Footer ──
zam('echo "=== R338 E2E KONEC ==="', 'echo "=== R339 E2E KONEC ==="', 1)

# ── 4. čistost: nič poti ostankov; R338 narativ ostane ×3 (glava + Z-opomba) ──
if '/tmp/r338-' in text or '/tmp/R338-' in text:
    print('FAIL-CLOSED: R338 poti ostanki v r339-e2e-browser.sh')
    sys.exit(1)
n = text.count('R338')
if n != 4:
    print(f'FAIL-CLOSED: R338 žigov {n}, pričakovano 4 (dedovina narativ ×2 + R339 opomba ×2)')
    sys.exit(1)
if 'Z0be' not in text or 'Z0bd' not in text or 'Z0bc' not in text or 'Z0bb' not in text:
    print('FAIL-CLOSED: Z-blok veriga ni dedovana')
    sys.exit(1)

DOL.write_text(text, encoding='utf-8')
print('r339-e2e-browser.sh: OK (derive iz r338)')
