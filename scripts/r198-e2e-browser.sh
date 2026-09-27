#!/bin/bash
# R198 E2E ŽIVO: menjava gesla → PASSWORD_CHANGED vrstica + masovno 'Označi vse'.
#   Z0 UI prijava (ADMIN ci@roksal.si) + POVABILO prek UI fetch (/api/users invite)
#   Z1 aktivacija prek /aktivacija/{token} (UI obrazec) → 'Geslo je nastavljeno'
#   Z2 prijava novega uporabnika → zvonček: 'Vaš račun je aktiviran' + 'Nova prijava'
#      + ŠČIT (bg-roksal-amber/10)
#   Z3 (R198) 'Označi vse kot prebrano' gumb → vse vrstice OPENED, gumb izgine,
#      badge izgine (neprebrana = 0)
#   Z4 (R198) menjava gesla prek UI dialoga (dropdown 'Zamenjaj geslo') → samodejna
#      odjava → prijava z NOVIM geslom → zvonček: 'Vaše geslo je bilo spremenjeno'
#      + 'Vse seje so odjavljene' + ščit vrstica
#   Z5 javne poti + odjava + čiščenje
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
BASE="http://127.0.0.1:3100"
SS=/home/z/my-project/screenshots
NOVI="r198-e2e-$(date +%s)@roksal.si"
GESLO="E2eR198Geslo1!"
NOVOGESLO="E2eR198Novo2!"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
setsid node .next/standalone/server.js > /tmp/r198-server-e2e.log 2>&1 < /dev/null &
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
agent-browser eval "JSON.stringify({url:location.pathname, err:window.__err??null, napaka:[...document.querySelectorAll('[role=alert],p,span')].map(e=>e.textContent.trim()).filter(t=>t.includes('Preveč')||t.includes('Napačen')||t.includes('geslo')).slice(0,3)})()" 2>&1 | tail -1
PATH_ACT=$(agent-browser eval "(async()=>{const r=await fetch('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'invite',email:'$NOVI',ime:'R198 E2E',vloga:'MONTER'})}); const b=await r.json().catch(()=>({})); return JSON.stringify({status:r.status, path:b.activationPath??null});})()" 2>&1 | tail -1)
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

echo "--- Z2: odjava ADMIN → prijava novega uporabnika → zvonček ---"
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

echo "--- Z3 (R198): 'Označi vse kot prebrano' → vse OPENED, gumb izgine ---"
Z3A=$(agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Označi vse kot prebrano')); if(!g) return JSON.stringify({gumb:false}); const lbl=g.getAttribute('aria-label'); g.click(); return JSON.stringify({gumb:true, lbl});})()" 2>&1 | tail -1)
echo "Z3 GUMB: $Z3A"
sleep 4
Z3B=$(agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Označi vse kot prebrano')); const odprto=[...document.querySelectorAll('[role=dialog] [role=list] button, [role=dialog] ul button')].filter(x=>x.textContent.includes('Odprto')).length; return JSON.stringify({gumbIzginil:!g, odprtihVrstic:odprto, err:window.__err??null});})()" 2>&1 | tail -1)
echo "Z3 PO OZNAČITVI: $Z3B"
agent-browser screenshot "$SS/e2e-r198-oznaci-vse.png" > /dev/null 2>&1 && echo "screenshot OZNAČI-VSE OK"
agent-browser eval "(()=>{const z=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(z) z.click(); return 'zapri';})()" > /dev/null 2>&1
sleep 1

echo "--- Z4 (R198): menjava gesla prek UI dialoga → odjava → prijava z novim → ščit vrstica ---"
ODPRI=$(agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('Račun')||x.querySelector('.lucide-log-out')); if(!t) return 'brez sprožilca'; const r=t.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; t.dispatchEvent(new PointerEvent('pointerdown',o)); t.dispatchEvent(new PointerEvent('pointerup',o)); t.dispatchEvent(new MouseEvent('click',o)); return 'meni poslan';})()" 2>&1 | tail -1)
echo "Z4 MENI: $ODPRI"
sleep 2
agent-browser eval "(()=>{const i=[...document.querySelectorAll('[role=menuitem]')].find(x=>x.textContent.trim()==='Zamenjaj geslo'); if(!i) return 'brez vrstice'; i.click(); return 'dialog poslan';})()" 2>&1 | tail -1
sleep 2
agent-browser fill '#pwd-current' "$GESLO" > /dev/null 2>&1
agent-browser fill '#pwd-next' "$NOVOGESLO" > /dev/null 2>&1
agent-browser fill '#pwd-repeat' "$NOVOGESLO" > /dev/null 2>&1
POV=$(agent-browser eval "JSON.stringify({okvir:document.body.textContent.includes('Vse naprave bodo odjavljene')})()" 2>&1 | tail -1)
echo "Z4 OKVIR (ščit informacija): $POV"
agent-browser screenshot "$SS/e2e-r198-geslo-dialog.png" > /dev/null 2>&1 && echo "screenshot DIALOG OK"
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Zamenjaj geslo'); if(!g) return 'brez gumba'; g.click(); return 'poslan';})()" 2>&1 | tail -1
sleep 6
Z4A=$(agent-browser eval "JSON.stringify({url:location.pathname, err:window.__err??null})()" 2>&1 | tail -1)
echo "Z4 PO MENJAVI (pričakovano /login): $Z4A"
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' "$NOVI" > /dev/null 2>&1
agent-browser fill 'input[type="password"]' "$NOVOGESLO" > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(!b) return 'brez zvoncka'; const r=b.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; b.dispatchEvent(new PointerEvent('pointerdown',o)); b.dispatchEvent(new PointerEvent('pointerup',o)); b.dispatchEvent(new MouseEvent('click',o)); return 'zvoncek poslan';})()" 2>&1 | tail -1
sleep 4
Z4B=$(agent-browser eval "(()=>{const v=document.body.textContent; return JSON.stringify({spremenjeno:v.includes('Vaše geslo je bilo spremenjeno'), odjavljene:v.includes('Vse seje so odjavljene'), klicSkrbniku:v.includes('če to niste bili vi, takoj obvestite skrbnika'), err:window.__err??null});})()" 2>&1 | tail -1)
echo "Z4 ZVONČEK: $Z4B"
agent-browser screenshot "$SS/e2e-r198-geslo-vrstica.png" > /dev/null 2>&1 && echo "screenshot GESLO-VRSTICA OK"

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
echo "=== R198 E2E KONEC ==="
