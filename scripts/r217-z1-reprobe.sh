#!/bin/bash
# R217 Z1 reprobe — paleta 'Nizka zaloga' klik z daljšim čakanjem (fetch
# Promise.all ob odprtju palete potrebuje več časa v produkcijski mreži).
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
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta odprta';} return 'ni iskalnika';})()" 2>&1 | tail -1
# čakaj na skupino do 20 s (poll)
for i in 1 2 3 4 5 6 7 8 9 10; do
  R=$(agent-browser eval "(()=>{const items=[...document.querySelectorAll('[cmdk-item]')].filter(el=>(el.getAttribute('value')||'').startsWith('nizka zaloga ')); return items.length;})()" 2>&1 | tail -1)
  echo "poll $i: skupina=$R"
  if [ "$R" != "0" ]; then break; fi
  sleep 2
done
agent-browser eval "(()=>{const items=[...document.querySelectorAll('[cmdk-item]')].filter(el=>(el.getAttribute('value')||'').startsWith('nizka zaloga ')); if(!items.length) return 'SKUPINA NI VIDNA'; const v=items[0].getAttribute('value'); items[0].click(); return 'KLIK: '+v;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const act=[...document.querySelectorAll('[aria-current=\"page\"]')].map(e=>e.textContent.trim()).slice(0,3); const dlg=[...document.querySelectorAll('[role=\"dialog\"][data-state=\"open\"]')].map(d=>d.querySelector('[data-slot=\"dialog-title\"]')?.textContent||'?'); return JSON.stringify({aktiven:act, dialog:dlg});})()" 2>&1 | tail -1
agent-browser screenshot /tmp/r217-z1-reprobe.png > /dev/null 2>&1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[role=\"dialog\"][data-state=\"open\"] button')].find(x=>x.textContent.trim()==='Prekliči'); if(b){b.click(); return 'preklicano (brez DB zapisa)';} return 'ni gumba';})()" 2>&1 | tail -1
agent-browser eval "window.__err ?? 'err-null'" 2>&1 | tail -1
agent-browser close --all > /dev/null 2>&1
echo "=== KONEC r217-z1-reprobe ==="
