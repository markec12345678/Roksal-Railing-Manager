#!/bin/bash
# R208 E2E ŽIVO (vzorec r206/r207): standalone :3100, ADMIN (ci@roksal.si),
# Material → Naročila → R208 preklic naročila + števec aktivnih naročil:
#  Z0 prijava ADMIN + zapri onboarding
#  Z1 chips ŽIVO + F2 badge na zavihku 'Naročila' (izpeljanka iz realnih naročil) + pečat
#  Z2 'Prekliči' (OSNUTEK/POSLANO/POTRJENO kartica) → dialog ŽIVO (naslov,
#     končno stanje, iskren 'ne obvesti dobavitelja', povzetek) → screenshot →
#     'Prekliči' (dialog) → NIC poslano (chipi nespremenjeni, dialog zaprt)
#  Z3 ponovno → 'Potrdi preklic' → toast 'Označeno kot preklicano (status
#     PREKlicANO)' + 'Brez stranskih učinkov …' + chip 'PREKlicANO (1)' +
#     značka PREKlicANO na kartici + F2 badge padec za 1
#  Z4 DB zanka: /api/material-orders status PREKlicANO + /api/inventory
#     zaloga Inox Vijak M12 A4 ŠE VEDNO 65 (preklic = brez stranskih učinkov)
#  Z5 strazar: DOBLJENO kartica NIMA gumba 'Prekliči' (ireverzibilen prejem)
#  Z6 CSV regresija (kontrakt R140: VSA naročila)
#  Z7 temna rgb(15,23,36) + __err null + health + odjava + port sproščen
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
setsid node .next/standalone/server.js > /tmp/R208-server-e2e.log 2>&1 < /dev/null &
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

