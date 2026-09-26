#!/bin/bash
# R177 E2E (lokalni build, EN klic — nauček R157/R168): pečati svežine
# 'Osveženo ob' za ZALOGA + DOKUMENTI + VARNOST (R176 kandidat b-i).
# ADMIN (ci@roksal.si / DimniSmoke139!):
#  Z0: Več → Zaloga — seznam naložen, pečat 'Osveženo ob' VIDEN, NIČ errorjev;
#  Z1: focus → delta /api/inventory + /api/projects (regresija hooka R175);
#  D0: Več → Dokumenti — dokumenti/izbira naložena, pečat VIDEN;
#  D1: focus → delta /api/documents (regresija hooka R176);
#  W0: Več → Varnost — veter naložen, pečat VIDEN;
#  W1: focus → delta /api/weather (regresija hooka R176);
#  T:  temna tema + ring-offset #0f1724 + window.__err null.
# ⚠️ R171 NAUČEK: standalone RABI statiko — graditi z `npm run build`.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r177-e2e-server.log 2>&1 < /dev/null &
sleep 5
curl -s -o /dev/null -w "server: %{http_code}\n" http://127.0.0.1:3100/login

agent-browser close --all > /dev/null 2>&1 || true
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 5

agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 4

VECPOMOC='(()=>{const v=[...document.querySelectorAll("button")].find(x=>x.textContent.trim()==="Več"||(x.getAttribute("aria-label")||"")==="Več"); if(v) v.click(); return !!v;})()'

echo "--- Z0: Več → Zaloga — pečat VIDEN ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('zaloga')||b.textContent.trim().includes('Zaloga')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const glava=document.body.innerText.includes('Zaloga'); const pecat=document.body.innerText.includes('Osveženo ob'); const err=[...document.querySelectorAll('[role=\"alert\"]')].length; return JSON.stringify({glava, pecatViden: pecat, errorPaneli: err});})()" 2>&1 | tail -1

echo "--- Z1: focus → delta /api/inventory + /api/projects (hook R175 regresija) ---"
agent-browser eval "window.__r177Pre={i:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/inventory')).length,p:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/projects')).length}; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); 'dispatchano'" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const g=k=>performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes(k)).length; return JSON.stringify({deltaInventory: g('/api/inventory')-(window.__r177Pre.i||0), deltaProjekti: g('/api/projects')-(window.__r177Pre.p||0), pecatOstaja: document.body.innerText.includes('Osveženo ob')});})()" 2>&1 | tail -1

echo "--- D0: Več → Dokumenti — pečat VIDEN ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'')==='Dokumenti'||b.textContent.trim().includes('Dokumenti')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const glava=document.body.innerText.includes('Dokumenti'); const pecat=document.body.innerText.includes('Osveženo ob'); const err=[...document.querySelectorAll('[role=\"alert\"]')].length; return JSON.stringify({glava, pecatViden: pecat, errorPaneli: err});})()" 2>&1 | tail -1

echo "--- D1: focus → delta /api/documents + /api/projects (hook R176 regresija) ---"
agent-browser eval "window.__r177PreD={d:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/documents')).length,p:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/projects')).length}; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); 'dispatchano'" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const g=k=>performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes(k)).length; return JSON.stringify({deltaDokumenti: g('/api/documents')-(window.__r177PreD.d||0), deltaProjekti: g('/api/projects')-(window.__r177PreD.p||0), pecatOstaja: document.body.innerText.includes('Osveženo ob')});})()" 2>&1 | tail -1

echo "--- W0: Več → Varnost — pečat VIDEN ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'')==='Varnost'||b.textContent.trim().includes('Varnost')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 7
agent-browser eval "(()=>{const glava=document.body.innerText.includes('Varnost'); const pecat=document.body.innerText.includes('Osveženo ob'); const err=[...document.querySelectorAll('[role=\"alert\"]')].length; const veter=document.body.innerText.includes('m/s')||document.body.innerText.includes('Veter'); return JSON.stringify({glava, pecatViden: pecat, errorPaneli: err, veterViden: veter});})()" 2>&1 | tail -1

echo "--- W1: focus → delta /api/weather (hook R176 regresija) ---"
agent-browser eval "window.__r177PreW=performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/weather')).length; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); 'dispatchano'" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const g=performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/weather')).length; return JSON.stringify({deltaWeather: g-(window.__r177PreW||0), pecatOstaja: document.body.innerText.includes('Osveženo ob')});})()" 2>&1 | tail -1

echo "--- T: temna tema + ring-offset + konzola ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('temo')); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const body=getComputedStyle(document.body).backgroundColor; const ro=getComputedStyle(document.body).getPropertyValue('--tw-ring-offset-color').trim(); return JSON.stringify({bodyBg: body, ringOffset: ro, err: window.__err || null});})()" 2>&1 | tail -1

agent-browser screenshot /home/z/my-project/screenshots/qa-r177-e2e-varnost.png > /dev/null 2>&1 && echo "screenshot OK"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
agent-browser close --all > /dev/null 2>&1 || true
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R177 E2E KONEC"
