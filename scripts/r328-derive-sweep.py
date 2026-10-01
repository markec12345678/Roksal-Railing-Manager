#!/usr/bin/env python3
# R328 — derive r328-sweep.sh iz r327 generacije (kanon LEKCIJA 1). VSAKA
# zamenjava je NATANKO ena-n-točkovna (fail-closed). Transformacije:
#   1. Glava: R328 zapis (55. člen CSV gumb EPOCH pogojno pričakovanje)
#   2. NOV sweep_tab: cena_dobavitelji_csv_gumb_R328_EPOCH (inventory tab —
#      PO cena_zgo_pdf_gumb_R327_EPOCH; 21 → 22 preverjanj)
#   3. Footer/izpis velikosti ni vezan na števec (iskreno izpise ob teku)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r327-sweep.sh')
DOL = Path('/home/z/my-project/scripts/r328-sweep.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('''# R327 — interaktivni agent-browser produ QA sweep (kanon R316/R317/R322).
# Za vsak tab: eb_dispatch → čakaj → eval {err, dom-anchor}. Izhod: poročilo.
# ZERO-MUTACIJA: samo GET dispeči + DOM branje; nič klikov na mutacijske gumbe.
# 🆕 R327: PRODUKT JE R325 LIVE (r326-prod-qa ESKALACIJA veja — build
# 21:49:34Z > R325 commit 21:49:04; R326+R327 deploy čaka — Vercel kvota/
# kanon UNION harvest):
#   - R318/R320/R321/R323/R324 gumbi — pričakovano LIVE (regresija;
#     R324 dnevni PDF PRISTAL med rundama — sweep dokaz 19/20 anchor TRUE)
#   - R326 "Zgodovina cen materiala" panel + CSV gumb — pričakovano MISS
#     (stale produ; LIVE ob deployu — EPOCH pogoj, NI bug)
#   - R327 "Zgodovina cen" PDF gumb — pričakovano MISS (stale produ; LIVE
#     ob deployu — EPOCH pogoj, NI bug)''',
'''# R328 — interaktivni agent-browser produ QA sweep (kanon R316/R317/R322).
# Za vsak tab: eb_dispatch → čakaj → eval {err, dom-anchor}. Izhod: poročilo.
# ZERO-MUTACIJA: samo GET dispeči + DOM branje; nič klikov na mutacijske gumbe.
# 🆕 R328: PRODUKT JE R327 LIVE (r327-prod-qa ESKALACIJA veja — build
# 23:29:50Z > R327 dev commit 23:29:31 = R327 build ŽIVO, dokaz chunk-34
# [R326 CSV aria + R327 PDF aria]; R327 worklog commit deploy čaka —
# Vercel kvota/kanon UNION harvest):
#   - R318/R320/R321/R323/R324/R326 gumbi — pričakovano LIVE (regresija;
#     R326 zgodovina cen CSV + R327 PDF PRISTALA — chunk dokaz ŽIVO)
#   - R327 "Zgodovina cen" PDF gumb — pričakovano LIVE (chunk-34 dokaz)
#   - R328 "Primerjava dobaviteljev" CSV gumb — pričakovano MISS (stale
#     produ; LIVE ob deployu — EPOCH pogoj, NI bug)''', 1)

# ── 2. NOV sweep_tab (PO R327 PDF EPOCH entryju) ──
zam('sweep_tab cena_zgo_pdf_gumb_R327_EPOCH \'{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}\' \'[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi zgodovino cen materiala kot PDF"))\'',
    'sweep_tab cena_zgo_pdf_gumb_R327_EPOCH \'{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}\' \'[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi zgodovino cen materiala kot PDF"))\'\nsweep_tab cena_dobavitelji_csv_gumb_R328_EPOCH \'{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}\' \'[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi primerjavo dobaviteljev kot CSV"))\'', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r328-sweep.sh zapisan ({len(text)} znakov)')
