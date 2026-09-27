#!/bin/bash
# R216 E2E ŽIVO (vzorec r206-r215): standalone :3100, ADMIN (ci@roksal.si).
#  Z0 prijava ADMIN → Hammer → app chrome
#  Z1a PORABA pod minimum (deterministična priprava, __r216Restore)
#  Z1b F1 ŽIVO (P1-d): paleta ⌘K → 'Nizka zaloga' → klik artikel →
#      **Zaloga + Osnutek dialog ODPRT z TOČNO TIM artikelom** (deep-link!)
#      → Prekliči (BREZ DB zapisa)
#  Z2 F2 ŽIVO (P1-e): zvonček → stock item klik → ISTI dialog ODPRT
#      (konvergence signalcev) → Prekliči
#  Z3 regresija R214: paleta → 'Material — Naročila (V5)' → Naročila aktiven
#  Z4 regresija R215: paleta → nizka zaloga klik → Zaloga aktiven
#      (aria-current; brez dialoga je nemogoče — hint je porabljen pri Z1,
#       R216 počisti hint ob vsaki vmesni navigaciji → čist vstop)
#  Z5 čiščenje (DOPOLNITEV povratek) + temna + health + odjava + port
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
setsid node .next/standalone/server.js > /tmp/R216-server-e2e.log 2>&1 < /dev/null &
sleep 4

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

echo "--- Z1a: PORABA pod minimum (deterministična priprava) ---"
agent-browser eval "(async()=>{const inv=await (await fetch('/api/inventory')).json(); const cilj=inv.reduce((a,b)=>((b.kolicinaZaloga-b.minimalnaZaloga)>(a.kolicinaZaloga-a.minimalnaZaloga)?b:a)); const razlika=cilj.kolicinaZaloga-cilj.minimalnaZaloga; if(razlika<=0) return JSON.stringify({napaka:'ze pod min',naziv:cilj.naziv}); const k=razlika+1; const p=await fetch('/api/inventory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tipPremika:'PORABA',inventoryId:cilj.id,kolicina:k})}); const tel=await p.json(); window.__r216Restore={id:cilj.id,k:k,naziv:cilj.naziv}; return JSON.stringify({status:p.status,naziv:cilj.naziv,zalogaPo:tel.inventory?tel.inventory.kolicinaZaloga:null,min:tel.inventory?tel.inventory.minimalnaZaloga:null});})()" 2>&1 | tail -1

echo "--- Z1b: F1 ŽIVO (P1-d) — paleta → nizka zaloga klik → Osnutek dialog z TA artikelom ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta';} return 'ni iskalnika';})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const dlg=document.querySelector('[role=dialog]'); const glava=dlg?[...dlg.querySelectorAll('span')].find(e=>e.textContent.trim()==='Nizka zaloga'):null; const vsebina=dlg?dlg.textContent:''; return JSON.stringify({paletaOdprta:!!dlg, skupinaGlava:!!glava, omenjeniArtikel:vsebina.includes(window.__r216Restore?window.__r216Restore.naziv:'—'), podnapis:vsebina.includes('· minimum'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r216-e2e-paleta-nizka.png" > /dev/null 2>&1
agent-browser eval "(()=>{const it=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes('· minimum')&&e.textContent.includes('Zaloga ')); if(!it) return 'ni vnosa nizke zaloge'; it.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'klik artikel nizke zaloge';})()" 2>&1 | tail -1
sleep 7
agent-browser eval "(()=>{const cur=document.querySelector('nav button[aria-current=\"page\"]'); const dlg=document.querySelector('[role=dialog]'); const naslov=dlg?dlg.textContent.includes('Naročilnica kot osnutek naročila'):false; const artikel=dlg&&window.__r216Restore?dlg.textContent.includes(window.__r216Restore.naziv):false; const naroci=dlg?dlg.textContent.includes('naroči '):false; return JSON.stringify({aktivniTab:cur?cur.textContent.trim():null, ariaCurrent:cur?cur.getAttribute('aria-current'):null, dialogOdprt:!!dlg, naslov:naslov, istiArtikel:artikel, naročiVrstica:naroci, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r216-e2e-deeplink-osnutek-dialog.png" > /dev/null 2>&1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[role=dialog] button')].find(x=>x.textContent.trim()==='Prekliči'); if(b){b.click(); return 'Prekliči (brez zapisa)';} return 'ni';})()" > /dev/null 2>&1
sleep 2

