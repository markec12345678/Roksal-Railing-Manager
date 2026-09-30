#!/usr/bin/env python3
# R327 — derive r327-sweep.sh iz r326 generacije (kanon LEKCIJA 1). VSAKA
# zamenjava je NATANKO ena-n-točkovna (fail-closed). Transformacije:
#   1. Glava: R327 zapis (54. člen PDF gumb EPOCH pogojno pričakovanje)
#   2. NOV sweep_tab: cena_zgo_pdf_gumb_R327_EPOCH (inventory tab — PO
#      cena_zgo_csv_gumb_R326_EPOCH; 20 → 21 preverjanj)
#   3. Footer/izpis velikosti ni vezan na števec (iskreno izpise ob teku)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r326-sweep.sh')
DOL = Path('/home/z/my-project/scripts/r327-sweep.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('''# R326 — interaktivni agent-browser produ QA sweep (kanon R316/R317/R322).
# Za vsak tab: eb_dispatch → čakaj → eval {err, dom-anchor}. Izhod: poročilo.
# ZERO-MUTACIJA: samo GET dispeči + DOM branje; nič klikov na mutacijske gumbe.
# 🆕 R326: PRODUKT JE R323 LIVE (r324-prod-qa ESKALACIJA veja — build
# 20:38:17Z = R323; R324+R326 deploy čaka — Vercel kvota/kanon UNION harvest):
#   - R318/R320/R321/R323 gumbi — pričakovano LIVE (regresija)
#   - R324 "Dnevni PDF" gumb — pričakovano MISS (stale produ; LIVE ob deployu
#     — EPOCH pogoj, NI bug)
#   - R326 "Zgodovina cen materiala" panel + CSV gumb — pričakovano MISS
#     (stale produ; LIVE ob deployu — EPOCH pogoj, NI bug)''',
'''# R327 — interaktivni agent-browser produ QA sweep (kanon R316/R317/R322).
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
#     ob deployu — EPOCH pogoj, NI bug)''', 1)

# ── 2. NOV sweep_tab (PO R326 CSV EPOCH entryju) ──
zam('sweep_tab cena_zgo_csv_gumb_R326_EPOCH \'{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}\' \'[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi zgodovino cen materiala kot CSV"))\'',
    'sweep_tab cena_zgo_csv_gumb_R326_EPOCH \'{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}\' \'[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi zgodovino cen materiala kot CSV"))\'\nsweep_tab cena_zgo_pdf_gumb_R327_EPOCH \'{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}\' \'[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi zgodovino cen materiala kot PDF"))\'', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r327-sweep.sh zapisan ({len(text)} znakov)')
