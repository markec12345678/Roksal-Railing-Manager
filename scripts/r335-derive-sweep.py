#!/usr/bin/env python3
# R335 — derive r335-sweep.sh + r335-sweep-run.sh iz r334 generacije.
# VSAKA zamenjava je NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312).
# Transformacije:
#   1. sweep: glava R334 → R335 kontekst + banner R324 → R335
#   2. 🐛 QA-ORODJE POPRAVEK (LEKCIJA R334 1 — vodja NI top-level tab):
#      R334 EPOCH vrstica ima POKVAREN dispatch '{"tab":"vodja",…}' →
#      popravljen na '{"tab":"more","more":"vodja",…}' (iskren OPOMNA
#      fallback bi ancor dajal FALSE tudi ob LIVE deployu — stale bug iz
#      r334 generacije, popravljen v r335)
#   3. NOVA R335 EPOCH vrstica (mesečno poročilo CSV gumb) PO R334
#   4. sweep-run: klic r334-sweep.sh → r335-sweep.sh
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r334-sweep.sh')
DOL = Path('/home/z/my-project/scripts/r335-sweep.sh')
VIR_RUN = Path('/home/z/my-project/scripts/r334-sweep-run.sh')
DOL_RUN = Path('/home/z/my-project/scripts/r335-sweep-run.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('''# R332 — interaktivni agent-browser produ QA sweep (kanon R316/R317/R322).
# Za vsak tab: eb_dispatch → čakaj → eval {err, dom-anchor}. Izhod: poročilo.
# ZERO-MUTACIJA: samo GET dispeči + DOM branje; nič klikov na mutacijske gumbe.
# 🆕 R334: PRODUKT JE R333 LIVE (r333-prod-qa LIVE veja — build 05:39:50.997Z
# > R333 dev commit 7b4d5d3 push 05:39:17, ~34 s = R333 build ŽIVO [60. člen
# Pozicija CSV + val 20 LIVE]; r333-prod-qa POST-commit LIVE potrdil R333
# needles ×2 + UNION harvest 447 OK/0 MISS; sweep spot R334: R333 pill
# anchor TRUE — LIVE na produ potrdil [27/27 err null, 23/27 anchor];
# R333 worklog commit 5a31ba3 [worklog-only] NI deployan — Vercel limit
# vzorec; r334-prod-qa ESKALACIJA iskren — stale ZDRAV, ZERO must_miss):
#   - R318/R320/R321/R323/R324/R326/R327/R328/R329/R330/R331/R332/R333
#     gumbi — pričakovano LIVE (regresija; R333 Pozicija CSV PRISTAL —
#     sweep + prod-qa LIVE dokaz)
#   - R333 "Pozicija CSV" gumb — pričakovano LIVE (build 05:39:50 nosi
#     R333 dev vsebino — spot anchor TRUE)
#   - R334 "Končna CSV" gumb — pričakovano MISS (stale produ; LIVE ob
#     deployu — EPOCH pogoj, NI bug)
#   DEDOVINA KOLIZIJE #7: vzporedna lastniška R325 = PRIROJENIŠKA
#     dekompozicija FAZA 2 — brez novih gumbov (ČIST premik; measurements/
#     calculator tabi ŽE v sweep listi — pokritost nespremenjena)''',
'''# R335 — interaktivni agent-browser produ QA sweep (kanon R316/R317/R322).
# Za vsak tab: eb_dispatch → čakaj → eval {err, dom-anchor}. Izhod: poročilo.
# ZERO-MUTACIJA: samo GET dispeči + DOM branje; nič klikov na mutacijske gumbe.
# 🆕 R335: PRODUKT JE R334 PENDING (r334-prod-qa ESKALACIJA veja EXIT=0 —
# build 06:49:00.765Z nosi do 5a31ba3 [R333 dev]; 91cf226 R334 dev + 785a093
# worklog-only čakata skupaj — Vercel limit vzorec; sweep spot R335 run:
# R334 pill anchor FALSE = iskren PENDING dokaz [NI bug]; QA-ORODJE POPRAVEK
# v tej generaciji: R334 EPOCH vrstica je imela pokvaren dispatch
# '{"tab":"vodja",…}' — vodja NI top-level tab [LEKCIJA R334 1]; popravljen
# na '{"tab":"more","more":"vodja",…}' — sicer bi anchor ostal FALSE tudi
# ob LIVE deployu):
#   - R318/R320/R321/R323/R324/R326/R327/R328/R329/R330/R331/R332/R333
#     gumbi — pričakovano LIVE (regresija; build 06:49 nosi R333 dev)
#   - R334 "Končna CSV" gumb — pričakovano MISS (stale produ; LIVE ob
#     deployu — EPOCH pogoj, NI bug; dispatch POPRAVLJEN)
#   - R335 "Mesečno CSV" gumb — pričakovano MISS (stale produ; LIVE ob
#     deployu — EPOCH pogoj, NI bug)
#   DEDOVINA KOLIZIJE #7: vzporedna lastniška R325 = PRIROJENIŠKA
#     dekompozicija FAZA 2 — brez novih gumbov (ČIST premik; measurements/
#     calculator tabi ŽE v sweep listi — pokritost nespremenjena)''')

# ── 2. Banner ──
zam('echo "=== R324 produ QA sweep — DOM zdravje po tabih (ZERO-MUTACIJA) ==="',
    'echo "=== R335 produ QA sweep — DOM zdravje po tabih (ZERO-MUTACIJA) ==="')

# ── 3. QA-ORODJE POPRAVEK: R334 EPOCH dispatch + NOVA R335 vrstica ──
zam('''sweep_tab koncna_verifikacija_csv_gumb_R334_EPOCH '{"tab":"vodja","more":null,"subTab":null,"osnutek":null,"filter":null}' '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi poročilo končne verifikacije kot CSV"))'
''',
'''# 🐛 R335 QA-ORODJE POPRAVEK (LEKCIJA R334 1): dispatch je bil '{"tab":"vodja",…}'
# — vodja NI top-level tab → iskren OPOMNA fallback → anchor FALSE tudi ob
# LIVE deployu; popravljen na '{"tab":"more","more":"vodja",…}' (ISTI obrazec
# kot ostale vodja vrstice zgoraj).
sweep_tab koncna_verifikacija_csv_gumb_R334_EPOCH '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi poročilo končne verifikacije kot CSV"))'
sweep_tab vodja_mesecni_csv_gumb_R335_EPOCH '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi mesečno poročilo vodje kot CSV"))'
''')

DOL.write_text(text, encoding='utf-8')

# ── sweep-run ──
trun = VIR_RUN.read_text(encoding='utf-8')

def zamr(stari, novi, pricakuj=1):
    global trun
    n = trun.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED (run): {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    trun = trun.replace(stari, novi)

zamr('# R334 — sweep klicatelj: vzpostavi sejo (LEKCIJA R328 5 — sweep NE vsebuje\n# prijave; klicatelj mora vzpostaviti sejo) → poženi r334-sweep.sh.',
     '# R335 — sweep klicatelj: vzpostavi sejo (LEKCIJA R328 5 — sweep NE vsebuje\n# prijave; klicatelj mora vzpostaviti sejo) → poženi r335-sweep.sh.')
zamr('bash scripts/r334-sweep.sh', 'bash scripts/r335-sweep.sh')

DOL_RUN.write_text(trun, encoding='utf-8')
print('r335-sweep.sh + r335-sweep-run.sh: OK (derive iz r334)')
