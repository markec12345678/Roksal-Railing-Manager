#!/bin/bash
# R201 vizualni dokaz — kot reprobe2, a z ZAPRTIM onboarding dialogom pred sliko
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
BASE="http://127.0.0.1:3100"
SS=/home/z/my-project/screenshots
TS=$(date +%s)
EMAIL="r201-visual-$TS@roksal.si"
GESLO="E2eR201Geslo1!"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
setsid node .next/standalone/server.js > /tmp/r201-server-visual.log 2>&1 < /dev/null &
sleep 5

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$BASE/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 10
PATH_ACT=$(agent-browser eval "(async()=>{const r=await fetch('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'invite',email:'$EMAIL',ime:'R201 Vizualni',vloga:'MONTER'})}); const b=await r.json().catch(()=>({})); return JSON.stringify({status:r.status, path:b.activationPath??null});})()" 2>&1 | tail -1)
echo "POVABILO: $PATH_ACT"
TOKEN=$(echo "$PATH_ACT" | grep -oE '/aktivacija/[A-Za-z0-9_-]+' | cut -d/ -f3)
agent-browser eval "(async()=>{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({logout:r.status});})()" 2>&1 | tail -1
sleep 2
agent-browser open "$BASE/aktivacija/$TOKEN" > /dev/null 2>&1
sleep 4
agent-browser fill '#act-pass' "$GESLO" > /dev/null 2>&1
agent-browser fill '#act-repeat' "$GESLO" > /dev/null 2>&1
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Aktiviraj račun'); if(!g) return 'brez gumba'; g.click(); return 'poslan';})()" 2>&1 | tail -1
sleep 4
agent-browser open "$BASE/login" > /dev/null 2>&1
sleep 2
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' "$EMAIL" > /dev/null 2>&1
agent-browser fill 'input[type="password"]' "$GESLO" > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 10

echo "--- zapri onboarding, če je odprt ---"
agent-browser eval "(()=>{const z=[...document.querySelectorAll('button')].find(b=>/Zapri/.test(b.getAttribute('aria-label')||'')); if(z){z.click(); return 'zaprt';} const x=[...document.querySelectorAll('[role=dialog] button')].find(b=>b.textContent.trim()==='×'||(b.querySelector('svg')&&!b.textContent.trim())); if(x){x.click(); return 'x klik';} return 'ni dialoga';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const d=document.querySelectorAll('[role=dialog]').length; return JSON.stringify({dialogi:d});})()" 2>&1 | tail -1

echo "--- Meritve (0 projektov) — čist vizualni zapis ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Meritve')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 8
# onboarding se lahko ponovno pojavi na novem tabu — zapri ponovno, če je
agent-browser eval "(()=>{const z=[...document.querySelectorAll('[role=dialog] button')].find(b=>/Zapri/.test(b.getAttribute('aria-label')||'')); if(z){z.click(); return 'zaprt';} return 'ni dialoga';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const blok=document.querySelector('[data-testid=\"meritve-brez-projektov\"]'); const dialogi=document.querySelectorAll('[role=dialog]').length; return JSON.stringify({blokViden:!!blok,dialogi,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r201-e2e-prazni-cisto.png" > /dev/null 2>&1 && echo "screenshot CISTO OK"
agent-browser eval "document.documentElement.classList.add('dark'); 'temna'" > /dev/null 2>&1
sleep 1
agent-browser screenshot "$SS/qa-r201-e2e-prazni-cisto-temna.png" > /dev/null 2>&1 && echo "screenshot TEMNA CISTO OK"

agent-browser eval "(async()=>{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({logout:r.status});})()" 2>&1 | tail -1
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
agent-browser close --all > /dev/null 2>&1 || true
echo "R201 VIZUALNI KONEC"
