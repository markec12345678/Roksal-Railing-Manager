#!/bin/bash
# R199 E2E ŽIVO: ADMIN ekipni pregled neuspešnih prijav + jakost gesla (dialog).
#   Z0 UI prijava ADMIN (ci@roksal.si) + POVABILO prek UI fetch → aktivacija obrazec
#   Z1 prijava novega uporabnika → odjava → NAPAČNO geslo (določljiv LOGIN_FAILED audit)
#   Z2 (R199) ADMIN prijava → zvonček 'Pregled neuspešnih prijav (24 h)' s ščitom
#      + števcem '× napačno geslo po celotni ekipi' (garantirano: napaka iz Z1 je v oknu)
#   Z3 (R199) dialog 'Zamenjaj geslo': jakostna lestvica ŽIVO — 'Šibko' (rdeča),
#      'Močno' (zelena), < 8 → vrstica skrita; brez pošiljanja (Prekliči)
#   Z4 regresije: 'Označi vse' gumb, temna, __err null
#   Z5 javne poti + odjava + čiščenje
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
BASE="http://127.0.0.1:3100"
SS=/home/z/my-project/screenshots
NOVI="r199-e2e-$(date +%s)@roksal.si"
GESLO="E2eR199Geslo1!"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
setsid node .next/standalone/server.js > /tmp/r199-server-e2e.log 2>&1 < /dev/null &
sleep 5

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$BASE/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12

echo "--- Z0: prijava ADMIN + povabilo (UI fetch) ---"
agent-browser eval "JSON.stringify({url:location.pathname, err:window.__err??null})" 2>&1 | tail -1
PATH_ACT=$(agent-browser eval "(async()=>{const r=await fetch('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'invite',email:'$NOVI',ime:'R199 E2E',vloga:'MONTER'})}); const b=await r.json().catch(()=>({})); return JSON.stringify({status:r.status, path:b.activationPath??null});})()" 2>&1 | tail -1)
echo "POVABILO: $PATH_ACT"
TOKEN=$(echo "$PATH_ACT" | grep -oE '/aktivacija/[A-Za-z0-9_-]+' | cut -d/ -f3)
agent-browser open "$BASE/aktivacija/$TOKEN" > /dev/null 2>&1
sleep 4
agent-browser fill '#act-pass' "$GESLO" > /dev/null 2>&1
agent-browser fill '#act-repeat' "$GESLO" > /dev/null 2>&1
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Aktiviraj račun'); if(!g) return 'brez gumba'; g.click(); return 'poslan';})()" 2>&1 | tail -1
sleep 4

echo "--- Z1: prijava novega uporabnika → odjava → NAPAČNO geslo (LOGIN_FAILED) ---"
agent-browser eval "(async()=>{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({logout:r.status});})()" 2>&1 | tail -1
sleep 2
agent-browser open "$BASE/login" > /dev/null 2>&1
sleep 2
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' "$NOVI" > /dev/null 2>&1
agent-browser fill 'input[type="password"]' "$GESLO" > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 10
agent-browser eval "(async()=>{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({logout:r.status});})()" 2>&1 | tail -1
sleep 2
agent-browser open "$BASE/login" > /dev/null 2>&1
sleep 2
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' "$NOVI" > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'NarobnoGeslo199' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 4
NAPACNO=$(agent-browser eval "JSON.stringify({napaka:document.body.textContent.includes('Napačen e-naslov ali geslo.')})" 2>&1 | tail -1)
echo "NAPAČNA PRIJAVA (garantira LOGIN_FAILED): $NAPACNO"

echo "--- Z2 (R199): ADMIN prijava → zvonček 'Pregled neuspešnih prijav (24 h)' ---"
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(!b) return 'brez zvoncka'; const r=b.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; b.dispatchEvent(new PointerEvent('pointerdown',o)); b.dispatchEvent(new PointerEvent('pointerup',o)); b.dispatchEvent(new MouseEvent('click',o)); return 'zvoncek poslan';})()" 2>&1 | tail -1
sleep 4
Z2=$(agent-browser eval "(()=>{const v=document.body.textContent; const scit=document.querySelector('.bg-roksal-amber\\\\/10'); return JSON.stringify({pregled:v.includes('Pregled neuspešnih prijav (24 h)'), skupniStevci:v.includes('× napačno geslo po celotni ekipi'), stitViden:!!scit, err:window.__err??null});})()" 2>&1 | tail -1)
echo "Z2 ZVONČEK: $Z2"
agent-browser screenshot "$SS/e2e-r199-pregled.png" > /dev/null 2>&1 && echo "screenshot PREGLED OK"
agent-browser eval "(()=>{const z=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(z) z.click(); return 'zapri';})()" > /dev/null 2>&1
sleep 1

