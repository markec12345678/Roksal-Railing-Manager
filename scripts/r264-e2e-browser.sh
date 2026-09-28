#!/bin/bash
# R264 E2E ŽIVO (lokalni :3100, ADMIN) — DOBAVITELJI — POZICIJA CEN PDF (20.
# člen 'izvozi' družine: presek prices × bestPerMaterial iz ISTEGA
# /api/material-prices odgovora; route NIČ) + regresije R263 (CRM pokritost),
# R262 (zaloga-osnutek), R260 (segmentni žigi), R254 (aria).
# SEED/RESTORE runda: OBE veji dokazani — PREJ naravno stanje (0 cen) →
# fail-closed toast 'Ni vpisanih cen' (veja 1, NI dokumenta); potem raw SQL
# seed (SAMO INSERT — 2 dobavitelja + 3 veljavne cene: sup1 najnižja na A 100
# IN B 80 (B brez alternative — suppliers 1), sup2 višja na A 120 → 20 %) →
# POST toast '2 dobavitelja, 3 ponudbe, brez alternative 1.' + PDF NOV razred,
# RESTORE → fp pre==post BAJTNATO (ZERO-MUTACIJA; Supplier + MaterialPrice
# POLNA resnica v odtisu).
# ⚠️ lekcije: agent-browser eval DVOLIČNO kodiran JSON (pomožnica L());
# toast agregat non-greedy (.+?)\.; bajtna primerjava PRE/POST v python
# layerju (ugnezden eb_zajem_pdf patch DVOKRAT zajame — R263 lekcija 5);
# quoted camelCase stolpci v raw SQL (R257/R263 lekcija).
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r264-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R264-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- PRSTNI ODTIS PRE (Supplier + MaterialPrice POLNA resnica) ---"
node scripts/r264-db-e2e.cjs fp > /tmp/r264-fp-pre.json
cat /tmp/r264-fp-pre.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('PRE:', d['stevci'])"

echo "--- PRIJAVA (prek e2e-lib.sh) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z1: DOBAVITELJI subtab — R264 pill ŽIVO (VEDNO viden + press-scale + FileText aria-hidden) + legenda append ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pozicijo dobaviteljev kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const poz=id('Izvozi pozicijo dobaviteljev kot PDF'); const cen=id('Izvozi cenik materiala kot PDF'); const prim=id('Izvozi primerjalni cenik kot PDF'); const t=document.body.textContent; const leg264=t.includes('Pozicija = dobavitelji × najnižja per artikel'); const leg245Staro=t.includes('Cenik = vse ponudbe · Primerjalni = najnižja per artikel · % = razpon do najvišje · Povprečni razpon = vsota razlik / vsota najboljših · Največji razpon = najširši % med artikli'); const vseSvg=[...document.querySelectorAll('svg.lucide')]; const zAria=vseSvg.filter(s=>s.getAttribute('aria-hidden')==='true').length; return JSON.stringify({pozPill:!!poz, pozPS:poz?poz.className.includes('press-scale'):false, pozAriaHidden:poz?!!poz.querySelector('svg[aria-hidden=\"true\"]'):false, pozDisabled:poz?poz.disabled:null, cenikPill:!!cen, primerjalniPill:!!prim, legenda264:leg264, legenda245StaroIntaktno:leg245Staro, ariaR254:{lucide:vseSvg.length, zAria, vsePokrite:vseSvg.length===zAria}, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r264-z1.json
python3 -c "import json; r=json.load(open('/tmp/r264-z1.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pozPill'] and d['pozPS'] and d['pozAriaHidden'] and d['legenda264'] and d['legenda245StaroIntaktno'], 'Z1 resnice FAIL: '+json.dumps(d); print('Z1 preverba OK')"
agent-browser screenshot "$SS/qa-r264-e2e-pilli.png" > /dev/null 2>&1

