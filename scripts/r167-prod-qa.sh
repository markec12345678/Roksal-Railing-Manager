#!/bin/bash
# R167 produkcija QA: spot-r165@roksal.si (MONTER, precedens R127).
# Preveri: R166 fingerprint (Termini — naslednjih 7 dni kartica + 'Osveži termine'),
# R165 fingerprinti (statusni dropdown per vloga), R162 temni fingerprinti,
# Logistika V6 zdravje, konzola čista.
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT="/home/z/my-project/screenshots"
mkdir -p "$OUT"

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

echo "--- QA 1: R166 FINGERPRINT — kartica 'Termini — naslednjih 7 dni' ---"
agent-browser eval "(()=>{const cards=[...document.querySelectorAll('h2,h3,[class*=title]')].map(h=>h.textContent.trim()).filter(t=>/Termini/.test(t)); const osvezi=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').includes('Osveži termine')).map(b=>b.getAttribute('aria-label')); const alerts=[...document.querySelectorAll('[role=\"alert\"]')].map(a=>a.textContent.slice(0,80)); return JSON.stringify({terminiNaslovi: cards, osveziGumb: osvezi, errorPanels: alerts});})()" 2>&1 | tail -1

echo "--- QA 2: temna tema (R162 fingerprint) ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('temo')); if(b) b.click(); return b?b.getAttribute('aria-label'):null;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "JSON.stringify({bodyBg: getComputedStyle(document.body).backgroundColor})" 2>&1 | tail -1

echo "--- QA 3: R165 fingerprint — statusni dropdown (če projekt viden MONTERju) ---"
agent-browser eval "(()=>{const sel=[...document.querySelectorAll('[role=\"combobox\"],button[aria-haspopup=\"listbox\"]')].map(s=>(s.getAttribute('aria-label')||s.textContent).trim().slice(0,40)); return JSON.stringify({statusDropdowni: sel.slice(0,4)});})()" 2>&1 | tail -1

echo "--- QA 4: Več → Logistika V6 zdravje ---"
agent-browser eval "(()=>{const v=document.querySelector('button[aria-label=\\'Več\\']'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,[role=\"link\"],a,div')].find(x=>x.textContent&&x.textContent.trim().startsWith('Logistika V6')&&x.closest('[data-slot=\"sheet-content\"],[role=\"dialog\"]')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const alerts=[...document.querySelectorAll('[role=\"alert\"]')].map(a=>a.textContent.slice(0,80)); const subtabs=[...document.querySelectorAll('button')].filter(b=>/Koledar|Ekip|Oprem/.test(b.textContent||'')).map(b=>b.textContent.trim().slice(0,16)); return JSON.stringify({errorPanels: alerts, subtabs: subtabs});})()" 2>&1 | tail -1

echo "--- QA 5: konzola + screenshot ---"
agent-browser eval "JSON.stringify({err: window.__err || null})" 2>&1 | tail -1
agent-browser screenshot "$OUT/qa-r167-prod-r166-live.png" > /dev/null 2>&1 && echo "screenshot OK"
agent-browser close --all > /dev/null 2>&1 || true
echo "R167 QA KONEC"
