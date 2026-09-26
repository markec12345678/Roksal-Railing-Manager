#!/bin/bash
# R151 E2E živo na lokalnem buildu — §35 reprodukcija + iskreni dokumenti.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r151-e2e-server.log 2>&1 < /dev/null &
sleep 4
curl -s -o /dev/null -w "server: %{http_code}\n" http://127.0.0.1:3100/api/auth/demo

echo "=== [1] Prijava (API, ci@roksal.si) ==="
rm -f /tmp/r151-e2e-cookies.txt
curl -s -m 10 -c /tmp/r151-e2e-cookies.txt -X POST http://127.0.0.1:3100/api/auth \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d '{"email":"ci@roksal.si","password":"DimniSmoke139!"}' -o /dev/null -w "login: %{http_code}\n"

echo "=== [2] §35: POST /api/quote 2× → isti odtis ==="
for i in 1 2; do
  curl -s -m 15 -b /tmp/r151-e2e-cookies.txt -X POST http://127.0.0.1:3100/api/quote \
    -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
    -d '{"points":[{"xM":0,"zM":0},{"xM":5,"zM":0},{"xM":5,"zM":3}],"closed":false}' \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('run $i: hash', d['reproducibility']['inputHash'], 'verzija', d['reproducibility']['quoteVersion'], 'total', d['quote']['total'])"
done

echo "=== [3] §35: spec predelava → drug odtis ==="
curl -s -m 15 -b /tmp/r151-e2e-cookies.txt -X POST http://127.0.0.1:3100/api/quote \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d '{"points":[{"xM":0,"zM":0},{"xM":5,"zM":0},{"xM":5,"zM":3}],"closed":false,"spec":{"heightMm":1200}}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('height 1200: hash', d['reproducibility']['inputHash'], 'total', d['quote']['total'])"

echo "=== [4] Iskreni dokumenti: najdi projekt ==="
PID=$(curl -s -m 10 -b /tmp/r151-e2e-cookies.txt "http://127.0.0.1:3100/api/projects" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if d else 'NONE')")
echo "projectId: $PID"

echo "=== [5] Generiranje dokumenta → verzija + sha256 v odgovoru ==="
curl -s -m 30 -b /tmp/r151-e2e-cookies.txt -X POST http://127.0.0.1:3100/api/documents \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d "{\"projectId\":\"$PID\",\"tipDokumenta\":\"TEHNICNI_LIST\"}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('verzija:', d.get('verzija'), '| sha256:', (d.get('sha256') or '')[:8], '| url:', d.get('url'))"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tln | grep -q ':3100' && echo "WARNING: port busy" || echo "port 3100 free"
rm -f /tmp/r151-e2e-cookies.txt /tmp/r151-e2e-server.log
echo "e2e-api-done"
