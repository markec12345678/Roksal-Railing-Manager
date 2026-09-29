#!/usr/bin/env python3
"""Izpelji R279 skripte iz R278 parentov (kanon: ista struktura, žige samo
R279-specifični). - build-needles: + R279 needleji ×5 (wire + stil)
  - run-smoke: sekret/log žig R279
  - e2e: Z1 stil probe razširjen (segmentId Badge title)
  - prod-qa: build-guard ≥ R278 žig + R278 stil needleji + r279 čanki."""
import re

# ---------- 1) r279-build-needles.sh ----------
s = open('scripts/r278-build-needles.sh').read()
s = s.replace('''#!/bin/bash
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
OUT=/tmp/r278-build-chunks''',
'''#!/bin/bash
# R279 — build needleji: (1) SEGMENT PHOTO/GLB POVEZAVE (issue #16 §9 —
# photoIds/modelIds aditivna v1, T1–T5: wire polja + superRefine žig
# 'osirotelih referenc' + matrika T1–T5; verzija ostane 1);
# (2) MANDATORY STIL — segmentId Badge title (issue #16 §1 identiteta);
# (3) R278 regresija (stil title ×3 + startMm/endMm + Q/S matrika).
# + R277/R276/R275/R274/R273/…/R227 regresije (parent: r278-build-needles.sh).
# AWK STRUKTURNA PREVERBA (r270 lekcija 2 needleji-v-loopu → lažno zeleno).
set -u
cd /home/z/my-project
OUT=/tmp/r279-build-chunks''')
r279_needles = '''echo "--- R279 photo/GLB povezave (issue #16 §9 — kontrakt) ---"
need_static "photoIds" "R279 segments[].photoIds wire polje (T1 — aditivna v1)"
need_static "modelIds" "R279 segments[].modelIds wire polje (T1 — aditivna v1)"
need_static "nič osirotelih referenc" "R279 superRefine fail-closed žig (T3 — referenčna integriteta)"
need_static "T1–T5" "R279 matrika razširitev žig (izrečno)"
echo "--- R279 MANDATORY STIL — segmentId Badge title (issue #16 §1) ---"
need_static "stabilen segmentId" "R279 Badge title (identiteta preživi re-anchor/offline/migracijo)"
echo "--- R278 start/end + quality (regresija — kontrakt) ---"
'''
s = s.replace('echo "--- R278 start/end koordinati + per-segment quality (issue #16 §3 — kontrakt) ---"', r279_needles + 'echo "--- R278 start/end koordinati + per-segment quality (issue #16 §3 — kontrakt) ---"')
s = s.replace('must_miss "TODO-R278" "R278 — brez razvojnih ostankov"', 'must_miss "TODO-R279" "R279 — brez razvojnih ostankov"')
s = s.replace('echo "NEEDLE FAIL=$FAIL (R278 ×6 novih', 'echo "NEEDLE FAIL=$FAIL (R279 ×5 novih + R278 ×6')
open('scripts/r279-build-needles.sh', 'w').write(s)

# ---------- 2) r279-run-smoke.sh ----------
s = open('scripts/r278-run-smoke.sh').read()
s = s.replace('''# R278 dimni test (vzorec r273) — standalone :3100 + javni health + prijavna
# rute + PWA manifest (brez DB mutacij — samo bralni pepperji). Potrjuje, da
# build z R278 spremembami (segment startMm/endMm + per-segment confidence/
# uncertaintyMm (issue #16 §3, Q1–Q6/S1–S6) + vir pill title stil) vstane in
# odgovarja fail-closed.''',
'''# R279 dimni test (vzorec r273) — standalone :3100 + javni health + prijavna
# rute + PWA manifest (brez DB mutacij — samo bralni pepperji). Potrjuje, da
# build z R279 spremembami (photoIds/modelIds + superRefine (issue #16 §9,
# T1–T5) + segmentId Badge title stil) vstane in odgovarja fail-closed.''')
s = s.replace('R278-smoke-lokalni-sekret-vsaj-32-znakov!!', 'R279-smoke-lokalni-sekret-vsaj-32-znakov!!')
s = s.replace('/tmp/R278-server-smoke.log', '/tmp/R279-server-smoke.log')
s = s.replace('R278 SMOKE KONEC', 'R279 SMOKE KONEC')
open('scripts/r279-run-smoke.sh', 'w').write(s)

# ---------- 3) r279-e2e-browser.sh ----------
s = open('scripts/r278-e2e-browser.sh').read()
s = s.replace('''# R278 E2E ŽIVO (lokalni :3100, ADMIN) — R278 stil: vir pill title +
# cursor-help (hover parity z verzija pill — R275 kanon); R277 terenski PDF
# verzija+vir + R276 verzije tok = regresija:
#   Z1: verzija pill 'v1' + vir 'Ročni vnos' + R278 vir pill title ŽIVO;''',
'''# R279 E2E ŽIVO (lokalni :3100, ADMIN) — R279 stil: segmentId Badge title
# (issue #16 §1 identiteta); R278 vir pill title + R277 teren PDF +
# R276 verzije tok = regresija:
#   Z1: verzija pill 'v1' + vir 'Ročni vnos' + R278/R279 stil ŽIVO;''')
s = s.replace('r278-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!', 'r279-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!')
s = s.replace('/tmp/R278-server-e2e.log', '/tmp/R279-server-e2e.log')
s = s.replace('/tmp/r278-', '/tmp/r279-')
s = s.replace('qa-r278-e2e-', 'qa-r279-e2e-')
s = s.replace('=== R278 E2E KONEC ===', '=== R279 E2E KONEC ===')
# Z1 eval: dodaj badge probe (segBadge + segTitle)
s = s.replace(
    "virHelp:vir?vir.className.includes('cursor-help'):false, virTitle:vir?(vir.getAttribute('title')||'').startsWith('Vir podatkov: Ročni vnos'):false, histBtn:!!hist",
    "virHelp:vir?vir.className.includes('cursor-help'):false, virTitle:vir?(vir.getAttribute('title')||'').startsWith('Vir podatkov: Ročni vnos'):false, segBadge:[...document.querySelectorAll('.cursor-help')].some(x=>(x.getAttribute('title')||'').startsWith('Pripada segmentu')), histBtn:!!hist")
