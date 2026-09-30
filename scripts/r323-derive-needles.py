#!/usr/bin/env python3
# R323 — derive r323-build-needles.sh iz vzporedne r322 generacije (kanon
# kolizija LEKCIJA 1: re-derive iz vzporedne runde — podeduje njihove
# calculator needleje + verigo). VSAKA zamenjava je NATANKO ena-n-točkovna
# (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije: glava (51. člen CSV), OUT pot, R323 needle blok (CSV aria
# + filename + must_miss — splice PRED regresijami).
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r322-build-needles.sh')
DOL = Path('/home/z/my-project/scripts/r323-build-needles.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── glava ──
zam('# R322 — build needleji: DEKOMPOZICIJA calculator-tab FAZA 1 + R254 SLEPA\n# PEGA ZAPRTA (KOLIZIJA: vzporedna seja je vzela R321 [43f3f7e, 50. člen\n# zmogljivost PDF] — moja runda preimenovana R321→R322 po kanonu LEKCIJA 1\n# vzporednih sej; RE-DERIVIRANA QA družina iz vzporedne r321 — delegacija\n# podeduje njihove needleje + verigo).',
    '# R323 — build needleji: 51. ČLEN issue #1 «IZVOZ MERITEV ZMOGLJIVOSTI KOT\n# CSV» (IZVOZI družina: CSV brat PDF R321 — družinska simetrija kanon: Del.\n# 4 = CSV+PDF, Del. 7 = JSON+PDF, Del. 6 = PDF+CSV; NOV lib\n# buildZmogljivostCsv; EN VIR kontrakt R323 v bratu R312: glave\n# ZMOGLJIVOST_IZVOZ_GLAVE + validacija preveriZmogljivostPregledZaIzvoz +\n# formatirajMs + VIR_NIZ — PDF in CSV ne moreta divergirati po konstrukciji;\n# toCsv kanon R136) + DEDOVINA vzporedne R322 (dekompozicija calculator-tab\n# FAZA 1 + R254 slepa pega — kolizija: moja runda preimenovana R322→R323;\n# RE-DERIVACIJA iz vzporedne r322 generacije — delegacija podeduje njihove\n# needleje + verigo).')

# ── OUT pot ──
zam('OUT=/tmp/r322-build-chunks', 'OUT=/tmp/r323-build-chunks', 1)

# ── R323 needle blok (splice PRED regresijami) ──
zam('echo "R322 lastni needleji: FAIL=$FAIL (5 premik + 1 must_miss)"\necho "=== REGRESIJE: polna veriga prek r321-build-needles.sh (vzporedna R321 + R320 + … + R227) ==="',
    'echo "R322 lastni needleji: FAIL=$FAIL (5 premik + 1 must_miss)"\n'
    'echo "--- R323 MANDATORY — 51. člen: izvoz meritev zmogljivosti kot CSV (IZVOZI družina) ---"\n'
    'need_static "Izvozi meritve zmogljivosti kot CSV" "R323 CSV izvoz gumb aria (vodja chunk)"\n'
    'need_static "zmogljivost-pregled.csv" "R323 CSV izvoz filename (vodja handler)"\n'
    'echo "--- R323 must_miss (negativni) ---"\n'
    'must_miss "TODO-R323" "R323 — brez razvojnih ostankov"\n'
    'echo "R323 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"\n'
    'echo "=== REGRESIJE: polna veriga prek r321-build-needles.sh (vzporedna R321 + R320 + … + R227) ==="', 1)

# ── konec ──
zam('echo "=== R322 BUILD NEEDLES VSE OK ==="', 'echo "=== R323 BUILD NEEDLES VSE OK ==="', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r323-build-needles.sh zapisan ({len(text)} znakov)')
