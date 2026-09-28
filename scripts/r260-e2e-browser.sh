#!/bin/bash
# R260 E2E ŽIVO (lokalni :3100, ADMIN) — DOBAVITELJI CSV SEGMENTACIJA (P1-f
# nadgradna CSV brata: stolpca 10/11 DA/NE po IDENTITETI + toast agregat +
# zaslonski žigi WYSIWYG + legenda append — route NIČ) + regresije R259
# (dobavitelji PDF nadgradna), R258 (dobičkonosnost pill), R257 (naročila
# pill), R254 (aria).
# SEED/RESTORE runda: seed 3 dobavitelje (fp pre==post MORA biti bajtnato
# identičen). Seed: sup1 Alu rok 5 popust 0 aktiven, sup2 Beton rok 12 popust
# 3 aktiven, sup3 Cink rok 7 popust 0 NEAKTIVEN → API default vrne SAMO
# aktivne → vidni seznam = 2 → segmentna resnica (WYSIWYG zaslon ⇔ CSV ⇔
# toast — ISTA izpeljava dobaviteljiSegmentacija):
#   najhitrejši rok 5 (Alu), največji popust 3 (Beton) →
#   CSV toast: 'CSV prenesen — 2 dobavitelja' +
#              'Dobavitelji-…csv — najhitrejši rok 5 dni, največji popust 3 %.'
#   PDF toast (R259 regresija): 'Izvoženih 2 dobavitelja v PDF' +
#              '… povprečni dobavni rok 8,5 dni, najhitrejši 5 dni (E2E R260 Alu Dobavitelj).'
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r260-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
export PORT=3100
export EB_BASE="http://127.0.0.1:3100"
export EB_EMAIL="ci@roksal.si"
export EB_GESLO="DimniSmoke139!"

source scripts/e2e-lib.sh

ELSE_FAIL=0
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R260-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- PRSTNI ODTIS PRE (Supplier polna resnica — to rundo vstavljamo) ---"
node scripts/r260-db-e2e.cjs fp > /tmp/r260-fp-pre.json
cat /tmp/r260-fp-pre.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('PRE:', d['stevci'])"

echo "--- PRIJAVA (prek e2e-lib.sh) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z1: SEED + suppliers tab — pilli + legenda260 + SEGMENTNI ŽIGI ŽIVO ==="
node scripts/r260-db-e2e.cjs seed
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi dobavitelje kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const csv=id('Izvozi dobavitelje kot CSV'); const pdf=id('Izvozi dobavitelje kot PDF'); const leg259=document.body.textContent.includes('CSV = vrstica per dobavitelj · PDF = arhivski pregled z povprečnim in najhitrejšim dobavnim rokom'); const leg260=document.body.textContent.includes('· CSV nosi segmentacijo (najhitrejši rok · največji popust)'); const cards=[...document.querySelectorAll('div')].filter(d=>typeof d.className==='string'&&d.className.includes('hover:border-roksal-navy/25')); const alu=cards.find(c=>c.textContent.includes('E2E R260 Alu')); const beton=cards.find(c=>c.textContent.includes('E2E R260 Beton')); const cink=cards.find(c=>c.textContent.includes('E2E R260 Cink')); const vseSvg=[...document.querySelectorAll('svg.lucide')]; const zAria=vseSvg.filter(s=>s.getAttribute('aria-hidden')==='true').length; return JSON.stringify({csvPill:!!csv, csvPS:csv?csv.className.includes('press-scale'):false, pdfPill:!!pdf, legenda259:leg259, legenda260:leg260, aluNajH:alu?alu.textContent.includes('najhitrejši rok'):null, aluNajP:alu?alu.textContent.includes('največji popust'):null, betonNajP:beton?beton.textContent.includes('največji popust'):null, betonNajH:beton?beton.textContent.includes('najhitrejši rok'):null, cinkNeaktivenSkrit:!cink, ariaR254:{lucide:vseSvg.length, zAria, vsePokrite:vseSvg.length===zAria}, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r260-e2e-zigi.png" > /dev/null 2>&1

echo "=== Z2: CSV uspešna pot — toast realni agregat (R248 lekcija) ==="
eb_klik_gumb "Izvozi dobavitelje kot CSV"
eb_pocakaj_tekst "CSV prenesen — 2 dobavitelja" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; const agregat=/Dobavitelji-…csv — najhitrejši rok 5 dni, največji popust 3 %\\./.test(t); return JSON.stringify({toastTitle:t.includes('CSV prenesen — 2 dobavitelja'), toastAgregat:agregat, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r260-e2e-csv-toast.png" > /dev/null 2>&1

echo "=== Z3: PDF regresija (R259 nadgradna ŽIVO — toast agregat + bajtni razred) ==="
eb_zajem_pdf suppdf
eb_klik_gumb "Izvozi dobavitelje kot PDF"
eb_pocakaj_tekst "Izvoženih 2 dobavitelja v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; const agregat=/povprečni dobavni rok 8,5 dni, najhitrejši 5 dni \\(E2E R260 Alu Dobavitelj\\)\\./.test(t); return JSON.stringify({toastTitle:t.includes('Izvoženih 2 dobavitelja v PDF'), toastAgregat:agregat, err:window.__err??null});})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return typeof window.__suppdf==='string'&&window.__suppdf.length>0;})()" 14
agent-browser eval "(()=>{const b64=window.__suppdf; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); const znani=[30057,30119,30191,30253,35565,38753,39927,41519,42798,37709,37771,36788,36656,36532,33958,36555,38631,45508,44828,36260,36583,38565]; return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, novGlifniRazred:!znani.includes(bin.length), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z4: regresije — R258 dobičkonosnost + R257 naročila pilli ŽIVO (lokalni build) ==="
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi dobičkonosnost projektov kot PDF\"]');})()" 24
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({r258Pill:!!document.querySelector('button[aria-label=\"Izvozi dobičkonosnost projektov kot PDF\"]'), legenda258:t.includes('Prihodki = izdani + plačani računi'), err:window.__err??null});})()" 2>&1 | tail -1
eb_dispatch '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi naročila kot PDF\"]');})()" 24
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({r257Pill:!!document.querySelector('button[aria-label=\"Izvozi naročila kot PDF\"]'), legenda257:t.includes('CSV = vrstica per postavka · PDF = vrstica per naročilo'), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z5: temna + err null ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1

echo "=== RESTORE + bajtnata identičnost (ZERO-MUTACIJA) ==="
node scripts/r260-db-e2e.cjs restore
node scripts/r260-db-e2e.cjs fp > /tmp/r260-fp-post.json
if cmp -s /tmp/r260-fp-pre.json /tmp/r260-fp-post.json; then echo "DB BAJTNATO IDENTIČNA (cmp -s pre==post) ✓"; ELSE_FAIL=0; else echo "DB RAZLIKA!"; ELSE_FAIL=1; fi

echo "=== HITROST: server zaprt + brskalnik zaprt ==="
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
agent-browser close --all > /dev/null 2>&1
echo "=== R260 E2E KONEC ==="
exit $ELSE_FAIL
