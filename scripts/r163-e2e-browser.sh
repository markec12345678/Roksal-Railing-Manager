#!/bin/bash
# R163 E2E (lokalni build): izvoz dnevnega pregleda vodje CSV + fail-verbose
# panela (vodja-dashboard/logistics nista več lažno prazni) + dark stil pass.
# Naučki R157–R162: celoten tok v ENEM klicu; pred zagonom pkill + ss preverba;
# po prijavi prehod na "Montažna orodja"; ci@roksal.si je dev-only ADMIN.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r163-e2e-server.log 2>&1 < /dev/null &
sleep 4

HEALTH=$(curl -s -m 5 http://127.0.0.1:3100/api/auth/demo || true)
echo "health=$HEALTH"

agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 4

echo "--- E2E 0: prehod na Montažna orodja ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>/Montažna orodja/.test(b.textContent||'')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 4

echo "--- E2E 1: temna tema (R162 fingerprint v okolju) ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('temo')); if(b) b.click(); return b?b.getAttribute('aria-label'):null;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "JSON.stringify({bodyBg: getComputedStyle(document.body).backgroundColor, dark: document.documentElement.className.includes('dark')})" 2>&1 | tail -1

echo "--- E2E 2: Več → Pregled za vodjo tab ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Več'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,[role=\"link\"],a,div')].find(x=>x.textContent&&x.textContent.trim().startsWith('Pregled za vodjo')&&x.closest('[data-slot=\"sheet-content\"], [role=\"dialog\"]')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 4

echo "--- E2E 3: vodja pregled — naslov, izvoz gumb, NI error panela ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('h2')].find(x=>x.textContent==='Pregled za vodjo'); const btn=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-label')==='Izvozi dnevni pregled vodje kot CSV'); const alert=[...document.querySelectorAll('[role=\"alert\"]')].map(a=>a.textContent.slice(0,80)); return JSON.stringify({header: !!h, btnFound: !!btn, btnAria: btn?btn.getAttribute('aria-label'):null, btnTitle: !!btn?.getAttribute('title'), btnRing: /focus-visible:ring/.test(btn?.className||''), pdfBtn: !![...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-label')==='Prenesi mesečno PDF poročilo'), errorPanels: alert, kpiCards: document.querySelectorAll('.tabular-nums').length});})()" 2>&1 | tail -1

echo "--- E2E 4: klik izvoza → toast ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-label')==='Izvozi dnevni pregled vodje kot CSV'); if(b && !b.disabled) b.click(); return JSON.stringify({clicked: !!b, wasDisabled: b?.disabled});})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const toast=document.querySelector('[data-sonner-toast]'); return JSON.stringify({toastText: toast?toast.textContent.slice(0,110):null});})()" 2>&1 | tail -1

echo "--- E2E 5: Več → Logistika V6 (fail-verbose tab deluje) ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Več'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,[role=\"link\"],a,div')].find(x=>x.textContent&&x.textContent.trim().startsWith('Logistika V6')&&x.closest('[data-slot=\"sheet-content\"], [role=\"dialog\"]')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const alert=[...document.querySelectorAll('[role=\"alert\"]')].map(a=>a.textContent.slice(0,80)); const koledar=[...document.querySelectorAll('button')].find(x=>x.textContent&&x.textContent.includes('Koledar')); return JSON.stringify({errorPanels: alert, subtabs: !!koledar});})()" 2>&1 | tail -1

echo "--- E2E 6: konzola čista ---"
agent-browser eval "JSON.stringify({err: window.__err || null})" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
if ss -tln 2>/dev/null | grep -q ':3100'; then echo "WARNING: port 3100 busy"; else echo "port 3100 free"; fi
