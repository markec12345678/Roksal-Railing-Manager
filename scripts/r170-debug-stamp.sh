#!/bin/bash
# R170 E2E debug: zakaj pečat 'Osveženo ob' NI v innerTextu?
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r170-dbg-server.log 2>&1 < /dev/null &
sleep 5

agent-browser close --all > /dev/null 2>&1 || true
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 5

echo "--- viewport + iskanje pečata v DOM ---"
agent-browser eval "(()=>{const w=window.innerWidth; const el=[...document.querySelectorAll('span,p,div')].filter(x=>(x.textContent||'').includes('Osve\u017eeno')).slice(0,3).map(x=>({tag:x.tagName, txt:(x.textContent||'').slice(0,40), vis:getComputedStyle(x).display})); return JSON.stringify({w, el});})()" 2>&1 | tail -1

echo "--- remount prek 'Montažna orodja' → 'Domov' (nauček) ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Domov'); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 5

echo "--- pečat po remontu (visible display?) ---"
agent-browser eval "(()=>{const el=[...document.querySelectorAll('span')].filter(x=>(x.textContent||'').includes('Osve\u017eeno')).slice(0,2).map(x=>({txt:(x.textContent||'').slice(0,44), vis:getComputedStyle(x).display, disp:x.style.display})); const inner=(document.body.innerText.match(/Osve\u017eeno[^\n]*/)||[null])[0]; return JSON.stringify({el, inner});})()" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
echo "R170 DEBUG KONEC"
