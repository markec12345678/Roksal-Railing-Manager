#!/bin/bash
# R168: živi preverba stikala 'Samo moje termine' (aria-pressed false→true) + prazno stanje.
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
sleep 8
echo "--- stanje pred klikom:"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Samo moje termine')||(b.textContent||'').includes('Samo moje termine')); const txt=document.body.innerText; const praznoM=txt.match(/Ni va[šs][^\\n]{0,40}termin[^\\n]{0,30}/); return JSON.stringify({pressed: t?t.getAttribute('aria-pressed'):null, praznoStanje: praznoM?praznoM[0].slice(0,50):null});})()" 2>&1 | tail -1
echo "--- klik na stikalo:"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Samo moje termine')||(b.textContent||'').includes('Samo moje termine')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 2
echo "--- stanje po kliku:"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Samo moje termine')||(b.textContent||'').includes('Samo moje termine')); return JSON.stringify({pressed: t?t.getAttribute('aria-pressed'):null});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r168-termini-toggle.png > /dev/null 2>&1 && echo "screenshot OK"
agent-browser close --all > /dev/null 2>&1 || true
echo "R168 TOGGLE KONEC"
