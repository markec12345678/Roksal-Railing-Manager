#!/bin/bash
# R280 — PRVA naloga (worklog R279): potrditi R279 na produ.
#   Z0  build-guard: health build > R278 build (2026-09-29T10:19:49Z) — R278
#       build = NI ŠE R279 → abort (needleji bi lažno FAILali).
#   Z1  meritve tab ŽIVO (spot seja) — pogojno (R277: MONTER skoping resnica;
#       če spot portfel/seja ne dovoli, UI probe preskočen, ruta probe ostaja).
#   Z1b verzije ruta ŽIVO: GET /api/measurements/ne-obstojeci/verzije → 404
#       + žična vrstica 'Meritev ne obstaja' (R276+ regresa). ZERO-MUTACIJA.
#   Z2  čanki needleji: R277 teren PDF verzija+vir (client wire ×6) + R276
#       regresije + R275/R274/R273/R272/R271/R269 + must_miss.
#   Z3  v99 sync gate regresija (R274 gate še ŽIVO). ZERO-MUTACIJA.
# AWK strukturna preverba (needleji v loopu / pred definicijo = 0/0).
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"

STRUCT=$(awk '
  /^need\(\)/      { infn=1; needdef=1; next }
  /^must_miss\(\)/ { infn=1; next }
  infn && /^\}/    { infn=0; next }
  infn             { next }
  infn==0 && /^while read/  { loop=1; next }
  infn==0 && loop==1 && /^done </ { loop=0; next }
  infn==0 && loop==1 && (/^need / || /^must_miss /) { c1++; next }
  infn==0 && !needdef && (/^need / || /^must_miss /) { c2++; next }
  END { print (c1+0) "/" (c2+0) }
' "$0")
echo "=== Z-STRUCT: needleji v loopu / pred definicijo = $STRUCT (mora biti 0/0) ==="
[ "$STRUCT" = "0/0" ] || { echo "STRUKTURNA NAPAKA — abort"; exit 1; }

echo "=== Z0: prod build-guard — R277 deploy detekcija ==="
BUILD=$(curl -s --max-time 15 "$PROD/api/public/health" | python3 -c "import json,sys; print(json.load(sys.stdin).get('build',''))" || true)
echo "PROD build: $BUILD"
case "$BUILD" in
  2026-09-29T10:19:49*|2026-09-29T10:[01]*|2026-09-29T09*|2026-09-2[0-8]T*)
    echo "R279 NI ŠE DEPLOYAN (build $BUILD ≤ R278 10:19:49Z) — needleji bi lažno FAILali"; exit 1;;
  *)
    echo "R279 deploy potrjen (build $BUILD > R278 10:19:49Z) — probe DOVOLJEN";;
esac

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z1: meritve tab ŽIVO — verzija pill + vir + gumba (pogojno — spot skoping resnica R277/R278) ==="
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
if eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Pokaži zgodovino verzij meritve\"]');})()" 16; then
  eb_cakaj 2
  agent-browser eval "(()=>{const pill=[...document.querySelectorAll('span')].find(x=>/^v\\d+$/.test(x.textContent.trim())); const hist=document.querySelector('button[aria-label^=\"Pokaži zgodovino verzij meritve\"]'); const popravi=document.querySelector('button[aria-label^=\"Popravi meritev \"]'); const tipBadge=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.getAttribute('title')||'').startsWith('Vrsta meritve:')); return JSON.stringify({pill:!!pill, histBtn:!!hist, popraviBtn:!!popravi, tipBadge:tipBadge?(tipBadge.getAttribute('title')||'').slice(0,40):null, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r280-z1.json
  python3 -c "import json; r=json.load(open('/tmp/r280-z1.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pill'] and d['histBtn'] and d['popraviBtn'], 'Z1 UI FAIL: '+json.dumps(d); tip = 'R280 tip badge stil ŽIVO (' + d['tipBadge'] + ' …)' if d['tipBadge'] else 'R280 OPOMBA: tip badge NE prisoten — spot portfel podatkovna resnica (pogojni probe po kanonu r277 Z1)'; print('Z1 OK — verzija pill + gumba ŽIVO na produ · ' + tip)" || exit 1
