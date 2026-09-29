#!/usr/bin/env python3
"""R288: izpelji r288-build-needles.sh iz r287 (kanon gen-* — izpeljava je
čista VSAKIČ, ko se struktura ne spreminja; r287 lekcija 3). Vstavi R288
MANDATORY sekcijo za R287 sekcijo (opomnikPotekel needle), doda TODO-R288
must_miss, preimenuje OUT dir in posodobi glavo + zaključni echo."""
import re

SRC = '/home/z/my-project/scripts/r287-build-needles.sh'
DST = '/home/z/my-project/scripts/r288-build-needles.sh'

src = open(SRC).read()

# 1) Glava — zamenjaj komentar blok (vrstice 1-18) z R288 opisom
glava_nova = '''#!/bin/bash
# R288 — build needleji: (0) OPOMNIK DEEP-LINK ((k) dopolnitev R287 —
# signal → dejanje → CILJ): zvončkova opomniška vrstica odpri CRM in IZBERE
# konkretno stranko (detail Sheet z opomniško kartico + poudarjena vrstica);
# dvo-dogodkovni protokol R214 vzorec (roksal:navigate + roksal:select-crm);
# čista lib funkcija crm-deep-link.ts (R283 vzorec izvlečene odločitve);
# one-shot poraba (CAKAJ/ODPRI/PRESKOCI — vsi robovi pripeti v vitestu ×27);
#       + (1) R287 regresije (zvonček opomnik ×10 — lib property imena +
#       aria + copy), (2) R286/R285/R284/R283/R282/R281/R280/... regresije
#       (parent: r287-build-needles.sh). AWK STRUKTURNA PREVERBA (r270
#       lekcija 2 needleji-v-loopu → lažno zeleno).
# LEKCIJA R287 (ASCII kanon): lib izvožena imena funkcij NISO stabilna na
# build površini (minifier množi/preimenuje) — R288 needleji = property
# imena (JSX prop ključi) + ASCII literali (PRESKOCI/ODPRI/roksal:select-crm)
# + JSX attr stringi; vedenje nosi vitest pin ×27 (r288-crm-deep-link).
set -u
'''

src = re.sub(r'^#!/bin/bash\n(?:#.*\n)*?set -u\n', glava_nova, src, count=1)

# 2) OUT dir
src = src.replace('OUT=/tmp/r286-build-chunks', 'OUT=/tmp/r288-build-chunks')

# 3) R288 sekcija — vstavi ZA R287 zadnjim needlejem (opomnikPotekel)
r288_sekcija = '''need_static "opomnikPotekel" "R287 kind literal (KIND_STYLE + meta alarm pogoj)"
echo "--- R288 MANDATORY — OPOMNIK DEEP-LINK ((k) dopolnitev — signal → dejanje → CILJ) ---"
need_static "roksal:select-crm" "R288 dogodek literal (dvo-dogodkovni protokol — R214 vzorec)"
need_static "izbranaStrankaId" "R288 prop ključ (lupina lasti stanje — page.tsx + CrmTab)"
need_static "onStrankaIzbranaObravnavana" "R288 one-shot callback prop (počisti po ODPRI/PRESKOCI)"
need_static "PRESKOCI" "R288 lib odločitev literal (fail-safe — uspešen seznam brez stranke = R287 vedenje)"
need_static "ODPRI" "R288 lib odločitev literal (stranka najdena → detail Sheet)"
need_static "CAKAJ" "R288 lib odločitev literal (čakanje — nalaganje/napaka/brez zahteve; D6 stil vedenje = vitest pin — local state ime NE preživi minifierja, lekcija R287 ASCII kanon)"
need_static "Poudarjeno iz zvončka (opomnik)" "R288 hover title poudarjene vrstice (a11y — JSX attr string)"
need_static "border-roksal-amber/60 bg-roksal-amber/5" "R288 poudarek žetoni (ISTO roksal-amber družina kot hover — 0 novih hex)"'''

assert 'need_static "opomnikPotekel" "R287 kind literal (KIND_STYLE + meta alarm pogoj)"' in src
src = src.replace(
    'need_static "opomnikPotekel" "R287 kind literal (KIND_STYLE + meta alarm pogoj)"',
    r288_sekcija,
    1,
)

# 4) TODO-R288 must_miss (prvi v vrsti)
src = src.replace(
    'must_miss "TODO-R284" "R284 — brez razvojnih ostankov"',
    'must_miss "TODO-R288" "R288 — brez razvojnih ostankov"\nmust_miss "TODO-R284" "R284 — brez razvojnih ostankov"',
    1,
)

# 5) Zaključni echo
src = src.replace(
    'echo "NEEDLE FAIL=$FAIL (R287 ×10 novih;',
    'echo "NEEDLE FAIL=$FAIL (R288 ×8 novih; R287 ×10 novih;',
    1,
)

open(DST, 'w').write(src)
print('r288-build-needles.sh zapisan')

# bash -n preverba (r287 lekcija 3 — poceni zavarovalnica)
import subprocess
r = subprocess.run(['bash', '-n', DST], capture_output=True, text=True)
print('bash -n:', 'OK' if r.returncode == 0 else r.stderr)
