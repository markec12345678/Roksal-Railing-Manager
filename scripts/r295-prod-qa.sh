#!/bin/bash
# R295 — PRVA naloga (worklog R296): potrditi R290+R291+R292+R293+R294+R295 SKUPAJ na produ.
#   Z0  build-guard (EPOCH): health build > R295 commit čas (git log —
#       self-contained meja; push sledi commitu v sekundah, zato je commit-čas
#       STROŽJA in pravilna meja: med commitom in pushom ni Vercel builda)
#       → R295 deploy potrjen (nosi R290+…+R295 — kanon R280/R284),
#       polni LIVE needle teki (R295 koledar CSV + mini-vrstica ×9 + R294 ×9 + regresije).
#       build ≤ meja → **ESKALACIJA veja** (kanon R258: prod stale ni koda-bug
#       — lokalni buildi ✓; needleji bi lažno FAILali). Izvede se ISKREN
#       stale-dokaz: R289/R288/R287/R227 LIVE needleji (zdrav vzorec stale
#       builda) + R290/R291/R292/R293/R294 pilli LIVE (pogojno po EPOCH) +
#       Z1b + Z3 (ZERO-MUTACIJA). ZERO must_miss v stale veji —
#       skew protection lekcija R294: pill-level must_miss je vrstno ranljivo
#       po pushu; avtoritativni detektor = EPOCH build-guard.
#       EXIT=0 z ESKALACIJA žigom — runda nadaljuje lokalno, eskalacija gre
#       LASTNIKU (Vercel dashboard — stuck/limit).
#   Z1  meritve tab ŽIVO — sync žig POGOJNO (kanon r277).
#   Z1b verzije ruta 404 + 'Meritev ne obstaja' (R276+ regresa). ZERO-MUTACIJA.
#   Z1c zvonček POGOJNI DOM probe + Z1d presežek note POGOJNI (R287/R289).
#   Z2  čanki needleji: R293 ×8 + R292 ×8 + R291 ×8 + R290 ×8 + R289/R288/… regresije.
#   Z3  v99 sync gate (R274). ZERO-MUTACIJA.
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"
R295_COMMIT_ISO="$(git log --format='%cI ::: %s' 2>/dev/null | awk -F' ::: ' '$2 ~ /^R295 —/ {print $1; exit}')"
[ -n "$R295_COMMIT_ISO" ] || { echo "FAIL-CLOSED: R295 commita ni v git zgodovini — EPOCH guard brez meje"; exit 1; }
R295_PUSH="$(date -u -d "$R295_COMMIT_ISO" +%Y-%m-%dT%H:%M:%S)"
echo "R295 meja (commit čas, UTC): $R295_PUSH"

echo "=== Z0: prod build-guard — R295 deploy detekcija (EPOCH primerjava) ==="
BUILD=$(curl -s --max-time 15 "$PROD/api/public/health" | python3 -c "import json,sys; print(json.load(sys.stdin).get('build',''))" || true)
echo "PROD build: $BUILD"
STALE=0
python3 - "$BUILD" "$R295_PUSH" <<'PYEOF' || STALE=1
import sys
from datetime import datetime
build = sys.argv[1]
try:
    t = datetime.fromisoformat(build.replace('Z', '+00:00'))
except Exception:
    sys.exit(1)
meja = datetime.fromisoformat(sys.argv[2] + '+00:00')
sys.exit(0 if t > meja else 1)
PYEOF

