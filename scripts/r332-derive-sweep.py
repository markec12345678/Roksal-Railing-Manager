#!/usr/bin/env python3
# R332 — derive r332-sweep.sh iz r331 generacije (kanon LEKCIJA 1). VSAKA
# zamenjava je NATANKO ena-n-točkovna (fail-closed). Transformacije:
#   1. Glava: R332 zapis (59. člen CSV gumb EPOCH pogojno pričakovanje;
#      R331 Ponudbe CSV — sedaj LIVE dokaz; bb0b5ba worklog deploy pending)
#   2. NOV sweep_tab: potekli_opomniki_csv_gumb_R332_EPOCH (crm tab — PO
#      ponudbe_spomniki_csv_gumb_R331_EPOCH; 25 → 26 preverjanj)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r331-sweep.sh')
DOL = Path('/home/z/my-project/scripts/r332-sweep.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('''# R331 — interaktivni agent-browser produ QA sweep (kanon R316/R317/R322).
# Za vsak tab: eb_dispatch → čakaj → eval {err, dom-anchor}. Izhod: poročilo.
# ZERO-MUTACIJA: samo GET dispeči + DOM branje; nič klikov na mutacijske gumbe.
# 🆕 R331: PRODUKT JE R330 LIVE (r330-prod-qa LIVE veja — build 02:28:01.488Z
# > R330 dev commit fc6c2fd push 02:27:34, 27 s = R330 build ŽIVO [57. člen
# Projekti CSV + val 17 LIVE]; r330-prod-qa POST-commit LIVE potrdil R330
# needles ×2 + UNION harvest 438 OK/0 MISS; R330 worklog commit 9879f68
# deploy prav tako ŽIVO — build 02:34:31):
#   - R318/R320/R321/R323/R324/R326/R327/R328/R329/R330 gumbi — pričakovano
#     LIVE (regresija; R330 Projekti CSV PRISTAL — prod-qa LIVE dokaz)
#   - R330 "Projekti CSV" gumb — pričakovano LIVE (build 02:28:01 nosi R330
#     dev vsebino)
#   - R331 "Ponudbe CSV" gumb — pričakovano MISS (stale produ; LIVE ob
#     deployu — EPOCH pogoj, NI bug)''',
'''# R332 — interaktivni agent-browser produ QA sweep (kanon R316/R317/R322).
# Za vsak tab: eb_dispatch → čakaj → eval {err, dom-anchor}. Izhod: poročilo.
# ZERO-MUTACIJA: samo GET dispeči + DOM branje; nič klikov na mutacijske gumbe.
# 🆕 R332: PRODUKT JE R331 LIVE (r331-prod-qa LIVE veja — build 03:18:37.240Z
# > R331 dev commit eeecf2b push 03:18:18, 19 s = R331 build ŽIVO [58. člen
# Ponudbe CSV + val 18 LIVE]; r331-prod-qa POST-commit LIVE potrdil R331
# needles ×2 + UNION harvest 441 OK/0 MISS; sweep spot R332: R331 pill
# anchor TRUE — LIVE na produ potrdil; R331 worklog commit bb0b5ba deploy
# čaka — Vercel kvota/kanon UNION harvest):
#   - R318/R320/R321/R323/R324/R326/R327/R328/R329/R330/R331 gumbi —
#     pričakovano LIVE (regresija; R331 Ponudbe CSV PRISTAL — sweep +
#     prod-qa LIVE dokaz)
#   - R331 "Ponudbe CSV" gumb — pričakovano LIVE (build 03:18:37 nosi R331
#     dev vsebino — spot anchor TRUE)
#   - R332 "Potekli CSV" gumb — pričakovano MISS (stale produ; LIVE ob
#     deployu — EPOCH pogoj, NI bug)''', 1)

# ── 2. NOV sweep_tab (PO R331 CSV EPOCH entryju) ──
zam('sweep_tab ponudbe_spomniki_csv_gumb_R331_EPOCH \'{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}\' \'[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi pregled spomnikov ponudb kot CSV"))\'',
    'sweep_tab ponudbe_spomniki_csv_gumb_R331_EPOCH \'{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}\' \'[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi pregled spomnikov ponudb kot CSV"))\'\nsweep_tab potekli_opomniki_csv_gumb_R332_EPOCH \'{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}\' \'[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi potekle opomnike kot CSV"))\'', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r332-sweep.sh zapisan ({len(text)} znakov)')