echo "--- Z3 (R199): dialog 'Zamenjaj geslo' — jakostna lestvica ŽIVO ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('Račun')||x.querySelector('.lucide-log-out')); if(!t) return 'brez sprožilca'; const r=t.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; t.dispatchEvent(new PointerEvent('pointerdown',o)); t.dispatchEvent(new PointerEvent('pointerup',o)); t.dispatchEvent(new MouseEvent('click',o)); return 'meni poslan';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const i=[...document.querySelectorAll('[role=menuitem]')].find(x=>x.textContent.trim()==='Zamenjaj geslo'); if(!i) return 'brez vrstice'; i.click(); return 'dialog poslan';})()" 2>&1 | tail -1
sleep 2
agent-browser fill '#pwd-current' 'DimniSmoke139!' > /dev/null 2>&1
# (a) kratko geslo (< 8) → lestvica SKRITA
agent-browser fill '#pwd-next' 'Ab1!' > /dev/null 2>&1
A=$(agent-browser eval "JSON.stringify({skrito:!document.body.textContent.includes('Močno')&&!document.body.textContent.includes('Šibko')&&!document.body.textContent.includes('Sprejemljivo')})" 2>&1 | tail -1)
# (b) šibko (≥ 8, 2 razreda) → 'Šibko' rdeča
agent-browser fill '#pwd-next' 'sibkogeslo1' > /dev/null 2>&1
B=$(agent-browser eval "(()=>{const v=document.body.textContent; const rdeca=!!document.querySelector('.bg-roksal-red'); return JSON.stringify({sibko:v.includes('Šibko'), rdecaBarva:rdeca});})()" 2>&1 | tail -1)
# (c) močno (4 razredi) → 'Močno' zelena
agent-browser fill '#pwd-next' 'MocnoGeslo199!' > /dev/null 2>&1
C=$(agent-browser eval "(()=>{const v=document.body.textContent; const zelena=!!document.querySelector('.bg-green-500'); return JSON.stringify({mocno:v.includes('Močno'), zelenaBarva:zelena});})()" 2>&1 | tail -1)
echo "Z3 JAKOST: kratko=$A šibko=$B močno=$C"
agent-browser screenshot "$SS/e2e-r199-jakost.png" > /dev/null 2>&1 && echo "screenshot JAKOST OK"
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Prekliči'); if(g) g.click(); return 'preklicano';})()" > /dev/null 2>&1
sleep 1

echo "--- Z4: regresije ('Označi vse' gumb, temna, __err) ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(!b) return 'brez zvoncka'; const r=b.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; b.dispatchEvent(new PointerEvent('pointerdown',o)); b.dispatchEvent(new PointerEvent('pointerup',o)); b.dispatchEvent(new MouseEvent('click',o)); return 'odprto';})()" > /dev/null 2>&1
sleep 3
Z4A=$(agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Označi vse kot prebrano')); return JSON.stringify({oznaciVseGumb:!!g, err:window.__err??null});})()" 2>&1 | tail -1)
echo "Z4 ZVONČEK-GUMB: $Z4A"
agent-browser eval "(()=>{const z=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(z) z.click(); return 'zapri';})()" > /dev/null 2>&1
sleep 1
agent-browser eval "(()=>{const t=document.querySelector('button[aria-label*=\"tem\" i], button[aria-label*=\"Tem\"]'); if(t) t.click(); return 'klik';})()" > /dev/null 2>&1
sleep 2
BG=$(agent-browser eval "getComputedStyle(document.body).backgroundColor" 2>&1 | tail -1)
echo "Z4 TEMNA: $BG (pričakovano rgb(15, 23, 36))"
agent-browser eval "(()=>{const t=document.querySelector('button[aria-label*=\"tem\" i], button[aria-label*=\"Tem\"]'); if(t) t.click(); return 'nazaj';})()" > /dev/null 2>&1
sleep 1

echo "--- Z5: javne poti + odjava + čiščenje ---"
curl -sS -m 10 -o /dev/null -w "version:%{http_code} " "$BASE/api/public/version"
curl -sS -m 10 -o /dev/null -w "health:%{http_code}\n" "$BASE/api/public/health"
agent-browser eval "(async()=>{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({logout:r.status});})()" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "=== R199 E2E KONEC ==="
