#!/bin/bash
# R289 — PRVA naloga (worklog R290): potrditi R289 na produ (R288 ŽIVO
# dokazan r288-prod-qa; meja > R289 push/commit 2026-09-29T17:57:03Z —
# Vercel deploy iz main po tem pushu MORA nositi R289)
#   Z0  build-guard: health build > R289 push (2026-09-29T17:57:03Z) —
#       starejši build = NI ŠE R289 → abort (needleji bi lažno FAILali).
#       Primerjava v EPOCH (deterministična — brez case-pattern krhlosti).
#   Z1  meritve tab ŽIVO (spot seja) — sync žig POGOJNO (spot portfel
#       podatkovna resnica; kanon r277 Z1 pogojni probe).
#   Z1b verzije ruta ŽIVO: GET /api/measurements/ne-obstojeci/verzije → 404
#       + 'Meritev ne obstaja' (R276+ regresa). ZERO-MUTACIJA.
#   Z1c ZVONČEK ŽIVO (R287 regresa + R288 pogojni vir): odprem zvončka (b.click —
#       r287 E2E Z0z vzorec), POGOJNI DOM probe (prazna kopija ALI opomniške
#       vrstice — spot podatki neznani, kanon r277 pogojni), Escape zapri.
#       ZERO-MUTACIJA (brez 'Označi vse kot prebrano' — mutacija prepovedana).
#   Z1d NOVO (R289): PRESEŽEK note POGOJNI probe — ko je zvonček odprt:
#       aria regija 'Iskren presežek signalov' prisotna ALI ne (spot
#       portfel neznana resnica; iskreno zabeleženo — brez trdne trditve).
#   Z2  čanki needleji: R289 PRESEŽEK ×8 (aria + note glava + title + 4
#       kategorije + lib/objektni ključ)
#       + R288 DEEP-LINK ×8 regresija + R287 OPOMNIK ×8 regresija
#       + R286/R285/R284/R283/R282/R281/R280/R278/R279/R277/R276/R274/R272/
#       R271/R269/R240/R227 regresije + must_miss.
#   Z3  v99 sync gate regresija (R274 gate še ŽIVO). ZERO-MUTACIJA.
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"

echo "=== Z0: prod build-guard — R289 deploy detekcija (EPOCH primerjava) ==="
BUILD=$(curl -s --max-time 15 "$PROD/api/public/health" | python3 -c "import json,sys; print(json.load(sys.stdin).get('build',''))" || true)
echo "PROD build: $BUILD"
python3 - "$BUILD" <<'PYEOF' || { echo "R289 NI ŠE DEPLOYAN (build ≤ R289 push 17:57:03Z) — needleji bi lažno FAILali"; exit 1; }
import sys
from datetime import datetime
build = sys.argv[1]
try:
    t = datetime.fromisoformat(build.replace('Z', '+00:00'))
except Exception:
    sys.exit(1)
meja = datetime.fromisoformat('2026-09-29T17:57:03+00:00')
sys.exit(0 if t > meja else 1)
PYEOF
echo "R289 deploy potrjen (build $BUILD > R289 push 17:57:03Z) — probe DOVOLJEN"

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z1: meritve tab ŽIVO — sync žig (POGOJNO — spot portfel podatkovna resnica) ==="
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
if eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Pokaži zgodovino verzij meritve\"]');})()" 16; then
  eb_cakaj 2
  agent-browser eval "(()=>{const syncPill=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.getAttribute('title')||'').startsWith('Sinhronizacijsko stanje:')); const viriMini=[...document.querySelectorAll('span.cursor-help')].find(x=>(x.textContent||'').startsWith('Viri (viden seznam):')); return JSON.stringify({syncPill:syncPill?(syncPill.getAttribute('title')||'').slice(0,45):null, viriMini:viriMini?viriMini.textContent.trim():null, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r289-z1.json
  python3 -c "import json; r=json.load(open('/tmp/r289-z1.json')); d=json.loads(r) if isinstance(r,str) else r; t = 'R281 sync žig ŽIVO (' + d['syncPill'] + ' …)' if d['syncPill'] else 'R281 OPOMBA: sync žig NE prisoten — spot portfel brez sync metadata (iskrena praznina — pogojni probe po kanonu r277 Z1)'; v = ' · R283 VIRI MINI ŽIVO (' + d['viriMini'] + ')' if d['viriMini'] else ' · R283 VIRI MINI NE prisoten — spot seznam brez virov (iskrena praznina — pogojni)'; print('Z1 OK — meritve UI ŽIVO · ' + t + v)" || exit 1
