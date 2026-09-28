#!/bin/bash
# R251 E2E ŽIVO (lokalni :3100, ADMIN) — OPOMNIK PDF (8. člen 'izvozi'
# družine: terenski list za ponovni kontakt — status VERBATIM iz API-ja, KPI
# trio Status/Datum/Dni, tabele Stranka/Naloga/Kontekst, fail-closed) +
# regresije R250 (prihodki PDF + racuni CSV). SEED/RESTORE runda: raw SQL
# nastavi opomnik na 'Janez Novak' (original v /tmp/r251-crm-original.json),
# E2E dokazi, RESTORE → fp pre==post BAJTNATO IDENTIČEN (ZERO-MUTACIJA).
# Dokazi: (1) R250 4 kontrolni elementi ŽIVO; (2) opomniški blok + pill +
# legenda251 + dni resnica ('še X dni' — WYSIWYG); (3) opomnik PDF = %PDF
# magija + NOV glifni razred + toast 'Opomnik prenešen v PDF' z realno
# resnico; (4) R250 prihodki PDF uspešna pot + R136 racuni CSV 9 stolpcev;
# (5) temna + err null; (6) RESTORE → fp pre==post bajtnato + port sproščen.
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r251-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R251-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- PRSTNI ODTIS PRE (vključuje Customer opomnik resnico) ---"
node scripts/r251-db-e2e.cjs fp > /tmp/r251-fp-pre.json
cat /tmp/r251-fp-pre.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('PRE:', d['stevci'])"

echo "--- SEED: opomnik na 'Janez Novak' (original shranjen) ---"
node scripts/r251-db-e2e.cjs seed

echo "--- PRIJAVA (prek e2e-lib.sh) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; node scripts/r251-db-e2e.cjs restore; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z1: R250 regresija — CRM tab: 4 kontrolni elementi (CSV + prihodki pilli + press-scale + legendaR250) ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi prihodke kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const cC=id('Izvozi račune kot CSV'); const pP=id('Izvozi prihodke kot PDF'); const leg=document.body.textContent.includes('CSV = vsi računi (vrstice) · PDF = povzetek za vodstvo'); return JSON.stringify({csvPill:!!cC, prihodkiPill:!!pP, obaPS:[cC,pP].every(b=>b&&b.className.includes('press-scale')), legenda250:leg, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z2: R251 — detail 'Janez Novak': opomniški blok + pill + legenda251 + dni resnica ==="
agent-browser eval "(()=>{const kartica=document.querySelector('[role=\"button\"][aria-label^=\"Stranka Janez Novak\"]'); if(!kartica) return 'ni kartice'; kartica.click(); return 'kartica kliknjena';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Pripravi opomnik kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const b=document.body.textContent; const pill=document.querySelector('button[aria-label=\"Pripravi opomnik kot PDF\"]'); const blok=b.includes('Letni pregled balkonov')||b.includes('E2E R251 pregled ograje'); return JSON.stringify({pillViden:!!pill, pillPS:pill?pill.className.includes('press-scale'):false, pillDisabled:pill?pill.disabled:null, legenda251:b.includes('PDF = terenski list za obisk · Potekel = prek datuma'), opisViden:blok, dniResnica:/(še \d+ dni|prek \d+ dni)/.test(b), datumViden:/2\. ?10\. ?2026/.test(b), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r251-e2e-blok.png" > /dev/null 2>&1

echo "=== Z3: R251 — opomnik PDF klik: toast + %PDF magija + NOV glifni razred ==="
eb_zajem_pdf opmpdf
eb_csv_reset opmpdf
eb_klik_gumb "Pripravi opomnik kot PDF"
eb_pocakaj_tekst "Opomnik prenešen v PDF" 14
eb_cakaj 1
agent-browser eval "(()=>{const t=document.body.textContent; const imeResnica=t.includes('Janez Novak · '); const dniResnica=/(še \d+ dni)/.test(t); return JSON.stringify({toastTitle:t.includes('Opomnik prenešen v PDF'), toastIme:imeResnica, toastDni:dniResnica, err:window.__err??null});})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return typeof window.__opmpdf==='string'&&window.__opmpdf.length>0;})()" 14
agent-browser eval "(()=>{const b64=window.__opmpdf; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); const znani=[30057,30119,30191,30253,35565,38753,39927,41519,42798,37709,37771,36788]; return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, novGlifniRazred:!znani.includes(bin.length), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r251-e2e-toast.png" > /dev/null 2>&1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
eb_cakaj 1

echo "=== Z4: R250/R136 regresija — prihodki PDF uspešna pot + racuni CSV 9 stolpcev ==="
eb_zajem_pdf prhpdf
eb_csv_reset prhpdf
eb_klik_gumb "Izvozi prihodke kot PDF"
eb_pocakaj_tekst "Prihodki prenešeni v PDF" 14
eb_pocakaj_na "(()=>{return typeof window.__prhpdf==='string'&&window.__prhpdf.length>0;})()" 14
agent-browser eval "(()=>{const b64=window.__prhpdf; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false}); const bin=atob(b64); return JSON.stringify({pdf:true, magija:bin.substring(0,5), bajtov:bin.length, err:window.__err??null});})()" 2>&1 | tail -1
eb_csv_capture rac
eb_csv_reset rac
eb_klik_gumb "Izvozi račune kot CSV"
eb_pocakaj_na "(()=>{return typeof window.__rac==='string';})()" 14
agent-browser eval "(()=>{const csv=window.__rac; if(typeof csv!=='string'||csv.length===0) return JSON.stringify({csv:false}); const glava=csv.split('\n')[0].split(';'); return JSON.stringify({csv:true, stolpcev:glava.length, glava:glava.slice(0,4).join('|'), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z5: temna + err null ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1

echo "=== Z6: RESTORE + prstni odtis post BAJTNATO == pre ==="
agent-browser close --all > /dev/null 2>&1
node scripts/r251-db-e2e.cjs restore
node scripts/r251-db-e2e.cjs fp > /tmp/r251-fp-post.json
cat /tmp/r251-fp-post.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('POST:', d['stevci'])"
if cmp -s /tmp/r251-fp-pre.json /tmp/r251-fp-post.json; then echo "DB BAJTNATO IDENTIČNA (pre==post — seed/restore bajtnato)"; else echo "DB RAZLIKA!"; diff <(python3 -m json.tool /tmp/r251-fp-pre.json) <(python3 -m json.tool /tmp/r251-fp-post.json) | head -20; fi

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "--- R251 E2E KONEC ---"
