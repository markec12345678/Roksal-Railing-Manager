#!/usr/bin/env python3
# R329 — derive r329-build-needles.sh iz r328 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. Glava: R329 zapis (56. člen PDF brat primerjava dobaviteljev)
#   2. OUT pot: /tmp/r328-build-chunks → /tmp/r329-build-chunks
#   3. R329 needle blok (PDF aria + filename + must_miss) — PO R328 bloku
#   4. Footer R328 → R329 (veriga na r324-build-needles ostaja)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r328-build-needles.sh')
DOL = Path('/home/z/my-project/scripts/r329-build-needles.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava ──
zam('''# R328 — build needleji: 55. ČLEN issue #1 §5 «SUPPLIER COMPARISON» —
# PRIMERJAVA DOBAVITELJEV (NOVI lib cena-dobavitelji: drugo grupiranje
# ISTEGA pregleda zgodovine R326 — EN VIR, pregled kot PROP, nič drugega
# fetcha; iskren agregat ŠTEVCEV smeri, nič izmišljenega povprečja; razpon
# trenutnih cen min/max; sort naziv+supplierId UTF-16; NOVI pod panel
# CenaDobaviteljiPanel — LOČEN datoteka, LEKCIJA R325 5; CSV gumb izvozne
# družine — navy/40, amber/50 register ostane v vodji ×8; filename
# primerjava-dobaviteljev.csv brez datuma) +
# DEDOVINA 54. člena (R327 zgodovina cen PDF needleji ostajajo v verigi) +''',
'''# R329 — build needleji: 56. ČLEN issue #1 «IZVOZI» — PRIMERJAVA
# DOBAVITELJEV PDF (deterministični PDF BRAT CSV-ju R328: NOVI lib
# cena-dobavitelji-pdf — LOČEN od podatkovnega brata, vzorec vodja-csv/
# vodja-dnevni-pdf R324 / zgodovina-cen-pdf R327; EN VIR
# cenaDobaviteljiVrstice = skupni potrošnik CSV+PDF tabel — ne moreta
# divergirati po konstrukciji; FNV soli 0xd5–0xd8; panel izvozni PAR
# CSV+PDF na isti blok glavi — navy/40, amber/50 register ostane v vodji
# ×8; val 16 iskren alarm WYSIWYG — narašča roksal-red / pada roksal-green
# na zaslonu; iskrena ničelna veja — OBA gumba skrita brez podatkov) +
# DEDOVINA 55. člena (R328 primerjava dobaviteljev CSV needleji ostajajo v
# verigi) +''', 1)

# ── 2. OUT pot ──
zam('OUT=/tmp/r328-build-chunks', 'OUT=/tmp/r329-build-chunks', 1)

# ── 3. R329 needle blok (PO R328 lastni vrstici, PRED REGRESIJAMI) ──
zam('''must_miss "TODO-R328" "R328 — brez razvojnih ostankov"
echo "R328 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r327-build-needles.sh [R327 zgodovina cen PDF + R326 zgodovina cen CSV + R325 dekompozicija + R324 dnevni PDF + r323 CSV + R322 + … + R227] ==="''',
'''must_miss "TODO-R328" "R328 — brez razvojnih ostankov"
echo "R328 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "--- R329 MANDATORY — 56. člen: primerjava dobaviteljev PDF izvoz (IZVOZI družina — PDF brat CSV-ju R328) ---"
need_static "Izvozi primerjavo dobaviteljev kot PDF" "R329 primerjava dobaviteljev PDF gumb aria (panel chunk)"
need_static "primerjava-dobaviteljev.pdf" "R329 PDF izvoz filename (cena-dobavitelji-pdf lib)"
echo "--- R329 must_miss (negativni) ---"
must_miss "TODO-R329" "R329 — brez razvojnih ostankov"
echo "R329 lastni needleji: FAIL=$FAIL (2 izvoz + 1 must_miss)"
echo "=== REGRESIJE: polna veriga prek r328-build-needles.sh [R328 primerjava dobaviteljev CSV + R327 zgodovina cen PDF + R326 zgodovina cen CSV + R325 dekompozicija + R324 dnevni PDF + r323 CSV + R322 + … + R227] ==="''', 1)

# ── 4. Footer ──
zam('echo "R328 NEEDLEJI FAIL"; exit 1; fi', 'echo "R329 NEEDLEJI FAIL"; exit 1; fi', 1)
zam('=== R328 BUILD NEEDLES VSE OK ===', '=== R329 BUILD NEEDLES VSE OK ===', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r329-build-needles.sh zapisan ({len(text)} znakov)')
