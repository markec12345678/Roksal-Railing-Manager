#!/bin/bash
# R208 QA — R207 deploy fingerprinti (checklist iz worklog R207 zaključka):
# (a) žig prek /api/public/version + health; (b) javni chunki (UI stringi):
#     prejem-dialog, idempotenten toast, statusni filter; (c) spot MONTER:
#     chips + značke + pečati; (d) regresije: offline pas, temna, __err.
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
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')).map(b=>b.getAttribute('aria-label')); return JSON.stringify({url:location.pathname,orodja:h,err:window.__err??null});})()" 2>&1 | tail -1

echo "=== C) Material V5 → Naročila: R207 fingerprinti ŽIVO ==="
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
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,[role=tab]')].find(b=>b.textContent.trim()==='Naročila'); if(t){t.click(); return 'klik';} return 'ni ga';})()" > /dev/null 2>&1
sleep 6
echo "--- C1) chips + značke + gumbi prejema (R207) ---"
agent-browser eval "(()=>{const chipi=[...document.querySelectorAll('[role=group][aria-label=\"Filter naročil po statusu\"] button')].map(b=>b.textContent.trim()); const dobljeno=[...document.querySelectorAll('*')].filter(e=>e.textContent.trim()==='DOBLJENO'&&e.children.length===0).length; const dialogGumbi=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Dobljeno (v zalogo)').length; const nарoc=[...document.querySelectorAll('button[aria-label^=\"Kopiraj naročilnico naročila pri\"]')].length; return JSON.stringify({chipi,dobljenoZetoni:dobljeno,prejemDialogGumbi:dialogGumbi,narocilnicaGumbi:nарoc,err:window.__err??null});})()" 2>&1 | tail -1
echo "--- C2) sejni chunk scan (R207 needleji) ---"
agent-browser eval "(async()=>{const u=window.performance.getEntriesByType('resource').map(e=>e.name).filter(n=>n.includes('/_next/static/chunks/')&&n.endsWith('.js')); const iz={}; const needli=['Prejem materiala v zalogo','Potrdi prejem','Zaloga ni bila podvojena (idempotenten prejem)','Filter naročil po statusu','Ni naročil s statusom']; for(const url of u){try{const t=await (await fetch(url)).text(); for(const n of needli){if(t.includes(n)) iz[n]=(iz[n]||0)+1;}}catch(e){}} return JSON.stringify({chunkov:u.length,zadetki:iz,err:window.__err??null});})()" 2>&1 | tail -1

echo "=== D) regresije: Zaloga pečat, offline pas, temna, __err ==="
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,[role=tab]')].find(b=>b.textContent.trim()==='Zaloga'); if(t){t.click(); return 'klik';} return 'ni ga';})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const pecat=[...document.querySelectorAll('span')].map(e=>e.textContent.trim()).find(t=>t.startsWith('Osveženo ob')); const nar=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Naročilnica').length; const osn=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Osnutek').length; return JSON.stringify({zalogaPecat:pecat||null,narocilnicaGumb:nar,osnutekGumb:osn,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const btn=document.querySelector('button[aria-label=\"Preklopi na temni način\"]')||[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').toLowerCase().includes('temn')); if(btn){btn.click(); return 'klik';} return 'ni ga';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const bg=getComputedStyle(document.body).backgroundColor; return JSON.stringify({temnaBg:bg,err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const btn=document.querySelector('button[aria-label=\"Preklopi na svetli način\"]')||[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').toLowerCase().includes('svetl')); if(btn){btn.click(); return 'klik';} return 'ni ga';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const pas=[...document.querySelectorAll('*')].filter(e=>e.childElementCount===0&&e.textContent.trim()==='Ponovno povezava vzpostavljena').length; const off=[...document.querySelectorAll('[role=status]')].filter(e=>e.textContent.includes('Ni povezave')).length; return JSON.stringify({pasOff:off,err:window.__err??null});})()" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1 || true
echo "R208 PROD PROBE KONEC"
