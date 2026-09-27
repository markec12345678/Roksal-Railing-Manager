#!/bin/bash
# R202 diag + dokaz — najdi REALNO pot do DashboardTab (bottom nav je skrit v
# viz pogledu; pot = 'Montažna orodja' vzorec R200/R201) → preveri prazni stolpec
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
BASE="http://127.0.0.1:3100"
SS=/home/z/my-project/screenshots
TS=$(date +%s)
EMAIL="r202-diag-$TS@roksal.si"
GESLO="E2eR202Geslo1!"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
setsid node .next/standalone/server.js > /tmp/r202-server-diag.log 2>&1 < /dev/null &
sleep 5

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$BASE/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 10
PATH_ACT=$(agent-browser eval "(async()=>{const r=await fetch('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'invite',email:'$EMAIL',ime:'R202 Diag',vloga:'MONTER'})}); const b=await r.json().catch(()=>({})); return JSON.stringify({status:r.status, path:b.activationPath??null});})()" 2>&1 | tail -1)
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

echo "--- DIAG: vidni navigacijski elementi po prijavi (MONTER, viz pristanek) ---"
agent-browser eval "(()=>{const el=[...document.querySelectorAll('button,a')].map(b=>({t:b.textContent.trim().slice(0,24),a:b.getAttribute('aria-label')||null})).filter(x=>(x.t&&x.t.length>0)||x.a).slice(0,40); return JSON.stringify(el);})()" 2>&1 | tail -1

echo "--- POT: klik 'Montažna orodja' (vzorec R200/R201) ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 5
agent-browser eval "(()=>{const el=[...document.querySelectorAll('button,a')].map(b=>({t:b.textContent.trim().slice(0,20),a:b.getAttribute('aria-label')||null})).filter(x=>x.t&&/Domov|dom|Nadzor|Projekt/i.test(x.t)).slice(0,15); return JSON.stringify(el);})()" 2>&1 | tail -1

echo "--- klik 'Domov' (kjer koli se sedaj pojavi) ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button,a')].find(x=>x.textContent.trim()==='Domov'); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 6
for i in 1 2 3; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done
agent-browser eval "(()=>{const blok=document.querySelector('[data-testid=\"domov-brez-projektov\"]'); const niP=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.trim()==='Ni projektov').length; const ol=document.querySelector('ol[aria-label=\"Kaj naprej\"]'); const koraki=ol?ol.querySelectorAll('li').length:null; const korak1=ol?ol.querySelectorAll('li')[0]?.textContent.trim():null; const novG=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim().includes('Nov projekt')).length; const naslovi=[...document.querySelectorAll('h1,h2,h3')].map(e=>e.textContent.trim()).slice(0,6); return JSON.stringify({blok:!!blok,niProjektov:niP,kajNaprej:!!ol,koraki,korak1,novProjektGumb:novG,naslovi,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r202-e2e-domov-prazno3.png" > /dev/null 2>&1 && echo "screenshot DOMOV PRAZNO3 OK"
agent-browser eval "document.documentElement.classList.add('dark'); JSON.stringify({bg:getComputedStyle(document.body).backgroundColor,err:window.__err??null})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r202-e2e-domov-prazno3-temna.png" > /dev/null 2>&1 && echo "screenshot TEMNA OK"

agent-browser eval "(async()=>{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({logout:r.status});})()" 2>&1 | tail -1
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
agent-browser close --all > /dev/null 2>&1 || true
echo "R202 DIAG KONEC"
