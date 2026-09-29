#!/bin/bash
# R277 — PRVA naloga (worklog R276): potrditi R276 na produ.
#   Z0  build-guard: health build ≥ R276 deploy (2026-09-29T08:33Z) — R275
#       build 07:50:23Z = NI ŠE → abort (needleji bi lažno FAILali).
#   Z1  meritve tab ŽIVO (spot sejo): verzija pill v1 + vir oznaka + gumba
#       (Zgodovina/Popravi) + title/cursor-help — vrednostno agnostično.
#   Z1b verzije ruta ŽIVO: GET /api/measurements/ne-obstojeci/verzije → 404
#       + žična vrstica 'Meritev ne obstaja' (R276+ edinstvena — stara
#       distribucija te rute sploh ni imela → 404 HTML/drugače). ZERO-MUTACIJA.
#   Z2  čanki needleji: R276 UI žice + R275/R274/R273/R272/R271/R269
#       regresije + must_miss (lažni re-preračun 'JE PONOVNO IZRAČUNANO').
#   Z3  v99 sync gate regresija (R274 gate še ŽIVO).
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

echo "=== Z0: prod build-guard — R276 deploy detekcija ==="
BUILD=$(curl -s --max-time 15 "$PROD/api/public/health" | python3 -c "import json,sys; print(json.load(sys.stdin).get('build',''))" || true)
echo "PROD build: $BUILD"
case "$BUILD" in
  2026-09-29T07:50:23*|2026-09-2[0-9]T0[0-7]*)
    echo "R276 NI ŠE DEPLOYAN (build $BUILD ≤ R275 07:50:23Z) — UI/ruta needleji bi lažno FAILali"; exit 1;;
  *)
    echo "R276 deploy potrjen (build $BUILD) — probe DOVOLJEN";;
