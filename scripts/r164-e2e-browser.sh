#!/bin/bash
# R164 E2E (lokalni build): izvoz seznama projektov v CSV + stil pass
# (dark: NACRTOVANO značka, brez bg-white, fokus ringi na ikonskih gumbih).
# Naučki R157–R163: celoten tok v ENEM klicu; pred zagonom pkill + ss;
# po prijavi prehod na "Montažna orodja"; ci@roksal.si je dev-only ADMIN.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r164-e2e-server.log 2>&1 < /dev/null &
sleep 4

agent-browser close --all > /dev/null 2>&1 || true
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 5

echo "--- E2E 0: prehod na Montažna orodja ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 4

echo "--- E2E 1: Projekti kartica — izvoz gumb živ ---"
agent-browser eval "(()=>{const btns=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi prikazane projekte v CSV')).map(b=>({aria: b.getAttribute('aria-label'), title: !!b.getAttribute('title'), ring: /focus-visible:ring/.test(b.className), disabled: b.disabled})); return JSON.stringify(btns);})()" 2>&1 | tail -1

echo "--- E2E 2: temna tema + NACRTOVANO značka dark varianta ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('temo')); if(b) b.click(); return b?b.getAttribute('aria-label'):null;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const badge=[...document.querySelectorAll('.cursor-pointer')].find(x=>/bg-blue-100/.test(x.className)&&/dark:bg-blue-950/.test(x.className)); return JSON.stringify({bodyBg: getComputedStyle(document.body).backgroundColor, nacrtovanoDark: !!badge, bgWhiteCount: [...document.querySelectorAll('[class*=bg-white]')].length});})()" 2>&1 | tail -1

echo "--- E2E 3: klik izvoza (toast) ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Izvozi prikazane projekte v CSV')); if(b && !b.disabled) b.click(); return JSON.stringify({clicked: !!b, wasDisabled: b?.disabled});})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const toast=document.querySelector('[data-sonner-toast]'); return JSON.stringify({toast: toast?toast.textContent.slice(0,90):null});})()" 2>&1 | tail -1

echo "--- E2E 4: filter V_TEKU → aria-label se spremeni (IZVOŽENO=ZASLON) ---"
agent-browser eval "(()=>{const f=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='V teku'); if(f) f.click(); return !!f;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Izvozi prikazane projekte v CSV')); return b?b.getAttribute('aria-label'):null;})()" 2>&1 | tail -1

echo "--- E2E 5: ikonski gumbi focus ringi + konzola ---"
agent-browser eval "(()=>{const telo=[...document.querySelectorAll('button[aria-label=\"Pokliči stranko\"]')].map(b=>/focus-visible:ring/.test(b.className)); const err=window.__err||null; return JSON.stringify({pokliciRing: telo, err});})()" 2>&1 | tail -1

agent-browser screenshot /home/z/my-project/screenshots/qa-r164-local-dark-projects.png > /dev/null 2>&1 && echo "screenshot OK"
agent-browser close --all > /dev/null 2>&1 || true

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
echo "E2E KONEC (port 3100 sproščen)"
