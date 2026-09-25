#!/bin/bash
# R130 — živi E2E v enem klicu (peskovnik ubija ozadnje procese med klici).
# Vsebuje: priprava računov → dev strežnik → CSRF matrika → dimni test →
#          brskalniška prijava (agent-browser) → poročilo.
set -u
cd /home/z/my-project
FAILED=0

# ── 0) Baza + testni računi (isto bazo, ki jo uporablja dev strežnik) ──
export DATABASE_URL="$(grep -E '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"')"
echo "DATABASE_URL: $(echo "$DATABASE_URL" | sed 's/:[^:@\/]*@/:***@/')"
bunx tsx tools/create-admin.ts r130-admin@roksal.si 'R130E2eGeslo!' ADMIN 'R130 E2E' >/dev/null 2>&1 \
  && echo "✓ ADMIN r130-admin@roksal.si" || { echo "✗ create-admin ADMIN"; exit 1; }
bunx tsx tools/create-admin.ts r130-monter@roksal.si 'R130MonterGeslo!' MONTER 'R130 Monter' >/dev/null 2>&1 \
  && echo "✓ MONTER r130-monter@roksal.si" || { echo "✗ create-admin MONTER"; exit 1; }

# ── 1) Dev strežnik (izoliran dnevnik) ──
pkill -f "next dev" 2>/dev/null; sleep 1
bun run dev > dev-r130.log 2>&1 &
SRV=$!
READY=0
for i in $(seq 1 40); do
  curl -sf http://127.0.0.1:3000/api >/dev/null 2>&1 && { READY=1; break; }
  sleep 2
done
if [ "$READY" != "1" ]; then
  echo "✗ strežnik se ni zagnal"; tail -40 dev-r130.log; kill $SRV 2>/dev/null; exit 1
fi
echo "✓ strežnik pripravljen na :3000"

matrix() { # oznaka pričakovano dejansko
  if [ "$3" = "$2" ]; then echo "  ✓ $1 → $3"
  else echo "  ✗ $1 → $3 (pričakovano $2)"; FAILED=1; fi
}

echo "=== CSRF matrika (živ HTTP) ==="
matrix "1 cross-origin POST (zlonameren Origin)" 403 \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:3000/api/auth -H 'Content-Type: application/json' -H 'Origin: https://zlonameren.example' -d '{"email":"a@b.si","password":"x"}')"
matrix "2 mutacija brez Origin/Referer (fail-closed)" 403 \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:3000/api/auth -H 'Content-Type: application/json' -d '{"email":"a@b.si","password":"x"}')"
matrix "3 isti izvor doseže ruto (napačno geslo → 401)" 401 \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:3000/api/auth -H 'Content-Type: application/json' -H 'Origin: http://127.0.0.1:3000' -d '{"email":"r130-admin@roksal.si","password":"napacno-geslo"}')"
matrix "4 GET z tujim Origin ostane anon 401" 401 \
  "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/projects -H 'Origin: https://zlonameren.example')"
matrix "5 Bearer s tujim Origin doseže auth (401 napačen ključ)" 401 \
  "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/sync -H 'Origin: https://zlonameren.example' -H 'Authorization: Bearer rkm_napacenkliuc')"
matrix "6 Referer rezerva (isti izvor) doseže ruto" 401 \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:3000/api/auth -H 'Content-Type: application/json' -H 'Referer: http://127.0.0.1:3000/login' -d '{"email":"r130-admin@roksal.si","password":"napacno-geslo"}')"
matrix "7 OPTIONS preflight gre skozi" 401 \
  "$(curl -s -o /dev/null -w '%{http_code}' -X OPTIONS http://127.0.0.1:3000/api/projects -H 'Origin: https://zlonameren.example')"

echo "=== Dimni test (tools/security-smoke.py) ==="
EMAIL=r130-admin@roksal.si PASSWORD='R130E2eGeslo!' \
MONTER_EMAIL=r130-monter@roksal.si MONTER_PASSWORD='R130MonterGeslo!' \
  python3 tools/security-smoke.py || FAILED=1

echo "=== Brskalniška prijava (agent-browser — pravi Origin brskalnika) ==="
agent-browser open http://127.0.0.1:3000/login >/dev/null 2>&1
agent-browser fill "input[type=email]" r130-admin@roksal.si >/dev/null 2>&1 || { echo "✗ email vnos"; FAILED=1; }
agent-browser fill "input[type=password]" 'R130E2eGeslo!' >/dev/null 2>&1 || { echo "✗ geslo vnos"; FAILED=1; }
agent-browser click "button[type=submit]" >/dev/null 2>&1
# Dev (Turbopack) mora po uspešni prijavi ŠE prevesti ciljno stran — URL se
# zato zamenja šele, ko navigacija konča. Pollamo do 45 s.
URL_NOW="/login"
for i in $(seq 1 15); do
  sleep 3
  URL_NOW="$(agent-browser get url 2>/dev/null | tail -1)"
  case "$URL_NOW" in *"/login"*) : ;; *) break ;; esac
done
echo "  URL po prijavi: $URL_NOW"
case "$URL_NOW" in
  *"/login"*) echo "  ✗ prijava NI uspela (ostal na /login)"; FAILED=1 ;;
  *) echo "  ✓ prijava uspela — brskalnik je poslal Origin in proxy je spustil" ;;
esac
agent-browser errors 2>/dev/null | tail -3
agent-browser screenshot /home/z/my-project/qa-r130-login-csrf.png >/dev/null 2>&1

kill $SRV 2>/dev/null
pkill -f "next dev" 2>/dev/null
echo
if [ "$FAILED" = "0" ]; then echo "REZULTAT: VSE ZELENO ✓"; else echo "REZULTAT: NAPOKE — glej zgoraj"; fi
exit $FAILED
