#!/bin/bash
# R190 produkcija QA — javni /login noga 'Zgrajeno' (R189 F2) + MONTER spot regresije
set -u
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

echo "--- 1) JAVNO: /login noga 'Zgrajeno DD.MM.YYYY ob HH:MM:SS (Europe/Ljubljana)' (R189 F2, brez seje) ---"
agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const n=[...document.querySelectorAll('p,span,div,small')].map(e=>e.textContent.trim()).find(t=>t.startsWith('Zgrajeno ')); const v=[...document.querySelectorAll('p,span,div,small')].map(e=>e.textContent.trim()).find(t=>t.startsWith('Verzija:')); return JSON.stringify({zgrajeno:n||null,verzija:v||null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r190-login-noga.png" > /dev/null 2>&1 && echo "screenshot LOGIN NOGA OK"

echo "--- 2) MONTER prijava (spot konto) ---"
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12
agent-browser eval "(()=>{return JSON.stringify({url:location.pathname, h1:(document.querySelector('h1')||{}).textContent||null, err:window.__err??null});})()" 2>&1 | tail -1

echo "--- 3) Meritve: CSV gumb (R186 F2 regresija) + pečat ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Meritve')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 8
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Izvozi vidne meritve kot CSV'); const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({csvGumb:!!g, pecat:p?p.textContent.trim():null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r190-meritve-csv.png" > /dev/null 2>&1 && echo "screenshot MERITVE OK"

echo "--- 4) Regresije: Material (R182) + Zaloga (R177) pečata ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Material V5')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({materialPecat:p?p.textContent.trim():null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('zaloga')||b.textContent.trim().includes('Zaloga')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); const b=[...document.querySelectorAll('div')].find(e=>e.textContent.trim()==='Na voljo je nova verzija aplikacije.'); return JSON.stringify({zalogaPecat:p?p.textContent.trim():null, bannerViden:!!b});})()" 2>&1 | tail -1

echo "--- 5) VizTab offline pas (R188 P2): 'Ni povezave' v lupini, ENKRAT v dokumentu ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 6
agent-browser eval "window.dispatchEvent(new Event('offline')); 'offline poslan'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const pas=[...document.querySelectorAll('div')].filter(e=>e.textContent.trim()==='Ni povezave').length; const vDokumentuN=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.trim()==='Ni povezave').length; return JSON.stringify({pasViden:pas>0, vDokumentuN});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r190-viztab-offline.png" > /dev/null 2>&1 && echo "screenshot OFFLINE OK"
agent-browser eval "window.dispatchEvent(new Event('online')); 'online poslan'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const pas=[...document.querySelectorAll('div')].filter(e=>e.textContent.trim()==='Ni povezave').length; return JSON.stringify({pasPoOnline:pas});})()" 2>&1 | tail -1

echo "--- 6) temna tema + __err ---"
agent-browser eval "document.documentElement.classList.add('dark'); JSON.stringify({bg:getComputedStyle(document.body).backgroundColor, err:window.__err??null})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r190-temna.png" > /dev/null 2>&1 && echo "screenshot TEMNA OK"

agent-browser close --all > /dev/null 2>&1 || true
echo "R190 PROD PROBE KONEC"
