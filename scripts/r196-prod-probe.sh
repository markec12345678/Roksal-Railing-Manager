#!/bin/bash
# R196 produkcija QA — R195 fingerprinti ŽIVO (R195 build 00:46:18.476Z):
#   (a) curl tuja seja (spot) — druga naprava simulacija
#   (b) seje dialog: ≥2 vrstici + masovni gumb VIDEN (R195 na produkciji!)
#   (c) arm/confirm → tuja seja 401, trenutna ostane
#   (d) CSRF toast ŽIVO (napačna glava → 403 → sonner 'Dejanje je zavrnjeno')
#   (e) odjava cleanup
set -u
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

echo "--- (a) curl tuja seja (spot) ---"
curl -sS -m 15 -X POST "$PROD/api/auth" -H "Origin: $PROD" -H 'Content-Type: application/json' \
  -d '{"email":"spot-r165@roksal.si","password":"SpotR165Qa!Pass"}' -D /tmp/r196-prod-login2.txt -o /dev/null
TOK2=$(grep -i '^set-cookie: roksal_session=' /tmp/r196-prod-login2.txt | head -1 | sed 's/^[Ss]et-[Cc]ookie: roksal_session=//' | cut -d';' -f1)
ST1=$(curl -sS -m 10 -o /dev/null -w '%{http_code}' "$PROD/api/auth" -H "Authorization: Bearer $TOK2")
echo "tuja seja ŽIVA: $ST1 (pričakovano 200)"

echo "--- (b) UI prijava + seje dialog ---"
agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Odjava'); if(!t) return 'brez triggerja'; const r=t.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; t.dispatchEvent(new PointerEvent('pointerdown',o)); t.dispatchEvent(new PointerEvent('pointerup',o)); t.dispatchEvent(new MouseEvent('click',o)); return 'meni poslan';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const m=[...document.querySelectorAll('[role=menuitem]')].find(x=>x.textContent.trim().startsWith('Aktivne seje')); if(!m) return 'brez itema'; const r=m.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; m.dispatchEvent(new PointerEvent('pointerdown',o)); m.dispatchEvent(new PointerEvent('pointerup',o)); m.dispatchEvent(new MouseEvent('click',o)); return 'item poslan';})()" 2>&1 | tail -1
sleep 3
for i in 1 2 3 4 5 6; do
  REZ=$(agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=dialog]')].pop(); if(!dlg) return JSON.stringify({dialog:false}); const g=[...dlg.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Odjavi vse ostale naprave')); return JSON.stringify({dialog:true, vrstice:dlg.querySelectorAll('li').length, gumb:g?g.textContent.trim():null});})()" 2>&1 | tail -1)
  echo "$REZ" | grep -qE 'gumb\\":\\"' && break
  sleep 1
done
echo "DIALOG: $REZ"
agent-browser screenshot "$SS/qa-r196-prod-gumb.png" > /dev/null 2>&1 && echo "screenshot PROD GUMB OK"

echo "--- (c) arm/confirm → tuja seja 401 ---"
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=dialog]')].pop(); const g=[...dlg.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Odjavi vse ostale naprave')); if(!g) return 'brez'; const r=g.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; g.dispatchEvent(new PointerEvent('pointerdown',o)); g.dispatchEvent(new PointerEvent('pointerup',o)); g.dispatchEvent(new MouseEvent('click',o)); return 'arm';})()" > /dev/null 2>&1
sleep 1
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=dialog]')].pop(); const g=[...dlg.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Odjavi vse ostale naprave')); if(!g) return 'brez'; const r=g.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; g.dispatchEvent(new PointerEvent('pointerdown',o)); g.dispatchEvent(new PointerEvent('pointerup',o)); g.dispatchEvent(new MouseEvent('click',o)); return 'izvedba';})()" > /dev/null 2>&1
sleep 4
ST2=$(curl -sS -m 10 -o /dev/null -w '%{http_code}' "$PROD/api/auth" -H "Authorization: Bearer $TOK2")
echo "tuja seja PO: $ST2 (pričakovano 401)"
agent-browser eval "(()=>{const toast=[...document.querySelectorAll('[data-sonner-toast]')].map(t=>t.textContent).find(t=>t.includes('Ostale naprave so odjavljene')); return JSON.stringify({revokeToastViden:!!toast});})()" 2>&1 | tail -1

echo "--- (d) CSRF toast ŽIVO ---"
agent-browser eval "(async()=>{const zapri=document.querySelector('[data-sonner-toast] [data-close]'); if(zapri) zapri.click(); const r=await fetch('/api/customers',{method:'POST',headers:{'Content-Type':'application/json','x-csrf-token':'naroben-r196-prod'},body:JSON.stringify({ime:'x',naslov:'y'})}); const b=await r.json().catch(()=>({})); return JSON.stringify({status:r.status, dvojniPodpis:JSON.stringify(b).includes('dvojni podpis')});})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const toast=[...document.querySelectorAll('[data-sonner-toast]')].map(t=>t.textContent).find(t=>t.includes('Dejanje je zavrnjeno')); return JSON.stringify({csrfToastViden:!!toast});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r196-prod-csrf-toast.png" > /dev/null 2>&1 && echo "screenshot PROD CSRF TOAST OK"

echo "--- (e) odjava cleanup ---"
agent-browser eval "(async()=>{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({logout:r.status, csrfOstane:document.cookie.includes('roksal_csrf=')});})()" 2>&1 | tail -1
agent-browser close --all > /dev/null 2>&1 || true
echo "=== R196 produkcija probe konec ==="
