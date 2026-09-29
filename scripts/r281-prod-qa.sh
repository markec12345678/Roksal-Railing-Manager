#!/bin/bash
# R281 — PRVA naloga (worklog R280): potrditi R280 na produ (R279 je ŽIVO
# dokazan r280-prod-qa; R280 build 2026-09-29T11:24:57.844Z — needleji morajo
# biti ŽIVO). Skozi:
#   Z0  build-guard: health build > R280 build (2026-09-29T11:24:57.844Z) —
#       starejši build = NI ŠE R281 → abort (needleji bi lažno FAILali).
#       Primerjava v EPOCH (deterministična — brez case-pattern krhlosti).
#   Z1  meritve tab ŽIVO (spot seja) — sync žig POGOJNO (spot portfel
#       podatkovna resnica; če sync metadata NI seedana, žig iskreno NE
#       obstaja — kanon r277 Z1 pogojni probe).
#   Z1b verzije ruta ŽIVO: GET /api/measurements/ne-obstojeci/verzije → 404
#       + 'Meritev ne obstaja' (R276+ regresa). ZERO-MUTACIJA.
#   Z2  čanki needleji: R281 §10 (matrika žig + sync stil ×4 + tombstone)
#       + R280/R279/R278/R277 regresije + must_miss.
#   Z3  v99 sync gate regresija (R274 gate še ŽIVO). ZERO-MUTACIJA.
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"

echo "=== Z0: prod build-guard — R281 deploy detekcija (EPOCH primerjava) ==="
BUILD=$(curl -s --max-time 15 "$PROD/api/public/health" | python3 -c "import json,sys; print(json.load(sys.stdin).get('build',''))" || true)
echo "PROD build: $BUILD"
python3 - "$BUILD" <<'PYEOF' || { echo "R281 NI ŠE DEPLOYAN (build ≤ R280 11:24:57.844Z) — needleji bi lažno FAILali"; exit 1; }
import sys
from datetime import datetime
build = sys.argv[1]
try:
    t = datetime.fromisoformat(build.replace('Z', '+00:00'))
except Exception:
    sys.exit(1)
meja = datetime.fromisoformat('2026-09-29T11:24:57.844+00:00')
sys.exit(0 if t > meja else 1)
PYEOF
echo "R281 deploy potrjen (build $BUILD > R280 11:24:57.844Z) — probe DOVOLJEN"

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z1: meritve tab ŽIVO — sync žig (POGOJNO — spot portfel podatkovna resnica) ==="
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
if eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Pokaži zgodovino verzij meritve\"]');})()" 16; then
  eb_cakaj 2
  agent-browser eval "(()=>{const syncPill=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.getAttribute('title')||'').startsWith('Sinhronizacijsko stanje:')); const vir=[...document.querySelectorAll('span')].some(x=>x.textContent.trim()==='Ročni vnos'||x.textContent.trim()==='Foto-CV'||x.textContent.trim()==='AR-Depth'); return JSON.stringify({syncPill:syncPill?(syncPill.getAttribute('title')||'').slice(0,45):null, vir, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r281-z1.json
  python3 -c "import json; r=json.load(open('/tmp/r281-z1.json')); d=json.loads(r) if isinstance(r,str) else r; t = 'R281 sync žig ŽIVO (' + d['syncPill'] + ' …)' if d['syncPill'] else 'R281 OPOMBA: sync žig NE prisoten — spot portfel brez sync metadata (iskrena praznina — pogojni probe po kanonu r277 Z1)'; print('Z1 OK — meritve UI ŽIVO · ' + t)" || exit 1
else
  echo "Z1 OPOMBA: meritve UI ni dosegljiva spot seji (MONTER skoping?) — UI probe preskočen, ruta probe Z1b ostaja obvezen"
fi

