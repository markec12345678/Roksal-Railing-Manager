#!/bin/bash
# R154 E2E živo na lokalnem buildu — P1 fix /api/slopes dostop + ?status= filter
# + PDF status (preverjen v komponenti; tukaj API del).
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r154-e2e-server.log 2>&1 < /dev/null &
sleep 4
curl -s -o /dev/null -w "server: %{http_code}\n" http://127.0.0.1:3100/api/auth/demo

echo "=== [1] Prijava (API, ci@roksal.si — ADMIN dev peskovnik) ==="
rm -f /tmp/r154-e2e-cookies.txt
curl -s -m 10 -c /tmp/r154-e2e-cookies.txt -X POST http://127.0.0.1:3100/api/auth \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d '{"email":"ci@roksal.si","password":"DimniSmoke139!"}' -o /dev/null -w "login: %{http_code}\n"

echo "=== [2] Anon slopes → 401 (fail-closed) ==="
curl -s -m 10 "http://127.0.0.1:3100/api/slopes?projectId=x" -o /dev/null -w "anon GET slopes: %{http_code} (pričakovano 401)\n"
curl -s -m 10 -X POST "http://127.0.0.1:3100/api/slopes" -H "Content-Type: application/json" \
  -H "Origin: http://127.0.0.1:3100" -d '{"projectId":"x","kotStopinje":1}' \
  -o /dev/null -w "anon POST slopes: %{http_code} (pričakovano 401)\n"

