#!/bin/bash
# R149 E2E (del 1 — API živo prek curl): §37 upload vrata na živem buildu.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r149-e2e-server.log 2>&1 < /dev/null &
sleep 4

if ! ss -tln 2>/dev/null | grep -q ':3100'; then echo "SERVER NE TEČE"; exit 1; fi
echo "server: $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3100/api/auth/demo) /api/auth/demo"

JAR=/tmp/r149-cookies.txt
rm -f "$JAR"

echo "--- prijava ci@roksal.si (dev ADMIN) ---"
ST=$(curl -s -c "$JAR" -o /tmp/r149-login.json -w '%{http_code}' \
  -H 'Content-Type: application/json' -H 'Origin: http://127.0.0.1:3100' \
  -d '{"email":"ci@roksal.si","password":"DimniSmoke139!"}' \
  http://127.0.0.1:3100/api/auth)
echo "login: $ST"

PID=$(curl -s -b "$JAR" http://127.0.0.1:3100/api/projects | python3 -c "import json,sys; rows=json.load(sys.stdin); print(rows[0]['id'] if rows else '')")
echo "projekt: ${PID:0:8}…"

PNG_B64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

echo "--- §37 A: JPEG deklaracija nad PNG bajti (pričakovano 400) ---"
curl -s -b "$JAR" -o /tmp/r149-a.json -w '%{http_code}\n' \
  -H 'Content-Type: application/json' -H 'Origin: http://127.0.0.1:3100' \
  -d "{\"projectId\":\"$PID\",\"kategorija\":\"MED\",\"imageData\":\"data:image/jpeg;base64,$PNG_B64\"}" \
  http://127.0.0.1:3100/api/photos
head -c 200 /tmp/r149-a.json; echo

echo "--- §37 B: surovi base64 neznanih bajtov (pričakovano 400) ---"
curl -s -b "$JAR" -o /tmp/r149-b.json -w '%{http_code}\n' \
  -H 'Content-Type: application/json' -H 'Origin: http://127.0.0.1:3100' \
  -d "{\"projectId\":\"$PID\",\"imageData\":\"$(echo -n 'nekaj nepoznanega' | base64 -w0)\"}" \
  http://127.0.0.1:3100/api/photos
head -c 200 /tmp/r149-b.json; echo

echo "--- §37 C: HTML bajti prikriti kot PNG (pričakovano 400) ---"
HTML_B64=$(echo -n '<script>alert(1)</script>' | base64 -w0)
curl -s -b "$JAR" -o /tmp/r149-c.json -w '%{http_code}\n' \
  -H 'Content-Type: application/json' -H 'Origin: http://127.0.0.1:3100' \
  -d "{\"projectId\":\"$PID\",\"imageData\":\"data:image/png;base64,$HTML_B64\"}" \
  http://127.0.0.1:3100/api/photos
head -c 200 /tmp/r149-c.json; echo

echo "--- §37 D: veljaven PNG (pričakovano 201) ---"
curl -s -b "$JAR" -o /tmp/r149-d.json -w '%{http_code}\n' \
  -H 'Content-Type: application/json' -H 'Origin: http://127.0.0.1:3100' \
  -d "{\"projectId\":\"$PID\",\"kategorija\":\"MED\",\"opomba\":\"r149 e2e veljaven PNG\",\"imageData\":\"data:image/png;base64,$PNG_B64\"}" \
  http://127.0.0.1:3100/api/photos
python3 -c "import json; d=json.load(open('/tmp/r149-d.json')); print('mime:', d.get('mime'), '| storageKey:', d.get('storageKey'))"

echo "--- §37 E: anon POST (pričakovano 401) ---"
curl -s -o /dev/null -w '%{http_code}\n' \
  -H 'Content-Type: application/json' -H 'Origin: http://127.0.0.1:3100' \
  -d '{"projectId":"x","imageData":"abc"}' \
  http://127.0.0.1:3100/api/photos

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tln 2>/dev/null | grep -q ':3100' && echo "WARNING: port 3100 busy" || echo "port 3100 free"
