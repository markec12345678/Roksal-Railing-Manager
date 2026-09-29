#!/bin/bash
# R272 prod QA — R271 deploy potrditev (R271 pushan v R271 rundi; žig že dolgo
# po commitu — pričakovano ŽIVO). 8 R271 needlejev (zapisnik-stanje PDF: pill
# aria + glava + F2 mini + fail-closed + FRESH fetch + legenda + sklep + vir)
# + PROD PUNCH ŠTEVEC — PRVI MERITEV (R271 handover: fingerprints ne merijo
# PunchItem na produ — vrednostno agnostično zabeležiti) + R270/R269/R268/
# R267/R266/R265/R264/R263/R262 regresije + MONTER + must_miss + temna.
# Samo bralni pogledi — ZERO-MUTACIJA. Spot=MONTER → Ekipa tab pokaže 403-truth.
# Pill zapisnika je projekt-gated — prod projekt izbran DINAMIČNO prek
# /api/projects (prvi id — bralni dostop, NIČ mutacij).
# AWK STRUKTURNA PREVERBA (r270 lekcija 2 + r271 nasledstvo): needleji v
# find-loopu / pred definicijo = 0/0.
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

# --- AWK strukturna preverba (r270 lekcija 2): needle-klici ZNOTRAJ while-loop
# telesa ALI PRED need()/must_miss() definicijo = lažno zeleno. Oba števca = 0. ---
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
curl -s --max-time 15 "$PROD/api/public/health"; echo

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z1: Dokumenti tab — prod projekt DINAMIČNO iz /api/projects (bralno) → R271 pill ŽIVO + legenda + mini (vrednostno agnostično — prod punch števec NEZNAN) ==="
eb_dispatch '{"tab":"more","more":"documents","subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
# dvokorakni eval (R268 lekcija 7): FRESH /api/projects → window.__projId
agent-browser eval "(()=>{window.__projId=null; window.__projErr=null; fetch('/api/projects',{credentials:'same-origin'}).then(r=>r.json()).then(d=>{window.__projId=(Array.isArray(d)&&d.length>0&&typeof d[0].id==='string')?d[0].id:null;}).catch(e=>{window.__projErr=String(e)}); return 'poslano';})()" 2>&1 | tail -1
eb_cakaj 3
agent-browser eval "(()=>{if(!window.__projId) return JSON.stringify({projId:null, napaka:window.__projErr??'prazen portfel'}); window.dispatchEvent(new CustomEvent('roksal:select-project',{detail:window.__projId})); return JSON.stringify({projId:window.__projId});})()" 2>&1 | tail -1 | tee /tmp/r272-proj.json
PROJ_OK=$(python3 -c "import json; d=json.load(open('/tmp/r272-proj.json')); d=json.loads(d) if isinstance(d,str) else d; print('DA' if d.get('projId') else 'NE')")
if [ "$PROJ_OK" = "DA" ]; then
  eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled stanja zapisnika kot PDF\"]');})()" 24
  sleep 2
  agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const t=document.body.textContent; const b=id('Izvozi pregled stanja zapisnika kot PDF'); const mini=[...document.querySelectorAll('span')].find(s=>s.textContent.indexOf('Zapisnik (viden seznam)')===0); const mMatch=t.match(/Zapisnik \(viden seznam\):[^·]*·[^·]*·[^·]*·[^·]*/); return JSON.stringify({r271Pill:!!b, r271PS:b?b.className.includes('press-scale'):false, r271AriaHidden:b?!!b.querySelector('svg[aria-hidden=\"true\"]'):false, r271Disabled:b?b.disabled:null, mini:mini?mini.textContent.trim().slice(0,140):null, miniRegex:mMatch?mMatch[0].slice(0,140):null, legenda271:t.includes('PDF = VSE točke zapisnika (tudi rešene — polna resnica, ne samo viden seznam)'), err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r272-z1.json
else
  echo "  (brez projektov na produ — pill projekt-gated, statični needleji v čankih)"
  echo '{"r271Pill":null,"mini":null,"legenda271":null}' > /tmp/r272-z1.json
fi

echo "=== Z1b: prod PUNCH ŠTEVEC — PRVI MERITEV (bralni GET /api/punch na izbranem projektu) ==="
if [ "$PROJ_OK" = "DA" ]; then
  agent-browser eval "(()=>{window.__punchN=null; window.__punchErr=null; fetch('/api/punch?projectId='+window.__projId,{credentials:'same-origin'}).then(r=>{if(!r.ok){window.__punchErr='HTTP '+r.status; return null;} return r.json();}).then(d=>{if(d) window.__punchN=Array.isArray(d)?d.length:null;}).catch(e=>{window.__punchErr=String(e)}); return 'poslano';})()" 2>&1 | tail -1
  eb_cakaj 3
  agent-browser eval "JSON.stringify({n:window.__punchN, napaka:window.__punchErr??null, statusi:(window.__punchN!==null)?null:null})" 2>&1 | tail -1 | tee /tmp/r272-z1b.json
  agent-browser eval "(()=>{if(window.__punchN===null) return JSON.stringify({statusi:null}); return JSON.stringify({statusi:window.__punchStatusi??null});})()" > /dev/null 2>&1
  # statusi podrobno (drugi fetch — bralno, EN endpoint)
  agent-browser eval "(()=>{window.__punchStat=null; fetch('/api/punch?projectId='+window.__projId,{credentials:'same-origin'}).then(r=>r.json()).then(d=>{if(Array.isArray(d)) window.__punchStat={skupaj:d.length, open:d.filter(x=>x.status==='open').length, done:d.filter(x=>x.status==='done').length, issue:d.filter(x=>x.status==='issue').length};}).catch(e=>{}); return 'poslano';})()" > /dev/null 2>&1
  eb_cakaj 3
  agent-browser eval "JSON.stringify({statusi:window.__punchStat??null})" 2>&1 | tail -1 | tee /tmp/r272-z1b-stat.json
else
  echo '  (brez projekta — števec ne merljiv)' > /tmp/r272-z1b.json
  echo '{"statusi":null}' > /tmp/r272-z1b-stat.json
fi

echo "=== Z2: čanki — R271 needleji (LIVE pričakovano) + regresije ==="
OUT=/tmp/r272-prod-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
eb_dispatch '{"tab":"more","more":"documents","subTab":null,"osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
sleep 3
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Oprema'); if(!b) return 'ni subtaba'; b.click(); return 'klik';})()" 2>&1 | tail -1
sleep 3
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
sleep 4
eb_dispatch '{"tab":"more","more":"teren","subTab":null,"osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"ekipa","subTab":null,"osnutek":null,"filter":null}'
sleep 3
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 | python3 -c "import sys,json
raw=sys.stdin.read().strip()
try:
  arr=json.loads(raw)
  if isinstance(arr,str): arr=json.loads(arr)
  print('\n'.join(arr))
except Exception:
  print('')" > "$OUT"/chunk-urls.txt
i=0
while read -r url; do
  [ -z "$url" ] && continue
  i=$((i+1))
  curl -s --max-time 20 "$url" -o "$OUT/chunk-$i.js"
done < "$OUT"/chunk-urls.txt
echo "  prenesenih: $(ls "$OUT"/chunk-*.js 2>/dev/null | wc -l)"
FAIL=0
need() {
  if grep -rqF -- "$1" "$OUT" 2>/dev/null; then echo "OK   : $2"; else echo "MISS : $2  (needle: $1)"; FAIL=1; fi
}
must_miss() {
  if grep -rqF -- "$1" "$OUT" 2>/dev/null; then echo "HIT  : $2"; FAIL=1; else echo "OK   : $2 (izginil)"; fi
}
echo "--- R271 zapisnik-stanje (LIVE dokaz) ---"
need "Izvozi pregled stanja zapisnika kot PDF" "R271 pill aria — LIVE"
need "ZAPISNIK — STANJE PRED PREDAJO" "R271 PDF glava — LIVE"
need "Zapisnik (viden seznam):" "R271 F2 mini-vrstica — LIVE"
need "Ni točk prejemnega zapisnika" "R271 fail-closed resnica — LIVE"
need "GET /api/punch → HTTP" "R271 FRESH fetch (minified-varen) — LIVE"
need "PDF = VSE točke zapisnika (tudi rešene — polna resnica, ne samo viden seznam)" "R271 legenda append — LIVE"
need "(referenčni pregled — VSE točke zapisnika, tudi rešene)" "R271 sklep resnica — LIVE"
need "vir = /api/punch?projectId (resnica dostopa do projekta" "R271 vir dostopa — LIVE"
echo "--- R270 inventura-pregled (LIVE ponovna potrditev) ---"
need "Izvozi inventurni pregled premoženja kot PDF" "R270 pill aria — LIVE"
need "INVENTURA — PREMOŽENJSKI PREGLED" "R270 PDF glava — LIVE"
need "Inventura (viden seznam):" "R270 F2 mini-vrstica — LIVE"
need "Ni vpisanih artiklov" "R270 fail-closed resnica — LIVE"
need "GET /api/inventory → HTTP" "R270 FRESH fetch — LIVE"
need "PDF = VSA zalogovna premoženja (tudi artikli brez premikov — polna resnica, ne samo viden seznam filtrov)" "R270 legenda append — LIVE"
need "(referenčni pregled — VSA zalogovna premoženja, tudi artikli brez premikov)" "R270 sklep resnica — LIVE"
need "vir = /api/inventory (resnica zaloge — FRESH ob kliku" "R270 vir resnica — LIVE"
echo "--- R269 meritve-teren (LIVE ponovna potrditev) ---"
need "Izvozi terenski pregled meritev kot PDF" "R269 pill aria — LIVE"
need "MERITVE — TERENSKI PREGLED" "R269 PDF glava — LIVE"
need "Meritve (viden seznam):" "R269 F2 mini-vrstica — LIVE"
need "Ni vpisanih meritev" "R269 fail-closed resnica — LIVE"
need "GET /api/measurements → HTTP" "R269 FRESH fetch — LIVE"
need "PDF = VSE meritve projekta (tudi arhivirane — polna resnica, ne samo viden seznam filtrov)" "R269 legenda append — LIVE"
need "(referenčni pregled — VSE meritve projekta, tudi arhivirane)" "R269 sklep resnica — LIVE"
need "vir = /api/measurements?projectId (resnica dostopa do projekta" "R269 vir dostopa — LIVE"
echo "--- R268 ekipa-stanje (LIVE ponovna potrditev) ---"
need "Izvozi pregled stanja ekipe kot PDF" "R268 pill aria — LIVE"
need "EKIPA — STANJE EKIPE" "R268 PDF glava — LIVE"
need "Ekipa (viden seznam):" "R268 F2 mini-vrstica — LIVE"
need "Ni vpisanih članov ekipe" "R268 fail-closed resnica — LIVE"
need "GET /api/users → HTTP" "R268 FRESH fetch — LIVE"
need "PDF = celotna ekipa (trenutna resnica ob kliku — FRESH /api/users, ne zastarel state)" "R268 legenda append — LIVE"
need "(referenčni pregled — celotna ekipa, tudi deaktivirani računi)" "R268 sklep resnica — LIVE"
need "vir = /api/users (resnica pravic users.read" "R268 vir pravic — LIVE"
echo "--- R267 ponudbe-spomniki (LIVE ponovna potrditev) ---"
need "Izvozi pregled spomnikov ponudb kot PDF" "R267 pill aria — LIVE"
need "PONUDBE — SPOMNIŠKI PREGLED" "R267 PDF glava — LIVE"
need "Spomniki (viden seznam):" "R267 F2 mini-vrstica — LIVE"
need "Ni vpisanih ponudb" "R267 fail-closed resnica — LIVE"
need "GET /api/projects → HTTP" "R267 FRESH fetch — LIVE"
need "PDF = VSE ponudbe (tudi podpisane — polna resnica, ne samo viden seznam)" "R267 legenda append — LIVE"
need "(referenčni pregled — VSE ponudbe, tudi podpisane)" "R267 sklep resnica — LIVE"
need "vir = /api/projects (resnica vloge" "R267 vir vloge — LIVE"
echo "--- R266 oprema-cikel (LIVE ponovna potrditev) ---"
need "Izvozi pregled življenjskega cikla opreme kot PDF" "R266 pill aria — LIVE"
need "OPREMA — ŽIVLJENJSKI CIKL" "R266 PDF glava — LIVE"
need "Cikl (viden seznam):" "R266 F2 mini-vrstica — LIVE"
need "Ni vpisane opreme" "R266 fail-closed resnica — LIVE"
need "GET /api/equipment → HTTP" "R266 FRESH fetch — LIVE"
need "PDF = življenjski cikl VSE opreme" "R266 legenda append — LIVE"
need "(referenčni pregled — VSA oprema)" "R266 sklep resnica — LIVE"
need "nad mejo paginacije vira (MAX_OFFSET)" "R266 paginacijski guard — LIVE"
echo "--- R265/R264/R263/R262/R261 + starejše regresije ---"
need "Izvozi pregled projektov in terminov kot PDF" "R265 pill aria — LIVE"
need "PROJEKTI — TERMINI PREGLED" "R265 PDF glava — LIVE"
need "Ni vpisanih terminov" "R265 fail-closed resnica — LIVE"
need "GET /api/schedules → HTTP" "R265 FRESH fetch — LIVE"
need "Izvozi pozicijo dobaviteljev kot PDF" "R264 pill aria — LIVE"
need "DOBAVITELJI — POZICIJA CEN" "R264 PDF glava — LIVE"
need "Brez alternative" "R264 KPI/sklep resnica — LIVE"
need "Izvozi pokritost opomnikov kot PDF" "R263 pill aria — LIVE"
need "STRANKE — OPOMNIŠKA POKRITOST" "R263 PDF glava — LIVE"
need "Pokritost opomnikov:" "R263 F2 mini-vrstica — LIVE"
need "Izvozi pokritost zaloge in osnutkov kot PDF" "R262 pill aria — LIVE"
need "ZALOGA — OSNUTEK POKRITOST" "R262 PDF glava — LIVE"
need "Izvozi račune po projektih kot PDF" "R261 pill aria"
need "RAČUNI PO PROJEKTIH" "R261 PDF glava"
need "\"Najhitrejši rok\",\"Največji popust\"" "R260 CSV glava (minified)"
need "children:\"najhitrejši rok\"" "R260 žig najhitrejši rok"
need "Povprečni rok" "R259 KPI 4 label"
need "Izvozi dobičkonosnost projektov kot PDF" "R258 pill aria"
need "DOBIČKONOST PO PROJEKTIH" "R258 PDF glava"
need "Izvozi naročila kot PDF" "R257 pill aria"
need "NAROČILA — PREGLED" "R257 PDF glava"
need "Izvozi tedenski pregled montaž kot PDF" "R256 pill aria"
need "TEDENSKI VOZNI RED MONTAŽ" "R256 PDF glava"
need "Izvozi vozni red montaž kot PDF" "R255 pill aria"
need "VOZNI RED MONTAŽ" "R255 PDF glava"
need "Ni vidnih terminov montaže" "R255 fail-closed toast"
need "to-roksal-navy-soft" "R255 navy-soft žeton"
need "Izvozi koledar pregledov kot PDF" "R253 pill aria"
need "Izvozi potekle opomnike kot PDF" "R252 bulk pill aria"
need "Izvozi prihodke kot PDF" "R250 pill aria"
need "Moja vloga in dovoljenja" "R240 meni + dialog"
need "CENIK MATERIALA" "R244 PDF glava"
need "Brez dobavitelja (" "R227 žig aria"
need "Izvozi vidno zalogo kot PDF" "R234 zaloga PDF pill (regresija)"
must_miss "to-[#2a3f5f]" "must_miss to-[#2a3f5f]"
must_miss "accent-[#f59e0b]" "must_miss accent-[#f59e0b]"
must_miss "bg-[#f7f9ff]" "must_miss bg-[#f7f9ff]"
echo "NEEDLE FAIL=$FAIL (R271 ×8 pričakovano LIVE; vse ostalo OK)"

echo "=== Z3: MONTER 11/28 (regresija) ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{const t=document.querySelector('button[aria-label=\"Odjava\"]'); if(!t) return 'ni trigra'; const r=t.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; t.dispatchEvent(new PointerEvent('pointerdown',o)); t.dispatchEvent(new PointerEvent('pointerup',o)); t.dispatchEvent(new MouseEvent('click',o)); return 'meni poslan';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('[role=\"menuitem\"]')].some(x=>x.textContent.includes('Moja vloga in dovoljenja'));})()" 10
agent-browser eval "(()=>{const mi=[...document.querySelectorAll('[role=\"menuitem\"]')].find(x=>x.textContent.includes('Moja vloga in dovoljenja')); if(!mi) return 'ni menuitema'; const opt={bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true,buttons:1,button:0}; mi.dispatchEvent(new PointerEvent('pointermove',opt)); mi.dispatchEvent(new PointerEvent('pointerdown',opt)); mi.dispatchEvent(new PointerEvent('pointerup',opt)); mi.dispatchEvent(new MouseEvent('click',opt)); return 'kliknjeno';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{const d=document.body.textContent; return d.includes('Moja vloga in dovoljenja') && d.includes('od 28 dovoljenj');})()" 14
sleep 1
agent-browser eval "(()=>{const dialog=document.querySelector('[role=\"dialog\"]'); if(!dialog) return JSON.stringify({dialog:false}); const povzetek=dialog.textContent.match(/Imate (\\d+) od (\\d+) dovoljenj/); return JSON.stringify({dialog:true, povzetek:povzetek?[povzetek[1],povzetek[2]]:null, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
eb_cakaj 1

echo "=== Z4: temna + err null ==="
eb_dispatch '{"tab":"more","more":"documents","subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1

echo "=== ZAKLJUČEK: brskalnik zaprt ==="
agent-browser close --all > /dev/null 2>&1
echo "=== R272 PROD QA KONEC ==="
