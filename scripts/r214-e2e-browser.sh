#!/bin/bash
# R214 E2E ŽIVO (vzorec r206-r213): standalone :3100, ADMIN (ci@roksal.si).
#  Z0 prijava ADMIN + zapri onboarding
#  Z0b čiščenje ostankov (_r214-subtab)
#  Z1 F1 ŽIVO KLJUČNI DOKAZ: paleta ⌘K → 'Material — Naročila (V5)' →
#     Material **Naročila podzavihek AKTIVEN** (aria-pressed=true, BOM=false)
#  Z2 F1b paleta: 'Material — Dobavitelji (V5)' → Dobavitelji aktiven; nato
#     glavni 'Material Intelligence (V5)' (brez subTab) → BOM privzeti
#  Z3 F1b SKICE FIX: paleta → 'Skice' → overlay SE ODPRE (prej PRAZEN panel)
#  Z4 F2 ŽIVO: PORABA premik pod minimum → Zaloga → 'Osnutek' dialog →
#     'Shrani osnutek' → toast akcija 'Odpri naročila' klik → Naročila aktiven
#  Z5 aria-current na aktivnem bottom-nav zavihku
#  Z6 čiščenje (PATCH PREKlicANO + DOPOLNITEV povratek) + temna + health +
#     odjava + port sproščen
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
# R213 lekcija: standalone MORA imeti statične chunkse (uradni korak).
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
setsid node .next/standalone/server.js > /tmp/R214-server-e2e.log 2>&1 < /dev/null &
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

echo "--- Z0b: čiščenje ostankov po prejšnjih tekih ---"
agent-browser eval "(async()=>{const vsi=await (await fetch('/api/material-orders')).json(); const ostanki=(vsi||[]).filter(o=>(o.opombe||'').includes('_r214-subtab')&&o.status!=='PREKlicANO'); const rez=[]; for(const o of ostanki){const p=await fetch('/api/material-orders',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:o.id,status:'PREKlicANO'})}); rez.push(o.id+':'+p.status);} return JSON.stringify({pocisceno:rez.length,detajl:rez});})()" 2>&1 | tail -1

echo "--- Z1: F1 ŽIVO — paleta ⌘K → 'Material — Naročila (V5)' → Naročila AKTIVEN ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta odprta';} return 'ni iskalnika';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const dlg=document.querySelector('[role=dialog]'); return JSON.stringify({paletaOdprta:!!dlg, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const i=document.querySelector('[cmdk-input]')||document.querySelector('input[placeholder*=\"Poišči\"]'); if(!i) return 'ni vhoda'; const s=new InputEvent('input',{bubbles:true}); i.value='Material —'; i.dispatchEvent(s); return 'vpisano';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const items=[...document.querySelectorAll('[cmdk-item]')].map(e=>e.textContent.trim()); return JSON.stringify({vidni:items.filter(t=>t.includes('Material'))});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const it=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes('Material — Naročila (V5)')); if(it){it.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'klik podzavihek Naročila';} return 'NI vnosa';})()" 2>&1 | tail -1
sleep 9
agent-browser eval "(()=>{const prek=[...document.querySelectorAll('button[aria-pressed]')].filter(b=>b.textContent.trim().startsWith('Naročila')); const bom=[...document.querySelectorAll('button[aria-pressed]')].filter(b=>b.textContent.trim().startsWith('BOM Refine')); const dob=[...document.querySelectorAll('button[aria-pressed]')].filter(b=>b.textContent.trim().startsWith('Dobavitelji')); return JSON.stringify({narocilaPritisnjeno:prek.length?prek[0].getAttribute('aria-pressed'):null, bomPritisnjeno:bom.length?bom[0].getAttribute('aria-pressed'):null, dobaviteljiPritisnjeno:dob.length?dob[0].getAttribute('aria-pressed'):null, url:location.pathname, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r214-e2e-paleta-narocila.png" > /dev/null 2>&1

