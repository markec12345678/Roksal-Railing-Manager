#!/usr/bin/env python3
# R339 — derive r339-sweep.sh iz r338 generacije (KOLIZIJA #13).
# VSAKA zamenjava je NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312).
# R339 = val 25 runda → 31 preverb OSTANE; R337 spot dedovan (LIVE).
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r338-sweep.sh')
DOL = Path('/home/z/my-project/scripts/r339-sweep.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava narativa (R338 spot → R339 spot) ──
zam('''# R338 — interaktivni agent-browser produ QA sweep (kanon R316/R317/R322).
# Za vsak tab: eb_dispatch → čakaj → eval {err, dom-anchor}. Izhod: poročilo.
# ZERO-MUTACIJA: samo GET dispeči + DOM branje; nič klikov na mutacijske gumbe.
# 🆕 R338: PRODUKT = zadnji zeleni deploy R336 (r336-prod-qa LIVE veja
# EXIT=0 — build 09:02:11.761Z > R336 commit meja 09:01:46 [29ad578] —
# R334+R335+R336 dev ŽIVO SKUPAJ na produ; kanon R280/R284 UNION harvest
# potrjen; NJIHOV R337 [1a3e776 — 64. člen AI raba pregled CSV] + MOJA R338
# dekompozicija dev commita čakata Vercel deploy — Vercel limit vzorec;
# naslednji zeleni deploy nosi VSE generacije R290+…+R338; sweep spot R338
# run: R337 pill anchor = iskren PENDING dokaz [NI bug]; r338-prod-qa
# pričakuje LIVE ob zelenem deployu):''',
'''# R339 — interaktivni agent-browser produ QA sweep (kanon R316/R317/R322).
# Za vsak tab: eb_dispatch → čakaj → eval {err, dom-anchor}. Izhod: poročilo.
# ZERO-MUTACIJA: samo GET dispeči + DOM branje; nič klikov na mutacijske gumbe.
# 🆕 R339: PRODUKT = R337 LIVE (R339 prva naloga: r338-prod-qa re-run —
# stale-dokaz build 10:03:34.812Z = NJIHOV R337 deploy > R337 dev commit
# meja 09:57:21 [1a3e776] — R337 dev ŽIVO na produ; kanon R280/R284 UNION
# harvest; NJIHOVA R338 [6a333ae] dev čaka deploy — meja 10:38:12;
# naslednji zeleni deploy nosi VSE generacije R290+…+R338; sweep spot R339
# run: R337 anchor ŽIVO TRUE = LIVE dokaz; r339-prod-qa pričakuje LIVE ob
# zelenem deployu [R339]):''')

# ── 2. R338 dedovina vrstici (BREZ novih gumbov + premik needleji) → R339 ──
zam('''#   - R338 = DEKOMPOZICIJA runda (vzorec R322/R325) — BREZ novih gumbov,
#     sweep seznam NESPREMENJEN (NJIHOVA R337 je dodala ai-raba vnos —
#     dedovina, ostaja; 31 vnosov)
#   - R338 premik-needleji = r338-build-needles (vsebina ŽIVA v čankih —
#     ne DOM gumbi)''',
'''#   - R338 = DEKOMPOZICIJA runda (dedovina — KOLIZIJA #13) — BREZ novih
#     gumbov; sweep seznam NESPREMENJEN (31 vnosov)
#   - R339 = STIL val 25 runda — BREZ novih gumbov (title = statičen EN VIR
#     niz — pokritost r339-build-needles + vitest; ne DOM gumbi)''')

# ── 3. Naslov teka ──
zam('echo "=== R338 produ QA sweep — DOM zdravje po tabih (ZERO-MUTACIJA) ==="',
    'echo "=== R339 produ QA sweep — DOM zdravje po tabih (ZERO-MUTACIJA) ==="', 1)

# ── 4. čistost: R338 spot labels ostanejo (regresija) ──
if text.count('sweep_tab ') < 31:
    print('FAIL-CLOSED: 31 preverb ni dedovanih')
    sys.exit(1)
if 'ai_raba_csv_gumb_R337_EPOCH' not in text:
    print('FAIL-CLOSED: R337 sweep spot ni dedovan')
    sys.exit(1)
if '/tmp/r338-' in text:
    print('FAIL-CLOSED: /tmp/r338- ostanki v r339-sweep.sh')
    sys.exit(1)

DOL.write_text(text, encoding='utf-8')
print('r339-sweep.sh: OK (derive iz r338)')
