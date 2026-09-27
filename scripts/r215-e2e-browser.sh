#!/bin/bash
# R215 E2E ŽIVO (vzorec r206-r214): standalone :3100, ADMIN (ci@roksal.si).
#  Z0 prijava ADMIN → Hammer → app chrome
#  Z1 F1 ŽIVO: PORABA pod minimum → paleta ⌘K → 'Nizka zaloga' skupina z
#     iskrimi podatki → klik artikel → Zaloga AKTIVEN (aria-current='page')
#  Z2 regresija R214: paleta → 'Material — Naročila (V5)' → Naročila aktiven
#  Z3 F2 ŽIVO: Zaloga → 'Naročilnica' (clipboard stub — headless pravice) →
#     toast akcija 'Shrani kot osnutek' → R205 dialog s TOČNO istimi artikli
#     → Prekliči (BREZ DB zapisa — tok je dialog, ne shrani)
#  Z4 F3 ŽIVO: FAB menu struktura (role=menu + 5× menuitem)
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
setsid node .next/standalone/server.js > /tmp/R215-server-e2e.log 2>&1 < /dev/null &
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
agent-browser eval "(async()=>{const inv=await (await fetch('/api/inventory')).json(); const cilj=inv.reduce((a,b)=>((b.kolicinaZaloga-b.minimalnaZaloga)>(a.kolicinaZaloga-a.minimalnaZaloga)?b:a)); const razlika=cilj.kolicinaZaloga-cilj.minimalnaZaloga; if(razlika<=0) return JSON.stringify({napaka:'ze pod min',naziv:cilj.naziv}); const k=razlika+1; const p=await fetch('/api/inventory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tipPremika:'PORABA',inventoryId:cilj.id,kolicina:k})}); const tel=await p.json(); window.__r215Restore={id:cilj.id,k:k,naziv:cilj.naziv}; return JSON.stringify({status:p.status,naziv:cilj.naziv,zalogaPo:tel.inventory?tel.inventory.kolicinaZaloga:null,min:tel.inventory?tel.inventory.minimalnaZaloga:null});})()" 2>&1 | tail -1

echo "--- Z1b: F1 ŽIVO — paleta ⌘K → 'Nizka zaloga' skupina → klik → Zaloga ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta';} return 'ni iskalnika';})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const dlg=document.querySelector('[role=dialog]'); const glava=dlg?[...dlg.querySelectorAll('span')].find(e=>e.textContent.trim()==='Nizka zaloga'):null; const vsebina=dlg?dlg.textContent:''; return JSON.stringify({paletaOdprta:!!dlg, skupinaGlava:!!glava, omenjeniArtikel:vsebina.includes(window.__r215Restore?window.__r215Restore.naziv:'—'), podnapis:vsebina.includes('· minimum'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r215-e2e-paleta-nizka.png" > /dev/null 2>&1
agent-browser eval "(()=>{const it=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes('· minimum')&&e.textContent.includes('Zaloga ')); if(!it) return 'ni vnosa nizke zaloge'; it.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'klik artikel nizke zaloge';})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const cur=document.querySelector('nav button[aria-current=\"page\"]'); const osn=[...document.querySelectorAll('button')].some(x=>(x.getAttribute('aria-label')||'')==='Shrani naročilnico vidnih artiklov kot osnutek naročila'); return JSON.stringify({aktivniTab:cur?cur.textContent.trim():null, ariaCurrent:cur?cur.getAttribute('aria-current'):null, zalogaViden:osn, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r215-e2e-zaloga-aktivna.png" > /dev/null 2>&1