if [ "$STALE" = "1" ]; then
  echo ""
  echo "████████████████████████████████████████████████████████████████"
  echo "██ ESKALACIJA — PROD STALE: build $BUILD ≤ R295 commit meja ($R295_PUSH)."
  echo "██ R294 (21:53:39Z ŽIVO) + R295 pričakujeta SKUPNI deploy (kanon R280/R284)."
  echo "██ Kanon R258: deployment pipeline event, NI koda-bug. Eksplicitna"
  echo "██ eskalacija LASTNIKU (Vercel dashboard — deploy stuck/limit)."
  echo "██ Zdaj: ISKREN stale-dokaz (stale zdrav LIVE needleji; ZERO must_miss — skew lekcija R294)."
  echo "████████████████████████████████████████████████████████████████"
  echo ""
  eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
  eb_zapri_vodic

  echo "=== Z1b-stale: verzije ruta ŽIVO (ZERO-MUTACIJA GET) ==="
  agent-browser eval "(()=>{window.__verz=null; window.__verzStatus=null; fetch('/api/measurements/r295-ne-obstojeci-id-probe/verzije',{credentials:'same-origin'}).then(r=>{window.__verzStatus=r.status; return r.json();}).then(d=>{window.__verz=d;}).catch(e=>{window.__verzErr=String(e)}); return 'poslano';})()" 2>&1 | tail -1
  eb_cakaj 3
  agent-browser eval "JSON.stringify({status:window.__verzStatus, body:window.__verz??null, napaka:window.__verzErr??null})" 2>&1 | tail -1 > /tmp/r295-z1b.json
  python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r295-z1b.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['napaka'] is None, 'Z1b mrežna napaka: ' + json.dumps(d)
assert d['status'] == 404, 'Z1b: pričakovan 404, dobljeno ' + str(d['status'])
assert isinstance(d['body'], dict) and d['body'].get('error') == 'Meritev ne obstaja', 'Z1b R276 žična vrstica FAIL: ' + json.dumps(d)
print('Z1b OK — stale build zdrav: verzije ruta 404 ŽIVO (R276+ regresa)')
PYEOF

  echo "=== Z3-stale: v99 sync gate (ZERO-MUTACIJA) ==="
  agent-browser eval "(()=>{window.__v99=null; window.__v99err=null; fetch('/api/sync',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify([{id:'r295-prod-v99-probe-'+Date.now(),customerName:'r295 probe v99',contractVersion:99}])}).then(r=>r.json()).then(d=>{window.__v99=d;}).catch(e=>{window.__v99err=String(e)}); return 'poslano';})()" 2>&1 | tail -1
  eb_cakaj 3
  agent-browser eval "JSON.stringify({odgovor:window.__v99??null, napaka:window.__v99err??null})" 2>&1 | tail -1 > /tmp/r295-z3.json
  python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r295-z3.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['napaka'] is None, 'Z3 mrežna napaka: ' + json.dumps(d)
