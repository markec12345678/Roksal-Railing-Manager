#!/bin/bash
# R210 E2E ŽIVO (vzorec r206-r209): standalone :3100, ADMIN (ci@roksal.si).
#  Z0 prijava ADMIN + zapri onboarding
#  Z1 F2: Domov kartica 'Naročila, ki čakajo na dejanje' ŽIVO — števec '1'
#     (POTRJENO iz R209 je edino aktivno) + iskrena svežina + tabular značka
#  Z2 F1 API ZANKA: POST /api/material-orders BREZ projectId → 201;
#     history?orderId → count ≥1, akcija MATERIAL_ORDER_CREATED ('Ustvarjeno')
#     ← DOKAZ: prej bi bila sled prazna ( CREATED audit je obstajal LE z
#     projectId), zdaj 'Ustvarjeno' na kartici TUDI za naročila brez projekta
#  Z3 Material → Naročila: chips ŽIVO 'Vsi (4)' + nov OSNUTEK (1)
#  Z4 Domov ponovno: kartica števec '2' (POTRJENO + nov OSNUTEK — izpeljanka
#     iz realnih naročil, EN vir resnice)
#  Z5 regresije: legacy DOBLJENO history count = 0 (iskrena vrzel prej uvedbe),
#     404/400 kontrakt, CSV kontrakt R140
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
setsid node .next/standalone/server.js > /tmp/R210-server-e2e.log 2>&1 < /dev/null &
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

echo "--- Z1: F2 Domov kartica 'Naročila, ki čakajo na dejanje' (pričakovano 1 = POTRJENO) ---"
# Lekcija diagnoze: '/' je privzeto tab 'viz' (S+5 product-first); DashboardTab
# je dosežen prek centralne navigacije (Hammer/FAB) = dogodek 'roksal:navigate'
# {tab:'dashboard'} — tekstovni gumb 'Domov' na viz pogledu NE obstaja.
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'dashboard'}})); return 'poslano';})()" 2>&1 | tail -1
sleep 6
for i in 1 2 3 4; do
  REZ=$(agent-browser eval "(()=>{const kartice=[...document.querySelectorAll('div')].filter(e=>e.childElementCount>0&&e.textContent.includes('Naročila, ki čakajo na dejanje')&&e.textContent.includes('iz zadnjega nalaganja')); const znacka=[...document.querySelectorAll('span')].find(s=>s.title&&(s.title.includes('Aktivna naročila'))); return JSON.stringify({poskus:$i,kartica:kartice.length>0,iscrnaSvezina:kartice.length>0?kartice[0].textContent.includes('iz zadnjega nalaganja'):false,pregledPot:kartice.length>0?kartice[0].textContent.includes('Pregled: Material'):false,stevec:znacka?znacka.textContent.trim():null,tabular:znacka?znacka.className.includes('tabular-nums'):false,err:window.__err??null});})()" 2>&1 | tail -1)
  echo "$REZ"
  echo "$REZ" | rg -q 'stevec":"[0-9]' && break
  sleep 3
done
agent-browser screenshot "$SS/qa-r210-e2e-domov-kartica.png" > /dev/null 2>&1

echo "--- Z2: F1 API ZANKA — POST BREZ projectId → CREATED audit v sledi ---"
agent-browser eval "(async()=>{const sup=await (await fetch('/api/suppliers')).json(); const inv=await (await fetch('/api/inventory')).json(); if(!sup.length||!inv.length) return JSON.stringify({napaka:'ni dobavitelja ali zaloge v lokalni bazi'}); const post=await fetch('/api/material-orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({supplierId:sup[0].id,items:[{inventoryId:inv[0].id,kolicina:1}],opombe:'R210 E2E — naročilo brez projekta (_created-audit)'})}); const tel=await post.json(); if(post.status!==201) return JSON.stringify({napaka:'POST ni 201',status:post.status,tel}); const hist=await (await fetch('/api/material-orders/history?orderId='+tel.id)).json(); return JSON.stringify({postId:post.status,orderId:tel.id,projectIdVOdgovoru:tel.projectId,histCount:hist.count,akcije:hist.dogodki.map(d=>d.akcija),prviUstvarjeno:hist.dogodki.length>0&&hist.dogodki[0].akcija==='MATERIAL_ORDER_CREATED',err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z3: Material → Naročila: chips ŽIVO (pričakovano Vsi (4) + OSNUTEK (1)) ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Material V5')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
for i in 1 2; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 1
done
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Naročila')&&x.querySelector('svg')); if(t){t.click(); return 'klik';} return 'ni zavihka';})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const chipi=[...document.querySelectorAll('[role=group][aria-label=\"Filter naročil po statusu\"] button')].map(b=>b.textContent.trim()); const opombe=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.includes('R210 E2E')).length; return JSON.stringify({chipi,karticaR210E2E:opombe>0,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r210-e2e-narocila-chips.png" > /dev/null 2>&1

echo "--- Z4: Domov ponovno — kartica števec '2' (POTRJENO + nov OSNUTEK) ---"
agent-browser eval "(()=>{const d=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Domov')); if(d){d.click(); return 'klik';} return 'ni Domov';})()" > /dev/null 2>&1
sleep 6
agent-browser eval "(()=>{const znacka=[...document.querySelectorAll('span')].find(s=>s.title&&s.title.includes('Aktivna naročila')); const kartica=[...document.querySelectorAll('div')].filter(e=>e.textContent.includes('Naročila, ki čakajo na dejanje')&&e.textContent.includes('iz zadnjega nalaganja')).length; return JSON.stringify({kartica:kartica>0,stevec:znacka?znacka.textContent.trim():null,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z5a: regresije — legacy iskrena vrzel + 404/400 kontrakt ---"
agent-browser eval "(async()=>{const o=await (await fetch('/api/material-orders')).json(); const leg=o.find(x=>x.status==='DOBLJENO'); const h=await (await fetch('/api/material-orders/history?orderId='+leg.id)).json(); const r404=await fetch('/api/material-orders/history?orderId=neobstaja1234'); const r400=await fetch('/api/material-orders/history?orderId=kratko'); return JSON.stringify({legCount:h.count,neznano:r404.status,kratekId:r400.status});})()" 2>&1 | tail -1

echo "--- Z5b: CSV regresija (kontrakt R140) — nazaj v Material → Naročila ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Material V5')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 6
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Naročila')&&x.querySelector('svg')); if(t){t.click(); return 'klik';} return 'ni zavihka';})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='CSV'); if(b){b.click(); return 'klik';} return 'ni gumba';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const t=[...document.querySelectorAll('[role=status],li[data-state]')].map(e=>e.textContent.trim()).filter(x=>x.includes('CSV prenesen')); return JSON.stringify({csv:t[0]||null});})()" 2>&1 | tail -1

echo "--- Z6: temna + __err + health + odjava + port ---"
agent-browser eval "(()=>{const btn=document.querySelector('button[aria-label=\"Preklopi na temni način\"]')||[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').toLowerCase().includes('temn')); if(btn){btn.click(); return 'klik';} return 'ni ga';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const bg=getComputedStyle(document.body).backgroundColor; return JSON.stringify({temnaBg:bg,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r210-e2e-temna.png" > /dev/null 2>&1
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
echo "R210 E2E KONEC"
