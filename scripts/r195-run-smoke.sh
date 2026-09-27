#!/bin/bash
# R195 dimni (vzorec r170-r193): svež proces, standalone build z R195 spremembami.
# R195: CSRF dvojni žeton — 137 obstoječih pričakovanj se NE spremeni (grace za
# seje brez žetona; smoke klient nima žetona, zato obdeluje po R130 plasti).
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r195-server-smoke.log 2>&1 < /dev/null &
sleep 4

echo "--- dimni smoke (svež proces, R195) ---"
BASE_URL=http://127.0.0.1:3100 EMAIL='ci@roksal.si' PASSWORD='DimniSmoke139!' \
  python3 tools/security-smoke.py 2>&1 | tail -14
SMOKE=$?

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R195 DIMNI KONEC (exit=$SMOKE)"
