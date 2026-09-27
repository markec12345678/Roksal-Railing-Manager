#!/bin/bash
# R214 reprobe (družina R190/R209/R213: probe napaka ≠ bug — vzrok pojasnjen,
# ne ugibanje): (1) PORABA/DOPOLNITEV brez projectId (z.string().optional()
# ZAVRNE null — r214-e2e Z4a 400 vzrok); (2) toast 'Odpri naročila' polni tok;
# (3) fresh-mount glavni Material → BOM privzeti (pravi test R213 semantike).
set -u
SS=/home/z/my-project/screenshots
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
setsid node .next/standalone/server.js > /tmp/R214-server-reprobe.log 2>&1 < /dev/null &
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
agent-browser eval "(()=>{return JSON.stringify({url:location.pathname,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- R1: PORABA brez projectId → artikel pod minimum ---"
agent-browser eval "(async()=>{const inv=await (await fetch('/api/inventory')).json(); const cilj=inv.reduce((a,b)=>((b.kolicinaZaloga-b.minimalnaZaloga)>(a.kolicinaZaloga-a.minimalnaZaloga)?b:a)); const razlika=cilj.kolicinaZaloga-cilj.minimalnaZaloga; if(razlika<=0) return JSON.stringify({napaka:'ze pod min',naziv:cilj.naziv}); const k=razlika+1; const p=await fetch('/api/inventory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tipPremika:'PORABA',inventoryId:cilj.id,kolicina:k})}); const tel=await p.json(); window.__r214Restore={id:cilj.id,k:k,naziv:cilj.naziv}; return JSON.stringify({status:p.status,naziv:cilj.naziv,zalogaPo:tel.inventory?tel.inventory.kolicinaZaloga:null,min:tel.inventory?tel.inventory.minimalnaZaloga:null,podMin:tel.inventory?(tel.inventory.kolicinaZaloga<=tel.inventory.minimalnaZaloga):null});})()" 2>&1 | tail -1

echo "--- R2: Zaloga → Osnutek → Shrani → TOAST 'Odpri naročila' klik → Naročila AKTIVEN ---"
agent-browser eval "(()=>{const z=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Zaloga'); if(z){z.click(); return 'Zaloga';} return 'ni';})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Shrani naročilnico vidnih artiklov kot osnutek naročila'); if(b){b.click(); return 'klik Osnutek';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const dlg=document.querySelector('[role=dialog]'); return JSON.stringify({dialogOdprt:!!dlg, naslov:dlg?dlg.textContent.includes('Naročilnica kot osnutek naročila'):false, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const dlg=document.querySelector('[role=dialog]'); if(!dlg) return 'ni dialoga'; const trig=dlg.querySelector('button[role=combobox]')||[...dlg.querySelectorAll('button')].find(b=>b.textContent.includes('Izberite dobavitelja')); if(!trig) return 'ni trigga'; trig.click(); return 'select odprt';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const it=[...document.querySelectorAll('[role=option]')].find(o=>o.getAttribute('aria-disabled')!=='true'); if(!it) return 'ni opcij'; it.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'izbran';})()" 2>&1 | tail -1
sleep 1
agent-browser eval "(()=>{const i=document.querySelector('#osnutek-opombe'); if(!i) return 'ni opomb'; const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; setter.call(i,'R214 reprobe — toast deep-link (_r214-subtab)'); i.dispatchEvent(new InputEvent('input',{bubbles:true})); return 'opomba ok';})()" 2>&1 | tail -1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[role=dialog] button')].find(x=>x.textContent.trim()==='Shrani osnutek'); if(!b) return 'ni gumba'; if(b.disabled) return 'DISABLED'; b.click(); return 'klik Shrani osnutek';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const toast=document.querySelector('[data-sonner-toast]'); const akcija=toast?[...toast.querySelectorAll('button')].find(x=>x.textContent.trim()==='Odpri naročila'):null; const besedilo=toast?toast.textContent.trim().slice(0,140):null; if(akcija){akcija.click(); return JSON.stringify({toastViden:true,akcijaKlik:'TAKOJ',besedilo:besedilo});} return JSON.stringify({toastViden:!!toast,besedilo:besedilo,akcijaKlik:'ni akcije',err:window.__err??null});})()" 2>&1 | tail -1
sleep 9
agent-browser eval "(()=>{const prek=[...document.querySelectorAll('button[aria-pressed]')].filter(b=>b.textContent.trim().startsWith('Naročila')); const bom=[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.trim().startsWith('BOM Refine')); const kartice=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Zgodovina').length; return JSON.stringify({narocilaAktiven:prek.length?prek[0].getAttribute('aria-pressed'):null, bomSe:bom?bom.getAttribute('aria-pressed'):null, zgodovinaGumbi:kartice, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r214-reprobe-toast-narocila.png" > /dev/null 2>&1

