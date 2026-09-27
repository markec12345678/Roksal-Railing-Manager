#!/bin/bash
# R196 E2E ŽIVO: obvestilo o novi prijavi + R195 regresije.
#   Z0 UI prijava (ADMIN) — ta prijava SAMA ustvari NEW_LOGIN
#   Z1 zvonček: 'Nova prijava v vaš račun' vidna v panelu (z vsebino naprave)
#   Z2 R195 regresija: seje dialog + masovni gumb (curl tuja seja pred tem)
#   Z3 R195 regresija: CSRF toast (napačna glava → 403 → sonner)
#   Z4 javne poti + odjava
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
BASE="http://127.0.0.1:3100"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r196-server-e2e.log 2>&1 < /dev/null &
sleep 5

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$BASE/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12
echo "--- Z0: prijava ---"
agent-browser eval "JSON.stringify({url:location.pathname, err:window.__err??null})" 2>&1 | tail -1

echo "--- Z1: zvonček — NEW_LOGIN viden (ta prijava ga je ustvarila) ---"
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Obvestila')); if(!b) return 'brez zvoncka'; const r=b.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; b.dispatchEvent(new PointerEvent('pointerdown',o)); b.dispatchEvent(new PointerEvent('pointerup',o)); b.dispatchEvent(new MouseEvent('click',o)); return 'zvoncek poslan';})()" 2>&1 | tail -1
sleep 4
agent-browser eval "(()=>{const vsebina=document.body.textContent; const naslov=vsebina.includes('Nova prijava v vaš račun'); const naprava=vsebina.includes('Računalnik ·'); return JSON.stringify({naslovViden:naslov, napravaViden:naprava});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/e2e-r196-zvoncek.png" > /dev/null 2>&1 && echo "screenshot ZVONCEK OK"

echo "--- Z2: R195 regresija — seje dialog + masovni gumb ---"
curl -sS -m 10 -X POST "$BASE/api/auth" -H "Origin: $BASE" -H 'Content-Type: application/json' \
  -d '{"email":"ci@roksal.si","password":"DimniSmoke139!"}' -D /tmp/r196-login2.txt -o /dev/null
TOK2=$(grep -i '^set-cookie: roksal_session=' /tmp/r196-login2.txt | head -1 | sed 's/^[Ss]et-[Cc]ookie: roksal_session=//' | cut -d';' -f1)
ST1=$(curl -sS -m 10 -o /dev/null -w '%{http_code}' "$BASE/api/auth" -H "Authorization: Bearer $TOK2")
echo "tuja seja ŽIVA: $ST1 (pričakovano 200)"
agent-browser eval "(()=>{const z=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Zapri'||(b.getAttribute('aria-label')||'').includes('Zapri')); if(z) z.click(); return 'panel zaprt';})()" > /dev/null 2>&1
sleep 1
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Odjava'); if(!t) return 'brez'; const r=t.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; t.dispatchEvent(new PointerEvent('pointerdown',o)); t.dispatchEvent(new PointerEvent('pointerup',o)); t.dispatchEvent(new MouseEvent('click',o)); return 'meni poslan';})()" > /dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const m=[...document.querySelectorAll('[role=menuitem]')].find(x=>x.textContent.trim().startsWith('Aktivne seje')); if(!m) return 'brez'; const r=m.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; m.dispatchEvent(new PointerEvent('pointerdown',o)); m.dispatchEvent(new PointerEvent('pointerup',o)); m.dispatchEvent(new MouseEvent('click',o)); return 'item poslan';})()" > /dev/null 2>&1
sleep 3
for i in 1 2 3 4 5 6; do
  REZ=$(agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=dialog]')].pop(); if(!dlg) return JSON.stringify({dialog:false}); const g=[...dlg.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Odjavi vse ostale naprave')); return JSON.stringify({dialog:true, vrstice:dlg.querySelectorAll('li').length, gumb:g?g.textContent.trim():null});})()" 2>&1 | tail -1)
  echo "$REZ" | grep -qE 'gumb\\":\\"' && break
  sleep 1
done
echo "$REZ"
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=dialog]')].pop(); const g=[...dlg.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Odjavi vse ostale naprave')); if(!g) return 'brez'; const r=g.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; g.dispatchEvent(new PointerEvent('pointerdown',o)); g.dispatchEvent(new PointerEvent('pointerup',o)); g.dispatchEvent(new MouseEvent('click',o)); return 'arm';})()" > /dev/null 2>&1
sleep 1
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=dialog]')].pop(); const g=[...dlg.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Odjavi vse ostale naprave')); if(!g) return 'brez'; const r=g.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; g.dispatchEvent(new PointerEvent('pointerdown',o)); g.dispatchEvent(new PointerEvent('pointerup',o)); g.dispatchEvent(new MouseEvent('click',o)); return 'izvedba';})()" > /dev/null 2>&1
sleep 4
ST2=$(curl -sS -m 10 -o /dev/null -w '%{http_code}' "$BASE/api/auth" -H "Authorization: Bearer $TOK2")
echo "tuja seja PO masovni revokaciji: $ST2 (pričakovano 401)"

echo "--- Z3: R195 regresija — CSRF toast ---"
agent-browser eval "(async()=>{const zapri=document.querySelector('[data-sonner-toast] [data-close]'); if(zapri) zapri.click(); const dlg=[...document.querySelectorAll('[role=dialog]')].pop(); if(dlg){const z=[...dlg.querySelectorAll('button')].find(b=>b.textContent.trim()==='Zapri'); if(z) z.click();} const r=await fetch('/api/customers',{method:'POST',headers:{'Content-Type':'application/json','x-csrf-token':'naroben-r196'},body:JSON.stringify({ime:'x',naslov:'y'})}); const b=await r.json().catch(()=>({})); return JSON.stringify({status:r.status, dvojniPodpis:JSON.stringify(b).includes('dvojni podpis')});})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const toast=[...document.querySelectorAll('[data-sonner-toast]')].map(t=>t.textContent).find(t=>t.includes('Dejanje je zavrnjeno')); return JSON.stringify({csrfToastViden:!!toast});})()" 2>&1 | tail -1

echo "--- Z4: javne poti + odjava ---"
curl -sS -m 10 -o /dev/null -w "version:%{http_code} " "$BASE/api/public/version"
curl -sS -m 10 -o /dev/null -w "health:%{http_code}\n" "$BASE/api/public/health"
agent-browser eval "(async()=>{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({logout:r.status});})()" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "=== R196 E2E KONEC ==="
