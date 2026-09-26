#!/bin/bash
# R174 E2E (lokalni build, EN klic — nauček R157/R168): Ekipa fail-verbose +
# refetch-on-focus (P1 iz R173) + render vrata.
# ADMIN (ci@roksal.si / DimniSmoke139!) — Ekipa potrebuje users.read:
#  S0: Več → Ekipa — seznam naložen, NIČ error panelov (fail-verbose ne pokvari
#      normalne poti); vrtiljak SAMO na prvem loadu;
#  D1: focus + visibilitychange → delta /api/users = 1 (+ /api/auth) — hook ŽIVO;
#  E1: fail-verbose ŽIVO — window.fetch patch (401 za /api/users) → klik
#      'Osveži seznam ekipe' → error panel role="alert" z 401 sporočilom +
#      'Poskusi znova'; restore fetch → klik 'Ponovno naloži seznam ekipe' →
#      panel izginil, seznam nazaj (nikoli lažnega "Ni podatkov");
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

setsid node .next/standalone/server.js > /tmp/r174-e2e-server.log 2>&1 < /dev/null &
sleep 5
curl -s -o /dev/null -w "server: %{http_code}\n" http://127.0.0.1:3100/login

agent-browser close --all > /dev/null 2>&1 || true
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 5

# Izhod iz VizTab v interni app (R168 nauček):
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 4

echo "--- S0: Več → Ekipa — seznam naložen, NIČ error panelov ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Življenjski cikl računov')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const glava=document.body.innerText.includes('Ekipa'); const errPanel=[...document.querySelectorAll('[role=\"alert\"]')].map(x=>x.textContent.slice(0,60)); const niz=[...document.querySelectorAll('[aria-busy]')].length; const vrstice=document.body.innerText.includes('@roksal.si'); return JSON.stringify({glava, errPanel, ariaBusyEl: niz, vrstice});})()" 2>&1 | tail -1

echo "--- D1: focus → delta /api/users + /api/auth (hook ŽIVO) ---"
agent-browser eval "window.__r174Pre={u:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/users')).length,a:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/auth')).length}; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); 'dispatchano'" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const g=k=>performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes(k)).length; return JSON.stringify({deltaUsers: g('/api/users')-(window.__r174Pre.u||0), deltaAuth: g('/api/auth')-(window.__r174Pre.a||0)});})()" 2>&1 | tail -1

echo "--- E1: fail-verbose ŽIVO — patch fetch (401) → error panel ---"
agent-browser eval "(()=>{const orig=window.fetch.bind(window); window.__r174orig=orig; window.fetch=function(input,init){const url=typeof input==='string'?input:(input&&input.url)||''; if(url.includes('/api/users')){return Promise.resolve(new Response(JSON.stringify({error:'testna napaka'}),{status:401,headers:{'Content-Type':'application/json'}}));} return orig(input,init);}; const osvezi=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Osveži seznam ekipe'); if(!osvezi) return 'gumb NIČ'; osvezi.click(); return 'klikano';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const panel=[...document.querySelectorAll('[role=\"alert\"]')][0]; return JSON.stringify({panel: !!panel, tekst: panel?panel.textContent.slice(0,90):null, poskusi: !!([...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Ponovno naloži seznam ekipe')), lazniNiPodatkov: document.body.innerText.includes('Ni podatkov — povabite')});})()" 2>&1 | tail -1

echo "--- E1b: restore fetch → Poskusi znova → panel izginil, seznam nazaj ---"
agent-browser eval "(()=>{if(window.__r174orig){window.fetch=window.__r174orig;} const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-label')==='Ponovno naloži seznam ekipe'); if(!b) return 'gumb NIČ'; b.click(); return 'klikano';})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const panel=[...document.querySelectorAll('[role=\"alert\"]')].length; const vrstice=document.body.innerText.includes('@roksal.si'); return JSON.stringify({errPaneli: panel, seznamNazaj: vrstice});})()" 2>&1 | tail -1

echo "--- T: temna tema + ring-offset + konzola ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('temo')); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const body=getComputedStyle(document.body).backgroundColor; const ro=getComputedStyle(document.body).getPropertyValue('--tw-ring-offset-color').trim(); return JSON.stringify({bodyBg: body, ringOffset: ro, err: window.__err || null});})()" 2>&1 | tail -1

agent-browser screenshot /home/z/my-project/screenshots/qa-r174-e2e-ekipa.png > /dev/null 2>&1 && echo "screenshot OK"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
agent-browser close --all > /dev/null 2>&1 || true
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R174 E2E KONEC"
