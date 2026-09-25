#!/bin/bash
# R143 E2E orodje: zažene svež strežnik, poganja E2E, počisti (kill -9 po PID).
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

# Higiiena: morebitni OSTANKI prejšnjega runa na 3100 → kill -9 po pravem PID.
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r143-server.log 2>&1 < /dev/null &
SRV=$!
sleep 4

echo "--- E2E obvestil (§29) ---"
python3 scripts/r143-e2e-notifications.py
E2E=$?

# kill -9 po PRAREM PID (setsid wrapper ≠ node; poišči po portu — nauček R141).
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
if ss -tln 2>/dev/null | grep -q ':3100'; then
  echo "WARNING: port 3100 still busy"
else
  echo "port 3100 free"
fi
echo "e2e_exit=$E2E"
exit $E2E