else
  echo "Z1 OPOMBA: meritve UI ni dosegljiva spot seji (MONTER skoping?) — UI probe preskočen, ruta probe Z1b ostaja obvezen"
fi

echo "=== Z1b: verzije ruta ŽIVO — 404 + R276 žična vrstica (ZERO-MUTACIJA GET) ==="
agent-browser eval "(()=>{window.__verz=null; window.__verzStatus=null; fetch('/api/measurements/r289-ne-obstojeci-id-probe/verzije',{credentials:'same-origin'}).then(r=>{window.__verzStatus=r.status; return r.json();}).then(d=>{window.__verz=d;}).catch(e=>{window.__verzErr=String(e)}); return 'poslano';})()" 2>&1 | tail -1
eb_cakaj 3
agent-browser eval "JSON.stringify({status:window.__verzStatus, body:window.__verz??null, napaka:window.__verzErr??null})" 2>&1 | tail -1 > /tmp/r289-z1b.json
python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r289-z1b.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['napaka'] is None, 'Z1b mrežna napaka: ' + json.dumps(d)
assert d['status'] == 404, 'Z1b: pričakovan 404, dobljeno ' + str(d['status']) + ': ' + json.dumps(d)
assert isinstance(d['body'], dict) and d['body'].get('error') == 'Meritev ne obstaja', 'Z1b R276 žična vrstica FAIL: ' + json.dumps(d)
print('Z1b OK — GET /api/measurements/[id]/verzije ŽIVO na produ: 404 + \'Meritev ne obstaja\' (R276+ ruta regresija)')
PYEOF

echo "=== Z1c: ZVONČEK ŽIVO (R287 portal akcija — POGOJNI DOM probe, Escape zapri; ZERO-MUTACIJA) ==="
agent-browser eval "(()=>{const b=document.querySelector('button[aria-label^=\"Obvestila\"]'); if(!b) return 'BREZ-ZVONČKA'; b.click(); return 'odprto';})()" 2>&1 | tail -1
if eb_pocakaj_na "(()=>{const p=[...document.querySelectorAll('span')].some(x=>x.textContent.includes('CRM opomniki in poslana obvestila')); return p;})()" 16; then
  eb_cakaj 2
  agent-browser eval "(()=>{const desc=[...document.querySelectorAll('span')].some(x=>x.textContent.includes('CRM opomniki in poslana obvestila')); const vrstice=[...document.querySelectorAll('button')].filter(x=>(x.getAttribute('aria-label')||'').includes('— odpre CRM (opomnik)')); const empty=[...document.querySelectorAll('p,span,div')].some(x=>x.textContent.includes('ni aktivnih naročil, ni opomnikov')); return JSON.stringify({desc, stOpomnikov:vrstice.length, prazno:empty, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r289-z1c.json
  python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r289-z1c.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['desc'] is True, 'Z1c SheetDescription FAIL: ' + json.dumps(d)
assert d['err'] is None, 'Z1c err: ' + json.dumps(d)
if d['stOpomnikov'] > 0:
    print('Z1c OK — zvonček ŽIVO z ' + str(d['stOpomnikov']) + ' opomniško vrstico (aria \u2014 odpre CRM (opomnik))')
else:
    print('Z1c OK — zvonček ŽIVO, prazna kopija prisotna (iskrena praznina — spot brez opomnikov; pogojni probe kanon r277)')
PYEOF
else
  echo "Z1c OPOMBA: SheetDescription ni zaznan — zvonček morda ni odprt (pogojni probe; chunk needleji Z2 ostajajo obvezni dokaz)"
fi

echo "=== Z1d: PRESEŽEK note POGOJNI probe (R289 NOVO — aria regija 'Iskren presežek signalov'; spot resnica neznana) ==="
agent-browser eval "(()=>{const note=document.querySelector('[aria-label=\"Iskren presežek signalov\"]'); return JSON.stringify({notePrisoten:!!note, vsebina:note?note.textContent.trim().slice(0,120):null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r289-z1d.json
python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r289-z1d.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z1d err: ' + json.dumps(d)
if d['notePrisoten']:
    print('Z1d OK — presežek note ŽIVO na spot: ' + str(d['vsebina']))
