#!/bin/bash
# R216 security smoke (vzorec r215): svež standalone proces + security-smoke.py
# Z EMAIL/PASSWORD (auth smoke potrebuje ADMIN kredencale — brez njih je 108/8).
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/R216-server-smoke.log 2>&1 < /dev/null &
sleep 4

echo "--- dimni smoke (svež proces) ---"
BASE_URL=http://127.0.0.1:3100 EMAIL='ci@roksal.si' PASSWORD='DimniSmoke139!' \
  python3 tools/security-smoke.py 2>&1 | tail -5
SMOKE=$?

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
echo "SMOKE_EXIT=$SMOKE"
