#!/bin/bash
# R214 QA — produkcijski probe.
# Kontekst: R213 push ~10:0x UTC, build 10:00:28; zdaj 18:30+ (~8.5h kasneje)
# → R213 deploy ŽIVO pričakovan. Fingerprints iz R213 "Zaključek runde":
# (a) žig prek /api/public/version — pričakovano R213 build (> 09:27:49);
# (b) javni chunki: R213 needleji 'Prikaži Vse' ≥1 + regresije;
# (c) spot MONTER: Material/Zaloga pečati, temna, offline pas 0, __err null.
# Branje-le: NI zapisov v produkcijsko bazo.
set -u
PROD="https://roksal-railing-manager.vercel.app"

echo "=== A) javni žig + health ==="
curl -s --max-time 20 "$PROD/api/public/version" | head -c 400; echo
curl -s --max-time 20 -o /dev/null -w "health: %{http_code}\n" "$PROD/api/public/health"
curl -s --max-time 20 "$PROD/api/public/health"; echo

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
echo "=== B) spot MONTER prijava ==="
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
agent-browser eval "(()=>{return JSON.stringify({url:location.pathname,err:window.__err??null});})()" 2>&1 | tail -1

echo "=== C) Material V5 → pečati (build-neodvisna osnova) ==="
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return !!h;})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim()==='Več'); if(v){v.click(); return 'klik';} return 'ni ga';})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Material V5')); if(t){t.click(); return 'klik';} return 'ni ga';})()" > /dev/null 2>&1
sleep 8
for i in 1 2; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done
agent-browser eval "(()=>{const pecat=[...document.querySelectorAll('span')].map(e=>e.textContent.trim()).find(t=>t.startsWith('Osveženo ob')); return JSON.stringify({materialPecat:pecat||null,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,[role=tab]')].find(b=>b.textContent.trim()==='Zaloga'); if(t){t.click(); return 'klik';} return 'ni ga';})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const pecat=[...document.querySelectorAll('span')].map(e=>e.textContent.trim()).find(t=>t.startsWith('Osveženo ob')); return JSON.stringify({zalogaPecat:pecat||null,err:window.__err??null});})()" 2>&1 | tail -1

echo "=== D) sejni chunk scan (R213 needleji + regresije) ==="
agent-browser eval "(async()=>{const u=window.performance.getEntriesByType('resource').map(e=>e.name).filter(n=>n.includes('/_next/static/chunks/')&&n.endsWith('.js')); const iz={}; const needli=['Prikaži Vse','Nizka zaloga, današnje montaže, naročila','orders-active','ni aktivnih naročil','Ni naročil s statusom','Meritev ni bilo mogoče naložiti','Stanja ne izmišljujemo','Osveženo ob','Preklic naročila','Poskusi znova']; for(const url of u){try{const t=await (await fetch(url)).text(); for(const n of needli){if(t.includes(n)) iz[n]=(iz[n]||0)+1;}}catch(e){}} return JSON.stringify({chunkov:u.length,zadetki:iz,err:window.__err??null});})()" 2>&1 | tail -1

echo "=== E) temna + offline pas ==="
agent-browser eval "(()=>{const btn=document.querySelector('button[aria-label=\"Preklopi na temni način\"]')||[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').toLowerCase().includes('temn')); if(btn){btn.click(); return 'klik';} return 'ni ga';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const bg=getComputedStyle(document.body).backgroundColor; const pas=[...document.querySelectorAll('[role=status]')].filter(e=>e.textContent.includes('Ni povezave')).length; return JSON.stringify({temnaBg:bg,offlinePas:pas,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const btn=document.querySelector('button[aria-label=\"Preklopi na svetli način\"]')||[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').toLowerCase().includes('svetl')); if(btn){btn.click(); return 'klik';} return 'ni ga';})()" > /dev/null 2>&1
sleep 2
echo "=== F) zvonček (spot: pričakovano brez orders digesta — spot baza 0 aktivnih naročil) ==="
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').includes('Obvestila')); if(!b) return JSON.stringify({zvoncek:false}); b.click(); return JSON.stringify({zvoncek:true});})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const sheet=document.querySelector('[role=dialog]'); const v=sheet?sheet.textContent:''; return JSON.stringify({odprt:!!sheet,omsnippet:v.slice(0,180),err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const x=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('Zapri')); if(x){x.click(); return 'zaprl';} return 'ni';})()" > /dev/null 2>&1
sleep 2
echo "=== G) odjava + končni health ==="
agent-browser eval "(()=>{const o=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim()==='Odjava'||(b.getAttribute('aria-label')||'').includes('Odjava')); if(o){o.click(); return 'klik';} return 'ni ga';})()" > /dev/null 2>&1
sleep 4
agent-browser close --all > /dev/null 2>&1 || true
curl -s --max-time 20 "$PROD/api/public/health"; echo
echo "=== KONEC r214-prod-probe ==="
