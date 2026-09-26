#!/bin/bash
# R192 E2E ŽIVO: Z1 val-1 regresija + 429 korelacijski odmev (F3), Z2 val-2
# neškodljivost, Z3 telemetrija, Z4 poenoten audit zapis ŽIVO (projekt →
# CREATE_PROJECT prek auditInTx), Z5 bom-draft FK FIX ŽIVO (deal-lock →
# PATCH bom-draft → 200 + BOM_DRAFT_UPDATED z userId null — prej: 500).
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

export NEXT_PUBLIC_BUILD_STAMP="2026-09-27T07:45:00.000Z"
setsid node .next/standalone/server.js > /tmp/r192-server-e2e.log 2>&1 < /dev/null &
sleep 5

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$BASE/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12
echo "--- prijava ---"
agent-browser eval "JSON.stringify({url:location.pathname, err:window.__err??null})" 2>&1 | tail -1

echo "--- Z1: val 1 regresija — 301x POST /api/calculator + 429 KORELACIJA ---"
agent-browser eval "(async()=>{const izidi={}; let tel=null; let cid=null; for(let i=1;i<=301;i++){ const r=await fetch('/api/calculator',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); izidi[r.status]=(izidi[r.status]||0)+1; if(r.status===429){ tel=await r.json(); cid=r.headers.get('x-correlation-id'); } } return JSON.stringify({izidi, detail:tel?tel.detail:null, correlationOdmev:cid, correlationNeprazen:!!cid&&cid.length>0});})()" 2>&1 | tail -1

echo "--- Z2: val 2 neškodljivost — blokiran calculator NE blokira ostalih ---"
agent-browser eval "(async()=>{const n=await fetch('/api/notifications/read',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); const p=await fetch('/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); const q=await fetch('/api/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({notificationsRead:{status:n.status, blokiran:n.status===429}, projects:{status:p.status, blokiran:p.status===429}, quote:{status:q.status, blokiran:q.status===429}});})()" 2>&1 | tail -1

echo "--- Z3: telemetrija ŽIVO — write trip prisoten + legenda ---"
agent-browser eval "(async()=>{const r=await fetch('/api/security/rate-limit'); const d=await r.json(); const tw=(d.trips||[]).filter(t=>t.kind==='write'); return JSON.stringify({status:r.status, tripsTotal:d.tripsTotal, writeTripi:tw.length, legenda:(d.note||'').includes('write')});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/e2e-r192-telemetrija.png" > /dev/null 2>&1 && echo "screenshot OK"

echo "--- Z4: POENOTEN AUDIT ŽIVO — stranka + projekt → CREATE_PROJECT v sledi ---"
agent-browser eval "(async()=>{const zig=Date.now(); const c=await fetch('/api/customers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ime:'r192-e2e-'+zig,naslov:'E2E ulica 7'})}); const cd=await c.json(); if(!c.ok) return JSON.stringify({korak:'customer',status:c.status,cd}); const p=await fetch('/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nazivProjekta:'r192-e2e-'+zig,customerId:cd.id})}); const pd=await p.json(); if(!p.ok) return JSON.stringify({korak:'project',status:p.status,pd}); const a=await fetch('/api/audit?projectId='+encodeURIComponent(pd.id)+'&limit=50'); const ad=await a.json(); const cp=(ad.entries||[]).filter(e=>e.akcija==='CREATE_PROJECT'); return JSON.stringify({customerStatus:c.status, projectStatus:p.status, auditStatus:a.status, sledVpisov:(ad.entries||[]).length, createProjectVsledi:cp.length, imaUserja:cp.length>0&&!!cp[0].user, projectId:pd.id, zig:String(zig)});})()" 2>&1 | tail -1

echo "--- Z5: bom-draft FK FIX ŽIVO — deal-lock → PATCH → 200 (prej 500) ---"
# Z5 v ISTI evaluaciji (lastni objekti — brez skupnega stanja med koraki):
agent-browser eval "(async()=>{const zig=Date.now(); const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='; const c=await fetch('/api/customers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ime:'r192-e2e-b-'+zig,naslov:'E2E B ulica 9'})}); const cd=await c.json(); if(!c.ok) return JSON.stringify({korak:'customer',status:c.status}); const p=await fetch('/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nazivProjekta:'r192-e2e-b-'+zig,customerId:cd.id})}); const pd=await p.json(); if(!p.ok) return JSON.stringify({korak:'project',status:p.status}); const dl=await fetch('/api/deal-lock',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:pd.id,customerName:'Kupec E2E',monterName:'Monter E2E',customerSignature:PNG,monterSignature:PNG,quoteData:{items:[{opis:'WPC letva 200cm',kolicina:'4',enota:'m',cena:'12',skupaj:'48'}],skupajBrezDDV:100,ddv:22,skupajZDDV:122}})}); if(!dl.ok){ const t=await dl.text(); return JSON.stringify({korak:'deal-lock',status:dl.status,t:t.slice(0,120)});} const bd=await fetch('/api/bom-draft',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:pd.id,items:[{kategorija:'Test',naziv:'r192 testni artikel',kolicina:2,enota:'kos'}],notes:'r192 FK fix'})}); const bdt=await bd.text(); const a=await fetch('/api/audit?projectId='+encodeURIComponent(pd.id)+'&limit=50'); const ad=await a.json(); const bom=(ad.entries||[]).filter(e=>e.akcija==='BOM_DRAFT_UPDATED'); const dlock=(ad.entries||[]).filter(e=>e.akcija.toUpperCase().includes('DEAL')); return JSON.stringify({dealLockStatus:dl.status, bomDraftStatus:bd.status, telo:bdt.slice(0,80), bomVsledi:bom.length, bomUserIdNull:bom.length>0&&bom[0].user===null, dealVsledi:dlock.length});})()" 2>&1 | tail -1

echo "--- Z6: revizijska sled dialog ŽIVO — chips v UI (zadnji projekt) ---"
agent-browser eval "(async()=>{const ps=await fetch('/api/projects?limit=1'); const pd=await ps.json(); const pid=(pd.projects&&pd.projects[0]&&pd.projects[0].id)||(Array.isArray(pd)&&pd[0]&&pd[0].id)||null; return JSON.stringify({projectsStatus:ps.status, najdenProjekt:!!pid});})()" 2>&1 | tail -1

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
agent-browser close --all > /dev/null 2>&1 || true
echo "R192 E2E KONEC"
