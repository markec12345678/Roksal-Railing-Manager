#!/usr/bin/env python3
# R290 — zgeneriraj r290-e2e-browser.sh iz r288-e2e-browser.sh + vstavi Z0m
# blok (PRIHODKI PO MESECIH ŽIVO — pogojni probe, ZERO-MUTACIJA).
src = open('/home/z/my-project/scripts/r288-e2e-browser.sh', encoding='utf-8').read()
# preimenuj artefakte r288 → r290 (db-e2e skripte r276/r273/r281/r283/r287 ostanejo)
src = src.replace('r288', 'r290')
src = src.replace('R288', 'R290')

z0m = '''echo "=== Z0m: PRIHODKI PO MESECIH ŽIVO (R290 — plačila dimenzija, POGOJNI probe; ZERO-MUTACIJA) ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
if eb_pocakaj_na "(()=>{return !!document.querySelector('section[aria-label^=\\"Prihodki po mesecih\\"]');})()" 16; then
  eb_cakaj 1
  agent-browser eval "(()=>{const s=document.querySelector('section[aria-label^=\\"Prihodki po mesecih\\"]'); const vrstice=[...s.querySelectorAll('ul li')]; const skupaj=s.textContent.includes('Skupaj plačano'); const prazna=s.textContent.includes('Ni plačanih računov'); const storn=s.textContent.includes('(izključeni iz zneskov)'); const vt=s.textContent.includes('v teku:'); return JSON.stringify({vrstice:vrstice.length, skupaj, prazna, storn, vt, besedilo:vrstice.length>0?vrstice[0].textContent.trim():null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r290-z0m.json
  python3 - <<'PYEOF2' || exit 1
import json
raw = open('/tmp/r290-z0m.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0m err: ' + json.dumps(d)
assert (d['vrstice'] > 0) != d['prazna'], 'Z0m pogojni kanon: vrstice=' + str(d['vrstice']) + ' prazna=' + str(d['prazna']) + ' — natanko ENA resnica: ' + json.dumps(d)
if d['vrstice'] > 0:
    assert d['skupaj'], 'Z0m: vrstice brez Skupaj vrstice: ' + json.dumps(d)
    print('Z0m OK — PRIHODKI PO MESECIH ŽIVO: ' + str(d['vrstice']) + ' meseci · Skupaj ŽIVO · prva vrstica: ' + str(d['besedilo'])[:60])
else:
    print('Z0m OK — sekcija ŽIVO, iskrena praznina (spot portfel brez plačanih računov — pogojni kanon r277)')
PYEOF2
  agent-browser screenshot "$SS/qa-r290-e2e-z0m-meseci.png" > /dev/null 2>&1
else
  echo "Z0m OPOMBA: sekcija ni dosegljiva na spot seji (CRM skoping RBAC?) — chunk needleji R290 ×8 ostajajo obvezni dokaz"
fi

'''
marker = 'echo "=== Z1:'
assert marker in src, 'marker Z1 ni najden'
src = src.replace(marker, z0m + marker, 1)
open('/home/z/my-project/scripts/r290-e2e-browser.sh', 'w', encoding='utf-8').write(src)
print('written r290-e2e-browser.sh')
