#!/bin/bash
# R190 focused re-probe: offline pas (startsWith lookup) + Meritve pecat + VizTab odprtost
set -u
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12

echo "--- A) Meritve pecat (ponovno, z diagnostiko) ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Meritve')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 10
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].filter(e=>e.textContent.trim().startsWith('Osveženo ob')).map(e=>e.textContent.trim()); const failPanel=[...document.querySelectorAll('[role=alert]')].map(e=>e.textContent.trim().slice(0,80)); return JSON.stringify({pecati:p, failPaneli:failPanel});})()" 2>&1 | tail -1

echo "--- B) VizTab offline pas (startsWith lookup) ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 6
agent-browser eval "(()=>{const dom=[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Domov'); return JSON.stringify({vizTabOdprt:dom});})()" 2>&1 | tail -1
agent-browser eval "window.dispatchEvent(new Event('offline')); 'poslano'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const pas=[...document.querySelectorAll('[role=status]')].filter(e=>e.textContent.includes('Ni povezave')); const vDokumentuN=[...document.querySelectorAll('*')].filter(e=>e.textContent.startsWith('Ni povezave — aplikacija deluje naprej')&&e.childElementCount===0).length; return JSON.stringify({pasViden:pas.length>0, prvi:pas[0]?pas[0].textContent.slice(0,60):null, vDokumentuN});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r190-viztab-offline2.png" > /dev/null 2>&1 && echo "screenshot OK"
agent-browser eval "window.dispatchEvent(new Event('online')); 'poslano'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const pas=[...document.querySelectorAll('[role=status]')].filter(e=>e.textContent.includes('Ni povezave')); return JSON.stringify({pasPoOnline:pas.length});})()" 2>&1 | tail -1

echo "--- C) MONTER Ekipa meja (regresija: 403 fail-closed) ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Ekipa')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 8
agent-browser eval "(()=>{const tel=document.body.textContent; return JSON.stringify({zavrnjeno:tel.includes('403')||tel.includes('Tvoja vloga'), panelOdsoten:!tel.includes('Poskusi znova')});})()" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1 || true
echo "R190 FOCUSED RE-PROBE KONEC"
