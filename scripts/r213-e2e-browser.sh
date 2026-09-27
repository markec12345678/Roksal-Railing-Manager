#!/bin/bash
# R213 E2E ŽIVO (vzorec r206-r212): standalone :3100, ADMIN (ci@roksal.si).
#  Z0 prijava ADMIN + zapri onboarding
#  Z1 priprava: POST OSNUTEK naročilo prek seje (digest: OSNUTEK 2 · POTRJENO 1)
#  Z2 F1 ŽIVO KLJUČNI DOKAZ: klik digest → Material **Naročila podzavihek
#     AKTIVEN** (aria-pressed=true; prej R212 je pristal na BOM Refine)
#  Z3 F1 monotonski n: Dobavitelji → zvonček → klik digest ŠE ENKRAT →
#     Naročila spet aktiven (preklop na ŽE montirani komponenti)
#  Z4 F3 ŽIVO (dirka-pot): chip OSNUTEK → PATCH osnovnega OSNUTEK→POTRJENO +
#     tmp→POSLANO → refetch (BOM↔Naročila) → chip OSNUTEK izgine, filter
#     zastari → iskreno prazno + gumb 'Prikaži Vse' → klik → Vsi aktiven
#  Z5 F2 helper ŽIVO: $(node tools/e2e-fetch-intercept.js patch …) → zvonček
#     fail-verbose ('naročila' vir, brez pečata) → restore → Poskusi znova OK
#  Z6 čiščenje (tmp→PREKlicANO) + temna + __err null + health + odjava + port
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
# R213 lekcija: standalone mora imeti statične chunkse (uradni korak Next.js
# standalone deploy) — brez njih vse JS 404 → /login se NE montira (tiho).
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
setsid node .next/standalone/server.js > /tmp/R213-server-e2e.log 2>&1 < /dev/null &
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

echo "--- Z0b: čiščenje ostankov po prejšnjih tekih (deterministična osnova) ---"
agent-browser eval "(async()=>{const vsi=await (await fetch('/api/material-orders')).json(); const ostanki=(vsi||[]).filter(o=>(o.opombe||'').includes('_r213-subtab')&&o.status!=='PREKlicANO'); const rez=[]; for(const o of ostanki){const p=await fetch('/api/material-orders',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:o.id,status:'PREKlicANO'})}); rez.push(o.id+':'+p.status);} return JSON.stringify({pocisceno:rez.length,detajl:rez});})()" 2>&1 | tail -1

echo "--- Z1: priprava — POST OSNUTEK naročilo prek seje ---"
agent-browser eval "(async()=>{const sup=await (await fetch('/api/suppliers')).json(); const inv=await (await fetch('/api/inventory')).json(); if(!sup.length||!inv.length) return JSON.stringify({napaka:'ni dobavitelja/zaloge'}); const post=await fetch('/api/material-orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({supplierId:sup[0].id,items:[{inventoryId:inv[0].id,kolicina:1}],opombe:'R213 E2E — subtab navigacija (_r213-subtab)'})}); const tel=await post.json(); return JSON.stringify({status:post.status,id:tel.id,statusN:tel.status});})()" 2>&1 | tail -1

echo "--- Z2: F1 ŽIVO — klik digest → Material NAROČILA podzavihek AKTIVEN ---"
agent-browser eval "(()=>{const zv=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Obvestila')); if(zv){zv.click(); return 'klik:'+(zv.getAttribute('aria-label')||'');} return 'ni zvoncka';})()" 2>&1 | tail -1
sleep 6
for i in 1 2 3 4; do
  REZ=$(agent-browser eval "(()=>{const sheet=document.querySelector('[role=dialog]'); const koren=sheet||document.body; const dig=koren.textContent.includes('Naročila, ki čakajo na dejanje'); const statusi=koren.textContent.match(/OSNUTEK \d+ · POTRJENO \d+/); return JSON.stringify({poskus:$i,digest:dig,statusVrstica:statusi?statusi[0]:null,err:window.__err??null});})()" 2>&1 | tail -1)
  echo "$REZ"
  echo "$REZ" | rg -q 'statusVrstica":"OSNUTEK' && break
  sleep 3
