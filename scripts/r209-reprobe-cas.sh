#!/bin/bash
# R209 reprobe: časovni žig zgodovine s POPRAVLJENIM regexom (sl-SI datum
# ima presledke: '27. 09. 2026 ob 09:55:01' — prejšnja probe je bila lažna
# negativa, vzorec R190 offline-pas lookup lekcije).
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
setsid node .next/standalone/server.js > /tmp/R209-reprobe.log 2>&1 < /dev/null &
sleep 4
agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 8
for i in 1 2 3; do agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 1;} return 0;})()" > /dev/null 2>&1; sleep 1; done
agent-browser eval "(()=>{const h=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(h) h.click(); return 1;})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'); if(v) v.click(); return 1;})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.includes('Material V5')); if(t) t.click(); return 1;})()" > /dev/null 2>&1
sleep 6
for i in 1 2; do agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 1;} return 0;})()" > /dev/null 2>&1; sleep 1; done
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Naročila')&&x.querySelector('svg')); if(t) t.click(); return 1;})()" > /dev/null 2>&1
sleep 4
echo "--- Zgodovina na POTRJENO kartici (2 dogodka iz E2E Z3/Z4) ---"
agent-browser eval "(()=>{const pot=[...document.querySelectorAll('*')].filter(e=>e.textContent.trim()==='POTRJENO'&&e.children.length===0).length; const b=[...document.querySelectorAll('button[aria-label^=\"Zgodovina prehodov naročila pri\"]')].find(x=>{const c=x.closest('div[data-slot=card]')||x.closest('.rounded-b-lg')||x.closest('div.rounded-xl'); return c?c.textContent.includes('POTRJENO'):false;}); if(b){b.click(); return 'klik,POTRJENOznake:'+pot;} return 'ni gumba';})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const reg=[...document.querySelectorAll('[role=region][aria-label^=\"Zgodovina prehodov naročila pri\"]')][0]; if(!reg) return JSON.stringify({panel:false}); return JSON.stringify({panel:true,dogodki:reg.querySelectorAll('li').length,casPopravljeniRegex:/\d\d\.\s*\d\d\.\s*\d\d\d\d ob \d\d:\d\d:\d\d/.test(reg.textContent),vzorecCasa:(reg.textContent.match(/\d\d\.\s*\d\d\.\s*\d\d\d\d ob \d\d:\d\d:\d\d/)||[null])[0]});})()" 2>&1 | tail -1
agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R209 REPROBE KONEC"
