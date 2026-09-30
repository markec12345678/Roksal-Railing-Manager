#!/bin/bash
# R309 dimni test (vzorec r273/r296-r308) — standalone :3100 + javni health +
# prijavna rute + PWA manifest (brez DB mutacij — samo bralni pepperji).
# Potrjuje, da build z R309 spremembami (MIGRACIJSKI VAL I/O MEJE —
# 26 throw-style json() handlerjev / 32 klicnih mest + calculator →
# EN VIR guard src/lib/api-telo (vzorec R308); pokvarjen JSON = 400
# napaka odjemalca, nikoli 500; /api/sync izrecno izvzet — kontrakt NIČ)
# vstane in odgovarja fail-closed.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-R309-smoke-lokalni-sekret-vsaj-32-znakov!!}"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R309-server-smoke.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- health ---"
curl -s --max-time 10 http://127.0.0.1:3100/api/public/health; echo
echo "--- /login (GET status) ---"
curl -s -o /dev/null -w "%{http_code}\n" --max-time 10 http://127.0.0.1:3100/login
echo "--- PWA manifest ---"
curl -s -o /dev/null -w "%{http_code}\n" --max-time 10 http://127.0.0.1:3100/manifest.webmanifest
echo "--- auth brez Origin = 403 CSRF (fail-closed) ---"
curl -s -o /dev/null -w "%{http_code}\n" --max-time 10 -X POST http://127.0.0.1:3100/api/auth -H 'Content-Type: application/json' -d '{"email":"x@y.z","geslo":"n"}'
echo "--- meja ŽIVO na standalone: calculator pokvarjen JSON (prijavljen) → 400, nikoli 500 ---"
# dvojni podpis: prijava izda roksal_csrf piškotek; mutacije morajo poslati
# x-csrf-token z isto vrednostjo (brskalnik pošlje samodejno, curl ročno).
COOKIE=/tmp/r309-smoke-cookies.txt
curl -s -c "$COOKIE" -o /dev/null -w "login=%{http_code}\n" --max-time 10 -X POST http://127.0.0.1:3100/api/auth -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3100" -d '{"email":"ci@roksal.si","password":"DimniSmoke139!"}'
CSRF=$(grep roksal_csrf "$COOKIE" | awk '{print $7}')
curl -s -b "$COOKIE" -H "x-csrf-token: $CSRF" -o /tmp/r309-smoke-telo.json -w "calculator-pokvarjen=%{http_code}\n" --max-time 10 -X POST http://127.0.0.1:3100/api/calculator -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3100" -d '{"type":"railing",,'
grep -qF 'Neveljavno telo zahteve' /tmp/r309-smoke-telo.json && echo "meja ovojnica OK (400 + { error })" || { echo "FAIL-CLOSED: ovojnica manjka"; exit 1; }

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "--- R309 SMOKE KONEC ---"
