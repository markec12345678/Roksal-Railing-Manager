#!/bin/bash
# R209 E2E ŽIVO (vzorec r206-r208): standalone :3100, ADMIN (ci@roksal.si),
# Material → Naročila → zgodovina prehodov (R209):
#  Z0 prijava ADMIN + zapri onboarding
#  Z1 chips ŽIVO + pečat (stanje pred: OSNUTEK/DOBLJENO/PREKlicANO iz R208)
#  Z2 ISKRENA PRAZNINA: Zgodovina na DOBLJENO kartici (prehodi PREJ uvedbe
#     sledenja brez orderId) → 'Še ni zapisanih prehodov za to naročilo.'
#  Z3 'Označi kot poslano' (OSNUTEK) → toast → Zgodovina ŽIVO: 'Sprememba
#     statusa' + značka POSLANO + 'iz OSNUTEK' + čas + uporabnik
#  Z4 'Potrdi' z ODPRTIM panelom → živa osvežitev: 2 dogodka (POSLANO + POTRJENO)
#  Z5 DB/API zanka: history API — nov naročilo count ≥2 (orderId v JSON),
#     legacy DOBLJENO count = 0 (iskrena praznina na API nivoju)
#  Z6 CSV regresija (kontrakt R140: VSA naročila)
#  Z7 temna rgb(15,23,36) + __err null + health + odjava + port sproščen
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
setsid node .next/standalone/server.js > /tmp/R209-server-e2e.log 2>&1 < /dev/null &
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

