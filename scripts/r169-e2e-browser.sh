#!/bin/bash
# R169 E2E v2 (lokalni build): Koledar 'Skupaj ur' povzetek — DELTA pristop
# (neodvisen od projectId obsega koledarja; nauček iz 1. teka: Koledar je
# projektno filtiran, zato primerjava s/filtriranim /api/schedules NE gre;
# po location.reload() je obvezen korak 'Montažna orodja' — nauček R168).
# ADMIN (ci@roksal.si / DimniSmoke139!):
#  S0: preberi povzetek (obstoječe stanje z 1 PREKlicANO iz 1. teka);
#  A1: PATCH → NAVRTENO → S1: ure +4, termini +1, BREZ 'brez' omembe;
#  A2: PATCH → PREKlicANO → S2: nazaj na S0 (izključitev ŽIVO dokazana).
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r169-e2e-server.log 2>&1 < /dev/null &
sleep 5
curl -s -o /dev/null -w "server: %{http_code}\n" http://127.0.0.1:3100/login

agent-browser close --all > /dev/null 2>&1 || true
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 5

# Izhod iz VizTab v interni app (R168 nauček — VizTab nima 'Domov'/'Več'):
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 4

# --- pomožna navigacija (EN klic vsak korak; nauček R157–R168) ---
# REMOUNT pot: Domov (unmount logistike) → Več → Logistika V6 → Koledar
# (nauček v2: če je Logistika že odprta, ponoven klik NE remonta komponente
#  in loadData se NE pokliče — povzetek bi bil zastarel; UI sam kliče
#  loadData() po statusnih gumbih, surov fetch pa ne).
nav_koledar() {
  agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Domov'); if(b) b.click(); return !!b;})()" > /dev/null 2>&1
  sleep 3
  agent-browser eval "(()=>{const v=document.querySelector('button[aria-label=\\'Več\\']'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
  sleep 2
  agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,[role=\"link\"],a,div')].find(x=>x.textContent&&x.textContent.trim().startsWith('Logistika V6')&&x.closest('[data-slot=\"sheet-content\"],[role=\"dialog\"]')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
  sleep 5
  agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='Koledar'); if(b) b.click(); return !!b;})()" > /dev/null 2>&1
  sleep 2
}

echo "--- S0: povzetek ob zagonu (1. tek je pustil 1 PREKlicANO termin) ---"
nav_koledar
agent-browser eval "JSON.stringify({povzetek: ([...document.querySelectorAll('p')].find(x=>(x.textContent||'').startsWith('Skupaj'))||{textContent:null}).textContent})" 2>&1 | tail -1

echo "--- A1: PATCH testni termin → NAVRTENO (ure se VKLJUČIJO) ---"
agent-browser eval "(async()=>{const r=await fetch('/api/schedules',{credentials:'same-origin'}); const rows=await r.json(); const t=rows.find(x=>x.lokacija==='R169 E2E preklic'); if(!t) return JSON.stringify({napaka:'testni termin ni najden'}); const p=await fetch('/api/schedules',{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:t.id,status:'NAVRTENO'})}); return JSON.stringify({patch:p.status, id:t.id});})()" 2>&1 | tail -1
sleep 1
nav_koledar
agent-browser eval "JSON.stringify({s1: ([...document.querySelectorAll('p')].find(x=>(x.textContent||'').startsWith('Skupaj'))||{textContent:null}).textContent})" 2>&1 | tail -1

echo "--- A2: PATCH nazaj → PREKlicANO (ure izključene, 'brez 1 preklicanega') ---"
agent-browser eval "(async()=>{const r=await fetch('/api/schedules',{credentials:'same-origin'}); const rows=await r.json(); const t=rows.find(x=>x.lokacija==='R169 E2E preklic'); if(!t) return JSON.stringify({napaka:'testni termin ni najden'}); const p=await fetch('/api/schedules',{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:t.id,status:'PREKlicANO'})}); return JSON.stringify({patch:p.status});})()" 2>&1 | tail -1
sleep 1
nav_koledar
agent-browser eval "JSON.stringify({s2: ([...document.querySelectorAll('p')].find(x=>(x.textContent||'').startsWith('Skupaj'))||{textContent:null}).textContent})" 2>&1 | tail -1

echo "--- A3: dashboard Termini kartica — isti povzetek (EN VIR RESNICE) ---"
agent-browser eval "(()=>{const v=document.querySelector('button[aria-label=\\'Več\\']'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Domov'); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 5
agent-browser eval "JSON.stringify({dashboard: ([...document.querySelectorAll('p')].find(x=>(x.textContent||'').startsWith('Skupaj'))||{textContent:null}).textContent})" 2>&1 | tail -1

echo "--- A4: temna tema + ring-offset + konzola ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('temo')); if(b) b.click(); return !!b;})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const body=getComputedStyle(document.body).backgroundColor; const ringOffset=getComputedStyle(document.body).getPropertyValue('--tw-ring-offset-color').trim(); return JSON.stringify({bodyBg: body, ringOffset, err: window.__err || null});})()" 2>&1 | tail -1

agent-browser screenshot /home/z/my-project/screenshots/qa-r169-e2e-koledar-povzetek.png > /dev/null 2>&1 && echo "screenshot OK"
agent-browser close --all > /dev/null 2>&1 || true

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R169 E2E v2 KONEC"
