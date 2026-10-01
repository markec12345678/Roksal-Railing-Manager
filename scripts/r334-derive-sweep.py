#!/usr/bin/env python3
# R334 — derive r334-sweep.sh iz r333 generacije (kanon LEKCIJA 1). VSAKA
# zamenjava je NATANKO ena-n-točkovna (fail-closed). Transformacije:
#   1. Glava: R334 zapis (61. člen CSV gumb EPOCH pogojno pričakovanje;
#      R333 Pozicija CSV — sedaj LIVE dokaz; 5a31ba3 worklog-only commit
#      undeployed [ESKALACIJA iskren — stale ZDRAV, R333 dev vsebina ŽIVO])
#   2. NOV sweep_tab: koncna_verifikacija_csv_gumb_R334_EPOCH (vodja — PO
#      pozicija_dobaviteljev_csv_gumb_R333_EPOCH)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r333-sweep.sh')
DOL = Path('/home/z/my-project/scripts/r334-sweep.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('''# 🆕 R333: PRODUKT JE R332 LIVE (r332-prod-qa LIVE veja — build 04:17:01.221Z
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
#     deployu — EPOCH pogoj, NI bug)''',
'''# 🆕 R334: PRODUKT JE R333 LIVE (r333-prod-qa LIVE veja — build 05:39:50.997Z
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
#     deployu — EPOCH pogoj, NI bug)''', 1)

# ── 2. NOV sweep_tab (PO R333 CSV EPOCH entryju) ──
zam('sweep_tab pozicija_dobaviteljev_csv_gumb_R333_EPOCH \'{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}\' \'[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi pozicijo dobaviteljev kot CSV"))\'',
    'sweep_tab pozicija_dobaviteljev_csv_gumb_R333_EPOCH \'{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}\' \'[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi pozicijo dobaviteljev kot CSV"))\'\nsweep_tab koncna_verifikacija_csv_gumb_R334_EPOCH \'{"tab":"vodja","more":null,"subTab":null,"osnutek":null,"filter":null}\' \'[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi poročilo končne verifikacije kot CSV"))\'', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r334-sweep.sh zapisan ({len(text)} znakov)')
