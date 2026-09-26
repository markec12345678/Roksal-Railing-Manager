#!/bin/bash
# R165 produkcija QA: spot-r165@roksal.si (MONTER, precedens R127).
# Preveri: R162 temni fingerprinti, CRM izvozi (R159/R161/R162), Logistika V6,
# Projekti kartica / R164 fingerprint (če MONTER vidi), konzola čista.
set -u
PROD="https://roksal-railing-manager.vercel.app"

agent-browser close --all > /dev/null 2>&1 || true
sleep 1

echo "--- QA 0: prijava spot-r165 ---"
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 6
agent-browser eval "JSON.stringify({url: location.pathname, err: window.__err || null})" 2>&1 | tail -1

echo "--- QA 0b: prehod na Montažna orodja (obvezni korak) ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return t?(t.getAttribute('aria-label')||'').slice(0,30):null;})()" 2>&1 | tail -1
sleep 5

echo "--- QA 1: temna tema (R162 fingerprint) ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('temo')); if(b) b.click(); return b?b.getAttribute('aria-label'):null;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "JSON.stringify({bodyBg: getComputedStyle(document.body).backgroundColor})" 2>&1 | tail -1

echo "--- QA 2: Projekti kartica + izvozi gumb (R164 fingerprint, če vidna MONTER) ---"
agent-browser eval "(()=>{const btns=[...document.querySelectorAll('button')].filter(b=>/Izvozi/.test(b.getAttribute('aria-label')||b.textContent||'')).map(b=>(b.getAttribute('aria-label')||b.textContent).trim().slice(0,80)); const alerts=[...document.querySelectorAll('[role=\"alert\"]')].map(a=>a.textContent.slice(0,60)); return JSON.stringify({izvozniGumbi: btns, errorPanels: alerts});})()" 2>&1 | tail -1

echo "--- QA 3: Več → CRM izvozni gumbi ---"
agent-browser eval "(()=>{const v=document.querySelector('button[aria-label=\\'Več\\']'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,[role=\"link\"],a,div')].find(x=>x.textContent&&x.textContent.trim().startsWith('CRM stranke')&&x.closest('[data-slot=\"sheet-content\"],[role=\"dialog\"]')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const btns=[...document.querySelectorAll('button')].filter(b=>/Izvozi/.test(b.getAttribute('aria-label')||b.textContent||'')).map(b=>(b.getAttribute('aria-label')||b.textContent).trim().slice(0,80)); const alerts=[...document.querySelectorAll('[role=\"alert\"]')].map(a=>a.textContent.slice(0,60)); return JSON.stringify({izvozniGumbi: btns, errorPanels: alerts});})()" 2>&1 | tail -1

echo "--- QA 4: Več → Logistika V6 zdravje ---"
agent-browser eval "(()=>{const v=document.querySelector('button[aria-label=\\'Več\\']'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,[role=\"link\"],a,div')].find(x=>x.textContent&&x.textContent.trim().startsWith('Logistika V6')&&x.closest('[data-slot=\"sheet-content\"],[role=\"dialog\"]')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const alerts=[...document.querySelectorAll('[role=\"alert\"]')].map(a=>a.textContent.slice(0,80)); const subtabs=[...document.querySelectorAll('button')].filter(b=>/Koledar|Ekip|Oprem/.test(b.textContent||'')).map(b=>b.textContent.trim().slice(0,16)); return JSON.stringify({errorPanels: alerts, subtabs: subtabs});})()" 2>&1 | tail -1

echo "--- QA 5: konzola + screenshot ---"
agent-browser eval "JSON.stringify({err: window.__err || null})" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r165-prod-dark.png > /dev/null 2>&1 && echo "screenshot OK"
agent-browser close --all > /dev/null 2>&1 || true
echo "R165 QA KONEC"
