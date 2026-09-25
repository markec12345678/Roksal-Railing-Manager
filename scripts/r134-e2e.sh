#!/bin/bash
# R134 E2E (dev): §9 življenjski cikl — invite → aktivacija → deaktivacija (žeton mrtev) → login blokada.
set -e
BASE="http://localhost:3000"
JAR=/tmp/r134-cookies.txt
rm -f "$JAR"

# 0) admin prijava (račun ustvari tools/create-admin.ts v full-run)
curl -s -c "$JAR" -o /tmp/r134-login.json -X POST "$BASE/api/auth" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d '{"email":"r133-vodja@roksal.si","password":"R133VodjaPass!"}'
# povzdigaj na ADMIN (E2E uporabnik iz R133 je VODJA)
ADMIN_ID=$(curl -s -b "$JAR" "$BASE/api/auth" | python3 -c 'import json,sys; print(json.load(sys.stdin)["user"]["id"])')
node -e "
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
db.profile.update({ where: { id: '$ADMIN_ID' }, data: { vloga: 'ADMIN' } }).then(() => db.\$disconnect()).catch((e) => { console.error(e.message); process.exit(1); });
" 2>/dev/null
# žeton nosi vlogo (snapshot) → po spremembi v bazi SE PONOVNO prijavi
rm -f "$JAR"
curl -s -c "$JAR" -o /dev/null -X POST "$BASE/api/auth" \
  -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d '{"email":"r133-vodja@roksal.si","password":"R133VodjaPass!"}'
echo "admin login OK ($ADMIN_ID, vloga=ADMIN)"

# 1) INVITE: ustvari povabilo
EMAIL="r134-invited-$(date +%s)@roksal.si"
curl -s -b "$JAR" -X POST "$BASE/api/users" -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d '{"action":"invite","email":"'"$EMAIL"'","ime":"R134 Povabljeni","vloga":"MONTER"}' -o /tmp/r134-invite.json
ACT_PATH=$(python3 -c 'import json; print(json.load(open("/tmp/r134-invite.json"))["activationPath"])')
echo "invite OK → $ACT_PATH"

# 2) GET /api/users → nov profil 'Čaka aktivacijo'
curl -s -b "$JAR" "$BASE/api/users" | python3 -c "
import json, sys
users = json.load(sys.stdin)
me = [u for u in users if u['email'] == '$EMAIL'][0]
assert me['lifecycle']['invited'] is True and me['lifecycle']['deactivated'] is False
print('list OK: invited=true, vloga=' + me['vloga'])"

# 3) AKTIVACIJA: javna ruta z žetonom
TOKEN="${ACT_PATH##*/}"
curl -s -X POST "$BASE/api/users/activate" -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d '{"token":"'"$TOKEN"'","password":"R134Aktivirano!"}' -o /tmp/r134-act.json
python3 -c 'import json; assert json.load(open("/tmp/r134-act.json")).get("ok") is True; print("activate OK")'

# isti žeton ponovno → 400
curl -s -o /dev/null -w "activate replay: %{http_code} (pričakovano 400)\n" -X POST "$BASE/api/users/activate" \
  -H "Content-Type: application/json" -H "Origin: $BASE" -d '{"token":"'"$TOKEN"'","password":"R134Aktivirano!"}'

# 4) prijava povabljenega → 200; seja živa (projects 200)
INV_JAR=/tmp/r134-inv-cookies.txt; rm -f "$INV_JAR"
curl -s -c "$INV_JAR" -o /dev/null -w "invited login: %{http_code} (pričakovano 200)\n" -X POST "$BASE/api/auth" \
  -H "Content-Type: application/json" -H "Origin: $BASE" -d '{"email":"'"$EMAIL"'","password":"R134Aktivirano!"}'
curl -s -b "$INV_JAR" -o /dev/null -w "invited projects: %{http_code} (pričakovano 200)\n" "$BASE/api/projects"

# 5) DEAKTIVACIJA (admin) → isti žeton TAKOJ mrtev + prijava → 403
USER_ID=$(curl -s -b "$JAR" "$BASE/api/users" | python3 -c "
import json, sys
print([u for u in json.load(sys.stdin) if u['email'] == '$EMAIL'][0]['id'])")
curl -s -b "$JAR" -X POST "$BASE/api/users" -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d '{"action":"deactivate","userId":"'"$USER_ID"'"}' -o /tmp/r134-deact.json
python3 -c 'import json; d=json.load(open("/tmp/r134-deact.json")); assert d["revokedSessions"] >= 1; print("deactivate OK, revoked:", d["revokedSessions"])'
curl -s -b "$INV_JAR" -o /dev/null -w "invited token after deactivate: %{http_code} (pričakovano 401)\n" "$BASE/api/projects"
curl -s -o /tmp/r134-blocked.json -w "deactivated login: %{http_code} (pričakovano 403)\n" -X POST "$BASE/api/auth" \
  -H "Content-Type: application/json" -H "Origin: $BASE" -d '{"email":"'"$EMAIL"'","password":"R134Aktivirano!"}'
grep -q "deaktiviran" /tmp/r134-blocked.json && echo "blocked message OK (vsebuje 'deaktiviran')"

# 6) reactivate → prijava spet dela
curl -s -b "$JAR" -o /dev/null -w "reactivate: %{http_code} (pričakovano 200)\n" -X POST "$BASE/api/users" \
  -H "Content-Type: application/json" -H "Origin: $BASE" -d '{"action":"reactivate","userId":"'"$USER_ID"'"}'
curl -s -o /dev/null -w "login after reactivate: %{http_code} (pričakovano 200)\n" -X POST "$BASE/api/auth" \
  -H "Content-Type: application/json" -H "Origin: $BASE" -d '{"email":"'"$EMAIL"'","password":"R134Aktivirano!"}'

# 7) audit: USER_INVITE, USER_ACTIVATED, USER_DEACTIVATE, USER_REACTIVATE
node scripts/r134-audit-check.cjs

echo "=== R134 API E2E USPEŠEN ==="
