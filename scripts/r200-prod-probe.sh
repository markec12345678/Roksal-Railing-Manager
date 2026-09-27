#!/bin/bash
# R200 produkcija QA — R199 fingerprinti ŽIVO + R190 zaprtje preostalih 2 lažno-negativnih
#  (a) zvonček 'Označi vse kot prebrano (N)' gumb ŽIVO (R199 fp b)
#  (b) geslo dialog živa lestvica Šibko/Sprejemljivo/Močno brez pošiljanja (R199 fp c/d)
#  (c) Meritve pečat + offline pas z PRAVILNIM lookupom (R190 lažno-negativni zaprti)
#  Spot geslo se NE menja — dialog samo odpri, preberi, Prekliči.
set -u
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

echo "--- 1) JAVNO: /login noga žig (R189 F2 regresija) ---"
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

echo "--- 3) ZVONČEK: 'Označi vse kot prebrano (N)' ŽIVO (R199 fingerprint) ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(b) b.click(); return JSON.stringify({najden:!!b,oznaka:b?(b.getAttribute('aria-label')||''):null});})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const poslana=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.trim().startsWith('Poslana obvestila')).length; const gumb=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Označi vse kot prebrano')); const sciti=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&/Nova prijava|neuspešn|aktiviran|geslo je bilo spremenjeno/.test(e.textContent.trim())&&e.textContent.trim().length<90).length; return JSON.stringify({poslanaVrstica:poslana,oznaciVseGumb:!!gumb,oznaciVseOznaka:gumb?(gumb.getAttribute('aria-label')||''):null,scitVrstic:sciti,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r200-zvoncek-oznaci-vse.png" > /dev/null 2>&1 && echo "screenshot ZVONCEK OK"
echo "--- 3b) klik 'Označi vse' → vrstice Odprto, gumb izgine ---"
agent-browser eval "(()=>{const gumb=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Označi vse kot prebrano')); if(gumb) gumb.click(); return !!gumb;})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const gumb=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Označi vse kot prebrano')); const odprto=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.trim()==='Odprto').length; return JSON.stringify({gumbPoKliku:!!gumb,odprtihVrstic:odprto});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r200-oznaceno-vse.png" > /dev/null 2>&1 && echo "screenshot OZNACENO OK"
agent-browser eval "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); 'esc'" > /dev/null 2>&1
sleep 1

echo "--- 4) Meritve: CSV gumb + PEČAT (R190 lažno-negativen zaprt) ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Meritve')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 8
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Izvozi vidne meritve kot CSV'); const p=[...document.querySelectorAll('span')].filter(e=>e.textContent.trim().startsWith('Osveženo ob')).map(e=>e.textContent.trim()); const f=[...document.querySelectorAll('[role=alert]')].map(e=>e.textContent.trim().slice(0,80)); return JSON.stringify({csvGumb:!!g,pecat:p[0]||null,fail:f});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r200-meritve-csv.png" > /dev/null 2>&1 && echo "screenshot MERITVE OK"

echo "--- 5) Material + Zaloga pečati (regresija) ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Material V5')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].filter(e=>e.textContent.trim().startsWith('Osveženo ob')).map(e=>e.textContent.trim()); return JSON.stringify({materialPecat:p[0]||null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('zaloga')||b.textContent.trim().includes('Zaloga')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].filter(e=>e.textContent.trim().startsWith('Osveženo ob')).map(e=>e.textContent.trim()); const b=[...document.querySelectorAll('div')].find(e=>e.textContent.trim()==='Na voljo je nova verzija aplikacije.'); return JSON.stringify({zalogaPecat:p[0]||null,bannerViden:!!b});})()" 2>&1 | tail -1

echo "--- 6) VizTab offline pas — PRAVILNI lookup (R190 lažno-negativen zaprt) ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 6
agent-browser eval "window.dispatchEvent(new Event('offline')); 'offline poslan'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const pas=[...document.querySelectorAll('[role=status]')].filter(e=>e.textContent.includes('Ni povezave')).length; const vDokumentuN=[...document.querySelectorAll('*')].filter(e=>e.textContent.startsWith('Ni povezave — aplikacija deluje naprej')&&e.childElementCount===0).length; return JSON.stringify({pasViden:pas>0,vDokumentuN});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r200-viztab-offline.png" > /dev/null 2>&1 && echo "screenshot OFFLINE OK"
agent-browser eval "window.dispatchEvent(new Event('online')); 'online poslan'" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const n=[...document.querySelectorAll('*')].filter(e=>e.textContent.startsWith('Ni povezave — aplikacija deluje naprej')&&e.childElementCount===0).length; return JSON.stringify({pasPoOnline:n});})()" 2>&1 | tail -1

