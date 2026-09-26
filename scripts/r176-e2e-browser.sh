#!/bin/bash
# R176 E2E (lokalni build, EN klic — nauček R157/R168): dokumenti + varnost
# refetch-on-focus (P1-b zaključek, vzorec zaloga R175).
# ADMIN (ci@roksal.si / DimniSmoke139!):
#  S0: Več → Dokumenti — projekti + dokumenti naloženi (ali pošteno prazno),
#      NIČ konzolnih napak;
#  D1: focus + visibilitychange → delta /api/projects + /api/documents (hook ŽIVO);
#  W0: Več → Varnost — vreme naloženo ALI fail-verbose panel (zunanja storitev);
#  W1: focus → delta /api/weather (hook ŽIVO);
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

setsid node .next/standalone/server.js > /tmp/r176-e2e-server.log 2>&1 < /dev/null &
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

echo "--- S0: Več → Dokumenti — naloženo ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'')==='Dokumenti'||b.textContent.trim().includes('Dokumenti')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const glava=document.body.innerText.includes('Dokumenti'); const izberi=document.body.innerText.includes('Izberite projekt')||document.body.innerText.includes('Projekt'); const err=document.body.innerText.includes('ni mogoče naložiti'); return JSON.stringify({glava, izberiProjekt: izberi, errorTekst: err});})()" 2>&1 | tail -1

echo "--- D1: focus → delta /api/projects + /api/documents (hook ŽIVO) ---"
agent-browser eval "window.__r176Pre={p:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/projects')).length,d:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/documents')).length}; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); 'dispatchano'" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const g=k=>performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes(k)).length; return JSON.stringify({deltaProjekti: g('/api/projects')-(window.__r176Pre.p||0), deltaDokumenti: g('/api/documents')-(window.__r176Pre.d||0)});})()" 2>&1 | tail -1

echo "--- W0: Več → Varnost — vreme naloženo ali fail-verbose ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'')==='Varnost'||b.textContent.trim().includes('Varnost')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 7
agent-browser eval "(()=>{const glava=document.body.innerText.includes('Varnost'); const napaka=[...document.querySelectorAll('[role=\"alert\"]')].length; const veter=document.body.innerText.includes('Veter')||document.body.innerText.includes('m/s'); return JSON.stringify({glava, errorPaneli: napaka, veterViden: veter});})()" 2>&1 | tail -1

echo "--- W1: focus → delta /api/weather (hook ŽIVO) ---"
agent-browser eval "window.__r176PreW=performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/weather')).length; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); 'dispatchano'" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const g=performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/weather')).length; return JSON.stringify({deltaWeather: g-(window.__r176PreW||0)});})()" 2>&1 | tail -1

echo "--- T: temna tema + ring-offset + konzola ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('temo')); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const body=getComputedStyle(document.body).backgroundColor; const ro=getComputedStyle(document.body).getPropertyValue('--tw-ring-offset-color').trim(); return JSON.stringify({bodyBg: body, ringOffset: ro, err: window.__err || null});})()" 2>&1 | tail -1

agent-browser screenshot /home/z/my-project/screenshots/qa-r176-e2e-varnost.png > /dev/null 2>&1 && echo "screenshot OK"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
agent-browser close --all > /dev/null 2>&1 || true
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R176 E2E KONEC"
