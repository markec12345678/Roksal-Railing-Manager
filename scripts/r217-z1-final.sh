#!/bin/bash
# R217 Z1 final — paleta 'Nizka zaloga' klik (selector po r216-e2e vzorcu:
# textContent '· minimum' + 'Zaloga ', MouseEvent bubbles).
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
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'odprta';} return 'ni';})()" 2>&1 | tail -1
sleep 8
echo "--- Z1: klik artikel 'Nizka zaloga' → Zaloga aktiven + dialog ---"
agent-browser eval "(()=>{const glava=[...document.querySelectorAll('[cmdk-group-heading]')].find(e=>e.textContent.trim().startsWith('Nizka zaloga')); const it=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes('· minimum')&&e.textContent.includes('Zaloga ')); if(!it) return 'NI vnosa (glava:'+(glava?glava.textContent.trim():'—')+')'; const txt=it.textContent.trim(); it.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'KLIK: '+txt.slice(0,70);})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const act=[...document.querySelectorAll('[aria-current=\"page\"]')].map(e=>e.textContent.trim()).slice(0,3); const dlg=[...document.querySelectorAll('[role=\"dialog\"][data-state=\"open\"]')].map(d=>d.querySelector('[data-slot=\"dialog-title\"]')?.textContent||'?'); const min=dlg.length?[...document.querySelectorAll('[role=\"dialog\"][data-state=\"open\"]')].some(d=>d.textContent.includes('· minimum')):false; return JSON.stringify({aktiven:act, dialog:dlg, podnapisMinimum:min});})()" 2>&1 | tail -1
agent-browser screenshot /tmp/r217-z1-final.png > /dev/null 2>&1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[role=\"dialog\"][data-state=\"open\"] button')].find(x=>x.textContent.trim()==='Prekliči'); if(b){b.click(); return 'preklicano (brez DB zapisa)';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "window.__err ?? 'err-null'" 2>&1 | tail -1
agent-browser close --all > /dev/null 2>&1
echo "=== KONEC r217-z1-final ==="
