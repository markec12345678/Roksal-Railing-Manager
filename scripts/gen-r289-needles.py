#!/usr/bin/env python3
"""R289: izpelji r289-build-needles.sh iz r288 (kanon gen-* — izpeljava je
čista VSAKIČ, ko se struktura ne spreminja; r287/r288 lekcija). Vstavi R289
ISKREN PRESEŽEK sekcijo pred R288 sekcijo, doda TODO-R289 must_miss,
preimenuje OUT dir, posodobi glavo + zaključni echo (števec ×9)."""
import re

SRC = '/home/z/my-project/scripts/r288-build-needles.sh'
DST = '/home/z/my-project/scripts/r289-build-needles.sh'

src = open(SRC).read()

# 1) Glava — zamenjaj SAMO komentar blok (do 'set -u') — awk/OUT struktura
# ostane nedotaknjena (r289 lekcija: gen regex NE sme požirati kode pod glavo)
src = re.sub(
    r'^#!/bin/bash\n#.*?\n(set -u\n)',
    lambda m: '''#!/bin/bash
# R289 — build needleji: (0) ISKREN PRESEŽEK v zvončku (family-wide dopolnitev
# R287/R288): vsaka signalna družina nosi cap (×8/×6) — brez presežka bi 9.
# zamujena dobava / 7. opomnik TIHO izginil (lažna varnost — vzorec R152/R182).
# NOV lib izvoz opomnikZvonekPresezek (isti validacijski sprehod kot vrstice —
# opomnikZvonekNosilci izvleček, javno vedenje identično — R287 ×15 pinov);
# role="note" POVZETEK vrstica pod seznamom (pogojna, ne-klikljiva — brez
# lažnih affordance; title izrecno pove, kje je celotna resnica);
#       + (1) R288/R287/R286/R285/R284/R283/R282/R281/R280/... regresije
#       (parent: r288-build-needles.sh). AWK STRUKTURNA PREVERBA (r270
#       lekcija 2 needleji-v-loopu → lažno zeleno).
# LEKCIJA R288 (ASCII kanon 3. gen): local useState imena NE preživijo
# minifierja (presezki/dodajPresezek NISMO needleji); objektni/prop ključi +
# stringi DA — R289 needleji = lib export (opomnikZvonekPresezek) + JSX/title
# literali ('Presežek:', 'Iskren presežek — …') + kategorije ('Današnje
# montaže', 'Follow-upi', 'Zapadli računi', 'Zamujene dobave' — novi literali).
''' + m.group(1),
    src,
    count=1,
    flags=re.S,
)

# 2) OUT dir
src = src.replace('OUT=/tmp/r288-build-chunks', 'OUT=/tmp/r289-build-chunks')

# 3) R289 MANDATORY sekcija PRED R288 sekcijo
r288_sec = 'echo "--- R288 MANDATORY — OPOMNIK DEEP-LINK ((k) dopolnitev — signal → dejanje → CILJ) ---"'
r289_sec = '''echo "--- R289 MANDATORY — ISKREN PRESEŽEK (family-wide zvonček — brez tihih capov) ---"
# LEKCIJA (r289 1. tek, ASCII kanon 4. gen): UVOŽENA imena funkcij
# (opomnikZvonekPresezek) minifier PREIMENUJE (lokalna vezava v uvoznem
# modulu) — lib izvozi NISMO stabilni needleji; stabilni = prop ključi +
# JSX attr literali + object keys ('kategorija'). Izvoz needle IZPUŠČEN.
need_static '"aria-label":"Iskren presežek signalov"' "R289 poimenovana note regija (a11y + minifier-stabilen literal — hyphenated ključi = STRING ključi na žici)"
need_static "Presežek:" "R289 note glava (JSX literal — POVZETEK vrstica)"
need_static "Iskren presežek — zvonček prikazuje najpomembnejše vrstice; celotna resnica je na pripadajočih ploščah." "R289 title resnica (a11y — JSX attr string)"
need_static "Današnje montaže" "R289 kategorija literal (velika D — nov)"
need_static "Follow-upi" "R289 kategorija literal (nov)"
need_static "Zapadli računi" "R289 kategorija literal (nov)"
need_static "Zamujene dobave" "R289 kategorija literal (nov)"
need_static "kategorija" "R289 objektni ključ (preživi minifier — kanon ASCII 3. gen)"
'''
assert r288_sec in src, 'R288 sekcija NI najdena'
src = src.replace(r288_sec, r289_sec + r288_sec)

# 4) must_miss TODO-R289
old_mm = 'must_miss "TODO-R288" "R288 — brez razvojnih ostankov"'
assert old_mm in src
src = src.replace(old_mm, 'must_miss "TODO-R289" "R289 — brez razvojnih ostankov"\n' + old_mm)

# 5) Zaključni echo — R289 ×8 vstavimo
old_tail = 'echo "NEEDLE FAIL=$FAIL (R288 ×8 novih;'
assert old_tail in src
src = src.replace(old_tail, 'echo "NEEDLE FAIL=$FAIL (R289 ×8 novih; R288 ×8 novih;')

open(DST, 'w').write(src)
print('r289-build-needles.sh izpeljan OK')
