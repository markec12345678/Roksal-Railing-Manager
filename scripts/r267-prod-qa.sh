#!/bin/bash
# R267 prod QA — R266 deploy potrditev (R266 push 00:26:43Z, ta runda ~00:31Z —
# zdravstveni žig pričakovano ŽIVO (zgodovinska hitrost 22 s–2.5 min); če žig <
# commit, nova eskalacija). R265/R264/R263/R262/R261 regresije + MONTER + aria
# + must_miss. Samo bralni pogledi — ZERO-MUTACIJA.
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

echo "=== Z0: prod health žig (R266 push 00:26:43Z — okno 22 s–40 min) ==="
curl -s --max-time 15 "$PROD/api/public/health"; echo

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z1: logistics → OPREMA subtab — R266 pill ŽIVO (pričakovano LIVE) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled projektov in terminov kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Oprema'); if(!b) return 'ni subtaba'; b.click(); return 'klik';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi pregled življenjskega cikla opreme kot PDF\"]');})()" 14
sleep 2
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const t=document.body.textContent; const vseSvg=[...document.querySelectorAll('svg.lucide')]; const zAria=vseSvg.filter(s=>s.getAttribute('aria-hidden')==='true').length; const oc=id('Izvozi pregled življenjskega cikla opreme kot PDF'); return JSON.stringify({r266Pill:!!oc, r266PS:oc?oc.className.includes('press-scale'):false, r266AriaHidden:oc?!!oc.querySelector('svg[aria-hidden=\"true\"]'):false, r266Disabled:oc?oc.disabled:null, r266Title:oc?oc.getAttribute('title'):null, legenda266:t.includes('PDF = življenjski cikl VSE opreme (pregledi · kalibracije · statusi — polna resnica, ne samo viden seznam)'), r265Pill:!!id('Izvozi pregled projektov in terminov kot PDF'), ariaR254:{lucide:vseSvg.length, zAria, vsePokrite:vseSvg.length===zAria}, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z2: MONTER 11/28 ==="
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

echo "=== Z3: prod čanki — R266 needleji (LIVE pričakovano) + regresije ==="
OUT=/tmp/r267-prod-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
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
echo "--- R266 oprema-cikel (LIVE dokaz) ---"
need "Izvozi pregled življenjskega cikla opreme kot PDF" "R266 pill aria — LIVE"
need "OPREMA — ŽIVLJENJSKI CIKL" "R266 PDF glava — LIVE"
need "Cikl (viden seznam):" "R266 F2 mini-vrstica — LIVE"
need "Ni vpisane opreme" "R266 fail-closed resnica — LIVE"
need "GET /api/equipment → HTTP" "R266 FRESH fetch (minified-varen) — LIVE"
need "PDF = življenjski cikl VSE opreme" "R266 legenda append — LIVE"
need "(referenčni pregled — VSA oprema)" "R266 sklep resnica — LIVE"
need "nad mejo paginacije vira (MAX_OFFSET)" "R266 paginacijski guard — LIVE"
echo "--- R265 projekti-termini (LIVE ponovna potrditev) ---"
need "Izvozi pregled projektov in terminov kot PDF" "R265 pill aria — LIVE"
need "PROJEKTI — TERMINI PREGLED" "R265 PDF glava — LIVE"
need "· Projekti = projekti × termini (pokritost po projektih)" "R265 legenda append — LIVE"
need "Ni vpisanih terminov" "R265 fail-closed resnica — LIVE"
need "od tega s planirano montažo" "R265 sklep resnica — LIVE"
need "GET /api/schedules → HTTP" "R265 FRESH fetch (minified-varen) — LIVE"
echo "--- R264 pozicija dobaviteljev (LIVE ponovna potrditev) ---"
need "Izvozi pozicijo dobaviteljev kot PDF" "R264 pill aria — LIVE"
need "DOBAVITELJI — POZICIJA CEN" "R264 PDF glava — LIVE"
need "· Pozicija = dobavitelji × najnižja per artikel · Brez alternative = samo ena ponudba" "R264 legenda append — LIVE"
need "Brez alternative" "R264 KPI/sklep resnica — LIVE"
echo "--- R263 stranke-pokritost (LIVE ponovna potrditev) ---"
need "Izvozi pokritost opomnikov kot PDF" "R263 pill aria — LIVE"
need "STRANKE — OPOMNIŠKA POKRITOST" "R263 PDF glava — LIVE"
need "Pokritost opomnikov:" "R263 F2 mini-vrstica — LIVE"
need "· Pokritost = stranke × opomnikStatus (slepe pike = brez datuma)" "R263 legenda append — LIVE"
echo "--- R262/R261/R260/R259/R258/R257/R256/R255 + starejše regresije ---"
need "Izvozi pokritost zaloge in osnutkov kot PDF" "R262 pill aria — LIVE"
need "ZALOGA — OSNUTEK POKRITOST" "R262 PDF glava — LIVE"
need "Izvozi račune po projektih kot PDF" "R261 pill aria"
need "RAČUNI PO PROJEKTIH" "R261 PDF glava"
need "\"Najhitrejši rok\",\"Največji popust\"" "R260 CSV glava (minified)"
need "children:\"najhitrejši rok\"" "R260 žig najhitrejši rok"
need "· CSV nosi segmentacijo (najhitrejši rok · največji popust)" "R260 legenda append"
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
must_miss "to-[#2a3f5f]" "must_miss to-[#2a3f5f]"
must_miss "accent-[#f59e0b]" "must_miss accent-[#f59e0b]"
must_miss "bg-[#f7f9ff]" "must_miss bg-[#f7f9ff]"
echo "NEEDLE FAIL=$FAIL (R266 ×8 pričakovano LIVE; vse ostalo OK)"

echo "=== Z4: temna + err null ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1

echo "=== ZAKLJUČEK: brskalnik zaprt ==="
agent-browser close --all > /dev/null 2>&1
echo "=== R267 PROD QA KONEC ==="
