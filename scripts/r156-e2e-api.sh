#!/bin/bash
# R156 E2E živo na lokalnem buildu — /api/crm PATCH vrata + validacija + revizija
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
BASE="http://127.0.0.1:3100"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
setsid node .next/standalone/server.js > /tmp/r156-e2e-server.log 2>&1 < /dev/null &
sleep 4
curl -s -o /dev/null -w "server: %{http_code}\n" "$BASE/api/auth/demo"

rm -f /tmp/r156-e2e-own.txt /tmp/r156-e2e-sklad.txt

echo "=== [1] Prijava lastnik (ci@roksal.si ADMIN) + SKLADISCE (r156-e2e-sklad) ==="
curl -s -m 10 -c /tmp/r156-e2e-own.txt -X POST "$BASE/api/auth" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d '{"email":"ci@roksal.si","password":"DimniSmoke139!"}' -o /dev/null -w "login ci: %{http_code}\n"
curl -s -m 10 -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d "{\"email\":\"r156-e2e-sklad@roksal.si\",\"password\":\"R156Sklad#2026x\",\"name\":\"R156 Sklad\"}" \
  -o /dev/null -w "registracija: %{http_code}\n"
# SKLADISCE vloga: registracija da MONTER; sprememba prek users rute (ADMIN)
SKLAD_ID=$(curl -s -m 10 -b /tmp/r156-e2e-own.txt "$BASE/api/users" | python3 -c "
import sys, json
users = json.load(sys.stdin)
users_list = users.get('users', users) if isinstance(users, dict) else users
print(next((u['id'] for u in users_list if u.get('email') == 'r156-e2e-sklad@roksal.si'), ''))
")
if [ -n "$SKLAD_ID" ]; then
  curl -s -m 10 -b /tmp/r156-e2e-own.txt -X POST "$BASE/api/users" \
    -H "Content-Type: application/json" -H "Origin: $BASE" \
    -d "{\"action\":\"setRole\",\"userId\":\"$SKLAD_ID\",\"vloga\":\"SKLADISCE\"}" -o /dev/null -w "vloga SKLADISCE: %{http_code}\n"
fi
curl -s -m 10 -c /tmp/r156-e2e-sklad.txt -X POST "$BASE/api/auth" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d '{"email":"r156-e2e-sklad@roksal.si","password":"R156Sklad#2026x"}' -o /dev/null -w "login sklad: %{http_code}\n"

echo "=== [2] Stranka (ADMIN) ==="
CID=$(curl -s -m 10 -b /tmp/r156-e2e-own.txt -X POST "$BASE/api/customers" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d "{\"ime\":\"R156 E2E stranka $(date +%s)\",\"naslov\":\"Test 1\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "customerId: $CID"

echo "=== [3] SKLADISCE PATCH → 403 (prej: 200 — P1 fix) ==="
curl -s -m 10 -b /tmp/r156-e2e-sklad.txt -X PATCH "$BASE/api/crm" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d "{\"id\":\"$CID\",\"status\":\"NEAKTIVEN\"}" \
  -o /tmp/r156-sklad.json -w "SKLADISCE PATCH crm: %{http_code} (403)\n"
head -c 150 /tmp/r156-sklad.json; echo ""

echo "=== [4] anon PATCH → 401 ==="
curl -s -m 10 -X PATCH "$BASE/api/crm" -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d "{\"id\":\"$CID\",\"status\":\"NEAKTIVEN\"}" -o /dev/null -w "anon PATCH crm: %{http_code} (401)\n"

echo "=== [5] ADMIN: poljuben status → 400 z razlogom ==="
curl -s -m 10 -b /tmp/r156-e2e-own.txt -X PATCH "$BASE/api/crm" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d "{\"id\":\"$CID\",\"status\":\"POLJUBEN\"}" \
  -o /tmp/r156-st.json -w "poljuben status: %{http_code} (400)\n"
head -c 180 /tmp/r156-st.json; echo ""

echo "=== [6] ADMIN: neveljaven datum → 400 ==="
curl -s -m 10 -b /tmp/r156-e2e-own.txt -X PATCH "$BASE/api/crm" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d "{\"id\":\"$CID\",\"opomnikDatum\":\"ni-datum\"}" \
  -o /dev/null -w "neveljaven datum: %{http_code} (400)\n"

echo "=== [7] ADMIN: veljaven PATCH → 200 + status v bazi + revizija z oldValue ==="
curl -s -m 10 -b /tmp/r156-e2e-own.txt -X PATCH "$BASE/api/crm" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d "{\"id\":\"$CID\",\"status\":\"NEAKTIVEN\",\"opombeCRM\":\"R156 e2e opomba\"}" \
  -o /tmp/r156-ok.json -w "veljaven PATCH: %{http_code} (200)\n"
python3 -c "import json; d=json.load(open('/tmp/r156-ok.json')); print('status:', d['customer']['status'], '| opombeCRM:', d['customer']['opombeCRM'])"

echo "=== [8] neznana stranka → 404 (prej: 500) ==="
curl -s -m 10 -b /tmp/r156-e2e-own.txt -X PATCH "$BASE/api/crm" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d "{\"id\":\"r156-ne-obstaja\",\"status\":\"AKTIVEN\"}" \
  -o /dev/null -w "neznana stranka: %{http_code} (404)\n"

echo "=== [9] revizija: pravi userId + oldValue (psql — CRM_UPDATE nima projectId, /api/audit je projektno vezan) ==="
PGPASSWORD=roksal psql -h localhost -p 5433 -U roksal -d roksal_dev -t -A -c \
  "SELECT CASE WHEN user_id IS NULL THEN 'NULL_USER' ELSE (SELECT email FROM \"User\" u WHERE u.id = a.user_id) END, left(old_value, 40), left(new_value, 90) FROM \"AuditLog\" a WHERE akcija = 'CRM_UPDATE' ORDER BY timestamp DESC LIMIT 1;"
