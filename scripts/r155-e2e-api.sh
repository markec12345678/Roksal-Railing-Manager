#!/bin/bash
# R155 E2E živo na lokalnem buildu — IDOR zaključek (surveys/qc/punch/evidence/invoices)
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
BASE="http://127.0.0.1:3100"

# Počisti morebitne ostane procese na 3100, nato zaženi svež build (vzorec R154).
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
setsid node .next/standalone/server.js > /tmp/r155-e2e-server.log 2>&1 < /dev/null &
sleep 4
curl -s -o /dev/null -w "server: %{http_code}\n" "$BASE/api/auth/demo"

rm -f /tmp/r155-e2e-own.txt /tmp/r155-e2e-out.txt

echo "=== [1] Prijava lastnik (ci@roksal.si ADMIN dev peskovnik) ==="
curl -s -m 10 -c /tmp/r155-e2e-own.txt -X POST "$BASE/api/auth" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d '{"email":"ci@roksal.si","password":"DimniSmoke139!"}' -o /dev/null -w "login: %{http_code}\n"

echo "=== [2] Projekt (lastnik) ==="
CUSTOMER=$(curl -s -m 10 -b /tmp/r155-e2e-own.txt -X POST "$BASE/api/customers" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d "{\"ime\":\"R155 E2E $(date +%s)\",\"naslov\":\"Test 1\"}")
CID=$(echo "$CUSTOMER" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo NONE)
PID=$(curl -s -m 10 -b /tmp/r155-e2e-own.txt -X POST "$BASE/api/projects" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d "{\"customerId\":\"$CID\",\"nazivProjekta\":\"R155 E2E IDOR\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "projectId: $PID"

echo "=== [3] TUJ MONTER (registracija na lokalnem buildu) ==="
curl -s -m 10 -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d "{\"email\":\"r155-e2e-out@roksal.si\",\"password\":\"R155Out#2026x\",\"name\":\"R155 Out\"}" \
  -o /dev/null -w "registracija: %{http_code}\n"
curl -s -m 10 -c /tmp/r155-e2e-out.txt -X POST "$BASE/api/auth" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d '{"email":"r155-e2e-out@roksal.si","password":"R155Out#2026x"}' -o /dev/null -w "prijava: %{http_code}\n"

echo "=== [4] surveys: tuj GET → 403, tuj POST → 403, lastnik POST → 200 ==="
curl -s -m 10 -b /tmp/r155-e2e-out.txt "$BASE/api/surveys?projectId=$PID" \
  -o /dev/null -w "tuj GET surveys: %{http_code} (403)\n"
curl -s -m 10 -b /tmp/r155-e2e-out.txt -X POST "$BASE/api/surveys" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d "{\"projectId\":\"$PID\",\"tipObjekta\":\"balkon\",\"opombe\":\"TUJ\"}" \
  -o /dev/null -w "tuj POST surveys: %{http_code} (403)\n"
curl -s -m 10 -b /tmp/r155-e2e-own.txt -X POST "$BASE/api/surveys" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d "{\"projectId\":\"$PID\",\"tipObjekta\":\"balkon\",\"opombe\":\"lastnik\"}" \
  -o /dev/null -w "lastnik POST surveys: %{http_code} (200)\n"
curl -s -m 10 -b /tmp/r155-e2e-out.txt "$BASE/api/surveys?projectId=r155-ne-obstaja" \
  -o /dev/null -w "neznani GET surveys: %{http_code} (404)\n"

echo "=== [5] punch: tuj POST → 403, lastnik POST → 201, tuj DELETE → 403, točka ostane ==="
ITEM=$(curl -s -m 10 -b /tmp/r155-e2e-own.txt -X POST "$BASE/api/punch" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d "{\"projectId\":\"$PID\",\"naslov\":\"R155 E2E tocka\"}")
IID=$(echo "$ITEM" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo NONE)
echo "itemId: $IID"
curl -s -m 10 -b /tmp/r155-e2e-out.txt -X POST "$BASE/api/punch" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d "{\"projectId\":\"$PID\",\"naslov\":\"TUJA tocka\"}" -o /dev/null -w "tuj POST punch: %{http_code} (403)\n"
curl -s -m 10 -b /tmp/r155-e2e-out.txt -X DELETE "$BASE/api/punch?id=$IID" \
  -o /dev/null -w "tuj DELETE punch: %{http_code} (403)\n"
curl -s -m 10 -b /tmp/r155-e2e-out.txt -X PATCH "$BASE/api/punch" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d "{\"id\":\"$IID\",\"status\":\"done\"}" -o /dev/null -w "tuj PATCH punch: %{http_code} (403)\n"
curl -s -m 10 -b /tmp/r155-e2e-own.txt "$BASE/api/punch?projectId=$PID" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('vrstic:', len(d), '| status:', d[0]['status'], '(pricakovano 1, open)')"

echo "=== [6] evidence: tuj GET → 403; neznani → 404; lastnik GET → 200 ==="
curl -s -m 10 -b /tmp/r155-e2e-out.txt "$BASE/api/evidence?projectId=$PID" \
  -o /dev/null -w "tuj GET evidence: %{http_code} (403)\n"
curl -s -m 10 -b /tmp/r155-e2e-out.txt "$BASE/api/evidence?projectId=r155-ne-obstaja" \
  -o /dev/null -w "neznani GET evidence: %{http_code} (404)\n"
curl -s -m 10 -b /tmp/r155-e2e-own.txt "$BASE/api/evidence?projectId=$PID" \
  -o /dev/null -w "lastnik GET evidence: %{http_code} (200)\n"

echo "=== [7] invoices: tuj GET ?projectId= → 403 (prej 200!); lastnik → 200 ==="
curl -s -m 10 -b /tmp/r155-e2e-out.txt "$BASE/api/invoices?projectId=$PID" \
  -o /tmp/r155-inv-out.json -w "tuj GET invoices: %{http_code} (403)\n"
head -c 120 /tmp/r155-inv-out.json; echo ""
curl -s -m 10 -b /tmp/r155-e2e-own.txt "$BASE/api/invoices?projectId=$PID" \
  -o /dev/null -w "lastnik GET invoices: %{http_code} (200)\n"

echo "=== [8] qc: tuj GET → 403; lastnik GET → 200 ==="
curl -s -m 10 -b /tmp/r155-e2e-out.txt "$BASE/api/qc?projectId=$PID" \
  -o /dev/null -w "tuj GET qc: %{http_code} (403)\n"
curl -s -m 10 -b /tmp/r155-e2e-own.txt "$BASE/api/qc?projectId=$PID" \
  -o /dev/null -w "lastnik GET qc: %{http_code} (200)\n"

echo "=== [9] anon → 401 na vseh petih rutah ==="
for path in "surveys?projectId=x" "qc?projectId=x" "punch?projectId=x" "evidence?projectId=x" "invoices"; do
  curl -s -m 10 "$BASE/api/$path" -o /dev/null -w "anon GET $path: %{http_code} (401)\n"
done
