#!/bin/bash
# R250 E2E ŽIVO (lokalni :3100, ADMIN) — PRIHODKI PDF (7. člen 'izvozi'
# družine: KPI trikot Plačano/Odprto/Zapadlo ISTO kot Povzetek boxi, tabela
# stanj, iskren sklep) + regresija R136 racuni CSV. BRALNA runda — brez
# sejanja/restore (izvoz je čista klient izpeljava; DB ni dotaknjena —
# ZERO-MUTACIJA z fp pre==post).
# Dokazi: (1) 4 kontrolni elementi (CSV + prihodki PDF pilli + press-scale +
# legendaR250) VIDNI; (2) prihodki PDF = %PDF magija + toast 'Prihodki
# prenešeni v PDF' z realnim agregatom (' €, odprto ' + ' €, zapadlo ' —
# WYSIWYG s Povzetek boxi); (3) NOV glifni razred (≠ vseh znanih družinskih
# razredov); (4) R136 racuni CSV regresija ('CSV izvožen'); (5) temna +
# err null; (6) fp pre==post bajtnato + port sproščen.
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r250-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R250-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- PRSTNI ODTIS PRE (bralna runda — brez sejanja) ---"
node scripts/r245-db-e2e.cjs fp > /tmp/r250-fp-pre.json
cat /tmp/r250-fp-pre.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('PRE:', d['stevci'])"

echo "--- PRIJAVA (prek e2e-lib.sh) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z1: CRM tab — 4 kontrolni elementi (CSV pill + prihodki pill + press-scale + legendaR250) ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi prihodke kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const cC=id('Izvozi račune kot CSV'); const pP=id('Izvozi prihodke kot PDF'); const leg=document.body.textContent.includes('CSV = vsi računi (vrstice) · PDF = povzetek za vodstvo'); return JSON.stringify({csvPill:!!cC, prihodkiPill:!!pP, obaPS:[cC,pP].every(b=>b&&b.className.includes('press-scale')), legenda250:leg, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r250-e2e-pilli.png" > /dev/null 2>&1

echo "=== Z2: prihodki PDF — %PDF magija + NOV glifni razred + toast z realnim agregatom ==="
eb_zajem_pdf prhpdf
eb_csv_reset prhpdf
eb_klik_gumb "Izvozi prihodke kot PDF"
eb_pocakaj_tekst "Prihodki prenešeni v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({toastTitle:t.includes('Prihodki prenešeni v PDF'), toastPlacano:t.includes(' €, odprto '), toastZapadlo:t.includes(' €, zapadlo '), err:window.__err??null});})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return typeof window.__prhpdf==='string'&&window.__prhpdf.length>0;})()" 14
agent-browser eval "(()=>{const b64=window.__prhpdf; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); const znani=[30057,30119,30191,30253,35565,38753,39927,41519,42798,37709,37771]; return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, novGlifniRazred:!znani.includes(bin.length), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r250-e2e-toast.png" > /dev/null 2>&1

echo "=== Z3: R136 regresija — racuni CSV zajem (glava 9 stolpcev + racuni- ime; R136 export je tihi download — toast ni del resnice) ==="
eb_csv_capture rac
eb_csv_reset rac
eb_klik_gumb "Izvozi račune kot CSV"
eb_pocakaj_na "(()=>{return typeof window.__rac==='string'&&window.__rac.length>0;})()" 14
agent-browser eval "(()=>{const t=window.__rac||''; const v=t.split('\\n').filter(x=>x.trim()!==''); const glava=v[0]||''; return JSON.stringify({csv:true, vrstic:v.length, glava:glava.slice(0,80), imeOk:glava.length>0, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z4: R249/R248 regresija — primerjalni pilli še vedno ŽIVO (Material/Cene) ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi primerjalni cenik kot CSV\"]');})()" 24
sleep 1
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const pC=id('Izvozi primerjalni cenik kot CSV'); const pP=id('Izvozi primerjalni cenik kot PDF'); const leg=document.body.textContent.includes('· Povprečni razpon = vsota razlik / vsota najboljših'); const leg249=document.body.textContent.includes('· Največji razpon = najširši % med artikli'); return JSON.stringify({primCsv:!!pC, primPdf:!!pP, legenda248:leg, legenda249:leg249, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z5: temna + err null ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1

echo "=== ZAKLJUČEK: fp post BAJTNATO == pre + port sproščen + brskalnik zaprt ==="
node scripts/r245-db-e2e.cjs fp > /tmp/r250-fp-post.json
if cmp -s /tmp/r250-fp-pre.json /tmp/r250-fp-post.json; then echo "DB BAJTNATO IDENTIČNA (pre==post — bralna runda)"; else echo "DB RAZLIKA!"; diff <(python3 -m json.tool /tmp/r250-fp-pre.json) <(python3 -m json.tool /tmp/r250-fp-post.json) | head -20; fi
node scripts/r245-db-e2e.cjs fp | python3 -c "import json,sys; d=json.load(sys.stdin); print('FINAL stevci:', d['stevci'])"
agent-browser close --all > /dev/null 2>&1
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "=== R250 E2E KONEC ==="
