#!/bin/bash
# R211 E2E ŽIVO (vzorec r206-r210): standalone :3100, ADMIN (ci@roksal.si).
#  Z0 prijava ADMIN + zapri onboarding
#  Z1 F2 priprava: POST /api/material-orders (OSNUTEK) prek seje
#  Z2 F2 ŽIVO: Domov kartica 'Naročila, ki čakajo na dejanje' + NOV pečat
#     'Osveženo ob HH:MM:SS' (R171 vzorec) + tabular značka
#  Z3 F1 happy pot: projekt-detail → meritve panel (števec ALI iskreno
#     'Ni meritev za ta projekt' — NI napake)
#  Z4 F1 meritve fail-verbose ŽIVO: fetch intercept → 500 na
#     /api/measurements? → role=alert 'Meritev ni bilo mogoče naložiti' +
#     'Napaka strežnika (500).' + značka '!' + Poskusi znova (retry ostane
#     pri napaki — vir še vedno padca)
#  Z5 F1 portal fail-verbose ŽIVO: fetch intercept → 500 na /api/portal? →
#     role=alert 'Portala ni bilo mogoče naložiti' + značka 'Napaka' +
#     'Omogoči portal stranke' gumb SKRIT (fail-closed UI) + 'Stanja ne
#     izmišljujemo'
#  Z6 čiščenje: fetch restore → PATCH naročila PREKlicANO (končno stanje —
#     deterministična osnova) + __err null
#  Z7 temna rgb(15,23,36) + health + odjava + port sproščen
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
setsid node .next/standalone/server.js > /tmp/R211-server-e2e.log 2>&1 < /dev/null &
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

echo "--- Z1: F2 priprava — POST OSNUTEK naročilo prek seje ---"
agent-browser eval "(async()=>{const sup=await (await fetch('/api/suppliers')).json(); const inv=await (await fetch('/api/inventory')).json(); if(!sup.length||!inv.length) return JSON.stringify({napaka:'ni dobavitelja/zaloge'}); const post=await fetch('/api/material-orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({supplierId:sup[0].id,items:[{inventoryId:inv[0].id,kolicina:1}],opombe:'R211 E2E — pečat svežine (_r211-pecat)'})}); const tel=await post.json(); return JSON.stringify({status:post.status,id:tel.id,statusN:tel.status});})()" 2>&1 | tail -1

echo "--- Z2: F2 ŽIVO — Domov kartica + pečat 'Osveženo ob HH:MM:SS' ---"
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'dashboard'}})); return 'poslano';})()" > /dev/null 2>&1
sleep 7
for i in 1 2 3 4; do
  REZ=$(agent-browser eval "(()=>{const kartice=[...document.querySelectorAll('div')].filter(e=>e.textContent.includes('Naročila, ki čakajo na dejanje')&&e.textContent.includes('iz zadnjega nalaganja')); const pecat=[...document.querySelectorAll('p')].find(p=>p.textContent.includes('Osveženo ob')&&p.textContent.includes('naročil')); const znacka=[...document.querySelectorAll('span')].find(s=>s.title&&(s.title.includes('Aktivna naročila'))); return JSON.stringify({poskus:$i,kartica:kartice.length>0,pecat:pecat?pecat.textContent.trim().slice(0,60):null,tabular:pecat?pecat.className.includes('tabular-nums'):false,stevec:znacka?znacka.textContent.trim():null,err:window.__err??null});})()" 2>&1 | tail -1)
  echo "$REZ"
  echo "$REZ" | rg -q 'pecat":"Osveženo' && break
  sleep 3
done
agent-browser screenshot "$SS/qa-r211-e2e-domov-pecat.png" > /dev/null 2>&1

echo "--- Z3: F1 happy pot — projekt-detail meritve (brez napake) ---"
agent-browser eval "(()=>{const vrsta=[...document.querySelectorAll('div')].find(e=>e.className&&String(e.className).includes('cursor-pointer')&&String(e.className).includes('card-hover')); if(vrsta){vrsta.click(); return 'klik';} return 'ni vrst';})()" 2>&1 | tail -1
sleep 5
agent-browser eval "(()=>{const raz=[...document.querySelectorAll('div')].find(e=>e.textContent.trim().startsWith('Meritve tega projekta')); if(raz){raz.click(); return 'razprto';} return 'ni ga';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const dialog=document.querySelector('[role=dialog]'); const besedilo=dialog?dialog.textContent:''; const alerti=[...dialog?dialog.querySelectorAll('[role=alert]'):[]].map(e=>e.textContent.trim().slice(0,50)); const prazno=besedilo.includes('Ni meritev za ta projekt'); const pecatMer=[...dialog?dialog.querySelectorAll('span'):[]].filter(s=>s.textContent.trim().startsWith('Osveženo ob')).length; return JSON.stringify({dialogOdprt:!!dialog,meritveniAlerti:alerti,iskrenoPrazno:prazno,projektPecati:pecatMer,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z4: F1 meritve fail-verbose ŽIVO (intercept 500) ---"
agent-browser eval "(()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return 'esc';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{window.__origFetch=window.fetch; window.fetch=(u,...a)=>String(u).includes('/api/measurements?')?Promise.resolve(new Response(JSON.stringify({error:'R211 E2E izklop meritvenega vira'}),{status:500})):window.__origFetch(u,...a); return 'patched';})()" > /dev/null 2>&1
agent-browser eval "(()=>{const vrsta=[...document.querySelectorAll('div')].find(e=>e.className&&String(e.className).includes('cursor-pointer')&&String(e.className).includes('card-hover')); if(vrsta){vrsta.click(); return 'klik';} return 'ni vrst';})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const raz=[...document.querySelectorAll('[role=dialog] div')].find(e=>e.textContent.trim().startsWith('Meritve tega projekta')); if(raz){raz.click(); return 'razprto';} return 'ni ga';})()" > /dev/null 2>&1
sleep 2
for i in 1 2 3; do
  REZ=$(agent-browser eval "(()=>{const dialog=document.querySelector('[role=dialog]'); if(!dialog) return JSON.stringify({poskus:$i,dialogOdprt:false}); const alert=[...dialog.querySelectorAll('[role=alert]')].find(e=>e.textContent.includes('Meritev ni bilo mogoče naložiti')); const znacka=[...dialog.querySelectorAll('span')].find(s=>s.textContent.trim()==='!'); const retry=[...dialog.querySelectorAll('button')].find(b=>b.textContent.trim()==='Poskusi znova'); return JSON.stringify({poskus:$i,alert:alert?alert.textContent.trim().slice(0,90):null,zmackaVzklic:!!znacka,retryGumb:!!retry,razlog:alert?alert.textContent.includes('Napaka strežnika (500).'):false,err:window.__err??null});})()" 2>&1 | tail -1)
  echo "$REZ"
  echo "$REZ" | rg -q 'razlog":true' && break
  sleep 3