echo "--- Z2: F1b paleta → Dobavitelji; nato glavni Material (BOM privzeti) ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta odprta';} return 'ni';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const it=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.includes('Material — Dobavitelji (V5)')); if(it){it.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'klik Dobavitelji';} return 'NI vnosa';})()" 2>&1 | tail -1
sleep 8
agent-browser eval "(()=>{const d=[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.trim().startsWith('Dobavitelji')); const n=[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.trim().startsWith('Naročila')); return JSON.stringify({dobaviteljiAktiven:d?d.getAttribute('aria-pressed'):null, narocilaSe:n?n.getAttribute('aria-pressed'):null, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta odprta';} return 'ni';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const it=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.trim().startsWith('Material Intelligence (V5)')); if(it){it.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'klik glavni Material';} return 'NI vnosa';})()" 2>&1 | tail -1
sleep 8
agent-browser eval "(()=>{const bom=[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.trim().startsWith('BOM Refine')); return JSON.stringify({bomPrivzeti:bom?bom.getAttribute('aria-pressed'):null, err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z3: F1b SKICE FIX — paleta → 'Skice' → overlay (prej PRAZEN panel) ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta odprta';} return 'ni';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const it=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.trim().startsWith('Skice')); if(it){it.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'klik Skice';} return 'NI vnosa';})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const canvas=document.querySelector('canvas'); const overlay=[...document.querySelectorAll('div')].some(d=>d.className&&String(d.className).includes('fixed inset-0 z-50')); const virec=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Več'); return JSON.stringify({skicaCanvas:!!canvas, skicaOverlay:overlay, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r214-e2e-skice-overlay.png" > /dev/null 2>&1
agent-browser eval "(()=>{const z=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').toLowerCase().includes('zapri')||(b.textContent||'').trim()==='Zapri'); if(z){z.click(); return 'zaprl overlay';} return 'ni zapiralnega';})()" 2>&1 | tail -1
sleep 3

echo "--- Z4: F2 ŽIVO — osnutek toast akcija 'Odpri naročila' ---"
agent-browser eval "(async()=>{const inv=await (await fetch('/api/inventory')).json(); if(!inv.length) return JSON.stringify({napaka:'ni zaloge'}); const cilj=inv.reduce((a,b)=>((b.kolicinaZaloga-b.minimalnaZaloga)>(a.kolicinaZaloga-a.minimalnaZaloga)?b:a)); return JSON.stringify({id:cilj.id,naziv:cilj.naziv,zaloga:cilj.kolicinaZaloga,min:cilj.minimalnaZaloga,enota:cilj.enota});})()" 2>&1 | tail -1
echo "--- Z4a: PORABA premik — artikel pod minimum (deterministično, z povratkom) ---"
agent-browser eval "(async()=>{const inv=await (await fetch('/api/inventory')).json(); if(!inv.length) return JSON.stringify({napaka:'ni zaloge'}); const cilj=inv.reduce((a,b)=>((b.kolicinaZaloga-b.minimalnaZaloga)>(a.kolicinaZaloga-a.minimalnaZaloga)?b:a)); const razlika=cilj.kolicinaZaloga-cilj.minimalnaZaloga; if(razlika<=0) return JSON.stringify({napaka:'že pod min',naziv:cilj.naziv}); const k=razlika+1; const p=await fetch('/api/inventory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tipPremika:'PORABA',inventoryId:cilj.id,kolicina:k})}); const tel=await p.json(); window.__r214Restore={id:cilj.id,k:k,naziv:cilj.naziv}; return JSON.stringify({status:p.status,naziv:cilj.naziv,zalogaPo:tel.inventory?tel.inventory.kolicinaZaloga:null,min:tel.inventory?tel.inventory.minimalnaZaloga:null,podMin:tel.inventory?(tel.inventory.kolicinaZaloga<=tel.inventory.minimalnaZaloga):null});})()" 2>&1 | tail -1

