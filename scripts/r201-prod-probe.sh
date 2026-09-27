#!/bin/bash
# R201 produkcija QA — R200 fingerprinti ŽIVO (žig 02:40:02.517Z)
#  (a) MONTER NEGATIVNI: FAILED_LOGINS_OVERVIEW vrstica + chip 'Odpri Ekipa' NE nastaneta (ADMIN-only)
#  (b) Meritve 0-projektov bazna slika (spot realnost) — vhod za F1 iskren prazni stolpec
#  (c) Ekipa 403 meja (MONTER) + regresije: zvonček, CSV, offline pas, temna, __err null
set -u
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

echo "--- 1) JAVNO: /login noga žig (pričakuj build 02:40) ---"
agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const n=[...document.querySelectorAll('p,span,div,small')].map(e=>e.textContent.trim()).find(t=>t.startsWith('Zgrajeno ')); const v=[...document.querySelectorAll('p,span,div,small')].map(e=>e.textContent.trim()).find(t=>t.startsWith('Verzija:')); return JSON.stringify({zgrajeno:n||null,verzija:v||null,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- 2) MONTER prijava (spot) ---"
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12
agent-browser eval "(()=>{return JSON.stringify({url:location.pathname,h1:(document.querySelector('h1')||{}).textContent||null,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- 3) R200 NEGATIVNI fp: pregled neuspešnih + 'Odpri Ekipa' NE nastaneta za MONTER ---"
agent-browser eval "(()=>{const pregled=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.trim().startsWith('Pregled neuspešnih prijav')).length; const chip=[...document.querySelectorAll('button')].filter(x=>(x.getAttribute('aria-label')||'').includes('Odpri Ekipa')||x.textContent.trim()==='Odpri Ekipa').length; const zvon=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); return JSON.stringify({pregledVrstic:pregled,odpriEkipaChipov:chip,zvoncekOznaka:zvon?(zvon.getAttribute('aria-label')||''):null,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- 4) zvonček regresija (ščit vrstice vidne) ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(b) b.click(); return !!b;})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const sciti=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&/Nova prijava|neuspešn|aktiviran|geslo je bilo spremenjeno/.test(e.textContent.trim())&&e.textContent.trim().length<90).length; const chip=[...document.querySelectorAll('button')].filter(x=>x.textContent.trim()==='Odpri Ekipa').length; return JSON.stringify({scitVrstic:sciti,odpriEkipaVZvoncu:chip});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r201-zvoncek.png" > /dev/null 2>&1 && echo "screenshot ZVONCEK OK"
agent-browser eval "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); 'esc'" > /dev/null 2>&1
sleep 1

echo "--- 5) Meritve 0-projektov BAZNA SLIKA (vhod za F1) ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Meritve')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 8
agent-browser eval "(()=>{const izb=[...document.querySelectorAll('select')].map(s=>({id:s.id||null,razpolzuljive:[...s.options].map(o=>o.textContent.trim()).slice(0,6)})); const h=[...document.querySelectorAll('h1,h2,h3')].map(e=>e.textContent.trim()); const empty=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&/ni projektov|Ni projektov|ni podatkov|Ni podatkov|izberite|Izberite/.test(e.textContent.trim())&&e.textContent.trim().length<120).map(e=>e.textContent.trim()); const csvG=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Izvozi vidne meritve kot CSV'); const pecat=[...document.querySelectorAll('span')].filter(e=>e.textContent.trim().startsWith('Osveženo ob')).map(e=>e.textContent.trim()); const alerts=[...document.querySelectorAll('[role=alert]')].map(e=>e.textContent.trim().slice(0,80)); return JSON.stringify({naslovi:h.slice(0,6),izbirniki:izb.slice(0,3),praznaBesedila:empty.slice(0,8),csvGumb:!!csvG,pecat:pecat[0]||null,alerts});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r201-meritve-prazno.png" > /dev/null 2>&1 && echo "screenshot MERITVE PRAZNO OK"

echo "--- 6) Ekipa 403 meja (MONTER) ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Ekipa')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const f=[...document.querySelectorAll('[role=alert]')].map(e=>e.textContent.trim().slice(0,100)); const h=[...document.querySelectorAll('h1,h2')].map(e=>e.textContent.trim()).slice(0,4); return JSON.stringify({url:location.pathname,naslovi:h,alerts:f,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- 7) VizTab offline pas regresija ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 6
agent-browser eval "window.dispatchEvent(new Event('offline')); 'offline poslan'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const pas=[...document.querySelectorAll('[role=status]')].filter(e=>e.textContent.includes('Ni povezave')).length; return JSON.stringify({pasViden:pas>0});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r201-offline.png" > /dev/null 2>&1 && echo "screenshot OFFLINE OK"
agent-browser eval "window.dispatchEvent(new Event('online')); 'online poslan'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const n=[...document.querySelectorAll('*')].filter(e=>e.textContent.startsWith('Ni povezave — aplikacija deluje naprej')&&e.childElementCount===0).length; return JSON.stringify({pasPoOnline:n});})()" 2>&1 | tail -1

echo "--- 8) temna tema + odjava ---"
agent-browser eval "document.documentElement.classList.add('dark'); JSON.stringify({bg:getComputedStyle(document.body).backgroundColor,err:window.__err??null})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r201-temna.png" > /dev/null 2>&1 && echo "screenshot TEMNA OK"
agent-browser click 'button[aria-label="Odjava"]' > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{return JSON.stringify({url:location.pathname});})()" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1 || true
echo "R201 PROD PROBE KONEC"
