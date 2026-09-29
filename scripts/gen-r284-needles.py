#!/usr/bin/env python3
# R284 — generator r284-build-needles.sh iz r283-build-needles.sh (clone +
# R284 sekcija + must_miss TODO-R284 + glava/števec popravki). Kanon
# gen-r280/281/282/283-skripte.py.
SRC = '/home/z/my-project/scripts/r283-build-needles.sh'
DST = '/home/z/my-project/scripts/r284-build-needles.sh'

src = open(SRC, encoding='utf-8').read()

# 1) glava
old_glava = """#!/bin/bash
# R283 — build needleji: (1) F3 VIR POKRITOST mini-vrstica (issue #15 §3 —
# strežniško izpeljani viri MANUAL/PHOTO_CV/ARCORE_DEPTH; EN VIR
# filteredMeasurements; fail-closed; popolna pokritost = green pika);
# (2) MANDATORY STIL — R269 mini hover parity (title + žeton title);
# (3) R282/R281/R280/… regresije (parent: r282-build-needles.sh)."""
new_glava = """#!/bin/bash
# R284 — build needleji: (1) TERENSKI ZAPISNI LIST PDF (issue #15 §3,
# worklog i5 — IZPOLNJEVALNI list: zapisana resnica + PRAZNI fizični
# stolpci Fizična ref./Δ/Zapiski; EN VIR R269 meritevTerenPregled + R186
# kot; soli 0xb5–0xb8; NI konflikta z bajtnimi kontrakti — nova družina);
# (2) MANDATORY STIL — zapisni list gumb hover title + legenda + bulk toggle
# title (kanon R280–R283); (3) R283/R282/R281/R280/… regresije (parent:
# r283-build-needles.sh)."""
assert old_glava in src
src = src.replace(old_glava, new_glava)

# 2) OUT dir
src = src.replace('OUT=/tmp/r283-build-chunks', 'OUT=/tmp/r284-build-chunks')

# 3) R284 sekcija pred R283 sekcijo
marker = 'echo "--- R283 MANDATORY — F3 vir pokritost mini-vrstica (issue #15 §3) ---"'
r284 = """echo "--- R284 MANDATORY — TERENSKI ZAPISNI LIST (issue #15 §3, worklog i5) ---"
need_static "TERENSKI ZAPISNI LIST" "R284 PDF naslov (glava dokumenta — nova družina)"
need_static "FIZIČNA VALIDACIJA — issue #15 §3" "R284 PDF podnaslov (X1 — namen izrečen)"
need_static "Fizična ref. (mm)" "R284 fill-in stolpec glava (X1 — izpolnjevalna cona)"
need_static "Zapiski terena" "R284 fill-in stolpec glava (X1 — NIČ izmišljenih vrednosti)"
need_static "Izpolnjevalni list za fizično validacijo" "R284 navodilo sekcija (X1/X6 — neodvisni postopek)"
need_static "Terenska vrata (issue #14 §18)" "R284 statična protokolna sekcija (X7 — NIKOLI podatki)"
need_static "ar-android AFTER >= ar-android BEFORE" "R284 invariant opomba (issue #14 §19)"
need_static "Terenski-zapisni-" "R284 ime datoteke (družinski vzorec)"
echo "--- R284 MANDATORY STIL — gumb + legenda + bulk toggle (kanon R280–R283) ---"
need_static "Izvozi terenski zapisni list kot PDF" "R284 gumb aria-label"
need_static "Terenski zapisni list (issue #15 §3) — zapisane mere + prazni stolpci za fizično validacijo na terenu" "R284 gumb hover title (press-scale pariteta R269)"
need_static "ZAPISNI LIST = zapisane mere + prazni stolpci za fizično validacijo" "R284 legenda (pariteta R269 legenda)"
need_static "Skupinski način — masovno izbiranje meritev" "R284 bulk toggle title (a11y hover parity)"
echo "--- R284 fail-closed (iskren toast — X3) ---"
need_static "Terenski zapisni list se izvozi, ko je vpisana prva meritev" "R284 iskren toast opis (prazen seznam)"
need_static "Terenski zapisni list je projekt-obračunski" "R284 ni projekta toast (pariteta R269)"
need_static "Zapisni list prenešen v PDF" "R284 uspeh toast (WYSIWYG)"
"""
assert marker in src
src = src.replace(marker, r284 + marker)

# 4) must_miss TODO-R284 + končna vrstica
old_mm = 'must_miss "TODO-R282" "R282 — brez razvojnih ostankov"'
new_mm = 'must_miss "TODO-R284" "R284 — brez razvojnih ostankov"\nmust_miss "TODO-R283" "R283 — brez razvojnih ostankov"\nmust_miss "TODO-R282" "R282 — brez razvojnih ostankov"'
assert old_mm in src
src = src.replace(old_mm, new_mm)

old_end = 'echo "NEEDLE FAIL=$FAIL (R283 ×5 novih;'
new_end = 'echo "NEEDLE FAIL=$FAIL (R284 ×16 novih; R283 ×5;'
assert old_end in src
src = src.replace(old_end, new_end)

open(DST, 'w', encoding='utf-8').write(src)
print("OK — r284-build-needles.sh zapisan")
