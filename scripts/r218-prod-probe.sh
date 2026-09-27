#!/bin/bash
# R218 prod probe — R217 deploy recheck (žig 13:14:20 > R216 12:12:25 = ŽIVO)
# + spot MONTER QA. Ključni ŽIVO dokazi (fingerprints iz workloga R217):
#   Z1 R217 F1 (P1-d) REGRESIJA ŽIVO: paleta ⌘K + iskanje 'Inox' → Material
#      zadetek M12 A4 z badgeom 'Nizka zaloga' → klik → Zaloga AKTIVEN
#      (aria-current) + dialog 'Naročilnica kot osnutek naročila' ODPRT
#      z ISTIM artikelom (deep-link WYSIWYG — Prekliči, brez DB zapisa).
#   Z2 R216 F2 REGRESIJA: zvonček stock item → klik → ISTI dialog.
#   Z3 pečati Zaloga/Material V5 + sejni chunk scan (R217 needleji + regresije)
#      + temna rgb(15,23,36) + __err null.
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

echo "=== Z1 R217 F1 REGRESIJA ŽIVO: iskanje 'Inox' → badge → klik → Zaloga + dialog ==="
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta';} return 'ni iskalnika';})()" 2>&1 | tail -1
sleep 3
agent-browser fill 'input[cmdk-input], [role="dialog"] input' 'Inox' > /dev/null 2>&1
sleep 4
# dokaz: Material zadetek z badgeom 'Nizka zaloga' — nato klik
agent-browser eval "(()=>{const items=[...document.querySelectorAll('[cmdk-item]')].filter(el=>el.textContent.includes('Inox')); if(!items.length) return 'NIZ NI VIDEN'; const hit=items[0]; const badge=hit.textContent.includes('Nizka zaloga'); const v=hit.getAttribute('value')||''; hit.click(); return 'KLIK: '+v+' | badge-nizka-zaloga:'+badge+' | '+hit.textContent.trim().slice(0,90);})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const act=document.querySelector('nav [aria-current=\"page\"]'); const dlg=[...document.querySelectorAll('[role=\"dialog\"][data-state=\"open\"]')].map(d=>d.querySelector('[data-slot=\"dialog-title\"]')?.textContent||d.textContent.slice(0,60)); const nav=act?act.textContent.trim():'—'; return JSON.stringify({aktiven:nav, dialog:dlg});})()" 2>&1 | tail -1
agent-browser screenshot /tmp/r218-z1-badge-deeplink.png > /dev/null 2>&1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[role=\"dialog\"][data-state=\"open\"] button')].find(x=>x.textContent.trim()==='Prekliči'); if(b){b.click(); return 'preklicano';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 3
agent-browser press Escape > /dev/null 2>&1
sleep 2

echo "=== Z2 R216 F2 REGRESIJA: zvonček stock → dialog ==="
agent-browser eval "(()=>{const b=document.querySelector('button[aria-label*=\"Obvestila\"]'); if(b){b.click(); return 'zvonček';} return 'ni zvončka';})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const it=[...document.querySelectorAll('[role=\"menuitem\"],[data-slot*=\"item\"],button,div')].filter(e=>e.textContent.includes('Naroči material')&&e.textContent.includes('minimum')); if(!it.length) return 'STOCK ITEM NI VIDEN (morda 0 pod min — iskreno)'; const el=it[it.length-1]; el.click(); return 'KLIK stock: '+el.textContent.trim().slice(0,80);})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=\"dialog\"][data-state=\"open\"]')].map(d=>d.querySelector('[data-slot=\"dialog-title\"]')?.textContent||'?'); return JSON.stringify({dialog:dlg});})()" 2>&1 | tail -1
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

echo "--- sejni chunk scan (R217 needleji + regresije) ---"
agent-browser eval "(async()=>{const u=window.performance.getEntriesByType('resource').map(e=>e.name).filter(n=>n.includes('/_next/static/chunks/')&&n.endsWith('.js')); const iz={}; const needli=['nizka zaloga, odpre naročilni tok','Kopiraj naročilnico za artikel','odpre Zalogo in naročilni tok','Naročilnica kot osnutek naročila','Nizka zaloga','Naroči material','Shrani kot osnutek','Material — Naročila (V5)','Odpri naročila','Prikaži Vse','Meritev ni bilo mogoče naložiti','Osveženo ob']; for(const url of u){try{const t=await (await fetch(url)).text(); for(const n of needli){if(t.includes(n)) iz[n]=(iz[n]||0)+1;}}catch(e){}} return JSON.stringify({chunkov:u.length,zadetki:iz,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- temna + __err ---"
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); const bg=getComputedStyle(document.body).backgroundColor; document.documentElement.classList.remove('dark'); return 'temna bg: '+bg;})()" 2>&1 | tail -1
agent-browser eval "window.__err ?? 'err-null'" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1
echo "=== KONEC r218-prod-probe ==="