done
agent-browser screenshot "$SS/qa-r213-e2e-zvoncek-digest.png" > /dev/null 2>&1
agent-browser eval "(()=>{const gumbi=[...document.querySelectorAll('button')].filter(b=>b.textContent.includes('Naročila, ki čakajo na dejanje')); const dig=gumbi.find(b=>b.textContent.includes('Pregled: Material')); if(dig){dig.click(); return 'klik digesta';} return 'ni digesta';})()" 2>&1 | tail -1
sleep 7
agent-browser eval "(()=>{const prek=[...document.querySelectorAll('button[aria-pressed]')].filter(b=>b.textContent.trim().startsWith('Naročila')); const bom=[...document.querySelectorAll('button[aria-pressed]')].filter(b=>b.textContent.trim().startsWith('BOM Refine')); return JSON.stringify({narocilaPritisnjeno:prek.length?prek[0].getAttribute('aria-pressed'):null, bomPritisnjeno:bom.length?bom[0].getAttribute('aria-pressed'):null, url:location.pathname, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r213-e2e-narocila-subtab.png" > /dev/null 2>&1

echo "--- Z3: monotonski n — Dobavitelji → zvonček → digest ŠE ENKRAT → Naročila ---"
agent-browser eval "(()=>{const d=[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.trim().startsWith('Dobavitelji')); if(d){d.click(); return 'klik Dobavitelji';} return 'ni ga';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const d=[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.trim().startsWith('Dobavitelji')); return JSON.stringify({dobaviteljiPritisnjeno:d?d.getAttribute('aria-pressed'):null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const zv=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Obvestila')); if(zv){zv.click(); return 'klik';} return 'ni zvoncka';})()" 2>&1 | tail -1
sleep 5
agent-browser eval "(()=>{const gumbi=[...document.querySelectorAll('button')].filter(b=>b.textContent.includes('Naročila, ki čakajo na dejanje')); const dig=gumbi.find(b=>b.textContent.includes('Pregled: Material')); if(dig){dig.click(); return 'klik digesta (2.č)';} return 'ni digesta';})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const prek=[...document.querySelectorAll('button[aria-pressed]')].filter(b=>b.textContent.trim().startsWith('Naročila')); const d=[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.trim().startsWith('Dobavitelji')); return JSON.stringify({narocilaPritisnjeno2:prek.length?prek[0].getAttribute('aria-pressed'):null, dobaviteljiSe: d?d.getAttribute('aria-pressed'):null, err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z4: F3 dirka-pot — zastarel filter OSNUTEK → iskreno prazno + 'Prikaži Vse' ---"
agent-browser eval "(async()=>{const sup=await (await fetch('/api/suppliers')).json(); const inv=await (await fetch('/api/inventory')).json(); const post=await fetch('/api/material-orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({supplierId:sup[0].id,items:[{inventoryId:inv[0].id,kolicina:1}],opombe:'R213 E2E — dirka-pot filter (_r213-subtab)'})}); return JSON.stringify({tmp2:post.status});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const bom=[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.trim().startsWith('BOM Refine')); if(bom){bom.click(); return 'BOM';} return 'ni';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const n=[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.trim().startsWith('Naročila')); if(n){n.click(); return 'Naročila (refetch 1)';} return 'ni';})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const chip=[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.trim().startsWith('OSNUTEK (')); if(chip){chip.click(); return 'klik chip OSNUTEK:'+(chip.textContent||'').trim();} return 'ni chipa';})()" 2>&1 | tail -1
sleep 1
agent-browser eval "(async()=>{const vsi=await (await fetch('/api/material-orders')).json(); const osnutki=(vsi||[]).filter(o=>o.status==='OSNUTEK'&&(o.opombe||'').includes('_r213-subtab')); if(osnutki.length<2) return JSON.stringify({napaka:'manjka 2 tmp OSNUTEK',osnutki:osnutki.length}); const rez=[]; for(const o of osnutki){const p=await fetch('/api/material-orders',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:o.id,status:'POSLANO'})}); rez.push(p.status);} return JSON.stringify({tmpPrehodi:rez});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const bom=[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.trim().startsWith('BOM Refine')); if(bom){bom.click(); return 'BOM';} return 'ni';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const n=[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.trim().startsWith('Naročila')); if(n){n.click(); return 'Naročila (refetch 2)';} return 'ni';})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const koren=document.body; const prazno=koren.textContent.includes('Ni naročil s statusom OSNUTEK.'); const gumb=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Prikaži Vse'); const chipOsnutek=[...document.querySelectorAll('button[aria-pressed]')].some(b=>b.textContent.trim().startsWith('OSNUTEK (')); return JSON.stringify({iskrenoPrazno:prazno, prikaziVseGumb:!!gumb, chipOsnutekSe:chipOsnutek, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Prikaži Vse'); if(g){g.click(); return 'klik Prikaži Vse';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const vsi=[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.trim().startsWith('Vsi (')); const kartice=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Zgodovina').length; return JSON.stringify({vsiAktiven:vsi?vsi.getAttribute('aria-pressed'):null, zgodovinaGumbi:kartice, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r213-e2e-prikazi-vse.png" > /dev/null 2>&1

