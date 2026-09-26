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
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return 1;})()" > /dev/null 2>&1
sleep 6
agent-browser eval "(()=>{const d=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Domov'); if(d) d.click(); return 1;})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return 1;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Ekipa')); if(t) t.click(); return 1;})()" > /dev/null 2>&1
sleep 8
agent-browser eval "(()=>{const tel=document.body.textContent.replace(/\s+/g,' '); const i=tel.indexOf('Ekipa'); return JSON.stringify({odlomek: i>=0 ? tel.slice(i, i+400) : null});})()" 2>&1 | tail -1
agent-browser close --all > /dev/null 2>&1 || true