else:
    print('Z1d OK — presežek note NIČ na spot (iskrena praznina — vse signalne družine pod capa; pogojni probe kanon r277, note je pogojna po zasnovi S2)')
PYEOF
agent-browser eval "(()=>{document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return 'esc';})()" 2>&1 | tail -1
eb_cakaj 2

echo "=== Z2: čanki — klient needleji (R289 LIVE + regresije + must_miss) ==="
OUT=/tmp/r289-prod-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
for d in '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"documents","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}' '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}' '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}' '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"teren","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"ekipa","subTab":null,"osnutek":null,"filter":null}'; do
  eb_dispatch "$d"
  eb_cakaj 3
done
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 > /tmp/r289-chunkurls-raw.json
python3 -c "import json; raw=open('/tmp/r289-chunkurls-raw.json').read().strip(); arr=json.loads(raw); arr=json.loads(arr) if isinstance(arr,str) else arr; open('/tmp/r289-chunkurls.txt','w').write('\n'.join(arr)+'\n')" || { echo "PY PARSE FAIL — abort"; exit 1; }
cp /tmp/r289-chunkurls.txt "$OUT"/chunk-urls.txt
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
echo "--- R289 MANDATORY — ISKREN PRESEŽEK (LIVE — PRVA naloga R290) ---"
need "\"aria-label\":\"Iskren presežek signalov\"" "R289 poimenovana note regija (STRING ključ na žici) — LIVE"
need "Presežek:" "R289 note glava (POVZETEK vrstica) — LIVE"
need "Iskren presežek — zvonček prikazuje najpomembnejše vrstice; celotna resnica je na pripadajočih ploščah." "R289 title resnica — LIVE"
need "Današnje montaže" "R289 kategorija literal (velika D) — LIVE"
need "Follow-upi" "R289 kategorija literal — LIVE"
need "Zapadli računi" "R289 kategorija literal — LIVE"
need "Zamujene dobave" "R289 kategorija literal — LIVE"
need "kategorija" "R289 objektni ključ (preživi minifier) — LIVE"
echo "--- R288 MANDATORY — OPOMNIK DEEP-LINK (LIVE — regresija) ---"
need "roksal:select-crm" "R288 dogodek literal (dvo-dogodkovni protokol R214 vzorec) — LIVE"
need "izbranaStrankaId" "R288 prop ključ (lupina lasti stanje) — LIVE"
need "onStrankaIzbranaObravnavana" "R288 one-shot callback prop — LIVE"
need "PRESKOCI" "R288 lib odločitev literal (fail-safe) — LIVE"
need "ODPRI" "R288 lib odločitev literal (stranka najdena) — LIVE"
need "CAKAJ" "R288 lib odločitev literal (čakanje) — LIVE"
need "Poudarjeno iz zvončka (opomnik)" "R288 hover title poudarjene vrstice — LIVE"
need "border-roksal-amber/60 bg-roksal-amber/5" "R288 poudarek žetoni (roksal-amber družina) — LIVE"
echo "--- R287 MANDATORY (LIVE — regresija) ---"
need "— odpre CRM (opomnik)" "R287 aria-label (portal akcija) — LIVE"
need "CRM opomniki" "R287 fail-verbose vir label (R182) — LIVE"
need "Nizka zaloga, današnje montaže, naročila, vreme, računi, CRM opomniki in poslana obvestila." "R287 SheetDescription copy — LIVE"
need "ni aktivnih naročil, ni opomnikov in vreme ne povzroča skrbi." "R287 empty state copy — LIVE"
need "opomnikPotekel" "R287 kind literal (KIND_STYLE + meta) — LIVE"
need "phone-call" "R287 PhoneCall ikona slug — LIVE"
need "opomnikStatus" "R287 lib property (status VERBATIM) — LIVE"
need "opomnik-" "R287 id protokol — LIVE"
echo "--- R286 MANDATORY (LIVE — regresija) ---"
need "Izvozi inventurni pregled premoženja kot CSV" "R286 gumb aria — LIVE"
need "Inventura CSV = ista resnica kot PDF v Excelu" "R286 legenda — LIVE"
need "Inventurni pregled premoženja prenešen v CSV" "R286 toast — LIVE"
need "[\"id\",\"Premiki\",\"Izvoženo\"]" "R286 CSV 3 dodatna stolpca glava — LIVE"
echo "--- R285 MANDATORY (LIVE — regresija) ---"
need "Izvozi terenski zapisni list kot CSV" "R285 gumb aria — LIVE"
need "fizicna_ref_mm" "R285 CSV fill-in stolpec — LIVE"
need "zapiski_terena" "R285 CSV zapiski stolpec — LIVE"
need "ZAPISNI LIST CSV = ista resnica v Excelu" "R285 legenda — LIVE"
echo "--- R284 MANDATORY (LIVE — regresija) ---"
need "TERENSKI ZAPISNI LIST" "R284 PDF naslov — LIVE"
need "Fizična ref. (mm)" "R284 fill-in stolpec — LIVE"
need "Terenska vrata (issue #14 §18)" "R284 protokolna sekcija — LIVE"
need "Izvozi terenski zapisni list kot PDF" "R284 gumb aria — LIVE"
echo "--- R283 MANDATORY (LIVE — regresija) ---"
need "Viri (viden seznam): " "R283 F3 vir mini-vrstica glava — LIVE"
need "Pokritost virov vidnega seznama (issue #15 §3)" "R283 vir mini hover title — LIVE"
need "Števec stanj vidnega seznama (WYSIWYG — R269)" "R283 R269 mini hover title — LIVE"
need "Osnutki — meritve v stanju OSNUTEK čakajo potrditev" "R283 R269 žeton title — LIVE"
echo "--- R282 (LIVE — regresija) ---"
need "Sync (viden seznam): " "R282 mini-vrstica glava — LIVE"
need "Konflikt — osveži bazo in ponovi sync" "R282 akcijski žig — LIVE"
need "Sinhronizacijsko stanje vidnega seznama (issue #16 §10)" "R282 mini hover title — LIVE"
echo "--- R281 sync metadata (issue #16 §10 — LIVE) ---"
need "Sinhronizacijsko stanje: Sinhronizirano" "R281 sync žig title SYNCED — LIVE"
need "Sinhronizacijsko stanje: V čakalni vrsti" "R281 sync žig title PENDING — LIVE"
need "Sinhronizacijsko stanje: Konflikt" "R281 sync žig title CONFLICT — LIVE"
need "Sinhronizacijsko stanje: Napaka" "R281 sync žig title ERROR — LIVE"
need "tombstone — grobnico potrdi /api/sync" "R281 tombstone note — LIVE"
need "Sync metadata (opazovano stanje klienta" "R281 TooltipContent — LIVE"
echo "INFO : R281 server matrika žigi ×3 — LOKALNA pokritost (r281-build-needles, isti commit) + žični dokaz Z3 v99 gate"
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
must_miss "TODO-R289" "R289 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R288" "R288 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R287" "R287 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R286" "R286 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R285" "R285 — brez razvojnih ostankov (izginil)"
must_miss "TODO-R284" "R284 — brez razvojnih ostankov (izginil)"
[ "$FAIL" = 0 ] || { echo "NEEDLEJI FAIL — abort"; exit 1; }
echo "Z2 OK — vsi needleji ŽIVO"

echo "=== Z3: v99 sync gate regresija (R274 gate še ŽIVO — ZERO-MUTACIJA) ==="
agent-browser eval "(()=>{window.__v99=null; window.__v99err=null; fetch('/api/sync',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify([{id:'r289-prod-v99-probe-'+Date.now(),customerName:'r289 probe v99',contractVersion:99}])}).then(r=>r.json()).then(d=>{window.__v99=d;}).catch(e=>{window.__v99err=String(e)}); return 'poslano';})()" 2>&1 | tail -1
eb_cakaj 3
agent-browser eval "JSON.stringify({odgovor:window.__v99??null, napaka:window.__v99err??null})" 2>&1 | tail -1 > /tmp/r289-z3.json
python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r289-z3.json').read().strip()
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

echo "=== R289 PROD QA — R288+R289 ŽIVO ==="
