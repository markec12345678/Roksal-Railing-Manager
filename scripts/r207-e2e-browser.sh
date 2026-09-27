#!/bin/bash
# R207 E2E ŽIVO (vzorec r206): standalone :3100, ADMIN (ci@roksal.si),
# Material → Naročila → R207 statusni filter + potrditveni dialog prejema:
#  Z0 prijava ADMIN + zapri onboarding
#  Z1 chips ŽIVO: 'Vsi (n)' + statusi s števci iz realnih naročil + pečat
#  Z2 priprava POTRJENO: klik 'Potrdi' na POSLANO naročilu (R206 regresija)
#  Z3 klik 'Dobljeno (v zalogo)' → dialog ŽIVO (postavke + idempotenca) →
#     Prekliči → status ŠE VEDNO POTRJENO (nič ne pošlje — fail-closed UI)
#  Z4 ponovno → 'Potrdi prejem' → toast 'Dobljeno — material v zalogi' +
#     'Zaloga je posodobljena.' + značka DOBLJENO + chip DOBLJENO (1)
#  Z5 DB zanka: /api/material-orders status DOBLJENO + datumDobave + /api/inventory
#     zaloga Inox Vijak M12 A4 = 15 + 50 = 65 (idempotenten prejem RES prejel)
#  Z6 filter: chip DOBLJENO → 1 kartica; chip OSNUTEK → 2; Vsi → 3
#  Z7 CSV regresija (kontrakt R140: VSA naročila)
#  Z8 temna rgb(15,23,36) + __err null + health + odjava + port sproščen
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
setsid node .next/standalone/server.js > /tmp/R207-server-e2e.log 2>&1 < /dev/null &
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

