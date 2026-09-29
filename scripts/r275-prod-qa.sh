#!/bin/bash
# R275 prod QA — R274 deploy potrditev (health build 2026-09-29T07:23:52Z =
# R274 deploy — pushan ~07:21 UTC, deploy ~2.5 min). R274 prod dokazi:
#   (1) v99 SYNC GATE PROBE — varna ZERO-MUTACIJA (zavrnitev nič ne zapiše):
#       POST /api/sync z spot sejo, item {id, contractVersion:99} → per-item
#       {ok:false, action:'error', retryable:false, error žična koda
#       'Nepodprta pogodbena verzija 99 — strežnik podpira 1. noben zapis ni
#       bil uporabljen.'}. ⚠️ VARNOST: probe DOVOLJEN SAMO ob potrjenem R274
#       deployu (R273 bi item STRIPAL in USTVARIL projekt — zato health build
#       preverba PRVA!).
#   (2) role="status" a11y sweep LIVE — div[role="status"] na obeh mini
#       (Vrednost + Inventura) + RED doti (prod inv 8 brez cen — R274 žig).
#   (3) GET /api/sync bralno zrcalo (MONTER skoping — 200 + Array).
#   (4) regresije: R273/R272/R271/R270/R269/R268/R267/R266/R265/R264/R263/R262
#       + must_miss. Kontrakt žične kode (ARCORE_DEPTH/…) = SERVER chunks —
#       v CLIENT čankih NI (r275 lekcija) → gate dokaz na produ = v99 probe;
#       /api/measurements gate NI dosegljiv (spot MONTER prazen portfel → 404
#       pred gate-om — fail-closed po zasnovi; dokaz ostaja vitest + needleji).
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

echo "=== Z0: prod health žig — R274 deploy detekcija (VARNOST v99 probe) ==="
curl -s --max-time 15 "$PROD/api/public/health" || { echo "HEALTH FAIL — abort"; exit 1; }
echo
BUILD=$(curl -s --max-time 15 "$PROD/api/public/health" | python3 -c "import json,sys; print(json.load(sys.stdin).get('build',''))" || true)
case "$BUILD" in
  2026-09-29T06:24:57*|2026-09-2[0-9]T0[0-5]*)
    echo "R274 NI ŠE DEPLOYAN (build $BUILD) — v99 probe PREPOVEDAN (R273 bi stripal contractVersion in USTVARIL projekt!)"; exit 1;;
  *)
    echo "R274 deploy potrjen (build $BUILD) — v99 probe DOVOLJEN";;
esac

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z1: Zaloga tab — role=\"status\" LIVE (a11y sweep) + pill + legenda + mini (vrednostno agnostično) ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled vrednosti zaloge kot PDF\"]');})()" 24
eb_pocakaj_na "(()=>{const s=[...document.querySelectorAll('span')].find(x=>x.textContent.indexOf('Vrednost (viden seznam):')===0); return !!s;})()" 24
eb_cakaj 2
agent-browser eval "(()=>{const vredKont=[...document.querySelectorAll('div[role=\"status\"]')].find(d=>{const s=d.querySelector('span.tabular-nums'); return s&&s.textContent.indexOf('Vrednost (viden seznam)')===0;}); const invKont=[...document.querySelectorAll('div[role=\"status\"]')].find(d=>{const s=d.querySelector('span.tabular-nums'); return s&&s.textContent.indexOf('Inventura (viden seznam)')===0;}); const mini=[...document.querySelectorAll('span')].find(s=>s.textContent.indexOf('Vrednost (viden seznam):')===0); const t=document.body.textContent; return JSON.stringify({vredRole:!!vredKont, invRole:!!invKont, vredDotRed:vredKont?!!vredKont.querySelector('span[aria-hidden].bg-roksal-red'):false, invDotRed:invKont?!!invKont.querySelector('span[aria-hidden].bg-roksal-red'):false, miniTekst:mini?mini.textContent.trim().slice(0,120):null, legenda:t.includes('PDF = polna denarna resnica skladišča (FRESH /api/inventory + /api/material-prices ob kliku — samo trenutno veljavne cene; ne zastarel state)'), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r275-z1.json
python3 -c "import json; r=json.load(open('/tmp/r275-z1.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['vredRole'] and d['invRole'], 'Z1 role=status FAIL: '+json.dumps(d); assert d['vredDotRed'] and d['invDotRed'], 'Z1 dot FAIL (prod inv 8 brez cen → RED obeh): '+json.dumps(d); assert d['legenda'], 'Z1 legenda FAIL: '+json.dumps(d); assert d['miniTekst'] and d['miniTekst'].startswith('Vrednost (viden seznam): '), 'Z1 mini FAIL: '+json.dumps(d); print('Z1 OK — role=status LIVE na obeh mini + RED doti + legenda')" || exit 1