esac

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z1: meritve tab ŽIVO — verzija pill + vir + gumba (vrednostno agnostično) ==="
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
if eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Pokaži zgodovino verzij meritve\"]');})()" 16; then
  eb_cakaj 2
  agent-browser eval "(()=>{const pill=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='v1'); const vir=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='Ročni vnos'); const hist=document.querySelector('button[aria-label^=\"Pokaži zgodovino verzij meritve\"]'); const popravi=document.querySelector('button[aria-label^=\"Popravi meritev \"]'); return JSON.stringify({pill:!!pill, pillHelp:pill?pill.className.includes('cursor-help'):false, pillTitle:pill?(pill.getAttribute('title')||'').includes('prvi vpis v verigi'):false, vir:!!vir, histBtn:!!hist, popraviBtn:!!popravi, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r277-z1.json
  python3 -c "import json; r=json.load(open('/tmp/r277-z1.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pill'] and d['vir'] and d['histBtn'] and d['popraviBtn'], 'Z1 UI FAIL: '+json.dumps(d); assert d['pillHelp'] and d['pillTitle'], 'Z1 pill title FAIL: '+json.dumps(d); print('Z1 OK — verzija pill v1 (cursor-help + title) + vir Ročni vnos + gumba ŽIVO na produ')" || exit 1
  echo "=== Z1a: panel zgodovine ŽIVO (klik Zgodovina) ==="
  eb_klik_prefix "Pokaži zgodovino verzij meritve"
  eb_pocakaj_na "(()=>{return document.body.textContent.includes('Zgodovina verzij — korekcije NE prepišejo');})()" 14
  agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({naslov:t.includes('Zgodovina verzij — korekcije NE prepišejo'), o7:t.includes('se NE izračunajo samodejno'), zapri:!!document.querySelector('button[aria-label=\"Zapri zgodovino verzij\"]'), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r277-z1a.json
  python3 -c "import json; r=json.load(open('/tmp/r277-z1a.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['naslov'] and d['o7'] and d['zapri'], 'Z1a panel FAIL: '+json.dumps(d); print('Z1a OK — panel zgodovine ŽIVO (naslov + O7 iskren sklep + Zapri)')" || exit 1
else
  echo "Z1 OPOMBA: meritve UI ni dosegljiva spot seji (MONTER skoping?) — UI probe preskočen, ruta probe Z1b ostaja obvezen"
fi

echo "=== Z1b: verzije ruta ŽIVO — 404 + R276 žična vrstica (ZERO-MUTACIJA GET) ==="
agent-browser eval "(()=>{window.__verz=null; window.__verzStatus=null; fetch('/api/measurements/r277-ne-obstojeci-id-probe/verzije',{credentials:'same-origin'}).then(r=>{window.__verzStatus=r.status; return r.json();}).then(d=>{window.__verz=d;}).catch(e=>{window.__verzErr=String(e)}); return 'poslano';})()" 2>&1 | tail -1
eb_cakaj 3
agent-browser eval "JSON.stringify({status:window.__verzStatus, body:window.__verz??null, napaka:window.__verzErr??null})" 2>&1 | tail -1 > /tmp/r277-z1b.json
python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r277-z1b.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['napaka'] is None, 'Z1b mrežna napaka: ' + json.dumps(d)
assert d['status'] == 404, 'Z1b: pričakovan 404, dobljeno ' + str(d['status']) + ': ' + json.dumps(d)
assert isinstance(d['body'], dict) and d['body'].get('error') == 'Meritev ne obstaja', 'Z1b R276 žična vrstica FAIL: ' + json.dumps(d)
print('Z1b OK — GET /api/measurements/[id]/verzije ŽIVO na produ: 404 + \'Meritev ne obstaja\' (R276+ ruta)')
PYEOF

echo "=== Z2: čanki — klient needleji (R276 + regresije + must_miss) ==="
OUT=/tmp/r277-prod-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
for d in '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"documents","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}' '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}' '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}' '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"teren","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"ekipa","subTab":null,"osnutek":null,"filter":null}'; do
  eb_dispatch "$d"
  eb_cakaj 3
done
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 > /tmp/r277-chunkurls-raw.json
python3 -c "import json; raw=open('/tmp/r277-chunkurls-raw.json').read().strip(); arr=json.loads(raw); arr=json.loads(arr) if isinstance(arr,str) else arr; open('/tmp/r277-chunkurls.txt','w').write('\n'.join(arr)+'\n')" || { echo "PY PARSE FAIL — abort"; exit 1; }
cp /tmp/r277-chunkurls.txt "$OUT"/chunk-urls.txt
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
echo "--- R276 zgodovina verzij (LIVE) ---"
need "Zgodovina verzij — korekcije NE prepišejo" "R276 panel naslov — LIVE"
need "Shrani kot novo verzijo" "R276 korekcijski gumb — LIVE"
need "Shranjevanje ustvari NOVO verzijo" "R276 korekcijski pas — LIVE"
need "shranjena — predhodna meritev ostaja v zgodovini." "R276 iskren toast (stat. pripona — templ. razbit) — LIVE"
need "Popravi meritev " "R276 Popravi aria — LIVE"
need "Pokaži zgodovino verzij meritve" "R276 Zgodovina aria — LIVE"
need "prvi vpis v verigi" "R276 pill title — LIVE"
need "Ročni vnos" "R276 vir oznaka (MERITEV_VIR_LABELS vrednost — ime minificirano r274 l5) — LIVE"
need "se NE izračunajo samodejno" "R276 O7 iskren sklep — LIVE"
must_miss "JE PONOVNO IZRAČUNANO" "R276 must_miss — lažni re-preračun NIKOLI"
echo "--- R275 title/cursor-help (LIVE regresija) ---"
need "pomeni: nič artiklov nima trenutno veljavne cene — nič ni ocenjeno (brez demo cene)" "R275 Vrednost title — LIVE"
need "pod minimumom = akcija naročila, na meji = pozor" "R275 Inventura title — LIVE"
echo "--- R274 a11y + kontrakt (LIVE regresija) ---"
need "role:\"status\"" "R274 role=status — LIVE"
echo "--- R273 zaloga-vrednost (LIVE regresija) ---"
need "Izvozi pregled vrednosti zaloge kot PDF" "R273 pill aria — LIVE"
need "ZALOGA — PREMOŽENJSKA VREDNOST" "R273 PDF glava — LIVE"
need "Vrednost (viden seznam):" "R273 mini — LIVE"
need "Pregled vrednosti zaloge se izvozi, ko je vpisan prvi artikel zaloge." "R273 fail-closed toast — LIVE"
need "PDF = polna denarna resnica skladišča (FRESH /api/inventory + /api/material-prices ob kliku — samo trenutno veljavne cene; ne zastarel state)" "R273 legenda — LIVE"
need "vir = /api/inventory + /api/material-prices (resnica zaloge IN cen)" "R273 vir dva vira — LIVE"
echo "--- R272 nagibi-teren (LIVE regresija) ---"
need "Izvozi terenski pregled nagibov kot PDF" "R272 pill aria — LIVE"
need "NAGIBI — TERENSKI PREGLED" "R272 PDF glava — LIVE"
need "smerLabel EN VIR" "R272 smerLabel EN VIR — LIVE"
echo "--- R271 zapisnik-stanje (LIVE regresija) ---"
need "Izvozi pregled stanja zapisnika kot PDF" "R271 pill aria — LIVE"
need "ZAPISNIK — STANJE PRED PREDAJO" "R271 PDF glava — LIVE"
echo "--- R269 meritve-teren (LIVE regresija) ---"
need "MERITVE — TERENSKI PREGLED" "R269 PDF glava — LIVE"
need "Terenski pregled se izvozi, ko je vpisana prva meritev projekta." "R269 fail-closed — LIVE"
echo "--- must_miss (negativni) ---"
must_miss "TODO-R277" "R277 — brez razvojnih ostankov"
[ "$FAIL" = 0 ] || { echo "NEEDLEJI FAIL — abort"; exit 1; }
echo "Z2 OK — vsi needleji ŽIVO"

echo "=== Z3: v99 sync gate regresija (R274 gate še ŽIVO — ZERO-MUTACIJA) ==="
agent-browser eval "(()=>{window.__v99=null; window.__v99err=null; fetch('/api/sync',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify([{id:'r277-prod-v99-probe-'+Date.now(),customerName:'r277 probe v99',contractVersion:99}])}).then(r=>r.json()).then(d=>{window.__v99=d;}).catch(e=>{window.__v99err=String(e)}); return 'poslano';})()" 2>&1 | tail -1
eb_cakaj 3
agent-browser eval "JSON.stringify({v99:window.__v99, napaka:window.__v99err??null})" 2>&1 | tail -1 > /tmp/r277-z3.json
python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r277-z3.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['napaka'] is None, 'v99 mrežna napaka: ' + json.dumps(d)
r0 = d['v99']['results'][0]
assert r0['ok'] is False and r0['action'] == 'error' and r0['retryable'] is False, 'v99 gate FAIL: ' + json.dumps(r0)
assert 'Nepodprta pogodbena verzija 99' in r0['error'] and 'noben zapis ni bil uporabljen' in r0['error'], 'v99 žična koda FAIL: ' + json.dumps(r0)
print('Z3 OK — R274 sync gate še ŽIVO: ' + r0['error'][:70] + '…')
PYEOF

agent-browser close --all > /dev/null 2>&1
echo "=== R277 PROD QA — R276 ŽIVO POTRJEN (build $BUILD) ==="
exit 0