else
  echo "Z1 OPOMBA: meritve UI ni dosegljiva spot seji (MONTER skoping?) — UI probe preskočen, ruta probe Z1b ostaja obvezen"
fi

echo "=== Z1b: verzije ruta ŽIVO — 404 + R276 žična vrstica (ZERO-MUTACIJA GET) ==="
agent-browser eval "(()=>{window.__verz=null; window.__verzStatus=null; fetch('/api/measurements/r278-ne-obstojeci-id-probe/verzije',{credentials:'same-origin'}).then(r=>{window.__verzStatus=r.status; return r.json();}).then(d=>{window.__verz=d;}).catch(e=>{window.__verzErr=String(e)}); return 'poslano';})()" 2>&1 | tail -1
eb_cakaj 3
agent-browser eval "JSON.stringify({status:window.__verzStatus, body:window.__verz??null, napaka:window.__verzErr??null})" 2>&1 | tail -1 > /tmp/r280-z1b.json
python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r280-z1b.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['napaka'] is None, 'Z1b mrežna napaka: ' + json.dumps(d)
assert d['status'] == 404, 'Z1b: pričakovan 404, dobljeno ' + str(d['status']) + ': ' + json.dumps(d)
assert isinstance(d['body'], dict) and d['body'].get('error') == 'Meritev ne obstaja', 'Z1b R276 žična vrstica FAIL: ' + json.dumps(d)
print('Z1b OK — GET /api/measurements/[id]/verzije ŽIVO na produ: 404 + \'Meritev ne obstaja\' (R276+ ruta regresija)')
PYEOF

echo "=== Z2: čanki — klient needleji (R277 LIVE + regresije + must_miss) ==="
OUT=/tmp/r280-prod-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
for d in '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"documents","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}' '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}' '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}' '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"teren","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"ekipa","subTab":null,"osnutek":null,"filter":null}'; do
  eb_dispatch "$d"
  eb_cakaj 3
