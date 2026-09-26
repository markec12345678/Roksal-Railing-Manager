#!/bin/bash
# R182 N2 focused re-probe — vse poizvedbe SCOPED na [role="dialog"] (Sheet portal).
# Popravek r182-e2e-browser.sh N2: nescopeana query je ujela DEMO vreme alert +
# pečat iz varnostne površine ZA sheetom (false signal, ni koda bug).
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r182-n2-server.log 2>&1 < /dev/null &
sleep 5

agent-browser close --all > /dev/null 2>&1 || true
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 6

for i in 1 2 3; do
  agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
  sleep 4
  DOMOV=$(agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Domov'); return !!t;})()" 2>&1 | tail -1)
  [ "$DOMOV" = "true" ] && break
done

# N2a: zdravo stanje — pečat NOTRI (scoped)
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(b) b.click(); return 'bell';})()" > /dev/null 2>&1
sleep 6
agent-browser eval "(()=>{const d=document.querySelector('[role=\"dialog\"]'); if(!d) return 'NI DIALOGA'; const p=[...d.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); const w=[...d.querySelectorAll('[role=\"alert\"]')].length; return JSON.stringify({korak:'N2a-zdravo', pecat: p?p.textContent.trim():null, warning: w});})()" 2>&1 | tail -1

# N2b: patch weather → bell reload → warning NOTRI (scoped) + pečat IZGINIL
agent-browser eval "(()=>{const orig=window.fetch; window.__origFetch=orig; window.fetch=(u,o)=>{ if(typeof u==='string' && u.includes('/api/weather')) return Promise.resolve(new Response(JSON.stringify({error:'patch'}),{status:500})); return orig(u,o); }; return 'patch ON';})()" > /dev/null 2>&1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(b) b.click(); return 'bell reload';})()" > /dev/null 2>&1
sleep 6
agent-browser eval "(()=>{const d=document.querySelector('[role=\"dialog\"]'); if(!d) return 'NI DIALOGA'; const p=[...d.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); const w=[...d.querySelectorAll('[role=\"alert\"]')]; return JSON.stringify({korak:'N2b-pokvarjeno', pecat: p?p.textContent.trim():null, warning: w.length, besedilo: w[0]?w[0].textContent.trim().slice(0,90):null, retryGumb: !!d.querySelector('[aria-label=\"Ponovno naloži obvestila\"]')});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r182-warning-scoped.png > /dev/null 2>&1 && echo "screenshot WARNING-SCOPED OK"

# N2c: restore → Poskusi znova → zdravje (warning IZGINIL, pečat NAZAJ z NOVIM časom)
agent-browser eval "(()=>{window.fetch=window.__origFetch; return 'patch OFF';})()" > /dev/null 2>&1
agent-browser eval "(()=>{const r=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Ponovno naloži obvestila'); if(r) r.click(); return !!r;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const d=document.querySelector('[role=\"dialog\"]'); if(!d) return 'NI DIALOGA'; const p=[...d.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('Osveženo ob')); const w=[...d.querySelectorAll('[role=\"alert\"]')].length; return JSON.stringify({korak:'N2c-zdravilo', pecatNazaj: p?p.textContent.trim():null, warning: w});})()" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R182 N2 SCOPED KONEC"
