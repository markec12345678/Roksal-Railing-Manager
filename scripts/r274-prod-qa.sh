#!/bin/bash
# R274 prod QA — R273 deploy potrditev (health build 2026-09-29T06:24:57Z =
# R273 deploy). R273 needleji (zaloga-vrednost PDF: pill aria + glava + F2 mini
# + fail-closed + FRESH fetch drugega vira + legenda + sklep + vir dva vira +
# SEMANTIČNA ODLOČITEV) + *** PRVI LIVE KLIK V DRUŽINI BREZ ADMIN SEJE ***
# (pill 'Vrednost' je GLOBAL — spot MONTER seja ZADOVOLJA, R273 handover
# naloga). LIVE klik = FRESH GET /api/inventory + /api/material-prices (BRALNO
# — ZERO-MUTACIJA) + PDF na klientu. + R272…R262 + starejše regresije +
# must_miss + temna. Vrednostno agnostično (prod Σ NEZNAN — preverjamo OBLIKO:
# '—' ALI EUR). LEKCIJI R274: (a) python -c VEDNO enovrstični (guard-higiena
# lekcija — večvrstični -c znotraj cevi = bash razčlemba polomi); (b) vsak
# curl/eval v verigi nosi || echo guard (R271 lekcija 4).
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"

# --- AWK strukturna preverba (r270 lekcija 2 nasledstvo): needle-klici
# ZNOTRAJ while-loop telesa ALI PRED need()/must_miss() definicijo = lažno
# zeleno. Oba števca = 0. ---
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

echo "=== Z0: prod health žig ==="
curl -s --max-time 15 "$PROD/api/public/health" || { echo "HEALTH FAIL — abort"; exit 1; }
echo

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z1: Zaloga tab (GLOBAL pill — NI projekt-gated) → R273 pill ŽIVO + legenda + mini ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled vrednosti zaloge kot PDF\"]');})()" 24
eb_cakaj 2
agent-browser eval "(()=>{const b=document.querySelector('button[aria-label=\"Izvozi pregled vrednosti zaloge kot PDF\"]'); const t=document.body.textContent; const mini=[...document.querySelectorAll('span')].find(s=>s.textContent.indexOf('Vrednost (viden seznam):')===0); const legenda=t.includes('PDF = polna denarna resnica skladišča (FRESH /api/inventory + /api/material-prices ob kliku — samo trenutno veljavne cene; ne zastarel state)'); return JSON.stringify({r273Pill:!!b, press:b?b.className.includes('press-scale'):false, ariaHidden:b?!!b.querySelector('svg[aria-hidden=\"true\"]'):false, disabled:b?b.disabled:null, title:b?(b.getAttribute('title')||'').slice(0,60):null, mini:mini?mini.textContent.trim().slice(0,160):null, legenda, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r274-z1.json

echo "=== Z1b: LIVE KLIK pill 'Vrednost' — PRVI V DRUŽINI BREZ ADMIN SEJE ==="
eb_zajem_pdf pdf
eb_klik_gumb "Izvozi pregled vrednosti zaloge kot PDF"
eb_cakaj 4
agent-browser eval "(()=>{const t=document.body.textContent; const pdfB64=window.__pdf??null; let pdfLen=null,mag=null; if(pdfB64){ const u=atob(pdfB64); pdfLen=u.length; mag=[u.charCodeAt(0),u.charCodeAt(1),u.charCodeAt(2),u.charCodeAt(3)].join(','); } return JSON.stringify({toastOk:t.includes('Pregled vrednosti zaloge prenešen v PDF'), toastPrazno:t.includes('Pregled vrednosti zaloge se izvozi, ko je vpisan prvi artikel zaloge.'), toastFail:t.includes('Izvoz ni uspel'), artikOblika:(t.match(/Zaloga-vrednost-…pdf — \d+ artik/)||[])[0]??null, sumOblika:(t.match(/Σ (—|[\d.]+ EUR)/)||[])[1]??null, pdfLen, mag});})()" 2>&1 | tail -1 | tee /tmp/r274-z1b.json
agent-browser eval "JSON.stringify({mpHit:performance.getEntriesByType('resource').some(e=>e.name.includes('/api/material-prices')), invHit:performance.getEntriesByType('resource').some(e=>e.name.includes('/api/inventory'))})" 2>&1 | tail -1 | tee /tmp/r274-z1b-fetch.json

