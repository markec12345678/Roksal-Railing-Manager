#!/usr/bin/env python3
# R253 — iz r252-build-needles.sh naredi r253-build-needles.sh:
# 1) zamenjaj glavo (header komentar),
# 2) vstavi R253 sekcijo (14 novih needlejev) takoj za helperji (pred R252 sekcijo).
import re

src = open('scripts/r252-build-needles.sh', encoding='utf-8').read()

# 1) glava — zamenjaj blok komentar na vrhu (vrstice 1-9 v r252)
head_re = re.compile(r"^#!/bin/bash\n(#.*\n)+", re.M)
new_head = """#!/bin/bash
# R253 — build needleji: KOLEDAR PREGLEDOV PDF (10. člen 'izvozi' družine —
# časovna vrsta VSEH vpisanih pregledov: izbira opomnikStatus !== 'NI' VERBATIM,
# sort koledarski datum ASC, KPI Pregledov/V tem tednu/Poteklih, fail-closed
# prazen koledar + NI vnos, legenda, toast z realnim agregatom) + (9) R252
# potekli opomniki + (8) R251 opomnik + (7) R250 prihodki + (6) R249 največji
# razpon + (5) R248 povprečni + (4) R247 % razlika + (3) R246 razponska + (2)
# primerjalni/cenik izvoz + (1) regresije R223–R249 (vse pini).
# Lekcija r247/r248: string needleji preživijo minifikacijo, identifikatorji
# NE; minifier ubeži '·' kot \\xb7 v TEMPLATE LITERALS — needleji so STRING
# LITERALS (legenda je JSX tekst — '·' ohranjen dobesedno, vzorec r250/r252).
"""
m = head_re.match(src)
assert m, 'glava ni najdena'
src = new_head + src[m.end():]

# 2) R253 sekcija — vstavi PRED prvo "--- R252" oznako
r253_section = """echo "--- R253 koledar pregledov PDF (klient) ---"
need_static "Izvozi koledar pregledov kot PDF" "R253 pill aria"
need_static "Koledar pregledov kot PDF časovna vrsta (vsi vpisani datumi, najbližji prvi)" "R253 pill title"
need_static "KOLEDAR PREGLEDOV" "R253 PDF glava"
need_static "prazen koledar ne nastaja dokumenta" "R253 fail-closed: prazen koledar"
need_static "koledar je izpeljava iz opomnikStatus" "R253 fail-closed: NI vnos"
need_static "prazna množica ne nastaja dokumenta" "R253 fail-closed: povzetek prazne množice"
need_static "Potekel = prek datuma · Koledar = vsi vpisani pregledi (časovna vrsta)" "R253 legenda dodatek (R252 needle nepoškodovan)"
need_static "Koledar pregledov prenešeni v PDF" "R253 toast title"
need_static "Ni vpisanih pregledov" "R253 fail-closed toast"
need_static "PDF se izvozi, ko je vpisan prvi datum pregleda." "R253 fail-closed toast opis"
need_static "Koledar-pregledov-" "R253 filename prefix"
need_static "koledarski red (najbližji pregled prvi)" "R253 sklepni podpis"
need_static "V tem tednu" "R253 KPI label"
need_static "'Dni do', 'Opis']" "R253 tabela 7 stolpcev"
"""
anchor = 'echo "--- R252 potekli opomniki PDF (klient) ---"'
assert anchor in src, 'R252 sekcija ni najdena'
src = src.replace(anchor, r253_section + anchor, 1)

open('scripts/r253-build-needles.sh', 'w', encoding='utf-8').write(src)
print('r253-build-needles.sh zapisan,', src.count('\n'), 'vrstic')
