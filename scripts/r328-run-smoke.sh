# R328 dimni test (vzorec r273/r296-r327) — standalone :3100 + javni health +
# prijavna rute + PWA manifest (brez DB mutacij — samo bralni pepperji).
# Potrjuje, da build z R328 spremembami (55. ČLEN issue #1 §5: PRIMERJAVA
# DOBAVITELJEV — NOVI lib cena-dobavitelji: drugo grupiranje ISTEGA pregleda
# zgodovine R326 [EN VIR — pregled kot PROP, nič drugega fetcha; iskren
# agregat ŠTEVCEV smeri; NOVI pod panel CenaDobaviteljiPanel — LOČEN
# datoteka; CSV gumb navy/40 ring + press-scale]; STIL val 15 dvonivojska
# hierarhija na novi površini; R327 dedovina: 54. ČLEN issue #1 IZVOZI:
# ZGODOVINA CEN PDF — deterministični PDF BRAT CSV-ju R326 [NOVI lib
# cena-zgodovina-pdf; EN VIR cenaParVrstice; panel izvozni PAR CSV+PDF na
# isti blok glavi — OBA gumba navy/40 ring + press-scale, iskrena ničelna
# veja]; R326 dedovina: 53. ČLEN issue #1 §5: ZGODOVINA
# CEN MATERIALA — price history: NOVI lib cena-zgodovina [ČISTA projekcija
# MaterialPrice vključno z zaprto zgodovino; EN VIR glave + CENA_SMER_NIZ
# + sklep + VIR_NIZ]; NOVI GET route material-prices/zgodovina [r308 obseg
# 81→82]; NOVI panel CenaZgodovinaPanel na inventory tabu; STIL val 13
# dvonivojska hierarhija na novi površini [par amber/30 + vrstica amber/40]) + dedovina vzporedne R322 (DEKOMPOZICIJA calculator-tab
# FAZA 1 — PRIROJENIŠKA runda po vzorcu R319: 6.074 → 5.372 vrstic [−702];
# mapa calculator/ ×5 datotek [shared.ts tipi+konstante VERBATIM + export +
# 4 SVG diagrami ČIST PREMIK bajtno identično — vsebina ŽIVA v čankih
# r322-build-needles ×5] + R254 SLEPA PEGA ZAPRTA: vejica v uvoznem
# komentarju je skrila 5 ikon detektorju — trojni popravek [detektor +
# codemod + vitest stražar: strip // PRED split] + 5 a11y popravkov IN-PLACE
# [Bluetooth ×2 + Mic ×3 — aria-hidden, r172 vrstični pin varovan]; pokritost
# 1430 → 1435, 0 manjkajočih) vstane in odgovarja fail-closed.
# dokazana na žici: calculator + val-3 quote/evidence pokvarjen JSON = 400,
# nikoli 500)
# vstane in odgovarja fail-closed.
# NOVO R323: brez nove API površine (izvoz je čista klientska projekcija —
# blob download po kanonu IZVOZI družine) — meja probei ostanejo OBVEZNA regresija (49 vezav EN VIR).
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-R328-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!}"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R328-server-smoke.log 2>&1 < /dev/null &
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
COOKIE=/tmp/r328-smoke-cookies.txt
curl -s -c "$COOKIE" -o /dev/null -w "login=%{http_code}\n" --max-time 10 -X POST http://127.0.0.1:3100/api/auth -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3100" -d '{"email":"ci@roksal.si","password":"DimniSmoke139!"}'
CSRF=$(grep roksal_csrf "$COOKIE" | awk '{print $7}')
curl -s -b "$COOKIE" -H "x-csrf-token: $CSRF" -o /tmp/r328-smoke-telo.json -w "calculator-pokvarjen=%{http_code}\n" --max-time 10 -X POST http://127.0.0.1:3100/api/calculator -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3100" -d '{"type":"railing",,'
grep -qF 'Neveljavno telo zahteve' /tmp/r328-smoke-telo.json && echo "meja ovojnica OK (400 + { error })" || { echo "FAIL-CLOSED: ovojnica manjka"; exit 1; }

echo "--- meja ŽIVO val-3: quote pokvarjen JSON (prijavljen) → 400, nikoli 500 ---"
curl -s -b "$COOKIE" -H "x-csrf-token: $CSRF" -o /tmp/r328-smoke-quote.json -w "quote-pokvarjen=%{http_code}\n" --max-time 10 -X POST http://127.0.0.1:3100/api/quote -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3100" -d '{pokvarjen'
grep -qF 'Neveljavno telo zahteve' /tmp/r328-smoke-quote.json && echo "val-3 ovojnica OK (400 + { error } — ISTA EN VIR)" || { echo "FAIL-CLOSED: val-3 ovojnica manjka"; exit 1; }

echo "--- meja ŽIVO val-3 regresija: evidence pokvarjen JSON (prijavljen) → 400, nikoli 500 ---"
curl -s -b "$COOKIE" -H "x-csrf-token: $CSRF" -o /tmp/r328-smoke-evidence.json -w "evidence-pokvarjen=%{http_code}\n" --max-time 10 -X POST http://127.0.0.1:3100/api/evidence -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3100" -d '{pokvarjen'
grep -qF 'Neveljavno telo zahteve' /tmp/r328-smoke-evidence.json && echo "val-3 evidence ovojnica OK (400 + { error } — ISTA EN VIR)" || { echo "FAIL-CLOSED: val-3 evidence ovojnica manjka"; exit 1; }

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "--- R328 SMOKE KONEC ---"
