#!/bin/bash
# R168 produkcija QA: spot-r165@roksal.si (MONTER, precedens R127).
# Ključno vprašanje: je R166+R167 ŽIVO (deploy sprožen s R167 push ~10:21 UTC)?
# Fingerprinti: R166 kartica 'Termini — naslednjih 7 dni' + 'Osveži termine';
# R167 'Samo moje termine' (aria-pressed) + 'Kopiraj podrobnosti termina: …';
# starejši: body rgb(15,23,36), bg-card rgb(26,39,68), Logistika V6, konzola.
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
sleep 8
agent-browser eval "JSON.stringify({url: location.pathname, err: window.__err || null})" 2>&1 | tail -1

echo "--- QA 1: R166+R167 fingerprint — kartica TERMINI + filter + kopiraj (dashboard) ---"
agent-browser eval "(()=>{const txt=document.body.innerText; const kartica=txt.includes('Termini — naslednjih 7 dni'); const osvezi=!!document.querySelector('button[aria-label=\"Osveži termine\"]'); const toggle=[...document.querySelectorAll('button')].find(b=>/Samo moje termine/.test(b.getAttribute('aria-label')||b.textContent||'')); const kopiraj=[...document.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')||'').filter(a=>a.startsWith('Kopiraj podrobnosti termina')); const alerts=[...document.querySelectorAll('[role=\"alert\"]')].map(a=>a.textContent.slice(0,80)); return JSON.stringify({kartica, osvezi, toggle: toggle?{viden: !!toggle.offsetParent, pressed: toggle.getAttribute('aria-pressed')}:null, kopirajGumbi: kopiraj.length, kopirajPrvi: kopiraj[0]||null, errorPanels: alerts});})()" 2>&1 | tail -1

echo "--- QA 2: stikalo klik — aria-pressed false→true, filtriran pogled ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>/Samo moje termine/.test(b.getAttribute('aria-label')||b.textContent||'')); if(!t) return JSON.stringify({napaka:'stikalo ni najdeno'}); const before=t.getAttribute('aria-pressed'); t.click(); return JSON.stringify({before, klik:'poslan'});})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>/Samo moje termine/.test(b.getAttribute('aria-label')||b.textContent||'')); const txt=document.body.innerText; return JSON.stringify({after: t?t.getAttribute('aria-pressed'):null, praznoStanje: txt.includes('Ni vaših terminov')});})()" 2>&1 | tail -1

echo "--- QA 3: temna tema (starejši fingerprinti) ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('temo')); if(b) b.click(); return b?b.getAttribute('aria-label'):null;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const body=getComputedStyle(document.body).backgroundColor; const cards=[...document.querySelectorAll('.bg-card,[class*=\"rounded\"]')].slice(0,12).map(e=>getComputedStyle(e).backgroundColor).filter(c=>c&&c!=='rgba(0, 0, 0, 0)'); return JSON.stringify({bodyBg: body, cardSamples: [...new Set(cards)].slice(0,4)});})()" 2>&1 | tail -1

echo "--- QA 4: Logistika V6 zdravje ---"
agent-browser eval "(()=>{const v=document.querySelector('button[aria-label=\\'Več\\']'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,[role=\"link\"],a,div')].find(x=>x.textContent&&x.textContent.trim().startsWith('Logistika V6')&&x.closest('[data-slot=\"sheet-content\"],[role=\"dialog\"]')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const alerts=[...document.querySelectorAll('[role=\"alert\"]')].map(a=>a.textContent.slice(0,80)); const subtabs=[...document.querySelectorAll('button')].filter(b=>/Koledar|Ekip|Oprem/.test(b.textContent||'')).map(b=>b.textContent.trim().slice(0,16)); return JSON.stringify({errorPanels: alerts, subtabs});})()" 2>&1 | tail -1

echo "--- QA 5: konzola + screenshot ---"
agent-browser eval "JSON.stringify({err: window.__err || null})" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r168-prod.png > /dev/null 2>&1 && echo "screenshot OK"
agent-browser close --all > /dev/null 2>&1 || true
echo "R168 QA KONEC"
