#!/bin/bash
# R171 mikro-probe: je pečat v DOM a skrit (mobile viewport, hidden sm:flex)?
set -u
PROD="https://roksal-railing-manager.vercel.app"
agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 10
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 6
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Domov'); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 6
echo "--- viewport + pečat (textContent vs innerText) ---"
agent-browser eval "(()=>{const el=document.querySelector('span[title=\"\\u010cas zadnje uspe\\u0161ne osve\\u017eitve podatkov\"]'); const disp=el?getComputedStyle(el).display:null; const txt=el?el.textContent:null; const vis=el?el.offsetParent!==null:null; return JSON.stringify({vw:innerWidth, vh:innerHeight, elObstaja:!!el, display:disp, viden:vis, textContent:txt, innerTextIma:(document.body.innerText.match(/Osve\\u017eeno ob[^\n]*/)||[''])[0]});})()" 2>&1 | tail -1
agent-browser close --all > /dev/null 2>&1 || true
echo "PROBE KONEC"
