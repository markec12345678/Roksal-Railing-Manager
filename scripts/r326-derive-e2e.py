#!/usr/bin/env python3
# R326 — derive r326-e2e-browser.sh iz r324 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. Glava: Z0au opis (53. člen zgodovina cen ŽIVO — iskrena prazna veja)
#   2. Generacijske poti: /tmp/r324- ×142 → /tmp/r326- (+ R324-server ×1)
#   3. NOV Z0au blok (splice PO Z0at screenshotu): panel ŽIVO + iskrena
#      prazna veja (lokalna DB brez MaterialPrice — deterministično) +
#      wire-level GET zgodovine (200 + vir niz) — ZERO-MUTACIJA
#   4. Footer
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r324-e2e-browser.sh')
DOL = Path('/home/z/my-project/scripts/r326-e2e-browser.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava: Z0au opis (vstavljeno PRED Z0at opisom) ──
zam('#   Z0at: IZVOZ DNEVNEGA PREGLEDA VODJE KOT PDF ŽIVO (R324 NOVO — 52. člen',
    '#   Z0au: ZGODOVINA CEN MATERIALA ŽIVO (R326 NOVO — 53. člen issue #1 §5,\n'
    '#         price history): panel CenaZgodovinaPanel na inventory tabu —\n'
    '#         čisti bralec NOVEGA GET route /api/material-prices/zgodovina\n'
    '#         (r308 obseg 81→82); iskrena prazna veja (lokalna DB brez\n'
    '#         MaterialPrice — deterministično stanje: "Ni še zabeleženih\n'
    '#         cen" + CSV gumb skrit — brez podatkov NI izvoza, kanon vodje);\n'
    '#         wire-level GET: 200 + pregled.pari 0 + vir niz ŽIVO;\n'
    '#         ZERO-MUTACIJA (samo GET dispeči);\n'
    '#   Z0at: IZVOZ DNEVNEGA PREGLEDA VODJE KOT PDF ŽIVO (R324 NOVO — 52. člen', 1)

# ── 2. Generacijske poti ──
zam('/tmp/r324-', '/tmp/r326-', 142)
zam('/tmp/R324-server', '/tmp/R326-server', 1)

# ── 3. NOV Z0au blok (splice PO Z0at screenshotu) ──
Z0AU = '''
echo "=== Z0au: ZGODOVINA CEN MATERIALA ŽIVO (R326 — 53. člen issue #1 §5: price history; čisti bralec + iskrena prazna veja; ZERO-MUTACIJA) ==="
# inventory tab → panel CenaZgodovinaPanel (data-testid="cena-zgodovina-dokaz")
# → lokalna DB brez MaterialPrice (deterministično stanje): iskrena prazna
# veja "Ni še zabeleženih cen" + CSV gumb SKRIT (brez podatkov NI izvoza —
# kanon iskrene ničelne veje vodje R321/R324) + wire-level GET zgodovine:
# 200 + pregled.pari 0 + vnosov 0 + vir niz (CENA_ZGO_VIR_NIZ predpona)
# — ZERO-MUTACIJA (samo GET dispeči + DOM branje).
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('[data-testid=\\"cena-zgodovina-dokaz\\"]');})()" 24
eb_cakaj 2
agent-browser eval "JSON.stringify({panel:!!document.querySelector('[data-testid=\\"cena-zgodovina-dokaz\\"]'), naslov:(document.querySelector('[data-testid=\\"cena-zgodovina-dokaz\\"]')?.textContent||'').includes('Zgodovina cen materiala'), prazna:(document.querySelector('[data-testid=\\"cena-zgodovina-dokaz\\"]')?.textContent||'').includes('Ni še zabeleženih cen'), gumbSkrit:![...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Izvozi zgodovino cen materiala kot CSV')), err:window.__err??null})" 2>&1 | tail -1 > /tmp/r326-z0au-ui.json
python3 - <<'PYEOFZ0AU' || exit 1
import json
raw = open('/tmp/r326-z0au-ui.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['panel'] is True, 'Z0au panel FAIL: ' + json.dumps(d)
assert d['naslov'] is True, 'Z0au naslov FAIL: ' + json.dumps(d)
assert d['prazna'] is True, 'Z0au iskrena prazna veja FAIL (lokalna DB brez MaterialPrice — pričakovano "Ni še zabeleženih cen"): ' + json.dumps(d)
assert d['gumbSkrit'] is True, 'Z0au CSV gumb SKRIT v prazni veji FAIL (brez podatkov NI izvoza): ' + json.dumps(d)
assert d['err'] is None, 'Z0au err: ' + json.dumps(d)
print('Z0au UI OK — zgodovina cen panel ŽIVO + iskrena prazna veja + CSV gumb skrit (53. člen; ZERO-MUTACIJA)')
PYEOFZ0AU
agent-browser eval "((async()=>{try{const r=await fetch('/api/material-prices/zgodovina',{credentials:'same-origin'}); const b=await r.json(); return JSON.stringify({status:r.status, pari:Array.isArray(b?.pregled?.pari)?b.pregled.pari.length:null, vnosov:(b?.pregled?.vnosov===0)?0:null, vir:(typeof b?.vir==='string'&&b.vir.startsWith('ZGODOVINA_CEN'))?true:false, err:window.__err??null});}catch(e){return JSON.stringify({napaka:String(e), err:window.__err??null});}})())" 2>&1 | tail -1 > /tmp/r326-z0au-wire.json
python3 - <<'PYEOFZ0AUW' || exit 1
import json
raw = open('/tmp/r326-z0au-wire.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert 'napaka' not in d, 'Z0au wire mreža FAIL: ' + json.dumps(d)
assert d['status'] == 200, 'Z0au wire status FAIL: ' + json.dumps(d)
assert d['pari'] == 0, 'Z0au wire pari FAIL (lokalna DB brez cen — deterministično): ' + json.dumps(d)
assert d['vnosov'] == 0, 'Z0au wire vnosov FAIL: ' + json.dumps(d)
assert d['vir'] is True, 'Z0au wire vir niz FAIL (CENA_ZGO_VIR_NIZ): ' + json.dumps(d)
assert d['err'] is None, 'Z0au wire err: ' + json.dumps(d)
print('Z0au wire OK — GET /api/material-prices/zgodovina ŽIVO: 200 + pari 0 + vir niz (edini bralec zgodovine; ZERO-MUTACIJA)')
PYEOFZ0AUW
agent-browser screenshot "$SS/qa-r326-e2e-z0au-zgodovina-cen.png" > /dev/null 2>&1
'''
zam('agent-browser screenshot "$SS/qa-r324-e2e-z0at-dnevni-pregled-pdf.png" > /dev/null 2>&1',
    'agent-browser screenshot "$SS/qa-r324-e2e-z0at-dnevni-pregled-pdf.png" > /dev/null 2>&1\n' + Z0AU, 1)

# ── 4. Footer ──
zam('echo "=== R324 E2E KONEC ==="', 'echo "=== R326 E2E KONEC ==="', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r326-e2e-browser.sh zapisan ({len(text)} znakov)')
