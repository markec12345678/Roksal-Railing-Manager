#!/bin/bash
# R248 dimni (vzorec r242) test (vzorec r227/r239): standalone :3100 + javni health + prijavna
# rute + PWA manifest (brez DB mutacij — samo bralni pepperji).
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-R248-smoke-lokalni-sekret-vsaj-32-znakov!!}"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R248-server-smoke.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- health ---"
curl -s --max-time 10 http://127.0.0.1:3100/api/public/health; echo
echo "--- /login (GET status) ---"
curl -s -o /dev/null -w "%{http_code}\n" --max-time 10 http://127.0.0.1:3100/login
echo "--- PWA manifest ---"
curl -s -o /dev/null -w "%{http_code}\n" --max-time 10 http://127.0.0.1:3100/manifest.webmanifest
echo "--- auth brez Origin = 403 CSRF (fail-closed) ---"
curl -s -o /dev/null -w "%{http_code}\n" --max-time 10 -X POST http://127.0.0.1:3100/api/auth -H 'Content-Type: application/json' -d '{"email":"x@y.z","geslo":"n"}'

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "--- R248 SMOKE KONEC ---"