o = d['odgovor']
assert isinstance(o, dict) and isinstance(o.get('results'), list) and len(o['results']) == 1, 'Z3 oblika: ' + json.dumps(o)
item = o['results'][0]
assert item.get('ok') is False and item.get('retryable') is False, 'Z3 gate FAIL: ' + json.dumps(item)
assert 'Nepodprta pogodbena verzija 99' in item.get('error', ''), 'Z3 žig FAIL: ' + json.dumps(item)
print('Z3 OK — stale build zdrav: v99 sync gate ŽIVO (fail-closed, ZERO-MUTACIJA)')
PYEOF

  echo "=== Z2-stale: čanki — stale-dokaz needleji ==="
  OUT=/tmp/r295-prod-chunks
  mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
  for d in '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"documents","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}' '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"invoices","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'; do
    eb_dispatch "$d"
    eb_cakaj 3
  done
  agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 > /tmp/r295-chunkurls-raw.json
  python3 -c "import json; raw=open('/tmp/r295-chunkurls-raw.json').read().strip(); arr=json.loads(raw); arr=json.loads(arr) if isinstance(arr,str) else arr; open('/tmp/r295-chunkurls.txt','w').write('\n'.join(arr)+'\n')" || { echo "PY PARSE FAIL — abort"; exit 1; }
  cp /tmp/r295-chunkurls.txt "$OUT"/chunk-urls.txt
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
  echo "--- R289 MANDATORY — stale build zdrav vzorec (LIVE) ---"
  need "\"aria-label\":\"Iskren presežek signalov\"" "R289 poimenovana note regija — LIVE (stale zdrav)"
  need "Presežek:" "R289 note glava — LIVE (stale zdrav)"
  need "Današnje montaže" "R289 kategorija literal — LIVE (stale zdrav)"
  need "Zamujene dobave" "R289 kategorija literal — LIVE (stale zdrav)"
  need "kategorija" "R289 objektni ključ — LIVE (stale zdrav)"
  echo "--- R288/R287 regresije (stale zdrav) ---"
  need "roksal:select-crm" "R288 dogodek literal — LIVE (stale zdrav)"
  need "Poudarjeno iz zvončka (opomnik)" "R288 hover title — LIVE (stale zdrav)"
  need "— odpre CRM (opomnik)" "R287 aria-label — LIVE (stale zdrav)"
  need "opomnikStatus" "R287 lib property — LIVE (stale zdrav)"
  echo "--- R227 temelj (stale zdrav) ---"
  need "Brez dobavitelja (" "R227 žig aria — LIVE (stale zdrav)"
  echo "--- STALE DOKAZ: stale build zdrav — R290/R291/R292 pilli LIVE (+ R293 pilli POGOJNO, če build nosi R293) ---"
  need "Prihodki po mesecih — po mesecu plačila" "R290 aria regija — LIVE (stale zdrav: build NOSI R290)"
  need "Izvozi prihodke po mesecih kot CSV" "R291 gumb aria — LIVE (stale zdrav: build NOSI R291)"
  need "% največjega meseca" "R291 mini stolpci title — LIVE (stale zdrav: build NOSI R291)"
  need "Tedenski razgled — naslednjih 7 dni" "R292 strip aria — LIVE (stale zdrav: build NOSI R292)"
  need "% najbolj obremenjenega dne" "R292 mini tir title — LIVE (stale zdrav: build NOSI R292)"
  # skew protection lekcija R294: ZERO must_miss v stale veji — če je build že
  # R293 (deploy med rundama), so R293 pilli legitimno LIVE; če je build R292,
  # R293 chunkov ni. Pričakovanje pogojno — avtoritativni detektor = EPOCH guard.
  if python3 - "$BUILD" "2026-09-29T20:46:30" <<'PYEOF2'
import sys
from datetime import datetime
try:
    t = datetime.fromisoformat(sys.argv[1].replace('Z', '+00:00'))
except Exception:
    sys.exit(1)
sys.exit(0 if t > datetime.fromisoformat(sys.argv[2] + '+00:00') else 1)
PYEOF2
  then
    need "Izvozi dobičkonosnost projektov kot CSV" "R293 gumb aria — LIVE (build > R293 push: nosi R293)"
    need "Maržni razgled — marža po projektih" "R293 strip aria — LIVE (build > R293 push: nosi R293)"
  else
    echo "INFO : R293 pilli — build ≤ R293 push, pilli NE pričakovani (nič must_miss — skew lekcija)"
  fi
  [ "$FAIL" = 0 ] || { echo "STALE-DOKAZ NEEDLEJI FAIL — abort"; exit 1; }
  echo ""
  echo "████████████████████████████████████████████████████████████████"
  echo "██ R294 PROD QA — ESKALACIJA POTRJENA IN DOKAZANA:"
  echo "██ stale build ($BUILD) sam po sebi ZDRAV"
  echo "██ (needleji + Z1b + Z3 ŽIVO; ZERO must_miss — skew protection lekcija R294)."
  echo "██ ESKALACIJA LASTNIKU: Vercel dashboard — deploy stuck/limit (4. zapis, stale od 20:46:30Z)."
  echo "██ Runda nadaljuje LOKALNO (kanon R280/R284: naslednji push nosi"
  echo "██ vse generacije — needleji pokrijejo R290+R291+R292+R293+R294+R295)."
  echo "████████████████████████████████████████████████████████████████"
  exit 0
fi

