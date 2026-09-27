#!/bin/bash
# R205 E2E ŽIVO (vzorec r204): standalone :3100, ADMIN (ci@roksal.si),
# Zaloga zavihek → R205 osnutek naročila:
#  Z0 prijava ADMIN + zapri onboarding
#  Z1 Zaloga: trije pill-i ŽIVO (Naročilnica + OSNUTEK NOV + CSV) + pečat + nizke zaloge
#  Z2 klik 'Osnutek' → dialog: pregled artiklov + dobavitelji ( contingency: če
#     prazno → POST /api/suppliers + ponovno odpiranje ) + števec OSNUTEK naročil PRED
#  Z3 izbira dobavitelja (Radix combobox) + opombe + 'Shrani osnutek' → toast
#     'Osnutek naročila shranjen (status OSNUTEK)' + dialog zaprt + števec PRED+1
#     + zadnje naročilo: status OSNUTEK, postavke ≥1, količina = min (EN VIR ŽIVO)
#  Z4 CSV priloga: ponovno odpri dialog → gumb CSV → toast 'Naročilnica CSV prenesena'
#  Z5 R204 regresija: clipboard patch → gumb Naročilnica → glava naročilnice ŽIVO
#  Z6 iskren prazen seznam: filter WPC (če brez nizkih) → Osnutek → toast, dialog NE odprt
#  Z7 temna rgb(15,23,36) + __err null + odjava + javne poti + sprostitev porta
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
setsid node .next/standalone/server.js > /tmp/R205-server-e2e.log 2>&1 < /dev/null &
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

echo "--- Z1: 'Montažna orodja' → Več → Zaloga; trije pill-i ---"
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').toLowerCase().includes('zaloga')||b.textContent.trim().startsWith('Zaloga')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 7
for i in 1 2; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 1
done
agent-browser eval "(()=>{const nar=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'')==='Kopiraj naročilnico vidnih artiklov pod minimalno zalogo').length; const osn=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'')==='Shrani naročilnico vidnih artiklov kot osnutek naročila').length; const csv=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi vidno zalogo kot CSV').length; const pecat=[...document.querySelectorAll('span')].filter(e=>e.textContent.trim().startsWith('Osveženo ob')).map(e=>e.textContent.trim())[0]||null; const narociVrstic=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Naroči').length; return JSON.stringify({narocilnicaGumb:nar,osnutekGumb:osn,csvGumb:csv,pecat,narociVrstic,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z2: klik Osnutek → dialog + (contingency) dobavitelji + števec PRED ---"
# 🔴 lekcija Z2: [role=dialog] zajame tudi 'Več funkcij' sheet — vedno poišči TOČNO
# svoj dialog po edinstvenem naslovu ('Naročilnica kot osnutek naročila').
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Shrani naročilnico vidnih artiklov kot osnutek naročila'); if(b){b.click(); return 'klik';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const D=[...document.querySelectorAll('[role=dialog]')].find(x=>x.textContent.includes('Naročilnica kot osnutek naročila')); if(!D) return JSON.stringify({mojDialog:false,odprtiDialogi:[...document.querySelectorAll('[role=dialog]')].map(x=>(x.querySelector('h2')?.textContent||'').slice(0,30))}); const pregled=[...D.querySelectorAll('*')].filter(e=>e.childElementCount===0&&/naroči \\d+(\\.\\d+)? \\S+/.test(e.textContent.trim())).length; const combobox=!!D.querySelector('button[role=combobox]'); const niDob=[...D.querySelectorAll('p')].some(e=>e.textContent.includes('Ni dobaviteljev')); const opombe=!!D.querySelector('#osnutek-opombe'); return JSON.stringify({mojDialog:true,pregled,combobox,niDobaviteljev:niDob,opombe});})()" 2>&1 | tail -1
agent-browser eval "(async()=>{try{const r=await fetch('/api/material-orders?status=OSNUTEK'); const d=await r.json(); window.__pred=Array.isArray(d)?d.length:-1;}catch(e){window.__pred=-2}})()" > /dev/null 2>&1
sleep 2
agent-browser eval "JSON.stringify({osnutekPred:window.__pred??null})" 2>&1 | tail -1
# contingency: prazen seznam dobaviteljev → ustvari ENEGA realnega + ponovno odpri
agent-browser eval "(()=>{const D=[...document.querySelectorAll('[role=dialog]')].find(x=>x.textContent.includes('Naročilnica kot osnutek naročila')); if(!D) return 'ni dialoga'; const ni=[...D.querySelectorAll('p')].some(e=>e.textContent.includes('Ni dobaviteljev')); if(!ni) return 'dobavitelji OK'; return 'prazno';})()" 2>&1 | tail -1 > /tmp/r205-dob.txt
if grep -q prazno /tmp/r205-dob.txt; then
  echo "  (contingency: ustvarjam dobavitelja E2E R205)"
  agent-browser eval "(async()=>{try{const r=await fetch('/api/suppliers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({naziv:'E2E Dobavitelj R205'})}); window.__dob=r.status;}catch(e){window.__dob=String(e)}})()" > /dev/null 2>&1
  sleep 2
  agent-browser eval "(()=>{const D=[...document.querySelectorAll('[role=dialog]')].find(x=>x.textContent.includes('Naročilnica kot osnutek naročila')); if(D){const pr=[...D.querySelectorAll('button')].find(x=>x.textContent.trim()==='Prekliči'); if(pr) pr.click();} return 'zaprt';})()" > /dev/null 2>&1
  sleep 1
  agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Shrani naročilnico vidnih artiklov kot osnutek naročila'); if(b){b.click(); return 'klik';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
