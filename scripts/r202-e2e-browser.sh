#!/bin/bash
# R202 E2E ŽIVO: Domov iskren prazni stolpec + Meritve uskladitev
#   Z0 ADMIN prijava → Domov (15 projektov) → regresija: prazni blok NE,
#      seznam projektov prisoten; iskanje 'zzzni-rezultatov' → 'Ni rezultatov'
#   Z1 ADMIN povabilo MONTER (med sejo — lekcija R201) + aktivacija + prijava
#   Z1b Domov (0 projektov): data-testid domov-brez-projektov + 'Ni projektov'
#       + 'Kaj naprej' 3 koraki + gumb 'Nov projekt' DEJANSKO prisoten (vodič
#       kaže na realnost) + __err null
#   Z2 Meritve regresija R201 + uskladitev: blok ✓, 'Dodaj meritev' ×0, nov
#      vodič korak 1 ('Projekt ustvariš v zavihku Domov (gumb »Nov projekt«).')
#   Z3 temna + odjava + javne poti
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
BASE="http://127.0.0.1:3100"
SS=/home/z/my-project/screenshots
TS=$(date +%s)
NOVI="r202-e2e-$TS@roksal.si"
GESLO="E2eR202Geslo1!"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
setsid node .next/standalone/server.js > /tmp/r202-server-e2e.log 2>&1 < /dev/null &
sleep 5

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$BASE/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12

echo "--- Z0: ADMIN Domov (s projekti) — regresija ---"
agent-browser eval "(()=>{const blok=document.querySelector('[data-testid=\"domov-brez-projektov\"]'); const kartice=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.trim()==='Ni projektov').length; return JSON.stringify({prazniBlok:!!blok,niProjektovVidnov:kartice,err:window.__err??null});})()" 2>&1 | tail -1
echo "--- Z0b: iskanje 'zzz-ni-rezultatov' → iskren iskalni odgovor ---"
agent-browser eval "(()=>{const i=[...document.querySelectorAll('input[type=\"text\"],input[type=\"search\"],input[placeholder]')].find(x=>(x.placeholder||'').toLowerCase().includes('isk')||(x.getAttribute('aria-label')||'').toLowerCase().includes('isk')); if(!i) return 'ni iskalnega inputa'; const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(i,'zzz-ni-rezultatov'); i.dispatchEvent(new Event('input',{bubbles:true})); return 'vneseno';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const niRez=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.includes('Ni rezultatov za')).map(e=>e.textContent.trim())[0]||null; const blok=document.querySelector('[data-testid=\"domov-brez-projektov\"]'); return JSON.stringify({niRezultatov:niRez,prazniBlokPriIskanju:!!blok});})()" 2>&1 | tail -1
# počisti iskanje
agent-browser eval "(()=>{const i=[...document.querySelectorAll('input')].find(x=>x.value==='zzz-ni-rezultatov'); if(!i) return 'ni'; const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(i,''); i.dispatchEvent(new Event('input',{bubbles:true})); return 'pocisceno';})()" > /dev/null 2>&1

echo "--- Z1: povabilo MONTER (med ADMIN sejo) + aktivacija ---"
PATH_ACT=$(agent-browser eval "(async()=>{const r=await fetch('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'invite',email:'$NOVI',ime:'R202 E2E',vloga:'MONTER'})}); const b=await r.json().catch(()=>({})); return JSON.stringify({status:r.status, path:b.activationPath??null});})()" 2>&1 | tail -1)
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
agent-browser fill 'input[type="email"]' "$NOVI" > /dev/null 2>&1
agent-browser fill 'input[type="password"]' "$GESLO" > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 10

echo "--- Z1b: Domov (0 projektov) — ISKREN STOLPEC ŽIVO ---"
for i in 1 2 3; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done
agent-browser eval "(()=>{const blok=document.querySelector('[data-testid=\"domov-brez-projektov\"]'); const niP=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.trim()==='Ni projektov').length; const ol=document.querySelector('ol[aria-label=\"Kaj naprej\"]'); const koraki=ol?ol.querySelectorAll('li').length:null; const korak1=ol?ol.querySelectorAll('li')[0]?.textContent.trim():null; const novG=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim().includes('Nov projekt')).length; return JSON.stringify({blok:!!blok,niProjektov:niP,kajNaprej:!!ol,koraki,korak1,novProjektGumb:novG,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r202-e2e-domov-prazno.png" > /dev/null 2>&1 && echo "screenshot DOMOV PRAZNO OK"

echo "--- Z2: Meritve regresija R201 + uskladitev F2 ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Meritve')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 8
for i in 1 2; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done
agent-browser eval "(()=>{const blok=document.querySelector('[data-testid=\"meritve-brez-projektov\"]'); const ol=document.querySelector('ol[aria-label=\"Kaj naprej\"]'); const korak1=ol?ol.querySelectorAll('li')[0]?.textContent.trim():null; const dodaj=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Dodaj meritev').length; return JSON.stringify({blok:!!blok,korak1,dodajMeritev:dodaj,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z3: temna + javne poti + odjava ---"
agent-browser eval "document.documentElement.classList.add('dark'); JSON.stringify({bg:getComputedStyle(document.body).backgroundColor,err:window.__err??null})" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r202-e2e-temna.png" > /dev/null 2>&1 && echo "screenshot TEMNA OK"
agent-browser eval "(async()=>{const h=await fetch('/api/public/health'); const v=await fetch('/api/public/version'); const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({health:h.status,version:v.status,logout:r.status});})()" 2>&1 | tail -1

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
agent-browser close --all > /dev/null 2>&1 || true
echo "R202 E2E KONEC"
