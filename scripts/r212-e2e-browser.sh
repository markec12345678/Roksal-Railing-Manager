#!/bin/bash
# R212 E2E ŽIVO (vzorec r206-r211): standalone :3100, ADMIN (ci@roksal.si).
#  Z0 prijava ADMIN + zapri onboarding
#  Z1 priprava: POST OSNUTEK naročilo prek seje (aktivna naročila > 0)
#  Z2 F1 ŽIVO: zvonček odprt → digest 'Naročila, ki čakajo na dejanje'
#     (kind order) z dobesednimi statusi ('OSNUTEK n — iz zadnjega nalaganja')
#     + meta 'Pregled: Material → Naročila' + badge zvončka > 0
#  Z3 F1 navigacija: klik na digest → Material V5 odprt (more:'material')
#  Z4 F1 fail-verbose: fetch intercept 500 na /api/material-orders → zvonček
#     pokaže viriNapaka z 'naročila' + BREZ pečata (nikoli lažne svežine)
#  Z5 restore: 0 aktivnih (PREKlicANO čiščenje) → digest IZGINI iz zvončka
#     (brez lažnega 0) + DB osnova deterministična
#  Z6 temna rgb(15,23,36) + __err null + health + odjava + port sproščen
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
setsid node .next/standalone/server.js > /tmp/R212-server-e2e.log 2>&1 < /dev/null &
sleep 4

agent-browser close --all > /dev/null 2>&1 || true
sleep 1

echo "--- Z0: prijava ADMIN ---"
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
agent-browser eval "(()=>{return JSON.stringify({url:location.pathname,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z1: priprava — POST OSNUTEK naročilo prek seje ---"
agent-browser eval "(async()=>{const sup=await (await fetch('/api/suppliers')).json(); const inv=await (await fetch('/api/inventory')).json(); if(!sup.length||!inv.length) return JSON.stringify({napaka:'ni dobavitelja/zaloge'}); const post=await fetch('/api/material-orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({supplierId:sup[0].id,items:[{inventoryId:inv[0].id,kolicina:1}],opombe:'R212 E2E — zvoncek digest (_r212-zvoncek)'})}); const tel=await post.json(); return JSON.stringify({status:post.status,id:tel.id,statusN:tel.status});})()" 2>&1 | tail -1

echo "--- Z2: F1 ŽIVO — zvonček digest 'Naročila, ki čakajo na dejanje' ---"
agent-browser eval "(()=>{const zv=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Obvestila')); if(zv){zv.click(); return 'klik:'+(zv.getAttribute('aria-label')||'');} return 'ni zvoncka';})()" 2>&1 | tail -1
sleep 6
for i in 1 2 3 4; do
  REZ=$(agent-browser eval "(()=>{const sheet=document.querySelector('[role=dialog],[data-slot=sheet-content],.sheet-content'); const koren=sheet||document.body; const dig=koren.textContent.includes('Naročila, ki čakajo na dejanje'); const statusi=koren.textContent.match(/OSNUTEK \d+/); const meta=koren.textContent.includes('Pregled: Material'); const sveza=koren.textContent.includes('iz zadnjega nalaganja'); const alert=[...koren.querySelectorAll('[role=alert]')].map(e=>e.textContent.trim().slice(0,60)); return JSON.stringify({poskus:$i,digest:dig,statusVrstica:statusi?statusi[0]:null,metaPregled:meta,iskrenaSvezina:sveza,viriNapaka:alert,err:window.__err??null});})()" 2>&1 | tail -1)
  echo "$REZ"
  echo "$REZ" | rg -q 'statusVrstica":"OSNUTEK' && break
  sleep 3
done
agent-browser screenshot "$SS/qa-r212-e2e-zvoncek-digest.png" > /dev/null 2>&1

