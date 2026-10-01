#!/usr/bin/env python3
# R338 — derive r338-sweep.sh iz NJIHOVE r337 generacije (KOLIZIJA #12:
# vzporedna cron seja je vzela številko R337 — commit 1a3e776, 64. člen AI
# raba pregled CSV; NJIHOVI scripts/r337-* skripti ostanejo; po kanonu
# LEKCIJA 1: re-derivacija r338-* IZ NJIHOVE r337 generacije). VSAKA
# zamenjava je NATANKO n-točkovna (fail-closed; LEKCIJA R312: štetje na
# POJAVITVE — text.count NE grep -c).
# Pojavitveni števci PREJ (python3 text.count na VIR-u r337-sweep.sh):
#   - '# R337 — interaktivni agent-browser produ QA sweep (kanon
#     R316/R317/R322).': ×1
#   - 🆕 R337 blok paragraph ('# 🆕 R337: PRODUKT JE R336 LIVE …' do '…
#     LIVE ob zelenem deployu):'): ×1
#   - R337 MISS bullet ('#   - R337 "AI raba pregled CSV" gumb —
#     pričakovano MISS (stale produ; LIVE … EPOCH pogoj, NI bug)'): ×1
#   - 'echo "=== R337 produ QA sweep — DOM zdravje po tabih
#     (ZERO-MUTACIJA) ==="': ×1
#   - sweep_tab klicev: ×31 na disku (NJIHOVA R337 je dodala
#     ai_raba_csv_gumb_R337_EPOCH vnos na 30-vnosni seznam NJIHOVE R336;
#     prejšnja generacija je imela 30 — DEVIACIJA dokumentirana: r338
#     seznam = 31 vnosov NESPREMENJEN — dekompozicija runda ne dodaja
#     vnosov)
#   - 'ai_raba_csv_gumb_R337_EPOCH': ×1 (NJIHOV dedovina vnos — ostaja
#     BREZ spremembe)
#   - 'r337-prod-qa' (v 🆕 R337 paragraphu): ×1 — zamenjan znotraj 🆕 R338
#     paragrapha
# Transformacije:
#   1. Žig vrstica 2: "R337 —" → "R338 —"
#   2. Glava: 🆕 R337 blok → 🆕 R338 blok (produkt = zadnji zeleni deploy
#      R336; NJIHOV R337 + MOJA R338 dev commita čakata Vercel deploy;
#      R337 pill = iskren PENDING; R338 = dekompozicija BREZ novih gumbov;
#      DEDOVINA KOLIZIJE #7 blok VERBATIM)
#   3. Sweep banner echo: R337 → R338
#   4. BREZ novih sweep_tab vnosov — dekompozicija runda (vzorec
#      R322/R325: ČIST premik, brez novih gumbov/DOM površin; pokritost =
#      r338-build-needles premik-needleji, NE DOM sweep)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r337-sweep.sh')
DOL = Path('/home/z/my-project/scripts/r338-sweep.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Žig vrstica 2 ──
zam('# R337 — interaktivni agent-browser produ QA sweep (kanon R316/R317/R322).',
    '# R338 — interaktivni agent-browser produ QA sweep (kanon R316/R317/R322).', 1)

# ── 2. Glava: 🆕 R337 blok → 🆕 R338 blok (DEDOVINA KOLIZIJE #7 VERBATIM) ──
zam('''# 🆕 R337: PRODUKT JE R336 LIVE (r336-prod-qa LIVE veja EXIT=0 — build
# 09:02:11.761Z > R336 commit meja 09:01:46 [29ad578] — R334+R335+R336 dev
# ŽIVO SKUPAJ na produ; kanon R280/R284 UNION harvest potrjen; sweep spot
# R337 run: R334 + R335 + R336 pilli anchor TRUE = LIVE dokaz;
# R337 dev commit čaka deploy — Vercel limit vzorec; r337-prod-qa pričakuje
# LIVE ob zelenem deployu):''',
'''# 🆕 R338: PRODUKT = zadnji zeleni deploy R336 (r336-prod-qa LIVE veja
# EXIT=0 — build 09:02:11.761Z > R336 commit meja 09:01:46 [29ad578] —
# R334+R335+R336 dev ŽIVO SKUPAJ na produ; kanon R280/R284 UNION harvest
# potrjen; NJIHOV R337 [1a3e776 — 64. člen AI raba pregled CSV] + MOJA R338
# dekompozicija dev commita čakata Vercel deploy — Vercel limit vzorec;
# naslednji zeleni deploy nosi VSE generacije R290+…+R338; sweep spot R338
# run: R337 pill anchor = iskren PENDING dokaz [NI bug]; r338-prod-qa
# pričakuje LIVE ob zelenem deployu):''', 1)

# ── 2b. R338 bullets PO R337 MISS bulletu (R337/R336/R318–R335 vrstice
#    ostanejo VERBATIM — dedovina) ──
zam('''#   - R337 "AI raba pregled CSV" gumb — pričakovano MISS (stale produ; LIVE
#     ob deployu — EPOCH pogoj, NI bug)''',
'''#   - R337 "AI raba pregled CSV" gumb — pričakovano MISS (stale produ; LIVE
#     ob deployu — EPOCH pogoj, NI bug)
#   - R338 = DEKOMPOZICIJA runda (vzorec R322/R325) — BREZ novih gumbov,
#     sweep seznam NESPREMENJEN (NJIHOVA R337 je dodala ai-raba vnos —
#     dedovina, ostaja; 31 vnosov)
#   - R338 premik-needleji = r338-build-needles (vsebina ŽIVA v čankih —
#     ne DOM gumbi)''', 1)

# ── 3. Sweep banner echo (generacijski žig) ──
zam('echo "=== R337 produ QA sweep — DOM zdravje po tabih (ZERO-MUTACIJA) ==="',
    'echo "=== R338 produ QA sweep — DOM zdravje po tabih (ZERO-MUTACIJA) ==="', 1)

# ── 4. BREZ novih sweep_tab vnosov — dekompozicija runda (vzorec
#    R322/R325: ČIST premik, brez novih gumbov/DOM površin; pokritost =
#    r338-build-needles premik-needleji, NE DOM sweep) ──

DOL.write_text(text, encoding='utf-8')
print(f'OK — r338-sweep.sh zapisan ({len(text)} znakov)')