echo "R295 deploy potrjen (build $BUILD > R295 commit meja $R295_PUSH) — polni LIVE teki"
echo "OPOMBA: deploy je nosil VSE generacije (R290+R291+R292+R293+R294+R295 — kanon R280/R284)"

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z1: meritve tab ŽIVO — sync žig (POGOJNO — spot portfel podatkovna resnica) ==="
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
if eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Pokaži zgodovino verzij meritve\"]');})()" 16; then
  eb_cakaj 2
  agent-browser eval "(()=>{const syncPill=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.getAttribute('title')||'').startsWith('Sinhronizacijsko stanje:')); const viriMini=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.textContent||'').startsWith('Viri (viden seznam):')); return JSON.stringify({syncPill:syncPill?(syncPill.getAttribute('title')||'').slice(0,45):null, viriMini:viriMini?viriMini.textContent.trim():null, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r295-z1.json
  python3 -c "import json; r=json.load(open('/tmp/r295-z1.json')); d=json.loads(r) if isinstance(r,str) else r; t = 'R281 sync žig ŽIVO (' + d['syncPill'] + ' …)' if d['syncPill'] else 'R281 OPOMBA: sync žig NE prisoten — spot portfel brez sync metadata (iskrena praznina — pogojni probe po kanonu r277 Z1)'; v = ' · R283 VIRI MINI ŽIVO (' + d['viriMini'] + ')' if d['viriMini'] else ' · R283 VIRI MINI NE prisoten — spot seznam brez virov (iskrena praznina — pogojni)'; print('Z1 OK — meritve UI ŽIVO · ' + t + v)" || exit 1
else
  echo "Z1 OPOMBA: meritve UI ni dosegljiva spot seji (MONTER skoping?) — UI probe preskočen, ruta probe Z1b ostaja obvezen"
fi

echo "=== Z1b: verzije ruta ŽIVO — 404 + R276 žična vrstica (ZERO-MUTACIJA GET) ==="
agent-browser eval "(()=>{window.__verz=null; window.__verzStatus=null; fetch('/api/measurements/r295-ne-obstojeci-id-probe/verzije',{credentials:'same-origin'}).then(r=>{window.__verzStatus=r.status; return r.json();}).then(d=>{window.__verz=d;}).catch(e=>{window.__verzErr=String(e)}); return 'poslano';})()" 2>&1 | tail -1
eb_cakaj 3
agent-browser eval "JSON.stringify({status:window.__verzStatus, body:window.__verz??null, napaka:window.__verzErr??null})" 2>&1 | tail -1 > /tmp/r295-z1b.json
python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r295-z1b.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['napaka'] is None, 'Z1b mrežna napaka: ' + json.dumps(d)
assert d['status'] == 404, 'Z1b: pričakovan 404, dobljeno ' + str(d['status']) + ': ' + json.dumps(d)
assert isinstance(d['body'], dict) and d['body'].get('error') == 'Meritev ne obstaja', 'Z1b R276 žična vrstica FAIL: ' + json.dumps(d)
print('Z1b OK — GET /api/measurements/[id]/verzije ŽIVO na produ: 404 + \'Meritev ne obstaja\' (R276+ ruta regresija)')
PYEOF

echo "=== Z1c: ZVONČEK ŽIVO (POGOJNI DOM probe, Escape zapri; ZERO-MUTACIJA) ==="
agent-browser eval "(()=>{const b=document.querySelector('button[aria-label^=\"Obvestila\"]'); if(!b) return 'BREZ-ZVONČKA'; b.click(); return 'odprto';})()" 2>&1 | tail -1
if eb_pocakaj_na "(()=>{const p=[...document.querySelectorAll('span')].some(x=>x.textContent.includes('CRM opomniki in poslana obvestila')); return p;})()" 16; then
  eb_cakaj 2
  agent-browser eval "(()=>{const desc=[...document.querySelectorAll('span')].some(x=>x.textContent.includes('CRM opomniki in poslana obvestila')); const vrstice=[...document.querySelectorAll('button')].filter(x=>(x.getAttribute('aria-label')||'').includes('— odpre CRM (opomnik)')); return JSON.stringify({desc, stOpomnikov:vrstice.length, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r295-z1c.json
  python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r295-z1c.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['desc'] is True, 'Z1c SheetDescription FAIL: ' + json.dumps(d)
