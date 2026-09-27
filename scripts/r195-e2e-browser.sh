#!/bin/bash
# R195 E2E ŽIVO: CSRF-zavrnitev toast + 'Odjavi ostale naprave' — celotna veriga.
#   Z0 prijava (ADMIN) + R194 regresija: roksal_csrf izdan
#   Z1 curl druga seja (simulacija tuje naprave)
#   Z2 'Aktivne seje' dialog: ≥2 vrstici + masovni gumb 'Odjavi ostale naprave (N)'
#   Z3 prvi klik = OBOROŽITEV ('Potrdi — odjavi N naprav?')
#   Z4 drugi klik = IZVEDBA: toast + seznam nazaj na 1 + tuja seja mrli (401)
#   Z5 trenutna seja ostane ŽIVA (GET /api/auth 200 skozi ovoj)
#   Z6 CSRF toast ŽIVO: napačna glava klicatelja → 403 'dvojni podpis'
#      → dogodek → sonner toast 'Dejanje je zavrnjeno — seja ni usklajena.'
#   Z7 javne poti + telemetrija ostajata
#   Z8 odjava pobriše piškotek (R194 regresija)
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

setsid node .next/standalone/server.js > /tmp/r195-server-e2e.log 2>&1 < /dev/null &
sleep 5

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$BASE/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12
echo "--- Z0: prijava + R194 regresija (csrf izdan) ---"
agent-browser eval "(()=>{const c=document.cookie; return JSON.stringify({url:location.pathname, csrfIzdan:c.includes('roksal_csrf='), err:window.__err??null});})()" 2>&1 | tail -1

echo "--- Z1: curl druga seja (tuja naprava) ---"
curl -sS -m 10 -X POST "$BASE/api/auth" -H "Origin: $BASE" -H 'Content-Type: application/json' \
  -d '{"email":"ci@roksal.si","password":"DimniSmoke139!"}' -D /tmp/r195-login2.txt -o /dev/null
TOK2=$(grep -i '^set-cookie: roksal_session=' /tmp/r195-login2.txt | head -1 | sed 's/^[Ss]et-[Cc]ookie: roksal_session=//' | cut -d';' -f1)
echo "tuja seja izdana: ${#TOK2} znakov"
ST=$(curl -sS -m 10 -o /dev/null -w '%{http_code}' "$BASE/api/auth" -H "Authorization: Bearer $TOK2")
echo "tuja seja ŽIVA pred revokacijo: $ST (pričakovano 200)"

echo "--- Z2: dialog 'Aktivne seje' — vrstice + masovni gumb ---"
# Radix DropdownMenu: trigger + menuitem zahtevata pointerdown sekvenco (samo .click() NE odpre)
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Odjava'); if(!t) return 'brez triggerja'; const r=t.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; t.dispatchEvent(new PointerEvent('pointerdown',o)); t.dispatchEvent(new PointerEvent('pointerup',o)); t.dispatchEvent(new MouseEvent('click',o)); return 'trigger poslan';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const m=[...document.querySelectorAll('[role=menuitem]')].find(x=>x.textContent.trim().startsWith('Aktivne seje')); if(!m) return 'brez itema'; const r=m.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; m.dispatchEvent(new PointerEvent('pointerdown',o)); m.dispatchEvent(new PointerEvent('pointerup',o)); m.dispatchEvent(new MouseEvent('click',o)); return 'item poslan';})()" 2>&1 | tail -1
# cakaj, da se load() zakljuci (poll do 8 s)
for i in 1 2 3 4 5 6 7 8; do
  REZ=$(agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=dialog]')].pop(); if(!dlg) return JSON.stringify({dialog:false}); const vrstice=dlg.querySelectorAll('li').length; const gumb=[...dlg.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Odjavi vse ostale naprave')); return JSON.stringify({dialog:true, vrstice, gumbViden:!!gumb, gumbBesedilo:gumb?gumb.textContent.trim():null});})()" 2>&1 | tail -1)
  echo "$REZ" | grep -q 'vrstice\\":0' || break
  sleep 1
done
echo "$REZ"
agent-browser screenshot "$SS/e2e-r195-seje-gumb.png" > /dev/null 2>&1 && echo "screenshot SEJE GUMB OK"

