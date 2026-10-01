#!/usr/bin/env python3
# R333 — derive r333-sweep.sh iz r332 generacije (kanon LEKCIJA 1). VSAKA
# zamenjava je NATANKO ena-n-točkovna (fail-closed). Transformacije:
#   1. Glava: R333 zapis (60. člen CSV gumb EPOCH pogojno pričakovanje;
#      R332 Potekli CSV — sedaj LIVE dokaz; f5c8c6e POST-commit deploy ŽIVO)
#   2. NOV sweep_tab: pozicija_dobaviteljev_csv_gumb_R333_EPOCH (Material
#      pregled, subtab Dobavitelji — PO potekli_opomniki_csv_gumb_R332_EPOCH)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r332-sweep.sh')
DOL = Path('/home/z/my-project/scripts/r333-sweep.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('''# 🆕 R332: PRODUKT JE R331 LIVE (r331-prod-qa LIVE veja — build 03:18:37.240Z
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
#     deployu — EPOCH pogoj, NI bug)''',
'''# 🆕 R333: PRODUKT JE R332 LIVE (r332-prod-qa LIVE veja — build 04:17:01.221Z
# > R332 dev commit 46191d4 push 04:16:41, ~20 s = R332 build ŽIVO [59. člen
# Potekli CSV + val 19 LIVE]; r332-prod-qa POST-commit LIVE potrdil R332
# needles ×2 + UNION harvest 444 OK/0 MISS; sweep spot R333: R332 pill
# anchor TRUE — LIVE na produ potrdil; R332 worklog commit f5c8c6e deploy
# prav tako ŽIVO — build 04:24:18 > 04:23:58):
#   - R318/R320/R321/R323/R324/R326/R327/R328/R329/R330/R331/R332 gumbi —
#     pričakovano LIVE (regresija; R332 Potekli CSV PRISTAL — sweep +
#     prod-qa LIVE dokaz)
#   - R332 "Potekli CSV" gumb — pričakovano LIVE (build 04:17:01 nosi R332
#     dev vsebino — spot anchor TRUE)
#   - R333 "Pozicija CSV" gumb — pričakovano MISS (stale produ; LIVE ob
#     deployu — EPOCH pogoj, NI bug)''', 1)

# ── 2. NOV sweep_tab (PO R332 CSV EPOCH entryju) ──
zam('sweep_tab potekli_opomniki_csv_gumb_R332_EPOCH \'{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}\' \'[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi potekle opomnike kot CSV"))\'',
    'sweep_tab potekli_opomniki_csv_gumb_R332_EPOCH \'{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}\' \'[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi potekle opomnike kot CSV"))\'\nsweep_tab pozicija_dobaviteljev_csv_gumb_R333_EPOCH \'{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}\' \'[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi pozicijo dobaviteljev kot CSV"))\'', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r333-sweep.sh zapisan ({len(text)} znakov)')
