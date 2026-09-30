#!/bin/bash
# R311 — PRVA naloga (worklog R312): potrditi R290+…+R310+R311 SKUPAJ na produ.
#   R311 = 41. člen issue #1 «AI raba — iskrena resnica» (Deliverable 5 NA
#   ZASLONU): lib ai-raba-pregled — ČISTA projekcija katalog ('ai' vnosi z
#   IZREČENIM nadomestkom) × AI_KANDIDATI (3 × NE-IMPLEMENTIRANO — iskreni,
#   nič povezano); vodja blok WYSIWYG [ai-raba-dokaz]; fail-closed
#   (AI-brez-nadomestka / nadomestek-ne-obstaja / kandidat-brez-zakaj →
#   TypeError). + MANDATORY STIL val 2: measurements-tab ×13 mest +
#   material-intelligence-tab ×10 + deal-pipeline spomnik ×2 — surove amber →
#   roksal žetoni (0 novih hex); 6 izrecnih izjem (kategorije barv / gola-text
#   lestvice — R308 lekcija) zaklenjene na SOURCE nivoju (r311 STRAŽAR).
#   Z0  build-guard (EPOCH): health build > R311 commit čas (git log —
#       self-contained meja; push sledi commitu v sekundah, zato je commit-čas
#       STROŽJA in pravilna meja: med commitom in pushom ni Vercel builda)
#       → R311 deploy potrjen (nosi R290+…+R311 — kanon R280/R284),
#       polni LIVE needle teki (R311 AI raba ×5 + STIL ×2 + R310 STIL punch/team ×5 +
#       R309 STIL harmonizacija ×4 + R308 API I/O meja ×7 + R307 Konflikti dokaz ×11 +
#       R306 Oprema cikel dokaz ×11 + R305 Tedenski pregled po dnevih ×11 +
#       R304 Vodja tedenski CSV ×11 + R303 Vodja tedenski PDF ×11 + R302 Konflikti PDF ×11 +
#       R301 Konflikti CSV ×11 + R300 mini ×11 + R299 ICS po ekipah ×16 + R298 ICS ×13 +
#       R297 Oprema CSV ×10 + R296 ICS ×11 + R295 ×9 + regresije).
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
#   Z2  čanki needleji: R311 ×7+1 + R310 ×5+1 + R309 ×4+3 + R308 ×7 + R307 ×11 +
#       R306 ×11 + R295 ×8 + R294 ×9 + R293 ×8 + R292 ×8 + R291 ×8 + R290 ×8 + regresije.
#   Z2b ŽIČNI EN VIR probei: val-1 ×4 + val-3 ×9 × pokvarjen JSON → 400 z ISTO
#       ovojnico + users 403 deny-first POZITIVNI dokaz (lekcija R311 1).
#   Z3  v99 sync gate (R274). ZERO-MUTACIJA.
#   LEKCIJA R307 3 (derive): grep čistost preverba uporablja RAZRED ZNAKOV
#   ('R31[0]_PUSH') — preverba ne sme ujeti svojega vzorca (samozadetek).
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"
R311_COMMIT_ISO="$(git log --format='%cI ::: %s' 2>/dev/null | awk -F' ::: ' '$2 ~ /^R311 —/ {print $1; exit}')"
[ -n "$R311_COMMIT_ISO" ] || { echo "FAIL-CLOSED: R311 commita ni v git zgodovini — EPOCH guard brez meje"; exit 1; }
R311_PUSH="$(date -u -d "$R311_COMMIT_ISO" +%Y-%m-%dT%H:%M:%S)"
echo "R311 meja (commit čas, UTC): $R311_PUSH"
# LEKCIJA R306 2: derive transformacije — grep preverba ostankov starega imena
# PRED tekom (unbound variable pri set -u je rešil, a čas izgubljen).
if grep -qE 'R31[0]_PUSH|R310[_]COMMIT_ISO' "$0"; then
  echo "FAIL-CLOSED: derive ostanki R310 PUSH/COMMIT meje v r311-prod-qa.sh — popravi pred tekom"
  exit 1
fi
echo "derive čistost: OK (nič R308 boundary ostankov — razred znakov, brez samozadetka)"


echo "=== Z0: prod build-guard — R311 deploy detekcija (EPOCH primerjava) ==="
BUILD=$(curl -s --max-time 15 "$PROD/api/public/health" | python3 -c "import json,sys; print(json.load(sys.stdin).get('build',''))" || true)
echo "PROD build: $BUILD"
STALE=0
python3 - "$BUILD" "$R311_PUSH" <<'PYEOF' || STALE=1
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
  echo "██ ESKALACIJA — PROD STALE: build $BUILD ≤ R311 commit meja ($R311_PUSH)."
  echo "██ R311 pričakuje SKUPNI deploy (kanon R280/R284)."
  echo "██ Kanon R258: deployment pipeline event, NI koda-bug. Eksplicitna"
  echo "██ eskalacija LASTNIKU (Vercel dashboard — deploy stuck/limit)."
  echo "██ Zdaj: ISKREN stale-dokaz (stale zdrav LIVE needleji; ZERO must_miss — skew lekcija R294)."
  echo "████████████████████████████████████████████████████████████████"
  echo ""
  eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
  eb_zapri_vodic

  echo "=== Z1b-stale: verzije ruta ŽIVO (ZERO-MUTACIJA GET) ==="
  agent-browser eval "(()=>{window.__verz=null; window.__verzStatus=null; fetch('/api/measurements/r304-ne-obstojeci-id-probe/verzije',{credentials:'same-origin'}).then(r=>{window.__verzStatus=r.status; return r.json();}).then(d=>{window.__verz=d;}).catch(e=>{window.__verzErr=String(e)}); return 'poslano';})()" 2>&1 | tail -1
  eb_cakaj 3
  agent-browser eval "JSON.stringify({status:window.__verzStatus, body:window.__verz??null, napaka:window.__verzErr??null})" 2>&1 | tail -1 > /tmp/r311-z1b.json
  python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r311-z1b.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['napaka'] is None, 'Z1b mrežna napaka: ' + json.dumps(d)
