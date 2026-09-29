#!/usr/bin/env python3
"""R282 — generator skript (kanon gen-r281-skripte.py):
  1. r282-build-needles.sh  — r281 needle set + R282 sekcija (mini-vrstica + akcijski žig)
  2. r282-run-smoke.sh      — dimni test (vzorec r281)
  3. r282-prod-qa.sh        — build-guard (> R281 12:13:06.665Z EPOCH) + R282 LIVE needleji
  4. r282-e2e-browser.sh    — r281 E2E tok + Z1m sync mini-vrstica ŽIVO
"""
ROOT = '/home/z/my-project'
SCRIPTS = ROOT + '/scripts'


def beri(pot):
    with open(pot, encoding='utf-8') as f:
        return f.read()


def pisi(pot, vsebina):
    with open(pot, 'w', encoding='utf-8') as f:
        f.write(vsebina)
    print('  napisana:', pot)


# ---------------------------------------------------- 1. build-needles (r281 + R282)
B281 = beri(SCRIPTS + '/r281-build-needles.sh')
R282_SEKCIJA = '''echo "--- R282 MANDATORY — F2 sync mini-vrstica + akcijski žig (issue #16 §10, V3) ---"
need_static "Sync (viden seznam): " "R282 mini-vrstica glava (števec sync metadata — EN VIR filteredMeasurements)"
need_static "sinhroniziranih · " "R282 mini segmenti (sinhroniziranih/čakajoči/konfliktov/napak)"
need_static "Konflikt — osveži bazo in ponovi sync" "R282 akcijski žig (konflikti > 0 — obstoječi /api/sync razreši)"
need_static "Sinhronizacijsko stanje vidnega seznama (issue #16 §10)" "R282 mini hover title (provenance — NI sync resnica)"
echo "--- R281 sync metadata (issue #16 §10 — kontrakt, server chunks, V1–V6) ---"'''
B282 = B281.replace('echo "--- R281 sync metadata (issue #16 §10 — kontrakt, server chunks, V1–V6) ---"', R282_SEKCIJA, 1)
B282 = B282.replace('# R281 — build needleji:', '# R282 — build needleji:', 1)
B282 = B282.replace('OUT=/tmp/r281-build-chunks', 'OUT=/tmp/r282-build-chunks', 1)
B282 = B282.replace('must_miss "TODO-R281" "R281 — brez razvojnih ostankov"',
                    'must_miss "TODO-R282" "R282 — brez razvojnih ostankov"\nmust_miss "TODO-R281" "R281 — brez razvojnih ostankov"', 1)
B282 = B282.replace('echo "NEEDLE FAIL=$FAIL (R281 ×13 novih;', 'echo "NEEDLE FAIL=$FAIL (R282 ×4 novih; R281 ×13;', 1)
pisi(SCRIPTS + '/r282-build-needles.sh', B282)

# ---------------------------------------------------- 2. run-smoke
S281 = beri(SCRIPTS + '/r281-run-smoke.sh')
S282 = S281.replace('# R281 dimni test', '# R282 dimni test', 1)
S282 = S282.replace(
    'build z R281 spremembami (sync metadata session-level blok — issue #16 §10,\n# V1–V6 + sync žig stil) vstane in odgovarja fail-closed.',
    'build z R282 spremembami (F2 sync mini-vrstica + akcijski žig — issue #16\n# §10 V3 + F/G vrata testi) vstane in odgovarja fail-closed.', 1)
S282 = S282.replace('R281-smoke-lokalni-sekret', 'R282-smoke-lokalni-sekret', 1)
S282 = S282.replace('R281-server-smoke.log', 'R282-server-smoke.log', 1)
S282 = S282.replace('--- R281 SMOKE KONEC ---', '--- R282 SMOKE KONEC ---', 1)
pisi(SCRIPTS + '/r282-run-smoke.sh', S282)

# ---------------------------------------------------- 3. prod-qa (r281 + R282)
P281 = beri(SCRIPTS + '/r281-prod-qa.sh')
P282 = P281.replace('# R281 — PRVA naloga (worklog R281): potrditi R281 na produ (R279/R280 ŽIVO\n# dokazana r280-prod-qa; R281 build = 2026-09-29T12:13:06.665Z, ~20 s po pushu',
                    '# R282 — PRVA naloga (worklog R282): potrditi R282 na produ (R281 ŽIVO\n# dokazan r281-prod-qa; R282 build po pushu 4e5a138 naslednika — meja > R281 build 12:13:06.665Z', 1)
P282 = P282.replace("meja = datetime.fromisoformat('2026-09-29T11:24:57.844+00:00')",
                    "meja = datetime.fromisoformat('2026-09-29T12:13:06.665+00:00')", 1)
P282 = P282.replace('R281 NI ŠE DEPLOYAN (build ≤ R280 11:24:57.844Z)', 'R282 NI ŠE DEPLOYAN (build ≤ R281 12:13:06.665Z)', 1)
P282 = P282.replace('R281 deploy potrjen (build $BUILD > R280 11:24:57.844Z)', 'R282 deploy potrjen (build $BUILD > R281 12:13:06.665Z)', 1)
P282 = P282.replace('echo "=== Z0: prod build-guard — R281 deploy detekcija (EPOCH primerjava) ==="',
                    'echo "=== Z0: prod build-guard — R282 deploy detekcija (EPOCH primerjava) ==="', 1)
