#!/usr/bin/env python3
# gen-r280-skripte.py — ustvari r280-{build-needles,run-smoke,prod-qa,e2e-browser}.sh
# iz r279 predlog z R280 modifikacijami (lekcija kanon: generator, ne ročne kopije).
import re, os

S = '/home/z/my-project/scripts'

# ---------- 1) build-needles ----------
src = open(f'{S}/r279-build-needles.sh').read()
out = src.replace('/tmp/r279-build-chunks', '/tmp/r280-build-chunks')
# glava
out = out.replace(
    """# R279 — build needleji: (1) SEGMENT PHOTO/GLB POVEZAVE (issue #16 §9 —
# photoIds/modelIds aditivna v1, T1–T5: wire polja + superRefine žig
# 'osirotelih referenc' + matrika T1–T5; verzija ostane 1);
# (2) MANDATORY STIL — segmentId Badge title (issue #16 §1 identiteta);
# (3) R278 regresija (stil title ×3 + startMm/endMm + Q/S matrika).""",
    """# R280 — build needleji: (1) SEGMENT PRODUKT REFERENCE (issue #16 §3 —
# profile/color/material/handrail/posts/configuration aditivna v1, U1–U6:
# matrika U1–U6 + razmejitev kontrakt vs. business; verzija ostane 1);
# (2) MANDATORY STIL — tip badge title ×10 + kot badge title (hover parity);
# (3) R279/R278/R277/… regresije (parent: r279-build-needles.sh).""")
# R280 needleji — vstavimo PRED R279 sekcijo
r280_block = '''echo "--- R280 produkt reference (issue #16 §3 — kontrakt, U1–U6) ---"
need_static "segments[].profile/color/material/handrail/posts/configuration" "R280 matrika razširitev žig (izrečno — U1 aditivna v1)"
need_static "razmejitev kontrakt vs. business" "R280 U3 razmejitev žig (provenance — NIKOLI business resnica)"
need_static "U1–U6" "R280 matrika U-serija (izrečno)"
echo "--- R280 MANDATORY STIL — tip badge title ×10 + kot badge title (hover parity) ---"
need_static "Vrsta meritve: Razdalja" "R280 tip badge title RAZDALJA"
need_static "Vrsta meritve: Višina" "R280 tip badge title VISINA"
need_static "Vrsta meritve: Kot — izmerjen kot v stopinjah" "R280 tip badge title KOT"
need_static "Vrsta meritve: Nagib" "R280 tip badge title NAGIB"
need_static "Vrsta meritve: Globina" "R280 tip badge title GLOBINA"
need_static "Vrsta meritve: Premer" "R280 tip badge title PREMER"
need_static "Vrsta meritve: Segment" "R280 tip badge title SEGMENT"
need_static "Vrsta meritve: Vogal" "R280 tip badge title KOT_VOGAL"
need_static "Vrsta meritve: Kot stopnice" "R280 tip badge title KOT_STOPNISCE"
need_static "Vrsta meritve: Stebriček/Palica" "R280 tip badge title STEBR"
need_static "privzeti pravi kot 90° se ne označuje" "R280 kot badge title (odstopanja — verbatim)"
'''
out = out.replace('echo "--- R279 photo/GLB povezave (issue #16 §9 — kontrakt) ---"',
                  r280_block + 'echo "--- R279 photo/GLB povezave (issue #16 §9 — kontrakt, regresija) ---"')
out = out.replace('must_miss "TODO-R279" "R279 — brez razvojnih ostankov"',
                  'must_miss "TODO-R280" "R280 — brez razvojnih ostankov"\nmust_miss "TODO-R279" "R279 — brez razvojnih ostankov"')
# popravi podvojeni echo iz r279 (kozmetika)
out = out.replace('echo "--- R278 start/end + quality (regresija — kontrakt) ---"\necho "--- R278 start/end koordinati + per-segment quality (issue #16 §3 — kontrakt) ---"',
                  'echo "--- R278 start/end koordinati + per-segment quality (issue #16 §3 — regresija) ---"')
out = out.replace('echo "NEEDLE FAIL=$FAIL (R279 ×5 novih',
                  'echo "NEEDLE FAIL=$FAIL (R280 ×15 novih; R279 ×5')
open(f'{S}/r280-build-needles.sh', 'w').write(out)
os.chmod(f'{S}/r280-build-needles.sh', 0o755)

# ---------- 2) run-smoke ----------
src = open(f'{S}/r279-run-smoke.sh').read()
out = src.replace('R279', 'R280')
out = out.replace(
    'build z R280 spremembami (photoIds/modelIds + superRefine (issue #16 §9,\n# T1–T5) + segmentId Badge title stil)',
    'build z R280 spremembami (produkt reference profile/color/material/\n# handrail/posts/configuration — issue #16 §3, U1–U6 + tip/kot badge title stil)')