assert d['status'] == 404, 'Z1b: pričakovan 404, dobljeno ' + str(d['status'])
assert isinstance(d['body'], dict) and d['body'].get('error') == 'Meritev ne obstaja', 'Z1b R276 žična vrstica FAIL: ' + json.dumps(d)
print('Z1b OK — stale build zdrav: verzije ruta 404 ŽIVO (R276+ regresa)')
PYEOF

  echo "=== Z3-stale: v99 sync gate (ZERO-MUTACIJA) ==="
  agent-browser eval "(()=>{window.__v99=null; window.__v99err=null; fetch('/api/sync',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify([{id:'r304-prod-v99-probe-'+Date.now(),customerName:'r304 probe v99',contractVersion:99}])}).then(r=>r.json()).then(d=>{window.__v99=d;}).catch(e=>{window.__v99err=String(e)}); return 'poslano';})()" 2>&1 | tail -1
  eb_cakaj 3
  agent-browser eval "JSON.stringify({odgovor:window.__v99??null, napaka:window.__v99err??null})" 2>&1 | tail -1 > /tmp/r311-z3.json
  python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r311-z3.json').read().strip()
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
  OUT=/tmp/r311-prod-chunks
  mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
  : > /tmp/r311-chunkurls-lines-stale.txt
  # R297 lekcija (prvi resnični stale + 2. LIVE tek): EN skupni harvest je
  # NEDETERMINISTIČEN (privzeti ResourceTiming buffer 250 se preplavi pri
  # 9-12 zavihkov; reload med sejo — med Vercel deployom! — ponastavi vnose;
  # per-tab CLEAR pa izbriše že naložene čanke, ker ponovni obisk NE naloga
  # nič novega → 18/44). UNION oblika: buffer 10000 ENKRAT pred zanko +
  # per-tab posamezne slike BREZ clear (zaščita pred reload) + KONČNI en strel
  # (polna akumulacija — zaščita pred poznimi nalaganji) → merge + dedup.
  for d in '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"documents","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}' '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}' '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}' '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"teren","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"ekipa","subTab":null,"osnutek":null,"filter":null}'; do
agent-browser eval "(()=>{performance.setResourceTimingBufferSize(10000); return 'buf';})()" 2>&1 | tail -1 > /dev/null
  eb_dispatch "$d"
  eb_cakaj 3
  agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 >> /tmp/r311-chunkurls-lines-stale.txt
  done
  agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 >> /tmp/r311-chunkurls-lines-stale.txt
  python3 /home/z/my-project/scripts/merge-chunkurls.py /tmp/r311-chunkurls-lines-stale.txt /tmp/r311-chunkurls.txt || { echo "PY MERGE FAIL — abort"; exit 1; }
  cp /tmp/r311-chunkurls.txt "$OUT"/chunk-urls.txt
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
  echo "██ vse generacije — needleji pokrijejo R290+…+R311 — kanon R280/R284)."
  echo "████████████████████████████████████████████████████████████████"
  exit 0
fi

echo "R311 deploy potrjen (build $BUILD > R311 commit meja $R311_PUSH) — polni LIVE teki"
echo "OPOMBA: deploy je nosil VSE generacije (R290+…+R311 — kanon R280/R284)"

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z1: meritve tab ŽIVO — sync žig (POGOJNO — spot portfel podatkovna resnica) ==="
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
if eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Pokaži zgodovino verzij meritve\"]');})()" 16; then
  eb_cakaj 2
  agent-browser eval "(()=>{const syncPill=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.getAttribute('title')||'').startsWith('Sinhronizacijsko stanje:')); const viriMini=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.textContent||'').startsWith('Viri (viden seznam):')); return JSON.stringify({syncPill:syncPill?(syncPill.getAttribute('title')||'').slice(0,45):null, viriMini:viriMini?viriMini.textContent.trim():null, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r311-z1.json
  python3 -c "import json; r=json.load(open('/tmp/r311-z1.json')); d=json.loads(r) if isinstance(r,str) else r; t = 'R281 sync žig ŽIVO (' + d['syncPill'] + ' …)' if d['syncPill'] else 'R281 OPOMBA: sync žig NE prisoten — spot portfel brez sync metadata (iskrena praznina — pogojni probe po kanonu r277 Z1)'; v = ' · R283 VIRI MINI ŽIVO (' + d['viriMini'] + ')' if d['viriMini'] else ' · R283 VIRI MINI NE prisoten — spot seznam brez virov (iskrena praznina — pogojni)'; print('Z1 OK — meritve UI ŽIVO · ' + t + v)" || exit 1
