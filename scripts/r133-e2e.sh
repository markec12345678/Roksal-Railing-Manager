#!/bin/bash
# R133 E2E (dev): §8 scoped merilna povezava — upravljanje + javna stran + oddaja meritve.
# POGOJ: dev strežnik že teče (glej sklopljen zagon v r133-full-run.sh).
set -e
BASE="http://localhost:3000"
JAR=/tmp/r133-cookies.txt
rm -f "$JAR"

# 1) prijava (VODJA iz dev baze — ustvari tools/create-admin.ts)
EMAIL="r133-vodja@roksal.si"
PASS="R133VodjaPass!"
LOGIN_CODE=$(curl -s -o /tmp/r133-login.json -w "%{http_code}" -c "$JAR" -X POST "$BASE/api/auth" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
echo "login: $LOGIN_CODE $(head -c 120 /tmp/r133-login.json)"
if [ "$LOGIN_CODE" != "200" ]; then
  bunx tsx tools/create-admin.ts r133-vodja@roksal.si 'R133VodjaPass!' VODJA 'R133 Vodja' 2>&1 | tail -1
  LOGIN_CODE=$(curl -s -o /tmp/r133-login.json -w "%{http_code}" -c "$JAR" -X POST "$BASE/api/auth" \
    -H "Content-Type: application/json" -H "Origin: $BASE" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
  echo "login2: $LOGIN_CODE"
fi

# 2) izberi projekt (prvi iz seznama za uporabnika)
PROJECT_ID=$(curl -s -b "$JAR" "$BASE/api/projects" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['id'] if d else '')")
echo "project: $PROJECT_ID"

# 3) GET /api/portal → merilni blok obstaja (stanje je lahko katerokoli — ponovljivost)
curl -s -b "$JAR" "$BASE/api/portal?projectId=$PROJECT_ID" -o /tmp/r133-portal.json
python3 - <<'EOF'
import json
d = json.load(open('/tmp/r133-portal.json'))
m = d.get('measure') or {}
print('portal GET measure:', json.dumps(m, ensure_ascii=False)[:220])
assert 'token' in m and 'enabled' in m and 'url' in m, 'measure blok naj bi obstajal v GET odgovoru'
EOF

# 4) measureRegenerate → nov kripto žeton (stari mrtev, revokacija počiščena)
curl -s -b "$JAR" -X POST "$BASE/api/portal" -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d '{"projectId":"'"$PROJECT_ID"'","action":"measureRegenerate"}' -o /tmp/r133-regen.json
python3 - <<'EOF'
import json, re
d = json.load(open('/tmp/r133-regen.json'))
m = d['measure']
print('regen measure:', json.dumps(m, ensure_ascii=False)[:220])
assert re.fullmatch(r'[A-Za-z0-9_-]{24}', m['token']), 'nov žeton = 24 base64url'
assert m['expiresAt'], 'potek nastavljen (90 dni)'
open('/tmp/r133-token.txt', 'w').write(m['token'])
EOF
TOKEN=$(cat /tmp/r133-token.txt)
echo "token: $TOKEN"

# 5) javna stran /m/<token> → 200 (HTML z merilnim klientom)
PAGE_CODE=$(curl -s -o /tmp/r133-page.html -w "%{http_code}" "$BASE/m/$TOKEN")
echo "page: $PAGE_CODE size=$(wc -c < /tmp/r133-page.html)"
grep -q "Pozdravljeni\|Nalagam merilno karto\|ROKSAL" /tmp/r133-page.html && echo "page OK: merilna stran renderirana"

# 6) javni POST meritve z Idempotency-Key → 201; ponovitev → replay/dedupe (iskren, brez dvojnika)
BODY='{"token":"'"$TOKEN"'","points":[[46.05,14.5],[46.055,14.505],[46.06,14.51]],"skupajM":120.4,"imeStranke":"R133 Tester"}'
POST1=$(curl -s -o /tmp/r133-post1.json -w "%{http_code}" -X POST "$BASE/api/public/measure" \
  -H "Content-Type: application/json" -H "Origin: $BASE" -H "Idempotency-Key: r133-e2e-key-$(date +%s)" -d "$BODY")
echo "post1: $POST1 $(cat /tmp/r133-post1.json)"
POST2=$(curl -s -o /tmp/r133-post2.json -w "%{http_code}" -X POST "$BASE/api/public/measure" \
  -H "Content-Type: application/json" -H "Origin: $BASE" -H "Idempotency-Key: r133-e2e-key-$(date +%s)" -d "$BODY")
echo "post2 (dedupe): $POST2 $(cat /tmp/r133-post2.json)"
python3 - <<'EOF'
import json
p1 = json.load(open('/tmp/r133-post1.json'))
p2 = json.load(open('/tmp/r133-post2.json'))
assert p1.get('ok') and p1['id'], 'post1 naj bi ustvaril meritev'
assert p2.get('duplicate') is True and p2['id'] == p1['id'], 'post2 naj bi vrnil ISTO meritev (duplicate protection)'
print('dedupe OK: isti id, brez dvojnika')
EOF

# 7) revokacija → javna stran → neveljavna vsebina
curl -s -b "$JAR" -X POST "$BASE/api/portal" -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d '{"projectId":"'"$PROJECT_ID"'","action":"measureRevoke"}' -o /tmp/r133-revoke.json
python3 -c "import json; d=json.load(open('/tmp/r133-revoke.json')); m=d['measure']; assert m['enabled'] is False and m['revokedAt'], 'revoke stanje'; print('revoke OK:', json.dumps(m, ensure_ascii=False)[:160])"
REVOKE_CONTENT=$(curl -s "$BASE/m/$TOKEN" | grep -c "Povezava ni veljavna" || true)
echo "page after revoke: neveljavnih oznak = $REVOKE_CONTENT (pričakovano ≥1)"

# 8) audit dnevnik: javni dogodki z ipHash 32 hex, management z akterjem
export DATABASE_URL=$(grep -E "^DATABASE_URL=" .env | head -1 | cut -d= -f2- | tr -d '"')
node scripts/r133-audit-check.cjs

echo "=== R133 E2E USPEŠEN ==="
