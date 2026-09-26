#!/bin/bash
# R186 probe6: meritev CSV NE-PRAZNA pot (popravljeni design):
#  izbran projekt iz UI Select triggerja → POST meritev ZA TA projekt →
#  remount (Kalkulator → Meritve) → klik CSV → toast uspeha →
#  cleanup = direkten prisma delete (ruta [id] nima DELETE — PATCH-only R153).
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
export NEXT_PUBLIC_BUILD_STAMP="r186-e2e-$(date -u +%Y-%m-%dT%H:%M:%SZ)"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r186-e2e-server6.log 2>&1 < /dev/null &
sleep 5

agent-browser close --all > /dev/null 2>&1 || true
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 6

echo "--- P1: Montažna orodja → Meritve + ime izbranega projekta ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Meritve')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 8
IME=$(agent-browser eval "(()=>{const tr=[...document.querySelectorAll('[role=combobox]')].map(e=>e.textContent.trim()).filter(t=>t&&t.length>2&&t!=='Vsi'); return JSON.stringify({triggerji:[...document.querySelectorAll('[role=combobox]')].map(e=>e.textContent.trim().slice(0,30))});})()" 2>&1 | tail -1)
echo "comboboxi: $IME"

echo "--- P2: POST meritev za izbrani projekt (ime → id iz /api/projects) ---"
agent-browser eval "(async()=>{const ime=document.querySelector('[role=combobox]')?Array.from(document.querySelectorAll('[role=combobox]')).map(e=>e.textContent.trim()).find(t=>t&&t.length>2&&t!=='Vsi'):null;
  if(!ime) return JSON.stringify({napaka:'ni izbranega projekta v UI'});
  const r=await fetch('/api/projects'); const proj=await r.json();
  const p=(Array.isArray(proj)?proj:[]).find(x=>x.nazivProjekta===ime);
  if(!p) return JSON.stringify({napaka:'UI projekt ni v seznamu', ime});
  const c=await fetch('/api/measurements',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:p.id,dolzinaMm:2450,visinaMm:1120})});
  const j=await c.json().catch(()=>null);
  if(j&&j.id) window.__r186mId=j.id;
  return JSON.stringify({status:c.status, projekt:ime, id:j&&j.id?j.id:null});})()" 2>&1 | tail -1

echo "--- P3: remount taba (Kalkulator → Meritve) → svež loadAll ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Kalkulator')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Meritve')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 9

echo "--- P4: klik CSV → toast uspeha? ---"
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Izvozi vidne meritve kot CSV'); if(g){g.click(); return 'kliknil';} return 'ni ga';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('[data-sonner-toast], li, div')].map(e=>e.textContent||'').find(x=>x.includes('meritev v CSV')||x.includes('Ni meritev za izvoz')||x.includes('Izvoza ni bilo mogoče')); return JSON.stringify({toast:t?t.trim().slice(0,80):null});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r186-meritve-csv-polna.png > /dev/null 2>&1 && echo "screenshot POLNA POT OK"

echo "--- P5: izvoz datoteke realno prenesen? (network response check prek blob je client-only) ---"
echo "(uspeh = toast; datoteka gre v brskalnik prek blob downloada — ni server-side artefakta)"

agent-browser close --all > /dev/null 2>&1 || true
echo "R186 PROBE6 KONEC (id meritve za cleanup glej zgoraj)"