else
  echo "Z1 OPOMBA: meritve UI ni dosegljiva spot seji (MONTER skoping?) — UI probe preskočen, ruta probe Z1b ostaja obvezen"
fi

echo "=== Z1b: verzije ruta ŽIVO — 404 + R276 žična vrstica (ZERO-MUTACIJA GET) ==="
agent-browser eval "(()=>{window.__verz=null; window.__verzStatus=null; fetch('/api/measurements/r304-ne-obstojeci-id-probe/verzije',{credentials:'same-origin'}).then(r=>{window.__verzStatus=r.status; return r.json();}).then(d=>{window.__verz=d;}).catch(e=>{window.__verzErr=String(e)}); return 'poslano';})()" 2>&1 | tail -1
eb_cakaj 3
agent-browser eval "JSON.stringify({status:window.__verzStatus, body:window.__verz??null, napaka:window.__verzErr??null})" 2>&1 | tail -1 > /tmp/r311-z1b.json
python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r311-z1b.json').read().strip()
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
  agent-browser eval "(()=>{const desc=[...document.querySelectorAll('span')].some(x=>x.textContent.includes('CRM opomniki in poslana obvestila')); const vrstice=[...document.querySelectorAll('button')].filter(x=>(x.getAttribute('aria-label')||'').includes('— odpre CRM (opomnik)')); return JSON.stringify({desc, stOpomnikov:vrstice.length, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r311-z1c.json
  python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r311-z1c.json').read().strip()
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
agent-browser eval "(()=>{const note=document.querySelector('[aria-label=\"Iskren presežek signalov\"]'); return JSON.stringify({notePrisoten:!!note, vsebina:note?note.textContent.trim().slice(0,120):null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r311-z1d.json
python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r311-z1d.json').read().strip()
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

echo "=== Z2: čanki — klient needleji (R311 ×7+1 + R310 ×5+1 + R309 ×4+3 + R308 ×7 + R307 ×11 + R306 ×11 + R295 ×9 LIVE + R294 ×9 + R293 ×8 + R292 ×8 + R291 ×8 + R290 ×8 + regresije + must_miss) ==="
OUT=/tmp/r311-prod-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
: > /tmp/r311-chunkurls-lines-live.txt
# R297 lekcija: ISTA UNION oblika kot stale veja (buffer 10000 + per-tab
# slike brez clear + končni en strel + merge/dedup — glej komentar tam).
for d in '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"documents","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}' '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}' '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}' '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"teren","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"ekipa","subTab":null,"osnutek":null,"filter":null}'; do
agent-browser eval "(()=>{performance.setResourceTimingBufferSize(10000); return 'buf';})()" 2>&1 | tail -1 > /dev/null
  eb_dispatch "$d"
  eb_cakaj 3
  agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 >> /tmp/r311-chunkurls-lines-live.txt
done
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 >> /tmp/r311-chunkurls-lines-live.txt
python3 /home/z/my-project/scripts/merge-chunkurls.py /tmp/r311-chunkurls-lines-live.txt /tmp/r311-chunkurls.txt || { echo "PY MERGE FAIL — abort"; exit 1; }
cp /tmp/r311-chunkurls.txt "$OUT"/chunk-urls.txt
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
echo "--- R309 MANDATORY — MIGRACIJSKI VAL I/O MEJE: EN VIR api-telo + STIL harmonizacija (LIVE — PRVA naloga R310) ---"
# LEKCIJA R310 1 (tek 1 iskren MISS ×2 → NEEDLEJI FAIL): EN VIR sporočilo in
# preberiJsonTelo sta SERVERSKI plasti (api-telo uvažajo samo route-handlerji)
# — client chunki jih NIKOLI ne nosijo; kanon R302 2: identifikatorji NIKOLI.
# Iskren LIVE dokaz = žični probe Z2b (spodaj, za must_miss blokom).
need "bg-roksal-green/10 text-roksal-ink border-roksal-green/40" "R309 PLACAN značka (žeton + ink) — LIVE"
need "border-roksal-green/30 bg-roksal-green/10" "R309 Plačano KPI kartica (žeton) — LIVE"
need "bg-roksal-amber text-roksal-navy hover:bg-roksal-amber/90 press-scale" "R309 Nov račun CTA (žetona) — LIVE"
need "border-l-roksal-green" "R309 vrstična letvica PLACAN (žeton) — LIVE"
must_miss "bg-amber-500 text-navy-900" "R309 surov CTA par (izginil) — LIVE"
must_miss "border-l-emerald-500" "R309 surova letvica (izginila) — LIVE"
must_miss "border-emerald-200 dark:border-emerald-800 bg-emerald-50" "R309 surova KPI kartica (izginila) — LIVE"

