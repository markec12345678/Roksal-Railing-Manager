#!/bin/bash
# R164 produkcija QA: spot-r164@roksal.si (MONTER, precedens R127).
# Preveri: R162 temni fingerprinti še živi, CRM izvozni gumbi (R159/R161),
# Logistika V6 zdrava (ni error panelov), dashboard živ, konzola čista.
# Celoten tok v ENEM klicu (nauček R157+: session ne preživi bash klicev).
set -u
PROD="https://roksal-railing-manager.vercel.app"

agent-browser close --all > /dev/null 2>&1 || true
sleep 1

echo "--- QA 0: prijava spot-r164 ---"
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r164@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR164Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 5
agent-browser eval "JSON.stringify({url: location.pathname, err: window.__err || null})" 2>&1 | tail -1

echo "--- QA 1: dashboard živ (vreme/artikli/top-bar) ---"
agent-browser eval "(()=>{const body=document.body.textContent||''; return JSON.stringify({artikli: /artikel|Artikli/i.test(body), vreme: /°/.test(body), odjava: !!document.querySelector('[aria-haspopup=\\'menu\\']')});})()" 2>&1 | tail -1

echo "--- QA 2: temna tema (R162 fingerprint) ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('temo')); if(b) b.click(); return b?b.getAttribute('aria-label'):null;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "JSON.stringify({bodyBg: getComputedStyle(document.body).backgroundColor})" 2>&1 | tail -1

echo "--- QA 3: Več sheet odprem ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Več'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const tiles=[...document.querySelectorAll('button,[role=\"link\"],a,div')].filter(x=>x.textContent&&x.closest('[data-slot=\"sheet-content\"],[role=\"dialog\"]')).map(x=>x.textContent.trim().split('\\n')[0]).filter(t=>t&&t.length<40); return JSON.stringify({tiles: [...new Set(tiles)].slice(0,25)});})()" 2>&1 | tail -1

echo "--- QA 4: CRM tab (R159/R161/R162 izvozni gumbi živi) ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,[role=\"link\"],a,div')].find(x=>x.textContent&&x.textContent.trim().startsWith('CRM stranke')&&x.closest('[data-slot=\"sheet-content\"],[role=\"dialog\"]')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const btns=[...document.querySelectorAll('button')].filter(b=>/Izvozi/.test(b.getAttribute('aria-label')||b.textContent||'')).map(b=>(b.getAttribute('aria-label')||b.textContent).trim().slice(0,70)); const alerts=[...document.querySelectorAll('[role=\"alert\"]')].map(a=>a.textContent.slice(0,60)); return JSON.stringify({izvozniGumbi: btns, errorPanels: alerts});})()" 2>&1 | tail -1

echo "--- QA 5: Logistika V6 (MONTER vidnost + zdravje) ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Več'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,[role=\"link\"],a,div')].find(x=>x.textContent&&x.textContent.trim().startsWith('Logistika V6')&&x.closest('[data-slot=\"sheet-content\"],[role=\"dialog\"]')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const alerts=[...document.querySelectorAll('[role=\"alert\"]')].map(a=>a.textContent.slice(0,70)); const h2=[...document.querySelectorAll('h2')].map(x=>x.textContent).slice(0,4); const subtabs=[...document.querySelectorAll('button')].filter(b=>/Koledar|Ekip|Oprem/.test(b.textContent||'')).length; return JSON.stringify({errorPanels: alerts, h2: h2, subtabs: subtabs});})()" 2>&1 | tail -1

echo "--- QA 6: konzola čista + screenshot ---"
agent-browser eval "JSON.stringify({err: window.__err || null})" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r164-prod-dark.png > /dev/null 2>&1 && echo "screenshot OK"

echo "--- QA 7: odjava + session zapri ---"
agent-browser close --all > /dev/null 2>&1 || true
echo "QA KONEC"
