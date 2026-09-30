# R325 dimni test (vzorec r273/r296-r323; DVOJNA KOLIZIJA #5+#6: vzporedni R323 [CSV] + R324 [dnevni PDF] — runda preimenovana R323→R324→R325) — standalone :3100 + javni health +
# prijavna rute + PWA manifest (brez DB mutacij — samo bralni pepperji).
# Potrjuje, da build z R324 spremembami (DEKOMPOZICIJA FAZA 2 — vzorec
# R319/R322 prirojena runda: measurements 7.604 → 7.153 [−451; laserski BT
# blok → laser-bt.ts + use-laser.ts + laser-panel.ts; template localStorage
# blok → templates.ts; osiroteli Bluetooth/Radio/Unplug uvozi odstranjeni]
# + calculator 5.372 → 4.846 [−526; 5 PDF izvozov → pdf-exports.ts z args
# objekti; tipa CncSegment/GlassType preseljena; osirotela jsPDF/autoTable
# uvoza odstranjena]) vstane in odgovarja fail-closed.
# dokazana na žici: calculator + val-3 quote/evidence pokvarjen JSON = 400,
# nikoli 500)
# vstane in odgovarja fail-closed.
# NOVO R324: brez nove API površine (dekompozicija = refaktor internih
# struktur — R319/R322 kanon) — meja probei ostanejo OBVEZNA regresija
# (49 vezav EN VIR; calculator meja je ZLASTI pomembna — pdf-exports.ts je
# sedaj del client drevesa calculator čanka).
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-R325-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!}"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R325-server-smoke.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

echo "--- health ---"
curl -s --max-time 10 http://127.0.0.1:3100/api/public/health; echo
echo "--- /login (GET status) ---"
curl -s -o /dev/null -w "%{http_code}\n" --max-time 10 http://127.0.0.1:3100/login
echo "--- PWA manifest ---"
curl -s -o /dev/null -w "%{http_code}\n" --max-time 10 http://127.0.0.1:3100/manifest.webmanifest
echo "--- auth brez Origin = 403 CSRF (fail-closed) ---"
curl -s -o /dev/null -w "%{http_code}\n" --max-time 10 -X POST http://127.0.0.1:3100/api/auth -H 'Content-Type: application/json' -d '{"email":"x@y.z","geslo":"n"}'
echo "--- meja ŽIVO na standalone: calculator pokvarjen JSON (prijavljen) → 400, nikoli 500 ---"
# dvojni podpis: prijava izda roksal_csrf piškotek; mutacije morajo poslati
# x-csrf-token z isto vrednostjo (brskalnik pošlje samodejno, curl ročno).
COOKIE=/tmp/r325-smoke-cookies.txt
curl -s -c "$COOKIE" -o /dev/null -w "login=%{http_code}\n" --max-time 10 -X POST http://127.0.0.1:3100/api/auth -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3100" -d '{"email":"ci@roksal.si","password":"DimniSmoke139!"}'
CSRF=$(grep roksal_csrf "$COOKIE" | awk '{print $7}')
curl -s -b "$COOKIE" -H "x-csrf-token: $CSRF" -o /tmp/r325-smoke-telo.json -w "calculator-pokvarjen=%{http_code}\n" --max-time 10 -X POST http://127.0.0.1:3100/api/calculator -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3100" -d '{"type":"railing",,'
grep -qF 'Neveljavno telo zahteve' /tmp/r325-smoke-telo.json && echo "meja ovojnica OK (400 + { error })" || { echo "FAIL-CLOSED: ovojnica manjka"; exit 1; }

echo "--- meja ŽIVO val-3: quote pokvarjen JSON (prijavljen) → 400, nikoli 500 ---"
curl -s -b "$COOKIE" -H "x-csrf-token: $CSRF" -o /tmp/r325-smoke-quote.json -w "quote-pokvarjen=%{http_code}\n" --max-time 10 -X POST http://127.0.0.1:3100/api/quote -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3100" -d '{pokvarjen'
grep -qF 'Neveljavno telo zahteve' /tmp/r325-smoke-quote.json && echo "val-3 ovojnica OK (400 + { error } — ISTA EN VIR)" || { echo "FAIL-CLOSED: val-3 ovojnica manjka"; exit 1; }

echo "--- meja ŽIVO val-3 regresija: evidence pokvarjen JSON (prijavljen) → 400, nikoli 500 ---"
curl -s -b "$COOKIE" -H "x-csrf-token: $CSRF" -o /tmp/r325-smoke-evidence.json -w "evidence-pokvarjen=%{http_code}\n" --max-time 10 -X POST http://127.0.0.1:3100/api/evidence -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3100" -d '{pokvarjen'
grep -qF 'Neveljavno telo zahteve' /tmp/r325-smoke-evidence.json && echo "val-3 evidence ovojnica OK (400 + { error } — ISTA EN VIR)" || { echo "FAIL-CLOSED: val-3 evidence ovojnica manjka"; exit 1; }

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "--- R325 SMOKE KONEC ---"