echo "--- R310 MANDATORY — 3. VAL I/O MEJE + STIL punch-list/team-tab (LIVE) ---"
# LEKCIJA R310 1: EN VIR sporočilo/preberiJsonTelo sta SERVERSKI plasti —
# client chunki jih NIKOLI ne nosijo → žični probe Z2b (spodaj). Tu SAMO
# STIL žetoni (klient plast) + enolično pripisljivi must_miss (R308 lekcija 3:
# deljene surove sekvene značke/banerja živijo še v measurements-tab — izrecno
# izven R310 obsega → pripisljivost na SOURCE nivoju: r310 val3 test).
need "bg-roksal-amber/10 text-roksal-ink border-roksal-amber/40" "R310 punch Napaka značka (žeton + ink — PLACAN R309 oblika) — LIVE"
need "border-roksal-amber bg-roksal-amber text-roksal-navy" "R310 punch Napaka krog (žeton par) — LIVE"
need "bg-roksal-amber/10 text-roksal-amber" "R310 team chips (žeton — družina Zaklenjen/Aktiven oblika) — LIVE"
need "rounded-xl border border-roksal-amber/40 bg-roksal-amber/10 px-3.5 py-3" "R310 team baner (žetoni + ink besedilo — r162 lekcija) — LIVE"
need "inline-flex items-center gap-1 font-medium text-roksal-ink" "R310 team mora-zamenjati-geslo inline (ink + žeton ikona) — LIVE"
must_miss "border-amber-500 bg-amber-100 dark:bg-amber-500/15 text-amber-600" "R310 punch surov krog par (izginil) — LIVE"

echo "--- R311 MANDATORY — 41. člen: AI raba dokaz na zaslonu + STIL val 2 (LIVE) ---"
# Vodja chunk (dispatch more:'vodja' ŽE v harvestu) nosi lib ai-raba-pregled
# (EN VIR projekcija — kandidati status + sklep fragmenti so lib template
# literali, preživijo minifikacijo kot string literali — kanon ASCII).
need "ai-raba-dokaz" "R311 blok testid (vodja chunk) — LIVE"
need "AI raba — iskrena resnica" "R311 naslov (aria + glava) — LIVE"
need "→ nadomestek (brez AI): " "R311 nadomestek literal — LIVE"
need "NE-IMPLEMENTIRANO — kandidat (nič povezano)" "R311 kandidati status verbatim — LIVE"
need "AI-obveznih: 0 — jedro deluje brez AI" "R311 sklep ničla (lib template) — LIVE"
need "border-dashed border-roksal-amber/50" "R311 measurements dashed zona (žetoni) — LIVE"
need "bg-roksal-amber text-roksal-navy" "R311 WPC ikona vsebnik (žeton par) — LIVE"
must_miss "border-amber-400/50 dark:border-amber-700/50" "R311 measurements surova dashed zona (izginila — unikatna sekvenca) — LIVE"

