#!/bin/bash
# R243 E2E ŽIVO — wave 5 RBAC ogledalo (Zaloga: premiki + Osnutek; Material:
# Dobavitelji + Cene) + press-scale pariteta primarnih CTA.
# ci@roksal.si = ADMIN (nosi VSE pravice): vsi štirje vhodi VIDNI, vsi vodiči
# ODSOTNI, 'Potrdi premik'/'Shrani'/'Shrani ceno'/'Potrdi premik' nosijo
# press-scale. Regresije: Z1 Domov fingerprint (ADMIN: 'Nov projekt' VIDEN —
# R239 pozitivna veja); Z2e R237 Osnutek PDF (%PDF + glifni razred); Z2f R242
# Naročila ogledalo; Z3 temna + __err null + health; Z4 DB bajtnato + port
# sproščen. ZERO-MUTACIJA: dialogi samo odpri/Escape — shranjevanja NIČ,
# naročil 0, premikov 0.
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r243-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
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
setsid node .next/standalone/server.js > /tmp/R243-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- PRIJAVA (prek e2e-lib.sh) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done; exit 1; }
eb_zapri_vodic

echo "=== Z1: Domov — Brez 8 + Zamujena ODSOTNA + Nov projekt VIDEN (ADMIN veja R239) ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Brez dobavitelja ('));})()" 24
sleep 1
agent-browser eval "(()=>{const k=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Brez dobavitelja (')); if(!k) return JSON.stringify({brez:false, err:window.__err??null}); const m=(k.getAttribute('aria-label')||'').match(/Brez dobavitelja \\(\\d+\\)/); const zam=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')); const np=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Nov projekt')); return JSON.stringify({brezSt:m?m[1]:null, zamujenaOdsotna:!zam, novProjektViden:!!np, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r243-e2e-domov.png" > /dev/null 2>&1

echo "=== Z2: R243 JEDRO — Zaloga za ADMIN: premik gumb VIDEN + vodič ODSOTEN + press-scale ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Dodaj gibanje zaloge\"]');})()" 24
sleep 1
agent-browser eval "(()=>{const g=document.querySelector('button[aria-label=\"Dodaj gibanje zaloge\"]'); const vodic=document.body.textContent.includes('Pregled zaloge je samo za branje'); const ps=g?g.className.includes('press-scale'):false; return JSON.stringify({premikGumbViden:!!g, pressScale:ps, vodicPremikovOdsoten:!vodic, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r243-e2e-zaloga-admin.png" > /dev/null 2>&1

echo "=== Z2b: premik dialog odpri (samo odpri — Escape, NIČ shrambe) ==="
eb_klik_gumb "Dodaj gibanje zaloge"
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('[role=\"dialog\"]')].some(d=>d.textContent.includes('Premik zaloge'));})()" 10
sleep 1
agent-browser eval "(()=>{const d=[...document.querySelectorAll('[role=\"dialog\"]')].find(x=>x.textContent.includes('Premik zaloge')); if(!d) return JSON.stringify({dialog:false}); const potrdi=[...d.querySelectorAll('button')].find(b=>b.textContent.trim()==='Potrdi premik'); return JSON.stringify({dialog:true, potrdiViden:!!potrdi, potrdiPS:potrdi?potrdi.className.includes('press-scale'):false, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
eb_cakaj 1

echo "=== Z2c: Osnutek dialog za ADMIN — Shrani osnutek VIDEN + vodič ODSOTEN + CSV/PDF ==="
eb_pocakaj_na "(()=>{const g=document.querySelector('button[aria-label=\"Shrani naročilnico vidnih artiklov kot osnutek naročila\"]'); return !!g && !g.disabled;})()" 24
eb_klik_gumb "Shrani naročilnico vidnih artiklov kot osnutek naročila"
eb_pocakaj_na "(()=>{const p=document.querySelector('button[aria-label=\"Prenesi naročilnico vidnih artiklov kot PDF\"]'); return !!p && !p.disabled;})()" 14
sleep 1
agent-browser eval "(()=>{const d=[...document.querySelectorAll('[role=\"dialog\"]')].find(x=>x.textContent.includes('Naročilnica kot osnutek')); if(!d) return JSON.stringify({dialog:false, err:window.__err??null}); const shrani=[...d.querySelectorAll('button')].find(b=>b.textContent.trim()==='Shrani osnutek'); const csv=[...d.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'')==='Prenesi naročilnico vidnih artiklov kot CSV'); const vodic=d.textContent.includes('Shranjevanje osnutka naročila je pravica'); return JSON.stringify({dialog:true, shraniViden:!!shrani, shraniPS:shrani?shrani.className.includes('press-scale'):false, csvPill:csv, vodicOdsoten:!vodic, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
eb_cakaj 1

echo "=== Z2d: Material → Dobavitelji za ADMIN — Nov dobavitelj VIDEN + vodič ODSOTEN + cene select ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi dobavitelje kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const nov=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().includes('Nov dobavitelj')); const vodic=document.body.textContent.includes('Pregled dobaviteljev je samo za branje'); const vodicCen=document.body.textContent.includes('Vpisi in spremembe nabavnih cen so pravica'); const novPS=nov?nov.className.includes('press-scale'):false; return JSON.stringify({novViden:!!nov, novPS, vodicOdsoten:!vodic, vodicCenOdsoten:!vodicCen, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z2e: R237 regresija — Osnutek PDF (%PDF + glifni razred minute) ==="
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

echo "=== Z2f: R242 regresija — Naročila ogledalo za ADMIN (vodič ODSOTEN) ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]');})()" 24
sleep 1
agent-browser eval "(()=>{const vodic=document.body.textContent.includes('Pregled naročil je samo za branje'); const csv=document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]'); return JSON.stringify({vodicOdsoten:!vodic, csvPS:csv?csv.className.includes('press-scale'):false, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z3: temna tema + __err null + health ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Brez dobavitelja ('));})()" 24
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'dark';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser screenshot "$SS/qa-r243-e2e-temna.png" > /dev/null 2>&1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'light';})()" > /dev/null 2>&1
agent-browser eval "(()=>{return JSON.stringify({err:window.__err??null});})()" 2>&1 | tail -1
curl -s --max-time 10 http://127.0.0.1:3100/api/public/health; echo

echo "=== Z4: DB bajtnato identična (ZERO-MUTACIJA) + port sproščen ==="
node scripts/r242-db-qpizza.cjs
agent-browser close --all > /dev/null 2>&1
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "=== R243 E2E KONEC ==="