echo "--- Z2: F2 ŽIVO (P1-e) — zvonček stock klik → ISTI dialog (konvergenca) ---"
agent-browser eval "(()=>{const zv=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Obvestila')); if(zv){zv.click(); return 'zvonček';} return 'ni zvoncka';})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const sheet=document.querySelector('[role=dialog]'); const stock=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Naroči material')&&b.textContent.includes(window.__r216Restore?window.__r216Restore.naziv:'—')); return JSON.stringify({sheetOdprt:!!sheet, stockViden:!!stock, metaNarociMaterial:!![...document.querySelectorAll('p')].find(p=>p.textContent.trim()==='Naroči material'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r216-e2e-zvoncek-stock.png" > /dev/null 2>&1
agent-browser eval "(()=>{const stock=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Naroči material')&&b.textContent.includes(window.__r216Restore?window.__r216Restore.naziv:'—')); if(!stock) return 'ni stock vrstice'; stock.click(); return 'klik stock vrstice';})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const dlg=document.querySelector('[role=dialog]'); const naslov=dlg?dlg.textContent.includes('Naročilnica kot osnutek naročila'):false; const artikel=dlg&&window.__r216Restore?dlg.textContent.includes(window.__r216Restore.naziv):false; const tab=(document.querySelector('nav button[aria-current=\"page\"]')||{textContent:{trim:()=>'—'}}).textContent.trim(); return JSON.stringify({dialogOdprt:!!dlg, naslov:naslov, istiArtikel:artikel, aktivniTab:tab, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r216-e2e-zvoncek-osnutek-dialog.png" > /dev/null 2>&1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[role=dialog] button')].find(x=>x.textContent.trim()==='Prekliči'); if(b){b.click(); return 'Prekliči';} return 'ni';})()" > /dev/null 2>&1
sleep 2

echo "--- Z3: regresija R214 — paleta → 'Material — Naročila (V5)' → Naročila aktiven ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta';} return 'ni';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const it=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes('Material — Naročila (V5)')); if(it){it.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'klik';} return 'NI vnosa';})()" 2>&1 | tail -1
sleep 8
agent-browser eval "(()=>{const prek=[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.trim().startsWith('Naročila')); return JSON.stringify({narocilaAktiven:prek?prek.getAttribute('aria-pressed'):null, err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z4: regresija R215 — paleta → nizka zaloga klik → Zaloga aktiven, dialog ŠE VEDNO odprt (nov hint, monotonski n) ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta';} return 'ni';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const it=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes('· minimum')&&e.textContent.includes('Zaloga ')); if(!it) return 'ni vnosa'; it.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'klik';})()" > /dev/null 2>&1
sleep 7
agent-browser eval "(()=>{const cur=document.querySelector('nav button[aria-current=\"page\"]'); const dlg=document.querySelector('[role=dialog]'); return JSON.stringify({aktivniTab:cur?cur.textContent.trim():null, dialogPonovnoOdprt:!!dlg, istiArtikel:dlg&&window.__r216Restore?dlg.textContent.includes(window.__r216Restore.naziv):false, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[role=dialog] button')].find(x=>x.textContent.trim()==='Prekliči'); if(b){b.click(); return 'Prekliči';} return 'ni';})()" > /dev/null 2>&1
sleep 2

echo "--- Z5: čiščenje + temna + health + odjava + port ---"
agent-browser eval "(async()=>{const r=window.__r216Restore; if(!r) return JSON.stringify({povratek:'ni podatka'}); const p=await fetch('/api/inventory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tipPremika:'DOPOLNITEV',inventoryId:r.id,kolicina:r.k})}); const tel=await p.json(); return JSON.stringify({povratek:p.status,naziv:r.naziv,zalogaPo:tel.inventory?tel.inventory.kolicinaZaloga:null});})()" 2>&1 | tail -1
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
echo "--- R216 E2E KONEC ---"
