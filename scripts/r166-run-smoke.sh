#!/bin/bash
# R165 dimni: svež proces, repo v roksal-repo (prilagoditev r160 vzorca).
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r166-server-smoke.log 2>&1 < /dev/null &
sleep 4

echo "--- dimni [1..35] ---"
BASE_URL=http://127.0.0.1:3100 EMAIL='ci@roksal.si' PASSWORD='DimniSmoke139!' \
  python3 tools/security-smoke.py 2>&1 | tail -14
SMOKE=$?

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
if ss -tln 2>/dev/null | grep -q ':3100'; then echo "WARNING: port 3100 busy"; else echo "port 3100 free"; fi
echo "smoke_exit=$SMOKE"
exit $SMOKE
