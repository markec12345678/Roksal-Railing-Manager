#!/bin/bash
# R217 prod probe — R216 deploy recheck (push 12:11:59 UTC, žig 12:12:25 = ŽIVO)
# + spot MONTER QA. Ključni ŽIVO dokazi:
#   Z1 F1 (P1-d, R216): paleta ⌘K 'Nizka zaloga' → klik artikel → Zaloga
#       AKTIVEN (aria-current) + dialog 'Naročilnica kot osnutek naročila'
#       ODPRT z ISTIM artikelom (deep-link WYSIWYG, brez DB zapisa — Prekliči).
#   Z2 F2 (R216): zvonček stock item → klik → ISTI dialog (konvergenca).
#   Z3: pečati Zaloga/Material V5 + sejni chunk scan (R216/R215 + regresije)
#       + temna rgb(15,23,36) + __err null.
set -u
PROD="https://roksal-railing-manager.vercel.app"

echo "=== version + health (javno) ==="
curl -s "$PROD/api/public/version"; echo
curl -s "$PROD/api/public/health"; echo

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
sleep 2
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12
for i in 1 2 3; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done

echo "=== Z1 F1 ŽIVO: paleta → 'Nizka zaloga' → klik → Zaloga + dialog ==="
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta';} return 'ni iskalnika';})()" 2>&1 | tail -1
sleep 4
# zberi dokaz: skupina vidna + prvi item value, klikni
agent-browser eval "(()=>{const items=[...document.querySelectorAll('[cmdk-item]')].filter(el=>(el.getAttribute('value')||'').startsWith('nizka zaloga ')); if(!items.length) return 'SKUPINA NI VIDNA'; const v=items[0].getAttribute('value'); const txt=items[0].textContent.trim(); items[0].click(); return 'KLIK: '+v+' | '+txt.slice(0,80);})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const act=document.querySelector('nav [aria-current=\"page\"]'); const dlg=[...document.querySelectorAll('[role=\"dialog\"][data-state=\"open\"]')].map(d=>d.querySelector('[data-slot=\"dialog-title\"]')?.textContent||d.textContent.slice(0,60)); const nav=act?act.textContent.trim():'—'; return JSON.stringify({aktiven:nav, dialog:dlg});})()" 2>&1 | tail -1
agent-browser screenshot /tmp/r217-z1-deeplink.png > /dev/null 2>&1
# zapri dialog (Prekliči)
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[role=\"dialog\"][data-state=\"open\"] button')].find(x=>x.textContent.trim()==='Prekliči'); if(b){b.click(); return 'preklicano';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 3

echo "=== Z2 F2 ŽIVO: zvonček stock → dialog (konvergenca) ==="
agent-browser eval "(()=>{const b=document.querySelector('button[aria-label*=\"Obvestila\"]'); if(b){b.click(); return 'zvonček';} return 'ni zvončka';})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const it=[...document.querySelectorAll('[role=\"menuitem\"],[data-slot*=\"item\"],button,div')].filter(e=>e.textContent.includes('Naroči material')&&e.textContent.includes('minimum')); if(!it.length) return 'STOCK ITEM NI VIDEN (morda 0 pod min — iskreno)'; const el=it[it.length-1]; el.click(); return 'KLIK stock: '+el.textContent.trim().slice(0,80);})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=\"dialog\"][data-state=\"open\"]')].map(d=>d.querySelector('[data-slot=\"dialog-title\"]')?.textContent||'?'); const sheet=[...document.querySelectorAll('[data-slot=\"sheet-content\"]')].length; return JSON.stringify({dialog:dlg, sheet});})()" 2>&1 | tail -1
agent-browser screenshot /tmp/r217-z2-bell.png > /dev/null 2>&1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[role=\"dialog\"][data-state=\"open\"] button')].find(x=>x.textContent.trim()==='Prekliči'); if(b){b.click(); return 'preklicano';} return 'ni gumba (ESC)';})()" 2>&1 | tail -1
agent-browser press Escape > /dev/null 2>&1
sleep 3

echo "=== Z3 pečati: Zaloga + Material V5 ==="
agent-browser eval "(()=>{const z=[...document.querySelectorAll('nav button,a')].find(b=>b.textContent.trim()==='Zaloga'); if(z){z.click(); return 'klik Zaloga';} return 'ni';})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const s=[...document.querySelectorAll('span,p,div')].filter(e=>e.childElementCount===0&&e.textContent.includes('Zaloga — stanje po artikel')).length; return 'zaloga pečat span:'+s;})()" 2>&1 | tail -1
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim()==='Več'); if(v){v.click(); return 'klik';} return 'ni ga';})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Material V5')); if(t){t.click(); return 'klik';} return 'ni ga';})()" 2>&1 | tail -1
sleep 8
for i in 1 2; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].filter(x=>x.getAttribute('aria-pressed')!==null).map(x=>x.textContent.trim()+':'+x.getAttribute('aria-pressed')).slice(0,5); return JSON.stringify(b);})()" 2>&1 | tail -1

echo "--- sejni chunk scan (R216/R215 needleji + regresije) ---"
agent-browser eval "(async()=>{const u=window.performance.getEntriesByType('resource').map(e=>e.name).filter(n=>n.includes('/_next/static/chunks/')&&n.endsWith('.js')); const iz={}; const needli=['Nizka zaloga','Shrani kot osnutek','Naroči material','Naročilnica kot osnutek naročila','Material — Naročila (V5)','Odpri naročila','aria-current','Prikaži Vse','orders-active','Naročila, ki čakajo na dejanje','Meritev ni bilo mogoče naložiti','Osveženo ob']; for(const url of u){try{const t=await (await fetch(url)).text(); for(const n of needli){if(t.includes(n)) iz[n]=(iz[n]||0)+1;}}catch(e){}} return JSON.stringify({chunkov:u.length,zadetki:iz,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- temna + __err ---"
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); const bg=getComputedStyle(document.body).backgroundColor; document.documentElement.classList.remove('dark'); return 'temna bg: '+bg;})()" 2>&1 | tail -1
agent-browser eval "window.__err ?? 'err-null'" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1
echo "=== KONEC r217-prod-probe ==="