echo "=== Z1b: fail-closed veja (naravno stanje: 0 cen → 'Ni vpisanih cen', NI dokumenta) ==="
eb_csv_reset poz264
eb_klik_gumb "Izvozi pozicijo dobaviteljev kot PDF"
eb_pocakaj_tekst "Ni vpisanih cen" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({toastTitle:t.includes('Ni vpisanih cen'), toastOpis:t.includes('Pozicija dobaviteljev se izvozi, ko je vpisana prva nabavna cena.'), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r264-z1b.json
python3 -c "import json; r=json.load(open('/tmp/r264-z1b.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['toastTitle'] and d['toastOpis'], 'Z1b fail-closed FAIL: '+json.dumps(d); print('Z1b fail-closed veja OK (ni dokumenta — ni prazne datoteke)')"
agent-browser screenshot "$SS/qa-r264-e2e-failclosed.png" > /dev/null 2>&1

echo "=== Z2: SEED (2 dobavitelja + 3 cene) + reload — uspešna veja ==="
node scripts/r264-db-e2e.cjs seed
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 2
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pozicijo dobaviteljev kot PDF\"]');})()" 24
eb_cakaj 3
eb_zajem_pdf poz264b
eb_csv_reset poz264b
eb_klik_gumb "Izvozi pozicijo dobaviteljev kot PDF"
eb_pocakaj_tekst "Pozicija dobaviteljev prenešena v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; const agg=/Pozicija-dobaviteljev-…pdf — (.+?)\\./.exec(t); return JSON.stringify({toastTitle:t.includes('Pozicija dobaviteljev prenešena v PDF'), toastAgregat:agg?agg[1]:null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r264-z2.json
cat /tmp/r264-z2.json
python3 -c "
import json
r=json.load(open('/tmp/r264-z2.json')); d=json.loads(r) if isinstance(r,str) else r
assert d['toastTitle'] and d['toastAgregat']=='2 dobavitelja, 3 ponudbe, brez alternative 1', 'Z2 toast FAIL: '+json.dumps(d)
print('Z2 toast OK —', d['toastAgregat'], '(sklanjatev ŽIVO: 2 dobavitelja, 3 ponudbe)')
"
eb_pocakaj_na "(()=>{return typeof window.__poz264b==='string'&&window.__poz264b.length>0;})()" 14
agent-browser eval "(()=>{const b64=window.__poz264b; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); const znani=[30057,30119,30191,30253,35565,38753,39927,41519,42798,37709,37771,36788,36656,36532,33958,36555,38631,45508,44828,36260,36583,45127,38565,38909,40261,35409,37228,39094,41009]; return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, novGlifniRazred:!znani.includes(bin.length), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r264-z2-pdf.json
python3 -c "import json; r=json.load(open('/tmp/r264-z2-pdf.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pdf'] and d['magija']=='%PDF-' and d['novGlifniRazred'], 'Z2 PDF FAIL: '+json.dumps(d); print('Z2 PDF OK —', d['bajtov'], 'bajtov, NOV razred (29 znanih)')"
agent-browser screenshot "$SS/qa-r264-e2e-po-seedu.png" > /dev/null 2>&1

echo "=== Z2b: R260/R259 regresija — segmentni žigi + dobavitelji pilli ŠE VEDNO ŽIVO ==="
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const t=document.body.textContent; return JSON.stringify({suppliersCsvPill:!!id('Izvozi dobavitelje kot CSV'), suppliersPdfPill:!!id('Izvozi dobavitelje kot PDF'), cenikPdfPill:!!id('Izvozi cenik materiala kot PDF'), primerjalniPdfPill:!!id('Izvozi primerjalni cenik kot PDF'), legendaR260:t.includes('CSV nosi segmentacijo (najhitrejši rok · največji popust)'), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z3: R263 regresija — CRM pokritost pill ŠE ŽIVO ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pokritost opomnikov kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const t=document.body.textContent; const mini=/Pokritost opomnikov: (\\d+) od (\\d+) strank/.exec(t); const vseSvg=[...document.querySelectorAll('svg.lucide')]; const zAria=vseSvg.filter(s=>s.getAttribute('aria-hidden')==='true').length; return JSON.stringify({r263Pill:!!document.querySelector('button[aria-label=\"Izvozi pokritost opomnikov kot PDF\"]'), miniMatch:mini?[mini[1],mini[2]]:null, ariaR254:{lucide:vseSvg.length, zAria, vsePokrite:vseSvg.length===zAria}, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z4: temna + err null ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1

echo "=== Z5: RESTORE + prstni odtis post BAJTNATO == pre ==="
agent-browser close --all > /dev/null 2>&1
node scripts/r264-db-e2e.cjs restore
node scripts/r264-db-e2e.cjs fp > /tmp/r264-fp-post.json
cat /tmp/r264-fp-post.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('POST:', d['stevci'])"
if cmp -s /tmp/r264-fp-pre.json /tmp/r264-fp-post.json; then echo "DB BAJTNATO IDENTIČNA (pre==post — seed/restore bajtnato)"; else echo "DB RAZLIKA!"; diff <(python3 -m json.tool /tmp/r264-fp-pre.json) <(python3 -m json.tool /tmp/r264-fp-post.json) | head -20; fi

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "--- R264 E2E KONEC ---"
