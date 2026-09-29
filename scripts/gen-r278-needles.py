#!/usr/bin/env python3
"""Izpelji scripts/r278-build-needles.sh iz r277-build-needles.sh:
- glava/sklop zamenjan (R278 izrečno), OUT pot r278;
- R278 needleji (×6) vstavljeni PRED R277 sekcijo;
- must_miss TODO-R278 dodan;
- zaključna vrstica posodobljena.
Kanon R270 l2: needleji ZUNAJ loop telesa, definicija PRED uporabo."""
src = open('scripts/r277-build-needles.sh').read()

# 1) glava
src = src.replace(
    '''#!/bin/bash
# R277 — build needleji: (1) SEGMENT KOT v AR kontraktu (issue #16 §3 —
# angleDeg aditivna v1, P1–P6: 'angleDeg' wire + azimut žig; verzija ostane
# 1 — matrika razširitev); (2) TERENSKI PDF verzija+vir stolpca (issue #16 §6
# — 10-stolpčna glava, vN prikaz, MERITEV_VIR_LABELS, sklep veriga korekcij,
# legacy '—' iskren odpad; CSV kontrakt NIČ).
# + R275/R274/R273/…/R227 regresije (parent: r275-build-needles.sh viri).
# AWK STRUKTURNA PREVERBA (r270 lekcija 2 needleji-v-loopu → lažno zeleno).
set -u
cd /home/z/my-project
OUT=/tmp/r277-build-chunks''',
    '''#!/bin/bash
# R278 — build needleji: (1) SEGMENT START/END koordinati v AR kontraktu
# (issue #16 §3 — startMm/endMm aditivna v1, Q1–Q6: tuple wire + matrika
# razširitev žig; verzija ostane 1); (2) PER-SEGMENT QUALITY (S1–S6 —
# confidence/uncertaintyMm; matrika žig Q1–Q6/S1–S6); (3) MANDATORY STIL —
# vir pill title ×3 (hover parity z verzija pill — R275 kanon).
# + R277/R276/R275/R274/R273/…/R227 regresije (parent: r277-build-needles.sh
# viri).
# AWK STRUKTURNA PREVERBA (r270 lekcija 2 needleji-v-loopu → lažno zeleno).
set -u
cd /home/z/my-project
OUT=/tmp/r278-build-chunks''')

# 2) R278 sekcija pred R277
r278_section = '''echo "--- R278 start/end koordinati + per-segment quality (issue #16 §3 — kontrakt) ---"
need_static "startMm" "R278 segments[].startMm wire polje (Q1–Q6 — aditivna v1)"
need_static "endMm" "R278 segments[].endMm wire polje (Q1–Q6 — aditivna v1)"
need_static "Q1–Q6/S1–S6" "R278 matrika razširitev žig (Q+S serija izrečno — R277+R278)"
echo "--- R278 MANDATORY STIL — vir pill title ×3 (hover parity) ---"
need_static "Vir podatkov: Ročni vnos" "R278 vir pill title MANUAL (izpeljan na strežniku — klient ne more ponarejati)"
need_static "Vir podatkov: Foto-CV" "R278 vir pill title PHOTO_CV"
need_static "Vir podatkov: AR-Depth" "R278 vir pill title ARCORE_DEPTH"
echo "--- R277 segment kot (regresija — LIVE na produ potrdil r278-prod-qa) ---"
'''
src = src.replace('echo "--- R277 segment kot (issue #16 §3 — kontrakt, server chunks) ---"', r278_section + 'echo "--- R277 segment kot (issue #16 §3 — kontrakt, server chunks) ---"')

# 3) must_miss + zaključna vrstica
src = src.replace(
    'must_miss "to-[#2a3f5f]" "must_miss to-[#2a3f5f]"',
    'must_miss "TODO-R278" "R278 — brez razvojnih ostankov"\nmust_miss "to-[#2a3f5f]" "must_miss to-[#2a3f5f]"')
src = src.replace(
    'echo "NEEDLE FAIL=$FAIL (R276 ×15 novih + R275 ×3 + R274 ×13 + R273 ×27 + R272 ×25 + R271 ×26 + R270 ×25 + R269 ×18 + R268 ×17 + R267 ×9 + R266 ×9 + R265 ×7 + R264 ×5 + R263 ×4 + regresije)"',
    'echo "NEEDLE FAIL=$FAIL (R278 ×6 novih + R277 ×9 + R276 ×15 + R275 ×3 + R274 ×13 + R273 ×27 + R272 ×25 + R271 ×26 + R270 ×25 + R269 ×18 + R268 ×17 + R267 ×9 + R266 ×9 + R265 ×7 + R264 ×5 + R263 ×4 + regresije)"')

open('scripts/r278-build-needles.sh', 'w').write(src)
print('r278-build-needles.sh generiran (iz r277, R278 ×6 + must_miss TODO-R278)')
