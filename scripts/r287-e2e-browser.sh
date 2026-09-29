#!/bin/bash
# R286 E2E ŽIVO (lokalni :3100, ADMIN) — INVENTURA PREGLED CSV (30. člen) + TERENSKI ZAPISNI LIST CSV + ISSUE #15 §1 referenčni testni
# projekt (skelet seed) + F3 vir pokritost mini-vrstica + R269 hover parity:
#   Z1: verzija pill 'v1' + vir 'Ročni vnos' + R269 mini title ŽIVO
#       (r276 projekt — regresija + R283 STIL); VIRI MINI amber (delna
#       pokritost — samo MANUAL — iskrena resnica r276 seeda);
#   Z1r: REF PROJEKT (e2e-r283-ref-proj) — VIRI MINI ŽIVO 'Viri (viden
#       seznam): 1 ročnih · 1 foto-CV · 1 AR-Depth' + GREEN pika (polna
#       pokritost — §3 vsi trije viri) + hover title + vir pilli ×3
#       (Ročni vnos / Foto-CV / AR-Depth) + R269 mini '3 meritve · osnutki 3'
#       + osnutek žeton title;
#   Z1s: SYNC ŽIG ŽIVO (r281 projekt — m1 synced r7 + m2 conflict tombstone);
#   Z1m: F2 SYNC MINI-Vrstica ŽIVO (R282 regresija — PRED preklopom, r271
#       lekcija 4: fail-fast || exit 1);
#   Z2: Popravi tok ŽIVO (R276 regresija — v2 pill, v1 ostane);
#   Z2b: TERENSKI PDF ŽIVO — eb_zajem_pdf + izvoz → toast + %PDF- magija (R269 regresija);
#   Z2z: ZAPISNI LIST PDF ŽIVO — fill-in resnica (issue #15 §3): gumb →
#        toast 'Zapisni list prenešen v PDF' + %PDF- magija (NOVA družina R284);
#   Z2x: INVENTURA PREGLED CSV ŽIVO — 30. člen 'izvozi' družine (R286):
#        gumb → toast "Inventurni pregled premoženja prenešen v CSV" +
#        BOM efbbbf + glava 11 stolpcev (Šifra…Status + id/Premiki/Izvoženo);
#   Z2y: ZAPISNI LIST CSV ŽIVO — digitalno izpolnjevanje (issue #15 §3, R285):
#        gumb → toast 'Zapisni list prenešen v CSV' + BOM efbbbf + stolpci
#        fizicna_ref_mm/delta_mm/zapiski_terena (pariteta R186 — Y2/Y8);
#   Z3: panel zgodovine + R277 STIL: thead title;
#   Z4: regresije — R269/R272/R271 pilli ŽIVO (projekt-gated);
#   Z5: temna + err null.
#   Z0z: ZVONČEK OPOMNIK ŽIVO ((k) portal akcija, R287): zvonček odprt →
#        POTEKEL vrstica (red, prioriteta) + AKTIVEN (amber) iz ISTEGA
#        /api/crm — meta koledarsko iskrena; klik na POTEKEL → CRM tab
#        (R182 protokol).
# ZERO-MUTACIJA: restore → fp-pre → seed → ... → restore → fp-post
# (bajtnata identičnost). fail-fast || exit 1 (r271 lekcija 4).
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r285-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
export PORT=3100
export EB_BASE="http://127.0.0.1:3100"
export EB_EMAIL="ci@roksal.si"
export EB_GESLO="DimniSmoke139!"

source scripts/e2e-lib.sh

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R287-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

izberi_projekt() {
  agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:select-project',{detail:'e2e-r276-proj'})); return 'izbran';})()" 2>&1 | tail -1
}

echo "--- HIGIENA: RESTORE pred fp-pre (lekcija 5 — idempotentno) ---"
node scripts/r276-db-e2e.cjs restore || exit 1
node scripts/r273-db-e2e.cjs restore > /dev/null 2>&1 || true
node scripts/r281-db-e2e.cjs restore || exit 1
node scripts/r283-referencni-projekt.cjs restore || exit 1
node scripts/r287-db-e2e.cjs restore || exit 1

