#!/bin/bash
# R204 E2E ŽIVO (vzorec r203): standalone :3100, ADMIN (ci@roksal.si),
# Zaloga zavihek → R204 naročilnica:
#  Z0 prijava ADMIN + zapri onboarding
#  Z1 Zaloga: gumb 'Naročilnica' ŽIVO (pill poleg CSV) + CSV regresija
#  Z2 clipboard patch → klik Naročilnica:
#     - če so nizke zaloge: __naroc struktura (glava/števec/vrstice 'naroči') + uspešen toast
#     - če jih ni: iskren toast 'Ni artiklov pod minimalno zalogo — nič za naročilo.'
#  Z3 posamezen 'Naroči' (vrstica) → naročilnica 1 artikla z isto strukturo
#  Z4 filter WPC → 'filter: WPC' v besedilu (če so WPC nizki) | sicer preskok z zapisom
#  Z5 temna rgb(15,23,36) + __err null + odjava + javne poti + sprostitev porta
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
setsid node .next/standalone/server.js > /tmp/R204-server-e2e.log 2>&1 < /dev/null &
sleep 4

agent-browser close --all > /dev/null 2>&1 || true
sleep 1

echo "--- Z0: prijava ADMIN ---"
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 8
for i in 1 2 3; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done
agent-browser eval "(()=>{return JSON.stringify({url:location.pathname,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z1: 'Montažna orodja' → Več → Zaloga; gumb Naročilnica + CSV ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').toLowerCase().includes('zaloga')||b.textContent.trim().startsWith('Zaloga')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
for i in 1 2; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 1
done
agent-browser eval "(()=>{const nar=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'')==='Kopiraj naročilnico vidnih artiklov pod minimalno zalogo').length; const csv=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi vidno zalogo kot CSV').length; const pecat=[...document.querySelectorAll('span')].filter(e=>e.textContent.trim().startsWith('Osveženo ob')).map(e=>e.textContent.trim())[0]||null; const narociVrstic=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Naroči').length; const opozorila=[...document.querySelectorAll('p')].filter(e=>e.textContent.trim()==='Opozorila').length; return JSON.stringify({narocilnicaGumb:nar,csvGumb:csv,pecat,narociVrstic,opozorilaKartica:opozorila,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z2: clipboard patch → klik Naročilnica ---"
agent-browser eval "window.__naroc=null; navigator.clipboard.writeText=(t)=>{window.__naroc=t; return Promise.resolve();}; 'patched'" > /dev/null 2>&1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Kopiraj naročilnico vidnih artiklov pod minimalno zalogo'); if(b){b.click(); return 'klik';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const p=window.__naroc; const t=document.querySelector('[data-sonner-toast]'); const vrstice=p?p.split('\n'):[]; const struktura=p?{glava:vrstice[0]==='Naročilnica — Zaloga pod minimumom',stevec:/^\\d+ (artikel|artikla|artikli|artiklov) · osveženo /.test(vrstice[1]||''),vrsticeNaroci:(p.match(/naroči \\d+(\\.\\d+)? \\S+ \\(zaloga /g)||[]).length,minOmembe:(p.match(/\\/ min\\. /g)||[]).length,brezCen:!p.includes('€')}:null; return JSON.stringify({dolzina:p?p.length:0,glava:vrstice[0]||null,stevec:vrstice[1]||null,prveStiri:vrstice.slice(0,7),struktura,toast:t?t.textContent.trim().slice(0,90):null,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r204-e2e-narocilnica.png" > /dev/null 2>&1 && echo "screenshot NAROČILNICA OK"

echo "--- Z3: posamezen 'Naroči' v vrstici (če so nizke zaloge) ---"
agent-browser eval "window.__naroc=null; (()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Naroči'); if(b){b.click(); return 'klik';} return 'brez nizkih (iskrena pot že dokazana v Z2)';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const p=window.__naroc; const t=document.querySelector('[data-sonner-toast]'); const ena=p?(p.match(/naroči \\d+(\\.\\d+)? \\S+/g)||[]).length===1:false; return JSON.stringify({dolzina:p?p.length:0,enaVrstica:ena,glava:p?p.split('\n')[0]:null,toast:t?t.textContent.trim().slice(0,90):null,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z4: filter WPC → 'filter: WPC' v naročilnici (če WPC nizki) ---"
agent-browser eval "(()=>{const f=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='WPC'); if(f) f.click(); return !!f;})()" > /dev/null 2>&1
sleep 2
agent-browser eval "window.__naroc=null; (()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Kopiraj naročilnico vidnih artiklov pod minimalno zalogo'); if(b){b.click(); return 'klik';} return 'ni';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const p=window.__naroc; const t=document.querySelector('[data-sonner-toast]'); return JSON.stringify({vsebujeFilter:p?p.includes('filter: WPC'):null,glava:p?p.split('\n')[1]:null,toast:t?t.textContent.trim().slice(0,90):null,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z5: temna + javne poti + odjava ---"
agent-browser eval "document.documentElement.classList.add('dark'); JSON.stringify({bg:getComputedStyle(document.body).backgroundColor,err:window.__err??null})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r204-e2e-temna.png" > /dev/null 2>&1 && echo "screenshot TEMNA OK"
agent-browser click 'button[aria-label="Odjava"]' > /dev/null 2>&1
sleep 3
curl -s -o /dev/null -w "login_status=%{http_code} " http://127.0.0.1:3100/login
curl -s -m 10 http://127.0.0.1:3100/api/public/health | head -c 120; echo
agent-browser eval "(()=>{return JSON.stringify({url:location.pathname});})()" 2>&1 | tail -1

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
agent-browser close --all > /dev/null 2>&1 || true
echo "R204 E2E KONEC"
