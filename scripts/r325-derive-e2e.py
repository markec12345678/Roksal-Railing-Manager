#!/usr/bin/env python3
# R325 — derive r325-e2e-browser.sh iz r323-e2e-browser.sh [VZPOREDNA
# runda — 51. člen CSV zmogljivost; kolizija #5 rešena po kanonu LEKCIJA 1 —
# runda preimenovana R323→R324, QA re-derivirana iz NJIHOVE generacije].
# REGRESSION-ONLY runda (kanon R322): dekompozicija FAZA 2 = telesa VERBATIM
# + closure→args/props refaktor — NIČ nove žive interakcije → BREZ novega
# Z-bloka (iskren razlog); pokritost = polne regresije [Z0as CSV + Z0ar PDF
# + … + Z0ah 26/26 + restore ZERO-MUTACIJA] + r324-build-needles ×9 brat
# lokalno. Njihov Z0as blok ostaja kot REGRESIJA (CSV izvoz ŽE v drevesu).
# VSAKA zamenjava je NATANKO ena-n-točkovna (fail-closed; štetje POJAVITEV).
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r324-e2e-browser.sh')
DOL = Path('/home/z/my-project/scripts/r325-e2e-browser.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Generacijske poti ──
zam('/tmp/r323-', '/tmp/r325-', 140)
zam('qa-r323-', 'qa-r325-', 8)
zam('R323-server-e2e.log', 'R325-server-e2e.log', 1)
zam('=== R323 E2E KONEC ===', '=== R325 E2E KONEC ===', 1)

# ── 2. Glava: REGRESSION-ONLY opis (najnovejši PRVI) ──
zam('# R310 E2E ŽIVO (lokalni :3100, ADMIN) — API I/O MEJA ŽIVO (38. člen issue #1:',
    '# R325 E2E ŽIVO — REGRESSION-ONLY (DVOJNA KOLIZIJA #5+#6: vzporedna R323 [8857d6e CSV];\n'
    '# moja runda preimenovana R323→R324): DEKOMPOZICIJA FAZA 2 — measurements\n'
    '# 7.604 → 7.153 [−451; laserski BT blok → laser-bt.ts + use-laser.ts hook\n'
    '# + laser-panel.tsx; template localStorage blok → templates.ts] + calculator\n'
    '# 5.372 → 4.846 [−526; 5 PDF izvozov → pdf-exports.ts z args objekti].\n'
    '# ISKREN razlog BREZ novega Z-bloka: bajtno identičen/refaktor premik nima\n'
    '# nove žive interakcije (kanon R322 regression-only); pokritost = polne\n'
    '# regresije + r324-build-needles ×9 + ZERO-MUTACIJA odtis.\n'
    '# R310 E2E ŽIVO (lokalni :3100, ADMIN) — API I/O MEJA ŽIVO (38. člen issue #1:')

DOL.write_text(text, encoding='utf-8')
print(f'OK — r324-e2e-browser.sh zapisan ({len(text.splitlines())} vrstic)')