open(f'{S}/r280-run-smoke.sh', 'w').write(out)
os.chmod(f'{S}/r280-run-smoke.sh', 0o755)

# ---------- 3) prod-qa ----------
src = open(f'{S}/r279-prod-qa.sh').read()
out = src.replace('/tmp/r279-', '/tmp/r280-')
out = out.replace('/tmp/r278-prod-chunks', '/tmp/r280-prod-chunks')
out = out.replace(
    """# R279 — PRVA naloga (worklog R278): potrditi R278 na produ.
#   Z0  build-guard: health build > R277 build (2026-09-29T09:43:23Z) — R277
#       build = NI ŠE R278 → abort (needleji bi lažno FAILali).""",
    """# R280 — PRVA naloga (worklog R279): potrditi R279 na produ.
#   Z0  build-guard: health build > R278 build (2026-09-29T10:19:49Z) — R278
#       build = NI ŠE R279 → abort (needleji bi lažno FAILali).""")
out = out.replace(
    """case "$BUILD" in
  2026-09-29T09:43:23*|2026-09-2[0-9]T0[0-8]*)
    echo "R278 NI ŠE DEPLOYAN (build $BUILD ≤ R277 09:43:23Z) — needleji bi lažno FAILali"; exit 1;;
  *)
    echo "R278 deploy potrjen (build $BUILD > R277 09:43:23Z) — probe DOVOLJEN";;
esac""",
    """case "$BUILD" in
  2026-09-29T10:19:49*|2026-09-29T10:[01]*|2026-09-29T09*|2026-09-2[0-8]T*)
    echo "R279 NI ŠE DEPLOYAN (build $BUILD ≤ R278 10:19:49Z) — needleji bi lažno FAILali"; exit 1;;
  *)
    echo "R279 deploy potrjen (build $BUILD > R278 10:19:49Z) — probe DOVOLJEN";;
esac""")
# Z1 — R280 stil probe (pogojno po kanonu r277/r279)
out = out.replace(
    '''if eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\\"Pokaži zgodovino verzij meritve\\"]');})()" 16; then
  eb_cakaj 2
  agent-browser eval "(()=>{const pill=[...document.querySelectorAll('span')].find(x=>/^v\\\\d+$/.test(x.textContent.trim())); const hist=document.querySelector('button[aria-label^=\\"Pokaži zgodovino verzij meritve\\"]'); const popravi=document.querySelector('button[aria-label^=\\"Popravi meritev \\"]'); return JSON.stringify({pill:!!pill, histBtn:!!hist, popraviBtn:!!popravi, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r280-z1.json
  python3 -c "import json; r=json.load(open('/tmp/r280-z1.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pill'] and d['histBtn'] and d['popraviBtn'], 'Z1 UI FAIL: '+json.dumps(d); print('Z1 OK — verzija pill + gumba ŽIVO na produ')" || exit 1''',
    '''if eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\\"Pokaži zgodovino verzij meritve\\"]');})()" 16; then
  eb_cakaj 2
  agent-browser eval "(()=>{const pill=[...document.querySelectorAll('span')].find(x=>/^v\\\\d+$/.test(x.textContent.trim())); const hist=document.querySelector('button[aria-label^=\\"Pokaži zgodovino verzij meritve\\"]'); const popravi=document.querySelector('button[aria-label^=\\"Popravi meritev \\"]'); const tipBadge=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.getAttribute('title')||'').startsWith('Vrsta meritve:')); return JSON.stringify({pill:!!pill, histBtn:!!hist, popraviBtn:!!popravi, tipBadge:tipBadge?(tipBadge.getAttribute('title')||'').slice(0,40):null, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r280-z1.json
  python3 -c "import json; r=json.load(open('/tmp/r280-z1.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pill'] and d['histBtn'] and d['popraviBtn'], 'Z1 UI FAIL: '+json.dumps(d); tip = 'R280 tip badge stil ŽIVO (' + d['tipBadge'] + ' …)' if d['tipBadge'] else 'R280 OPOMBA: tip badge NE prisoten — spot portfel podatkovna resnica (pogojni probe po kanonu r277 Z1)'; print('Z1 OK — verzija pill + gumba ŽIVO na produ · ' + tip)" || exit 1''')
# Z2 needleji — R280 LIVE sekcija
out = out.replace(
    '''echo "--- R278 stil + kontrakt (LIVE — PRVA naloga R279) ---"''',
    '''echo "--- R280 stil (LIVE — PRVA naloga R280) ---"
need "Vrsta meritve: Razdalja" "R280 tip badge title RAZDALJA — LIVE"
need "Vrsta meritve: Višina" "R280 tip badge title VISINA — LIVE"
need "Vrsta meritve: Stebriček/Palica" "R280 tip badge title STEBR — LIVE"
need "privzeti pravi kot 90° se ne označuje" "R280 kot badge title — LIVE"
echo "--- R278 stil + kontrakt (LIVE — regresija) ---"''')
out = out.replace('echo "=== R279 PROD QA — R278 ŽIVO POTRJEN ==="',
                  'echo "=== R280 PROD QA — R279 ŽIVO POTRJEN ==="')