echo "--- PRSTNI ODTIS PRE (Measurement + AuditLog + Project + Customer e2e-r276% + e2e-r281% + e2e-r283%) ---"
node scripts/r276-db-e2e.cjs fp > /tmp/r286-fp-pre-276.json || exit 1
node scripts/r281-db-e2e.cjs fp > /tmp/r286-fp-pre-281.json || exit 1
node scripts/r283-referencni-projekt.cjs fp > /tmp/r286-fp-pre-283.json || exit 1
node scripts/r287-db-e2e.cjs fp > /tmp/r287-fp-pre.json || exit 1

echo "--- SEED-VERZIJE (stranka + projekt + meritev v1 = 3200×1200, vir MANUAL) ---"
node scripts/r276-db-e2e.cjs seed-verzije || exit 1

echo "--- SEED-SYNC (r281 projekt + 2 meritvi s sync metadata — issue #16 §10) ---"
node scripts/r281-db-e2e.cjs seed-sync || exit 1

echo "--- SEED-REFERENCNI (r283 REF projekt + 3 meritvi = vse tri vrste virov — issue #15 §1/§3) ---"
node scripts/r283-referencni-projekt.cjs seed-referencni || exit 1

echo "--- SEED-OPOMNIKI (r287: POTEKEL now-3d + AKTIVEN now+5d — zvonček signal 7) ---"
node scripts/r287-db-e2e.cjs seed-opomniki || exit 1

echo "--- PRIJAVA ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z0z: ZVONČEK OPOMNIK ŽIVO — signal 7 + portal akcija ((k), R287) ==="
agent-browser eval "(()=>{const b=document.querySelector('button[aria-label^=\"Obvestila\"]'); if(!b) return 'BREZ-ZVONČKA'; b.click(); return 'odprto';})()" 2>&1 | tail -1
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

echo "=== Z1: Meritve tab — verzija pill v1 + vir 'Ročni vnos' + R269 mini title + VIRI MINI amber (r276 — regresija + R283 STIL) ==="
izberi_projekt
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]');})()" 24
eb_pocakaj_na "(()=>{const p=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='v1'); return !!p;})()" 24
eb_cakaj 1
agent-browser eval "(()=>{const pill=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='v1'); const vir=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='Ročni vnos'); const mini=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.textContent||'').startsWith('Meritve (viden seznam):')); const viriMini=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.textContent||'').startsWith('Viri (viden seznam):')); const viriDot=viriMini?viriMini.parentElement.querySelector('span[aria-hidden=\"true\"]'):null; return JSON.stringify({pill:!!pill, vir:!!vir, miniTitle:mini?(mini.getAttribute('title')||'').startsWith('Števec stanj vidnega seznama (WYSIWYG — R269)'):false, viriMini:viriMini?viriMini.textContent.trim():null, viriTitle:viriMini?(viriMini.getAttribute('title')||'').startsWith('Pokritost virov vidnega seznama (issue #15 §3)'):false, viriDotAmber:viriDot?viriDot.className.includes('bg-roksal-amber'):false, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r286-z1.json
python3 -c "import json; r=json.load(open('/tmp/r286-z1.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pill'] and d['vir'], 'Z1 pill/vir FAIL: '+json.dumps(d); assert d['miniTitle'], 'Z1 R283 R269 mini title FAIL: '+json.dumps(d); assert d['viriMini'] == 'Viri (viden seznam): 1 ročnih · 0 foto-CV · 0 AR-Depth', 'Z1 VIRI MINI vsebina FAIL (r276 = samo MANUAL): '+json.dumps(d); assert d['viriTitle'], 'Z1 VIRI title FAIL: '+json.dumps(d); assert d['viriDotAmber'], 'Z1 VIRI pika FAIL (delna pokritost = amber): '+json.dumps(d); print('Z1 OK — v1 pill + vir title + R269 mini title (R283 STIL) + VIRI MINI amber delna (1 ročnih · 0 · 0)')" || exit 1
agent-browser screenshot "$SS/qa-r286-e2e-z1.png" > /dev/null 2>&1

