#!/bin/bash
# R220 diag: Z1 palette first-open — dump headings/items/fetch state
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r220-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R220-diag2.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 8
echo "--- vodic gumbi ---"
for i in 1 2 3; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" 2>&1 | tail -1
  sleep 1
done
echo "--- stanje po prijavi ---"
agent-browser eval "JSON.stringify({url:location.pathname,title:document.title,stGumbov:document.querySelectorAll('button').length,iskalnik:!![...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')),dialogi:[...document.querySelectorAll('[role=dialog]')].map(d=>d.textContent.slice(0,40))})" 2>&1 | tail -1

echo "--- odpri palet ---"
for i in 1 2 3 4; do
  agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'klik';} return 'ni gumba';})()" > /dev/null 2>&1
  sleep 3
  ODPRT=$(agent-browser eval "(()=>{return !!document.querySelector('[cmdk-input]');})()" 2>&1 | tail -1)
  if [ "$ODPRT" = "true" ]; then echo "paleta odprta (poskus $i)"; break; fi
done

echo "--- dump 1 (takoj) ---"
agent-browser eval "JSON.stringify({url:location.pathname, heads:[...document.querySelectorAll('[cmdk-group-heading]')].map(e=>e.textContent), nItems:document.querySelectorAll('[cmdk-item]').length, vrednosti:[...document.querySelectorAll('[cmdk-item]')].map(e=>e.getAttribute('value')).slice(0,20)})" 2>&1 | tail -1

sleep 6
echo "--- dump 2 (+6 s) ---"
agent-browser eval "JSON.stringify({url:location.pathname, heads:[...document.querySelectorAll('[cmdk-group-heading]')].map(e=>e.textContent), nItems:document.querySelectorAll('[cmdk-item]').length, vrednosti:[...document.querySelectorAll('[cmdk-item]')].map(e=>e.getAttribute('value')).slice(0,20)})" 2>&1 | tail -1

echo "--- fetch /api/inventory ročno (iz konteksta strani) ---"
agent-browser eval "(async()=>{try{const r=await fetch('/api/inventory'); const st=r.status; const d=await r.json(); const arr=Array.isArray(d)?d:[]; const pod=arr.filter(i=>i.kolicinaZaloga<=i.minimalnaZaloga).length; const na=arr.filter(i=>i.kolicinaZaloga===i.minimalnaZaloga).length; return JSON.stringify({st,n:arr.length,pod,na});}catch(e){return 'napaka: '+e.message;}})()" 2>&1 | tail -1

echo "--- server log (zadnjih 10) ---"
tail -10 /tmp/R220-diag2.log

agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
echo "--- DIAG KONEC ---"
