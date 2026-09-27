#!/bin/bash
# R206 E2E ŽIVO (vzorec r205): standalone :3100, ADMIN (ci@roksal.si),
# Material → Naročila → R206:
#  Z0 prijava ADMIN + zapri onboarding
#  Z1 Material V5 → podzavihek 'Naročila': gumb 'Naročilnica' ×N (aria 'Kopiraj
#     naročilnico naročila pri …') + OSNUTEK gumb 'Označi kot poslano' ×1 (R205 osnutek)
#  Z2 clipboard patch → klik prve 'Naročilnica': glava 'Naročilnica — {dobavitelj}',
#     '{n} postavk…', vrstice 'i. naziv: k enota', BREZ €, toast 'kopirana v odložišče'
#  Z3 klik 'Označi kot poslano' → toast 'Označeno kot poslano (status POSLANO)'
#     + razlaga 'Aplikacija ne pošilja dokumentov' + značka POSLANO ŽIVO
#  Z4 temna rgb(15,23,36) + __err null + odjava + javne poti + sprostitev porta
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
setsid node .next/standalone/server.js > /tmp/R206-server-e2e.log 2>&1 < /dev/null &
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

echo "--- Z1: 'Montažna orodja' → Več → Material V5 → podzavihek 'Naročila' ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Material V5')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
for i in 1 2; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 1
done
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Naročila'); if(t){t.click(); return 'klik';} return 'ni zavihka';})()" 2>&1 | tail -1
sleep 5
agent-browser eval "(()=>{const kopiraj=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Kopiraj naročilnico naročila pri')).length; const oznaci=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Označi kot poslano').length; const pokaži=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Pokaži postavke').length; const pecat=[...document.querySelectorAll('span')].filter(e=>e.textContent.trim().startsWith('Osveženo ob')).map(e=>e.textContent.trim())[0]||null; return JSON.stringify({narocilnicaGumbi:kopiraj,oznaciPoslanoGumbi:oznaci,pokaziPostavke:pokaži,pecat,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z2: clipboard patch → klik prve Naročilnice (regeneracija iz naročila) ---"
agent-browser eval "window.__naroc=null; navigator.clipboard.writeText=(t)=>{window.__naroc=t; return Promise.resolve();}; 'patched'" > /dev/null 2>&1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Kopiraj naročilnico naročila pri')); if(b){window.__dobLabel=b.getAttribute('aria-label'); b.click(); return 'klik';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const p=window.__naroc; const v=p?p.split('\n'):[]; const t=[...document.querySelectorAll('[data-sonner-toast]')].map(e=>e.textContent.trim()).find(x=>x.includes('kopirana v odložišče'))||null; return JSON.stringify({ariaLabel:window.__dobLabel??null,glava:v[0]||null,stevec:v[1]||null,prveVrstice:v.slice(3,6),dolzina:p?p.length:0,brezEur:p?!p.includes('€'):null,toast:t,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r206-e2e-narocilnica-iz-narocila.png" > /dev/null 2>&1 && echo "screenshot NAROČILNICA IZ NAROČILA OK"

echo "--- Z3: 'Označi kot poslano' → iskren toast + značka POSLANO ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Označi kot poslano'); if(b){b.click(); return 'klik';} return 'ni gumba (OSNUTEK ni več?)';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('[data-sonner-toast]')].map(e=>e.textContent.trim()).find(x=>x.includes('Označeno kot poslano'))||null; const oznaci=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Označi kot poslano').length; const potrdi=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Potrdi').length; return JSON.stringify({toast:t,oznaciGumbiPo:oznaci,potrdiGumbiPo:potrdi,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z4: temna + odjava + javne poti ---"
agent-browser eval "document.documentElement.classList.add('dark'); JSON.stringify({bg:getComputedStyle(document.body).backgroundColor,err:window.__err??null})" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r206-e2e-temna.png" > /dev/null 2>&1 && echo "screenshot TEMNA OK"
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
echo "R206 E2E KONEC"
