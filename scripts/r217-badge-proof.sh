#!/bin/bash
# R217 badge-dokaz: iskalni zadetek (NE skupinski) mora imeti badge + aria.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R217-server-badge.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done
agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 8
for i in 1 2 3 4 5; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 1
done
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h){h.click(); return 'Hammer';} return 'ze v app';})()" > /dev/null 2>&1
sleep 5
for i in 1 2 3 4; do
  agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'klik';} return 'ni';})()" > /dev/null 2>&1
  sleep 3
  O=$(agent-browser eval "(()=>{return !!document.querySelector('[cmdk-input]');})()" 2>&1 | tail -1)
  [ "$O" = "true" ] && break
done
agent-browser eval "(()=>{const inp=document.querySelector('[cmdk-input]'); const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; set.call(inp,'Inox'); inp.dispatchEvent(new Event('input',{bubbles:true})); return 'vneseno';})()" > /dev/null 2>&1
sleep 5
echo "--- iskalni zadetek (scope: item z badgeom) ---"
agent-browser eval "(()=>{const iskalni=[...document.querySelectorAll('[cmdk-item]')].filter(e=>e.textContent.includes('Inox Vijak M12 A4')); const zBadge=iskalni.find(e=>e.textContent.includes('Nizka zaloga')); const brezBadge=iskalni.find(e=>!e.textContent.includes('Nizka zaloga')); const m8=[...document.querySelectorAll('[cmdk-item]')].filter(e=>e.textContent.includes('Inox Vijak M8 A2')); return JSON.stringify({m12Vseh:iskalni.length,iskalniZBadge:!!zBadge,ariaLabel:zBadge?zBadge.getAttribute('aria-label'):null,podnapis:zBadge?zBadge.textContent.includes('· minimum'):null,redStevka:zBadge?zBadge.textContent.includes('15'):null,m8Vseh:m8.length,m8BrezBadge:m8.every(e=>!e.textContent.includes('Nizka zaloga')),m8BrezAria:m8.every(e=>e.getAttribute('aria-label')===null),err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r217-badge-dokaz.png" > /dev/null 2>&1 || agent-browser screenshot "/home/z/my-project/screenshots/qa-r217-badge-dokaz.png" > /dev/null 2>&1
agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "--- R217 badge-dokaz KONEC ---"
