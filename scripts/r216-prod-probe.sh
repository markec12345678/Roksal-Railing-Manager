#!/bin/bash
# R216 prod probe — deploy recheck R215 (push 11:35 UTC) + spot MONTER QA.
# Fingerprints (R215 worklog): žig > R214 11:17:03; 'Nizka zaloga' v palette
# chunku; 'Shrani kot osnutek' v inventory chunku (obiskati Zalogo! — R215
# lekcija 1); regresije: 'Material — Naročila (V5)', 'aria-current', 'orders-
# active', 'Prikaži Vse'; spot MONTER pečati, temna, __err null.
set -u
PROD="https://roksal-railing-manager.vercel.app"
echo "=== version + health (javno) ==="
curl -s "$PROD/api/public/version"; echo
curl -s "$PROD/api/public/health"; echo

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
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 4
# Zaloga rut obiskana (inventory chunk v sejni scan — R215 lekcija 1)
agent-browser eval "(()=>{const z=[...document.querySelectorAll('nav button,a')].find(b=>b.textContent.trim()==='Zaloga'); if(z){z.click(); return 'klik Zaloga';} return 'ni';})()" > /dev/null 2>&1
sleep 6
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim()==='Več'); if(v){v.click(); return 'klik';} return 'ni ga';})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Material V5')); if(t){t.click(); return 'klik';} return 'ni ga';})()" > /dev/null 2>&1
sleep 8
for i in 1 2; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done
echo "--- sejni chunk scan (R215 needleji + regresije) ---"
agent-browser eval "(async()=>{const u=window.performance.getEntriesByType('resource').map(e=>e.name).filter(n=>n.includes('/_next/static/chunks/')&&n.endsWith('.js')); const iz={}; const needli=['Nizka zaloga','Shrani kot osnutek','Naročilnica kot osnutek naročila','Material — Naročila (V5)','aria-current','Prikaži Vse','orders-active','Naročila, ki čakajo na dejanje','Osveženo ob']; for(const url of u){try{const t=await (await fetch(url)).text(); for(const n of needli){if(t.includes(n)) iz[n]=(iz[n]||0)+1;}}catch(e){}} return JSON.stringify({chunkov:u.length,zadetki:iz,err:window.__err??null});})()" 2>&1 | tail -1
echo "--- spot MONTER zdravje (temna + __err) ---"
agent-browser eval "(()=>{return JSON.stringify({err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const o=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim()==='Odjava'||(b.getAttribute('aria-label')||'').includes('Odjava')); if(o){o.click(); return 'odjava';} return 'ni';})()" > /dev/null 2>&1
sleep 3
agent-browser close --all > /dev/null 2>&1 || true
echo "=== KONEC r216-prod-probe ==="
