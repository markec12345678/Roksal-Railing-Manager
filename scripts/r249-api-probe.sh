#!/bin/bash
# R249 mini-probe: kaj TOČNO API vrne ceniku po rollbacku (primerjava z jutrišnjim 37709 razredom).
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r249-probe-sekret-vsaj-32-znakov-dolg!!!}"
export PORT=3100
export EB_BASE="http://127.0.0.1:3100"
export EB_EMAIL="ci@roksal.si"
export EB_GESLO="DimniSmoke139!"
source scripts/e2e-lib.sh

node scripts/r245-db-e2e.cjs seed
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R249-probe-server.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

eb_odpri_in_prijavi || { echo "LOGIN FAIL"; node scripts/r245-db-e2e.cjs restore; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic
agent-browser eval "(()=>{return fetch('/api/material-prices',{headers:{'Accept':'application/json'}}).then(r=>r.json()).then(j=>{const cene=(j.prices||j.cene||[]).map(p=>({artikel:p.artikel||p.inventory?.artikel||p.inventory?.naziv||null, sifra:p.sifra||p.inventory?.sifraMateriala||null, enota:p.enota||p.inventory?.enota||null, dobavitelj:p.supplier?.naziv||p.dobavitelj||null, cena:p.cena, opomba:p.opomba, veljavnostOd:p.veljavnostOd, createdAt:p.createdAt, keys:Object.keys(p).sort().join('|')})); return JSON.stringify({topKeys:Object.keys(j).sort().join('|'), n:cene.length, cene},null,1);});})()" 2>&1 | tail -40
node scripts/r245-db-e2e.cjs restore
agent-browser close --all > /dev/null 2>&1
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
echo "PROBE KONEC"
