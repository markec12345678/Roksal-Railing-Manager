#!/usr/bin/env python3
# R336 — derive r336-sweep.sh + r336-sweep-run.sh iz r335 generacije.
# VSAKA zamenjava je NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312).
# Transformacije:
#   1. sweep: glava R335 → R336 kontekst + banner R335 → R336
#   2. NOVA R336 EPOCH vrstica (sistem zdravje CSV gumb — vodja dispatch)
#      PO R335 vrstici
#   3. sweep-run: klic r335-sweep.sh → r336-sweep.sh
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r335-sweep.sh')
DOL = Path('/home/z/my-project/scripts/r336-sweep.sh')
VIR_RUN = Path('/home/z/my-project/scripts/r335-sweep-run.sh')
DOL_RUN = Path('/home/z/my-project/scripts/r336-sweep-run.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('''# R335 — interaktivni agent-browser produ QA sweep (kanon R316/R317/R322).
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
#     deployu — EPOCH pogoj, NI bug)''',
'''# R336 — interaktivni agent-browser produ QA sweep (kanon R316/R317/R322).
# Za vsak tab: eb_dispatch → čakaj → eval {err, dom-anchor}. Izhod: poročilo.
# ZERO-MUTACIJA: samo GET dispeči + DOM branje; nič klikov na mutacijske gumbe.
# 🆕 R336: PRODUKT JE R335 LIVE (r335-prod-qa LIVE veja EXIT=0 — build
# 07:58:29.265Z > R335 commit meja 07:57:40 [d55ea9a] — R334+R335 dev ŽIVO
# SKUPAJ na produ po več rundah ESKALACIJE [kanon R280/R284 UNION harvest
# potrjen]; sweep spot R336 run: R334 + R335 pilli anchor TRUE = LIVE dokaz;
# R336 dev commit čaka deploy — Vercel limit vzorec; r336-prod-qa pričakuje
# LIVE ob zelenem deployu):
#   - R318/R320/R321/R323/R324/R326/R327/R328/R329/R330/R331/R332/R333/
#     R334/R335 gumbi — pričakovano LIVE (regresija; build 07:58 nosi
#     R334+R335 dev)
#   - R336 "Sistem zdravje CSV" gumb — pričakovano MISS (stale produ; LIVE
#     ob deployu — EPOCH pogoj, NI bug)''')

# ── 2. Banner ──
zam('echo "=== R335 produ QA sweep — DOM zdravje po tabih (ZERO-MUTACIJA) ==="',
    'echo "=== R336 produ QA sweep — DOM zdravje po tabih (ZERO-MUTACIJA) ==="')

# ── 3. NOVA R336 EPOCH vrstica PO R335 ──
zam('''sweep_tab vodja_mesecni_csv_gumb_R335_EPOCH '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi mesečno poročilo vodje kot CSV"))'
''',
'''sweep_tab vodja_mesecni_csv_gumb_R335_EPOCH '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi mesečno poročilo vodje kot CSV"))'
sweep_tab sistem_zdravje_csv_gumb_R336_EPOCH '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi sistem zdravje kot CSV"))'
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

zamr('# R335 — sweep klicatelj: vzpostavi sejo (LEKCIJA R328 5 — sweep NE vsebuje\n# prijave; klicatelj mora vzpostaviti sejo) → poženi r335-sweep.sh.',
     '# R336 — sweep klicatelj: vzpostavi sejo (LEKCIJA R328 5 — sweep NE vsebuje\n# prijave; klicatelj mora vzpostaviti sejo) → poženi r336-sweep.sh.')
zamr('bash scripts/r335-sweep.sh', 'bash scripts/r336-sweep.sh')

DOL_RUN.write_text(trun, encoding='utf-8')
print('r336-sweep.sh + r336-sweep-run.sh: OK (derive iz r335)')
