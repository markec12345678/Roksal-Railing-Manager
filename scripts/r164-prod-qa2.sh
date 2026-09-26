#!/bin/bash
# R164 produkcija QA dopolnilo: zapri onboarding ("Zapri uvodni vodič"),
# potem Več → CRM izvozi gumbi + Logistika V6 zdravje.
set -u
PROD="https://roksal-railing-manager.vercel.app"

agent-browser close --all > /dev/null 2>&1 || true
sleep 1

agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r164@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR164Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 6

echo "--- QA A: onboarding prisoten + zapri ---"
agent-browser eval "(()=>{const x=document.querySelector('[aria-label=\"Zapri uvodni vodič\"]'); const was=x?!!x:false; if(x) x.click(); return JSON.stringify({onboardingBil: was, zaprjen: was});})()" 2>&1 | tail -1
sleep 2

echo "--- QA B: dashboard živ ---"
agent-browser eval "(()=>{const body=document.body.textContent||''; return JSON.stringify({vreme: /°/.test(body), artikli: /artikel|skladishch|Skladishche|Skladishche|zalog/i.test(body)||/Artikl/i.test(body)});})()" 2>&1 | tail -1

echo "--- QA C: Več sheet + CRM ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Več'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,[role=\"link\"],a,div')].find(x=>x.textContent&&x.textContent.trim().startsWith('CRM stranke')&&x.closest('[data-slot=\"sheet-content\"],[role=\"dialog\"]')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const btns=[...document.querySelectorAll('button')].filter(b=>/Izvozi/.test(b.getAttribute('aria-label')||b.textContent||'')).map(b=>(b.getAttribute('aria-label')||b.textContent).trim().slice(0,75)); const alerts=[...document.querySelectorAll('[role=\"alert\"]')].map(a=>a.textContent.slice(0,60)); return JSON.stringify({izvozniGumbi: btns, errorPanels: alerts});})()" 2>&1 | tail -1

echo "--- QA D: Logistika V6 zdravje ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Več'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,[role=\"link\"],a,div')].find(x=>x.textContent&&x.textContent.trim().startsWith('Logistika V6')&&x.closest('[data-slot=\"sheet-content\"],[role=\"dialog\"]')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const alerts=[...document.querySelectorAll('[role=\"alert\"]')].map(a=>a.textContent.slice(0,80)); const subtabs=[...document.querySelectorAll('button')].filter(b=>/Koledar|Ekip|Oprem/.test(b.textContent||'')).map(b=>b.textContent.trim().slice(0,20)); return JSON.stringify({errorPanels: alerts, subtabs: subtabs});})()" 2>&1 | tail -1

echo "--- QA E: konzola + screenshot ---"
agent-browser eval "JSON.stringify({err: window.__err || null})" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r164-prod-dark-logistics.png > /dev/null 2>&1 && echo "screenshot OK"
agent-browser close --all > /dev/null 2>&1 || true
echo "DOPOLNILO KONEC"
