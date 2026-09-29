#!/bin/bash
# R276 — PRVA naloga: potrditi R275 na produ (title + cursor-help na obeh
# inventory mini — R275 MANDATORY STIL). ZERO-MUTACIJA: samo branje.
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"

BUILD=$(curl -s --max-time 15 "$PROD/api/public/health" | python3 -c "import json,sys; print(json.load(sys.stdin).get('build',''))" || true)
echo "PROD build: $BUILD"

eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled vrednosti zaloge kot PDF\"]');})()" 24
eb_cakaj 2

agent-browser eval "(()=>{const minis=[...document.querySelectorAll('div[role=\"status\"]')].map(d=>{const s=d.querySelector('span.tabular-nums'); return s?{tekst:s.textContent.trim().slice(0,60), help:d.className.includes('cursor-help'), title:d.getAttribute('title')||''}:null}).filter(Boolean); return JSON.stringify(minis);})()" 2>&1 | tail -1 | tee /tmp/r276-probe.json

python3 - <<'PYEOF'
import json
raw = open('/tmp/r276-probe.json').read().strip()
r = json.loads(json.loads(raw)) if raw.startswith('"') else json.loads(raw)
assert len(r) >= 2, f"PRIČAKOVANA 2 mini, dobljeno {len(r)}: {r}"
vred = [m for m in r if m['tekst'].startswith('Vrednost (viden seznam)')]
inv  = [m for m in r if m['tekst'].startswith('Inventura (viden seznam)')]
assert vred and inv, f"MINI MANJKATA: {r}"
v, i = vred[0], inv[0]
assert v['help'] and i['help'], f"cursor-help MANJKA: {v} {i}"
assert 'pomeni: nič artiklov nima trenutno veljavne cene — nič ni ocenjeno (brez demo cene)' in v['title'], f"VRED title FAIL: {v['title']!r}"
assert 'pod minimumom = akcija naročila, na meji = pozor' in i['title'], f"INV title FAIL: {i['title']!r}"
print('R275 TITLE PROBE ŽIVO: cursor-help + oba title teksta potrjena na produ')
PYEOF
RES=$?
agent-browser close --all > /dev/null 2>&1
exit $RES
