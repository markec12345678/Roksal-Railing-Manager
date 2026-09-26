#!/bin/bash
# R175 E2E (lokalni build, EN klic — nauček R157/R168): zaloga refetch-on-focus
# (P1-e) + Ekipa 403 = pravična meja (NI error panela — R175 fix produkcije).
# ADMIN (ci@roksal.si / DimniSmoke139!):
#  S0: Več → Zaloga — seznam naložen, NIČ error panelov;
#  D1: focus + visibilitychange → delta /api/inventory + /api/projects (hook ŽIVO);
#  E1: Več → Ekipa + fetch patch (403 za /api/users) → klik 'Osveži seznam
#      ekipe' → NIČ error panela ('Strežnik ni vrnil ekipe' NIČ v DOM) +
#      'Ni podatkov' prazno stanje (canRead veja — 403 je meja, ne napaka);
#  E1b: restore fetch → retry → seznam nazaj;
#  T:  temna tema + ring-offset #0f1724 + window.__err null.
# ⚠️ R171 NAUČEK: standalone RABI statiko — graditi z `npm run build`.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r175-e2e-server.log 2>&1 < /dev/null &
sleep 5
curl -s -o /dev/null -w "server: %{http_code}\n" http://127.0.0.1:3100/login

agent-browser close --all > /dev/null 2>&1 || true
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 5

agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 4

echo "--- S0: Več → Zaloga — seznam naložen, NIČ error panelov ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'')==='Zaloga'||b.textContent.trim().includes('Zaloga')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const errPanel=[...document.querySelectorAll('[role=\"alert\"]')].length; const invError=document.body.innerText.includes('Zaloge ni bilo mogoče'); const skelet=document.querySelector('[data-slot=\"skeleton\"]')!==null||document.querySelector('.animate-pulse')!==null; return JSON.stringify({errPanel, invError, skelet});})()" 2>&1 | tail -1

echo "--- D1: focus → delta /api/inventory + /api/projects (hook ŽIVO) ---"
agent-browser eval "window.__r175Pre={i:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/inventory')).length,p:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/projects')).length}; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); 'dispatchano'" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const g=k=>performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes(k)).length; return JSON.stringify({deltaInventory: g('/api/inventory')-(window.__r175Pre.i||0), deltaProjekti: g('/api/projects')-(window.__r175Pre.p||0)});})()" 2>&1 | tail -1

echo "--- E1: Več → Ekipa + fetch patch 403 → NIČ error panela (pravična meja) ---"
agent-browser eval "(()=>{const orig=window.fetch.bind(window); window.__r175orig=orig; window.fetch=function(input,init){const url=typeof input==='string'?input:(input&&input.url)||''; if(url.includes('/api/users')){return Promise.resolve(new Response(JSON.stringify({error:'Seznam uporabnikov je pravica users.read (pisarna).'}),{status:403,headers:{'Content-Type':'application/json'}}));} return orig(input,init);}; return 'patchano';})()" 2>&1 | tail -1
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Življenjski cikl računov')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const errPanel=[...document.querySelectorAll('[role=\"alert\"]')].length; const lazniAlarm=document.body.innerText.includes('Strežnik ni vrnil ekipe'); const praznoStanje=document.body.innerText.includes('Ni podatkov — povabite prvega člana ekipe.'); return JSON.stringify({errPanel, lazniAlarm, praznoStanje});})()" 2>&1 | tail -1

echo "--- E1b: restore fetch → retry → seznam nazaj ---"
agent-browser eval "(()=>{if(window.__r175orig){window.fetch=window.__r175orig;} const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-label')==='Osveži seznam ekipe'); if(!b) return 'gumb NIČ'; b.click(); return 'klikano';})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const errPanel=[...document.querySelectorAll('[role=\"alert\"]')].length; const seznam=document.body.innerText.includes('@roksal.si'); return JSON.stringify({errPanel, seznamNazaj: seznam});})()" 2>&1 | tail -1

echo "--- T: temna tema + ring-offset + konzola ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('temo')); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const body=getComputedStyle(document.body).backgroundColor; const ro=getComputedStyle(document.body).getPropertyValue('--tw-ring-offset-color').trim(); return JSON.stringify({bodyBg: body, ringOffset: ro, err: window.__err || null});})()" 2>&1 | tail -1

agent-browser screenshot /home/z/my-project/screenshots/qa-r175-e2e-ekipa.png > /dev/null 2>&1 && echo "screenshot OK"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
agent-browser close --all > /dev/null 2>&1 || true
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R175 E2E KONEC"
