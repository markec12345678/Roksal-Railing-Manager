#!/usr/bin/env python3
# R331 — derive r331-sweep.sh iz r330 generacije (kanon LEKCIJA 1). VSAKA
# zamenjava je NATANKO ena-n-točkovna (fail-closed). Transformacije:
#   1. Glava: R331 zapis (58. člen CSV gumb EPOCH pogojno pričakovanje)
#   2. NOV sweep_tab: ponudbe_spomniki_csv_gumb_R331_EPOCH (crm tab — PO
#      projekti_termini_csv_gumb_R330_EPOCH; 24 → 25 preverjanj)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r330-sweep.sh')
DOL = Path('/home/z/my-project/scripts/r331-sweep.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('''# R330 — interaktivni agent-browser produ QA sweep (kanon R316/R317/R322).
# Za vsak tab: eb_dispatch → čakaj → eval {err, dom-anchor}. Izhod: poročilo.
# ZERO-MUTACIJA: samo GET dispeči + DOM branje; nič klikov na mutacijske gumbe.
# 🆕 R330: PRODUKT JE R329 LIVE (r329-prod-qa ESKALACIJA veja — build
# 01:10:08Z > R329 dev commit d259a2a push 00:52 = R329 build ŽIVO [56. člen
# PDF brat + val 16 LIVE, dokaz chunk bajtno: R329 PDF aria + R328 CSV aria
# v čanku 6a6825574ee92bf5.js]; R329 worklog commit fbd033e deploy čaka —
# Vercel kvota/kanon UNION harvest):
#   - R318/R320/R321/R323/R324/R326/R327/R328/R329 gumbi — pričakovano LIVE
#     (regresija; R329 primerjava dobaviteljev PDF PRISTAL — chunk dokaz)
#   - R329 "Primerjava dobaviteljev" PDF gumb — pričakovano LIVE (build
#     01:10:08 nosi R329 dev vsebino)
#   - R330 "Projekti CSV" gumb — pričakovano MISS (stale produ; LIVE ob
#     deployu — EPOCH pogoj, NI bug)''',
'''# R331 — interaktivni agent-browser produ QA sweep (kanon R316/R317/R322).
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
#     deployu — EPOCH pogoj, NI bug)''', 1)

# ── 2. NOV sweep_tab (PO R330 CSV EPOCH entryju) ──
zam('sweep_tab projekti_termini_csv_gumb_R330_EPOCH \'{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}\' \'[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi pregled projektov in terminov kot CSV"))\'',
    'sweep_tab projekti_termini_csv_gumb_R330_EPOCH \'{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}\' \'[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi pregled projektov in terminov kot CSV"))\'\nsweep_tab ponudbe_spomniki_csv_gumb_R331_EPOCH \'{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}\' \'[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi pregled spomnikov ponudb kot CSV"))\'', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r331-sweep.sh zapisan ({len(text)} znakov)')