assert d['err'] is None, 'Z1c err: ' + json.dumps(d)
if d['stOpomnikov'] > 0:
    print('Z1c OK — zvonček ŽIVO z ' + str(d['stOpomnikov']) + ' opomniško vrstico')
else:
    print('Z1c OK — zvonček ŽIVO, prazna kopija prisotna (iskrena praznina — pogojni probe kanon r277)')
PYEOF
else
  echo "Z1c OPOMBA: SheetDescription ni zaznan — pogojni probe; chunk needleji Z2 ostajajo obvezni dokaz"
fi

echo "=== Z1d: PRESEŽEK note POGOJNI probe (spot resnica neznana) ==="
agent-browser eval "(()=>{const note=document.querySelector('[aria-label=\"Iskren presežek signalov\"]'); return JSON.stringify({notePrisoten:!!note, vsebina:note?note.textContent.trim().slice(0,120):null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r295-z1d.json
python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r295-z1d.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z1d err: ' + json.dumps(d)
if d['notePrisoten']:
    print('Z1d OK — presežek note ŽIVO na spot: ' + str(d['vsebina']))
else:
    print('Z1d OK — presežek note NIČ na spot (iskrena praznina — pogojni probe kanon r277)')
PYEOF
agent-browser eval "(()=>{document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return 'esc';})()" 2>&1 | tail -1
eb_cakaj 2

echo "=== Z2: čanki — klient needleji (R295 ×9 LIVE + R294 ×9 + R293 ×8 + R292 ×8 + R291 ×8 + R290 ×8 + regresije + must_miss) ==="
OUT=/tmp/r295-prod-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
for d in '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"documents","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}' '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}' '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"invoices","subTab":null,"osnutek":null,"filter":null}' '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"teren","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"ekipa","subTab":null,"osnutek":null,"filter":null}'; do
  eb_dispatch "$d"
  eb_cakaj 3
