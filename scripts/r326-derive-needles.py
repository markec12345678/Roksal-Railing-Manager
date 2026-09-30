#!/usr/bin/env python3
# R326 — derive r326-build-needles.sh iz r324 generacije (kanon LEKCIJA 1:
# QA družina sledi generaciji). VSAKA zamenjava je NATANKO ena-n-točkovna
# (fail-closed; LEKCIJA R312: štetje na POJAVITVE). Transformacije:
#   1. Glava: R326 zapis (53. člen zgodovina cen materiala + STIL val 13)
#   2. OUT pot: /tmp/r324-build-chunks → /tmp/r326-build-chunks
#   3. R326 needle blok (splice PRED regresijami: aria + naslov + filename
#      + must_miss TODO-R326)
#   4. Regresijska veriga: r323-build-needles → r324-build-needles (×2)
#   5. Footer
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r324-build-needles.sh')
DOL = Path('/home/z/my-project/scripts/r326-build-needles.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava (od '# R324 —' do '×3→×4).' — natanko glavni zapis 52. člena) ──
zam('''# R324 — build needleji: 52. ČLEN issue #1 «IZVOZ DNEVNEGA PREGLEDA VODJE
# KOT PDF» (IZVOZI družina: PDF brat CSV R163 — vzorec R318/R320/R321; NOV
# lib vodja-dnevni-pdf; EN VIR kontrakt R324 dvignjen v brat R163: glave
# VODJA_KPI_GLAVE + VODJA_TERMINI_GLAVE + validacija preveriVodjaIzvozVhod
# [sporočila VERBATIM, kje = graditelj] + vodjaKpiVrstice + VODJA_VIR_NIZ —
# CSV arhivska oblika ostaja BAJTNO nespremenjena; FNV soli 0xcd–0xd0;
# komponentni EN VIR vhod vodjaIzvozVhod — ENA preslikava, DVA potrošnika) +
# STIL val 12 (današnji termini dvonivojski odziv — blok amber/30 +
# vrstica amber/40 na novi površini; PIN SHIFTI ×3: val8 ×7→×8, val9
# ×14→15, val10/val11 registra ×3→×4).''',
'''# R326 — build needleji: 53. ČLEN issue #1 §5 «ZGODOVINA CEN MATERIALA»
# (price history — NOVI lib cena-zgodovina: ČISTA projekcija MaterialPrice
# vključno z ZAPRTO zgodovino veljavnostDo != null; NOVI GET route
# material-prices/zgodovina = edini bralec zgodovine; NOVI panel
# CenaZgodovinaPanel na inventory tabu — par = material × dobavitelj
# časovnica + iskrene smeri [narašča/pada/stabilna/prvi vpis] + CSV gumb
# izvozne družine; EN VIR: CENA_ZGODOVINA_CSV_GLAVE + TIMELINE_GLAVE +
# CENA_SMER_NIZ + cenaZgoSklep + CENA_ZGO_VIR_NIZ; EXCLUDE ogledalo
# NATANKO ena odprta cena per par; Date.parse razvrščanje — '39Z' past) +
# STIL val 13 (dvonivojska hierarhija val 11/12 na NOVI površini panela —
# par-Card amber/30 + časovna vrstica amber/40; PIN SHIFTI: val8 anti-stale
# 58→59 [NOVI CSV gumb, ring navy/40 — amber register ostane vodja ×8],
# r308 route obseg 81→82, r324 HEAD pre-existing /s flag popravljen).''')

# ── 2. OUT pot ──
zam('OUT=/tmp/r324-build-chunks', 'OUT=/tmp/r326-build-chunks', 1)

# ── 3. R326 needle blok (splice PRED regresijami) ──
zam('echo "R324 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"\necho "=== REGRESIJE: polna veriga prek r323-build-needles.sh (51. člen CSV + R322 + R321 + … + R227) ==="',
    'echo "R324 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"\n'
    'echo "--- R326 MANDATORY — 53. člen: zgodovina cen materiala (issue #1 §5 price history) ---"\n'
    'need_static "Zgodovina cen materiala" "R326 panel naslov (cena-zgodovina chunk)"\n'
    'need_static "Izvozi zgodovino cen materiala kot CSV" "R326 CSV izvoz gumb aria (panel chunk)"\n'
    'need_static "zgodovina-cen.csv" "R326 CSV izvoz filename (panel handler)"\n'
    'echo "--- R326 must_miss (negativni) ---"\n'
    'must_miss "TODO-R326" "R326 — brez razvojnih ostankov"\n'
    'echo "R326 lastni needleji: FAIL=$FAIL (3 izvoz + 1 must_miss)"\n'
    'echo "=== REGRESIJE: polna veriga prek r324-build-needles.sh (52. člen dnevni PDF + 51. člen CSV + R322 + R321 + … + R227) ==="', 1)

# ── 4. Regresijska veriga (komentar zamenjan v splicu koraka 3 → samo klic ostane) ──
zam('bash scripts/r323-build-needles.sh || REG=1', 'bash scripts/r324-build-needles.sh || REG=1', 1)

# ── 5. Footer + končni FAIL izpis ──
zam('if [ "$FAIL" = "1" ]; then echo "R323 NEEDLEJI FAIL"; exit 1; fi\necho "=== R324 BUILD NEEDLES VSE OK ==="',
    'if [ "$FAIL" = "1" ]; then echo "R324 NEEDLEJI FAIL"; exit 1; fi\necho "=== R326 BUILD NEEDLES VSE OK ==="', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r326-build-needles.sh zapisan ({len(text)} znakov)')
