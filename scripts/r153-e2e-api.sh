#!/bin/bash
# R153 E2E živo na lokalnem buildu — §19 perzistenten status meritve.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r153-e2e-server.log 2>&1 < /dev/null &
sleep 4
curl -s -o /dev/null -w "server: %{http_code}\n" http://127.0.0.1:3100/api/auth/demo

echo "=== [1] Prijava (API, ci@roksal.si) ==="
rm -f /tmp/r153-e2e-cookies.txt
curl -s -m 10 -c /tmp/r153-e2e-cookies.txt -X POST http://127.0.0.1:3100/api/auth \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d '{"email":"ci@roksal.si","password":"DimniSmoke139!"}' -o /dev/null -w "login: %{http_code}\n"

echo "=== [2] Projekt + meritev ustvarjena ==="
CUSTOMER=$(curl -s -m 10 -b /tmp/r153-e2e-cookies.txt -X POST http://127.0.0.1:3100/api/customers \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d "{\"ime\":\"R153 E2E $(date +%s)\",\"naslov\":\"Test 1\"}")
CID=$(echo "$CUSTOMER" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo NONE)
PID=$(curl -s -m 10 -b /tmp/r153-e2e-cookies.txt -X POST http://127.0.0.1:3100/api/projects \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d "{\"customerId\":\"$CID\",\"nazivProjekta\":\"R153 E2E status meritve\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "projectId: $PID"
MID=$(curl -s -m 10 -b /tmp/r153-e2e-cookies.txt -X POST http://127.0.0.1:3100/api/measurements \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d "{\"projectId\":\"$PID\",\"dolzinaMm\":3200,\"visinaMm\":1200}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])")
echo "measurementId: $MID"

echo "=== [3] PATCH OSNUTEK → POTRJENA (200, changed:true) ==="
curl -s -m 10 -b /tmp/r153-e2e-cookies.txt -X PATCH "http://127.0.0.1:3100/api/measurements/$MID" \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d '{"status":"POTRJENA"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('changed:', d['changed'], '| status:', d['measurement']['status'], '| statusUpdatedAt:', d['measurement']['statusUpdatedAt'] is not None)"

echo "=== [4] Isti status znova → idempotentno changed:false ==="
curl -s -m 10 -b /tmp/r153-e2e-cookies.txt -X PATCH "http://127.0.0.1:3100/api/measurements/$MID" \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d '{"status":"POTRJENA"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('changed:', d['changed'])"

echo "=== [5] ARHIVIRANA → ponovno odprtje brez razloga → 400 ==="
curl -s -m 10 -b /tmp/r153-e2e-cookies.txt -X PATCH "http://127.0.0.1:3100/api/measurements/$MID" \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d '{"status":"ARHIVIRANA"}' -o /dev/null -w "archive: %{http_code}\n"
curl -s -m 10 -b /tmp/r153-e2e-cookies.txt -X PATCH "http://127.0.0.1:3100/api/measurements/$MID" \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d '{"status":"OSNUTEK"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('reopen no note →', d.get('error','?')[:60])"

echo "=== [6] Ponovno odprtje z razlogom → 200 + razlog v bazi ==="
curl -s -m 10 -b /tmp/r153-e2e-cookies.txt -X PATCH "http://127.0.0.1:3100/api/measurements/$MID" \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d '{"status":"OSNUTEK","note":"r153 e2e — napačno arhivirana"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('changed:', d['changed'], '| note:', d['measurement']['statusNote'])"

echo "=== [7] Revizijska sled: MEASUREMENT_STATUS zapisi ==="
curl -s -m 10 -b /tmp/r153-e2e-cookies.txt "http://127.0.0.1:3100/api/audit?projectId=$PID" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
rows = d.get('entries', [])
ms = [r for r in rows if r.get('akcija') == 'MEASUREMENT_STATUS']
print('MEASUREMENT_STATUS zapisov:', len(ms))
for r in ms:
    print('  old:', r.get('oldValue'), '→ new:', (r.get('newValue') or '')[:70])
"

echo "=== [8] GET vrne perzistenten status (hidracija) ==="
curl -s -m 10 -b /tmp/r153-e2e-cookies.txt "http://127.0.0.1:3100/api/measurements?projectId=$PID" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
for m in d:
    if m.get('statusNote'):
        print('status:', m['status'], '| note:', m['statusNote'])
"

echo "=== [9] Neveljaven status → 400 ==="
curl -s -m 10 -b /tmp/r153-e2e-cookies.txt -X PATCH "http://127.0.0.1:3100/api/measurements/$MID" \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d '{"status":"IZBRISANA"}' -o /dev/null -w "invalid status: %{http_code}\n"

echo "=== [10] Anon PATCH → 401 (proxy vrata) ==="
curl -s -m 10 -X PATCH "http://127.0.0.1:3100/api/measurements/$MID" \
  -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3100" \
  -d '{"status":"POTRJENA"}' -o /dev/null -w "anon patch: %{http_code}\n"

echo "=== [11] DELETE anon → 401 (proxy vrata; brisanje po zasnovi ne obstaja) ==="
curl -s -m 10 -X DELETE "http://127.0.0.1:3100/api/measurements/$MID" \
  -H "Origin: http://127.0.0.1:3100" -o /dev/null -w "anon delete: %{http_code}\n"

echo "E2E-PROJEKT=$PID MERITEV=$MID (ostane v roksal_dev peskovniku — precedens)"