out = out.replace("id:'r279-prod-v99-probe-'+Date.now(),customerName:'r279 probe v99'",
                  "id:'r280-prod-v99-probe-'+Date.now(),customerName:'r280 probe v99'")
open(f'{S}/r280-prod-qa.sh', 'w').write(out)
os.chmod(f'{S}/r280-prod-qa.sh', 0o755)

# ---------- 4) e2e-browser ----------
src = open(f'{S}/r279-e2e-browser.sh').read()
out = src.replace('/tmp/r279-', '/tmp/r280-').replace('/tmp/R279-', '/tmp/R280-')
out = out.replace('r279-e2e-lokalni-sekret', 'r280-e2e-lokalni-sekret')
out = out.replace('e2e-r276-proj', 'e2e-r276-proj')
out = out.replace('qa-r279-e2e-', 'qa-r280-e2e-')
out = out.replace(
    """# R279 E2E ŽIVO (lokalni :3100, ADMIN) — R279 stil: segmentId Badge title
# (issue #16 §1 identiteta); R278 vir pill title + R277 teren PDF +
# R276 verzije tok = regresija:
#   Z1: verzija pill 'v1' + vir 'Ročni vnos' + R278/R279 stil ŽIVO;""",
    """# R280 E2E ŽIVO (lokalni :3100, ADMIN) — R280 stil: tip badge title ×10 +
# kot badge title (hover parity); R279 segmentId Badge + R278 vir pill +
# R277 teren PDF + R276 verzije tok = regresija:
#   Z1: verzija pill 'v1' + vir 'Ročni vnos' + R280/R279/R278 stil ŽIVO;""")
# Z1 eval — dodaj R280 tip badge probe
out = out.replace(
    "const segBadge=[...document.querySelectorAll('.cursor-help')].some(x=>(x.getAttribute('title')||'').startsWith('Pripada segmentu'))",
    "const segBadge=[...document.querySelectorAll('.cursor-help')].some(x=>(x.getAttribute('title')||'').startsWith('Pripada segmentu')); const tipBadge=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.getAttribute('title')||'').startsWith('Vrsta meritve:')); const tipBadgeTitle=tipBadge?(tipBadge.getAttribute('title')||'').slice(0,30):null; const kotBadge=[...document.querySelectorAll('.cursor-help')].some(x=>(x.getAttribute('title')||'').includes('privzeti pravi kot 90°'))")
out = out.replace(
    "return JSON.stringify({pill:!!pill, pillHelp:pill?pill.className.includes('cursor-help'):false, pillTitle:pill?(pill.getAttribute('title')||'').includes('prvi vpis v verigi'):false, vir:!!vir, virHelp:vir?vir.className.includes('cursor-help'):false, virTitle:vir?(vir.getAttribute('title')||'').startsWith('Vir podatkov: Ročni vnos'):false",
    "return JSON.stringify({pill:!!pill, pillHelp:pill?pill.className.includes('cursor-help'):false, pillTitle:pill?(pill.getAttribute('title')||'').includes('prvi vpis v verigi'):false, vir:!!vir, virHelp:vir?vir.className.includes('cursor-help'):false, virTitle:vir?(vir.getAttribute('title')||'').startsWith('Vir podatkov: Ročni vnos'):false, tipBadgeTitle, kotBadge")
out = out.replace(
    "seg = 'Z1 R279 segmentId Badge stil ŽIVO (title Pripada segmentu …)' if d['segBadge'] else 'Z1 R279 OPOMBA: segmentId Badge NE prisoten — seed meritev ima arMetadata BREZ segmentId (iskrena praznina = pravilna UI); wire dokazan v r279-build-needles'; print('Z1 OK — v1 pill + vir title (R278) + gumba · ' + seg)",
    "tip = 'R280 tip badge stil ŽIVO (' + str(d['tipBadgeTitle']) + ' …)' if d['tipBadgeTitle'] else 'R280 OPOMBA: tip badge NE prisoten — podatkovna resnica (pogojni probe)'; seg = ' · R279 segmentId Badge stil ŽIVO' if d['segBadge'] else ''; print('Z1 OK — v1 pill + vir title (R278) + gumba · ' + tip + seg)")
open(f'{S}/r280-e2e-browser.sh', 'w').write(out)
os.chmod(f'{S}/r280-e2e-browser.sh', 0o755)

print('OK — 4 skripte ustvarjene:')
for f in ['r280-build-needles.sh', 'r280-run-smoke.sh', 'r280-prod-qa.sh', 'r280-e2e-browser.sh']:
    print(' ', f, len(open(f'{S}/{f}').read()), 'bajtov')