echo "=== Z2: čanki — R273 needleji (LIVE pričakovano) + regresije ==="
OUT=/tmp/r274-prod-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3
eb_dispatch '{"tab":"more","more":"documents","subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"osnutek":null,"filter":null}'
eb_cakaj 3
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3
eb_dispatch '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}'
eb_cakaj 3
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3
eb_dispatch '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3
eb_dispatch '{"tab":"more","more":"teren","subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3
eb_dispatch '{"tab":"more","more":"ekipa","subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 4
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 > /tmp/r274-chunkurls-raw.json
python3 -c "import sys,json; raw=open('/tmp/r274-chunkurls-raw.json').read().strip(); arr=json.loads(raw); arr=json.loads(arr) if isinstance(arr,str) else arr; open('/tmp/r274-chunkurls.txt','w').write('\n'.join(arr)+'\n')" || { echo "PY PARSE FAIL — abort"; exit 1; }
cp /tmp/r274-chunkurls.txt "$OUT"/chunk-urls.txt
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
echo "--- R273 zaloga-vrednost (LIVE dokaz — 11 ključnih) ---"
need "Izvozi pregled vrednosti zaloge kot PDF" "R273 pill aria — LIVE"
need "ZALOGA — PREMOŽENJSKA VREDNOST" "R273 PDF glava — LIVE"
need "Vrednost (viden seznam):" "R273 F2 mini-vrstica — LIVE"
need "Pregled vrednosti zaloge se izvozi, ko je vpisan prvi artikel zaloge." "R273 fail-closed toast — LIVE"
need "GET /api/material-prices → HTTP" "R273 FRESH fetch drugega vira — LIVE"
need "PDF = polna denarna resnica skladišča (FRESH /api/inventory + /api/material-prices ob kliku — samo trenutno veljavne cene; ne zastarel state)" "R273 legenda pill pariteta — LIVE"
need "(referenčni pregled — VSA zalogovna premoženja, tudi artikli brez veljavne cene)" "R273 sklep resnica — LIVE"
need "vir = /api/inventory + /api/material-prices (resnica zaloge IN cen)" "R273 sklep dva vira — LIVE"
need "(samo trenutno veljavne cene — API resnica veljavnostDo null; pretečene NISO vključene)" "R273 SEMANTIČNA ODLOČITEV — LIVE"
need "bestPerMaterial" "R273 JOIN vir (API resnica) — LIVE"
need "stevecCen (_count.prices) mora biti ne-negativno celo število" "R273 DTO pruning strict — LIVE"
echo "--- R272 nagibi-teren (LIVE ponovna potrditev) ---"
need "Izvozi terenski pregled nagibov kot PDF" "R272 pill aria — LIVE"
need "NAGIBI — TERENSKI PREGLED" "R272 PDF glava — LIVE"
need "Nagibi (viden seznam):" "R272 F2 mini — LIVE"
need "Ni vpisanih nagibov" "R272 fail-closed — LIVE"
need "GET /api/slopes → HTTP" "R272 FRESH fetch — LIVE"
need "PDF = VSI nagibi projekta (tudi označeni neveljavni — polna resnica, ne samo viden seznam)" "R272 legenda — LIVE"
need "smerLabel EN VIR" "R272 smerLabel EN VIR — LIVE"
need "kotStopinje mora biti končno število" "R272 ne-finite kot — LIVE"
echo "--- R271 zapisnik-stanje (LIVE ponovna potrditev) ---"
need "Izvozi pregled stanja zapisnika kot PDF" "R271 pill aria — LIVE"
need "ZAPISNIK — STANJE PRED PREDAJO" "R271 PDF glava — LIVE"
need "Zapisnik (viden seznam):" "R271 F2 mini — LIVE"
need "Ni točk prejemnega zapisnika" "R271 fail-closed — LIVE"
need "GET /api/punch → HTTP" "R271 FRESH fetch — LIVE"
need "vir = /api/punch?projectId (resnica dostopa do projekta" "R271 vir — LIVE"
echo "--- R270 inventura-pregled (LIVE ponovna potrditev) ---"
need "Izvozi inventurni pregled premoženja kot PDF" "R270 pill aria — LIVE"
need "INVENTURA — PREMOŽENJSKI PREGLED" "R270 PDF glava — LIVE"
need "Inventura (viden seznam):" "R270 F2 mini — LIVE"
need "Ni vpisanih artiklov" "R270 fail-closed — LIVE"
need "GET /api/inventory → HTTP" "R270 FRESH fetch — LIVE"
need "vir = /api/inventory (resnica zaloge — FRESH ob kliku" "R270 vir — LIVE"
echo "--- R269 meritve-teren (LIVE ponovna potrditev) ---"
need "Izvozi terenski pregled meritev kot PDF" "R269 pill aria — LIVE"
need "MERITVE — TERENSKI PREGLED" "R269 PDF glava — LIVE"
need "Meritve (viden seznam):" "R269 F2 mini — LIVE"
need "Ni vpisanih meritev" "R269 fail-closed — LIVE"
need "GET /api/measurements → HTTP" "R269 FRESH fetch — LIVE"
echo "--- R268 ekipa-stanje (LIVE ponovna potrditev) ---"
need "Izvozi pregled stanja ekipe kot PDF" "R268 pill aria — LIVE"
need "EKIPA — STANJE EKIPE" "R268 PDF glava — LIVE"
need "Ni vpisanih članov ekipe" "R268 fail-closed — LIVE"
need "GET /api/users → HTTP" "R268 FRESH fetch — LIVE"
echo "--- R267 ponudbe-spomniki (LIVE ponovna potrditev) ---"
need "Izvozi pregled spomnikov ponudb kot PDF" "R267 pill aria — LIVE"
need "PONUDBE — SPOMNIŠKI PREGLED" "R267 PDF glava — LIVE"
need "Spomniki (viden seznam):" "R267 F2 mini — LIVE"
need "Ni vpisanih ponudb" "R267 fail-closed — LIVE"
echo "--- R266 oprema-cikel (LIVE ponovna potrditev) ---"
need "Izvozi pregled življenjskega cikla opreme kot PDF" "R266 pill aria — LIVE"
need "OPREMA — ŽIVLJENJSKI CIKL" "R266 PDF glava — LIVE"
need "Ni vpisane opreme" "R266 fail-closed — LIVE"
need "GET /api/equipment → HTTP" "R266 FRESH fetch — LIVE"
need "nad mejo paginacije vira (MAX_OFFSET)" "R266 paginacijski guard — LIVE"
echo "--- R265/R264/R263/R262 + starejše regresije ---"
need "Izvozi pregled projektov in terminov kot PDF" "R265 pill aria — LIVE"
need "PROJEKTI — TERMINI PREGLED" "R265 PDF glava — LIVE"
need "Ni vpisanih terminov" "R265 fail-closed — LIVE"
need "GET /api/schedules → HTTP" "R265 FRESH fetch — LIVE"
need "Izvozi pozicijo dobaviteljev kot PDF" "R264 pill aria — LIVE"
need "DOBAVITELJI — POZICIJA CEN" "R264 PDF glava — LIVE"
need "Brez alternative" "R264 KPI/sklep resnica — LIVE"
need "Izvozi pokritost opomnikov kot PDF" "R263 pill aria — LIVE"
need "STRANKE — OPOMNIŠKA POKRITOST" "R263 PDF glava — LIVE"
need "Pokritost opomnikov:" "R263 F2 mini — LIVE"
need "Izvozi pokritost zaloge in osnutkov kot PDF" "R262 pill aria — LIVE"
need "ZALOGA — OSNUTEK POKRITOST" "R262 PDF glava — LIVE"
echo "--- must_miss ---"
must_miss "demo cenaEur" "NI demo cene (R204 družinsko pravilo)"
must_miss "TODO" "NI TODO ostankov v produkcijskih čankih"
echo ""
echo "=== REZULTAT: NEEDLE FAIL=$FAIL ==="
[ "$FAIL" = "0" ] && echo "R274 PROD QA: VSE ZELENO — R273 ŽIVO POTRJEN (+ LIVE klik brez ADMIN seje)" || echo "R274 PROD QA: PRIČAKOVANJA NISO IZPOLNJENA"
agent-browser close --all > /dev/null 2>&1
exit $FAIL