echo "=== Z2b: EN VIR ŽIVO NA ŽICI (val-1 ×4 + val-3 ×9 × pokvarjen JSON → 400 z ISTO ovojnico + users 403 deny-first POZITIVNI dokaz; ZERO-MUTACIJA — guard strelja PRED db zapisom) ==="
# Vzorec lokalnega Z0ah/Z0ai (r309/r310-e2e-browser.sh), tu podmnožica 13:
# spot seja je MONTER (precedens R127/R165) — 7 vrat ima
# denyWithoutPermission PRED preberiJsonTelo (crews, inventory, material-orders,
# material-prices, profili, schedules, suppliers → tam bi MONTER videl 403, ne
# 400); val-1 izbrani 4 + val-3 izbrani 9 brez 403 pred telesom (verificirano v
# viru R310 + ROLE_PERMISSIONS matrika R311: measurements, punch, ar-snapshots,
# photos; quote [quotes.create ✓ MONTER], railing-layout, crm
# [customers.write ✓ MONTER], qc, evidence, viz/render, measurements/[id],
# ar/analyze, measure/photo — equipment IZVZET: deny-first na vrstici 18;
# users OHRANJEN kot IZRECEN deny-first POZITIVNI dokaz [users.manage ✗ MONTER
# → 403 — LEKCIJA R311 1: mehanski vir-check mora preveriti VSE 403 poti
# [lacksPermission/canManageCustomers/forbidden] proti ROLE_PERMISSIONS
# matriki, ne samo gate simbole; tek 2 iskren FAIL: users 403]) — vrstni red:
# rate-limit → authenticate → [pravica] → preberiJsonTelo. Dvojni podpis
# (R194/R309 lekcija 4): roksal_csrf iz document.cookie → x-csrf-token.
agent-browser eval "(()=>{window.__r311val=[]; const ck=document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('roksal_csrf=')); const tok=ck?ck.slice(12):null; const h={'Content-Type':'application/json'}; if(tok)h['x-csrf-token']=tok; const rute=[['measurements','/api/measurements','POST'],['punch','/api/punch','POST'],['ar-snapshots','/api/ar-snapshots','POST'],['photos','/api/photos','POST'],['quote','/api/quote','POST'],['railing-layout','/api/railing-layout','POST'],['users','/api/users','POST'],['crm','/api/crm','PATCH'],['qc','/api/qc','POST'],['evidence','/api/evidence','POST'],['viz-render','/api/viz/render','POST'],['measurements-id','/api/measurements/e2e-r310-ne-obstojeci-id','PATCH'],['ar-analyze','/api/ar/analyze','POST'],['measure-photo','/api/measure/photo','POST']]; (async()=>{ for (const [ime,url,metoda] of rute){ try{ const r=await fetch(url,{method:metoda,credentials:'same-origin',headers:h,body:'{pokvarjen'}); let b=null; try{b=await r.json();}catch(e){b=null;} window.__r311val.push({ime,status:r.status,error:b&&typeof b==='object'?(b.error??null):null}); }catch(e){ window.__r311val.push({ime,status:0,error:'MREŽA: '+String(e)}); } } })(); return 'poslano '+rute.length;})()" 2>&1 | tail -1
eb_cakaj 6
agent-browser eval "JSON.stringify(window.__r311val??[])" 2>&1 | tail -1 > /tmp/r311-z2b.json
python3 - <<'PYEOFZ2B' || exit 1
import json
raw = open('/tmp/r311-z2b.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert isinstance(d, list) and len(d) == 14, 'Z2b oblika: pričakovano 14 zapisov, dobljeno ' + json.dumps(d if not isinstance(d, list) else len(d))
EN_VIR = 'Neveljavno telo zahteve — pričakovan JSON objekt'
# LEKCIJA R311 1: users = izrecen deny-first POZITIVNI dokaz (users.manage ✗
# MONTER → 403) — VSI ostali = 400 z ISTO EN VIR ovojnico.
DENY403 = {'users'}
napake = set()
for x in d:
    assert isinstance(x['error'], str) and len(x['error']) > 0, 'Z2b ' + x['ime'] + ': manjkajoča ovojnica — ' + json.dumps(x)
    if x['ime'] in DENY403:
        assert x['status'] == 403, 'Z2b ' + x['ime'] + ': pričakovan 403 (deny-first POZITIVNI dokaz — pravica users.manage ✗ MONTER), dobljeno ' + str(x['status']) + ' — ' + json.dumps(x)
    else:
        assert x['status'] == 400, 'Z2b ' + x['ime'] + ': pričakovan 400 (fail-closed — napaka odjemalca, NIKOLI 500), dobljeno ' + str(x['status']) + ' — ' + json.dumps(x)
        napake.add(x['error'])
assert napake == {EN_VIR}, 'Z2b EN VIR kršitev — ovojnice niso enotne: ' + json.dumps(sorted(napake))
print('Z2b OK — EN VIR ŽIVO NA ŽICI val-1+val-3: 13/13 × 400 z ISTO ovojnico + users 403 deny-first POZITIVNI dokaz (NIČ 500, NIČ podvojenih sporočil — stena nepropustna, vrata zaprta pravilno PRED telesom)')
PYEOFZ2B
echo "--- R308 MANDATORY — API I/O MEJA: HARMONIZIRANE OPOZORILNE POVRŠINE (LIVE — regresija) ---"
need "border-roksal-amber/60 text-roksal-ink hover:bg-roksal-amber/10" "R308 punch-list Ponovni poskus gumb (nov žetonski razred) — LIVE"
need "bg-roksal-amber/10 px-3 py-2 ring-1 ring-roksal-amber/30" "R308 site-survey opozorila povzetek (nov žetonski razred) — LIVE"
need "rounded-lg border border-roksal-amber/40 bg-roksal-amber/10 p-2 text-2xs text-roksal-ink" "R308 invoice-manager mesečna napaka (nov žetonski razred) — LIVE"
need "px-2.5 py-2 text-[11px] font-medium text-roksal-ink" "R308 weather-card demo opozorilo (nov žetonski razred) — LIVE"
need "Zapisnika ni bilo mogoče naložiti" "R308 regresa: napaka nalaganja zapisnika (besedilo ohranjeno) — LIVE"
need "Prihodki po mesecih iz teh podatkov ni mogoče razčleniti" "R308 regresa: fail-verbose razčlenitvena napaka — LIVE"
need "Demo podatki — živi vremenski servis trenutno ni dosegljiv." "R308 regresa: demo vreme opozorilo (iskrena resnica) — LIVE"
echo "--- R307 MANDATORY — KONFLIKTNI DOKAZ NA ZASLONU (LIVE — regresija) ---"
need "konflikti-dokaz" "R307 blok testid (dokaz parov) — LIVE"
need "konfliktiDokaz: " "R307 lib graditelj prek TypeError STRING kanona (R302 lekcija 1) — LIVE"
need "Dokazani pari prekrivanj ekipe" "R307 aria-label (blok) — LIVE"
need "Dokazani pari prekrivanj" "R307 naslov (vidno besedilo) — LIVE"
need "Pregledanih " "R307 sklep števec (WYSIWYG s CSV meta/PDF KPI) — LIVE"
need "ISTI pari in ISTI vrstni red kot Konflikti CSV in Konflikti PDF" "R307 definicijski naslov EN VIR pravilo — LIVE"
need "ZASLON = takoj na pogled" "R307 definicijski naslov razlika medija — LIVE"
need "poli-odprto pravilo" "R307 definicijski naslov pravilo — LIVE"
need "nazaj-na-nazaj" "R307 definicijski naslov konkretno pravilo — LIVE"
need "Pregledanih = aktivni termini" "R307 sklep title obsega resnica — LIVE"
need "font-medium text-roksal-red" "R307 ekipa RED žig (pariteta CSV/PDF) — LIVE"
echo "--- R306 MANDATORY — OPREMA CIKEL DOKAZ NA ZASLONU (LIVE — regresija) ---"
need "opremaCikelDokaz" "R306 lib filter (EN VIR — LIVE prek TypeError kanona) — LIVE"
need "opremaCikelDokaz: " "R306 lib graditelj prek TypeError STRING kanona (R302 lekcija 1 — identifikatorji minificirani) — LIVE"
need "oprema-cikel-dokaz-prazno" "R306 zelen žig veja testid — LIVE"
need "oprema-cikel-dokaz-sklep" "R306 sklep veja testid (dvojni števec) — LIVE"
need "Oprema za poskrbeti" "R306 naslov — LIVE"
need "Oprema, ki potrebuje akcijo" "R306 aria-label — LIVE"
need "ZASLON = takoj na pogled" "R306 definicijski naslov razlika medija — LIVE"
need "kot Cikel PDF in Cikel CSV" "R306 definicijski naslov EN VIR pravilo — LIVE"
need "Nemerska oprema" "R306 sivi žig (kalNeZahteva NI alarm) — LIVE"
need "Vrstic " "R306 sklep tekst (iskren dvojni števec) — LIVE"
need "pregled nezabeležen" "R306 AMBER žig label — LIVE"
echo "--- R305 MANDATORY — TEDENSKI PREGLED PO DNEVIH Z EKIPAMI (LIVE — regresija) ---"
need "tedenskiEkipaDanRazgled" "R305 lib pregrupacija (EN VIR — LIVE prek TypeError kanona) — LIVE"
need "tedenski-ekipa-dnevi-prazno" "R305 prazna veja testid (iskrena praznina) — LIVE"
need "tedenski-ekipa-dnevi-sklep" "R305 sklep veja testid (PETI potrošnik) — LIVE"
need "Teden po dnevih in ekipah" "R305 naslov (vidno + aria) — LIVE"
need "Brez ekip z termini v okviru" "R305 prazna veja iskren tekst — LIVE"
need "ISTI pregled in vrstni red kot Ekipe PDF in Ekipe CSV" "R305 definicijski naslov EN VIR pravilo — LIVE"
need "prazni dnevi vidni" "R305 definicijski naslov kanon R292 — LIVE"
need "ZASLON = takoj na pogled" "R305 definicijski naslov razlika medija — LIVE"
need "Brez terminov na ta dan" "R305 prazen dan vrstica — LIVE"
need "Dodeli ekipo v terminu" "R305 prazna veja dejanje — LIVE"
need "preklicanih " "R305 preklicani števec per dan — LIVE"
echo "--- R304 MANDATORY — VODJA TEDENSKI CSV PO EKIPAH (LIVE — regresija) ---"
need "tedenskiEkipaCsvVrstice" "R304 lib vrstice (EN VIR — LIVE prek TypeError kanona) — LIVE"
need "tedenskiEkipaCsvFilename" "R304 ime datoteke (EN VIR graditelj) — LIVE"
need "ekipe-csv-pill" "R304 pill testid — LIVE"
need "Ekipe CSV" "R304 pill label — LIVE"
need "Tedenski vozni red po ekipah prenešen v CSV" "R304 WYSIWYG toast naslov — LIVE"
need "Tedenski vozni red po ekipah kot CSV" "R304 definicijski naslov — LIVE"
need "Izvoz CSV po ekipah ni uspel" "R304 fail-verbose catch (guard resnica) — LIVE"
need "CSV po ekipah se izvozi, ko je vpisan termin" "R304 fail-closed toast (prazno okno) — LIVE"
need "CSV po ekipah se izvozi, ko ima ekipa vpisan termin" "R304 fail-closed toast (0 ekip — mirror R299/R303) — LIVE"
need "vir = ISTI pregled kot Ekipe PDF" "R304 meta Obseg EN VIR dokaz — LIVE"
need "Terminov po ekipah" "R304 meta števec (capital T — EN VIR pregleda) — LIVE"
echo "--- R303 MANDATORY — VODJA TEDENSKI PDF PO EKIPAH (LIVE — regresija) ---"
need "buildTedenskiEkipaPdfDoc" "R303 lib graditelj (EN VIR — LIVE prek TypeError kanona) — LIVE (regresija)"
need "tedenskiEkipaPdfFilename" "R303 ime datoteke (EN VIR graditelj) — LIVE (regresija)"
need "ekipe-pdf-pill" "R303 pill testid — LIVE"
need "Ekipe PDF" "R303 pill label — LIVE"
need "TEDENSKI VOZNI RED PO EKIPAH" "R303 PDF naslov — LIVE"
need "Tedenski vozni red po ekipah prenešen" "R303 WYSIWYG toast naslov — LIVE"
need "Tedenski vozni red po ekipah kot PDF" "R303 definicijski naslov — LIVE"
need "Izvoz PDF po ekipah ni uspel" "R303 fail-verbose catch (guard resnica) — LIVE"
need "Ni ekip z termini v naslednjih 7 dneh" "R303 fail-closed toast (0 ekip — mirror R299) — LIVE"
need "ENA sekcija na ekipo" "R303 legenda + definicijski naslov (ENA sekcija na ekipo) — LIVE"
need "Tedenski-po-ekipah-" "R303 ime datoteke kanon (string literal) — LIVE"
echo "--- R302 MANDATORY — TEDENSKI KONFLIKTI PDF (LIVE — regresija) ---"
need "buildKonfliktiPdfDoc" "R302 lib graditelj (EN VIR — LIVE prek TypeError kanona) — LIVE (regresija)"
need "konfliktiPdfFilename" "R302 ime datoteke (EN VIR graditelj) — LIVE (regresija)"
need "konflikti-pdf-pill" "R302 pill testid — LIVE"
need "Konflikti PDF" "R302 pill label — LIVE"
need "TEDENSKI KONFLIKTI EKIP" "R302 PDF naslov — LIVE"
need "Konflikti prenešeni v PDF" "R302 WYSIWYG toast naslov — LIVE"
need "Konflikti tedenskega pregleda kot PDF" "R302 definicijski naslov — LIVE"
need "Izvoz konfliktov PDF ni uspel" "R302 fail-verbose catch (guard resnica) — LIVE"
need "Dokazani pari prekrivanj" "R302 PDF sekcija dokaza — LIVE"
need "Konflikti PDF se izvozi, ko je vpisan termin" "R302 prazno okno toast — LIVE"
need "tisk za pisarno" "R302 legenda (razlika medija) — LIVE"
echo "--- R301 MANDATORY — TEDENSKI KONFLIKTI CSV (LIVE — regresija) ---"
need "konfliktiCsvFilename" "R301 lib import (EN VIR graditelj) — LIVE"
need "konflikti-csv-pill" "R301 pill testid — LIVE"
need "Konflikti CSV" "R301 pill label — LIVE"
need "Dan prekrivanja" "R301 glava stolpec — LIVE"
need "Ekip z konflikti" "R301 meta stevec — LIVE"
need "Pregledanih terminov" "R301 meta obseg — LIVE"
need "dokazani pari prekrivanj ekipe" "R301 legenda — LIVE"
need "Ni dokazanih konfliktov v okviru" "R301 zelen žig toast — LIVE"
need "Žig je zelen" "R301 iskrena čistost razlaga — LIVE"
need "isti poli-odprto pregled kot žig" "R301 definicijski naslov — LIVE"
need "Konflikti prenešeni v CSV" "R301 WYSIWYG toast naslov — LIVE"
echo "--- R300 MANDATORY — TEDENSKI KONFLIKTNI PREGLED (LIVE — regresija) ---"
need "tedenskiKonflikti" "R300 lib EN VIR graditelj (canek) — LIVE"
need "tedenski-konflikti-mini" "R300 mini testid (canek) — LIVE"
need '["NAVRTENO","V_TEKU","PRELOZENO"]' "R300 aktivni statusi zrcalo (canek) — LIVE"
need "Konflikti: " "R300 mini resnica prepona (canek) — LIVE"
need "Konflikti: 0" "R300 čistost veja (canek) — LIVE"
need "dvojne rezervacije v okviru" "R300 konflikt veja (canek) — LIVE"
need "Pregled dvojnih rezervacij ekipe v 7-dnevnem okviru" "R300 definicijski naslov (canek) — LIVE"
need " isti poli-odprto pravilo kot API 409" "R300 pravilo v naslovu (canek) — LIVE"
need "text-roksal-green" "R300 čistost žig (canek) — LIVE"
need "text-roksal-red" "R300 konflikt žig (canek) — LIVE"
need "Preklicano/Zaključeno ne zasede" "R300 statusi v naslovu (canek) — LIVE"
echo "--- R299 MANDATORY — TEDENSKI ICS PO EKIPAH (LIVE — regresija) ---"
need "Tedenski ICS po ekipah" "R299 skupina aria — LIVE"
need "ICS po ekipi:" "R299 skupina oznaka — LIVE"
need "Ekipa z vsaj enim terminom v naslednjih 7 dneh (danes + 6 dni, UTC)" "R299 definicijski naslov oznake — LIVE"
need "Izvozi tedenski ICS samo za ekipo " "R299 cip aria — LIVE"
need "Samo termini ekipe " "R299 definicijski naslov cipa — LIVE"
need "tedenskiEkipaImena" "R299 lib EN VIR ekip seznam (canek) — LIVE"
need "tedenskiEkipaIcs" "R299 lib EN VIR izvoz (canek) — LIVE"
need "tedenskiEkipaIcsFilename" "R299 ime datoteke (canek) — LIVE"
need "-//Roksal//Tedenski vozni red po ekipah//SL" "R299 PRODID literal (canek) — LIVE"
need "X-ROKSAL-EKIPA:" "R299 ekipa meta (canek) — LIVE"
need "Ni ekip z termini v naslednjih 7 dneh" "R299 fail-closed toast — LIVE"
need "ICS po ekipi se izvozi, ko ima ekipa vpisan termin v prihajajočem tednu." "R299 iskren toast opis — LIVE"
need "Tedenski ICS za ekipo " "R299 uspeh toast (WYSIWYG) — LIVE"
need "Izvoz ICS za ekipo " "R299 fail-verbose catch — LIVE"
need " · ICS po ekipi = samo termini te ekipe (isti 7-dnevni okvir)" "R299 legenda — LIVE"
need "vozni-red-ekipa-" "R299 UID predpona (ni trkov; ASCII kanon R289) — LIVE"
echo "--- R298 MANDATORY — TEDENSKI VOZNI RED ICS (LIVE — regresija) ---"
need "Izvozi tedenski pregled montaž kot ICS koledar" "R298 gumb aria — LIVE"
need "Tedenski pregled montaž kot ICS — naslednjih 7 dni v telefonov koledar (ekipa uvozi razpored; ure in statusi iz iste resnice kot PDF/CSV)" "R298 gumb title — LIVE"
need "tedenskiVozniRedIcsVrstice" "R298 lib EN VIR graditelj (čanek) — LIVE"
need "tedenskiVozniRedIcsFilename" "R298 ime datoteke (čanek) — LIVE"
need "-//Roksal//Tedenski vozni red//SL" "R298 PRODID literal (čanek) — LIVE"
need "X-ROKSAL-OBSEG:" "R298 obseg meta (čanek) — LIVE"
need "ICS se izvozi, ko je vpisan termin v prihajajočem tednu." "R298 fail-closed toast — LIVE"
need "Tedenski vozni red prenešen v ICS" "R298 uspeh toast (WYSIWYG) — LIVE"
need "Izvoz ICS ni uspel" "R298 fail-verbose catch — LIVE"
need "Tedenski ICS = naslednjih 7 dni v telefonov koledar" "R298 legenda — LIVE"
need "Brez terminov — iskreno prazen dan" "R298 stil definicijski naslov števca — LIVE"
need "Vsi vidni termini dneva (preklicani ŠTETI — viden odpad)" "R298 stil definicijski naslov zapolnjen — LIVE"
need "Tedenski ICS" "R298 pill oznaka — LIVE"
echo "--- R297 MANDATORY — OPREMA CIKEL CSV (LIVE — regresija) ---"
need "Izvozi pregled življenjskega cikla opreme kot CSV" "R297 gumb aria — LIVE"
need "Življenjski cikl opreme kot CSV (isti stolpci kot PDF — za Excel/revizijo)" "R297 gumb title — LIVE"
need "opremaCikelCsvVrstice" "R297 lib EN VIR graditelj (čanek) — LIVE"
need "opremaCikelCsvFilename" "R297 ime datoteke (čanek) — LIVE"
need "prazen seznam opreme ne nastaja datoteke" "R297 lib fail-closed — LIVE"
need "Vsa oprema iz /api/equipment (polna resnica — tudi upokojena/izgubljena; NAZIV ASC referenčni red)" "R297 meta Obseg (čanek) — LIVE"
need "CSV se izvozi, ko je vpisan prvi kos opreme." "R297 fail-closed toast — LIVE"
need "Pregled opreme prenešen v CSV" "R297 uspeh toast (WYSIWYG) — LIVE"
need "Cikl videnega seznama opreme — polna resnica prihaja s FRESH fetch izvozom (PDF/CSV — VSA oprema)" "R297 stil F2 mini title — LIVE"
need "Merska oprema z kalibracijskim rokom, ki je že pretekel — akcija" "R297 stil kalibracija žig title — LIVE"
echo "--- R296 MANDATORY — KOLEDAR PREGLEDOV ICS (LIVE — regresija) ---"
need "Izvozi koledar pregledov kot ICS" "R296 gumb aria — LIVE"
need "Koledar pregledov kot ICS (uvoz v koledarsko aplikacijo — Google/Outlook/telefon)" "R296 gumb title — LIVE"
need "koledarPregledovIcsFilename" "R296 lib ime datoteke (čanek) — LIVE"
need "-//Roksal//Koledar pregledov//SL" "R296 PRODID konstanta (čanek) — LIVE"
need "CALSCALE:GREGORIAN" "R296 ICS glava (čanek) — LIVE"
need "X-ROKSAL-STATUS:" "R296 X- status resnica VERBATIM (čanek) — LIVE"
need "ICS se izvozi, ko je vpisan prvi datum pregleda." "R296 fail-closed toast — LIVE"
need "Koledar pregledov prenešen v ICS" "R296 uspeh toast (WYSIWYG) — LIVE"
need "text/calendar;charset=utf-8" "R296 MIME resnica (čanek) — LIVE"
need "Pregledi v naslednjih 7 dneh (kanon opomnika" "R296 stil F2 title 2 — LIVE"
need "opomnikDatum < danes" "R296 stil F2 title 3 — LIVE"
echo "--- R295 MANDATORY — KOLEDAR PREGLEDOV CSV + F2 MINI-VRSTICA (LIVE — regresija) ---"
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
must_miss "TODO-R310" "R310 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R309" "R309 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R308" "R308 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R307" "R307 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R306" "R306 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R305" "R305 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R301" "R301 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R302" "R302 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R303" "R303 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R304" "R304 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R300" "R300 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R299" "R299 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R298" "R298 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R297" "R297 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R296" "R296 — brez razvojnih ostankov (izginil)"
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
agent-browser eval "(()=>{window.__v99=null; window.__v99err=null; fetch('/api/sync',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify([{id:'r304-prod-v99-probe-'+Date.now(),customerName:'r304 probe v99',contractVersion:99}])}).then(r=>r.json()).then(d=>{window.__v99=d;}).catch(e=>{window.__v99err=String(e)}); return 'poslano';})()" 2>&1 | tail -1
eb_cakaj 3
agent-browser eval "JSON.stringify({odgovor:window.__v99??null, napaka:window.__v99err??null})" 2>&1 | tail -1 > /tmp/r311-z3.json
python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r311-z3.json').read().strip()
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

echo "=== R311 PROD QA — R290+…+R311 ŽIVO SKUPAJ ==="
