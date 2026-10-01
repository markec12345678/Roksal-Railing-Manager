#!/usr/bin/env python3
# R330 — derive r330-sweep.sh iz r329 generacije (kanon LEKCIJA 1). VSAKA
# zamenjava je NATANKO ena-n-točkovna (fail-closed). Transformacije:
#   1. Glava: R330 zapis (57. člen CSV gumb EPOCH pogojno pričakovanje)
#   2. NOV sweep_tab: projekti_termini_csv_gumb_R330_EPOCH (logistics tab —
#      PO cena_dobavitelji_pdf_gumb_R329_EPOCH; 23 → 24 preverjanj)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r329-sweep.sh')
DOL = Path('/home/z/my-project/scripts/r330-sweep.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('''# R329 — interaktivni agent-browser produ QA sweep (kanon R316/R317/R322).
# Za vsak tab: eb_dispatch → čakaj → eval {err, dom-anchor}. Izhod: poročilo.
# ZERO-MUTACIJA: samo GET dispeči + DOM branje; nič klikov na mutacijske gumbe.
# 🆕 R329: PRODUKT JE R328 LIVE (r328-prod-qa ESKALACIJA veja — build
# 00:27:55Z > R328 dev commit 00:27:26 = R328 build ŽIVO [55. člen panel +
# CSV gumb + val 15 LIVE]; R328 worklog commit deploy čaka — Vercel
# kvota/kanon UNION harvest):
#   - R318/R320/R321/R323/R324/R326/R327/R328 gumbi — pričakovano LIVE
#     (regresija; R328 primerjava dobaviteljev CSV PRISTAL — build dokaz)
#   - R328 "Primerjava dobaviteljev" CSV gumb — pričakovano LIVE (build
#     00:27:55 nosi R328 dev vsebino)
#   - R329 "Primerjava dobaviteljev" PDF gumb — pričakovano MISS (stale
#     produ; LIVE ob deployu — EPOCH pogoj, NI bug)''',
'''# R330 — interaktivni agent-browser produ QA sweep (kanon R316/R317/R322).
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
#     deployu — EPOCH pogoj, NI bug)''', 1)

# ── 2. NOV sweep_tab (PO R329 PDF EPOCH entryju) ──
zam('sweep_tab cena_dobavitelji_pdf_gumb_R329_EPOCH \'{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}\' \'[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi primerjavo dobaviteljev kot PDF"))\'',
    'sweep_tab cena_dobavitelji_pdf_gumb_R329_EPOCH \'{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}\' \'[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi primerjavo dobaviteljev kot PDF"))\'\nsweep_tab projekti_termini_csv_gumb_R330_EPOCH \'{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}\' \'[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi pregled projektov in terminov kot CSV"))\'', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r330-sweep.sh zapisan ({len(text)} znakov)')
