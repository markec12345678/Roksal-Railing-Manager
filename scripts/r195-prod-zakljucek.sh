#!/bin/bash
# R195 zaključni produkcija doplačilni probe (R194 build še vedno na produkciji):
#   (a) seje dialog z pointerdown sekvenco (R137 regresija — zapre vrzel iz prvega proba)
#   (b) temna tema s pravim klikom na stikalo (zapre vrzel iz prvega proba)
#   (c) MONTER odjava cleanup
set -u
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12

echo "--- (a) seje dialog (pointerdown sekvenca) ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Odjava'); if(!t) return 'brez triggerja'; const r=t.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; t.dispatchEvent(new PointerEvent('pointerdown',o)); t.dispatchEvent(new PointerEvent('pointerup',o)); t.dispatchEvent(new MouseEvent('click',o)); return 'trigger poslan';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const m=[...document.querySelectorAll('[role=menuitem]')].find(x=>x.textContent.trim().startsWith('Aktivne seje')); if(!m) return 'brez itema'; const r=m.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; m.dispatchEvent(new PointerEvent('pointerdown',o)); m.dispatchEvent(new PointerEvent('pointerup',o)); m.dispatchEvent(new MouseEvent('click',o)); return 'item poslan';})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=dialog]')].pop(); if(!dlg) return JSON.stringify({dialog:false}); const vrstice=dlg.querySelectorAll('li').length; const gumb=[...dlg.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Odjavi vse ostale naprave')); const znacka=!![...dlg.querySelectorAll('*')].find(e=>e.textContent.trim()==='Ta naprava'&&e.childElementCount===0); return JSON.stringify({dialog:true, vrstice, znackaTaNaprava:znacka, gumbViden:!!gumb, opomba:'spot ima samo trenutno sejo → gumb pričakovano SKRIT (ostaliCount=0)'});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r195-prod-seje.png" > /dev/null 2>&1 && echo "screenshot PROD SEJE OK"
agent-browser eval "(()=>{const z=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Zapri'); if(z) z.click(); return !!z;})()" > /dev/null 2>&1
sleep 2

echo "--- (b) temna tema s klikom na stikalo ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('Preklopi na temno')); if(b) b.click(); return !!b;})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{return JSON.stringify({bodyBg:getComputedStyle(document.body).backgroundColor});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r195-prod-temna.png" > /dev/null 2>&1 && echo "screenshot PROD TEMNA OK"

echo "--- (c) cleanup: odjava ---"
agent-browser eval "(async()=>{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({logout:r.status, csrfOstane:document.cookie.includes('roksal_csrf=')});})()" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1 || true
echo "=== zaključni probe konec ==="
