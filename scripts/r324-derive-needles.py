#!/usr/bin/env python3
# R324 — derive r324-build-needles.sh iz r323 generacije (kanon LEKCIJA 1:
# QA družina sledi generaciji). VSAKA zamenjava je NATANKO ena-n-točkovna
# (fail-closed; LEKCIJA R312: štetje na POJAVITVE). Transformacije:
#   1. Glava: R324 zapis (52. člen dnevni PDF + STIL val 12)
#   2. OUT pot: /tmp/r323-build-chunks → /tmp/r324-build-chunks
#   3. R324 needle blok (splice PRED regresijami: aria + filename prefix +
#      must_miss TODO-R324)
#   4. Regresijska veriga: r321-build-needles → r323-build-needles (×3)
#   5. Footer
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r323-build-needles.sh')
DOL = Path('/home/z/my-project/scripts/r324-build-needles.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('# R323 — build needleji: 51. ČLEN issue #1 «IZVOZ MERITEV ZMOGLJIVOSTI KOT\n# CSV» (IZVOZI družina: CSV brat PDF R321 — družinska simetrija kanon: Del.\n# 4 = CSV+PDF, Del. 7 = JSON+PDF, Del. 6 = PDF+CSV; NOV lib\n# buildZmogljivostCsv; EN VIR kontrakt R323 v bratu R312: glave\n# ZMOGLJIVOST_IZVOZ_GLAVE + validacija preveriZmogljivostPregledZaIzvoz +\n# formatirajMs + VIR_NIZ — PDF in CSV ne moreta divergirati po konstrukciji;\n# toCsv kanon R136) + DEDOVINA vzporedne R322 (dekompozicija calculator-tab\n# FAZA 1 + R254 slepa pega — kolizija: moja runda preimenovana R322→R323;\n# RE-DERIVACIJA iz vzporedne r322 generacije — delegacija podeduje njihove\n# needleje + verigo).',
    '# R324 — build needleji: 52. ČLEN issue #1 «IZVOZ DNEVNEGA PREGLEDA VODJE\n# KOT PDF» (IZVOZI družina: PDF brat CSV R163 — vzorec R318/R320/R321; NOV\n# lib vodja-dnevni-pdf; EN VIR kontrakt R324 dvignjen v brat R163: glave\n# VODJA_KPI_GLAVE + VODJA_TERMINI_GLAVE + validacija preveriVodjaIzvozVhod\n# [sporočila VERBATIM, kje = graditelj] + vodjaKpiVrstice + VODJA_VIR_NIZ —\n# CSV arhivska oblika ostaja BAJTNO nespremenjena; FNV soli 0xcd–0xd0;\n# komponentni EN VIR vhod vodjaIzvozVhod — ENA preslikava, DVA potrošnika) +\n# STIL val 12 (današnji termini dvonivojski odziv — blok amber/30 +\n# vrstica amber/40 na novi površini; PIN SHIFTI ×3: val8 ×7→×8, val9\n# ×14→15, val10/val11 registra ×3→×4).')

# ── 2. OUT pot ──
zam('OUT=/tmp/r323-build-chunks', 'OUT=/tmp/r324-build-chunks', 1)

# ── 3. R324 needle blok (splice PRED regresijami) ──
zam('echo "R323 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"\necho "=== REGRESIJE: polna veriga prek r321-build-needles.sh (vzporedna R321 + R320 + … + R227) ==="',
    'echo "R323 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"\n'
    'echo "--- R324 MANDATORY — 52. člen: izvoz dnevnega pregleda vodje kot PDF (IZVOZI družina) ---"\n'
    'need_static "Izvozi dnevni pregled vodje kot PDF" "R324 dnevni PDF izvoz gumb aria (vodja chunk)"\n'
    'need_static "pregled-vodje_" "R324 dnevni PDF izvoz filename prefix (vodja-dnevni-pdf lib)"\n'
    'echo "--- R324 must_miss (negativni) ---"\n'
    'must_miss "TODO-R324" "R324 — brez razvojnih ostankov"\n'
    'echo "R324 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"\n'
    'echo "=== REGRESIJE: polna veriga prek r323-build-needles.sh (51. člen CSV + R322 + R321 + … + R227) ==="', 1)

# ── 4. Regresijska veriga (×2 PO splicu: komentar + klic; tretja pojavitev
# je bila zamenjana v splicu koraka 3 — LEKCIJA R312: štetje POJAVITEV po
# prejšnjih transformacijah) ──
zam('r321-build-needles.sh', 'r323-build-needles.sh', 2)

# ── 5. Footer + končni FAIL izpis ──
zam('if [ "$FAIL" = "1" ]; then echo "R322 NEEDLEJI FAIL"; exit 1; fi\necho "=== R323 BUILD NEEDLES VSE OK ==="',
    'if [ "$FAIL" = "1" ]; then echo "R323 NEEDLEJI FAIL"; exit 1; fi\necho "=== R324 BUILD NEEDLES VSE OK ==="', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r324-build-needles.sh zapisan ({len(text)} znakov)')
