#!/bin/bash
# R152 E2E API del — iskreni osnutki + brisanje (lokalni build, port 3100).
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r152-e2e-server.log 2>&1 < /dev/null &
sleep 4
curl -s -o /dev/null -w "server: %{http_code}\n" http://127.0.0.1:3100/api/auth/demo

echo "=== [1] Prijava (ci@roksal.si) ==="
rm -f /tmp/r152-cookies.txt
curl -s -m 10 -c /tmp/r152-cookies.txt -X POST http://127.0.0.1:3100/api/auth \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d '{"email":"ci@roksal.si","password":"DimniSmoke139!"}' -o /dev/null -w "login: %{http_code}\n"

echo "=== [2] POST /api/measurements (veljaven) → 200/201 ==="
PID=$(curl -s -m 10 -b /tmp/r152-cookies.txt "http://127.0.0.1:3100/api/projects" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if d else 'NONE')")
echo "projectId: $PID"
curl -s -m 15 -b /tmp/r152-cookies.txt -X POST http://127.0.0.1:3100/api/measurements \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d "{\"projectId\":\"$PID\",\"dolzinaMm\":2500,\"visinaMm\":1100}" | head -c 200; echo

echo "=== [3] Anon POST → 401 (fail-closed še vedno) ==="
curl -s -o /dev/null -w "anon: %{http_code}\n" -X POST http://127.0.0.1:3100/api/measurements \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d "{\"projectId\":\"$PID\",\"dolzinaMm\":100,\"visinaMm\":100}"

echo "=== [4] Veljaven POST še 1× za E2E brisanja (odtis testa) ==="
curl -s -m 15 -b /tmp/r152-cookies.txt -X POST http://127.0.0.1:3100/api/measurements \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d "{\"projectId\":\"$PID\",\"dolzinaMm\":1500,\"visinaMm\":1100}" | python3 -c "import sys,json; d=json.load(sys.stdin); print('id:', d['id'], 'dolzina:', d['dolzinaMm'])"

echo "=== [5] Ni DELETE rutine (pravica: UI ne laže o brisanju) ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "http://127.0.0.1:3100/api/measurements?projectId=$PID" -b /tmp/r152-cookies.txt -H "Origin: http://127.0.0.1:3100")
echo "DELETE /api/measurements → $CODE (pričakovano 405)"

echo "=== [6] Count meritev za projekt (E2E osnova) ==="
curl -s -m 10 -b /tmp/r152-cookies.txt "http://127.0.0.1:3100/api/measurements?projectId=$PID" | python3 -c "import sys,json; print('meritev:', len(json.load(sys.stdin)))"

echo "$PID" > /tmp/r152-pid.txt
echo "r152-e2e-api-done (strežnik OSTANE teči za brskalniškim delom)"