echo "=== Z1r: REF PROJEKT — VIRI MINI ŽIVO polna pokritost (issue #15 §1/§3) ==="
izberi_projekt_r283() {
  agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:select-project',{detail:'e2e-r283-ref-proj'})); return 'izbran';})()" 2>&1 | tail -1
}
izberi_projekt_r283
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]');})()" 24
eb_pocakaj_na "(()=>{const v=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='Ročni vnos'); const f=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='Foto-CV'); const a=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='AR-Depth'); return !!v&&!!f&&!!a;})()" 24
eb_cakaj 1
agent-browser eval "(()=>{const viriMini=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.textContent||'').startsWith('Viri (viden seznam):')); const viriDot=viriMini?viriMini.parentElement.querySelector('span[aria-hidden=\"true\"]'):null; const mini=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.textContent||'').startsWith('Meritve (viden seznam):')); const zeton=mini?mini.parentElement.querySelector('span.rounded-full.cursor-help'):null; const pilli=['Ročni vnos','Foto-CV','AR-Depth'].map(n=>[...document.querySelectorAll('span')].some(x=>x.textContent.trim()===n)); return JSON.stringify({viriMini:viriMini?viriMini.textContent.trim():null, viriTitle:viriMini?(viriMini.getAttribute('title')||'').startsWith('Pokritost virov vidnega seznama (issue #15 §3)'):false, viriDotGreen:viriDot?viriDot.className.includes('bg-roksal-green'):false, mini:mini?mini.textContent.trim():null, zeton:zeton?zeton.textContent.trim():null, zetonTitle:zeton?(zeton.getAttribute('title')||'').startsWith('Osnutki — meritve v stanju OSNUTEK'):false, pillRočni:pilli[0], pillFoto:pilli[1], pillAR:pilli[2], err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r286-z1r.json
python3 -c "
import json
r = json.load(open('/tmp/r286-z1r.json')); d = json.loads(r) if isinstance(r, str) else r
assert d['viriMini'] == 'Viri (viden seznam): 1 ročnih · 1 foto-CV · 1 AR-Depth', 'Z1r VIRI MINI FAIL (pričakovano 1·1·1): ' + json.dumps(d)
assert d['viriTitle'], 'Z1r VIRI title FAIL: ' + json.dumps(d)
assert d['viriDotGreen'], 'Z1r pika FAIL (polna pokritost = green): ' + json.dumps(d)
assert d['pillRočni'] and d['pillFoto'] and d['pillAR'], 'Z1r vir pilli ×3 FAIL: ' + json.dumps(d)
assert d['mini'] == 'Meritve (viden seznam): 3 meritve · osnutki 3 · potrjenih 0 · arhiviranih 0', 'Z1r R269 mini FAIL: ' + json.dumps(d)
assert d['zeton'] == '3 osnutki' and d['zetonTitle'], 'Z1r osnutek žeton FAIL: ' + json.dumps(d)
assert d['err'] is None, 'Z1r err: ' + json.dumps(d)
print('Z1r OK — REF projekt: VIRI MINI ŽIVO 1·1·1 (green — §3 vsi trije viri) + vir pilli ×3 + R269 mini title + žeton title')" || exit 1
agent-browser screenshot "$SS/qa-r286-e2e-z1r-ref.png" > /dev/null 2>&1

echo "=== Z1s: SYNC ŽIG ŽIVO (R281 §10) — m1 'Sinhronizirano r7' + m2 'Konflikt' + tombstone ==="
izberi_projekt_r281() {
  agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:select-project',{detail:'e2e-r281-proj'})); return 'izbran';})()" 2>&1 | tail -1
}
izberi_projekt_r281
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]');})()" 24
eb_pocakaj_na "(()=>{const p=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.getAttribute('title')||'').startsWith('Sinhronizacijsko stanje: Sinhronizirano')); return !!p;})()" 24
eb_cakaj 1
agent-browser eval "(()=>{const all=[...document.querySelectorAll('span.cursor-help')]; const synced=all.find(x=>(x.getAttribute('title')||'').startsWith('Sinhronizacijsko stanje: Sinhronizirano')); const konf=all.find(x=>(x.getAttribute('title')||'').startsWith('Sinhronizacijsko stanje: Konflikt')); return JSON.stringify({synced:{prisoten:!!synced, besedilo:synced?synced.textContent.trim():null}, konflikt:{prisoten:!!konf, besedilo:konf?konf.textContent.trim():null, tombstone:konf?(konf.getAttribute('title')||'').includes('tombstone — grobnico potrdi /api/sync'):false}, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r286-z1s.json
python3 -c "
import json
r = json.load(open('/tmp/r286-z1s.json')); d = json.loads(r) if isinstance(r, str) else r
assert d['synced']['prisoten'] and d['synced']['besedilo'] == 'Sinhronizirano r7', 'Z1s synced FAIL: ' + json.dumps(d)
assert d['konflikt']['prisoten'] and d['konflikt']['besedilo'] == 'Konflikt' and d['konflikt']['tombstone'], 'Z1s konflikt FAIL: ' + json.dumps(d)
assert d['err'] is None, 'Z1s err: ' + json.dumps(d)
print('Z1s OK — sync žig ŽIVO (regresija R281)')"
agent-browser screenshot "$SS/qa-r286-e2e-sync.png" > /dev/null 2>&1

