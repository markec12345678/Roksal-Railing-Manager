# R338 dimni test (vzorec r273/r296-r337) — standalone :3100 + javni health +
# prijavna rute + PWA manifest (brez DB mutacij — samo bralni pepperji).
# Potrjuje, da build z R338 spremembami (DEKOMPOZICIJA measurements-tab
# FAZA 3 — PRIROJENIŠKA runda, vzorec R322/R325: NOVA mapa measurements/
# ×2 — labels.ts [GroundType + AuditEntry + 17 Record zbirk] + format.ts
# [ArMetadata + 13 čistih funkcij] — ČIST PREMIK bajtno identično,
# NULPREMIK verify_r338.py; measurements-tab.tsx 7.153 → 6.809 vrstic;
# osiroteli ikonski uvozi odstranjeni; PIN SHIFTI ×6
# [r172/r316/r311/r231/r234/r235]; NOV Z-blok NI dodan — pokritost =
# r338-build-needles premik-needleji + polne E2E regresije; R337 dedovina:
# 64. ČLEN issue #1 IZVOZI: AI RABA PREGLED CSV [EN VIR aiRabaCsv(aiRaba);
# STIL val 24]; R336 dedovina: 63. ČLEN issue #1 IZVOZI: SISTEM ZDRAVJE CSV
# [EN VIR seja zgodovina + odziviStatistika; STIL val 23]; R335 dedovina:
# 62. ČLEN issue #1 IZVOZI: MESEČNO POROČILO VODJE CSV [izvozna PAR; STIL
# val 22]; R334 dedovina: 61. ČLEN [KONČNA VERIFIKACIJA CSV — TRIADA]; R333
# dedovina: 60. ČLEN
# issue #1 IZVOZI: DOBAVITELJI — POZICIJA CEN CSV [EN VIR preverba + JOIN +
# min-invarianta + agregat + sort; KPI peterica]; R332 dedovina: 59. ČLEN
# issue #1 IZVOZI: POTEKLI OPOMNIKI CSV [EN VIR preverba + sort + agregat;
# KPI trio]; R331 dedovina: 58. ČLEN issue #1 IZVOZI: PONUDBE — SPOMNIKI
# CSV [EN VIR ponudbeSpomnikiPregled]; R330 dedovina: 57. ČLEN issue #1
# IZVOZI: PROJEKTI — TERMINI CSV — CSV brat PDF R265 [EN VIR
# projektiTerminiPregled; izvozna PAR na logistiki]; R329 dedovina: 56.
# ČLEN issue #1 IZVOZI: PRIMERJAVA DOBAVITELJEV PDF [EN VIR
# cenaDobaviteljiVrstice; FNV soli 0xd5–0xd8]; R328 dedovina: 55. ČLEN
# issue #1 §5: PRIMERJAVA DOBAVITELJEV [EN VIR — pregled kot PROP; NOVI
# pod panel CenaDobaviteljiPanel — LOČEN datoteka]; R327 dedovina: 54.
# ČLEN issue #1 IZVOZI: ZGODOVINA
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
export SESSION_SECRET="${SESSION_SECRET:-R338-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!}"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R338-server-smoke.log 2>&1 < /dev/null &
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
COOKIE=/tmp/r338-smoke-cookies.txt
curl -s -c "$COOKIE" -o /dev/null -w "login=%{http_code}\n" --max-time 10 -X POST http://127.0.0.1:3100/api/auth -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3100" -d '{"email":"ci@roksal.si","password":"DimniSmoke139!"}'
CSRF=$(grep roksal_csrf "$COOKIE" | awk '{print $7}')
curl -s -b "$COOKIE" -H "x-csrf-token: $CSRF" -o /tmp/r338-smoke-telo.json -w "calculator-pokvarjen=%{http_code}\n" --max-time 10 -X POST http://127.0.0.1:3100/api/calculator -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3100" -d '{"type":"railing",,'
grep -qF 'Neveljavno telo zahteve' /tmp/r338-smoke-telo.json && echo "meja ovojnica OK (400 + { error })" || { echo "FAIL-CLOSED: ovojnica manjka"; exit 1; }

echo "--- meja ŽIVO val-3: quote pokvarjen JSON (prijavljen) → 400, nikoli 500 ---"
curl -s -b "$COOKIE" -H "x-csrf-token: $CSRF" -o /tmp/r338-smoke-quote.json -w "quote-pokvarjen=%{http_code}\n" --max-time 10 -X POST http://127.0.0.1:3100/api/quote -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3100" -d '{pokvarjen'
grep -qF 'Neveljavno telo zahteve' /tmp/r338-smoke-quote.json && echo "val-3 ovojnica OK (400 + { error } — ISTA EN VIR)" || { echo "FAIL-CLOSED: val-3 ovojnica manjka"; exit 1; }

echo "--- meja ŽIVO val-3 regresija: evidence pokvarjen JSON (prijavljen) → 400, nikoli 500 ---"
curl -s -b "$COOKIE" -H "x-csrf-token: $CSRF" -o /tmp/r338-smoke-evidence.json -w "evidence-pokvarjen=%{http_code}\n" --max-time 10 -X POST http://127.0.0.1:3100/api/evidence -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3100" -d '{pokvarjen'
grep -qF 'Neveljavno telo zahteve' /tmp/r338-smoke-evidence.json && echo "val-3 evidence ovojnica OK (400 + { error } — ISTA EN VIR)" || { echo "FAIL-CLOSED: val-3 evidence ovojnica manjka"; exit 1; }

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
echo "--- R338 SMOKE KONEC ---"
