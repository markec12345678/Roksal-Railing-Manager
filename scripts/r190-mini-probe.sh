#!/bin/bash
# R190 finalni mini-probe: (A) spot projekti stevilo (utemeljitev peata null),
# (C) Ekipa meja s PRAVILNO navigacijo (VizTab izhod prek Domov → dashboard → Več)
set -u
PROD="https://roksal-railing-manager.vercel.app"
agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12

echo "--- A) spot projekti stevilo ---"
agent-browser eval "(async()=>{const r=await fetch('/api/projects'); if(!r.ok) return JSON.stringify({status:r.status}); const d=await r.json(); return JSON.stringify({status:r.status, stevilo:Array.isArray(d)?d.length:null});})()" 2>&1 | tail -1

echo "--- C) Ekipa meja (pravilna navigacija) ---"
# iz VizTab (ce odprt) ven prek 'Domov'
agent-browser eval "(()=>{const d=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Domov'); if(d){d.click(); return 'izsel';} return 'ni viztab';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v){v.click(); return 'vec odprt';} return 'vec NI';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Ekipa')); if(t){t.click(); return 'ekipa klik';} return 'ekipa NI';})()" 2>&1 | tail -1
sleep 8
agent-browser eval "(()=>{const tel=document.body.textContent; const vloga=tel.match(/Tvoja vloga: [A-Z]+/); return JSON.stringify({vloga:vloga?vloga[0]:null, rateLimitPanel:tel.includes('Poskusi znova'), omejitevNaslov:tel.includes('Omejitev')});})()" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1 || true
echo "R190 MINI PROBE KONEC"
