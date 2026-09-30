#!/usr/bin/env python3
# R326 — derive r326-build-needles.sh iz vzporedne r325 generacije (kanon
# LEKCIJA 1, 5. potrditev). VSAKA zamenjava je NATANKO ena-n-točkovna
# (fail-closed). Transformacije:
#   1. Glava: R326 zapis (53. člen zgodovina cen + STIL val 13) —
#      vzporedna r325 je v KOLIZIJI #5+#6 pustila stale 'R324' glavo
#   2. OUT pot: /tmp/r325-build-chunks → /tmp/r326-build-chunks
#   3. 🩺 OBNOVA R324 bloka (52. člen dnevni PDF — need ×2 + must_miss) —
#      izpadel iz verige v dvakratnem preimenovanju (r324-build-needles je
#      bil PREKRIT z dekompozicijo FAZA 2 needleji) — UNION harvest kanon
#   4. R326 needle blok (zgodovina cen ×3 + must_miss)
#   5. Footer R325 → R326 (veriga na r324-build-needles ostaja — nosi
#      dekompozicijo FAZA 2 needleje vzporedne runde)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r325-build-needles.sh')
DOL = Path('/home/z/my-project/scripts/r326-build-needles.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava (stale 'R324' glava vzporedne r325 → R326 + R326 opis) ──
zam('''# R324 — build needleji: DEKOMPOZICIJA FAZA 2 (measurements + calculator —
# nadaljevanje odobrene Roadmap "razbitje monsterskih komponent", vzorec
# R319 faza 1 / R322 calculator faza 1; KOLIZIJA #5: vzporedna seja je
# vzela R323 [8857d6e, 51. člen zmogljivost CSV] — runda preimenovana
# R323→R324 po kanonu LEKCIJA 1; RE-DERIVIRANA delegacija iz vzporedne
# r323 generacije — podeduje njihove CSV needleje + verigo):''',
'''# R326 — build needleji: 53. ČLEN issue #1 §5 «ZGODOVINA CEN MATERIALA»
# (price history — NOVI lib cena-zgodovina: ČISTA projekcija MaterialPrice
# vključno z ZAPRTO zgodovino; NOVI GET route material-prices/zgodovina
# [r308 81→82]; NOVI panel CenaZgodovinaPanel na inventory tabu — par =
# material × dobavitelj časovnica + iskrene smeri + CSV gumb izvozne
# družine; EN VIR glave + CENA_SMER_NIZ + sklep + VIR_NIZ) +
# 🩺 OBNOVA R324 bloka (52. člen dnevni PDF — izpadel iz verige v
# KOLIZIJI #5+#6 dvakratnem preimenovanju: r324-build-needles prekrit z
# dekompozicijo FAZA 2 — UNION harvest kanon: noben generacijski needle
# se ne sme tiho izgubiti) + DEDOVINA vzporedne R325 (PRIROJENIŠKA
# dekompozicija FAZA 2 — measurements 7.604 → 7.153 laserski BT blok +
# calculator 5.372 → 4.846 PDF izvozi; KOLIZIJA #7: moja runda
# preimenovana R325→R326 po kanonu LEKCIJA 1):''', 1)

# ── 2. OUT pot ──
zam('OUT=/tmp/r325-build-chunks', 'OUT=/tmp/r326-build-chunks', 1)

# ── 3. 🩺 OBNOVA R324 bloka (PRED R325 must_miss) ──
R324_BLOK = '''echo "--- R324 MANDATORY — 52. člen: izvoz dnevnega pregleda vodje kot PDF (IZVOZI družina) — OBNOVLJEN (izpadel v KOLIZIJI #5+#6; UNION harvest kanon) ---"
need_static "Izvozi dnevni pregled vodje kot PDF" "R324 dnevni PDF izvoz gumb aria (vodja chunk)"
need_static "pregled-vodje_" "R324 dnevni PDF izvoz filename prefix (vodja-dnevni-pdf lib)"
echo "--- R324 must_miss (negativni) ---"
must_miss "TODO-R324" "R324 — brez razvojnih ostankov"
echo "R324 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
'''
zam('echo "--- R325 must_miss (negativni) ---"',
    R324_BLOK + 'echo "--- R325 must_miss (negativni) ---"', 1)

# ── 4. R326 needle blok (PO R325 lastni vrstici, PRED REGRESIJAMI) ──
zam('echo "R325 lastni needleji: FAIL=$FAIL (9 premik + 1 must_miss)"\necho "=== REGRESIJE: polna veriga prek r324-build-needles.sh [VZPOREDNA R324 dnevni PDF + R323 CSV + R322 + … + R227] ==="',
    '''echo "R325 lastni needleji: FAIL=$FAIL (9 premik + 1 must_miss)"
echo "--- R326 MANDATORY — 53. člen: zgodovina cen materiala (price history; issue #1 §5) ---"
need_static "Zgodovina cen materiala" "R326 panel naslov (cena-zgodovina chunk)"
need_static "Izvozi zgodovino cen materiala kot CSV" "R326 CSV izvoz gumb aria (panel chunk)"
need_static "zgodovina-cen.csv" "R326 CSV izvoz filename (panel handler)"
echo "--- R326 must_miss (negativni) ---"
must_miss "TODO-R326" "R326 — brez razvojnih ostankov"
echo "R326 lastni needleji: FAIL=$FAIL (3 izvoz + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r324-build-needles.sh [vzporedna r324 = dekompozicija FAZA 2 + r323 CSV + R322 + … + R227; R324 dnevni PDF blok OBNOVLJEN zgoraj] ==="''', 1)

# ── 5. Footer ──
zam('echo "R325 NEEDLEJI FAIL"; exit 1; fi', 'echo "R326 NEEDLEJI FAIL"; exit 1; fi', 1)
zam('=== R325 BUILD NEEDLES VSE OK ===', '=== R326 BUILD NEEDLES VSE OK ===', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r326-build-needles.sh zapisan ({len(text)} znakov)')
