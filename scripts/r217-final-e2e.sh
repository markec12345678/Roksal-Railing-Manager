#!/bin/bash
# R217 FINAL E2E ŽIVO (edinstveno ime — vzporedna seja ne ureja te datoteke).
#  Z0 prijava ADMIN (ci@roksal.si) → Hammer → app chrome
#  Z1a PORABA pod minimum (retry ob 409 — optimistični zaklep) + zdrav artikel
#  Z1b iskanje → Material zadetek z badgeom 'Nizka zaloga' + aria-label →
#      klik → Zaloga aktiven + Osnutek dialog ODPRT (isti artikel) → Prekliči
#  Z2 fail-closed: iskanje zdravega artikla → BREZ badgea/BREZ aria → klik →
#      Zaloga aktiven, osnutek dialog NI odprt
#  Z3 regresija R216/R215: skupina 'Nizka zaloga' klik → dialog ponovno
#  Z4 čiščenje + ostanki + temna + health + odjava + port sproščen
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
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R217-server-final.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

agent-browser close --all > /dev/null 2>&1 || true
sleep 1

echo "--- Z0: prijava ADMIN + app chrome ---"
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
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h){h.click(); return 'VizTab → app chrome';} return 'ni Hammer';})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{return JSON.stringify({url:location.pathname,navGumbi:document.querySelectorAll('nav button').length,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z1a: PORABA pod minimum (retry ob 409) + zdrav artikel ---"
agent-browser eval "(async()=>{const inv=await (await fetch('/api/inventory')).json(); const urejeno=[...inv].sort((a,b)=>(b.kolicinaZaloga-b.minimalnaZaloga)-(a.kolicinaZaloga-a.minimalnaZaloga)); let cilj=null; for(const kandidat of urejeno){ const raz=kandidat.kolicinaZaloga-kandidat.minimalnaZaloga; if(raz<=0) continue; const k=raz+1; const p=await fetch('/api/inventory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tipPremika:'PORABA',inventoryId:kandidat.id,kolicina:k})}); if(p.ok){ const tel=await p.json(); const zdrav=urejeno.find(x=>x.id!==kandidat.id&&(x.kolicinaZaloga-x.minimalnaZaloga)>0); window.__r217Restore={id:kandidat.id,k:k,naziv:kandidat.naziv,q:kandidat.naziv.slice(0,4)}; window.__r217Zdrav={naziv:zdrav?zdrav.naziv:'',q:zdrav?zdrav.naziv.slice(0,4):''}; return JSON.stringify({status:p.status,naziv:kandidat.naziv,zalogaPo:tel.inventory?tel.inventory.kolicinaZaloga:null,min:tel.inventory?tel.inventory.minimalnaZaloga:null,zdravQ:zdrav?zdrav.naziv.slice(0,4):null}); } await new Promise(r=>setTimeout(r,1500)); } return JSON.stringify({napaka:'noben kandidat ni uspel'});})()" 2>&1 | tail -1

echo "--- Z1b: iskanje → badge hit → klik → Zaloga + Osnutek dialog ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta';} return 'ni iskalnika';})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const inp=document.querySelector('[cmdk-input]'); if(!inp) return 'ni inputa'; const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; set.call(inp,window.__r217Restore.q); inp.dispatchEvent(new Event('input',{bubbles:true})); return 'vneseno: '+window.__r217Restore.q;})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const pal=document.querySelector('[cmdk-root]'); const hit=pal?[...pal.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes('Nizka zaloga')&&window.__r217Restore&&e.textContent.includes(window.__r217Restore.naziv)):null; return JSON.stringify({paletaOdprta:!!pal,badgeHit:!!hit,ariaLabel:hit?hit.getAttribute('aria-label'):null,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r217-final-iskanje-badge.png" > /dev/null 2>&1
agent-browser eval "(()=>{const pal=document.querySelector('[cmdk-root]'); const hit=pal?[...pal.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes('Nizka zaloga')&&window.__r217Restore&&e.textContent.includes(window.__r217Restore.naziv)):null; if(!hit) return 'ni zadetka z badgeom'; hit.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'klik iskalni zadetek (deep-link)';})()" 2>&1 | tail -1
sleep 7
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=dialog]')].find(d=>d.textContent.includes('Naročilnica kot osnutek naročila')); const pal=document.querySelector('[cmdk-root]'); const cur=document.querySelector('nav button[aria-current=\"page\"]'); return JSON.stringify({osnutekDialogOdprt:!!dlg,istiArtikel:dlg&&window.__r217Restore?dlg.textContent.includes(window.__r217Restore.naziv):false,paletaZaprta:!pal,aktivniTab:cur?cur.textContent.trim():null,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r217-final-osnutek-dialog.png" > /dev/null 2>&1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[role=dialog] button')].find(x=>x.textContent.trim()==='Prekliči'); if(b){b.click(); return 'Prekliči (brez zapisa)';} return 'ni';})()" > /dev/null 2>&1
sleep 2

echo "--- Z2: fail-closed ŽIVO — zdrav artikel: brez badgea, navadna navigacija ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta';} return 'ni';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const inp=document.querySelector('[cmdk-input]'); if(!inp) return 'ni inputa'; const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; set.call(inp,window.__r217Zdrav.q); inp.dispatchEvent(new Event('input',{bubbles:true})); return 'vneseno: '+window.__r217Zdrav.q;})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const pal=document.querySelector('[cmdk-root]'); const hit=pal?[...pal.querySelectorAll('[cmdk-item]')].find(e=>window.__r217Zdrav&&e.textContent.includes(window.__r217Zdrav.naziv)):null; return JSON.stringify({hitNajden:!!hit,badgeOdsoten:hit?!hit.textContent.includes('Nizka zaloga'):null,ariaOdsota:hit?(hit.getAttribute('aria-label')===null):null,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const pal=document.querySelector('[cmdk-root]'); const hit=pal?[...pal.querySelectorAll('[cmdk-item]')].find(e=>window.__r217Zdrav&&e.textContent.includes(window.__r217Zdrav.naziv)):null; if(!hit) return 'ni zdravega zadetka'; hit.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'klik zdrav zadetek';})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=dialog]')].find(d=>d.textContent.includes('Naročilnica kot osnutek naročila')); const cur=document.querySelector('nav button[aria-current=\"page\"]'); return JSON.stringify({osnutekDialogOdprt:!!dlg,aktivniTab:cur?cur.textContent.trim():null,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z3: regresija R216/R215 — skupina 'Nizka zaloga' klik → dialog ponovno ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta';} return 'ni';})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const it=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes('· minimum')&&e.textContent.includes('Zaloga ')); if(!it) return 'ni vnosa nizke zaloge'; it.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'klik skupina';})()" 2>&1 | tail -1
sleep 7
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=dialog]')].find(d=>d.textContent.includes('Naročilnica kot osnutek naročila')); const cur=document.querySelector('nav button[aria-current=\"page\"]'); return JSON.stringify({osnutekDialogOdprt:!!dlg,istiArtikel:dlg&&window.__r217Restore?dlg.textContent.includes(window.__r217Restore.naziv):false,aktivniTab:cur?cur.textContent.trim():null,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[role=dialog] button')].find(x=>x.textContent.trim()==='Prekliči'); if(b){b.click(); return 'Prekliči';} return 'ni';})()" > /dev/null 2>&1
sleep 2

echo "--- Z4: čiščenje + ostanki + temna + health + odjava + port ---"
agent-browser eval "(async()=>{const r=window.__r217Restore; if(!r) return JSON.stringify({povratek:'ni podatka'}); const p=await fetch('/api/inventory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tipPremika:'DOPOLNITEV',inventoryId:r.id,kolicina:r.k})}); const tel=await p.json(); return JSON.stringify({povratek:p.status,naziv:r.naziv,zalogaPo:tel.inventory?tel.inventory.kolicinaZaloga:null});})()" 2>&1 | tail -1
agent-browser eval "(async()=>{const vsi=await (await fetch('/api/material-orders')).json(); return JSON.stringify({skupaj:(vsi||[]).length,testniAktivniOstanki:(vsi||[]).filter(o=>(o.status==='OSNUTEK'||o.status==='POSLANO')&&(o.opombe||'').includes('E2E')).length});})()" 2>&1 | tail -1
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
echo "--- R217 FINAL E2E KONEC ---"
