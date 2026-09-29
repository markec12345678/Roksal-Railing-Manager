#!/usr/bin/env python3
# R287 — izpelja r287-e2e-browser.sh iz r286 vzorca (kanon gen-*):
# r286 kopija + Z0z ZVONČEK OPOMNIK ŽIVO (signal 7 + portal akcija klik →
# CRM) + r287-db-e2e.cjs higiena/odtis (pre==post bajtnata identičnost).
import pathlib

root = pathlib.Path('/home/z/my-project/scripts')
src = (root / 'r286-e2e-browser.sh').read_text(encoding='utf-8')

# 1) log + konec žigi r286 → r287
src = src.replace('/tmp/R286-server-e2e.log', '/tmp/R287-server-e2e.log')
src = src.replace('=== R286 E2E KONEC ===', '=== R287 E2E KONEC ===')

# 2) header: dodaj Z0z opis (po Z5 vrstici v glavi)
src = src.replace(
    "#   Z5: temna + err null.",
    "#   Z5: temna + err null.\n"
    "#   Z0z: ZVONČEK OPOMNIK ŽIVO ((k) portal akcija, R287): zvonček odprt →\n"
    "#        POTEKEL vrstica (red, prioriteta) + AKTIVEN (amber) iz ISTEGA\n"
    "#        /api/crm — meta koledarsko iskrena; klik na POTEKEL → CRM tab\n"
    "#        (R182 protokol).",
    1,
)

# 3) higiena: r287 restore (po r283 restore)
src = src.replace(
    "node scripts/r283-referencni-projekt.cjs restore || exit 1\n\necho \"--- PRSTNI ODTIS PRE",
    "node scripts/r283-referencni-projekt.cjs restore || exit 1\n"
    "node scripts/r287-db-e2e.cjs restore || exit 1\n\necho \"--- PRSTNI ODTIS PRE",
    1,
)

# 4) fp-pre: r287 fp (po r283 fp)
src = src.replace(
    "node scripts/r283-referencni-projekt.cjs fp > /tmp/r286-fp-pre-283.json || exit 1",
    "node scripts/r283-referencni-projekt.cjs fp > /tmp/r286-fp-pre-283.json || exit 1\n"
    "node scripts/r287-db-e2e.cjs fp > /tmp/r287-fp-pre.json || exit 1",
    1,
)

# 5) seed: r287 seed-opomniki (po r283 seed)
src = src.replace(
    "node scripts/r283-referencni-projekt.cjs seed-referencni || exit 1",
    "node scripts/r283-referencni-projekt.cjs seed-referencni || exit 1\n\n"
    "echo \"--- SEED-OPOMNIKI (r287: POTEKEL now-3d + AKTIVEN now+5d — zvonček signal 7) ---\"\n"
    "node scripts/r287-db-e2e.cjs seed-opomniki || exit 1",
    1,
)

