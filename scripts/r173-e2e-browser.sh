#!/bin/bash
# R173 E2E (lokalni build, EN klic — nauček R157/R168): refetch-on-focus za
# CRM + prodajno ploščo (P1-c) + logistični CSV metapodatki (P1-d).
# ADMIN (ci@roksal.si / DimniSmoke139!):
#  S0: Več → CRM stranke — prodajna plošča vidna (fail-verbose loadProjects ne
#      pokvari normalne poti); CRM seznam naložen;
#  D1: focus + visibilitychange → delta /api/crm = 1 (CRM živo) + delta
#      /api/projects = 1 (plošča živo) — rate-limit dovoljuje prvi dogodek;
#  L0: Več → Logistika → Koledar — povzetek živo (R169 regresija prek nove
#      EN VIR funkcije terminUrPovzetekRazsirjen);
#  C1: CSV klik (blob ujet) → meta vrstice: Obseg, Povzetek (= zaslon),
#      Izvoženo ob (čas zadnje osvežitve) + 9 stolpcev R139 nespremenjenih;
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

setsid node .next/standalone/server.js > /tmp/r173-e2e-server.log 2>&1 < /dev/null &
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

echo "--- S0: Več → CRM stranke — plošča + seznam naložena ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('CRM stranke')||b.textContent.trim().includes('CRM stranke')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 5
agent-browser eval "(()=>{const plosca=document.body.innerText.includes('Prodajna plošča'); const crmGlava=document.body.innerText.includes('CRM'); const errPanel=[...document.querySelectorAll('[role=\"alert\"]')].map(x=>x.textContent.slice(0,60)); return JSON.stringify({plosca, crmGlava, errPanel});})()" 2>&1 | tail -1

echo "--- D1: focus → delta /api/crm + /api/projects (P1-c ŽIVO) ---"
agent-browser eval "window.__r173Pre={c:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/crm')).length,p:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/projects')).length}; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); 'dispatchano'" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const g=k=>performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes(k)).length; return JSON.stringify({deltaCrm: g('/api/crm')-(window.__r173Pre.c||0), deltaProjekti: g('/api/projects')-(window.__r173Pre.p||0)});})()" 2>&1 | tail -1

echo "--- L0: Več → Logistika → Koledar — povzetek (R169 regresija, EN VIR R173) ---"
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('Logistika')||b.textContent.trim().includes('Logistika V6')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 7
agent-browser eval "(()=>{const pov=(...p)=>{const el=[...document.querySelectorAll('p')].find(x=>(x.textContent||'').startsWith('Skupaj')); return el?el.textContent:null;}; const csvBtn=document.querySelector('button[aria-label=\"Izvozi vidne termine kot CSV\"]'); return JSON.stringify({povzetek: pov(), csvGumb: !!csvBtn, csvOmogocen: csvBtn?!csvBtn.disabled:null});})()" 2>&1 | tail -1

echo "--- C1: CSV ujetje (blob) — meta vrstice R173 ---"
agent-browser eval "(()=>{window.__r173csv=null; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(blob){const u=orig(blob); if(blob instanceof Blob && blob.type.includes('csv')) blob.text().then(t=>{window.__r173csv=t;}); return u;}; document.querySelector('button[aria-label=\"Izvozi vidne termine kot CSV\"]').click(); return 'klikano';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const t=window.__r173csv; if(!t) return JSON.stringify({ujetje:null, toast: document.body.innerText.includes('CSV izvožen')}); const vrstice=t.replace(/^\\uFEFF/,'').split('\\r\\n').filter(x=>x!==''); return JSON.stringify({ujetje:true, vrstic: vrstice.length, glava: vrstice[0], obseg: vrstice.find(x=>x.startsWith('Obseg;')), povzetek: vrstice.find(x=>x.startsWith('Povzetek;')), izvozjeno: vrstice.find(x=>x.startsWith('Izvoženo ob')), toast: document.body.innerText.includes('CSV izvožen')});})()" 2>&1 | tail -1

echo "--- T: temna tema + ring-offset + konzola ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('temo')); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const body=getComputedStyle(document.body).backgroundColor; const ro=getComputedStyle(document.body).getPropertyValue('--tw-ring-offset-color').trim(); return JSON.stringify({bodyBg: body, ringOffset: ro, err: window.__err || null});})()" 2>&1 | tail -1

agent-browser screenshot /home/z/my-project/screenshots/qa-r173-e2e-logistika.png > /dev/null 2>&1 && echo "screenshot OK"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
agent-browser close --all > /dev/null 2>&1 || true
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R173 E2E KONEC"