echo "=== Z1b: v99 SYNC GATE PROBE (ZERO-MUTACIJA — zavrnitev nič ne zapiše) ==="
agent-browser eval "(()=>{window.__v99=null; window.__v99err=null; fetch('/api/sync',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify([{id:'r274-prod-v99-probe-'+Date.now(),customerName:'r275 probe v99',contractVersion:99}])}).then(r=>r.json()).then(d=>{window.__v99=d;}).catch(e=>{window.__v99err=String(e)}); return 'poslano';})()" 2>&1 | tail -1
eb_cakaj 3
agent-browser eval "JSON.stringify({v99:window.__v99, napaka:window.__v99err??null})" 2>&1 | tail -1 > /tmp/r275-z1b-raw.json
python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r275-z1b-raw.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['napaka'] is None, 'v99 probe mrežna napaka: ' + json.dumps(d)
r0 = d['v99']['results'][0]
assert r0['ok'] is False, 'v99: ok mora biti false: ' + json.dumps(r0)
assert r0['action'] == 'error', 'v99: action mora biti error: ' + json.dumps(r0)
assert r0['retryable'] is False, 'v99: retryable mora biti false: ' + json.dumps(r0)
assert 'Nepodprta pogodbena verzija 99' in r0['error'], 'v99 žična koda FAIL: ' + json.dumps(r0)
assert 'strežnik podpira 1' in r0['error'], 'v99 podprta verzija FAIL: ' + json.dumps(r0)
assert 'noben zapis ni bil uporabljen' in r0['error'], 'v99 fail-closed sporočilo FAIL: ' + json.dumps(r0)
print('Z1b OK — R274 sync gate ŽIVO na produ: v99 per-item zavrnitev (fail-closed, nič zapisano): ' + r0['error'][:80] + '…')
PYEOF

echo "=== Z1c: GET /api/sync bralno zrcalo (MONTER skoping — 200 + Array, vrednostno agnostično) ==="
agent-browser eval "(()=>{window.__zrcalo=null; window.__zrcaloStatus=null; fetch('/api/sync',{credentials:'same-origin'}).then(r=>{window.__zrcaloStatus=r.status; return r.json();}).then(d=>{window.__zrcalo=d;}).catch(e=>{window.__zrcaloerr=String(e)}); return 'poslano';})()" 2>&1 | tail -1
eb_cakaj 3
agent-browser eval "JSON.stringify({status:window.__zrcaloStatus, projekti:Array.isArray(window.__zrcalo?.projects)?window.__zrcalo.projects.length:null, imaCursor:typeof window.__zrcalo?.nextCursor==='number', napaka:window.__zrcaloerr??null})" 2>&1 | tail -1 | tee /tmp/r275-z1c.json
python3 -c "import json; r=json.load(open('/tmp/r275-z1c.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['status']==200, 'Z1c FAIL: '+json.dumps(d); assert isinstance(d['projekti'],int), 'Z1c projects ni Array: '+json.dumps(d); assert d['imaCursor'], 'Z1c nextCursor FAIL: '+json.dumps(d); print('Z1c OK — GET /api/sync 200 + projects Array + nextCursor (delta kurzor ŽIVO)')" || exit 1

echo "=== Z2: čanki — klient regresije (R273 ×11 + družina + role=status + must_miss) ==="
OUT=/tmp/r275-prod-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
for d in '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"documents","subTab":null,"osnutek":null,"filter":null}' '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}' '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}' '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}' '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"teren","subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"ekipa","subTab":null,"osnutek":null,"filter":null}'; do
  eb_dispatch "$d"
  eb_cakaj 3
