#!/bin/bash
# R184 E2E dopolnilo — seje dialog (Radix meni rabi pointerdown!) + API dokaz v ENI vrstici.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r184-e2e-s1.log 2>&1 < /dev/null &
sleep 5

agent-browser close --all > /dev/null 2>&1 || true
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 6

for i in 1 2 3; do
  agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
  sleep 4
  DOMOV=$(agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Domov'); return !!t;})()" 2>&1 | tail -1)
  [ "$DOMOV" = "true" ] && echo "VizTab izhod OK (poskus $i)" && break
done

echo "--- A: API dokaz /api/security/rate-limit (EN VRSTICA izpis) ---"
agent-browser eval "fetch('/api/security/rate-limit').then(r=>r.json().then(j=>JSON.stringify({status:r.status, keys:j.stats&&j.stats.keys, hits:j.stats&&j.stats.hits, tripsTotal:j.tripsTotal, tripsLen:Array.isArray(j.trips)?j.trips.length:null, note:(j.note||'').slice(0,30)})))" 2>&1 | tail -1

echo "--- S0: Radix meni (pointerdown + click) → 'Aktivne seje' ---"
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Odjava'); if(!g) return 'brez gumba'; g.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); g.click(); return 'odprt (poslan pointerdown+click)';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const m=[...document.querySelectorAll('[role=\"menuitem\"]')].find(x=>x.textContent.includes('Aktivne seje')); if(!m) return JSON.stringify({menuitem:false, menuVidna:!!document.querySelector('[role=\"menu\"]')}); m.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); m.click(); return JSON.stringify({menuitem:true});})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=\"dialog\"]')].find(d=>d.textContent.includes('Aktivne seje')); if(!dlg) return JSON.stringify({dialog:false}); const p=[...dlg.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); return JSON.stringify({dialog:true, pecatSeje:p?p.textContent.trim():null, sejeVrstic:dlg.querySelectorAll('li').length, flexwrap:!!dlg.querySelector('.flex.flex-wrap.items-center')});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r184-seje.png > /dev/null 2>&1 && echo "screenshot SEJE OK"

echo "--- (31 s vrata) ---"
sleep 31

echo "--- S1: focus (dialog odprt) → pečat SEJ se SPREMENI ---"
PRES=$(agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=\"dialog\"]')].find(d=>d.textContent.includes('Aktivne seje')); const p=dlg?[...dlg.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')):null; return p?p.textContent.trim():null;})()" 2>&1 | tail -1)
echo "pečat seje PRE:  $PRES"
agent-browser eval "window.dispatchEvent(new Event('focus')); 'fokus S1'" 2>&1 | tail -1
sleep 6
POSTS=$(agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=\"dialog\"]')].find(d=>d.textContent.includes('Aktivne seje')); const p=dlg?[...dlg.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')):null; return p?p.textContent.trim():null;})()" 2>&1 | tail -1)
echo "pečat seje POST: $POSTS"

agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R184 S1 DOPOLNILO KONEC"
