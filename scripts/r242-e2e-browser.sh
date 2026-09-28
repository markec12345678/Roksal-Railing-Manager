#!/bin/bash
# R242 E2E ŽIVO — RBAC ogledalo Naročil + press-scale pariteta + PDF zaklep.
# ci@roksal.si = ADMIN: Naročila tab — vodič ODSOTEN (ADMIN nosi pravice) +
# CSV pilula nosi press-scale. Regresije: Z2b R237 Osnutek PDF (%PDF + dolžina
# — glifni razred trenutne minute); Z2c R241 CRM ogledalo; Z3 temna + __err
# null + health; Z4 DB bajtnato + port sproščen. ZERO-MUTACIJA: vsi tokovi =
# GET/dialogi (naročil 0 — ni vrstic za akcije; shranjevanja NIČ).
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r242-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R242-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- PRIJAVA (prek e2e-lib.sh) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z1: Domov — Brez 8 + Zamujena ODSOTNA (fingerprint) ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Brez dobavitelja ('));})()" 24
sleep 1
agent-browser eval "(()=>{const k=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Brez dobavitelja (')); if(!k) return JSON.stringify({brez:false, err:window.__err??null}); const m=(k.getAttribute('aria-label')||'').match(/Brez dobavitelja \\(\\d+\\)/); const zam=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')); return JSON.stringify({brez:true, brezSt:m?m[1]:null, zamujenaOdsotna:!zam, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r242-e2e-domov.png" > /dev/null 2>&1

echo "=== Z2: R242 JEDRO — Naročila tab za ADMIN (vodič ODSOTEN + press-scale pilula) ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{const c=document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]'); return !!c;})()" 24
sleep 1
agent-browser eval "(()=>{const csv=document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]'); const vodic=document.body.textContent.includes('Pregled naročil je samo za branje'); const pritisniScale=csv?csv.className.includes('press-scale'):false; const prazno=document.body.textContent.includes('Ni naročil'); return JSON.stringify({csvViden:!!csv, pressScale:pritisniScale, vodicOdsoten:!vodic, praznoStanjeIskreno:prazno, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r242-e2e-narocila-admin.png" > /dev/null 2>&1

echo "=== Z2b: Dobavitelji tab — press-scale pariteta (CSV + PDF + Nov dobavitelj) ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi dobavitelje kot PDF\"]');})()" 24
sleep 1
agent-browser eval "(()=>{const csv=document.querySelector('button[aria-label=\"Izvozi dobavitelje kot CSV\"]'); const pdf=document.querySelector('button[aria-label=\"Izvozi dobavitelje kot PDF\"]'); const nov=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Nov dobavitelj')); return JSON.stringify({csvPS:csv?csv.className.includes('press-scale'):false, pdfPS:pdf?pdf.className.includes('press-scale'):false, novPS:nov?nov.className.includes('press-scale'):false, failClosedNula:document.body.textContent.includes('Ni dobaviteljev'), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z2c: R237 regresija — Osnutek dialog PDF (%PDF + dolžina = glifni razred minute) ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{const g=document.querySelector('button[aria-label=\"Shrani naročilnico vidnih artiklov kot osnutek naročila\"]'); return !!g && !g.disabled;})()" 24
eb_klik_gumb "Shrani naročilnico vidnih artiklov kot osnutek naročila"
eb_pocakaj_na "(()=>{const p=document.querySelector('button[aria-label=\"Prenesi naročilnico vidnih artiklov kot PDF\"]'); return !!p && !p.disabled;})()" 14
sleep 1
eb_zajem_pdf pdf
eb_csv_reset pdf
eb_klik_gumb "Prenesi naročilnico vidnih artiklov kot PDF"
eb_pocakaj_tekst "Osnutek prenesen v PDF" 14
eb_pocakaj_na "(()=>{return typeof window.__pdf==='string'&&window.__pdf.length>0;})()" 14
agent-browser eval "(()=>{const bin=atob(window.__pdf); return JSON.stringify({magija:bin.substring(0,5), bajtov:bin.length, ura:new Date().toLocaleTimeString('sl-SI',{hour:'2-digit',minute:'2-digit'})});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
eb_cakaj 1

echo "=== Z2d: R241 regresija — CRM Računi ogledalo za ADMIN ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('(FURS)');})()" 24
sleep 1
agent-browser eval "(()=>{const nov=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Nov račun')); const vodic=document.body.textContent.includes('Pregled računov je samo za branje'); return JSON.stringify({novRacunViden:!!nov, vodicOdsoten:!vodic, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z3: temna tema + __err null + health ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Brez dobavitelja ('));})()" 24
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'dark';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser screenshot "$SS/qa-r242-e2e-temna.png" > /dev/null 2>&1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'light';})()" > /dev/null 2>&1
agent-browser eval "(()=>{return JSON.stringify({err:window.__err??null});})()" 2>&1 | tail -1
curl -s --max-time 10 http://127.0.0.1:3100/api/public/health; echo

echo "=== Z4: DB bajtnato identična (ZERO-MUTACIJA) + port sproščen ==="
node scripts/r242-db-qpizza.cjs
agent-browser close --all > /dev/null 2>&1
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "=== R242 E2E KONEC ==="