echo "--- Z3: F1 navigacija — klik na digest → Material V5 (more:'material') ---"
agent-browser eval "(()=>{const gumbi=[...document.querySelectorAll('button')].filter(b=>b.textContent.includes('Naročila, ki čakajo na dejanje')); const dig=gumbi.find(b=>b.textContent.includes('Pregled: Material')); if(dig){dig.click(); return 'klik';} return 'ni digesta';})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const mat=[...document.querySelectorAll('button,a,[role=tab]')].filter(b=>b.textContent.includes('Material')).map(b=>b.textContent.trim().slice(0,30)); const nalytics=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&(e.textContent.trim().startsWith('Osveženo ob'))).length; return JSON.stringify({url:location.pathname,materialVidno:mat.slice(0,4),pecatovNaStrani:nalytics,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z4: F1 fail-verbose — intercept 500 na /api/material-orders v zvončku ---"
agent-browser eval "(()=>{window.__origFetch=window.fetch; window.fetch=(u,...a)=>String(u).includes('/api/material-orders')?Promise.resolve(new Response(JSON.stringify({error:'R212 E2E izklop naročil'}),{status:500})):window.__origFetch(u,...a); return 'patched';})()" > /dev/null 2>&1
agent-browser eval "(()=>{const zv=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Obvestila')); if(zv){zv.click(); return 'klik';} return 'ni zvoncka';})()" > /dev/null 2>&1
sleep 6
for i in 1 2 3; do
  REZ=$(agent-browser eval "(()=>{const alert=[...document.querySelectorAll('[role=alert]')].find(e=>e.textContent.includes('niso bilo naloženi')); const vsebuje=alert?alert.textContent.includes('naročila'):false; const pečat=[...document.querySelectorAll('span')].filter(s=>s.textContent.trim().startsWith('Osveženo ob')).length; const retry=alert?!!alert.querySelector('button'):false; return JSON.stringify({poskus:$i,viriNapaka:!!alert,vsebujeNarocila:vsebuje,pečatVPanelu:pečat,retryGumb:retry,err:window.__err??null});})()" 2>&1 | tail -1)
  echo "$REZ"
  echo "$REZ" | rg -q 'vsebujeNarocila":true' && break
  sleep 3
done
agent-browser screenshot "$SS/qa-r212-e2e-zvoncek-napaka.png" > /dev/null 2>&1

echo "--- Z5: restore + čiščenje (PREKlicANO) → digest izgini ---"
agent-browser eval "(()=>{window.fetch=window.__origFetch; return 'restored';})()" > /dev/null 2>&1
agent-browser eval "(async()=>{const o=await (await window.__origFetch('/api/material-orders')).json(); const tmp=o.find(x=>x.opombe&&x.opombe.includes('_r212-zvoncek')); if(!tmp) return JSON.stringify({tmp:null}); const p=await window.__origFetch('/api/material-orders',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:tmp.id,status:'PREKlicANO'})}); return JSON.stringify({tmpId:tmp.id,patchStatus:p.status});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const zv=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Obvestila')); if(zv){zv.click(); return 'klik';} return 'ni zvoncka';})()" > /dev/null 2>&1
sleep 6
agent-browser eval "(()=>{const koren=document.body; const dig=koren.textContent.includes('Naročila, ki čakajo na dejanje'); const alert=[...koren.querySelectorAll('[role=alert]')].find(e=>e.textContent.includes('niso bilo naloženi')); return JSON.stringify({digestPoPreklicu:dig,viriNapakaPoRestore:!!alert,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z6: temna + health + odjava + port ---"
agent-browser eval "(()=>{const btn=document.querySelector('button[aria-label=\"Preklopi na temni način\"]')||[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').toLowerCase().includes('temn')); if(btn){btn.click(); return 'klik';} return 'ni ga';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const bg=getComputedStyle(document.body).backgroundColor; return JSON.stringify({temnaBg:bg,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r212-e2e-temna.png" > /dev/null 2>&1
agent-browser eval "(async()=>{const h=await fetch('/api/public/health'); return JSON.stringify({health:h.status,body:await h.json()});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const btn=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odjava')||b.textContent.trim()==='Odjava'); if(btn){btn.click(); return 'odjava';} return 'ni gumba';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{return JSON.stringify({url:location.pathname});})()" 2>&1 | tail -1
agent-browser close --all > /dev/null 2>&1 || true

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R212 E2E KONEC"
