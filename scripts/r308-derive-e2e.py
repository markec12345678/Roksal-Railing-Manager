#!/usr/bin/env python3
# R308 — derive r308-e2e-browser.sh IZ r307-e2e-browser.sh:
#   (1) ciljane preimenitve (poti/sekret/slike) — regresijske oznake R307
#       ZADRŽANE (opisujejo R307 funkcijo, ki jo regresija preverja);
#   (2) NOV Z0ag probe: API I/O MEJA ŽIVO — pokvarjen JSON → fail-closed 400
#       { error } ovojnica (NIKOLI 500) na 3 varnih compute endpoints
#       (calculator — R308 popravljen exemplar; railing-layout; quote — že
#       pravilna). ZERO-MUTACIJA: validacija-only, nič db zapisa.
import sys

SRC = "/home/z/my-project/scripts/r307-e2e-browser.sh"
DST = "/home/z/my-project/scripts/r308-e2e-browser.sh"

s = open(SRC, encoding="utf-8").read()

def sub_all(old, new, label, expect_min=1):
    global s
    n = s.count(old)
    if n < expect_min:
        print(f"FAIL-CLOSED: '{label}' pričakovano >= {expect_min}, najdeno {n}")
        sys.exit(1)
    s = s.replace(old, new)
    print(f"OK   [{label}] {n} zamenjav")

def sub_once(old, new, label):
    sub_all(old, new, label, expect_min=1) if False else None
    global s
    n = s.count(old)
    if n != 1:
        print(f"FAIL-CLOSED: '{label}' pričakovana 1 pojavnost, najdeno {n}")
        sys.exit(1)
    s = s.replace(old, new)
    print(f"OK   [{label}] 1 zamenjava")

# --- (1) ciljane preimenitve ---
sub_all("/tmp/r307-", "/tmp/r308-", "/tmp/r307- poti", expect_min=10)
sub_once("r307-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!", "r308-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!", "sekret")
sub_all("qa-r307-e2e-", "qa-r308-e2e-", "slike prefiks", expect_min=3)
sub_once("/tmp/R307-server-e2e.log", "/tmp/R308-server-e2e.log", "strežniški log")
sub_once('echo "=== R307 E2E KONEC ==="', 'echo "=== R308 E2E KONEC ==="', "zaključni banner")

# --- header: naslovna vrstica + Z0ag v seznam ---
sub_once("# R307 E2E ŽIVO (lokalni :3100, ADMIN) — KONFLIKTNI DOKAZ NA ZASLONU (37. člen",
         "# R308 E2E ŽIVO (lokalni :3100, ADMIN) — API I/O MEJA ŽIVO (38. člen issue #1:\n"
         # Z0ag opis pride pod glavo — glej vstavitve spodaj)
         "   Z0ag: MEJA ŽIVO — pokvarjen JSON na 3 compute endpoints → fail-closed\n"
         "        400 { error } (NIKOLI 500); calculator = R308 popravljen exemplar\n"
         "        (500-nad-malformed izboljšan na 400), railing-layout + quote že\n"
         "        pravilna — wire-level dokaz. ZERO-MUTACIJA: nič db zapisa.\n"
         "# [R307 prej] KONFLIKTNI DOKAZ NA ZASLONU (37. člen", "header naslov")

