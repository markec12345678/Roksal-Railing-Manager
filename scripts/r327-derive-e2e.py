#!/usr/bin/env python3
# R327 — derive r327-e2e-browser.sh iz r326 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. Glava: Z0au opis posodobljen (54. člen PDF brat — OBA gumba skrita)
#   2. Generacijske poti: /tmp/r326- ×146 → /tmp/r327- (+ R326-server ×1)
#   3. Z0au blok RAZŠIRJEN: pdfGumbSkrit v UI probe + assertion (54. člen —
#      OBA izvozna gumba pod istim pogojem; par ne more divergirati)
#      [LEKCIJA R327: zamenjave na fragmentih BREZ backslash-escapov —
#      celotna eval vrstica nosi \" zaporedja, ki so krhka v exact-match]
#   4. Screenshot + Footer R326 → R327
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r326-e2e-browser.sh')
DOL = Path('/home/z/my-project/scripts/r327-e2e-browser.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava: Z0au opis ──
zam('''#   Z0au: ZGODOVINA CEN MATERIALA ŽIVO (R326 NOVO — 53. člen issue #1 §5,
#         price history): panel CenaZgodovinaPanel na inventory tabu —
#         čisti bralec NOVEGA GET route /api/material-prices/zgodovina
#         (r308 obseg 81→82); iskrena prazna veja (lokalna DB brez
#         MaterialPrice — deterministično stanje: "Ni še zabeleženih
#         cen" + CSV gumb skrit — brez podatkov NI izvoza, kanon vodje);''',
'''#   Z0au: ZGODOVINA CEN MATERIALA ŽIVO (R326 NOVO — 53. člen issue #1 §5;
#         R327 razširjeno — 54. člen PDF brat): panel CenaZgodovinaPanel na
#         inventory tabu — čisti bralec NOVEGA GET route
#         /api/material-prices/zgodovina (r308 obseg 81→82); iskrena prazna
#         veja (lokalna DB brez MaterialPrice — deterministično stanje:
#         "Ni še zabeleženih cen" + CSV IN PDF gumba SKRITA — brez podatkov
#         NI izvoza, OBA pod istim pogojem, kanon vodje; par ne more
#         divergirati);''', 1)

# ── 2. Generacijske poti ──
zam('/tmp/r326-', '/tmp/r327-', 146)
zam('/tmp/R326-server', '/tmp/R327-server', 1)

# ── 3. Z0au UI probe RAZŠIRJENA (pdfGumbSkrit) — fragment brez backslashov ──
zam("gumbSkrit:![...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Izvozi zgodovino cen materiala kot CSV')), err:window.__err??null",
    "gumbSkrit:![...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Izvozi zgodovino cen materiala kot CSV')), pdfGumbSkrit:![...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Izvozi zgodovino cen materiala kot PDF')), err:window.__err??null", 1)

# ── 4. Z0au UI assertion RAZŠIRJENA ──
zam("""assert d['gumbSkrit'] is True, 'Z0au CSV gumb SKRIT v prazni veji FAIL (brez podatkov NI izvoza): ' + json.dumps(d)
assert d['err'] is None, 'Z0au err: ' + json.dumps(d)
print('Z0au UI OK — zgodovina cen panel ŽIVO + iskrena prazna veja + CSV gumb skrit (53. člen; ZERO-MUTACIJA)')""",
"""assert d['gumbSkrit'] is True, 'Z0au CSV gumb SKRIT v prazni veji FAIL (brez podatkov NI izvoza): ' + json.dumps(d)
assert d['pdfGumbSkrit'] is True, 'Z0au PDF gumb SKRIT v prazni veji FAIL (54. člen — OBA gumba pod istim pogojem, par ne more divergirati): ' + json.dumps(d)
assert d['err'] is None, 'Z0au err: ' + json.dumps(d)
print('Z0au UI OK — zgodovina cen panel ŽIVO + iskrena prazna veja + CSV IN PDF gumba skrita (53.+54. člen; ZERO-MUTACIJA)')""", 1)

# ── 5. Screenshot + Footer ──
zam('qa-r326-e2e-z0au-zgodovina-cen.png', 'qa-r327-e2e-z0au-zgodovina-cen.png', 1)
zam('echo "=== R326 E2E KONEC ==="', 'echo "=== R327 E2E KONEC ==="', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r327-e2e-browser.sh zapisan ({len(text)} znakov)')
