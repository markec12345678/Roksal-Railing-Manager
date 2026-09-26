#!/bin/bash
# R186 probe5: meritev CSV NE-PRAZNA pot živo — (1) prijava ADMIN,
# (2) Meritve tab, (3) POST /api/measurements (realen vnos v dev bazo),
# (4) izvoz klik → toast 'Izvoženih 1 meritev v CSV.', (5) DELETE vnos
# (obnovitev stanja — nič ostankov).
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
export NEXT_PUBLIC_BUILD_STAMP="r186-e2e-$(date -u +%Y-%m-%dT%H:%M:%SZ)"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r186-e2e-server5.log 2>&1 < /dev/null &
sleep 5

agent-browser close --all > /dev/null 2>&1 || true
agent-browser open "http://127.0.0.1:3100/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 6

echo "--- N1: Montažna orodja → Meritve (izbrani projekt iz UI stanja) ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Meritve')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 8

echo "--- N2: POST realne meritve (za prvi projekt) → 201? + id shranjen ---"
agent-browser eval "(async()=>{const r=await fetch('/api/projects'); const proj=await r.json(); if(!Array.isArray(proj)||proj.length===0) return JSON.stringify({napaka:'ni projektov v dev bazi'});
  const pid=proj[0].id;
  const c=await fetch('/api/measurements',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:pid,dolzinaMm:2450,visinaMm:1120})});
  const j=await c.json().catch(()=>null);
  if(j&&j.id) window.__r186mId=j.id;
  return JSON.stringify({status:c.status, id:j&&j.id?j.id:null});})()" 2>&1 | tail -1

echo "--- N3: osveži (fokus vrata mimo — 'Poskusi znova' ni viden; zato ponovna izbira taba) ---"
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim().startsWith('Meritve')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 8

echo "--- N4: klik CSV → toast 'Izvoženih 1 meritev v CSV.'? ---"
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Izvozi vidne meritve kot CSV'); if(g){g.click(); return 'kliknil';} return 'ni ga';})()" > /dev/null 2>&1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('[data-sonner-toast], li, div')].map(e=>e.textContent||'').find(x=>x.includes('meritev v CSV')||x.includes('Ni meritev za izvoz')||x.includes('Izvoza ni bilo mogoče')); return JSON.stringify({toast:t?t.trim().slice(0,80):null});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r186-meritve-csv-polna.png > /dev/null 2>&1 && echo "screenshot POLNA POT OK"

echo "--- N5: DELETE meritve (obnovitev) + preverba ---"
agent-browser eval "(async()=>{const id=window.__r186mId; if(!id) return JSON.stringify({brisano:false, razlog:'id ni shranjen'});
  const d=await fetch('/api/measurements/'+id,{method:'DELETE'});
  return JSON.stringify({brisano:d.status===200||d.status===204, status:d.status, id});})()" 2>&1 | tail -1

agent-browser close --all > /dev/null 2>&1 || true
echo "R186 PROBE5 KONEC"
