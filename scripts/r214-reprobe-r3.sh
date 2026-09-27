#!/bin/bash
# R214 reprobe R2c — popravljen tok: VizTab (product-first '/') → Hammer
# 'Montažna orodja' → app chrome (BottomNav) → Zaloga → Osnutek → toast akcija.
# Lekcija: TopBar je na viz hidden (v DOM), BottomNav pogojno renderiran (NI v DOM).
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
setsid node .next/standalone/server.js > /tmp/R214-server-r2c.log 2>&1 < /dev/null &
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

echo "--- R2c-1: PORABA pod minimum ---"
agent-browser eval "(async()=>{const inv=await (await fetch('/api/inventory')).json(); const cilj=inv.reduce((a,b)=>((b.kolicinaZaloga-b.minimalnaZaloga)>(a.kolicinaZaloga-a.minimalnaZaloga)?b:a)); const razlika=cilj.kolicinaZaloga-cilj.minimalnaZaloga; if(razlika<=0) return JSON.stringify({napaka:'ze pod min'}); const k=razlika+1; const p=await fetch('/api/inventory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tipPremika:'PORABA',inventoryId:cilj.id,kolicina:k})}); const tel=await p.json(); window.__r214Restore={id:cilj.id,k:k,naziv:cilj.naziv}; return JSON.stringify({status:p.status,zalogaPo:tel.inventory?tel.inventory.kolicinaZaloga:null,min:tel.inventory?tel.inventory.minimalnaZaloga:null});})()" 2>&1 | tail -1

echo "--- R2c-2: VizTab Hammer → app chrome → Zaloga ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(!h) return 'ni Hammer'; h.click(); return 'klik Montažna orodja';})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const z=[...document.querySelectorAll('nav button')].filter(b=>(b.getAttribute('aria-label')||'')==='Zaloga'); if(!z.length) return JSON.stringify({napaka:'BottomNav ni na voljo'}); z[0].click(); return 'klik Zaloga nav';})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const cur=document.querySelector('nav button[aria-current=\"page\"]'); const osn=[...document.querySelectorAll('button')].filter(x=>(x.getAttribute('aria-label')||'')==='Shrani naročilnico vidnih artiklov kot osnutek naročila'); const nizka=[...document.querySelectorAll('div,p')].some(e=>e.textContent.startsWith('Nizka zaloga!')); return JSON.stringify({aktivniTab:cur?cur.textContent.trim():null,osnutekGumbi:osn.length,nizkaZalogaPas:nizka,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const cur=document.querySelector('nav button[aria-current=\"page\"]'); return JSON.stringify({ariaCurrent:cur?cur.getAttribute('aria-current'):null,tab:cur?cur.textContent.trim():null});})()" 2>&1 | tail -1

echo "--- R2c-3: Osnutek dialog → Shrani → toast 'Odpri naročila' klik ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Shrani naročilnico vidnih artiklov kot osnutek naročila'); if(!b) return 'ni gumba'; b.click(); return 'klik Osnutek';})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const dlg=document.querySelector('[role=dialog]'); return JSON.stringify({dialogOdprt:!!dlg, naslov:dlg?dlg.textContent.includes('Naročilnica kot osnutek naročila'):false, artikli:dlg?dlg.textContent.match(/se shrani med naročila/)!==null:false, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const dlg=document.querySelector('[role=dialog]'); if(!dlg) return 'ni dialoga'; const trig=dlg.querySelector('button[role=combobox]')||[...dlg.querySelectorAll('button')].find(b=>b.textContent.includes('Izberite dobavitelja')); if(!trig) return 'ni trigga'; trig.click(); return 'select odprt';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const it=[...document.querySelectorAll('[role=option]')].find(o=>o.getAttribute('aria-disabled')!=='true'); if(!it) return 'ni opcij'; it.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'izbran:'+it.textContent.trim().slice(0,25);})()" 2>&1 | tail -1
sleep 1
agent-browser eval "(()=>{const i=document.querySelector('#osnutek-opombe'); if(!i) return 'ni opomb'; const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; setter.call(i,'R214 r2c — toast deep-link (_r214-subtab)'); i.dispatchEvent(new InputEvent('input',{bubbles:true})); return 'opomba ok';})()" 2>&1 | tail -1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[role=dialog] button')].find(x=>x.textContent.trim()==='Shrani osnutek'); if(!b) return 'ni gumba'; if(b.disabled) return 'DISABLED'; b.click(); return 'klik Shrani osnutek';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const toasts=[...document.querySelectorAll('[data-sonner-toast]')]; const toast=toasts.find(t=>t.textContent.includes('Osnutek naročila'))||toasts[0]; const akcija=toast?[...toast.querySelectorAll('button')].find(x=>x.textContent.trim()==='Odpri naročila'):null; const besedilo=toast?toast.textContent.trim().slice(0,160):null; if(akcija){akcija.click(); return JSON.stringify({toastViden:true,akcijaKlik:'TAKOJ',besedilo:besedilo});} return JSON.stringify({toasti:toasts.length,besedilo:besedilo,akcijaKlik:'ni',err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r214-r2c-toast.png" > /dev/null 2>&1
sleep 9
agent-browser eval "(()=>{const prek=[...document.querySelectorAll('button[aria-pressed]')].filter(b=>b.textContent.trim().startsWith('Naročila')); const bom=[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.trim().startsWith('BOM Refine')); const kartice=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Zgodovina').length; return JSON.stringify({narocilaAktivenPoToastu:prek.length?prek[0].getAttribute('aria-pressed'):null, bomSe:bom?bom.getAttribute('aria-pressed'):null, zgodovinaGumbi:kartice, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r214-r2c-narocila.png" > /dev/null 2>&1

echo "--- R2c-4: čiščenje + health ---"
agent-browser eval "(async()=>{const vsi=await (await fetch('/api/material-orders')).json(); const ostanki=(vsi||[]).filter(o=>(o.opombe||'').includes('_r214-subtab')&&o.status!=='PREKlicANO'); const rez=[]; for(const o of ostanki){const p=await fetch('/api/material-orders',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:o.id,status:'PREKlicANO'})}); rez.push(o.id+':'+p.status);} return JSON.stringify({pocisceno:rez.length,rez:rez});})()" 2>&1 | tail -1
agent-browser eval "(async()=>{const r=window.__r214Restore; if(!r) return JSON.stringify({povratek:'ni podatka'}); const p=await fetch('/api/inventory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tipPremika:'DOPOLNITEV',inventoryId:r.id,kolicina:r.k})}); const tel=await p.json(); return JSON.stringify({povratek:p.status,zalogaPo:tel.inventory?tel.inventory.kolicinaZaloga:null});})()" 2>&1 | tail -1
agent-browser eval "(async()=>{const vsi=await (await fetch('/api/material-orders')).json(); const ostanki=(vsi||[]).filter(o=>(o.opombe||'').includes('_r214-subtab')&&o.status!=='PREKlicANO').length; return JSON.stringify({skupaj:(vsi||[]).length,aktivniR214Ostanki:ostanki,err:window.__err??null});})()" 2>&1 | tail -1
curl -s --max-time 10 "http://127.0.0.1:3100/api/public/health"; echo
agent-browser eval "(()=>{const o=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Odjava')); if(o){o.click(); return 'odjava';} return 'ni';})()" > /dev/null 2>&1
sleep 2
agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "--- R2c KONEC ---"
