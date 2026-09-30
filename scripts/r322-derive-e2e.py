#!/usr/bin/env python3
# R322 — derive r322-e2e-browser.sh iz r321-e2e-browser.sh (KOLIZIJA:
# vzporedna seja je vzela R321 — RE-DERIVACIJA iz njihove generacije;
# podeduje Z0ar + vse regresije + ZERO-MUTACIJA odtis). VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; štetje na POJAVITVE — lekcija
# R312/…/R321).
# Transformacije:
#   1. Glava: R322 opomba NAD Z0ar (dekompozicija calculator faza 1 +
#      R254 slepa pega — REGRESSION-ONLY runda: NOV Z-blok NI dodan,
#      iskren razlog: bajtno identičen premik nima nove žive interakcije;
#      pokritost = r322-build-needles + vitest r254 stražar + polne
#      regresije + ZERO-MUTACIJA odtis)
#   2. Generacijske poti: /tmp/r321- → /tmp/r322- (138), sekret [vzporedna
#      pustila R320 ime — počistim na R322], marker id, screenshot
#      qa-r321 → qa-r322 (7), server log, E2E KONEC label
#   3. Izhodna-stran asercija (LEKCIJA R310 5/6)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r321-e2e-browser.sh')
DOL = Path('/home/z/my-project/scripts/r322-e2e-browser.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava: R322 opomba NAD Z0ar (regression-only runda — iskren razlog) ──
zam('#   Z0ar: IZVOZ MERITEV ZMOGLJIVOSTI KOT PDF ŽIVO (R321 NOVO —',
    '#   [R322] DEKOMPOZICIJA calculator-tab FAZA 1 (regression-only runda —\n'
    '#         PRIROJENIŠKA, vzorec R319; KOLIZIJA: vzporedna R321 vzela\n'
    '#         številko): 6.074 → 5.372 vrstic — mapa calculator/ ×5\n'
    '#         (shared.ts + 4 SVG diagrami — ČIST PREMIK bajtno identično)\n'
    '#         + R254 SLEPA PEGA ZAPRTA (5 a11y popravkov IN-PLACE;\n'
    '#         trojni popravek detektor+codemod+stražar). NOV Z-blok NI\n'
    '#         dodan — iskren razlog: premik bajtno identične vsebine nima\n'
    '#         nove žive interakcije za dokazovat; pokritost =\n'
    '#         r322-build-needles [vsebina ŽIVA v čankih ×5] + vitest r254\n'
    '#         stražar [5 novih ikon] + polne E2E regresije (Z0ar/…/Z0ah)\n'
    '#         + ZERO-MUTACIJA ODTIS;\n'
    '#   Z0ar: IZVOZ MERITEV ZMOGLJIVOSTI KOT PDF ŽIVO (R321 —')

# ── 2. Generacijske poti + oznake ──
# 138 = /tmp/r321- POJAVITVE (kalibracija na pojavitve — lekcija R312 OSMič)
zam('/tmp/r321-', '/tmp/r322-', 138)
# vzporedna seja je pustila R320 ime sekreta — počistim na MOJO generacijo
zam('r320-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!', 'r322-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!', 1)
zam('/tmp/R321-server-e2e.log', '/tmp/R322-server-e2e.log', 1)
# vzporedna je pustila tudi marker R320 ime — počistim
zam('e2e-r320-ne-obstojeci-id', 'e2e-r322-ne-obstojeci-id', 1)
zam('echo "=== R321 E2E KONEC ==="', 'echo "=== R322 E2E KONEC ==="', 1)
zam('qa-r321', 'qa-r322', 7)

DOL.write_text(text, encoding='utf-8')
print(f'OK — {DOL.name} zapisan ({len(text.splitlines())} vrstic)')