echo "=== Z1b: verzije ruta ŽIVO — 404 + R276 žična vrstica (ZERO-MUTACIJA GET) ==="
agent-browser eval "(()=>{window.__verz=null; window.__verzStatus=null; fetch('/api/measurements/r281-ne-obstojeci-id-probe/verzije',{credentials:'same-origin'}).then(r=>{window.__verzStatus=r.status; return r.json();}).then(d=>{window.__verz=d;}).catch(e=>{window.__verzErr=String(e)}); return 'poslano';})()" 2>&1 | tail -1
eb_cakaj 3
agent-browser eval "JSON.stringify({status:window.__verzStatus, body:window.__verz??null, napaka:window.__verzErr??null})" 2>&1 | tail -1 > /tmp/r281-z1b.json
python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r281-z1b.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['napaka'] is None, 'Z1b mrežna napaka: ' + json.dumps(d)
assert d['status'] == 404, 'Z1b: pričakovan 404, dobljeno ' + str(d['status']) + ': ' + json.dumps(d)
assert isinstance(d['body'], dict) and d['body'].get('error') == 'Meritev ne obstaja', 'Z1b R276 žična vrstica FAIL: ' + json.dumps(d)
print('Z1b OK — GET /api/measurements/[id]/verzije ŽIVO na produ: 404 + \'Meritev ne obstaja\' (R276+ ruta regresija)')
PYEOF

echo "=== Z2: čanki — klient needleji (R281 LIVE + regresije + must_miss) ==="
OUT=/tmp/r281-prod-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
for d in '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"documents","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}' '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}' '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}' '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"teren","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"ekipa","subTab":null,"osnutek":null,"filter":null}'; do
  eb_dispatch "$d"
  eb_cakaj 3
done
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 > /tmp/r281-chunkurls-raw.json
python3 -c "import json; raw=open('/tmp/r281-chunkurls-raw.json').read().strip(); arr=json.loads(raw); arr=json.loads(arr) if isinstance(arr,str) else arr; open('/tmp/r281-chunkurls.txt','w').write('\n'.join(arr)+'\n')" || { echo "PY PARSE FAIL — abort"; exit 1; }
cp /tmp/r281-chunkurls.txt "$OUT"/chunk-urls.txt
i=0
while read -r url; do
  [ -z "$url" ] && continue
  i=$((i+1))
  curl -s --max-time 20 "$url" -o "$OUT/chunk-$i.js" || echo "  (curl opozorilo: $url)"
