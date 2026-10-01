#!/usr/bin/env python3
# R337 — derive r337-sweep.sh iz r336 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije: glava narativa (R337 spot), +31. preverjanje (AI raba CSV
# EPOCH), footer.
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r336-sweep.sh')
DOL = Path('/home/z/my-project/scripts/r337-sweep.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava narativa (R336 spot → R337 spot) ──
zam('''# R336 — interaktivni agent-browser produ QA sweep (kanon R316/R317/R322).
# Za vsak tab: eb_dispatch → čakaj → eval {err, dom-anchor}. Izhod: poročilo.
# ZERO-MUTACIJA: samo GET dispeči + DOM branje; nič klikov na mutacijske gumbe.
# 🆕 R336: PRODUKT JE R335 LIVE (r335-prod-qa LIVE veja EXIT=0 — build
# 07:58:29.265Z > R335 commit meja 07:57:40 [d55ea9a] — R334+R335 dev ŽIVO
# SKUPAJ na produ po več rundah ESKALACIJE [kanon R280/R284 UNION harvest
# potrjen]; sweep spot R336 run: R334 + R335 pilli anchor TRUE = LIVE dokaz;
# R336 dev commit čaka deploy — Vercel limit vzorec; r336-prod-qa pričakuje
# LIVE ob zelenem deployu):''',
'''# R337 — interaktivni agent-browser produ QA sweep (kanon R316/R317/R322).
# Za vsak tab: eb_dispatch → čakaj → eval {err, dom-anchor}. Izhod: poročilo.
# ZERO-MUTACIJA: samo GET dispeči + DOM branje; nič klikov na mutacijske gumbe.
# 🆕 R337: PRODUKT JE R336 LIVE (r336-prod-qa LIVE veja EXIT=0 — build
# 09:02:11.761Z > R336 commit meja 09:01:46 [29ad578] — R334+R335+R336 dev
# ŽIVO SKUPAJ na produ; kanon R280/R284 UNION harvest potrjen; sweep spot
# R337 run: R334 + R335 + R336 pilli anchor TRUE = LIVE dokaz;
# R337 dev commit čaka deploy — Vercel limit vzorec; r337-prod-qa pričakuje
# LIVE ob zelenem deployu):''')

# ── 2. Pričakovana stanja (R336 gumb LIVE regresija; R337 MISS ob stale) ──
zam('''#   - R336 "Sistem zdravje CSV" gumb — pričakovano MISS (stale produ; LIVE
#     ob deployu — EPOCH pogoj, NI bug)''',
'''#   - R336 "Sistem zdravje CSV" gumb — pričakovano LIVE (regresija; build
#     09:02 nosi R336 dev)
#   - R337 "AI raba pregled CSV" gumb — pričakovano MISS (stale produ; LIVE
#     ob deployu — EPOCH pogoj, NI bug)''')

# ── 3. Footer naslov + NOVO preverjanje (#31 — PO R336 EPOCH vrstici) ──
zam('echo "=== R336 produ QA sweep — DOM zdravje po tabih (ZERO-MUTACIJA) ==="',
    'echo "=== R337 produ QA sweep — DOM zdravje po tabih (ZERO-MUTACIJA) ==="', 1)
zam('''sweep_tab sistem_zdravje_csv_gumb_R336_EPOCH '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi sistem zdravje kot CSV"))'
''',
'''sweep_tab sistem_zdravje_csv_gumb_R336_EPOCH '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi sistem zdravje kot CSV"))'
# R337 (64. člen): AI raba pregled CSV gumb — vodja dispatch; anchor = pill
# aria (EPOCH pogoj — stale produ → MISS je iskreno PENDING, NI bug)
sweep_tab ai_raba_csv_gumb_R337_EPOCH '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi pregled AI rabe kot CSV"))'
''')

# ── 4. čistost: r336 ostanki SAMO kot legitimna sklicna referenca (vzorec
# r336: 'r335-prod-qa' ×1 v glavi) ──
n = text.count('r336')
if n != 1 or 'r336-prod-qa' not in text:
    print(f'FAIL-CLOSED: {n} r336 ostankov v r337-sweep.sh (pričakovana 1 legitimna sklicna referenca r336-prod-qa)')
    sys.exit(1)

DOL.write_text(text, encoding='utf-8')
print('r337-sweep.sh: OK (derive iz r336)')