done
echo "--- Z4b: Poskusi znova klik — vir še vedno pade → alert ostane (retry ŽIVO povezan) ---"
agent-browser eval "(()=>{const retry=[...document.querySelectorAll('[role=dialog] button')].find(b=>b.textContent.trim()==='Poskusi znova'); if(retry){retry.click(); return 'klik';} return 'ni ga';})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const dialog=document.querySelector('[role=dialog]'); const alert=[...dialog?dialog.querySelectorAll('[role=alert]'):[]].find(e=>e.textContent.includes('Meritev ni bilo mogoče naložiti')); return JSON.stringify({alertPoRetry:!!alert,razlog:alert?alert.textContent.includes('R211 E2E izklop meritvenega vira'):false,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r211-e2e-meritve-alert.png" > /dev/null 2>&1

echo "--- Z5: F1 portal fail-verbose ŽIVO (intercept 500 na /api/portal?) ---"
agent-browser eval "(()=>{window.fetch=(u,...a)=>String(u).includes('/api/portal?')?Promise.resolve(new Response(JSON.stringify({error:'R211 E2E izklop portala'}),{status:500})):window.__origFetch(u,...a); return 'patched-portal';})()" > /dev/null 2>&1
agent-browser eval "(()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return 'esc';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const vrsta=[...document.querySelectorAll('div')].find(e=>e.className&&String(e.className).includes('cursor-pointer')&&String(e.className).includes('card-hover')); if(vrsta){vrsta.click(); return 'klik';} return 'ni vrst';})()" > /dev/null 2>&1
sleep 5
for i in 1 2 3; do
  REZ=$(agent-browser eval "(()=>{const dialog=document.querySelector('[role=dialog]'); if(!dialog) return JSON.stringify({poskus:$i,dialogOdprt:false}); const alert=[...dialog.querySelectorAll('[role=alert]')].find(e=>e.textContent.includes('Portala ni bilo mogoče naložiti')); const omogoci=[...dialog.querySelectorAll('button')].filter(b=>b.textContent.includes('Omogoči portal stranke')).length; const znacka=[...dialog.querySelectorAll('span')].find(s=>s.textContent.trim()==='Napaka'); const iskreno=[...dialog.querySelectorAll('p')].some(p=>p.textContent.includes('Stanja ne izmišljujemo')); const merilna=[...dialog.querySelectorAll('[role=alert]')].find(e=>e.textContent.includes('Merilne povezave ni bilo mogoče naložiti')); return JSON.stringify({poskus:$i,alert:!!alert,znackaNapaka:!!znacka,omogociGumbi:omogoci,iskrenoPojasnilo:iskreno,merilnaAlert:!!merilna,err:window.__err??null});})()" 2>&1 | tail -1)
  echo "$REZ"
  echo "$REZ" | rg -q 'iskrenoPojasnilo":true' && break
  sleep 3
done
agent-browser screenshot "$SS/qa-r211-e2e-portal-alert.png" > /dev/null 2>&1

echo "--- Z6: čiščenje — fetch restore + PATCH PREKlicANO + __err ---"
agent-browser eval "(()=>{window.fetch=window.__origFetch; return 'restored';})()" > /dev/null 2>&1
agent-browser eval "(async()=>{const o=await (await fetch('/api/material-orders')).json(); const tmp=o.find(x=>x.opombe&&x.opombe.includes('_r211-pecat')); if(!tmp) return JSON.stringify({tmp:null}); const p=await fetch('/api/material-orders',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:tmp.id,status:'PREKlicANO'})}); return JSON.stringify({tmpId:tmp.id,patchStatus:p.status});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return 'esc';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const kartice=[...document.querySelectorAll('div')].filter(e=>e.textContent.includes('Naročila, ki čakajo na dejanje')&&e.textContent.includes('iz zadnjega nalaganja')); const aktivna=[...document.querySelectorAll('span')].find(s=>s.title&&s.title.includes('Aktivna naročila')); return JSON.stringify({karticaPoPreklicu:kartice.length>0,stevecPoPreklicu:aktivna?aktivna.textContent.trim():'skrit',err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z7: temna + health + odjava + port ---"
agent-browser eval "(()=>{const btn=document.querySelector('button[aria-label=\"Preklopi na temni način\"]')||[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').toLowerCase().includes('temn')); if(btn){btn.click(); return 'klik';} return 'ni ga';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const bg=getComputedStyle(document.body).backgroundColor; return JSON.stringify({temnaBg:bg,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r211-e2e-temna.png" > /dev/null 2>&1
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
echo "R211 E2E KONEC"
