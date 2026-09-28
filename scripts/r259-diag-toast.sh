#!/bin/bash
# R259 诊断 — toast 实况：seed → klik → 快照 body 文本含 toast 的上下文。
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r259-diag-lokalni-sekret-vsaj-32-znakov!!}"
export PORT=3100
export EB_BASE="http://127.0.0.1:3100"
export EB_EMAIL="ci@roksal.si"
export EB_GESLO="DimniSmoke139!"
source scripts/e2e-lib.sh

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R259-diag-server.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

eb_odpri_in_prijavi || { echo "LOGIN FAIL"; exit 1; }
eb_zapri_vodic
node scripts/r259-db-e2e.cjs seed
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi dobavitelje kot PDF\"]');})()" 24
eb_cakaj 2
# klik + 立刻密集快照
eb_klik_gumb "Izvozi dobavitelje kot PDF"
for i in 1 2 3 4 5 6; do
  agent-browser eval "(()=>{const t=document.body.textContent; const ix=t.indexOf('Izvoženih'); const iy=t.indexOf('Dobavitelji PDF'); const iz=t.indexOf('povprečni dobavni rok'); return JSON.stringify({i:$i, izvzenih:ix>=0?t.substring(ix,ix+120):null, destruktiv:iy>=0?t.substring(iy,iy+160):null, rok:iz>=0?t.substring(iz,iz+80):null});})()" 2>&1 | tail -1
  sleep 0.7
done
node scripts/r259-db-e2e.cjs restore
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
agent-browser close --all > /dev/null 2>&1
echo "=== DIAG KONEC ==="