done
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 > /tmp/r280-chunkurls-raw.json
python3 -c "import json; raw=open('/tmp/r280-chunkurls-raw.json').read().strip(); arr=json.loads(raw); arr=json.loads(arr) if isinstance(arr,str) else arr; open('/tmp/r280-chunkurls.txt','w').write('\n'.join(arr)+'\n')" || { echo "PY PARSE FAIL — abort"; exit 1; }
cp /tmp/r280-chunkurls.txt "$OUT"/chunk-urls.txt
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
echo "--- R280 stil (LIVE — PRVA naloga R280) ---"
need "Vrsta meritve: Razdalja" "R280 tip badge title RAZDALJA — LIVE"
need "Vrsta meritve: Višina" "R280 tip badge title VISINA — LIVE"
need "Vrsta meritve: Stebriček/Palica" "R280 tip badge title STEBR — LIVE"
need " se ne označuje — označujem samo odstopanja" "R280 kot badge title — LIVE"
echo "--- R278 stil + kontrakt (LIVE — regresija) ---"
need "Vir podatkov: Ročni vnos" "R278 vir pill title MANUAL — LIVE"
need "Vir podatkov: Foto-CV" "R278 vir pill title PHOTO_CV — LIVE"
need "Vir podatkov: AR-Depth" "R278 vir pill title ARCORE_DEPTH — LIVE"
echo "--- R277 teren PDF verzija+vir (LIVE — regresija) ---"
need "\"Verzija\",\"Vir\"" "R277 PDF 10-stolpčna glava (minified WYSIWYG) — LIVE"
need "verzija = veriga korekcij" "R277 sklep veriga poimenovana — LIVE"
need "nastalo pred verzioniranjem" "R277 legacy '—' iskren odpad — LIVE"
need "Ročni vnos/Foto-CV/AR-Depth" "R277 vir poimenovane oznake — LIVE"
need "vir mora biti eden izmed " "R277 fail-closed neznani vir — LIVE"
need "verzija mora biti pozitivno celo število ALI null" "R277 fail-closed pokvarjena verzija — LIVE"
echo "--- R276 zgodovina verzij (LIVE regresija) ---"
need "Zgodovina verzij — korekcije NE prepišejo" "R276 panel naslov — LIVE"
need "Shrani kot novo verzijo" "R276 korekcijski gumb — LIVE"
need "Shranjevanje ustvari NOVO verzijo" "R276 korekcijski pas — LIVE"
need "Popravi meritev " "R276 Popravi aria — LIVE"
need "Pokaži zgodovino verzij meritve" "R276 Zgodovina aria — LIVE"
need "prvi vpis v verigi" "R276 pill title — LIVE"
need "se NE izračunajo samodejno" "R276 O7 iskren sklep — LIVE"
need "Ročni vnos" "R276 vir oznaka — LIVE"
echo "--- R275 title/cursor-help (LIVE regresija) ---"
need "pomeni: nič artiklov nima trenutno veljavne cene — nič ni ocenjeno (brez demo cene)" "R275 Vrednost title — LIVE"
need "pod minimumom = akcija naročila, na meji = pozor" "R275 Inventura title — LIVE"
echo "--- R274 a11y (LIVE regresija) ---"
need "role:\"status\"" "R274 role=status — LIVE"
echo "--- R273 zaloga-vrednost (LIVE regresija) ---"
need "Izvozi pregled vrednosti zaloge kot PDF" "R273 pill aria — LIVE"
need "ZALOGA — PREMOŽENJSKA VREDNOST" "R273 PDF glava — LIVE"
need "Vrednost (viden seznam):" "R273 mini — LIVE"
echo "--- R272 nagibi-teren (LIVE regresija) ---"
need "Izvozi terenski pregled nagibov kot PDF" "R272 pill aria — LIVE"
need "NAGIBI — TERENSKI PREGLED" "R272 PDF glava — LIVE"
echo "--- R271 zapisnik-stanje (LIVE regresija) ---"
need "Izvozi pregled stanja zapisnika kot PDF" "R271 pill aria — LIVE"
need "ZAPISNIK — STANJE PRED PREDAJO" "R271 PDF glava — LIVE"
echo "--- R269 meritve-teren (LIVE regresija) ---"
need "MERITVE — TERENSKI PREGLED" "R269 PDF glava — LIVE"
need "Terenski pregled se izvozi, ko je vpisana prva meritev projekta." "R269 fail-closed — LIVE"
echo "--- must_miss (negativni) ---"
must_miss "JE PONOVNO IZRAČUNANO" "must_miss — lažni re-preračun NIKOLI"
must_miss "TODO-R279" "R279 — brez razvojnih ostankov"
[ "$FAIL" = 0 ] || { echo "NEEDLEJI FAIL — abort"; exit 1; }
echo "Z2 OK — vsi needleji ŽIVO"

echo "=== Z3: v99 sync gate regresija (R274 gate še ŽIVO — ZERO-MUTACIJA) ==="
agent-browser eval "(()=>{window.__v99=null; window.__v99err=null; fetch('/api/sync',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify([{id:'r280-prod-v99-probe-'+Date.now(),customerName:'r280 probe v99',contractVersion:99}])}).then(r=>r.json()).then(d=>{window.__v99=d;}).catch(e=>{window.__v99err=String(e)}); return 'poslano';})()" 2>&1 | tail -1
eb_cakaj 3
agent-browser eval "JSON.stringify({odgovor:window.__v99??null, napaka:window.__v99err??null})" 2>&1 | tail -1 > /tmp/r280-z3.json
python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r280-z3.json').read().strip()
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

echo "=== R280 PROD QA — R279 ŽIVO POTRJEN ==="
agent-browser close --all > /dev/null 2>&1
exit 0