R282_NEEDLES = '''echo "--- R282 MANDATORY (LIVE — PRVA naloga R283) ---"
need "Sync (viden seznam): " "R282 mini-vrstica glava — LIVE"
need "Konflikt — osveži bazo in ponovi sync" "R282 akcijski žig — LIVE"
need "Sinhronizacijsko stanje vidnega seznama (issue #16 §10)" "R282 mini hover title — LIVE"
echo "--- R281 sync metadata (issue #16 §10 — LIVE) ---"'''
P282 = P282.replace('echo "--- R281 sync metadata (issue #16 §10 — LIVE, PRVA naloga R282) ---"', R282_NEEDLES, 1)
P282 = P282.replace('must_miss "TODO-R281" "R281 — brez razvojnih ostankov (izginil)"',
                    'must_miss "TODO-R282" "R282 — brez razvojnih ostankov (izginil)"\nmust_miss "TODO-R281" "R281 — brez razvojnih ostankov (izginil)"', 1)
P282 = P282.replace('=== R281 PROD QA — R280 ŽIVO POTRJEN ===', '=== R282 PROD QA — R281+R282 ŽIVO ===', 1)
P282 = P282.replace("fetch('/api/measurements/r281-ne-obstojeci-id-probe/verzije'", "fetch('/api/measurements/r282-ne-obstojeci-id-probe/verzije'", 1)
P282 = P282.replace("'r281-prod-v99-probe-'+Date.now(),customerName:'r281 probe v99'", "'r282-prod-v99-probe-'+Date.now(),customerName:'r282 probe v99'", 1)
P282 = P282.replace('/tmp/r281-z1.json', '/tmp/r282-z1.json').replace('/tmp/r281-z1b.json', '/tmp/r282-z1b.json').replace('/tmp/r281-z3.json', '/tmp/r282-z3.json')
P282 = P282.replace('/tmp/r281-chunkurls', '/tmp/r282-chunkurls')
P282 = P282.replace('OUT=/tmp/r281-prod-chunks', 'OUT=/tmp/r282-prod-chunks', 1)
pisi(SCRIPTS + '/r282-prod-qa.sh', P282)

# ---------------------------------------------------- 4. e2e-browser (r281 + Z1m)
E281 = beri(SCRIPTS + '/r281-e2e-browser.sh')
E282 = E281.replace('# R281 E2E ŽIVO (lokalni :3100, ADMIN) — R281 §10: sync žig ŽIVO (synced r7\n# + conflict tombstone — hover parity); R280 tip/kot badge + R279/R278 +',
                    '# R282 E2E ŽIVO (lokalni :3100, ADMIN) — R282 §10: F2 sync mini-vrstica ŽIVO\n# (števec + grobnice + akcijski žig) + R281 sync žig; R280 tip/kot badge +', 1)
E282 = E282.replace("export SESSION_SECRET=\"${SESSION_SECRET:-r281-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}\"",
                    "export SESSION_SECRET=\"${SESSION_SECRET:-r282-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}\"", 1)
E282 = E282.replace('R281-server-e2e.log', 'R282-server-e2e.log', 1)
E282 = E282.replace('/tmp/r281-z1.json', '/tmp/r282-z1.json').replace('/tmp/r281-z1s.json', '/tmp/r282-z1s.json')
E282 = E282.replace('/tmp/r281-z2', '/tmp/r282-z2').replace('/tmp/r281-z3', '/tmp/r282-z3').replace('/tmp/r281-z5', '/tmp/r282-z5')
E282 = E282.replace('/tmp/r281-fp-', '/tmp/r282-fp-')
E282 = E282.replace('qa-r281-e2e-', 'qa-r282-e2e-')
Z1M = '''
echo "=== Z1m: F2 SYNC MINI-VRSTICA ŽIVO (R282 §10) — števec + grobnice + akcijski žig ==="
agent-browser eval "(()=>{const mini=[...document.querySelectorAll('span.tabular-nums.cursor-help')].find(x=>(x.textContent||'').startsWith('Sync (viden seznam):')); const akcija=[...document.querySelectorAll('span')].find(x=>(x.textContent||'')==='Konflikt — osveži bazo in ponovi sync'); return JSON.stringify({mini:mini?mini.textContent.trim():null, miniTitle:mini?(mini.getAttribute('title')||'').slice(0,50):null, akcija:!!akcija, akcijaTitle:akcija?(akcija.getAttribute('title')||'').slice(0,45):null, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r282-z1m.json
python3 -c "
import json
r = json.load(open('/tmp/r282-z1m.json')); d = json.loads(r) if isinstance(r, str) else r
assert d['mini'], 'Z1m mini FAIL (ni vrstice): ' + json.dumps(d)
assert d['mini'].startswith('Sync (viden seznam): 1 sinhroniziranih · 0 čakajoči · 1 konfliktov · 0 napak · 1 grobnic'), 'Z1m mini vsebina FAIL (m1 synced + m2 conflict/tombstone): ' + json.dumps(d)
assert d['miniTitle'].startswith('Sinhronizacijsko stanje vidnega seznama'), 'Z1m mini title FAIL: ' + json.dumps(d)
assert d['akcija'] and d['akcijaTitle'].startswith('Odprti sync konflikt'), 'Z1m akcijski žig FAIL: ' + json.dumps(d)
assert d['err'] is None, 'Z1m err: ' + json.dumps(d)
print('Z1m OK — F2 sync mini-vrstica ŽIVO (1 synced · 1 konflikt · 1 grobnica) + akcijski žig + hover title')" || exit 1
agent-browser screenshot "$SS/qa-r282-e2e-sync-mini.png" > /dev/null 2>&1

echo "=== Z2: Popravi tok ŽIVO'''
E282 = E282.replace('\necho "=== Z2: Popravi tok ŽIVO', Z1M, 1)
E282 = E282.replace('echo "=== R281 E2E KONEC ==="', 'echo "=== R282 E2E KONEC ==="', 1)
pisi(SCRIPTS + '/r282-e2e-browser.sh', E282)

print('OSNOVA OK — 4/4 skript')