echo "=== Z1m: F2 SYNC MINI-VRSTICA ŽIVO (R282 regresija — ŠE VEDNO na r281 projektu) ==="
agent-browser eval "(()=>{const mini=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.textContent||'').startsWith('Sync (viden seznam):')); const akcija=[...document.querySelectorAll('span')].find(x=>(x.textContent||'')==='Konflikt — osveži bazo in ponovi sync'); return JSON.stringify({mini:mini?mini.textContent.trim():null, akcija:!!akcija, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r286-z1m.json
python3 -c "
import json
r = json.load(open('/tmp/r286-z1m.json')); d = json.loads(r) if isinstance(r, str) else r
assert d['mini'] and d['mini'].startswith('Sync (viden seznam): 1 sinhroniziranih · 0 čakajoči · 1 konfliktov · 0 napak · 1 grobnic'), 'Z1m mini FAIL: ' + json.dumps(d)
assert d['akcija'], 'Z1m akcijski žig FAIL: ' + json.dumps(d)
assert d['err'] is None, 'Z1m err: ' + json.dumps(d)
print('Z1m OK — F2 sync mini regresija ŽIVO + akcijski žig')" || exit 1
agent-browser screenshot "$SS/qa-r286-e2e-sync-mini.png" > /dev/null 2>&1
# nazaj na r276 projekt (regresijski tok Z2+)
izberi_projekt
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{const p=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='v1'); return !!p;})()" 24

echo "=== Z2: Popravi tok ŽIVO — pas → 3450 → Shrani kot novo verzijo → v2 ==="
eb_klik_prefix() { agent-browser eval "(()=>{const g=document.querySelector('button[aria-label^=\"$1\"]'); if(!g) return 'ni gumba'; g.click(); return 'klik';})()" 2>&1 | tail -1; }
eb_klik_prefix "Popravi meritev "
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Popravljanje verzije:');})()" 14
agent-browser eval "(()=>{const t=document.body.textContent; const pas=t.includes('Popravljanje verzije:'); const stGumb=[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Shrani kot novo verzijo')); return JSON.stringify({pas, stGumb, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r286-z2-pas.json
python3 -c "import json; r=json.load(open('/tmp/r286-z2-pas.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pas'] and d['stGumb'], 'Z2 pas FAIL: '+json.dumps(d); print('Z2 pas OK — korekcijski pas + Shrani kot novo verzijo')" || exit 1
agent-browser eval "(()=>{const i=document.querySelector('input[type=\"number\"]'); if(!i) return 'ni inputa'; const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(i,'3450'); i.dispatchEvent(new Event('input',{bubbles:true})); return 'vpisano';})()" 2>&1 | tail -1
eb_cakaj 1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Shrani kot novo verzijo')); if(!b) return 'ni gumba'; b.click(); return 'klik';})()" 2>&1 | tail -1
eb_pocakaj_tekst "Nova verzija v2 shranjena" 14
eb_pocakaj_na "(()=>{const p=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='v2'); return !!p;})()" 14
agent-browser eval "(()=>{const t=document.body.textContent; const v1=[...document.querySelectorAll('span')].some(x=>x.textContent.trim()==='v1'); const v2=[...document.querySelectorAll('span')].some(x=>x.textContent.trim()==='v2'); const pasSePrisoten=t.includes('Popravljanje verzije:'); return JSON.stringify({v1, v2, pasSePrisoten, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r286-z2.json
python3 -c "import json; r=json.load(open('/tmp/r286-z2.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['v1'] and d['v2'], 'Z2 pill FAIL (v1 in v2 obstajata): '+json.dumps(d); assert not d['pasSePrisoten'], 'Z2 pas NI zaprt po uspehu: '+json.dumps(d); print('Z2 OK — v2 ŽIVO (v1 ostane v zgodovini), pas zaprt')" || exit 1
agent-browser screenshot "$SS/qa-r286-e2e-v2.png" > /dev/null 2>&1