echo "--- Z1: Material V5 → 'Naročila' → chips + F2 badge ŽIVO ---"
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
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(x=>x.textContent.trim().startsWith('Naročila')); if(t){t.click(); return 'klik';} return 'ni zavihka';})()" 2>&1 | tail -1
sleep 5
agent-browser eval "(()=>{const chipi=[...document.querySelectorAll('[role=group][aria-label=\"Filter naročil po statusu\"] button')].map(b=>b.textContent.trim()); const zavihek=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Naročila')&&b.querySelector('svg')); const badge=zavihek&&zavihek.querySelector('span[title*=\"iz zadnjega nalaganja\"]'); const pecat=[...document.querySelectorAll('span')].filter(e=>e.textContent.trim().startsWith('Osveženo ob')).map(e=>e.textContent.trim())[0]||null; return JSON.stringify({chipi,badge:badge?badge.textContent.trim():null,pecat,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z2: 'Prekliči' → dialog ŽIVO → Prekliči (nič ne pošlje) ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Prekliči'); if(b){b.click(); return 'klik';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=alertdialog],[role=dialog]')].find(d=>d.textContent.includes('Preklic naročila')); if(!dlg) return JSON.stringify({dialog:false}); return JSON.stringify({dialog:true,naslov:dlg.textContent.includes('Preklic naročila'),opisDobavitelj:dlg.textContent.includes('bo označeno kot PREKlicANO'),koncnoStanje:dlg.textContent.includes('Preklic je končno stanje — nazaj v OSNUTEK, POSLANO ali POTRJENO ni mogoče.'),neObvesti:dlg.textContent.includes('Aplikacija ne obvesti dobavitelja — preklic sporoči sam (telefon/e-pošta).'),povzetek:/\d+ artiklov · \d+ €/.test(dlg.textContent),brezUcinkov:dlg.textContent.includes('brez stranskih učinkov (zaloga ostane nespremenjena).'),potrdi:[...dlg.querySelectorAll('button')].some(b=>b.textContent.trim()==='Potrdi preklic'),preklici:[...dlg.querySelectorAll('button')].some(b=>b.textContent.trim()==='Prekliči')});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r208-e2e-preklic-dialog.png" > /dev/null 2>&1
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=alertdialog],[role=dialog]')].find(d=>d.textContent.includes('Preklic naročila')); if(!dlg) return 'ni dialoga'; const b=[...dlg.querySelectorAll('button')].find(x=>x.textContent.trim()==='Prekliči'); if(b){b.click(); return 'preklicano';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const dialogSe=[...document.querySelectorAll('[role=alertdialog],[role=dialog]')].some(d=>d.textContent.includes('Preklic naročila')); const chipi=[...document.querySelectorAll('[role=group][aria-label=\"Filter naročil po statusu\"] button')].map(b=>b.textContent.trim()); return JSON.stringify({dialogZaprt:!dialogSe,chipiNespremenjeni:chipi});})()" 2>&1 | tail -1

echo "--- Z3: ponovno → 'Potrdi preklic' → PREKlicANO ŽIVO ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Prekliči'); if(b){b.click(); return 'klik';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=alertdialog],[role=dialog]')].find(d=>d.textContent.includes('Preklic naročila')); if(!dlg) return 'ni dialoga'; const b=[...dlg.querySelectorAll('button')].find(x=>x.textContent.trim()==='Potrdi preklic'); if(b){b.click(); return 'potrjeno';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 5
agent-browser eval "(()=>{const toasti=[...document.querySelectorAll('[role=status],li[data-state]')].map(e=>e.textContent.trim()).filter(t=>t.includes('preklicano')||t.includes('Brez stranskih učinkov')); const chipi=[...document.querySelectorAll('[role=group][aria-label=\"Filter naročil po statusu\"] button')].map(b=>b.textContent.trim()); const prekZnake=[...document.querySelectorAll('*')].filter(e=>e.textContent.trim()==='PREKlicANO'&&e.children.length===0).length; const zavihek=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Naročila')&&b.querySelector('svg')); const badge=zavihek&&zavihek.querySelector('span[title*=\"iz zadnjega nalaganja\"]'); return JSON.stringify({toasti:toasti.slice(0,2),chipi,preklicanoZnake:prekZnake,badgePo:badge?badge.textContent.trim():null,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z4: DB zanka (PREKlicANO + zaloga NESPREMENJENA) ---"
agent-browser eval "(async()=>{const r=await fetch('/api/material-orders'); const o=await r.json(); const stat=o.map(x=>x.status); const inv=await (await fetch('/api/inventory')).json(); const inox=Array.isArray(inv)?inv.find(i=>i.sifraMateriala==='INOX-M12-A4'):null; return JSON.stringify({statusi:stat,inoxZaloga:inox&&inox.kolicinaZaloga,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z5: strazar — DOBLJENO kartica brez 'Prekliči' ---"
agent-browser eval "(()=>{const chip=[...document.querySelectorAll('[role=group][aria-label=\"Filter naročil po statusu\"] button')].find(b=>b.textContent.trim().startsWith('DOBLJENO')); if(chip) chip.click(); return !!chip;})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const kartice=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Kopiraj naročilnico naročila pri')).length; const prekliciNaKartici=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Prekliči').length; return JSON.stringify({dobljenoKartice:kartice,prekliciGumbi:prekliciNaKartici});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const chip=[...document.querySelectorAll('[role=group][aria-label=\"Filter naročil po statusu\"] button')].find(b=>b.textContent.trim().startsWith('Vsi')); if(chip){chip.click(); return 'klik Vsi';} return 'ni chipa';})()" > /dev/null 2>&1
sleep 2

echo "--- Z6: CSV regresija (R140 kontrakt) ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='CSV'); if(b){b.click(); return 'klik';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const t=[...document.querySelectorAll('[role=status],li[data-state]')].map(e=>e.textContent.trim()).find(t=>t.includes('CSV prenesen')); return JSON.stringify({csvToast:t||null});})()" 2>&1 | tail -1

echo "--- Z7: temna + __err + health + odjava ---"
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return getComputedStyle(document.body).backgroundColor;})()" 2>&1 | tail -1
agent-browser eval "(()=>{return JSON.stringify({err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r208-e2e-temna.png" > /dev/null 2>&1
curl -s -m 10 http://127.0.0.1:3100/api/public/health | head -c 200; echo
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button,[aria-label]')].find(x=>(x.getAttribute('aria-label')||'').includes('Odjava')||x.textContent.trim()==='Odjava'); if(b){b.click(); return 'klik';} return 'ni';})()" > /dev/null 2>&1
sleep 3
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
agent-browser close --all > /dev/null 2>&1 || true
echo "R208 E2E KONEC"
