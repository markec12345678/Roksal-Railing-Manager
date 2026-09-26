#!/bin/bash
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
# 1) Montažna orodja → VizTab
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t){t.click(); return 1;} return 0;})()" > /dev/null 2>&1
sleep 6
# 2) VizTab 'Domov' izhod → glavna app
agent-browser eval "(()=>{const d=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Domov'); if(d){d.click(); return 'izsel';} return 'domov NI (ze v app?)';})()" 2>&1 | tail -1
sleep 4
# 3) dashboard → 'Več'
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v){v.click(); return 'vec odprt';} return 'vec NI';})()" 2>&1 | tail -1
sleep 3
# 4) Ekipa
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Ekipa')); if(t){t.click(); return 'ekipa klik';} return 'ekipa NI';})()" 2>&1 | tail -1
sleep 8
agent-browser eval "(()=>{const tel=document.body.textContent; const vloga=tel.match(/Tvoja vloga: [A-Z]+/); return JSON.stringify({vloga:vloga?vloga[0]:null, rateLimitPanelOdsoten:!tel.includes('Poskusi znova'), omejitevNaslov:tel.includes('Omejitev')});})()" 2>&1 | tail -1
agent-browser close --all > /dev/null 2>&1 || true
echo "KONEC"
