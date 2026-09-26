#!/bin/bash
# R157 E2E živo na lokalnem buildu — nagibi CSV izvoz (podatki) + vrata nespremenjena
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
BASE="http://127.0.0.1:3100"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
setsid node .next/standalone/server.js > /tmp/r157-e2e-server.log 2>&1 < /dev/null &
sleep 4
curl -s -o /dev/null -w "server: %{http_code}\n" "$BASE/api/auth/demo"

rm -f /tmp/r157-e2e-own.txt

echo "=== [1] Prijava lastnik (ci@roksal.si) ==="
curl -s -m 10 -c /tmp/r157-e2e-own.txt -X POST "$BASE/api/auth" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d '{"email":"ci@roksal.si","password":"DimniSmoke139!"}' -o /dev/null -w "login ci: %{http_code}\n"

echo "=== [2] Projekt lastnika ==="
PIDS=$(curl -s -m 10 -b /tmp/r157-e2e-own.txt "$BASE/api/projects" | python3 -c "
import sys, json
d = json.load(sys.stdin)
items = d if isinstance(d, list) else d.get('projects', d.get('items', []))
print(items[0]['id'] if items else '')
")
echo "projectId: $PIDS"

echo "=== [3] POST nagib (podatki za izvoz) ==="
curl -s -m 10 -b /tmp/r157-e2e-own.txt -X POST "$BASE/api/slopes" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d "{\"projectId\":\"$PIDS\",\"kotStopinje\":2.5,\"smer\":\"Y\",\"lokacija\":\"R157 E2E lokacija\"}" \
  -o /tmp/r157-slope.json -w "POST slopes: %{http_code}\n"
head -c 200 /tmp/r157-slope.json; echo ""

echo "=== [4] GET nagibi (kliče UI za zgodovino/izvoz) ==="
curl -s -m 10 -b /tmp/r157-e2e-own.txt "$BASE/api/slopes?projectId=$PIDS" \
  -o /tmp/r157-slopes.json -w "GET slopes: %{http_code}\n"
python3 - <<'EOF'
import json
rows = json.load(open('/tmp/r157-slopes.json'))
rows_l = rows if isinstance(rows, list) else rows.get('slopes', [])
r157 = [r for r in rows_l if (r.get('lokacija') or '') == 'R157 E2E lokacija']
assert r157, "R157 nagib ni v odgovoru!"
r = r157[0]
assert abs(r['kotStopinje'] - 2.5) < 0.001, f"kot: {r['kotStopinje']}"
assert r['smer'] == 'Y', f"smer: {r['smer']}"
print(f"OK: nagib v zgodovini — kot {r['kotStopinje']}° smer {r['smer']} ({len(rows_l)} nagibov skupaj)")
EOF

echo "=== [5] Regresija: R156 vrata še vedno živa (status POLJUBEN → 400) ==="
CID=$(curl -s -m 10 -b /tmp/r157-e2e-own.txt "$BASE/api/crm" | python3 -c "
import sys, json
d = json.load(sys.stdin)
cs = d.get('customers', []) if isinstance(d, dict) else d
print(cs[0]['id'] if cs else '')
")
curl -s -m 10 -b /tmp/r157-e2e-own.txt -X PATCH "$BASE/api/crm" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d "{\"id\":\"$CID\",\"status\":\"POLJUBEN\"}" \
  -o /tmp/r157-crm.json -w "PATCH crm POLJUBEN: %{http_code} (400)\n"
head -c 130 /tmp/r157-crm.json; echo ""

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
if ss -tln 2>/dev/null | grep -q ':3100'; then echo "WARNING: port 3100 busy"; else echo "port 3100 free"; fi
