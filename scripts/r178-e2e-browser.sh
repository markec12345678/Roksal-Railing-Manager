#!/bin/bash
# R178 E2E (lokalni build, EN klic — nauček R157/R168): pečati svežine
# 'Osveženo ob' za CRM STRANKE + PRODAJNO PLOŠČO + EKIPA (R177 kandidat b —
# družina zdaj na VSEH 9 fail-verbose/refetch površinah).
# ADMIN (ci@roksal.si / DimniSmoke139!):
#  P0: Več → CRM — prodajna plošča naložena, pečat na plošči VIDEN, NIČ errorjev;
#  C0: CRM — glava 'CRM stranke' + pečat strank VIDEN;
#  C1: focus → delta /api/crm (hook R173 regresija) + pečat ostaja;
#  E0: Več → Ekipa — seznam naložen (ADMIN), pečat VIDEN (R174 regresija);
#  E1: focus → delta /api/users + /api/auth (hook R174 regresija);
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

setsid node .next/standalone/server.js > /tmp/r178-e2e-server.log 2>&1 < /dev/null &
sleep 5
curl -s -o /dev/null -w "server: %{http_code}\n" http://127.0.0.1:3100/login

agent-browser close --all > /dev/null 2>&1 || true
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 5

# VizTab izhod z retry zanko ×3 (nauček R175 flake)
for i in 1 2 3; do
  agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
  sleep 4
  IZHOD=$(agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); return !!v;})()" 2>&1 | tail -1)
  if [ "$IZHOD" = "true" ]; then echo "VizTab izhod OK (poskus $i)"; break; fi
done

VECPOMOC='(()=>{const v=[...document.querySelectorAll("button")].find(x=>x.textContent.trim()==="Več"||(x.getAttribute("aria-label")||"")==="Več"); if(v) v.click(); return !!v;})()'

echo "--- P0: Več → CRM — prodajna plošča + pečat plošče VIDEN ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('CRM')||b.textContent.trim().includes('CRM')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const plosca=document.body.innerText.includes('Prodajna plošča'); const pecat=[...document.querySelectorAll('span')].filter(s=>s.textContent.trim().startsWith('Osveženo ob')).length; const err=[...document.querySelectorAll('[role=\"alert\"]')].length; return JSON.stringify({ploscaVidna: plosca, pečatiVidni: pecat, errorPaneli: err});})()" 2>&1 | tail -1

echo "--- C0: glava 'CRM stranke' + pečat strank VIDEN ---"
agent-browser eval "(()=>{const glava=[...document.querySelectorAll('h2')].some(h=>h.textContent.trim()==='CRM stranke'); const pecat=document.body.innerText.includes('Osveženo ob'); const isk=document.body.innerText.includes('Iskanje strank')||!!document.querySelector('input[placeholder*=\"iskanje\" i]'); return JSON.stringify({glavaCRM: glava, pecatViden: pecat, iskalnik: isk});})()" 2>&1 | tail -1

echo "--- C1: focus → delta /api/crm (hook R173 regresija) + pečat ostaja ---"
agent-browser eval "window.__r178PreC=performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/crm')).length; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); 'dispatchano'" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const g=performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/crm')).length; return JSON.stringify({deltaCrm: g-(window.__r178PreC||0), pecatOstaja: document.body.innerText.includes('Osveženo ob'), errorPaneli: [...document.querySelectorAll('[role=\"alert\"]')].length});})()" 2>&1 | tail -1

echo "--- E0: Več → Ekipa — seznam naložen + pečat VIDEN ---"
agent-browser eval "$VECPOMOC" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.textContent.trim().includes('Ekipa')||b.textContent.trim().includes('Življenjski cikl računov'))); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const glava=document.body.innerText.includes('Ekipa — življenjski cikl računov'); const pecat=document.body.innerText.includes('Osveženo ob'); const err=[...document.querySelectorAll('[role=\"alert\"]')].length; return JSON.stringify({glavaEkipa: glava, pecatViden: pecat, errorPaneli: err});})()" 2>&1 | tail -1

echo "--- E1: focus → delta /api/users + /api/auth (hook R174 regresija) ---"
agent-browser eval "window.__r178PreE={u:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/users')).length,a:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/auth')).length}; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); 'dispatchano'" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const g=k=>performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes(k)).length; return JSON.stringify({deltaUsers: g('/api/users')-(window.__r178PreE.u||0), deltaAuth: g('/api/auth')-(window.__r178PreE.a||0), pecatOstaja: document.body.innerText.includes('Osveženo ob')});})()" 2>&1 | tail -1

echo "--- T: temna tema + ring-offset + konzola ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('temo')); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const body=getComputedStyle(document.body).backgroundColor; const ro=getComputedStyle(document.body).getPropertyValue('--tw-ring-offset-color').trim(); return JSON.stringify({bodyBg: body, ringOffset: ro, err: window.__err || null});})()" 2>&1 | tail -1

agent-browser screenshot /home/z/my-project/screenshots/qa-r178-e2e-ekipa.png > /dev/null 2>&1 && echo "screenshot OK"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
agent-browser close --all > /dev/null 2>&1 || true
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R178 E2E KONEC"
