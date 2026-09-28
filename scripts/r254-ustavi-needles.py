#!/usr/bin/env python3
# R254 — iz r253-build-needles.sh naredi r254-build-needles.sh:
# 1) zamenjaj glavo (header komentar),
# 2) vstavi R254 sekcijo (P1-d aria + token migracije) takoz pred R253 sekcijo.
import re

src = open('scripts/r253-build-needles.sh', encoding='utf-8').read()

head_re = re.compile(r"^#!/bin/bash\n(#.*\n)+", re.M)
new_head = """#!/bin/bash
# R254 — build needleji: P1-d IKONSKI aria-hidden (codemod 1114 mest v 80
# datotekah + 20 duplikatov popravljenih — detektor vitest = trajna zaščita;
# tu dokumentiramo žetonske migracije: accent-[#f59e0b] → accent-roksal-amber,
# bg-[#f7f9ff] → bg-roksal-bg — EXACT vrednosti, 0 novih hex, 2 hex manj) +
# (10) R253 koledar pregledov + (9) R252 potekli opomniki + (8) R251 opomnik +
# (7) R250 prihodki + (6) R249 največji razpon + ... + (1) regresije R223–R249.
# Lekcija r247/r248: string needleji preživijo minifikacijo, identifikatorji
# NE; minifier ubeži '·' kot \\xb7 v TEMPLATE LITERALS — needleji so STRING
# LITERALS (legenda je JSX tekst — '·' ohranjen dobesedno, vzorec r250/r252/r253).
"""
m = head_re.match(src)
assert m, 'glava ni najdena'
src = new_head + src[m.end():]

r254_section = """echo "--- R254 P1-d aria + žetonske migracije (klient) ---"
must_miss_static "accent-[#f59e0b]" "arbitrary amber hex ostane migriran na accent-roksal-amber (EXACT vrednost)"
must_miss_static "bg-[#f7f9ff]" "arbitrary bg hex ostane migriran na bg-roksal-bg (EXACT vrednost)"
need_static "accent-roksal-amber" "R254 site-survey accent žeton (EXACT roksal-amber #f59e0b)"
need_static "bg-roksal-bg" "R254 landing page žeton (EXACT roksal-bg #f7f9ff)"
"""
anchor = 'echo "--- R253 koledar pregledov PDF (klient) ---"'
assert anchor in src, 'R253 sekcija ni najdena'
src = src.replace(anchor, r254_section + anchor, 1)

open('scripts/r254-build-needles.sh', 'w', encoding='utf-8').write(src)
print('r254-build-needles.sh zapisan,', src.count('\n'), 'vrstic')
