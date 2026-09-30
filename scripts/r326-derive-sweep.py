#!/usr/bin/env python3
# R326 — derive r326-sweep.sh iz r324 generacije (kanon LEKCIJA 1). VSAKA
# zamenjava je NATANKO ena-n-točkovna (fail-closed). Transformacije:
#   1. Glava: R326 zapis (53. člen zgodovina cen + EPOCH pogojna pričakovanja)
#   2. NOV sweep_tab: cena_zgo_csv_gumb_R326_EPOCH (inventory tab — PO
#      vodja_dnevni_pdf_gumb_R324_EPOCH)
#   3. Footer
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r324-sweep.sh')
DOL = Path('/home/z/my-project/scripts/r326-sweep.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('''# R324 — interaktivni agent-browser produ QA sweep (kanon R316/R317/R322).
# Za vsak tab: eb_dispatch → čakaj → eval {err, dom-anchor}. Izhod: poročilo.
# ZERO-MUTACIJA: samo GET dispeči + DOM branje; nič klikov na mutacijske gumbe.
# 🆕 R324: PRODUKT JE R323 LIVE (r323-prod-qa LIVE veja footer dokazuje build
# 20:38:17Z > R323 commit 20:37:44Z):
#   - R323 gumb "Izvozi meritve zmogljivosti kot CSV" — pričakovano LIVE (NOVO)
#   - R318/R320/R321 gumbi — pričakovano LIVE (regresija)
#   - R324 "Dnevni PDF" gumb — pričakovano MISS (stale produ; LIVE ob deployu
#     — EPOCH pogoj, NI bug)''',
'''# R326 — interaktivni agent-browser produ QA sweep (kanon R316/R317/R322).
# Za vsak tab: eb_dispatch → čakaj → eval {err, dom-anchor}. Izhod: poročilo.
# ZERO-MUTACIJA: samo GET dispeči + DOM branje; nič klikov na mutacijske gumbe.
# 🆕 R326: PRODUKT JE R323 LIVE (r324-prod-qa ESKALACIJA veja — build
# 20:38:17Z = R323; R324+R326 deploy čaka — Vercel kvota/kanon UNION harvest):
#   - R318/R320/R321/R323 gumbi — pričakovano LIVE (regresija)
#   - R324 "Dnevni PDF" gumb — pričakovano MISS (stale produ; LIVE ob deployu
#     — EPOCH pogoj, NI bug)
#   - R326 "Zgodovina cen materiala" panel + CSV gumb — pričakovano MISS
#     (stale produ; LIVE ob deployu — EPOCH pogoj, NI bug)''', 1)

# ── 2. NOV sweep_tab (PO R324 EPOCH entryju) ──
zam('sweep_tab vodja_dnevni_pdf_gumb_R324_EPOCH \'{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}\' \'[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi dnevni pregled vodje kot PDF"))\'',
    'sweep_tab vodja_dnevni_pdf_gumb_R324_EPOCH \'{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}\' \'[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi dnevni pregled vodje kot PDF"))\'\nsweep_tab cena_zgo_csv_gumb_R326_EPOCH \'{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}\' \'[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi zgodovino cen materiala kot CSV"))\'', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r326-sweep.sh zapisan ({len(text)} znakov)')