echo "--- Z3: prvi klik = oborožitev ---"
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=dialog]')].pop(); const g=[...dlg.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Odjavi vse ostale naprave')); if(!g) return 'brez gumba'; const r=g.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; g.dispatchEvent(new PointerEvent('pointerdown',o)); g.dispatchEvent(new PointerEvent('pointerup',o)); g.dispatchEvent(new MouseEvent('click',o)); return 'kliknil';})()" 2>&1 | tail -1
sleep 1
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=dialog]')].pop(); const g=[...dlg.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Odjavi vse ostale naprave')); return JSON.stringify({oborozen:g?g.textContent.trim():null});})()" 2>&1 | tail -1

echo "--- Z4: drugi klik = izvedba → toast + seznam + tuja seja mrli ---"
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=dialog]')].pop(); const g=[...dlg.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Odjavi vse ostale naprave')); if(!g) return 'brez gumba'; const r=g.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; g.dispatchEvent(new PointerEvent('pointerdown',o)); g.dispatchEvent(new PointerEvent('pointerup',o)); g.dispatchEvent(new MouseEvent('click',o)); return 'kliknil';})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const dlg=[...document.querySelectorAll('[role=dialog]')].pop(); const vrstice=dlg?dlg.querySelectorAll('li').length:-1; const gumb=[...(dlg?.querySelectorAll('button')||[])].find(b=>(b.getAttribute('aria-label')||'').startsWith('Odjavi vse ostale naprave')); const toast=[...document.querySelectorAll('[data-sonner-toast]')].map(t=>t.textContent).find(t=>t.includes('Ostale naprave so odjavljene')); return JSON.stringify({vrsticePo:vrstice, gumbSeViden:!!gumb, toastViden:!!toast, toastBesedilo:toast?toast.slice(0,60):null});})()" 2>&1 | tail -1
ST2=$(curl -sS -m 10 -o /dev/null -w '%{http_code}' "$BASE/api/auth" -H "Authorization: Bearer $TOK2")
echo "tuja seja PO revokaciji: $ST2 (pričakovano 401)"
agent-browser screenshot "$SS/e2e-r195-toast-revoke.png" > /dev/null 2>&1 && echo "screenshot TOAST REVOKE OK"

echo "--- Z5: trenutna seja ostane ŽIVA (skriti prek ovoja) ---"
agent-browser eval "(async()=>{const r=await fetch('/api/auth'); return JSON.stringify({status:r.status});})()" 2>&1 | tail -1

echo "--- Z6: CSRF toast ŽIVO — napačna glava → 403 → dogodek → sonner ---"
agent-browser eval "(async()=>{const zapri=document.querySelector('[data-sonner-toast] [data-close]'); if(zapri) zapri.click(); const r=await fetch('/api/customers',{method:'POST',headers:{'Content-Type':'application/json','x-csrf-token':'naroben-zeton-r195'},body:JSON.stringify({ime:'x',naslov:'y'})}); const b=await r.json().catch(()=>({})); return JSON.stringify({status:r.status, dvojniPodpis:JSON.stringify(b).includes('dvojni podpis'), korelacija:!!r.headers.get('x-correlation-id')});})()" 2>&1 | tail -1
sleep 2
agent-browser eval "(()=>{const toast=[...document.querySelectorAll('[data-sonner-toast]')].map(t=>t.textContent); const nas=toast.find(t=>t.includes('Dejanje je zavrnjeno')); const akcija=document.querySelector('[data-sonner-toast]'); const osvezi=akcija?[...akcija.querySelectorAll('button')].map(b=>b.textContent.trim()):[]; return JSON.stringify({toastViden:!!nas, besedilo:nas?nas.slice(0,70):null, akcijskiGumbi:osvezi});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/e2e-r195-csrf-toast.png" > /dev/null 2>&1 && echo "screenshot CSRF TOAST OK"

echo "--- Z7: javne poti + telemetrija ---"
curl -sS -m 10 -o /dev/null -w "version:%{http_code} " "$BASE/api/public/version"
curl -sS -m 10 -o /dev/null -w "health:%{http_code}\n" "$BASE/api/public/health"

echo "--- Z8: odjava (R194 regresija) — piškotek pobrisan ---"
agent-browser eval "(async()=>{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({logout:r.status});})()" 2>&1 | tail -1
sleep 1
agent-browser eval "(()=>{const c=document.cookie; return JSON.stringify({csrfOstane:c.includes('roksal_csrf='), url:location.pathname});})()" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "=== R195 E2E KONEC ==="
