#!/bin/bash
# R202 reprobe — Z1b popravljen: MONTER pristane na VIZ pogledu (lekcija R185:
# page.tsx {activeTab !== 'viz'} renda dom kot viz) → klik 'Moji projekti'
# (zgornja vrstica) ŠELE nato preveri Domov prazni stolpec.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
BASE="http://127.0.0.1:3100"
SS=/home/z/my-project/screenshots
TS=$(date +%s)
EMAIL="r202-reprobe-$TS@roksal.si"
GESLO="E2eR202Geslo1!"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
setsid node .next/standalone/server.js > /tmp/r202-server-reprobe.log 2>&1 < /dev/null &
sleep 5

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$BASE/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 10
PATH_ACT=$(agent-browser eval "(async()=>{const r=await fetch('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'invite',email:'$EMAIL',ime:'R202 Reprobe',vloga:'MONTER'})}); const b=await r.json().catch(()=>({})); return JSON.stringify({status:r.status, path:b.activationPath??null});})()" 2>&1 | tail -1)
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

echo "--- 1) pristanek: VIZ pogled (lekcija R185) ---"
agent-browser eval "(()=>{const viz=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.includes('VIZUALIZACIJA OGRAJE')).length; const moji=[...document.querySelectorAll('button,a')].filter(b=>b.textContent.trim().includes('Moji projekti')).length; return JSON.stringify({vizPristanek:viz>0,mojiProjektiGumbov:moji});})()" 2>&1 | tail -1

echo "--- 2) klik 'Moji projekti' → Domov ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button,a')].find(x=>x.textContent.trim()==='Domov'||(x.getAttribute('aria-label')||'')==='Domov'); if(b) b.click(); return !!b;})()" > /dev/null 2>&1
sleep 6
for i in 1 2 3; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done
agent-browser eval "(()=>{const blok=document.querySelector('[data-testid=\"domov-brez-projektov\"]'); const niP=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.trim()==='Ni projektov').length; const ol=document.querySelector('ol[aria-label=\"Kaj naprej\"]'); const koraki=ol?ol.querySelectorAll('li').length:null; const korak1=ol?ol.querySelectorAll('li')[0]?.textContent.trim():null; const novG=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim().includes('Nov projekt')).length; return JSON.stringify({blok:!!blok,niProjektov:niP,kajNaprej:!!ol,koraki,korak1,novProjektGumb:novG,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r202-e2e-domov-prazno2.png" > /dev/null 2>&1 && echo "screenshot DOMOV PRAZNO2 OK"

echo "--- 3) temna ---"
agent-browser eval "document.documentElement.classList.add('dark'); JSON.stringify({bg:getComputedStyle(document.body).backgroundColor,err:window.__err??null})" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r202-e2e-domov-prazno2-temna.png" > /dev/null 2>&1 && echo "screenshot TEMNA OK"

agent-browser eval "(async()=>{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({logout:r.status});})()" 2>&1 | tail -1
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
agent-browser close --all > /dev/null 2>&1 || true
echo "R202 REPROBE KONEC"