done
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 > /tmp/r275-chunkurls-raw.json
python3 -c "import json; raw=open('/tmp/r275-chunkurls-raw.json').read().strip(); arr=json.loads(raw); arr=json.loads(arr) if isinstance(arr,str) else arr; open('/tmp/r275-chunkurls.txt','w').write('\n'.join(arr)+'\n')" || { echo "PY PARSE FAIL — abort"; exit 1; }
cp /tmp/r275-chunkurls.txt "$OUT"/chunk-urls.txt
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
echo "--- R274 a11y sweep (klient) ---"
need "role:\"status\"" "R274 role=status atribut v čankih — LIVE"
echo "--- R273 zaloga-vrednost (LIVE regresija) ---"
need "Izvozi pregled vrednosti zaloge kot PDF" "R273 pill aria — LIVE"
need "ZALOGA — PREMOŽENJSKA VREDNOST" "R273 PDF glava — LIVE"
need "Vrednost (viden seznam):" "R273 F2 mini-vrstica — LIVE"
need "Pregled vrednosti zaloge se izvozi, ko je vpisan prvi artikel zaloge." "R273 fail-closed toast — LIVE"
need "GET /api/material-prices → HTTP" "R273 FRESH fetch drugega vira — LIVE"
need "PDF = polna denarna resnica skladišča (FRESH /api/inventory + /api/material-prices ob kliku — samo trenutno veljavne cene; ne zastarel state)" "R273 legenda — LIVE"
need "(referenčni pregled — VSA zalogovna premoženja, tudi artikli brez veljavne cene)" "R273 sklep resnica — LIVE"
need "vir = /api/inventory + /api/material-prices (resnica zaloge IN cen)" "R273 vir dva vira — LIVE"
echo "--- R272 nagibi-teren (LIVE regresija) ---"
need "Izvozi terenski pregled nagibov kot PDF" "R272 pill aria — LIVE"
need "NAGIBI — TERENSKI PREGLED" "R272 PDF glava — LIVE"
need "Nagibi (viden seznam):" "R272 F2 mini — LIVE"
need "Ni vpisanih nagibov" "R272 fail-closed — LIVE"
need "smerLabel EN VIR" "R272 smerLabel EN VIR — LIVE"
echo "--- R271 zapisnik-stanje (LIVE regresija) ---"
need "Izvozi pregled stanja zapisnika kot PDF" "R271 pill aria — LIVE"
need "ZAPISNIK — STANJE PRED PREDAJO" "R271 PDF glava — LIVE"
need "Ni točk prejemnega zapisnika" "R271 fail-closed — LIVE"
echo "--- R270 inventura-pregled (LIVE regresija) ---"
need "Izvozi inventurni pregled premoženja kot PDF" "R270 pill aria — LIVE"
need "INVENTURA — PREMOŽENJSKI PREGLED" "R270 PDF glava — LIVE"
need "Inventura (viden seznam):" "R270 F2 mini — LIVE"
need "Ni vpisanih artiklov" "R270 fail-closed — LIVE"
echo "--- R269/R268/R267/R266 (LIVE regresija) ---"
need "Izvozi terenski pregled meritev kot PDF" "R269 pill aria — LIVE"
need "MERITVE — TERENSKI PREGLED" "R269 PDF glava — LIVE"
need "Meritve (viden seznam):" "R269 F2 mini — LIVE"
need "Izvozi pregled stanja ekipe kot PDF" "R268 pill aria — LIVE"
need "EKIPA — STANJE EKIPE" "R268 PDF glava — LIVE"
need "Izvozi pregled spomnikov ponudb kot PDF" "R267 pill aria — LIVE"
need "PONUDBE — SPOMNIŠKI PREGLED" "R267 PDF glava — LIVE"
need "Izvozi pregled življenjskega cikla opreme kot PDF" "R266 pill aria — LIVE"
need "OPREMA — ŽIVLJENJSKI CIKL" "R266 PDF glava — LIVE"
need "nad mejo paginacije vira (MAX_OFFSET)" "R266 paginacijski guard — LIVE"
echo "--- R265/R264/R263/R262 + must_miss ---"
need "Izvozi pregled projektov in terminov kot PDF" "R265 pill aria — LIVE"
need "PROJEKTI — TERMINI PREGLED" "R265 PDF glava — LIVE"
need "Izvozi pozicijo dobaviteljev kot PDF" "R264 pill aria — LIVE"
need "DOBAVITELJI — POZICIJA CEN" "R264 PDF glava — LIVE"
need "Izvozi pokritost opomnikov kot PDF" "R263 pill aria — LIVE"
need "STRANKE — OPOMNIŠKA POKRITOST" "R263 PDF glava — LIVE"
need "Pokritost opomnikov:" "R263 F2 mini — LIVE"
need "Izvozi pokritost zaloge in osnutkov kot PDF" "R262 pill aria — LIVE"
need "ZALOGA — OSNUTEK POKRITOST" "R262 PDF glava — LIVE"
must_miss "demo cenaEur" "NI demo cene (R204)"
must_miss "TODO" "NI TODO ostankov"
echo ""
echo "=== REZULTAT: NEEDLE FAIL=$FAIL ==="
[ "$FAIL" = "0" ] && echo "R275 PROD QA: VSE ZELENO — R274 ŽIVO (sync gate probe + role=status + regresije)" || echo "R275 PROD QA: PRIČAKOVANJA NISO IZPOLNJENA"
agent-browser close --all > /dev/null 2>&1
exit $FAIL