# --- (2) Z0ag block — vstavljen PRED Z1 ---
z0ag = '''echo "=== Z0ag: API I/O MEJA ŽIVO (R308 — 38. člen issue #1, «stena ura»; ZERO-MUTACIJA) ==="
# Pokvarjen JSON (sintaksa napaka) + napačna oblika (null telo) morata dobiti
# fail-closed 400 z { error } ovojnico — NIKOLI 500 (napaka odjemalca ni napaka
# strežnika). calculator je R308 popravljen exemplar (prej: parse-throw → 500);
# railing-layout + quote imata json().catch + zod safeParse (že pravilno).
agent-browser eval "(()=>{window.__meja=[]; const p=(ime,url,telo)=>fetch(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:telo}).then(async r=>{let b=null; try{b=await r.json();}catch(e){b=null;} window.__meja.push({ime,status:r.status,error:b&&typeof b==='object'?(b.error??null):null});}).catch(e=>window.__meja.push({ime,status:0,error:'MREŽA: '+String(e)})); p('calculator-pokvarjen','/api/calculator','{pokvarjen'); p('calculator-null','/api/calculator','null'); p('railing-layout-pokvarjen','/api/railing-layout','{pokvarjen'); p('quote-pokvarjen','/api/quote','{pokvarjen'); return 'poslano';})()" 2>&1 | tail -1
eb_cakaj 3
agent-browser eval "JSON.stringify(window.__meja??[])" 2>&1 | tail -1 > /tmp/r308-z0ag.json
python3 - <<'PYEOF12' || exit 1
import json
raw = open('/tmp/r308-z0ag.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert isinstance(d, list) and len(d) == 4, 'Z0ag oblika: ' + json.dumps(d)
poImenu = {x['ime']: x for x in d}
# calculator — R308 exemplar: pokvarjen JSON in null telo → 400 { error } (prej 500)
for ime in ('calculator-pokvarjen', 'calculator-null'):
    x = poImenu[ime]
    assert x['status'] == 400, f'Z0ag {ime}: pričakovan 400 (fail-closed), dobljeno ' + str(x['status']) + ' — ' + json.dumps(x)
    assert isinstance(x['error'], str) and len(x['error']) > 0, f'Z0ag {ime}: manjkajoča {chr(123)} error {chr(125)} ovojnica: ' + json.dumps(x)
# railing-layout + quote — regresija (že pravilna)
for ime in ('railing-layout-pokvarjen', 'quote-pokvarjen'):
    x = poImenu[ime]
    assert x['status'] in (400, 422), f'Z0ag {ime}: pričakovan 400/422, dobljeno ' + str(x['status']) + ' — ' + json.dumps(x)
    assert isinstance(x['error'], str) and len(x['error']) > 0, f'Z0ag {ime}: ovojnica FAIL: ' + json.dumps(x)
print('Z0ag OK — stena ura ŽIVO: 4/4 pokvarjeni vhodi fail-closed 400 z ovojnico (NIČ 500)')
PYEOF12
agent-browser screenshot "$SS/qa-r308-e2e-z0ag-meja.png" > /dev/null 2>&1

'''
sub_once('echo "=== Z1: Meritve tab — verzija pill v1 + vir \'Ročni vnos\' + R269 mini title + VIRI MINI amber (r276 — regresija + R283 STIL) ==="',
         z0ag + 'echo "=== Z1: Meritve tab — verzija pill v1 + vir \'Ročni vnos\' + R269 mini title + VIRI MINI amber (r276 — regresija + R283 STIL) ==="',
         "Z0ag vstavitev pred Z1")

open(DST, "w", encoding="utf-8").write(s)
print(f"\nNAPISANO: {DST} ({len(s)} bajtov)")

# --- potrditve ---
import subprocess
def sh(*a): return subprocess.run(a, capture_output=True, text=True).stdout.strip()
checks = [
    (f"grep -c 'Z0ag' {DST}", lambda n: int(n) >= 3, "Z0ag blok prisoten"),
    (f"grep -c '/tmp/r307-' {DST}", lambda n: int(n) == 0, "NIČ /tmp/r307- ostankov"),
    (f"grep -c 'qa-r307-' {DST}", lambda n: int(n) == 0, "NIČ qa-r307- ostankov"),
    (f"grep -c 'r307-e2e-lokalni-sekret' {DST}", lambda n: int(n) == 0, "NIČ starega sekreta"),
    (f"grep -c 'R307' {DST}", lambda n: int(n) >= 3, "regresijske oznake R307 zadržane (opisi funkcij)"),
    (f"grep -c 'PYEOF12' {DST}", lambda n: int(n) == 2, "Z0ag heredoc tag par"),
]
ok = True
for cmd, pred, label in checks:
    out = sh("bash", "-c", cmd) or "0"
    good = pred(out)
    print(("OK   " if good else "FAIL ") + f"[{label}] = {out}")
    ok = ok and good
print("\nDERIVE: " + ("VSE ZELENE" if ok else "FAIL-CLOSED"))
sys.exit(0 if ok else 1)
