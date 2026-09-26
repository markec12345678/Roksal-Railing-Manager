#!/bin/bash
# R191 E2E ŽIVO: val-1 regresija (301× calculator 429) + val-2 neškodljivost
# (blokiran calculator NE blokira drugih val-2 rut) + telemetrija ŽIVO.
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

export NEXT_PUBLIC_BUILD_STAMP="2026-09-27T00:45:00.000Z"
setsid node .next/standalone/server.js > /tmp/r191-server-e2e.log 2>&1 < /dev/null &
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

echo "--- Z1: val 1 regresija — 301x POST /api/calculator ---"
agent-browser eval "(async()=>{const izidi={}; let tel=null; for(let i=1;i<=301;i++){ const r=await fetch('/api/calculator',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); izidi[r.status]=(izidi[r.status]||0)+1; if(r.status===429) tel=await r.json(); } return JSON.stringify({izidi, detail:tel?tel.detail:null});})()" 2>&1 | tail -1

echo "--- Z2: val 2 neškodljivost — blokiran calculator NE blokira notifications/read, projects, punch ---"
agent-browser eval "(async()=>{const n=await fetch('/api/notifications/read',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); const p=await fetch('/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); const q=await fetch('/api/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({notificationsRead:{status:n.status, blokiran:n.status===429}, projects:{status:p.status, blokiran:p.status===429}, quote:{status:q.status, blokiran:q.status===429}});})()" 2>&1 | tail -1

echo "--- Z3: telemetrija ŽIVO — write trip prisoten + legenda ---"
agent-browser eval "(async()=>{const r=await fetch('/api/security/rate-limit'); const d=await r.json(); const tw=(d.trips||[]).filter(t=>t.kind==='write'); return JSON.stringify({status:r.status, tripsTotal:d.tripsTotal, writeTripi:tw.length, legenda:(d.note||'').includes('write')});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/e2e-r191-telemetrija.png" > /dev/null 2>&1 && echo "screenshot OK"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
agent-browser close --all > /dev/null 2>&1 || true
echo "R191 E2E KONEC"
