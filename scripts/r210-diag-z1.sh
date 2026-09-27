#!/bin/bash
# Z1 diagnoza: zakaj kartica na '/' tik po prijavi ni v DOM (Z4 po navigaciji jo vidi).
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
setsid node .next/standalone/server.js > /tmp/R210-diag.log 2>&1 < /dev/null &
sleep 4
agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 8
for i in 1 2 3; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done
echo "--- D1: kaj je na strani (preprosto stanje) ---"
agent-browser eval "(()=>{const besedilo=document.body.innerText; return JSON.stringify({url:location.pathname,imaKartico:besedilo.includes('Naročila, ki čakajo na dejanje'),imaPozdrav:besedilo.includes(' Dobro uterjano')||besedilo.includes('Dobro uterjano'),imaSkelet:besedilo.includes('Nalaganje'),pecatov:[...document.querySelectorAll('span')].filter(e=>e.textContent.trim().startsWith('Osveženo ob')).length,uvodniVodic:!!document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'),projKartica:besedilo.includes('Projekti')||besedilo.includes('projektov'),nizkaZaloga:besedilo.includes('Nizka zaloga'),zalogaVRedu:besedilo.includes('Zaloga v redu'),err:window.__err??null});})()" 2>&1 | tail -1
echo "--- D2: osveži stran (reload) in poglej znova ---"
agent-browser open "http://127.0.0.1:3100/" > /dev/null 2>&1
sleep 8
agent-browser eval "(()=>{const besedilo=document.body.innerText; const znacka=[...document.querySelectorAll('span')].find(s=>s.title&&s.title.includes('Aktivna naročila')); return JSON.stringify({url:location.pathname,imaKartico:besedilo.includes('Naročila, ki čakajo na dejanje'),stevec:znacka?znacka.textContent.trim():null,err:window.__err??null});})()" 2>&1 | tail -1
echo "--- D3: /api/material-orders direktno (kaj vrne API v tem sejni kontekstu) ---"
agent-browser eval "(async()=>{const r=await fetch('/api/material-orders'); const o=await r.json(); return JSON.stringify({status:r.status,count:Array.isArray(o)?o.length:null,statusi:Array.isArray(o)?o.map(x=>x.status):null});})()" 2>&1 | tail -1
agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "DIAG KONEC"
