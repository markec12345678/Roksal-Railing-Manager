#!/bin/bash
# R212 reprobe — 2 probe popravki iz E2E:
#  (1) Z3 navigacija: MaterialIntelligenceTab je LAZY (dynamic import) + pečat
#      je SPAN z gnezdenim spanom (childElementCount filter je lažno negativen)
#      → precizen probe: span pečat + sub-tab gumba 'Zaloga'/'Naročila' (svg)
#      + Več label.
#  (2) Z4 pečat: štetje 'Osveženo ob' SPANOV scope-ano na sheet (koren panela),
#      ne cel dokument (pod njim je Material pečat — lažno pozitiven).
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
setsid node .next/standalone/server.js > /tmp/R212-server-reprobe.log 2>&1 < /dev/null &
sleep 4

agent-browser close --all > /dev/null 2>&1 || true
sleep 1

echo "--- Z0: prijava ADMIN ---"
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 8
for i in 1 2 3; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done

echo "--- P1: zvonček → digest klik → Material V5 (lazy) ŽIVO ---"
agent-browser eval "(()=>{const zv=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Obvestila')); if(zv){zv.click(); return 'klik';} return 'ni zvoncka';})()" > /dev/null 2>&1
sleep 6
agent-browser eval "(()=>{const gumbi=[...document.querySelectorAll('button')].filter(b=>b.textContent.includes('Naročila, ki čakajo na dejanje')&&b.textContent.includes('Pregled: Material')); if(gumbi.length){gumbi[0].click(); return 'klik-digest';} return 'ni digesta';})()" 2>&1 | tail -1
sleep 8
for i in 1 2 3 4; do
  REZ=$(agent-browser eval "(()=>{const spanPecat=[...document.querySelectorAll('span')].filter(s=>s.textContent.trim().startsWith('Osveženo ob')).length; const subZaloga=[...document.querySelectorAll('button,[role=tab]')].filter(b=>b.querySelector('svg')&&b.textContent.trim().startsWith('Zaloga')).length; const subNar=[...document.querySelectorAll('button,[role=tab]')].filter(b=>b.querySelector('svg')&&b.textContent.includes('Naročila')).length; const naro=[...document.querySelectorAll('button,[role=tab]')].find(b=>b.querySelector('svg')&&b.textContent.includes('Naročila')); if(naro) naro.click(); return JSON.stringify({poskus:$i,materialPecat:spanPecat>0,subZaloga,subNarocila:subNar,err:window.__err??null});})()" 2>&1 | tail -1)
  echo "$REZ"
  echo "$REZ" | rg -q 'materialPecat":true' && break
  sleep 3
done
sleep 5
agent-browser eval "(()=>{const chips=[...document.querySelectorAll('[role=group][aria-label=\"Filter naročil po statusu\"] button')].map(b=>b.textContent.trim()); return JSON.stringify({narocilaSubTab:chips.length>0?chips:null,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- P2: fail-verbose pečat scope (samo sheet koren) ---"
agent-browser eval "(()=>{window.__origFetch=window.fetch; window.fetch=(u,...a)=>String(u).includes('/api/material-orders')?Promise.resolve(new Response(JSON.stringify({error:'R212 E2E izklop naročil'}),{status:500})):window.__origFetch(u,...a); return 'patched';})()" > /dev/null 2>&1
agent-browser eval "(()=>{const zv=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Obvestila')); if(zv){zv.click(); return 'klik';} return 'ni zvoncka';})()" > /dev/null 2>&1
sleep 6
for i in 1 2 3; do
  REZ=$(agent-browser eval "(()=>{const sheet=document.querySelector('[data-slot=sheet-content]')||document.querySelector('[role=dialog]'); if(!sheet) return JSON.stringify({poskus:$i,sheet:false}); const alert=[...sheet.querySelectorAll('[role=alert]')].find(e=>e.textContent.includes('niso bilo naloženi')); const pecatVSheetu=[...sheet.querySelectorAll('span')].filter(s=>s.textContent.trim().startsWith('Osveženo ob')).length; const vsebuje=alert?alert.textContent.includes('naročila'):false; return JSON.stringify({poskus:$i,sheet:true,viriNapaka:!!alert,vsebujeNarocila:vsebuje,pečatVSheetu:pecatVSheetu,retryGumb:alert?!!alert.querySelector('button'):false,err:window.__err??null});})()" 2>&1 | tail -1)
  echo "$REZ"
  echo "$REZ" | rg -q 'vsebujeNarocila":true' && break
  sleep 3
done

agent-browser eval "(()=>{window.fetch=window.__origFetch; return 'restored';})()" > /dev/null 2>&1
agent-browser eval "(()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return 'esc';})()" > /dev/null 2>&1
sleep 1
agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R212 REPROBE KONEC"