echo "--- Z2: regresija R214 — paleta → 'Material — Naročila (V5)' → Naročila aktiven ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta';} return 'ni';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const it=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes('Material — Naročila (V5)')); if(it){it.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'klik';} return 'NI vnosa';})()" 2>&1 | tail -1
sleep 8
agent-browser eval "(()=>{const prek=[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.trim().startsWith('Naročila')); return JSON.stringify({narocilaAktiven:prek?prek.getAttribute('aria-pressed'):null, err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z3: F2 ŽIVO — 'Naročilnica' → toast akcija 'Shrani kot osnutek' → dialog ---"
agent-browser eval "(()=>{const z=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Zaloga'); if(z){z.click(); return 'Zaloga';} return 'ni';})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText=async()=>{}; return 'clipboard stub';} return 'ni clipboard API';})()" 2>&1 | tail -1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Kopiraj naročilnico vidnih artiklov pod minimalno zalogo'); if(!b) return 'ni Naročilnica gumba'; b.click(); return 'klik Naročilnica';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const toasts=[...document.querySelectorAll('[data-sonner-toast]')]; const toast=toasts.find(t=>t.textContent.includes('kopirana v odložišče')); const akcija=toast?[...toast.querySelectorAll('button')].find(x=>x.textContent.trim()==='Shrani kot osnutek'):null; const besedilo=toast?toast.textContent.trim().slice(0,150):null; if(akcija){akcija.click(); return JSON.stringify({toastViden:true,akcijaKlik:'TAKOJ',besedilo:besedilo});} return JSON.stringify({toasti:toasts.length,besedilo:besedilo,akcijaKlik:'ni',err:window.__err??null});})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const dlg=document.querySelector('[role=dialog]'); const naslov=dlg?dlg.textContent.includes('Naročilnica kot osnutek naročila'):false; const artikel=dlg&&window.__r215Restore?dlg.textContent.includes(window.__r215Restore.naziv):false; return JSON.stringify({dialogOdprt:!!dlg, naslov:naslov, istiArtikel:artikel, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r215-e2e-toast-osnutek-dialog.png" > /dev/null 2>&1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[role=dialog] button')].find(x=>x.textContent.trim()==='Prekliči'); if(b){b.click(); return 'Prekliči (brez zapisa)';} return 'ni';})()" > /dev/null 2>&1
sleep 2

echo "--- Z4: F3 ŽIVO — FAB menu struktura ---"
agent-browser eval "(()=>{const fab=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Hitre akcije'); if(!fab) return 'ni FAB'; fab.click(); return 'FAB odprt';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const menu=document.querySelector('[role=menu]'); const items=menu?[...menu.querySelectorAll('[role=menuitem]')].map(x=>x.textContent.trim()):[]; return JSON.stringify({menuObstaja:!!menu, menuLabel:menu?menu.getAttribute('aria-label'):null, menuitemi:items.length, prvi:items[0]||null, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r215-e2e-fab-menu.png" > /dev/null 2>&1
agent-browser eval "(()=>{const fab=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Zapri hitre akcije'); if(fab){fab.click(); return 'FAB zaprt';} return 'ni';})()" > /dev/null 2>&1
sleep 2

echo "--- Z5: čiščenje + temna + health + odjava ---"
agent-browser eval "(async()=>{const r=window.__r215Restore; if(!r) return JSON.stringify({povratek:'ni podatka'}); const p=await fetch('/api/inventory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tipPremika:'DOPOLNITEV',inventoryId:r.id,kolicina:r.k})}); const tel=await p.json(); return JSON.stringify({povratek:p.status,naziv:r.naziv,zalogaPo:tel.inventory?tel.inventory.kolicinaZaloga:null});})()" 2>&1 | tail -1
agent-browser eval "(async()=>{const vsi=await (await fetch('/api/material-orders')).json(); const s={}; for(const o of (vsi||[])) s[o.status]=(s[o.status]||0)+1; const ostanki=(vsi||[]).filter(o=>(o.opombe||'').includes('_r214-subtab')||o.opombe.includes('_r215')).length; return JSON.stringify({skupaj:(vsi||[]).length,statusi:s,testniAktivniOstanki:(vsi||[]).filter(o=>o.status!=='PREKlicANO'&&(o.opombe||'').includes('E2E')).length});})()" 2>&1 | tail -1
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
echo "--- R215 E2E KONEC ---"