done < "$OUT"/chunk-urls.txt
echo "  prenesenih: $(ls "$OUT"/chunk-*.js 2>/dev/null | wc -l)"
[ "$(ls "$OUT"/chunk-*.js 2>/dev/null | wc -l)" -gt 0 ] || { echo "NI ČANKOV — abort"; exit 1; }
FAIL=0
need() {
  if grep -rqF -- "$1" "$OUT" 2>/dev/null; then echo "OK   : $2"; else echo "MISS : $2  (needle: $1)"; FAIL=1; fi
}
must_miss() {
  if grep -rqF -- "$1" "$OUT" 2>/dev/null; then echo "HIT  : $2"; FAIL=1; else echo "OK   : $2 (izginil)"; fi
}
echo "--- R281 sync metadata (issue #16 §10 — LIVE, PRVA naloga R281) ---"
need "Sinhronizacijsko stanje: Sinhronizirano" "R281 sync žig title SYNCED — LIVE"
need "Sinhronizacijsko stanje: V čakalni vrsti" "R281 sync žig title PENDING — LIVE"
need "Sinhronizacijsko stanje: Konflikt" "R281 sync žig title CONFLICT — LIVE"
need "Sinhronizacijsko stanje: Napaka" "R281 sync žig title ERROR — LIVE"
need "tombstone — grobnico potrdi /api/sync" "R281 tombstone note — LIVE"
need "Sync metadata (opazovano stanje klienta" "R281 TooltipContent — LIVE"
echo "--- R281 kontrakt (server chunks — matrika runtime string) ---"
need "session-level sync blok opcijsko" "R281 matrika razširitev žig (V1 aditivna v1) — LIVE"
need "razmejitev provenance vs. protocol" "R281 V3 razmejitev žig — LIVE"
need "V1–V6" "R281 matrika V-serija — LIVE"
echo "--- R280 stil (LIVE — regresija) ---"
need "Vrsta meritve: Razdalja" "R280 tip badge title RAZDALJA — LIVE"
need "Vrsta meritve: Višina" "R280 tip badge title VISINA — LIVE"
need "Vrsta meritve: Stebriček/Palica" "R280 tip badge title STEBR — LIVE"
need " se ne označuje — označujem samo odstopanja" "R280 kot badge title — LIVE"
echo "--- R278 vir pill title (LIVE — regresija) ---"
need "Vir podatkov: Ročni vnos" "R278 vir pill title MANUAL — LIVE"
need "Vir podatkov: Foto-CV" "R278 vir pill title PHOTO_CV — LIVE"
need "Vir podatkov: AR-Depth" "R278 vir pill title ARCORE_DEPTH — LIVE"
echo "--- R279 segmentId Badge + R277 PDF (LIVE — regresija) ---"
need "stabilen segmentId" "R279 Badge title — LIVE"
need "\"Verzija\",\"Vir\"" "R277 PDF 10-stolpčna glava — LIVE"
need "nastalo pred verzioniranjem" "R277 legacy '—' iskren odpad — LIVE"
echo "--- R276 zgodovina verzij (LIVE — regresija) ---"
need "Zgodovina verzij — korekcije NE prepišejo" "R276 panel glava — LIVE"
need "Shrani kot novo verzijo" "R276 gumb — LIVE"
need "se NE izračunajo samodejno" "R276 O7 iskren sklep — LIVE"
echo "--- R274 a11y + R273/R272/R271/R269 (LIVE — regresija) ---"
need "Moja vloga in dovoljenja" "R240 meni + dialog — LIVE"
need "NAGIBI — TERENSKI PREGLED" "R272 PDF glava — LIVE"
need "ZAPISNIK — STANJE PRED PREDAJO" "R271 PDF glava — LIVE"
need "MERITVE — TERENSKI PREGLED" "R269 PDF glava — LIVE"
need "Brez dobavitelja (" "R227 žig aria — LIVE"
echo "--- must_miss (negativni) ---"
must_miss "TODO-R281" "R281 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R280" "R280 — brez razvojnih ostankov (izginil)"
[ "$FAIL" = 0 ] || { echo "NEEDLEJI FAIL — abort"; exit 1; }
echo "Z2 OK — vsi needleji ŽIVO"

echo "=== Z3: v99 sync gate regresija (R274 gate še ŽIVO — ZERO-MUTACIJA) ==="
agent-browser eval "(()=>{window.__v99=null; window.__v99err=null; fetch('/api/sync',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify([{id:'r281-prod-v99-probe-'+Date.now(),customerName:'r281 probe v99',contractVersion:99}])}).then(r=>r.json()).then(d=>{window.__v99=d;}).catch(e=>{window.__v99err=String(e)}); return 'poslano';})()" 2>&1 | tail -1
eb_cakaj 3
agent-browser eval "JSON.stringify({odgovor:window.__v99??null, napaka:window.__v99err??null})" 2>&1 | tail -1 > /tmp/r281-z3.json
python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r281-z3.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['napaka'] is None, 'Z3 mrežna napaka: ' + json.dumps(d)
o = d['odgovor']
assert isinstance(o, dict) and isinstance(o.get('results'), list) and len(o['results']) == 1, 'Z3 oblika: ' + json.dumps(o)
item = o['results'][0]
assert item.get('ok') is False and item.get('retryable') is False, 'Z3 gate FAIL: ' + json.dumps(item)
assert 'Nepodprta pogodbena verzija 99' in item.get('error', ''), 'Z3 žig FAIL: ' + json.dumps(item)
assert 'noben zapis ni bil uporabljen' in item.get('error', ''), 'Z3 nič-izgubljeno FAIL: ' + json.dumps(item)
print('Z3 OK — v99 sync gate ŽIVO (fail-closed, nič zapisov, ZERO-MUTACIJA)')
PYEOF

echo "=== R281 PROD QA — R280 ŽIVO POTRJEN ==="
