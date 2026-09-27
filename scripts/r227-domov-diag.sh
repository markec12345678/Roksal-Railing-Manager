#!/bin/bash
# R227 Domov diag — zakaj kartica 'Brez dobavitelja' ni v DOM?
# Preveri: nalagalno napako (rdeča veja), invLoading stanje, in-page fetch /api/inventory.
set -u
PROD="https://roksal-railing-manager.vercel.app"

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
sleep 2
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
for i in $(seq 1 20); do
  R=$(agent-browser eval "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik'));})()" 2>&1 | tail -1)
  if [ "$R" = "true" ]; then echo "  prijava OK (poskus $i)"; break; fi
  sleep 3
done
sleep 2
for i in 1 2 3; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'dashboard',more:null,subTab:null,osnutek:null,filter:null}})); return 'nav';})()" > /dev/null 2>&1
sleep 8

echo "--- DIAG 1: ali je nalagalna napaka vidna? (rdeča veja besedila) ---"
agent-browser eval "(()=>{const napake=[...document.querySelectorAll('[role=\"alert\"],div,p,span')].filter(e=>e.children.length===0&&/napaka|nismo uspeli|poskusite znova/i.test(e.textContent)).map(e=>e.textContent.trim().slice(0,80)); return JSON.stringify({napake:napake.slice(0,5), err:window.__err??null});})()" 2>&1 | tail -1

echo "--- DIAG 2: in-page fetch /api/inventory (seja + Origin) ---"
agent-browser eval "(()=>{return fetch('/api/inventory',{credentials:'include'}).then(r=>r.text().then(t=>{window.__inv={status:r.status,len:t.length,body:t.slice(0,400)}}))).then(()=>window.__inv?JSON.stringify({status:window.__inv.status,len:window.__inv.len,head:window.__inv.body.slice(0,200)}):'poll nič');})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{return window.__inv?JSON.stringify({status:window.__inv.status,len:window.__inv.len,head:window.__inv.body.slice(0,250)}):'ni';})()" 2>&1 | tail -1

echo "--- DIAG 3: Domov kartice inventarja (nizka zaloga družina) ---"
agent-browser eval "(()=>{const nizka=document.body.textContent.includes('materialov z nizko zalogo'); const dobrovecer=document.body.textContent.includes('Dobro'); const aktivna=document.body.textContent.includes('čakajo na dejanje'); const brez=/Brez dobavitelja/.test(document.body.textContent); return JSON.stringify({nizkaKartica:nizka, pozdrav:dobrovecer, aktivnaNarocila:aktivna, brezDobavitelja:brez, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser close --all > /dev/null 2>&1
echo "=== DIAG KONEC ==="