echo "=== Z2b: TERENSKI PDF ŽIVO — 10-stolpčna resnica (issue #16 §6) ==="
eb_zajem_pdf val283
eb_klik_gumb "Izvozi terenski pregled meritev kot PDF"
eb_pocakaj_tekst "Terenski pregled meritev prenešen v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const b64=window.__val283; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r286-z2b.json
python3 -c "import json; r=json.load(open('/tmp/r286-z2b.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pdf'] and d['magija']=='%PDF-', 'Z2b PDF FAIL: '+json.dumps(d); assert d['bajtov']>10000, 'Z2b prekratek PDF: '+json.dumps(d); assert d['err'] is None, 'Z2b err: '+json.dumps(d); print('Z2b OK — terenski PDF ŽIVO (' + str(d['bajtov']) + ' bajtov, %PDF- magija)')" || exit 1
agent-browser screenshot "$SS/qa-r286-e2e-teren-pdf.png" > /dev/null 2>&1

echo "=== Z2z: TERENSKI ZAPISNI LIST PDF ŽIVO — fill-in resnica (issue #15 §3) ==="
eb_zajem_pdf val284
eb_klik_gumb "Izvozi terenski zapisni list kot PDF"
eb_pocakaj_tekst "Zapisni list prenešen v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const b64=window.__val284; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r286-z2z.json
python3 -c "import json; r=json.load(open('/tmp/r286-z2z.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pdf'] and d['magija']=='%PDF-', 'Z2z PDF FAIL: '+json.dumps(d); assert d['bajtov']>10000, 'Z2z prekratek PDF: '+json.dumps(d); assert d['err'] is None, 'Z2z err: '+json.dumps(d); print('Z2z OK — zapisni list PDF ŽIVO (' + str(d['bajtov']) + ' bajtov, %PDF- magija — fill-in resnica)')" || exit 1
agent-browser screenshot "$SS/qa-r286-e2e-zapisni-pdf.png" > /dev/null 2>&1

echo "=== Z2x: INVENTURA PREGLED CSV ŽIVO — 30. člen izvozne družine (R286) ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi inventurni pregled premoženja kot CSV\"]');})()" 24
eb_cakaj 1
agent-browser eval "(()=>{const gumb=document.querySelector('button[aria-label=\"Izvozi inventurni pregled premoženja kot CSV\"]'); const legenda=[...document.querySelectorAll('p')].some(p=>p.textContent.startsWith('Inventura CSV = ista resnica kot PDF v Excelu')); return JSON.stringify({gumb:!!gumb, title:gumb?(gumb.getAttribute('title')||'').startsWith('Inventurni pregled premoženja kot CSV'):false, legenda, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r286-z2x-ui.json
python3 -c "import json; r=json.load(open('/tmp/r286-z2x-ui.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['gumb'] and d['title'] and d['legenda'], 'Z2x UI FAIL: '+json.dumps(d); assert d['err'] is None, 'Z2x err: '+json.dumps(d); print('Z2x UI OK — gumb + hover title + legenda ŽIVO (30. člen, kanon R280–R285)')" || exit 1
eb_zajem_pdf val286csv
eb_klik_gumb "Izvozi inventurni pregled premoženja kot CSV"
eb_pocakaj_tekst "Inventurni pregled premoženja prenešen v CSV" 14
eb_cakaj 1
agent-browser eval "(()=>{const b64=window.__val286csv; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({csv:false, err:window.__err??null}); const bin=atob(b64); const bom=bin.charCodeAt(0).toString(16)+bin.charCodeAt(1).toString(16)+bin.charCodeAt(2).toString(16); let vrs=0; for(let i=0;i<bin.length;i++){ if(bin.charCodeAt(i)===10) vrs++; } return JSON.stringify({csv:true, bom, bajtov:bin.length, vrstic:vrs, glava:bin.includes('"Naziv"')&&bin.includes('"Status"')&&bin.includes('"Enota"'), dodatni:bin.includes('"id"')&&bin.includes('"Premiki"'), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r286-z2x.json
python3 -c "import json; r=json.load(open('/tmp/r286-z2x.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['csv'] and d['bom']=='efbbbf', 'Z2x CSV/BOM FAIL: '+json.dumps(d); assert d['glava'] and d['dodatni'], 'Z2x stolpci FAIL (ASCII needleji — atob UTF-8 je 2-bajtni za Š/ž, kanon r285): '+json.dumps(d); assert d['vrstic']>=2, 'Z2x premalo vrstic: '+json.dumps(d); assert d['bajtov']>60, 'Z2x prekratek CSV: '+json.dumps(d); assert d['err'] is None, 'Z2x err: '+json.dumps(d); print('Z2x OK — inventura CSV ŽIVO (' + str(d['bajtov']) + ' bajtov, BOM efbbbf, ' + str(d['vrstic']) + ' vrstic — pariteta R270 po konstrukciji + 3 dodatni stolpci)')" || exit 1
agent-browser screenshot "$SS/qa-r286-e2e-inventura-csv.png" > /dev/null 2>&1
# VRNITEV na measurements tab (Z2b/Z2z/Z2y kontekst — r285 tok se nadaljuje nespremenjen):
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]');})()" 24
eb_cakaj 1

