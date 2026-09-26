#!/bin/bash
# R171 E2E (lokalni build, EN klic — nauček R157/R168): CSV izvoz IZVOŽENO=ZASLON
# + dashboard refetch-on-focus + pečat projektnega seznama.
# ADMIN (ci@roksal.si / DimniSmoke139!):
#  S0: Termini kartica pečat + CSV gumb omogočen (podatki živo);
#  C1: KLIK CSV gumba (eval-klik — sonner fixed overlay blokira Playwright
#      klik; blob ujet z URL.createObjectURL patchem) → bajtni pregled CSV:
#      glave, Filter, Povzetek = ISTI niz kot na kartici, Izvoženo ob = pečat;
#  D1: dispatch focus → NOV fetch /api/projects (P1-b refetch-on-focus ŽIVO);
#  D2: pečat 'Osveženo ob' v glavi Projekti (dashboard) + Termini kartica;
#  T:  temna tema + ring-offset #0f1724 (R168 fix) + window.__err null.
# ⚠️ R171 NAUČEK: standalone server RABI kopijo statike — graditi z
#    `npm run build` (vključuje cp .next/static + public v standalone),
#    NIKOLI z golim `npx next build` (chunki → 404 → hydration mrtev,
#    'Nalagam prijavo…' brez /api klicev, TURBOPACK undefined).
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r171-e2e-server.log 2>&1 < /dev/null &
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

echo "--- S0: pečat + CSV gumb omogočen (podatki) ---"
agent-browser eval "(()=>{const kartica=document.body.innerText.includes('Termini \\u2014 naslednjih 7 dni'); const btn=document.querySelector('button[aria-label^=\"Izvozi prikazane termine\"]'); const omogocen=btn?!btn.disabled:null; const label=btn?btn.getAttribute('aria-label'):null; const pecat=document.body.innerText.match(/Osve\\u017eeno ob\\s+\\d{1,2}:\\d{2}:\\d{2}/); const povzetek=([...document.querySelectorAll('p')].find(x=>(x.textContent||'').startsWith('Skupaj'))||{textContent:null}).textContent; return JSON.stringify({kartica, gumbJe: !!btn, omogocen, label, pecat: pecat?pecat[0]:null, povzetek});})()" 2>&1 | tail -1

echo "--- C1: CSV ujetje prek blob (sonner overlay blokira Playwright klik) ---"
agent-browser eval "(()=>{window.__r171csv=null; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(blob){const u=orig(blob); if(blob instanceof Blob && blob.type.includes('csv')) blob.text().then(t=>{window.__r171csv=t;}); return u;}; document.querySelector('button[aria-label^=\"Izvozi prikazane termine\"]').click(); return 'klikano';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const t=window.__r171csv; if(!t) return JSON.stringify({ujetje:null, toast: document.body.innerText.includes('CSV izvo\\u017een')}); const vrstice=t.replace(/^\\uFEFF/,'').split('\\r\\n'); return JSON.stringify({ujetje: vrstice.length, glava: vrstice[0], filter: vrstice.find(x=>x.startsWith('Filter;')), povzetek: vrstice.find(x=>x.startsWith('Povzetek;')), izvozeno: vrstice.find(x=>x.startsWith('Izvo\\u017eeno ob')), prvaPodatkovna: vrstice[1], toast: document.body.innerText.includes('CSV izvo\\u017een')});})()" 2>&1 | tail -1

echo "--- D1: dashboard refetch-on-focus (P1-b) — focus → nov /api/projects fetch ---"
agent-browser eval "(()=>{window.__r171proj=performance.getEntriesByType('resource').filter(e=>e.name.includes('/api/projects')).length; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); return JSON.stringify({pred: window.__r171proj});})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const po=performance.getEntriesByType('resource').filter(e=>e.name.includes('/api/projects')).length; return JSON.stringify({po, pred: window.__r171proj, delta: po-window.__r171proj});})()" 2>&1 | tail -1

echo "--- D2: pečat v glavi Projekti (dashboard) ---"
agent-browser eval "(()=>{const el=document.querySelector('span[title=\"\\u010cas zadnje uspe\\u0161ne osve\\u017eitve podatkov\"]'); const vsi=el?[...document.querySelectorAll('span[title=\"\\u010cas zadnje uspe\\u0161ne osve\\u017eitve podatkov\"]')].map(x=>x.textContent):[]; return JSON.stringify({stPecatov: vsi.length, pecati: vsi});})()" 2>&1 | tail -1

echo "--- T: temna tema + ring-offset + konzola ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('temo')); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const body=getComputedStyle(document.body).backgroundColor; const ro=getComputedStyle(document.body).getPropertyValue('--tw-ring-offset-color').trim(); return JSON.stringify({bodyBg: body, ringOffset: ro, err: window.__err || null});})()" 2>&1 | tail -1

agent-browser screenshot /home/z/my-project/screenshots/qa-r171-e2e-dashboard.png > /dev/null 2>&1 && echo "screenshot OK"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
agent-browser close --all > /dev/null 2>&1 || true
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R171 E2E KONEC"