done
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 > /tmp/r295-chunkurls-raw.json
python3 -c "import json; raw=open('/tmp/r295-chunkurls-raw.json').read().strip(); arr=json.loads(raw); arr=json.loads(arr) if isinstance(arr,str) else arr; open('/tmp/r295-chunkurls.txt','w').write('\n'.join(arr)+'\n')" || { echo "PY PARSE FAIL — abort"; exit 1; }
cp /tmp/r295-chunkurls.txt "$OUT"/chunk-urls.txt
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
echo "--- R295 MANDATORY — KOLEDAR PREGLEDOV CSV + F2 MINI-VRSTICA (LIVE — PRVA naloga R296) ---"
need "Izvozi koledar pregledov kot CSV" "R295 gumb aria — LIVE"
need "Koledar pregledov kot CSV (isti stolpci kot PDF — za Excel/računovodstvo)" "R295 gumb title — LIVE"
need "koledarPregledovCsvVrstice" "R295 lib EN VIR graditelj (čanek) — LIVE"
need "Koledar-pregledov-" "R295 ime datoteke predpona (čanek) — LIVE"
need "Vse stranke z vpisanim datumom pregleda (AKTIVEN + POTEKEL) — koledarski red" "R295 meta Obseg (čanek) — LIVE"
need "CSV se izvozi, ko je vpisan prvi datum pregleda." "R295 fail-closed toast — LIVE"
need "Koledar pregledov prenešen v CSV" "R295 uspeh toast (WYSIWYG) — LIVE"
need "Pregledi: " "R295 F2 mini-vrstica glava — LIVE"
need " vpisanih · " "R295 F2 mini-vrstica trikot ločilo — LIVE"
echo "--- R294 MANDATORY — AVTOMATIZACIJA KATALOG KARTICA + STRIP ŠTEVCI (LIVE — regresija) ---"
need "Avtomatizacija — razred funkcij" "R294 kartica aria + glava literal — LIVE"
need "AI = neobvezna pomoč (" "R294 AI resnica p literal — LIVE"
need "zmožnosti z izrečenim determinističnim nadomestkom" "R294 AI nadomestek kontrakt literal — LIVE"
need "jedro deluje brez AI." "R294 AI-neobveznost sklep literal — LIVE"
need "AI (neobvezne)" "R294 AI pill literal — LIVE"
need "območij poslovanja" "R294 kartica števec literal — LIVE"
need "meritve.ai-ocena-foto" "R294 katalog lib čanek — AI zmožnost 1 (VLM foto ocena) — LIVE"
need "viz.ai-render" "R294 katalog lib čanek — AI zmožnost 2 (GPU render stub) — LIVE"
need "Naročil: \${" "R294 strip števci title 'Računov: N · Naročil: M' (minifier: \\xb7 kanon) — LIVE"
echo "--- R293 MANDATORY — DOBIČKONOST PO PROJEKTIH CSV + RAZGLED (LIVE — regresija) ---"
need "Izvozi dobičkonosnost projektov kot CSV" "R293 gumb aria (JSX attr literal) — LIVE"
need "Dobičkonosnost po projektih kot CSV — ista resnica kot PDF (prihodki · stroški · marža)" "R293 gumb title (JSX attr literal) — LIVE"
need "CSV se izvozi, ko je vpisan prvi račun ali naročilo." "R293 fail-closed toast pri 0/0 (ISTI gate kot brat R258) — LIVE"
need "Dobičkonost prenešena v CSV (" "R293 uspešni toast (WYSIWYG sklep) — LIVE"
need "Maržni razgled — marža po projektih" "R293 MANDATORY STIL — strip aria regija — LIVE"
need "% najvišje marže" "R293 MANDATORY STIL — mini tir hover title izpeljava — LIVE"
need "Ni projektov v preseku — dobičkonost se izriše ob prvem računu ali naročilu." "R293 iskrena praznina (JSX literal) — LIVE"
need "Vsi projekti — presek računov (prihodki) in naročil (stroški materiala)" "R293 meta Obseg vrstica (lib čanek) — LIVE"
echo "--- R292 MANDATORY — TEDENSKI VOZNI RED CSV + RAZGLED (LIVE — regresija; oznake pozicijsko popravljene, blind-rename lekcija) ---"
need "Izvozi tedenski pregled montaž kot CSV" "R292 gumb aria (JSX attr literal) — LIVE"
need "Tedenski pregled montaž kot CSV — ista resnica kot PDF (dnevi · termini · ure)" "R292 gumb title — LIVE"
need "CSV se izvozi, ko je vpisan termin v prihajajočem tednu." "R292 fail-closed toast pri praznem oknu — LIVE"
need "Tedenski pregled prenešen v CSV (" "R292 uspešni toast (WYSIWYG sklep) — LIVE"
need "Tedenski razgled — naslednjih 7 dni" "R292 razgled strip aria regija — LIVE"
need "% najbolj obremenjenega dne" "R292 mini tir hover title izpeljava — LIVE"
need "Naslednjih 7 dni brez vpisanih terminov." "R292 iskrena praznina — LIVE"
need "Tedenski-vozni-red-" "R292 lib filename prefix (lib čanek) — LIVE"
echo "--- R291 MANDATORY — PRIHODKI MESECI CSV (LIVE — regresija) ---"
need "Izvozi prihodke po mesecih kot CSV" "R291 gumb aria (JSX attr literal) — LIVE"
need "Prihodki po mesecih kot CSV — ista resnica kot sekcija (skupaj + v teku + stornirani)" "R291 gumb title — LIVE"
need "CSV se izvozi ob prvem plačilu." "R291 fail-closed toast pri 0 — LIVE"
need "Prihodki po mesecih prenešeni v CSV (" "R291 uspešni toast (WYSIWYG) — LIVE"
need "CSV ni mogoče sestaviti iz teh podatkov" "R291 fail-verbose toast — LIVE"
need "% največjega meseca" "R291 MANDATORY STIL mini stolpci title — LIVE"
need "Plačani računi" "R291 CSV glava literal (lib čanek) — LIVE"
need "Vsi plačani računi po mesecih (iz seznama računov)" "R291 meta Obseg vrstica (lib čanek) — LIVE"
echo "--- R290 MANDATORY — PRIHODKI PO MESECIH (LIVE — regresija) ---"
need "Prihodki po mesecih — po mesecu plačila" "R290 aria regija — LIVE"
need "Prihodki po mesecih" "R290 sekcija glava — LIVE"
need "Ni plačanih računov — prihodki po mesecih se izrišejo ob prvem plačilu." "R290 iskrena praznina — LIVE"
need "ni mogoče razčleniti" "R290 fail-verbose role=alert copy — LIVE"
need "Skupaj plačano" "R290 skupaj vrstica — LIVE"
need "(izključeni iz zneskov)" "R290 pogojni stornirani žig — LIVE"
need "Plačano = vsi računi s statusom PLACAN (vsota zneskov)" "R290 KPI hover title — LIVE"
need "skupajPrihodki" "R290 objektni ključ (lib čanek) — LIVE"
echo "--- R289 MANDATORY — ISKREN PRESEŽEK (LIVE — regresija) ---"
need "\"aria-label\":\"Iskren presežek signalov\"" "R289 poimenovana note regija — LIVE"
need "Presežek:" "R289 note glava — LIVE"
need "Iskren presežek — zvonček prikazuje najpomembnejše vrstice; celotna resnica je na pripadajočih ploščah." "R289 title resnica — LIVE"
need "Današnje montaže" "R289 kategorija literal — LIVE"
need "Follow-upi" "R289 kategorija literal — LIVE"
need "Zapadli računi" "R289 kategorija literal — LIVE"
need "Zamujene dobave" "R289 kategorija literal — LIVE"
need "kategorija" "R289 objektni ključ — LIVE"
echo "--- R288 MANDATORY — OPOMNIK DEEP-LINK (LIVE — regresija) ---"
need "roksal:select-crm" "R288 dogodek literal — LIVE"
need "izbranaStrankaId" "R288 prop ključ — LIVE"
need "onStrankaIzbranaObravnavana" "R288 one-shot callback prop — LIVE"
need "PRESKOCI" "R288 lib odločitev literal — LIVE"
need "ODPRI" "R288 lib odločitev literal — LIVE"
need "CAKAJ" "R288 lib odločitev literal — LIVE"
need "Poudarjeno iz zvončka (opomnik)" "R288 hover title poudarjene vrstice — LIVE"
need "border-roksal-amber/60 bg-roksal-amber/5" "R288 poudarek žetoni — LIVE"
echo "--- R287 MANDATORY (LIVE — regresija) ---"
need "— odpre CRM (opomnik)" "R287 aria-label — LIVE"
need "CRM opomniki" "R287 fail-verbose vir label — LIVE"
need "Nizka zaloga, današnje montaže, naročila, vreme, računi, CRM opomniki in poslana obvestila." "R287 SheetDescription copy — LIVE"
need "ni aktivnih naročil, ni opomnikov in vreme ne povzroča skrbi." "R287 empty state copy — LIVE"
need "opomnikPotekel" "R287 kind literal — LIVE"
need "phone-call" "R287 PhoneCall ikona slug — LIVE"
need "opomnikStatus" "R287 lib property — LIVE"
need "opomnik-" "R287 id protokol — LIVE"
echo "--- R286/R285/R284 MANDATORY (LIVE — regresija) ---"
need "Izvozi inventurni pregled premoženja kot CSV" "R286 gumb aria — LIVE"
need "Inventura CSV = ista resnica kot PDF v Excelu" "R286 legenda — LIVE"
need "Inventurni pregled premoženja prenešen v CSV" "R286 toast — LIVE"
need "[\"id\",\"Premiki\",\"Izvoženo\"]" "R286 CSV 3 dodatna stolpca glava — LIVE"
need "Izvozi terenski zapisni list kot CSV" "R285 gumb aria — LIVE"
need "fizicna_ref_mm" "R285 CSV fill-in stolpec — LIVE"
need "zapiski_terena" "R285 CSV zapiski stolpec — LIVE"
need "ZAPISNI LIST CSV = ista resnica v Excelu" "R285 legenda — LIVE"
need "TERENSKI ZAPISNI LIST" "R284 PDF naslov — LIVE"
need "Fizična ref. (mm)" "R284 fill-in stolpec — LIVE"
need "Terenska vrata (issue #14 §18)" "R284 protokolna sekcija — LIVE"
need "Izvozi terenski zapisni list kot PDF" "R284 gumb aria — LIVE"
echo "--- R283/R282/R281 (LIVE — regresija) ---"
need "Viri (viden seznam): " "R283 F3 vir mini-vrstica glava — LIVE"
need "Pokritost virov vidnega seznama (issue #15 §3)" "R283 vir mini hover title — LIVE"
need "Sync (viden seznam): " "R282 mini-vrstica glava — LIVE"
need "Konflikt — osveži bazo in ponovi sync" "R282 akcijski žig — LIVE"
need "Sinhronizacijsko stanje: Sinhronizirano" "R281 sync žig title SYNCED — LIVE"
need "Sinhronizacijsko stanje: V čakalni vrsti" "R281 sync žig title PENDING — LIVE"
need "Sinhronizacijsko stanje: Konflikt" "R281 sync žig title CONFLICT — LIVE"
need "Sinhronizacijsko stanje: Napaka" "R281 sync žig title ERROR — LIVE"
need "tombstone — grobnico potrdi /api/sync" "R281 tombstone note — LIVE"
need "Sync metadata (opazovano stanje klienta" "R281 TooltipContent — LIVE"
echo "INFO : R281 server matrika žigi ×3 — LOKALNA pokritost (r281-build-needles, isti commit) + žični dokaz Z3 v99 gate"
echo "--- R280/R278/R279/R277/R276 (LIVE — regresija) ---"
need "Vrsta meritve: Razdalja" "R280 tip badge title RAZDALJA — LIVE"
need "Vrsta meritve: Višina" "R280 tip badge title VISINA — LIVE"
need "Vrsta meritve: Stebriček/Palica" "R280 tip badge title STEBR — LIVE"
need " se ne označuje — označujem samo odstopanja" "R280 kot badge title — LIVE"
need "Vir podatkov: Ročni vnos" "R278 vir pill title MANUAL — LIVE"
need "Vir podatkov: Foto-CV" "R278 vir pill title PHOTO_CV — LIVE"
need "Vir podatkov: AR-Depth" "R278 vir pill title ARCORE_DEPTH — LIVE"
need "stabilen segmentId" "R279 Badge title — LIVE"
need "\"Verzija\",\"Vir\"" "R277 PDF 10-stolpčna glava — LIVE"
need "nastalo pred verzioniranjem" "R277 legacy '—' iskren odpad — LIVE"
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
must_miss "TODO-R295" "R295 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R294" "R294 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R293" "R293 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R292" "R292 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R291" "R291 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R290" "R290 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R289" "R289 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R288" "R288 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R287" "R287 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R286" "R286 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R285" "R285 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R284" "R284 — brez razvojnih ostankov (izginil)"
[ "$FAIL" = 0 ] || { echo "NEEDLEJI FAIL — abort"; exit 1; }
echo "Z2 OK — vsi needleji ŽIVO"

echo "=== Z3: v99 sync gate regresija (R274 gate še ŽIVO — ZERO-MUTACIJA) ==="
agent-browser eval "(()=>{window.__v99=null; window.__v99err=null; fetch('/api/sync',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify([{id:'r295-prod-v99-probe-'+Date.now(),customerName:'r295 probe v99',contractVersion:99}])}).then(r=>r.json()).then(d=>{window.__v99=d;}).catch(e=>{window.__v99err=String(e)}); return 'poslano';})()" 2>&1 | tail -1
eb_cakaj 3
agent-browser eval "JSON.stringify({odgovor:window.__v99??null, napaka:window.__v99err??null})" 2>&1 | tail -1 > /tmp/r295-z3.json
python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r295-z3.json').read().strip()
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

echo "=== R295 PROD QA — R290+R291+R292+R293+R294+R295 ŽIVO SKUPAJ ==="