echo "--- R3: fresh-mount glavni Material → BOM privzeti (Skice najprej odmontira) ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta';} return 'ni';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const it=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.trim().startsWith('Skice')); if(it){it.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'Skice';} return 'ni';})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const z=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').toLowerCase().includes('zapri')||(b.textContent||'').trim()==='Zapri'); if(z){z.click(); return 'zaprl';} return 'ni';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta';} return 'ni';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const it=[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.trim().startsWith('Material Intelligence (V5)')); if(it){it.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'klik glavni';} return 'ni';})()" 2>&1 | tail -1
sleep 8
agent-browser eval "(()=>{const bom=[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.trim().startsWith('BOM Refine')); const n=[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.trim().startsWith('Naročila')); return JSON.stringify({bomPrivzetiFresh:bom?bom.getAttribute('aria-pressed'):null, narocilaSe:n?n.getAttribute('aria-pressed'):null, err:window.__err??null});})()" 2>&1 | tail -1

echo "--- R4: čiščenje (PATCH PREKlicANO + DOPOLNITEV povratek brez projectId) ---"
agent-browser eval "(async()=>{const vsi=await (await fetch('/api/material-orders')).json(); const ostanki=(vsi||[]).filter(o=>(o.opombe||'').includes('_r214-subtab')&&o.status!=='PREKlicANO'); const rez=[]; for(const o of ostanki){const p=await fetch('/api/material-orders',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:o.id,status:'PREKlicANO'})}); rez.push(o.id+':'+p.status);} return JSON.stringify({pocisceno:rez.length,rez:rez});})()" 2>&1 | tail -1
agent-browser eval "(async()=>{const r=window.__r214Restore; if(!r) return JSON.stringify({povratek:'ni podatka'}); const p=await fetch('/api/inventory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tipPremika:'DOPOLNITEV',inventoryId:r.id,kolicina:r.k})}); const tel=await p.json(); return JSON.stringify({povratek:p.status,naziv:r.naziv,zalogaPo:tel.inventory?tel.inventory.kolicinaZaloga:null});})()" 2>&1 | tail -1
agent-browser eval "(async()=>{const vsi=await (await fetch('/api/material-orders')).json(); const s={}; for(const o of (vsi||[])) s[o.status]=(s[o.status]||0)+1; const ostanki=(vsi||[]).filter(o=>(o.opombe||'').includes('_r214-subtab')&&o.status!=='PREKlicANO').length; return JSON.stringify({skupaj:(vsi||[]).length,statusi:s,aktivniR214Ostanki:ostanki});})()" 2>&1 | tail -1
agent-browser eval "(()=>{return JSON.stringify({err:window.__err??null});})()" 2>&1 | tail -1
curl -s --max-time 10 "http://127.0.0.1:3100/api/public/health"; echo
agent-browser eval "(()=>{const o=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Odjava')); if(o){o.click(); return 'odjava';} return 'ni';})()" > /dev/null 2>&1
sleep 2
agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "--- R214 REPROBE KONEC ---"