echo "--- Z5: F2 helper ŽIVO — fetch intercept 500 naročil → fail-verbose zvončka ---"
agent-browser eval "$(node tools/e2e-fetch-intercept.js patch '/api/material-orders' 500 'R213 E2E izklop naročil')" 2>&1 | tail -1
agent-browser eval "(()=>{const zv=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Obvestila')); if(zv){zv.click(); return 'klik';} return 'ni zvoncka';})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const sheet=document.querySelector('[role=dialog]'); const koren=sheet||document.body; const alerti=[...koren.querySelectorAll('[role=alert]')].map(e=>e.textContent.trim().slice(0,90)); const pecat=koren.textContent.includes('Osveženo ob'); return JSON.stringify({viriNapaka:alerti, lazenPecatVSheetu:pecat, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "$(node tools/e2e-fetch-intercept.js restore)" 2>&1 | tail -1
agent-browser eval "(()=>{const r=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Poskusi znova'); if(r){r.click(); return 'klik retry';} return 'ni retry';})()" 2>&1 | tail -1
sleep 5
agent-browser eval "(()=>{const sheet=document.querySelector('[role=dialog]'); const koren=sheet||document.body; const alerti=[...koren.querySelectorAll('[role=alert]')].map(e=>e.textContent.trim().slice(0,60)); const pecat=koren.textContent.includes('Osveženo ob'); const digest=koren.textContent.includes('Naročila, ki čakajo na dejanje'); return JSON.stringify({alertiPoRetry:alerti, pecatVSheetu:pecat, digestSeViden:digest, err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z6: čiščenje + temna + health + odjava ---"
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').toLowerCase().includes('zapri')); if(g){g.click(); return 'zaprt sheet';} return 'ni';})()" > /dev/null 2>&1
sleep 1
agent-browser eval "(async()=>{const vsi=await (await fetch('/api/material-orders')).json(); const ostanki=(vsi||[]).filter(o=>(o.opombe||'').includes('_r213-subtab')&&o.status!=='PREKlicANO'); const rez=[]; for(const o of ostanki){const p=await fetch('/api/material-orders',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:o.id,status:'PREKlicANO'})}); rez.push(p.status);} return JSON.stringify({pocisceno:rez.length,rez:rez});})()" 2>&1 | tail -1
agent-browser eval "(async()=>{const vsi=await (await fetch('/api/material-orders')).json(); const s={}; for(const o of (vsi||[])) s[o.status]=(s[o.status]||0)+1; const aktivniOstanki=(vsi||[]).filter(o=>(o.opombe||'').includes('_r213-subtab')&&o.status!=='PREKlicANO').length; return JSON.stringify({skupaj:(vsi||[]).length,statusi:s,aktivniR213Ostanki:aktivniOstanki});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const btn=document.querySelector('button[aria-label=\"Preklopi na temni način\"]')||[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').toLowerCase().includes('temn')); if(btn){btn.click(); return 'klik';} return 'ni ga';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const bg=getComputedStyle(document.body).backgroundColor; return JSON.stringify({temnaBg:bg,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const btn=document.querySelector('button[aria-label=\"Preklopi na svetli način\"]')||[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').toLowerCase().includes('svetl')); if(btn){btn.click(); return 'klik';} return 'ni ga';})()" > /dev/null 2>&1
sleep 2
curl -s --max-time 10 "http://127.0.0.1:3100/api/public/health"; echo
agent-browser eval "(()=>{const o=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Odjava')); if(o){o.click(); return 'odjava';} return 'ni gumba';})()" > /dev/null 2>&1
sleep 2
agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "--- R213 E2E KONEC ---"
