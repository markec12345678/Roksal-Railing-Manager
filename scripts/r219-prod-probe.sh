#!/bin/bash
# R219 prod probe — R218 deploy recheck (build 13:46:46 > R217 13:14:20 = ŽIVO)
# + spot MONTER QA. Dokazi (fingerprints iz workloga R218):
#   Z1 R218 F1 (P1-e) ŽIVO: zgodovina z opcijskim žigom — seed localStorage
#      (nova shema {q,nizkaZaloga:true} + STARA shema goli niz) → paleta brez
#      poizvedbe → 'inox vijak' NOSI badge 'Nizka zaloga' (roksal-red), goli
#      niz BREZ žiga (fail-closed ŽIVO, nič ne pade).
#   Z2 'Počisti nedavna iskanja' ŽIVO: klik → zgodovina izgine (istovetno
#      čiščenje = higiena seje).
#   Z3 R217 F1 REGRESIJA: iskanje 'Inox' (native setter — fill NE dela na
#      cmdk-input) → Material zadetek z badgeom → klik → Zaloga AKTIVEN +
#      dialog ISTI artikel → Prekliči (0 DB zapisov).
#   Z4 sejni chunk scan (R218 needleji + regresije) + temna + __err.
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

echo "=== Z1 R218 F1 ŽIVO: zgodovina z žigom (nova + stara shema) ==="
agent-browser eval "(()=>{try{window.localStorage.setItem('roksal:recent-searches', JSON.stringify([{q:'inox vijak',nizkaZaloga:true},'kolo profil'])); return 'sejano: nova shema + goli niz';}catch(e){return 'napaka: '+e.message;}})()" 2>&1 | tail -1
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta';} return 'ni iskalnika';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const items=[...document.querySelectorAll('[cmdk-item]')].filter(el=>(el.getAttribute('value')||'').startsWith('nedavno ')); return JSON.stringify(items.map(el=>({v:el.getAttribute('value'), tekst:el.textContent.trim().slice(0,60), badge:el.textContent.includes('Nizka zaloga'), red:!!el.querySelector('[class*=\"roksal-red\"]')})));})()" 2>&1 | tail -1

echo "=== Z2 'Počisti nedavna iskanja' ŽIVO (higiena) ==="
agent-browser eval "(()=>{const c=[...document.querySelectorAll('[cmdk-item]')].find(el=>(el.getAttribute('value')||'')==='počisti nedavna iskanja'); if(!c) return 'NI ČISTILNE VRSTICE'; c.click(); return 'klik počisti';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const preostalo=[...document.querySelectorAll('[cmdk-item]')].filter(el=>(el.getAttribute('value')||'').startsWith('nedavno ')).length; const ls=window.localStorage.getItem('roksal:recent-searches'); return JSON.stringify({preostaleZgodovine:preostalo, localStorage:ls});})()" 2>&1 | tail -1
agent-browser press Escape > /dev/null 2>&1
sleep 2

echo "=== Z3 R217 REGRESIJA: iskanje 'Inox' → badge → klik → Zaloga + dialog ==="
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik')); if(t){t.click(); return 'paleta';} return 'ni iskalnika';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const inp=document.querySelector('[cmdk-input]'); if(!inp) return 'ni inputa'; const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; set.call(inp,'Inox'); inp.dispatchEvent(new Event('input',{bubbles:true})); return 'vneseno Inox';})()" 2>&1 | tail -1
sleep 5
agent-browser eval "(()=>{const items=[...document.querySelectorAll('[cmdk-item]')]; const hit=items.find(el=>(el.getAttribute('aria-label')||'').includes('odpre naročilni tok')); if(!hit) return 'ZADETEK NI VIDEN'; const al=hit.getAttribute('aria-label'); const red=!!hit.querySelector('[class*=\"roksal-red\"]'); const tn=hit.textContent.includes('Nizka zaloga'); hit.click(); return 'KLIK | aria-label: '+al+' | badge-tekst:'+tn+' | roksal-red:'+red;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const act=document.querySelector('nav [aria-current=\"page\"]'); const dlg=[...document.querySelectorAll('[role=\"dialog\"][data-state=\"open\"]')].map(d=>d.querySelector('[data-slot=\"dialog-title\"]')?.textContent||d.textContent.slice(0,60)); const nav=act?act.textContent.trim():'—'; return JSON.stringify({aktiven:nav, dialog:dlg});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[role=\"dialog\"][data-state=\"open\"] button')].find(x=>x.textContent.trim()==='Prekliči'); if(b){b.click(); return 'preklicano';} return 'ni gumba';})()" 2>&1 | tail -1
sleep 2
agent-browser press Escape > /dev/null 2>&1
sleep 2

echo "--- sejni chunk scan (R218 needleji + regresije) ---"
agent-browser eval "(async()=>{const u=window.performance.getEntriesByType('resource').map(e=>e.name).filter(n=>n.includes('/_next/static/chunks/')&&n.endsWith('.js')); const iz={}; const needli=['nizka zaloga pokaži vse','Pokaži vse s nizko zalogo v Zalogi','Počisti nedavna iskanja','nizka zaloga, odpre naročilni tok','Kopiraj naročilnico za artikel','odpre Zalogo in naročilni tok','Naročilnica kot osnutek naročila','Nizka zaloga','Naroči material','Shrani kot osnutek','Material — Naročila (V5)','Meritev ni bilo mogoče naložiti','Osveženo ob']; for(const url of u){try{const t=await (await fetch(url)).text(); for(const n of needli){if(t.includes(n)) iz[n]=(iz[n]||0)+1;}}catch(e){}} return JSON.stringify({chunkov:u.length,zadetki:iz,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- temna + __err ---"
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); const bg=getComputedStyle(document.body).backgroundColor; document.documentElement.classList.remove('dark'); return 'temna bg: '+bg;})()" 2>&1 | tail -1
agent-browser eval "window.__err ?? 'err-null'" 2>&1 | tail -1

echo "--- higiena: čist localStorage zgodovine (seja) ---"
agent-browser eval "(()=>{window.localStorage.removeItem('roksal:recent-searches'); return 'čiščeno';})()" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1
echo "=== KONEC r219-prod-probe ==="
