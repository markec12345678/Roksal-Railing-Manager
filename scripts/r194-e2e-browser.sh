#!/bin/bash
# R194 E2E ŽIVO: CSRF dvojni žeton — celotna veriga na pravem standalone buildu.
#   Z1 prijava izda roksal_csrf piškotek (berljiv iz JS, neprazen)
#   Z2 patched fetch mutacija ŽIVO (customer+project) → NE 403, celotna veriga deluje
#   Z3 negativno: izrecno napačna glava → 403 'dvojni podpis' + korelacija ostane
#   Z4 brez rotacije: GET /api/auth ne spremeni žetona (bootstrap samo če manjka)
#   Z5 grace ŽIVO (curl, samo sejni piškotek, brez žetona) → NE 403 (R130 plast)
#   Z6 javne poti + telemetrija ostajata
#   Z7 odjava pobriše OBА piškotka
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
BASE="http://127.0.0.1:3100"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

export NEXT_PUBLIC_BUILD_STAMP="2026-09-27T08:30:00.000Z"
setsid node .next/standalone/server.js > /tmp/r194-server-e2e.log 2>&1 < /dev/null &
sleep 5

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$BASE/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12
echo "--- prijava ---"
agent-browser eval "JSON.stringify({url:location.pathname, err:window.__err??null})" 2>&1 | tail -1

echo "--- Z1: roksal_csrf izdan ob prijavi (berljiv, neprazen) ---"
agent-browser eval "(()=>{const m=document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('roksal_csrf=')); return JSON.stringify({izdan:!!m, neprazen:!!m&&m.length>'roksal_csrf='.length, dolzina:m?m.length:0});})()" 2>&1 | tail -1

echo "--- Z2: patched mutacija ŽIVO — customer+project skozi ovoj → NE 403 ---"
agent-browser eval "(async()=>{const zig=Date.now(); const c=await fetch('/api/customers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ime:'r194-e2e-'+zig,naslov:'E2E C ulica 11'})}); if(!c.ok) return JSON.stringify({korak:'customer',status:c.status}); const cd=await c.json(); const p=await fetch('/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nazivProjekta:'r194-e2e-'+zig,customerId:cd.id})}); return JSON.stringify({customer:c.status, project:p.status, ni403:c.status!==403&&p.status!==403});})()" 2>&1 | tail -1

echo "--- Z3: napačna glava → 403 'dvojni podpis' + korelacija ---"
agent-browser eval "(async()=>{const r=await fetch('/api/customers',{method:'POST',headers:{'Content-Type':'application/json','x-csrf-token':'napacna-vrednost'},body:JSON.stringify({ime:'x',naslov:'y'})}); const b=await r.json().catch(()=>({})); return JSON.stringify({status:r.status, dvojniPodpis:JSON.stringify(b).includes('dvojni podpis'), korelacija:!!r.headers.get('x-correlation-id')});})()" 2>&1 | tail -1

echo "--- Z4: GET /api/auth NE rotira žetona (bootstrap samo če manjka) ---"
agent-browser eval "(async()=>{const pre=document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('roksal_csrf=')); const r=await fetch('/api/auth'); const post=document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('roksal_csrf=')); return JSON.stringify({authStatus:r.status, enako:pre===post, auth200:r.status===200});})()" 2>&1 | tail -1

echo "--- Z5: grace ŽIVO — curl samo s sejnim piškotkom (brez žetona) → NE 403 ---"
ZIG=$(date +%s)
curl -sS -m 10 -X POST "$BASE/api/auth" -H "Origin: $BASE" -H 'Content-Type: application/json' \
  -d '{"email":"ci@roksal.si","password":"DimniSmoke139!"}' -D /tmp/r194-login-headers.txt -o /dev/null
TOK=$(grep -i '^set-cookie: roksal_session=' /tmp/r194-login-headers.txt | head -1 | sed 's/^[Ss]et-[Cc]ookie: roksal_session=//' | cut -d';' -f1)
CSRF=$(grep -i '^set-cookie: roksal_csrf=' /tmp/r194-login-headers.txt | head -1 | sed 's/^[Ss]et-[Cc]ookie: roksal_csrf=//' | cut -d';' -f1)
echo "login: session=${#TOK} znakov, csrf izdan=${#CSRF} znakov"
ST=$(curl -sS -m 10 -X POST "$BASE/api/customers" -H "Origin: $BASE" -H 'Content-Type: application/json' \
  -H "Cookie: roksal_session=$TOK" -d "{\"ime\":\"r194-grace-$ZIG\",\"naslov\":\"Grace ulica 5\"}" \
  -o /tmp/r194-grace-body.txt -w '%{http_code}')
echo "grace POST /api/customers → $ST (pričakovano NE 403): $(head -c 80 /tmp/r194-grace-body.txt)"

echo "--- Z6: javne poti + telemetrija ---"
curl -sS -m 10 -o /dev/null -w "version:%{http_code} " "$BASE/api/public/version"
curl -sS -m 10 -o /dev/null -w "health:%{http_code}\n" "$BASE/api/public/health"

echo "--- Z7: odjava pobriše OBA piškotka ---"
agent-browser eval "(async()=>{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return JSON.stringify({logout:r.status});})()" 2>&1 | tail -1
sleep 1
agent-browser eval "(()=>{const c=document.cookie; return JSON.stringify({csrfOstane:c.includes('roksal_csrf='), sejaOstane:c.includes('roksal_session='), url:location.pathname});})()" 2>&1 | tail -1

agent-browser screenshot "$SS/e2e-r194-csrf.png" > /dev/null 2>&1 && echo "screenshot OK"
agent-browser close --all > /dev/null 2>&1 || true
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "R194 E2E KONEC"
