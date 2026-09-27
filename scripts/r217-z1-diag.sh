#!/bin/bash
# R217 Z1 diag — zakaj 'Nizka zaloga' skupina ni vidna v paleti?
# 1) kaj /api/inventory VRNE v spot seji (status + oblika)
# 2) kateri cmdk-itemi obstajajo v odprti paleti
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
sleep 12
for i in 1 2 3; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done
echo "--- A) /api/inventory iz page konteksta (status + oblika) ---"
agent-browser eval "(async()=>{const r=await fetch('/api/inventory'); const t=await r.text(); let oblika='?'; try{const j=JSON.parse(t); oblika=Array.isArray(j)?('array len='+j.length):('obj keys='+Object.keys(j).slice(0,6).join(',')); if(Array.isArray(j)&&j.length){const a=j[0]; oblika+=' | prvi: '+JSON.stringify({naziv:a.naziv, kz:a.kolicinaZaloga, mz:a.minimalnaZaloga, en:a.enota}).slice(0,120);} }catch(e){oblika='ne-JSON: '+t.slice(0,80);} return JSON.stringify({status:r.status, oblika});})()" 2>&1 | tail -1
echo "--- B) /api/projects iz page konteksta ---"
agent-browser eval "(async()=>{const r=await fetch('/api/projects'); return 'status '+r.status;})()" 2>&1 | tail -1
echo "--- C) paleta odpri + vsi cmdk-itemi ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'odprta';} return 'ni';})()" 2>&1 | tail -1
sleep 8
agent-browser eval "(()=>{const items=[...document.querySelectorAll('[cmdk-item]')].map(el=>el.getAttribute('value')).slice(0,30); const heads=[...document.querySelectorAll('[cmdk-group-heading]')].map(e=>e.textContent.trim()); return JSON.stringify({st:items.length, heads, items});})()" 2>&1 | tail -1
agent-browser close --all > /dev/null 2>&1
echo "=== KONEC diag ==="
