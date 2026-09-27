#!/bin/bash
# R194 produkcija QA — MONTER spot regresije + R193 fingerprint ŽIVO:
#   (a) /login noga 'Zgrajeno' (R189 F2 regresija)
#   (b) MONTER prijava → app
#   (c) ?tab=photos → 'Zasebnost: EXIF/GPS metapodatki …' ShieldCheck vrstica (R193 F2) ŽIVO
#   (d) Meritve: CSV gumb (R186 F2) + pečat
#   (e) Material (R182) / Zaloga (R177) pečata + banner skrit
#   (f) VizTab offline pas (R188, startsWith lookup)
#   (g) temna tema + __err null
set -u
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

echo "--- 1) JAVNO: /login noga 'Zgrajeno …' (R189 F2) ---"
agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const n=[...document.querySelectorAll('p,span,div,small')].map(e=>e.textContent.trim()).find(t=>t.startsWith('Zgrajeno ')); const v=[...document.querySelectorAll('p,span,div,small')].map(e=>e.textContent.trim()).find(t=>t.startsWith('Verzija:')); return JSON.stringify({zgrajeno:n||null,verzija:v||null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r194-login-noga.png" > /dev/null 2>&1 && echo "screenshot LOGIN NOGA OK"

echo "--- 2) MONTER prijava (spot konto) ---"
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12
agent-browser eval "(()=>{return JSON.stringify({url:location.pathname, h1:(document.querySelector('h1')||{}).textContent||null, err:window.__err??null});})()" 2>&1 | tail -1

echo "--- 3) R193 FINGERPRINT ŽIVO: ?tab=photos → EXIF politika vrstica ---"
agent-browser open "$PROD/?tab=photos" > /dev/null 2>&1
sleep 10
agent-browser eval "(()=>{const v=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.trim().startsWith('Zasebnost: EXIF/GPS metapodatki se pri nalaganju samodejno odstranijo')).length; const slika=!!document.querySelector('button[disabled]'); return JSON.stringify({exifPolitikaVrstic:v, url:location.search, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r194-exif-politika.png" > /dev/null 2>&1 && echo "screenshot EXIF POLITIKA OK"

echo "--- 4) Meritve: CSV gumb (R186 F2) + pečat ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Meritve')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 8
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Izvozi vidne meritve kot CSV'); const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({csvGumb:!!g, pecat:p?p.textContent.trim():null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r194-meritve.png" > /dev/null 2>&1 && echo "screenshot MERITVE OK"

echo "--- 5) Regresije: Material (R182) + Zaloga (R177) pečata + banner ---"
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

echo "--- 6) VizTab offline pas (R188, startsWith) ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 6
agent-browser eval "window.dispatchEvent(new Event('offline')); 'offline poslan'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const pas=[...document.querySelectorAll('[role=status]')].filter(e=>e.textContent.includes('Ni povezave')).length; const vDokumentuN=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.trim().startsWith('Ni povezave — aplikacija deluje naprej')).length; return JSON.stringify({pasViden:pas>0, vDokumentuN});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r194-offline.png" > /dev/null 2>&1 && echo "screenshot OFFLINE OK"
agent-browser eval "window.dispatchEvent(new Event('online')); 'online poslan'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const pas=[...document.querySelectorAll('[role=status]')].filter(e=>e.textContent.includes('Ni povezave')).length; return JSON.stringify({pasPoOnline:pas});})()" 2>&1 | tail -1

echo "--- 7) temna tema + __err ---"
agent-browser eval "document.documentElement.classList.add('dark'); JSON.stringify({bg:getComputedStyle(document.body).backgroundColor, err:window.__err??null})" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r194-temna.png" > /dev/null 2>&1 && echo "screenshot TEMNA OK"

agent-browser close --all > /dev/null 2>&1 || true
echo "R194 PROD PROBE KONEC"