# Z1 assert: + segBadge
s = s.replace(
    "assert d['virHelp'] and d['virTitle'], 'Z1 R278 vir stil FAIL: '+json.dumps(d); print('Z1 OK — v1 pill (cursor-help + title) + vir Ročni vnos + R278 vir pill title (cursor-help + Vir podatkov: …) + gumba')",
    "assert d['virHelp'] and d['virTitle'], 'Z1 R278 vir stil FAIL: '+json.dumps(d); assert d['segBadge'], 'Z1 R279 segmentId Badge stil FAIL: '+json.dumps(d); print('Z1 OK — v1 pill + vir title (R278) + segmentId Badge title (R279) + gumba')")
open('scripts/r279-e2e-browser.sh', 'w').write(s)

# ---------- 4) r279-prod-qa.sh ----------
s = open('scripts/r278-prod-qa.sh').read()
s = s.replace('''# R278 — PRVA naloga (worklog R277): potrditi R277 na produ.
#   Z0  build-guard: health build ≥ R277 deploy (2026-09-29T09:43:23Z) — R276
#       build 08:47:22Z = NI ŠE → abort (needleji bi lažno FAILali).''',
'''# R279 — PRVA naloga (worklog R278): potrditi R278 na produ.
#   Z0  build-guard: health build > R277 build (2026-09-29T09:43:23Z) — R277
#       build = NI ŠE R278 → abort (needleji bi lažno FAILali).''')
s = s.replace('R278-ne-obstojeci-id-probe', 'r279-ne-obstojeci-id-probe')
s = s.replace('r278-prod-v99-probe-', 'r279-prod-v99-probe-')
s = s.replace("customerName:'r278 probe v99'", "customerName:'r279 probe v99'")
s = s.replace('/tmp/r278-z1.json', '/tmp/r279-z1.json')
s = s.replace('/tmp/r278-z1b.json', '/tmp/r279-z1b.json')
s = s.replace('/tmp/r278-z3.json', '/tmp/r279-z3.json')
s = s.replace('/tmp/r278-chunkurls-raw.json', '/tmp/r279-chunkurls-raw.json')
s = s.replace('/tmp/r278-chunkurls.txt', '/tmp/r279-chunkurls.txt')
s = s.replace('R277 NI ŠE DEPLOYAN (build $BUILD ≤ R276 08:47:22Z)', 'R278 NI ŠE DEPLOYAN (build $BUILD = R277 09:43:23Z ali starejši)')
s = s.replace('''case "$BUILD" in
  2026-09-29T08:4[0-9]*|2026-09-2[0-9]T0[0-7]*)
    echo "R278 NI ŠE DEPLOYAN (build $BUILD = R277 09:43:23Z ali starejši) — needleji bi lažno FAILali"; exit 1;;
  *)
    echo "R277 deploy potrjen (build $BUILD) — probe DOVOLJEN";;
esac''',
'''case "$BUILD" in
  2026-09-29T09:43:23*|2026-09-2[0-9]T0[0-8]*)
    echo "R278 NI ŠE DEPLOYAN (build $BUILD ≤ R277 09:43:23Z) — needleji bi lažno FAILali"; exit 1;;
  *)
    echo "R278 deploy potrjen (build $BUILD > R277 09:43:23Z) — probe DOVOLJEN";;
esac''')
s = s.replace('echo "=== Z1: meritve tab ŽIVO — verzija pill + vir + gumba (pogojno — spot skoping resnica R277) ==="',
              'echo "=== Z1: meritve tab ŽIVO — verzija pill + vir + gumba (pogojno — spot skoping resnica R277/R278) ==="')
s = s.replace("print('Z1 OK — verzija pill + gumba ŽIVO na produ')",
              "print('Z1 OK — verzija pill + gumba ŽIVO na produ')")
# Z2: dodaj R278 stil needleji sekcijo pred R277 LIVE
s = s.replace('''echo "--- R277 teren PDF verzija+vir (LIVE — PRVA naloga R278) ---"''',
'''echo "--- R278 stil + kontrakt (LIVE — PRVA naloga R279) ---"
need "Vir podatkov: Ročni vnos" "R278 vir pill title MANUAL — LIVE"
need "Vir podatkov: Foto-CV" "R278 vir pill title PHOTO_CV — LIVE"
need "Vir podatkov: AR-Depth" "R278 vir pill title ARCORE_DEPTH — LIVE"
echo "--- R277 teren PDF verzija+vir (LIVE — regresija) ---"''')
s = s.replace('must_miss "TODO-R278" "R278 — brez razvojnih ostankov"', 'must_miss "TODO-R279" "R279 — brez razvojnih ostankov"')
s = s.replace('echo "=== R278 PROD QA — R277 ŽIVO POTRJEN ==="', 'echo "=== R279 PROD QA — R278 ŽIVO POTRJEN ==="')
open('scripts/r279-prod-qa.sh', 'w').write(s)

import os
for f in ['scripts/r279-build-needles.sh', 'scripts/r279-run-smoke.sh', 'scripts/r279-e2e-browser.sh', 'scripts/r279-prod-qa.sh']:
    os.chmod(f, 0o755)
print('r279 skripte generirane ×4')