echo "--- 7) GESLO DIALOG ŽIVA LESTVICA (R199 F2 fingerprint) — brez pošiljanja ---"
agent-browser click 'button[aria-label="Odjava"]' > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const mi=[...document.querySelectorAll('[role=menuitem]')].find(x=>x.textContent.trim()==='Zamenjaj geslo'); if(mi) mi.click(); return !!mi;})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const d=document.querySelector('#pwd-next'); return JSON.stringify({dialogOdpri:!!d,title:(document.querySelectorAll('[role=dialog] h2,[role=dialog] .font-semibold, [role=dialog] h1,h2')?[...document.querySelectorAll('[role=dialog] h2')].map(e=>e.textContent.trim()).find(t=>t.includes('Zamenjaj')):null)||null,okvir:[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.startsWith('Vse naprave bodo odjavljene')).length>0});})()" 2>&1 | tail -1
echo "--- 7b) kratko (<8) → lestvica SKRITA ---"
agent-browser eval "(()=>{const el=document.querySelector('#pwd-next'); if(!el) return 'ni inputa'; const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(el,'kratko'); el.dispatchEvent(new Event('input',{bubbles:true})); return 'vneseno';})()" > /dev/null 2>&1
sleep 1
agent-browser eval "(()=>{const live=document.querySelector('[role=dialog] [aria-live=polite]'); return JSON.stringify({lestvicaVidna:!!live,oznaka:live?live.textContent.trim():null});})()" 2>&1 | tail -1
echo "--- 7c) šibko (1 razred) → 'Šibko' + rdeča ---"
agent-browser eval "(()=>{const el=document.querySelector('#pwd-next'); const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(el,'slabogeslo'); el.dispatchEvent(new Event('input',{bubbles:true})); return 'vneseno';})()" > /dev/null 2>&1
sleep 1
agent-browser eval "(()=>{const live=document.querySelector('[role=dialog] [aria-live=polite]'); const seg=live?live.querySelectorAll('span span, span > span').length:null; const barva=live?getComputedStyle(live.querySelector('span:last-child')).color:null; return JSON.stringify({oznaka:live?live.textContent.trim():null,segmenti:seg,barvaOznake:barva});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r200-geslo-sibko.png" > /dev/null 2>&1 && echo "screenshot SIBKO OK"
echo "--- 7d) močno (3 razredi + ≥14) → 'Močno' + zelena ---"
agent-browser eval "(()=>{const el=document.querySelector('#pwd-next'); const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(el,'MocnoGesloZaQA2026'); el.dispatchEvent(new Event('input',{bubbles:true})); return 'vneseno';})()" > /dev/null 2>&1
sleep 1
agent-browser eval "(()=>{const live=document.querySelector('[role=dialog] [aria-live=polite]'); const barva=live?getComputedStyle(live.querySelector('span:last-child')).color:null; return JSON.stringify({oznaka:live?live.textContent.trim():null,barvaOznake:barva});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r200-geslo-mocno.png" > /dev/null 2>&1 && echo "screenshot MOCNO OK"
echo "--- 7e) Prekliči → zapri (spot geslo NE ostane spremenjeno) ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[role=dialog] button')].find(x=>x.textContent.trim()==='Prekliči'); if(b) b.click(); return !!b;})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{return JSON.stringify({dialogZaprt:!document.querySelector('#pwd-next'),url:location.pathname,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- 8) temna tema ---"
agent-browser eval "document.documentElement.classList.add('dark'); JSON.stringify({bg:getComputedStyle(document.body).backgroundColor,err:window.__err??null})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r200-temna.png" > /dev/null 2>&1 && echo "screenshot TEMNA OK"

agent-browser close --all > /dev/null 2>&1 || true
echo "R200 PROD PROBE KONEC"
