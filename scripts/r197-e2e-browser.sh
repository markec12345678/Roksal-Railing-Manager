#!/bin/bash
# R197 E2E ŽIVO: polni povabilski življenjski cikel + varnostne vrstice zvončka.
#   Z0 UI prijava (ADMIN ci@roksal.si) + POVABILO prek UI fetch (/api/users invite)
#   Z1 aktivacija prek /aktivacija/{token} (UI obrazec) → 'Geslo je nastavljeno'
#   Z2 prijava novih uporabnikov → zvonček: 'Vaš račun je aktiviran' +
#      'Nova prijava v vaš račun' + ŠČIT (bg-roksal-amber/10) v varnostnih vrsticah
#   Z3 odjava → NAPAČNO geslo (401) → prava prijava → 'Neuspešni poskusi
#      prijave pred to prijavo' z '1 × napačno geslo v zadnjih 24 urah'
#   Z4 javne poti + odjava + čiščenje
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
BASE="http://127.0.0.1:3100"
SS=/home/z/my-project/screenshots
NOVI="r197-e2e-$(date +%s)@roksal.si"
GESLO="E2eR197Geslo1!"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
setsid node .next/standalone/server.js > /tmp/r197-server-e2e.log 2>&1 < /dev/null &
sleep 5

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$BASE/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12

echo "--- Z0: prijava + povabilo (UI fetch) ---"
agent-browser eval "JSON.stringify({url:location.pathname, err:window.__err??null})" 2>&1 | tail -1
PATH_ACT=$(agent-browser eval "(async()=>{const r=await fetch('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'invite',email:'$NOVI',ime:'R197 E2E',vloga:'MONTER'})}); const b=await r.json().catch(()=>({})); return JSON.stringify({status:r.status, path:b.activationPath??null});})()" 2>&1 | tail -1)
echo "POVABILO: $PATH_ACT"
TOKEN=$(echo "$PATH_ACT" | grep -oE '/aktivacija/[A-Za-z0-9_-]+' | cut -d/ -f3)

echo "--- Z1: aktivacija prek UI obrazca ---"
agent-browser open "$BASE/aktivacija/$TOKEN" > /dev/null 2>&1
sleep 4
agent-browser fill '#act-pass' "$GESLO" > /dev/null 2>&1
agent-browser fill '#act-repeat' "$GESLO" > /dev/null 2>&1
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Aktiviraj račun'); if(!g) return 'brez gumba'; g.click(); return 'poslan';})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const v=document.body.textContent; return JSON.stringify({uspeh:v.includes('Geslo je nastavljeno'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/e2e-r197-aktivacija.png" > /dev/null 2>&1 && echo "screenshot AKTIVACIJA OK"

echo "--- Z2: odjava ADMIN → prijava novih uporabnikov → zvonček ---"
agent-browser eval "(async()=>{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({logout:r.status});})()" 2>&1 | tail -1
sleep 2
agent-browser open "$BASE/login" > /dev/null 2>&1
sleep 2
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' "$NOVI" > /dev/null 2>&1
agent-browser fill 'input[type="password"]' "$GESLO" > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(!b) return 'brez zvoncka'; const r=b.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; b.dispatchEvent(new PointerEvent('pointerdown',o)); b.dispatchEvent(new PointerEvent('pointerup',o)); b.dispatchEvent(new MouseEvent('click',o)); return 'zvoncek poslan';})()" 2>&1 | tail -1
sleep 4
Z2=$(agent-browser eval "(()=>{const v=document.body.textContent; const scit=document.querySelector('.bg-roksal-amber\\\\/10'); return JSON.stringify({aktivirano:v.includes('Vaš račun je aktiviran'), novaPrijava:v.includes('Nova prijava v vaš račun'), scitViden:!!scit, err:window.__err??null});})()" 2>&1 | tail -1)
echo "Z2 ZVONČEK: $Z2"
agent-browser screenshot "$SS/e2e-r197-zvoncek.png" > /dev/null 2>&1 && echo "screenshot ZVONČEK OK"

echo "--- Z3: odjava → napačno geslo → prava prijava → FAILED_LOGINS vrstica ---"
agent-browser eval "(async()=>{const z=document.querySelector('[data-sonner-toast] [data-close]'); if(z) z.click(); const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({logout:r.status});})()" 2>&1 | tail -1
sleep 2
agent-browser open "$BASE/login" > /dev/null 2>&1
sleep 2
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' "$NOVI" > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'NarobnoGeslo1' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 4
NAPACNO=$(agent-browser eval "JSON.stringify({napakaViden:document.body.textContent.includes('Napačen e-naslov ali geslo.')})" 2>&1 | tail -1)
echo "NAPAČNA PRIJAVA: $NAPACNO"
agent-browser fill 'input[type="password"]' "$GESLO" > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(!b) return 'brez zvoncka'; b.click(); return 'zvoncek poslan';})()" 2>&1 | tail -1
sleep 4
Z3=$(agent-browser eval "(()=>{const v=document.body.textContent; return JSON.stringify({opozorilo:v.includes('Neuspešni poskusi prijave pred to prijavo'), stevec:v.includes('1 × napačno geslo v zadnjih 24 urah'), err:window.__err??null});})()" 2>&1 | tail -1)
echo "Z3 FAILED_LOGINS: $Z3"
agent-browser screenshot "$SS/e2e-r197-neuspesne.png" > /dev/null 2>&1 && echo "screenshot NEUSPESNE OK"

echo "--- Z4: javne poti + odjava ---"
curl -sS -m 10 -o /dev/null -w "version:%{http_code} " "$BASE/api/public/version"
curl -sS -m 10 -o /dev/null -w "health:%{http_code}\n" "$BASE/api/public/health"
agent-browser eval "(async()=>{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({logout:r.status});})()" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "=== R197 E2E KONEC ==="