# 6) Z0z korak: vstavi PRED 'echo \"=== Z1:' (prvi pojav — po eb_zapri_vodic)
z0z = '''
echo "=== Z0z: ZVONČEK OPOMNIK ŽIVO — signal 7 + portal akcija ((k), R287) ==="
agent-browser eval "(()=>{const b=document.querySelector('button[aria-label^=\\"Obvestila\\"]'); if(!b) return 'BREZ-ZVONČKA'; b.click(); return 'odprto';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{const vr=[...document.querySelectorAll('button')].filter(x=>(x.getAttribute('aria-label')||'').includes('— odpre CRM (opomnik)')); return vr.length >= 2;})()" 20
eb_cakaj 1
agent-browser eval "(()=>{const vr=[...document.querySelectorAll('button')].filter(x=>(x.getAttribute('aria-label')||'').includes('— odpre CRM (opomnik)')); const info=vr.map(x=>({aria:x.getAttribute('aria-label'), meta:(x.querySelector('p.uppercase')||{}).textContent||null, red:!!x.querySelector('.text-roksal-red'), amber:!!x.querySelector('.text-roksal-amber')})); return JSON.stringify({st:vr.length, info, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r287-z0z.json
python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r287-z0z.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['st'] >= 2, 'Z0z: pričakovani vsaj 2 opomniški vrstici: ' + json.dumps(d)
potekel = [x for x in d['info'] if x['aria'].startswith('E2E R287 Potekel Opomnik')]
aktiven = [x for x in d['info'] if x['aria'].startswith('E2E R287 Aktiven Opomnik')]
assert potekel and aktiven, 'Z0z: obe seed stranki morata biti vidni: ' + json.dumps(d['info'])
assert potekel[0]['red'] and not potekel[0]['amber'], 'Z0z POTEKEL barva FAIL (red): ' + json.dumps(potekel[0])
assert aktiven[0]['amber'] and not aktiven[0]['red'], 'Z0z AKTIVEN barva FAIL (amber): ' + json.dumps(aktiven[0])
assert potekel[0]['meta'] and potekel[0]['meta'].startswith('POTEKEL · zapadlo'), 'Z0z POTEKEL meta FAIL: ' + json.dumps(potekel[0])
assert aktiven[0]['meta'] and (aktiven[0]['meta'].startswith('še ') or aktiven[0]['meta'] == 'rok danes'), 'Z0z AKTIVEN meta FAIL: ' + json.dumps(aktiven[0])
assert d['info'].index(potekel[0]) < d['info'].index(aktiven[0]), 'Z0z POTEKEL prioriteta FAIL (vrstni red)'
assert d['err'] is None, 'Z0z err: ' + json.dumps(d)
print('Z0z OK — zvonček opomnik ŽIVO (POTEKEL red prioriteta + AKTIVEN amber; meta koledarsko iskrena)')
PYEOF
agent-browser screenshot "$SS/qa-r287-e2e-z0z-zvoncek.png" > /dev/null 2>&1
agent-browser eval "(()=>{const vr=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('E2E R287 Potekel Opomnik')); if(!vr) return 'BREZ'; vr.click(); return 'kliknjeno';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{const h=[...document.querySelectorAll('h2')].find(x=>x.textContent.trim()==='CRM stranke'); return !!h;})()" 20
eb_cakaj 1
agent-browser eval "(()=>{const h=[...document.querySelectorAll('h2')].find(x=>x.textContent.trim()==='CRM stranke'); return JSON.stringify({crm:!!h, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r287-z0z-crm.json
python3 -c "import json; r=json.load(open('/tmp/r287-z0z-crm.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['crm'], 'Z0z CRM tab FAIL (portal akcija): '+json.dumps(d); assert d['err'] is None, 'Z0z err: '+json.dumps(d); print('Z0z OK — portal akcija ŽIVO: klik na POTEKEL → CRM tab (R182 protokol)')" || exit 1
agent-browser screenshot "$SS/qa-r287-e2e-z0z-crm.png" > /dev/null 2>&1

echo "=== Z1: Meritve tab'''
src = src.replace('\necho "=== Z1: Meritve tab', z0z, 1)

# 7) RESTORE + fp-post + cmp: r287 doda svoje
src = src.replace(
    "node scripts/r283-referencni-projekt.cjs restore || exit 1\nnode scripts/r276-db-e2e.cjs fp > /tmp/r286-fp-post-276.json",
    "node scripts/r283-referencni-projekt.cjs restore || exit 1\n"
    "node scripts/r287-db-e2e.cjs restore || exit 1\n"
    "node scripts/r276-db-e2e.cjs fp > /tmp/r286-fp-post-276.json",
    1,
)
src = src.replace(
    "node scripts/r283-referencni-projekt.cjs fp > /tmp/r286-fp-post-283.json || exit 1",
    "node scripts/r283-referencni-projekt.cjs fp > /tmp/r286-fp-post-283.json || exit 1\n"
    "node scripts/r287-db-e2e.cjs fp > /tmp/r287-fp-post.json || exit 1",
    1,
)
src = src.replace(
    'cmp -s /tmp/r286-fp-pre-283.json /tmp/r286-fp-post-283.json || OK=0',
    'cmp -s /tmp/r286-fp-pre-283.json /tmp/r286-fp-post-283.json || OK=0\ncmp -s /tmp/r287-fp-pre.json /tmp/r287-fp-post.json || OK=0',
    1,
)
src = src.replace(
    'echo "ODTIS BAJTNATO IDENTIČEN (pre==post, r276 + r281 + r283) — ZERO-MUTACIJA dokazana"',
    'echo "ODTIS BAJTNATO IDENTIČEN (pre==post, r276 + r281 + r283 + r287) — ZERO-MUTACIJA dokazana"',
    1,
)

(root / 'r287-e2e-browser.sh').write_text(src, encoding='utf-8')
print("OK — r287-e2e-browser.sh zapisana")