fi
agent-browser screenshot "$SS/qa-r205-e2e-osnutek-dialog.png" > /dev/null 2>&1 && echo "screenshot DIALOG OK"

echo "--- Z3: izbira dobavitelja + opombe + Shrani osnutek + števec PO ---"
agent-browser eval "(()=>{const D=[...document.querySelectorAll('[role=dialog]')].find(x=>x.textContent.includes('Naročilnica kot osnutek naročila')); const t=D&&D.querySelector('button[role=combobox]'); if(t){t.click(); return 'odprt combobox';} return 'ni comboboxa';})()" 2>&1 | tail -1
sleep 1
agent-browser eval "(()=>{const o=document.querySelector('[role=option]'); if(o){const n=o.textContent.trim(); o.click(); return n;} return 'ni opcij';})()" 2>&1 | tail -1
sleep 1
agent-browser fill '#osnutek-opombe' 'E2E R205 osnutek' > /dev/null 2>&1
agent-browser eval "(()=>{const D=[...document.querySelectorAll('[role=dialog]')].find(x=>x.textContent.includes('Naročilnica kot osnutek naročila')); const sel=D&&D.querySelector('button[role=combobox]'); const btn=D&&[...D.querySelectorAll('button')].find(x=>x.textContent.trim()==='Shrani osnutek'); return JSON.stringify({izbran:sel?sel.textContent.trim():null,gumbOnemogocen:btn?btn.disabled:null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const D=[...document.querySelectorAll('[role=dialog]')].find(x=>x.textContent.includes('Naročilnica kot osnutek naročila')); const btn=D&&[...D.querySelectorAll('button')].find(x=>x.textContent.trim()==='Shrani osnutek'); if(btn){btn.click(); return 'klik';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=document.querySelector('[data-sonner-toast]'); const moj=[...document.querySelectorAll('[role=dialog]')].some(x=>x.textContent.includes('Naročilnica kot osnutek naročila')); return JSON.stringify({toast:t?t.textContent.trim().slice(0,140):null,mojDialogSeOdprt:moj,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(async()=>{try{const r=await fetch('/api/material-orders?status=OSNUTEK'); const d=await r.json(); window.__po={n:Array.isArray(d)?d.length:-1,zadnji:Array.isArray(d)&&d[0]?{status:d[0].status,dobavitelj:d[0].supplier?.naziv??null,postavke:(d[0].items||[]).length,kolicina0:(d[0].items||[])[0]?.kolicina??null,opombe:d[0].opombe??null}:null};}catch(e){window.__po={err:String(e)}}})()" > /dev/null 2>&1
sleep 2
agent-browser eval "JSON.stringify({osnutekPo:window.__po??null,pred:window.__pred??null})" 2>&1 | tail -1

echo "--- Z4: CSV priloga v dialogu ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Shrani naročilnico vidnih artiklov kot osnutek naročila'); if(b){b.click(); return 'klik';} return 'ni';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const D=[...document.querySelectorAll('[role=dialog]')].find(x=>x.textContent.includes('Naročilnica kot osnutek naročila')); const b=D&&[...D.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Prenesi naročilnico vidnih artiklov kot CSV'); if(b){b.click(); return 'klik';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const t=[...document.querySelectorAll('[data-sonner-toast]')].map(e=>e.textContent.trim()).find(x=>x.startsWith('Naročilnica CSV prenesena'))||null; return JSON.stringify({csvToast:t,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const D=[...document.querySelectorAll('[role=dialog]')].find(x=>x.textContent.includes('Naročilnica kot osnutek naročila')); const pr=D&&[...D.querySelectorAll('button')].find(x=>x.textContent.trim()==='Prekliči'); if(pr) pr.click(); return 'zaprt';})()" > /dev/null 2>&1
sleep 1

echo "--- Z5: R204 regresija — clipboard naročilnica ---"
agent-browser eval "window.__naroc=null; navigator.clipboard.writeText=(t)=>{window.__naroc=t; return Promise.resolve();}; 'patched'" > /dev/null 2>&1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Kopiraj naročilnico vidnih artiklov pod minimalno zalogo'); if(b){b.click(); return 'klik';} return 'ni gumba';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const p=window.__naroc; return JSON.stringify({glava:p?p.split('\n')[0]:null,dolzina:p?p.length:0,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z6: iskren prazen seznam (filter WPC, če brez nizkih) ---"
agent-browser eval "(()=>{const f=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='WPC'); if(f) f.click(); return !!f;})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Shrani naročilnico vidnih artiklov kot osnutek naročila'); if(b){b.click(); return 'klik';} return 'ni';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const t=document.querySelector('[data-sonner-toast]'); const moj=[...document.querySelectorAll('[role=dialog]')].some(x=>x.textContent.includes('Naročilnica kot osnutek naročila')); return JSON.stringify({toast:t?t.textContent.trim().slice(0,90):null,mojDialogSeOdprt:moj,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z7: temna + odjava + javne poti ---"
agent-browser eval "document.documentElement.classList.add('dark'); JSON.stringify({bg:getComputedStyle(document.body).backgroundColor,err:window.__err??null})" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r205-e2e-temna.png" > /dev/null 2>&1 && echo "screenshot TEMNA OK"
agent-browser click 'button[aria-label="Odjava"]' > /dev/null 2>&1
sleep 3
curl -s -o /dev/null -w "login_status=%{http_code} " http://127.0.0.1:3100/login
curl -s -m 10 http://127.0.0.1:3100/api/public/health | head -c 120; echo
agent-browser eval "(()=>{return JSON.stringify({url:location.pathname});})()" 2>&1 | tail -1

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
agent-browser close --all > /dev/null 2>&1 || true
echo "R205 E2E KONEC"