echo "=== [3] Projekt + nagib (VODJA=ci ADMIN pot) ==="
CUSTOMER=$(curl -s -m 10 -b /tmp/r154-e2e-cookies.txt -X POST http://127.0.0.1:3100/api/customers \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d "{\"ime\":\"R154 E2E $(date +%s)\",\"naslov\":\"Test 1\"}")
CID=$(echo "$CUSTOMER" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo NONE)
PID=$(curl -s -m 10 -b /tmp/r154-e2e-cookies.txt -X POST http://127.0.0.1:3100/api/projects \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d "{\"customerId\":\"$CID\",\"nazivProjekta\":\"R154 E2E slopes dostop\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "projectId: $PID"

echo "=== [4] slopes POST veljaven → 201; GET → 200 z vrstico ==="
curl -s -m 10 -b /tmp/r154-e2e-cookies.txt -X POST "http://127.0.0.1:3100/api/slopes" \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d "{\"projectId\":\"$PID\",\"kotStopinje\":2.5,\"smer\":\"Y\",\"lokacija\":\"Talna plošča balkona\"}" \
  -o /dev/null -w "POST slopes: %{http_code} (pričakovano 201)\n"
curl -s -m 10 -b /tmp/r154-e2e-cookies.txt "http://127.0.0.1:3100/api/slopes?projectId=$PID" \
  -o /tmp/r154-slopes.json -w "GET slopes: %{http_code} (pričakovano 200)\n"
python3 -c "import json; d=json.load(open('/tmp/r154-slopes.json')); print('vrstic:', len(d), '| kot:', d[0]['kotStopinje'])"

echo "=== [5] slopes fail-closed: neznani projekt → 404; napačen kot → 400; brez projectId → 400 ==="
curl -s -m 10 -b /tmp/r154-e2e-cookies.txt "http://127.0.0.1:3100/api/slopes?projectId=r154-ne-obstaja" -o /dev/null -w "GET neznani: %{http_code} (pričakovano 404)\n"
curl -s -m 10 -b /tmp/r154-e2e-cookies.txt -X POST "http://127.0.0.1:3100/api/slopes" \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d "{\"projectId\":\"$PID\",\"kotStopinje\":\"abc\"}" -o /dev/null -w "POST napačen kot: %{http_code} (pričakovano 400)\n"
curl -s -m 10 -b /tmp/r154-e2e-cookies.txt -X POST "http://127.0.0.1:3100/api/slopes" \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d '{"kotStopinje":1}' -o /dev/null -w "POST brez projectId: %{http_code} (pričakovano 400)\n"

echo "=== [6] Meritve: 2× POST, PATCH ena → POTRJENA, ?status= filter ==="
M1=$(curl -s -m 10 -b /tmp/r154-e2e-cookies.txt -X POST http://127.0.0.1:3100/api/measurements \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d "{\"projectId\":\"$PID\",\"dolzinaMm\":2000,\"visinaMm\":1100}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
M2=$(curl -s -m 10 -b /tmp/r154-e2e-cookies.txt -X POST http://127.0.0.1:3100/api/measurements \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d "{\"projectId\":\"$PID\",\"dolzinaMm\":3000,\"visinaMm\":1200}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
curl -s -m 10 -b /tmp/r154-e2e-cookies.txt -X PATCH "http://127.0.0.1:3100/api/measurements/$M2" \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d '{"status":"POTRJENA"}' -o /dev/null -w "PATCH status: %{http_code} (pričakovano 200)\n"
curl -s -m 10 -b /tmp/r154-e2e-cookies.txt "http://127.0.0.1:3100/api/measurements?projectId=$PID&status=POTRJENA" \
  -o /tmp/r154-fp.json -w "GET ?status=POTRJENA: %{http_code} (pričakovano 200)\n"
python3 -c "import json; d=json.load(open('/tmp/r154-fp.json')); print('potrjene:', len(d), '| id ujema:', d[0]['id']=='$M2')"
curl -s -m 10 -b /tmp/r154-e2e-cookies.txt "http://127.0.0.1:3100/api/measurements?projectId=$PID&status=OSNUTEK" \
  -o /tmp/r154-fo.json -w "GET ?status=OSNUTEK: %{http_code}\n"
python3 -c "import json; d=json.load(open('/tmp/r154-fo.json')); print('osnutki:', len(d), '| id ujema:', d[0]['id']=='$M1')"
curl -s -m 10 -b /tmp/r154-e2e-cookies.txt "http://127.0.0.1:3100/api/measurements?projectId=$PID" \
  -o /tmp/r154-all.json -w "GET brez statusa: %{http_code}\n"
python3 -c "import json; d=json.load(open('/tmp/r154-all.json')); print('vse:', len(d), '(pričakovano 2)')"
curl -s -m 10 -b /tmp/r154-e2e-cookies.txt "http://127.0.0.1:3100/api/measurements?projectId=$PID&status=potrjena" \
  -o /tmp/r154-bad.json -w "GET ?status=potrjena (mala): %{http_code} (pričakovano 400)\n"
cat /tmp/r154-bad.json; echo

echo "=== [7] Možnost 403 na tujem projektu (neprijavljen MONTER) ==="
rm -f /tmp/r154-monter.txt
curl -s -m 10 -X POST http://127.0.0.1:3100/api/auth/register -H "Content-Type: application/json" \
  -H "Origin: http://127.0.0.1:3100" \
  -d '{"email":"r154-e2e-monter@roksal.si","password":"R154E2eMonter!","name":"R154 E2E Monter","role":"MONTER"}' \
  -o /dev/null -w "registracija MONTER: %{http_code}\n" || true
curl -s -m 10 -c /tmp/r154-monter.txt -X POST http://127.0.0.1:3100/api/auth \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d '{"email":"r154-e2e-monter@roksal.si","password":"R154E2eMonter!"}' -o /dev/null -w "prijava MONTER: %{http_code}\n"
curl -s -m 10 -b /tmp/r154-monter.txt "http://127.0.0.1:3100/api/slopes?projectId=$PID" \
  -o /tmp/r154-403.json -w "tuj GET slopes: %{http_code} (pričakovano 403)\n"
cat /tmp/r154-403.json; echo
curl -s -m 10 -b /tmp/r154-monter.txt -X POST "http://127.0.0.1:3100/api/slopes" \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d "{\"projectId\":\"$PID\",\"kotStopinje\":9.9}" -o /dev/null \
  -w "tuj POST slopes: %{http_code} (pričakovano 403)\n"
N=$(curl -s -m 10 -b /tmp/r154-e2e-cookies.txt "http://127.0.0.1:3100/api/slopes?projectId=$PID" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
echo "vrstic v projektu po tujem POST poskusu: $N (pričakovano 1 — nič zapisano)"

echo "=== [8] Dimni: anon meritve + demo ==="
curl -s -m 10 "http://127.0.0.1:3100/api/measurements?projectId=x" -o /dev/null -w "anon GET meritve: %{http_code} (pričakovano 401)\n"
curl -s -m 10 "http://127.0.0.1:3100/api/auth/demo" -w " ← demo\n"

echo "POTRTI/OSNUTKI/datoteke: /tmp/r154-*.json (po E2E pobrisati)"
