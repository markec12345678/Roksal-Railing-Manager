#!/bin/bash
# R152 produkcijski QA — preveri R151 fingerprint na produkciji (Vercel).
# Fail-closed: če fingerprint manjka, izpiši in nadaljuj (ne laži).
set -u
BASE="https://roksal-railing-manager.vercel.app"
EMAIL="spot-r152@roksal.si"
PASS="SpotR152Zivo!Qa"
COOKIES=/tmp/r152-prod-cookies.txt

echo "=== [0] Zdravje ==="
curl -sS "$BASE/api/auth/demo" ; echo

echo "=== [1] Registracija spot-r152 (MONTER) ==="
REG=$(curl -sS -m 20 -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"name\":\"Spot R152\",\"role\":\"MONTER\"}")
echo "$REG" | head -c 300; echo

echo "=== [2] Prijava ==="
rm -f "$COOKIES"
curl -sS -m 20 -c "$COOKIES" -X POST "$BASE/api/auth" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" -o /dev/null -w "login: %{http_code}\n"

echo "=== [3] R151 FINGERPRINT: POST /api/quote → reproducibility? ==="
QUOTE=$(curl -sS -m 30 -b "$COOKIES" -X POST "$BASE/api/quote" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d '{"points":[{"xM":0,"zM":0},{"xM":5,"zM":0},{"xM":5,"zM":3}],"closed":false}')
echo "$QUOTE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
repro = d.get('reproducibility')
if repro:
    print('R151 ŽIVO: verzija', repro.get('quoteVersion'), 'odtis', repro.get('inputHash'), 'total', d['quote']['total'])
else:
    print('R151 ŠE NI ŽIVO (odgovor brez reproducibility):', list(d.keys())[:8])
"

echo "=== [4] R151 FINGERPRINT 2×: isti odtis (determinizem na produkciji) ==="
QUOTE2=$(curl -sS -m 30 -b "$COOKIES" -X POST "$BASE/api/quote" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d '{"points":[{"xM":0,"zM":0},{"xM":5,"zM":0},{"xM":5,"zM":3}],"closed":false}')
echo "$QUOTE2" | python3 -c "
import sys, json
d = json.load(sys.stdin)
r = d.get('reproducibility') or {}
print('odtis 2. klica:', r.get('inputHash'), 'total', d['quote']['total'])
"

echo "=== [5] Projekti (MONTER pogled) ==="
curl -sS -m 20 -b "$COOKIES" "$BASE/api/projects" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if isinstance(d, list):
    print('projektov:', len(d))
    for p in d[:3]: print('-', p.get('id'), p.get('naziv') or p.get('name'))
else:
    print('odgovor:', str(d)[:200])
"

rm -f "$COOKIES"
echo "r152-prod-qa-done"