echo "--- Z1: Material V5 → 'Naročila' → chips ŽIVO ---"
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
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Naročila'); if(t){t.click(); return 'klik';} return 'ni zavihka';})()" 2>&1 | tail -1
sleep 5
agent-browser eval "(()=>{const chipi=[...document.querySelectorAll('[role=group][aria-label=\"Filter naročil po statusu\"] button')].map(b=>b.textContent.trim()); const oznaci=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Označi kot poslano').length; const potrdi=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Potrdi').length; const pecat=[...document.querySelectorAll('span')].filter(e=>e.textContent.trim().startsWith('Osveženo ob')).map(e=>e.textContent.trim())[0]||null; return JSON.stringify({chipi,potrdiGumbi:potrdi,oznaciPoslanoGumbi:oznaci,pecat,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z2: klik 'Potrdi' na POSLANO naročilu (priprava POTRJENO) ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Potrdi'); if(b){b.click(); return 'klik';} return 'ni gumba (ni POSLANO naročil)';})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const chipi=[...document.querySelectorAll('[role=group][aria-label=\"Filter naročil po statusu\"] button')].map(b=>b.textContent.trim()); const dobljenoGumbi=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Dobljeno (v zalogo)').length; return JSON.stringify({chipi,dobljenoGumbi,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z3: 'Dobljeno (v zalogo)' → dialog → Prekliči (nič ne pošlje) ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Dobljeno (v zalogo)'); if(b){b.click(); return 'klik';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=alertdialog],[role=dialog]')].find(d=>d.textContent.includes('Prejem materiala v zalogo')); if(!dlg) return JSON.stringify({dialog:false}); const postavke=dlg.querySelectorAll('[aria-label=\"Postavke za prejem v zalogo\"] > div').length; const idemp=dlg.textContent.includes('Prejem je idempotenten'); const potrdi=[...dlg.querySelectorAll('button')].some(b=>b.textContent.trim()==='Potrdi prejem'); const preklici=[...dlg.querySelectorAll('button')].some(b=>b.textContent.trim()==='Prekliči'); dlg.querySelector('img')??0; return JSON.stringify({dialog:true,postavke,idemp,potrdi,preklici,naslovDobavitelj:dlg.textContent.includes('bo označeno kot DOBLJENO')});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r207-e2e-prejem-dialog.png" > /dev/null 2>&1
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=alertdialog],[role=dialog]')].find(d=>d.textContent.includes('Prejem materiala v zalogo')); if(!dlg) return 'ni dialoga'; const b=[...dlg.querySelectorAll('button')].find(x=>x.textContent.trim()==='Prekliči'); if(b){b.click(); return 'preklicano';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const dialogSe=[...document.querySelectorAll('[role=alertdialog],[role=dialog]')].some(d=>d.textContent.includes('Prejem materiala v zalogo')); const chipi=[...document.querySelectorAll('[role=group][aria-label=\"Filter naročil po statusu\"] button')].map(b=>b.textContent.trim()); return JSON.stringify({dialogSeOdprt:dialogSe,chipi});})()" 2>&1 | tail -1

echo "--- Z4: ponovno → 'Potrdi prejem' → DOBLJENO ŽIVO ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Dobljeno (v zalogo)'); if(b){b.click(); return 'klik';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=alertdialog],[role=dialog]')].find(d=>d.textContent.includes('Prejem materiala v zalogo')); if(!dlg) return 'ni dialoga'; const b=[...dlg.querySelectorAll('button')].find(x=>x.textContent.trim()==='Potrdi prejem'); if(b){b.click(); return 'potrjeno';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const toasti=[...document.querySelectorAll('[role=status],li[data-state]')].map(e=>e.textContent.trim()).filter(t=>t.includes('Dobljeno')||t.includes('zalogi')); const chipi=[...document.querySelectorAll('[role=group][aria-label=\"Filter naročil po statusu\"] button')].map(b=>b.textContent.trim()); const dobljenoGumbi=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Dobljeno (v zalogo)').length; return JSON.stringify({toasti:toasti.slice(0,2),chipi,dobljenoGumbiPo: dobljenoGumbi,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z5: DB zanka (orders + zaloga prek API) ---"
agent-browser eval "(async()=>{const r=await fetch('/api/material-orders'); const o=await r.json(); const zadnji=o.sort((a,b)=>(a.datumNarocila<b.datumNarocila?1:-1))[0]||o[0]; const stat=o.map(x=>x.status); const inv=await (await fetch('/api/inventory')).json(); const inox=Array.isArray(inv)?inv.find(i=>i.sifraMateriala==='INOX-M12-A4'):null; return JSON.stringify({statusi:stat,zadnjiStatus:zadnji&&zadnji.status,zadnjiDatumDobave:zadnji&&zadnji.datumDobave,inoxZaloga:inox&&inox.kolicinaZaloga,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z6: filter chips preklopi ---"
agent-browser eval "(()=>{const chip=[...document.querySelectorAll('[role=group][aria-label=\"Filter naročil po statusu\"] button')].find(b=>b.textContent.trim().startsWith('DOBLJENO')); if(chip){chip.click(); return 'klik DOBLJENO';} return 'ni chipa';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const kartice=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Kopiraj naročilnico naročila pri')).length; return JSON.stringify({karticePoDOBLJENO:kartice});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const chip=[...document.querySelectorAll('[role=group][aria-label=\"Filter naročil po statusu\"] button')].find(b=>b.textContent.trim().startsWith('Vsi')); if(chip){chip.click(); return 'klik Vsi';} return 'ni chipa';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const kartice=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Kopiraj naročilnico naročila pri')).length; return JSON.stringify({karticePoVsi:kartice});})()" 2>&1 | tail -1

echo "--- Z7: CSV regresija (R140 kontrakt) ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='CSV'); if(b){b.click(); return 'klik';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const t=[...document.querySelectorAll('[role=status],li[data-state]')].map(e=>e.textContent.trim()).find(t=>t.includes('CSV prenesen')); return JSON.stringify({csvToast:t||null});})()" 2>&1 | tail -1

echo "--- Z8: temna + javne poti + odjava ---"
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return getComputedStyle(document.body).backgroundColor;})()" 2>&1 | tail -1
agent-browser eval "(()=>{return JSON.stringify({err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r207-e2e-temna.png" > /dev/null 2>&1
curl -s -m 10 http://127.0.0.1:3100/api/public/health | head -c 200; echo
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button,[aria-label]')].find(x=>(x.getAttribute('aria-label')||'').includes('Odjava')||x.textContent.trim()==='Odjava'); if(b){b.click(); return 'klik';} return 'ni';})()" > /dev/null 2>&1
sleep 3
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
agent-browser close --all > /dev/null 2>&1 || true
echo "R207 E2E KONEC"
