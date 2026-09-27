#!/usr/bin/env bash
# R200 — API nivo diagnoza: zakaj je meritveOsvezitev null v produkciji (spot)
# Login (Origin obvezen — CSRF, lekcija R190) → cookie jar → /api/projects → /api/measurements
set -u
BASE="https://roksal-railing-manager.vercel.app"
JAR="/tmp/r200-spot-cookies.txt"
rm -f "$JAR"

echo "=== [1] prijava spot (MONTER) ==="
code=$(curl -sS -m 20 -c "$JAR" -o /tmp/r200-login.json -w '%{http_code}' \
  -H "Origin: $BASE" -H 'Content-Type: application/json' \
  -X POST "$BASE/api/auth" \
  -d '{"email":"spot-r165@roksal.si","password":"SpotR165Qa!Pass"}')
echo "login: $code"
head -c 300 /tmp/r200-login.json; echo

echo "=== [2] /api/projects (status + id + ime) ==="
code=$(curl -sS -m 20 -b "$JAR" -H "Origin: $BASE" -o /tmp/r200-projects.json -w '%{http_code}' \
  "$BASE/api/projects")
echo "projects: $code, bytes: $(wc -c < /tmp/r200-projects.json)"
python3 - <<'PY'
import json
try:
    d = json.load(open('/tmp/r200-projects.json'))
    arr = d if isinstance(d, list) else d.get('projects', d.get('data', []))
    print('število projektov:', len(arr))
    for p in arr[:5]:
        print('  -', p.get('id'), '|', p.get('ime') or p.get('name'), '|', p.get('status'))
except Exception as e:
    print('parse napaka:', e)
    print(open('/tmp/r200-projects.json').read()[:400])
PY

PID=$(python3 -c "
import json
d = json.load(open('/tmp/r200-projects.json'))
arr = d if isinstance(d, list) else d.get('projects', d.get('data', []))
print(arr[0]['id'] if arr else '')
")
echo "prvi projectId: $PID"

echo "=== [3] /api/measurements?projectId=$PID (status + število) ==="
if [ -n "$PID" ]; then
  code=$(curl -sS -m 30 -b "$JAR" -H "Origin: $BASE" -o /tmp/r200-meas.json -w '%{http_code}' \
    "$BASE/api/measurements?projectId=$PID")
  echo "measurements: $code, bytes: $(wc -c < /tmp/r200-meas.json)"
  python3 - <<'PY'
import json
try:
    d = json.load(open('/tmp/r200-meas.json'))
    arr = d if isinstance(d, list) else d.get('measurements', d.get('data', []))
    print('število meritev:', len(arr))
    if arr:
        m = arr[0]
        print('  prva meritev ključi:', sorted(m.keys())[:12])
except Exception as e:
    print('parse napaka:', e)
    print(open('/tmp/r200-meas.json').read()[:400])
PY
fi

echo "=== [4] ponovni GET projects (idempotenca; brez ponovne prijave) ==="
code=$(curl -sS -m 20 -b "$JAR" -H "Origin: $BASE" -o /dev/null -w '%{http_code}' "$BASE/api/projects")
echo "projects ponovno: $code"