echo "=== Z2y: TERENSKI ZAPISNI LIST CSV ŽIVO — digitalno izpolnjevanje (R285) ==="
eb_zajem_pdf val285csv
eb_klik_gumb "Izvozi terenski zapisni list kot CSV"
eb_pocakaj_tekst "Zapisni list prenešen v CSV" 14
eb_cakaj 1
agent-browser eval "(()=>{const b64=window.__val285csv; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({csv:false, err:window.__err??null}); const bin=atob(b64); const bom=bin.charCodeAt(0).toString(16)+bin.charCodeAt(1).toString(16)+bin.charCodeAt(2).toString(16); let vrs=0; for(let i=0;i<bin.length;i++){ if(bin.charCodeAt(i)===10) vrs++; } return JSON.stringify({csv:true, bom, bajtov:bin.length, vrstic:vrs, imaFizicna:bin.includes('fizicna_ref_mm'), imaDelta:bin.includes('delta_mm'), imaZapiski:bin.includes('zapiski_terena'), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r286-z2y.json
python3 -c "import json; r=json.load(open('/tmp/r286-z2y.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['csv'] and d['bom']=='efbbbf', 'Z2y CSV/BOM FAIL: '+json.dumps(d); assert d['imaFizicna'] and d['imaDelta'] and d['imaZapiski'], 'Z2y stolpci FAIL: '+json.dumps(d); assert d['vrstic']>=2, 'Z2y premalo vrstic: '+json.dumps(d); assert d['bajtov']>60, 'Z2y prekratek CSV: '+json.dumps(d); assert d['err'] is None, 'Z2y err: '+json.dumps(d); print('Z2y OK — zapisni list CSV ŽIVO (' + str(d['bajtov']) + ' bajtov, BOM efbbbf, ' + str(d['vrstic']) + ' vrstic — pariteta R186 + prazni fizični stolpci)')" || exit 1
agent-browser screenshot "$SS/qa-r286-e2e-zapisni-csv.png" > /dev/null 2>&1

echo "=== Z3: Zgodovina verzij panel — veriga v1→v2 + delta +250 + aktivna v2 ==="
eb_klik_prefix "Pokaži zgodovino verzij meritve"
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Zgodovina verzij — korekcije NE prepišejo');})()" 14
eb_pocakaj_na "(()=>{return document.body.textContent.includes('+250');})()" 14
agent-browser eval "(()=>{const t=document.body.textContent; const aktivnaV2=t.includes('Aktivna verzija: v2'); const delta=t.includes('+250'); const o7=t.includes('se NE izračunajo samodejno'); return JSON.stringify({aktivnaV2, delta, o7, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r286-z3.json
python3 -c "import json; r=json.load(open('/tmp/r286-z3.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['aktivnaV2'] and d['delta'] and d['o7'], 'Z3 panel FAIL: '+json.dumps(d); print('Z3 OK — veriga v1→v2 + delta +250 + aktivna v2 + O7 resnica')" || exit 1
agent-browser screenshot "$SS/qa-r286-e2e-panel.png" > /dev/null 2>&1

