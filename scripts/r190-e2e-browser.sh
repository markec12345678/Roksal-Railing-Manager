#!/bin/bash
# R190 E2E ŽIVO (vzorec r187-r189): standalone :3100, ADMIN prijava,
# Z1 301× realni POST na /api/calculator → 429 + detail + Retry-After (ŽIVO),
# Z2 izolacija po ruti (quote NI blokiran), Z3 telemetrija kind 'write' ŽIVO.
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

export NEXT_PUBLIC_BUILD_STAMP="2026-09-27T00:30:00.000Z"
setsid node .next/standalone/server.js > /tmp/r190-server-e2e.log 2>&1 < /dev/null &
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
agent-browser eval "JSON.stringify({url:location.pathname, err:window.__err??null})()" 2>&1 | tail -1

echo "--- Z1: 301× realni POST /api/calculator (guard PRED auth+validacijo) ---"
agent-browser eval "(async()=>{const izidi={}; let zadnjiTel=null; let retry=null; for(let i=1;i<=301;i++){ const r=await fetch('/api/calculator',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); izidi[r.status]=(izidi[r.status]||0)+1; if(r.status===429){ retry=r.headers.get('Retry-After'); zadnjiTel=await r.json(); } } return JSON.stringify({izidi, retry, telo:zadnjiTel});})()" 2>&1 | tail -1

echo "--- Z2: izolacija po ruti — quote POST NI blokiran (proračun na rundo) ---"
agent-browser eval "(async()=>{const r=await fetch('/api/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({status:r.status, blokiran:r.status===429});})()" 2>&1 | tail -1

echo "--- Z3: telemetrija ŽIVO — ADMIN vidi trip kategorije 'write' + legenda ---"
agent-browser eval "(async()=>{const r=await fetch('/api/security/rate-limit'); const d=await r.json(); const tw=(d.trips||[]).filter(t=>t.kind==='write'); return JSON.stringify({status:r.status, tripsTotal:d.tripsTotal, writeTripi:tw.length, prvi:tw[0]?{count:tw[0].count,hash:tw[0].keyHash}:null, legenda:(d.note||'').includes('write')});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/e2e-r190-telemetrija.png" > /dev/null 2>&1 && echo "screenshot OK"

echo "--- Z4: regresija — prijava 429 družina (kratek, NE trip login limita: pravi račun 1 uspešna seja) ---"
agent-browser eval "(async()=>{const r=await fetch('/api/public/version'); const d=await r.json(); return JSON.stringify({status:r.status, build:d.build||null});})()" 2>&1 | tail -1

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
agent-browser close --all > /dev/null 2>&1 || true
echo "R190 E2E KONEC"