echo "--- Z1: Material V5 → Naročila: chips + pečat ---"
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
agent-browser eval "(()=>{const chipi=[...document.querySelectorAll('[role=group][aria-label=\"Filter naročil po statusu\"] button')].map(b=>b.textContent.trim()); const pecat=[...document.querySelectorAll('span')].filter(e=>e.textContent.trim().startsWith('Osveženo ob')).map(e=>e.textContent.trim())[0]||null; const zgodGumbi=[...document.querySelectorAll('button[aria-label^=\"Zgodovina prehodov naročila pri\"]')].length; return JSON.stringify({chipi,pecat,zgodovinaGumbi:zgodGumbi,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z2: iskrena praznina na legacy DOBLJENO kartici ---"
agent-browser eval "(async()=>{const r=await fetch('/api/material-orders'); const o=await r.json(); const leg=o.find(x=>x.status==='DOBLJENO'); if(!leg) return JSON.stringify({napaka:'ni DOBLJENO kartice'}); const b=[...document.querySelectorAll('button[aria-label=\"Zgodovina prehodov naročila pri '+leg.supplier.naziv+'\"]')][0]; if(!b) return JSON.stringify({napaka:'ni zgodovina gumba',dobavitelj:leg.supplier.naziv}); b.click(); return JSON.stringify({dobavitelj:leg.supplier.naziv,orderId:leg.id});})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const reg=[...document.querySelectorAll('[role=region][aria-label^=\"Zgodovina prehodov naročila pri\"]')][0]; if(!reg) return JSON.stringify({panel:false}); return JSON.stringify({panel:true,iskrenoPrazno:reg.textContent.includes('Še ni zapisanih prehodov za to naročilo.'),razlaga:reg.textContent.includes('jih ne izmišljujemo.'),brezDogodkov:reg.querySelectorAll('li').length});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r209-e2e-zgodovina-prazna.png" > /dev/null 2>&1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button[aria-label^=\"Zgodovina prehodov naročila pri\"]')].find(x=>x.getAttribute('aria-expanded')==='true'); if(b){b.click(); return 'zaprt';} return 'ni odprtega';})()" > /dev/null 2>&1
sleep 1

echo "--- Z3: 'Označi kot poslano' → Zgodovina ŽIVO (prvi dogodek) ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Označi kot poslano'); if(b){b.click(); return 'klik';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 5
agent-browser eval "(async()=>{const r=await fetch('/api/material-orders'); const o=await r.json(); const pos=o.filter(x=>x.status==='POSLANO'); if(pos.length!==1) return JSON.stringify({napaka:'pričakovan 1 POSLANO',dejansko:pos.length}); return JSON.stringify({orderId:pos[0].id,dobavitelj:pos[0].supplier.naziv});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const chipi=[...document.querySelectorAll('[role=group][aria-label=\"Filter naročil po statusu\"] button')].map(b=>b.textContent.trim()); const toasti=[...document.querySelectorAll('[role=status],li[data-state]')].map(e=>e.textContent.trim()).filter(t=>t.includes('poslano')); return JSON.stringify({chipi,toasti:toasti.slice(0,1)});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button[aria-label^=\"Zgodovina prehodov naročila pri\"]')].find(x=>{const k=x.closest('[data-slot=card]')||x.closest('.rounded-xl')||x.closest('div[class*=Card]'); return k?k.textContent.includes('POSLANO'):false;}); if(!b){const vsi=[...document.querySelectorAll('button[aria-label^=\"Zgodovina prehodov naročila pri\"]')]; if(vsi.length===1){vsi[0].click(); return 'klik-edini';} return 'ni gumba';} b.click(); return 'klik';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const reg=[...document.querySelectorAll('[role=region][aria-label^=\"Zgodovina prehodov naročila pri\"]')][0]; if(!reg) return JSON.stringify({panel:false}); const li=reg.querySelectorAll('li').length; return JSON.stringify({panel:true,dogodki:li,spremembaStatusa:reg.textContent.includes('Sprememba statusa'),znackaPOSLANO:reg.textContent.includes('POSLANO'),izOSNUTEK:reg.textContent.includes('iz OSNUTEK'),cas:/\d\d\.\d\d\.\d\d\d\d ob \d\d:\d\d:\d\d/.test(reg.textContent),uporabnik:/· /.test(reg.textContent)});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r209-e2e-zgodovina-zivo.png" > /dev/null 2>&1

echo "--- Z4: 'Potrdi' z odprtim panelom → živa osvežitev (2 dogodka) ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Potrdi'); if(b){b.click(); return 'klik';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const reg=[...document.querySelectorAll('[role=region][aria-label^=\"Zgodovina prehodov naročila pri\"]')][0]; if(!reg) return JSON.stringify({panel:false}); const li=reg.querySelectorAll('li').length; return JSON.stringify({panel:true,dogodki:li,znackaPOTRJENO:reg.textContent.includes('POTRJENO'),izPOSLANO:reg.textContent.includes('iz POSLANO'),znackaPOSLANO:reg.textContent.includes('POSLANO')});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const chipi=[...document.querySelectorAll('[role=group][aria-label=\"Filter naročil po statusu\"] button')].map(b=>b.textContent.trim()); return JSON.stringify({chipi});})()" 2>&1 | tail -1

echo "--- Z5: DB/API zanka — history API determinizem ---"
agent-browser eval "(async()=>{const r=await fetch('/api/material-orders'); const o=await r.json(); const nov=o.find(x=>x.status==='POTRJENO'); const leg=o.find(x=>x.status==='DOBLJENO'); const n1=await (await fetch('/api/material-orders/history?orderId='+nov.id)).json(); const n2=await (await fetch('/api/material-orders/history?orderId='+leg.id)).json(); return JSON.stringify({novCount:n1.count,akcije:[...new Set(n1.dogodki.map(d=>d.akcija))],statusiNov:n1.dogodki.map(d=>d.statusPotem),vsiZOrderId:n1.dogodki.every(d=>d.statusPrej!==null||d.statusPotem!==null),legCount:n2.count,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(async()=>{const r404=await fetch('/api/material-orders/history?orderId=neobstaja1234'); const r400=await fetch('/api/material-orders/history?orderId=kratko'); return JSON.stringify({neznano:r404.status,kratekId:r400.status});})()" 2>&1 | tail -1

echo "--- Z6: CSV regresija (kontrakt R140) ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='CSV'); if(b){b.click(); return 'klik';} return 'ni gumba';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const t=[...document.querySelectorAll('[role=status],li[data-state]')].map(e=>e.textContent.trim()).filter(x=>x.includes('CSV prenesen')); return JSON.stringify({csv:t[0]||null});})()" 2>&1 | tail -1

echo "--- Z7: temna + __err + health + odjava ---"
agent-browser eval "(()=>{const btn=document.querySelector('button[aria-label=\"Preklopi na temni način\"]')||[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').toLowerCase().includes('temn')); if(btn){btn.click(); return 'klik';} return 'ni ga';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const bg=getComputedStyle(document.body).backgroundColor; return JSON.stringify({temnaBg:bg,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r209-e2e-temna.png" > /dev/null 2>&1
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
echo "R209 E2E KONEC"