echo "=== Z4: regresije — R272/R271 pilli ŽIVO (isti projekt) ==="
eb_dispatch '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi terenski pregled nagibov kot PDF\"]');})()" 24
R272=$(agent-browser eval "(()=>{return JSON.stringify({pill:!!document.querySelector('button[aria-label=\"Izvozi terenski pregled nagibov kot PDF\"]'), err:window.__err??null});})()" 2>&1 | tail -1)
eb_dispatch '{"tab":"more","more":"documents","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled stanja zapisnika kot PDF\"]');})()" 24
R271=$(agent-browser eval "(()=>{return JSON.stringify({pill:!!document.querySelector('button[aria-label=\"Izvozi pregled stanja zapisnika kot PDF\"]'), err:window.__err??null});})()" 2>&1 | tail -1)
python3 - "$R272" "$R271" <<'PYEOF' || exit 1
import json, sys
def parse(raw):
    d = json.loads(raw)
    return json.loads(d) if isinstance(d, str) else d
r272, r271 = parse(sys.argv[1]), parse(sys.argv[2])
assert r272['pill'] and r271['pill'], f'Z4 regresije FAIL: {r272} {r271}'
print('Z4 regresije OK — R272 + R271 pill ŽIVO')
PYEOF

echo "=== Z5: temna + err null (panel še odprt) ==="
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Pokaži zgodovino verzij meritve\"]');})()" 14
eb_klik_prefix "Pokaži zgodovino verzij meritve"
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Zgodovina verzij — korekcije NE prepišejo');})()" 14
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({temna:document.documentElement.classList.contains('dark'), panel:t.includes('Zgodovina verzij — korekcije NE prepišejo'), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r286-z5.json
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
python3 -c "import json; r=json.load(open('/tmp/r286-z5.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['temna'] and d['panel'] and d['err'] is None, 'Z5 temna FAIL: '+json.dumps(d); print('Z5 temna OK — verzije panel vidna, err null')" || exit 1

echo "=== RESTORE + ODTIS (bajtnata identičnost — ZERO-MUTACIJA) ==="
node scripts/r276-db-e2e.cjs restore || exit 1
node scripts/r273-db-e2e.cjs restore > /dev/null 2>&1 || true
node scripts/r281-db-e2e.cjs restore || exit 1
node scripts/r283-referencni-projekt.cjs restore || exit 1
node scripts/r287-db-e2e.cjs restore || exit 1
node scripts/r276-db-e2e.cjs fp > /tmp/r286-fp-post-276.json || exit 1
node scripts/r281-db-e2e.cjs fp > /tmp/r286-fp-post-281.json || exit 1
node scripts/r283-referencni-projekt.cjs fp > /tmp/r286-fp-post-283.json || exit 1
node scripts/r287-db-e2e.cjs fp > /tmp/r287-fp-post.json || exit 1
OK=1
cmp -s /tmp/r286-fp-pre-276.json /tmp/r286-fp-post-276.json || OK=0
cmp -s /tmp/r286-fp-pre-281.json /tmp/r286-fp-post-281.json || OK=0
cmp -s /tmp/r286-fp-pre-283.json /tmp/r286-fp-post-283.json || OK=0
cmp -s /tmp/r287-fp-pre.json /tmp/r287-fp-post.json || OK=0
if [ "$OK" = 1 ]; then
  echo "ODTIS BAJTNATO IDENTIČEN (pre==post, r276 + r281 + r283 + r287) — ZERO-MUTACIJA dokazana"
else
  echo "ODTIS RAZLIČEN — FAIL"; diff <(python3 -m json.tool /tmp/r286-fp-pre-276.json) <(python3 -m json.tool /tmp/r286-fp-post-276.json) | head -10; diff <(python3 -m json.tool /tmp/r286-fp-pre-281.json) <(python3 -m json.tool /tmp/r286-fp-post-281.json) | head -10; diff <(python3 -m json.tool /tmp/r286-fp-pre-283.json) <(python3 -m json.tool /tmp/r286-fp-post-283.json) | head -10
  exit 1
fi

echo "=== ZAKLJUČEK: strežnik + brskalnik zaprta ==="
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
agent-browser close --all > /dev/null 2>&1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "=== R287 E2E KONEC ==="
