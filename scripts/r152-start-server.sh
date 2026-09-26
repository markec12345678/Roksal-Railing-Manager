#!/bin/bash
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
setsid nohup node .next/standalone/server.js > /tmp/r152-server.log 2>&1 < /dev/null &
sleep 4
curl -s -o /dev/null -w "server: %{http_code}\n" http://127.0.0.1:3100/api/auth/demo
