#!/bin/bash
# R170 E2E (lokalni build, EN klic — nauček R157/R168): osvežitev ob fokusu +
# pečat 'Osveženo ob HH:MM:SS' + rate-limit determinizem ŽIVO.
# ADMIN (ci@roksal.si / DimniSmoke139!):
#  S0: dashboard Termini kartica — pečat viden (čas uspešnega branja);
#  F1: dispatch focus → NOV fetch /api/schedules (prvi dogodek vedno osveži);
#  F2: dispatch focus še enkrat → BREZ novega fetcha (rate-limit 30 s živo);
#  K:  Logistika V6 → Koledar — pečat viden + R169 povzetek;
#  T:  temna tema + ring-offset #0f1724 (R168 fix) + window.__err null.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r170-e2e-server.log 2>&1 < /dev/null &
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
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Domov'); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 5

echo "--- S0: pečat 'Osveženo ob' na kartici Termini ---"
agent-browser eval "(()=>{const m=document.body.innerText.match(/Osve\\u017eeno ob\\s+\\d{1,2}:\\d{2}:\\d{2}/); const kartica=document.body.innerText.includes('Termini \\u2014 naslednjih 7 dni'); return JSON.stringify({kartica, pecat: m?m[0]:null});})()" 2>&1 | tail -1

echo "--- F1: prvi focus event → NOV fetch /api/schedules ---"
agent-browser eval "(()=>{window.__r170pred=performance.getEntriesByType('resource').filter(e=>e.name.includes('/api/schedules')).length; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); return JSON.stringify({pred: window.__r170pred});})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const po=performance.getEntriesByType('resource').filter(e=>e.name.includes('/api/schedules')).length; return JSON.stringify({po, pred: window.__r170pred, novaFetcha: po-window.__r170pred});})()" 2>&1 | tail -1

echo "--- F2: drugi focus takoj zatem → BREZ novega fetcha (rate-limit) ---"
agent-browser eval "(()=>{const pred=performance.getEntriesByType('resource').filter(e=>e.name.includes('/api/schedules')).length; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); return new Promise(res=>setTimeout(()=>{const po=performance.getEntriesByType('resource').filter(e=>e.name.includes('/api/schedules')).length; res(JSON.stringify({pred, po, delta: po-pred, rateLimitDeluje: po===pred}));},1200));})()" 2>&1 | tail -1

echo "--- K: Logistika V6 → Koledar — pečat + R169 povzetek ---"
agent-browser eval "(()=>{const v=document.querySelector('button[aria-label=\\'Več\\']'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,[role=\"link\"],a,div')].find(x=>x.textContent&&x.textContent.trim().startsWith('Logistika V6')&&x.closest('[data-slot=\"sheet-content\"],[role=\"dialog\"]')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 5
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='Koledar'); if(b) b.click(); return !!b;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const m=document.body.innerText.match(/Osve\\u017eeno ob\\s+\\d{1,2}:\\d{2}:\\d{2}/); const povzetek=([...document.querySelectorAll('p')].find(x=>(x.textContent||'').startsWith('Skupaj'))||{textContent:null}).textContent; const alerts=[...document.querySelectorAll('[role=\"alert\"]')].map(a=>a.textContent.slice(0,60)); return JSON.stringify({pecatKoledar: m?m[0]:null, povzetek, alerts});})()" 2>&1 | tail -1

echo "--- T: temna tema + ring-offset + konzola ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('temo')); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const body=getComputedStyle(document.body).backgroundColor; const ro=getComputedStyle(document.body).getPropertyValue('--tw-ring-offset-color').trim(); return JSON.stringify({bodyBg: body, ringOffset: ro, err: window.__err || null});})()" 2>&1 | tail -1

agent-browser screenshot /home/z/my-project/screenshots/qa-r170-e2e-koledar.png > /dev/null 2>&1 && echo "screenshot OK"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
agent-browser close --all > /dev/null 2>&1 || true
echo "R170 E2E KONEC"
