#!/bin/bash
# R184 dopolnilo produkcija probe — R183 pečati na produkciji z IZBRANIM projektom
# (MONTER spot; brez projekta NI fetcha = fail-closed, zato je pečat bil null).
set -u
PROD="https://roksal-railing-manager.vercel.app"

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 8

for i in 1 2 3; do
  agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
  sleep 4
  DOMOV=$(agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Domov'); return !!t;})()" 2>&1 | tail -1)
  [ "$DOMOV" = "true" ] && echo "VizTab izhod OK (poskus $i)" && break
done

echo "-- izberi prvi projekt (roksal:select-project) --"
agent-browser eval "fetch('/api/projects').then(r=>r.json()).then(j=>{const arr=Array.isArray(j)?j:(j.projects||[]); if(!arr.length) return JSON.stringify({projektov:0}); window.dispatchEvent(new CustomEvent('roksal:select-project',{detail:arr[0].id})); return JSON.stringify({projektov:arr.length, izbran:arr[0].id, ime:(arr[0].ime||arr[0].name||'').slice(0,30)});})()" 2>&1 | tail -1
sleep 5

VECPOMOC='(()=>{const v=[...document.querySelectorAll("button")].find(x=>x.textContent.trim()==="Več"||(x.getAttribute("aria-label")||"")==="Več"); if(v) v.click(); return !!v;})()'

echo "-- Slike: pečat FOTKE z izbranim projektom (R183 a) + fokus --"
agent-browser eval "$VECPOMOC" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'')==='Slike'||b.textContent.trim()==='Slike'); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const glava=[...document.querySelectorAll('h3,h4,div')].some(e=>e.textContent.trim()==='Slikanje projekta'); const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({glavaSlikanje: glava, pecatFotke: p?p.textContent.trim():null});})()" 2>&1 | tail -1
agent-browser eval "window.dispatchEvent(new Event('focus')); 'fokus'" > /dev/null 2>&1
sleep 6
agent-browser eval "(()=>{const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({pecatFotkePoFokusu: p?p.textContent.trim():null});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r184-prod-fotke.png > /dev/null 2>&1 && echo "screenshot PROD FOTKE OK"

echo "-- Meritve: pečat MERITVE z izbranim projektom (R183 b) --"
agent-browser eval "$VECPOMOC" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'')==='Meritve'||b.textContent.trim()==='Meritve'); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const h2=[...document.querySelectorAll('h2')].find(e=>e.textContent.trim()==='Meritve'); const p=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({h2Meritve: !!h2, pecatMeritve: p?p.textContent.trim():null});})()" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1 || true
echo "R184 DOPOLNILO PROD PROBE KONEC"
