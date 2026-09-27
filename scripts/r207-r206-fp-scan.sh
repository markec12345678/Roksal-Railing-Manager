#!/bin/bash
# R207 QA dopolnilo v2 — R206 fingerprinti, z navigacijsko instrumentacijo
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
echo "--- A) stanje po prijavi ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')).map(b=>b.getAttribute('aria-label')); return JSON.stringify({url:location.pathname,orodja:h,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 4
echo "--- B) menu po kliku orodij ---"
agent-browser eval "(()=>{const itemi=[...document.querySelectorAll('button,a')].map(b=>b.textContent.trim()).filter(t=>t&&t.length<30); return JSON.stringify({url:location.pathname,itemi:itemi.slice(0,25),err:window.__err??null});})()" 2>&1 | tail -1
echo "--- B2) klik 'Več' → listek ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim()==='Več'); if(v){v.click(); return 'klik';} return 'ni ga';})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Material V5')); if(t){t.click(); return 'klik';} return 'ni ga';})()" 2>&1 | tail -1
sleep 8
for i in 1 2; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done
echo "--- C) stanje po Material V5 ---"
agent-browser eval "(()=>{const tabs=[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(t=>t&&t.length<20); const pecat=[...document.querySelectorAll('span')].map(e=>e.textContent.trim()).find(t=>t.startsWith('Osveženo ob')); return JSON.stringify({tabs:tabs.slice(0,32),pecat:pecat||null,err:window.__err??null});})()" 2>&1 | tail -1
echo "--- D) klik 'Naročila' pod-zavihek (če obstaja) ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,[role=tab]')].find(b=>b.textContent.trim()==='Naročila'); if(t){t.click(); return 'klik';} const t2=[...document.querySelectorAll('button,[role=tab]')].find(b=>b.textContent.trim().startsWith('Naročila')); if(t2){t2.click(); return 'klik2:'+t2.textContent.trim();} return 'ni ga';})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const n=[...document.querySelectorAll('button[aria-label^=\"Kopiraj naročilnico naročila pri\"]')].length; const poslani=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Označi kot poslano').length; const kartice=[...document.querySelectorAll('*')].filter(e=>/OSNUTEK|POSLANO|POTRJENO|DOBLJENO/.test(e.textContent)&&e.children.length===0).length; return JSON.stringify({narocilnicaGumbi:n,oznaciGumbi:poslani,statusZetonov:kartice,err:window.__err??null});})()" 2>&1 | tail -1
echo "--- E) sejni chunk scan za R206 needleje ---"
agent-browser eval "(async()=>{const u=window.performance.getEntriesByType('resource').map(e=>e.name).filter(n=>n.includes('/_next/static/chunks/')&&n.endsWith('.js')); const iz={}; const needli=['Označi kot poslano','Označeno kot poslano (status POSLANO)','Kopiraj naročilnico naročila pri','Naročilnice ni mogoče sestaviti iz tega naročila','Aplikacija ne pošilja dokumentov']; for(const url of u){try{const t=await (await fetch(url)).text(); for(const n of needli){if(t.includes(n)) iz[n]=(iz[n]||0)+1;}}catch(e){}} return JSON.stringify({chunkov:u.length,zadetki:iz,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser close --all > /dev/null 2>&1 || true
echo "R207 R206-FP SCAN v2 KONEC"