echo "--- Z4b: VizTab Hammer → app chrome → Zaloga → 'Osnutek' dialog → toast ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h){h.click(); return 'VizTab → app chrome';} return 'ni Hammer';})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const z=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Zaloga'); if(z){z.click(); return 'Zaloga tab';} return 'ni taba';})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const cur=document.querySelector('nav button[aria-current=\"page\"]'); return JSON.stringify({ariaCurrentTab:cur?cur.textContent.trim():null, ariaCurrentVrednost:cur?cur.getAttribute('aria-current'):null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Shrani naročilnico vidnih artiklov kot osnutek naročila'); if(b){b.click(); return 'klik Osnutek';} return 'ni Osnutek gumba';})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const dlg=document.querySelector('[role=dialog]'); const naslov=dlg?dlg.textContent.includes('Naročilnica kot osnutek naročila'):false; const trig=dlg?dlg.querySelector('button[role=combobox], [data-slot=select-trigger], select'):null; return JSON.stringify({dialogOdprt:!!dlg,naslov:naslov,selectNajden:!!trig,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const dlg=document.querySelector('[role=dialog]'); if(!dlg) return 'ni dialoga'; const trig=dlg.querySelector('button[role=combobox]')||[...dlg.querySelectorAll('button')].find(b=>b.textContent.includes('Izberite dobavitelja')); if(!trig) return 'ni trigga'; trig.click(); return 'select odprt';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const it=[...document.querySelectorAll('[role=option]')].find(o=>o.getAttribute('aria-disabled')!=='true'); if(!it) return 'ni opcij'; it.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'izbran:'+it.textContent.trim().slice(0,30);})()" 2>&1 | tail -1
sleep 1
agent-browser eval "(()=>{const i=document.querySelector('#osnutek-opombe'); if(!i) return 'ni opomb'; const s=new InputEvent('input',{bubbles:true}); const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; setter.call(i,'R214 E2E — toast deep-link (_r214-subtab)'); i.dispatchEvent(s); return 'opomba vpisana';})()" 2>&1 | tail -1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[role=dialog] button')].find(x=>x.textContent.trim()==='Shrani osnutek'); if(!b) return 'ni gumba'; if(b.disabled) return 'GUMB DISABLED'; b.click(); return 'klik Shrani osnutek';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const toast=document.querySelector('[data-sonner-toast]'); const akcija=toast?[...toast.querySelectorAll('button')].find(x=>x.textContent.trim()==='Odpri naročila'):null; return JSON.stringify({toastViden:!!toast,besedilo:toast?toast.textContent.trim().slice(0,120):null,akcijaNajdena:!!akcija,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r214-e2e-toast-akcija.png" > /dev/null 2>&1
agent-browser eval "(()=>{const toast=document.querySelector('[data-sonner-toast]'); const akcija=toast?[...toast.querySelectorAll('button')].find(x=>x.textContent.trim()==='Odpri naročila'):null; if(!akcija) return 'ni akcije (toast iztekel?)'; akcija.click(); return 'KLIK Odpri naročila';})()" 2>&1 | tail -1
sleep 9
agent-browser eval "(()=>{const prek=[...document.querySelectorAll('button[aria-pressed]')].filter(b=>b.textContent.trim().startsWith('Naročila')); const bom=[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.trim().startsWith('BOM Refine')); const kartice=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Zgodovina').length; return JSON.stringify({narocilaAktivenPoToastu:prek.length?prek[0].getAttribute('aria-pressed'):null, bomSe:bom?bom.getAttribute('aria-pressed'):null, zgodovinaGumbi:kartice, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r214-e2e-toast-narocila.png" > /dev/null 2>&1

echo "--- Z5: aria-current regresija — Material/Več ni glavni tab (brez aria-current) ---"
agent-browser eval "(()=>{const cur=document.querySelectorAll('nav button[aria-current=\"page\"]').length; return JSON.stringify({ariaCurrentStevec:cur, err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z6: čiščenje + temna + health + odjava ---"
agent-browser eval "(async()=>{const vsi=await (await fetch('/api/material-orders')).json(); const ostanki=(vsi||[]).filter(o=>(o.opombe||'').includes('_r214-subtab')&&o.status!=='PREKlicANO'); const rez=[]; for(const o of ostanki){const p=await fetch('/api/material-orders',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:o.id,status:'PREKlicANO'})}); rez.push(o.id+':'+p.status);} return JSON.stringify({pocisceno:rez.length,rez:rez});})()" 2>&1 | tail -1
agent-browser eval "(async()=>{const r=window.__r214Restore; if(!r) return JSON.stringify({povratek:'ni podatka (Z4a je spodletel)'}); const p=await fetch('/api/inventory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tipPremika:'DOPOLNITEV',inventoryId:r.id,kolicina:r.k})}); const tel=await p.json(); return JSON.stringify({povratek:p.status,naziv:r.naziv,zalogaPo:tel.inventory?tel.inventory.kolicinaZaloga:null});})()" 2>&1 | tail -1
agent-browser eval "(async()=>{const vsi=await (await fetch('/api/material-orders')).json(); const s={}; for(const o of (vsi||[])) s[o.status]=(s[o.status]||0)+1; const ostanki=(vsi||[]).filter(o=>(o.opombe||'').includes('_r214-subtab')&&o.status!=='PREKlicANO').length; return JSON.stringify({skupaj:(vsi||[]).length,statusi:s,aktivniR214Ostanki:ostanki});})()" 2>&1 | tail -1
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
echo "--- R214 E2E KONEC ---"
