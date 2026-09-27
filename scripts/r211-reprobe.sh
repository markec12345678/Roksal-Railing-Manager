#!/bin/bash
# R211 reprobe — dve probe popravki iz E2E:
#  (1) Z2 pečat: prej iskal 'naročil' V textContent (je samo v title) → zdaj
#      iskren lookup: p.textContent vsebuje 'Osveženo ob' znotraj kartice.
#  (2) Z4 meritve alert: prej klik na Card ovojnico (textContent ujemanje) →
#      zdaj PRECIZEN klik na header `div.cursor-pointer.select-none`
#      (edinstven razred vrstice 'Meritve tega projekta').
#  Plus: DB osnova (aktivna naročila po čiščenju) + happy pot z RESTORE fetchem.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
setsid node .next/standalone/server.js > /tmp/R211-server-reprobe.log 2>&1 < /dev/null &
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

echo "--- DB osnova: aktivna naročila po čiščenju (deterministična osnova) ---"
agent-browser eval "(async()=>{const o=await (await fetch('/api/material-orders')).json(); const st={}; let tmp=null; for(const x of o){st[x.status]=(st[x.status]||0)+1; if(x.opombe&&x.opombe.includes('_r211-pecat')) tmp=x.status;} return JSON.stringify({skupaj:o.length,statusi:st,tmpNarociloStatus:tmp});})()" 2>&1 | tail -1

echo "--- P1: pečat ŽIVO (popravljen lookup) ---"
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'dashboard'}})); return 'poslano';})()" > /dev/null 2>&1
sleep 7
for i in 1 2 3 4; do
  REZ=$(agent-browser eval "(()=>{const kartice=[...document.querySelectorAll('div')].filter(e=>e.textContent.includes('Naročila, ki čakajo na dejanje')&&e.textContent.includes('iz zadnjega nalaganja')); const pecat=kartice.length?kartice[0].textContent.match(/Osveženo ob \d{2}:\d{2}:\d{2}/):null; const tabular=kartice.length?kartice[0].innerHTML.includes('tabular-nums'):false; const title=kartice.length?kartice[0].innerHTML.includes('Čas zadnje uspešne osvežitve naročil'):false; return JSON.stringify({poskus:$i,kartica:kartice.length>0,pecat:pecat?pecat[0]:null,tabular,iskrenTitle:title,err:window.__err??null});})()" 2>&1 | tail -1)
  echo "$REZ"
  echo "$REZ" | rg -q 'pecat":"Osveženo' && break
  sleep 3
done

echo "--- P2: meritve fail-verbose ŽIVO (precizen header klik) ---"
agent-browser eval "(()=>{window.__origFetch=window.fetch; window.fetch=(u,...a)=>String(u).includes('/api/measurements?')?Promise.resolve(new Response(JSON.stringify({error:'R211 E2E izklop meritvenega vira'}),{status:500})):window.__origFetch(u,...a); return 'patched';})()" > /dev/null 2>&1
agent-browser eval "(()=>{const vrsta=[...document.querySelectorAll('div')].find(e=>e.className&&String(e.className).includes('cursor-pointer')&&String(e.className).includes('card-hover')); if(vrsta){vrsta.click(); return 'klik';} return 'ni vrst';})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const h=document.querySelector('[role=dialog] div.cursor-pointer.select-none'); if(h){h.click(); return 'klik-header';} return 'ni headerja';})()" 2>&1 | tail -1
sleep 2
for i in 1 2 3; do
  REZ=$(agent-browser eval "(()=>{const dialog=document.querySelector('[role=dialog]'); if(!dialog) return JSON.stringify({poskus:$i,dialogOdprt:false}); const alert=[...dialog.querySelectorAll('[role=alert]')].find(e=>e.textContent.includes('Meritev ni bilo mogoče naložiti')); const znacka=[...dialog.querySelectorAll('span')].find(s=>s.textContent.trim()==='!'); const retry=[...dialog.querySelectorAll('button')].find(b=>b.textContent.trim()==='Poskusi znova'); return JSON.stringify({poskus:$i,alert:!!alert,razlog:alert?alert.textContent.includes('Napaka strežnika (500).'):false,zmackaVzklic:!!znacka,retryGumb:!!retry,err:window.__err??null});})()" 2>&1 | tail -1)
  echo "$REZ"
  echo "$REZ" | rg -q 'razlog":true' && break
  sleep 3
done
echo "--- P2b: Poskusi znova → alert ostane (vir še vedno pade) + razlog iz telesa ---"
agent-browser eval "(()=>{const retry=[...document.querySelectorAll('[role=dialog] button')].find(b=>b.textContent.trim()==='Poskusi znova'); if(retry){retry.click(); return 'klik';} return 'ni ga';})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const dialog=document.querySelector('[role=dialog]'); const alert=[...dialog?dialog.querySelectorAll('[role=alert]'):[]].find(e=>e.textContent.includes('Meritev ni bilo mogoče naložiti')); return JSON.stringify({alertPoRetry:!!alert,razlogIzTela:alert?alert.textContent.includes('R211 E2E izklop meritvenega vira'):false,err:window.__err??null});})()" 2>&1 | tail -1

echo "--- P3: RESTORE fetch → happy pot (alert IZGINI, podatki/iskreno prazno) ---"
agent-browser eval "(()=>{window.fetch=window.__origFetch; return 'restored';})()" > /dev/null 2>&1
agent-browser eval "(()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return 'esc';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const vrsta=[...document.querySelectorAll('div')].find(e=>e.className&&String(e.className).includes('cursor-pointer')&&String(e.className).includes('card-hover')); if(vrsta){vrsta.click(); return 'klik';} return 'ni vrst';})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const h=document.querySelector('[role=dialog] div.cursor-pointer.select-none'); if(h){h.click(); return 'klik-header';} return 'ni headerja';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const dialog=document.querySelector('[role=dialog]'); const alerti=[...dialog?dialog.querySelectorAll('[role=alert]'):[]].filter(e=>e.textContent.includes('mogoče naložiti')).length; const vrstice=[...dialog?dialog.querySelectorAll('div.rounded-lg'):[]].filter(e=>e.className.includes('border-border/40')).length; const prazno=dialog?dialog.textContent.includes('Ni meritev za ta projekt'):false; return JSON.stringify({alertiPoRestore:alerti,meritveneVrstice:vrstice,iskrenoPrazno:prazno,err:window.__err??null});})()" 2>&1 | tail -1

agent-browser eval "(()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return 'esc';})()" > /dev/null 2>&1
sleep 1
agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R211 REPROBE KONEC"
