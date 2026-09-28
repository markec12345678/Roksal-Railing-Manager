#!/bin/bash
# R260 prod QA — DEPLOY OPOMIL! Prod žig 2026-09-28T19:40:53.111Z = 23 s po
# R259 commitu (19:40:30Z) — zgodovinski hitri deploy je nazaj po ESKALACIJI
# (R257/R258/R259: stale R255 build 17:15:09.009Z). Ta runda DOKAŽE, da so
# VSE ŠTIRI generacije (R256 tedenski + R257 naročila + R258 dobičkonosnost +
# R259 dobavitelji nadgradna) ŽIVO na produ + regresije + MONTER 11/28 +
# aria. Samo bralni pogledi — ZERO-MUTACIJA.
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

echo "=== Z0: prod health žig (MORA biti >= 19:40:53Z — R259 build) ==="
curl -s --max-time 15 "$PROD/api/public/health"; echo

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z1: R256 LIVE — tedenski pill (logistics) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi vozni red montaž kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); return JSON.stringify({r255vozPill:!!id('Izvozi vozni red montaž kot PDF'), r256tedPill:!!id('Izvozi tedenski pregled montaž kot PDF'), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z2: R257 LIVE — naročila pill (material/orders) + R259/R260 dobavitelji (material/suppliers) ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi naročila kot PDF\"]');})()" 24
sleep 1
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({r257Pill:!!document.querySelector('button[aria-label=\"Izvozi naročila kot PDF\"]'), legenda257:t.includes('CSV = vrstica per postavka · PDF = vrstica per naročilo'), err:window.__err??null});})()" 2>&1 | tail -1
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi dobavitelje kot PDF\"]');})()" 24
sleep 1
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({r236pdfPill:!!document.querySelector('button[aria-label=\"Izvozi dobavitelje kot PDF\"]'), r233csvPill:!!document.querySelector('button[aria-label=\"Izvozi dobavitelje kot CSV\"]'), legenda259:t.includes('CSV = vrstica per dobavitelj · PDF = arhivski pregled z povprečnim in najhitrejšim dobavnim rokom'), legenda260:t.includes('· CSV nosi segmentacijo (najhitrejši rok · največji popust)'), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z3: MONTER 11/28 + aria (spot) ==="
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

echo "=== Z4: prod čanki — VSE generacije needleji (R256+R257+R258+R259+R260 + regresije) ==="
OUT=/tmp/r260-prod-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
sleep 4
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
echo "--- DEPLOY OPOMIL: R256 tedenski (pričakovano OK — stale je bil MISSED) ---"
need "Izvozi tedenski pregled montaž kot PDF" "R256 pill aria — LIVE DOKAZ"
need "TEDENSKI VOZNI RED MONTAŽ" "R256 PDF glava"
echo "--- R257 naročila (pričakovano OK) ---"
need "Izvozi naročila kot PDF" "R257 pill aria — LIVE DOKAZ"
need "NAROČILA — PREGLED" "R257 PDF glava"
echo "--- R258 dobičkonost (vodja — če MONTER ne naloži vodja čanka, dokumentirano vlogo-omejeno) ---"
need "Izvozi dobičkonosnost projektov kot PDF" "R258 pill aria — LIVE DOKAZ (ali vlogo-omejeno)"
echo "--- R259 dobavitelji nadgradna (pričakovano OK) ---"
need "Povprečni rok" "R259 KPI 4 label"
need "povprečni dobavni rok" "R259 sklep + toast agregat"
need "CSV = vrstica per dobavitelj · PDF = arhivski pregled z povprečnim in najhitrejšim dobavnim rokom" "R259 legenda"
echo "--- R260 CSV segmentacija (NA PROD ŠE NI — commit šele v tej rundi, pričakovano MISS) ---"
need "'Najhitrejši rok', 'Največji popust'" "R260 CSV glava (pričakovano MISS — R260 commit pride TA runda)"
echo "--- R255 zdravje + regresije (pričakovano OK) ---"
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
echo "NEEDLE FAIL=$FAIL (R260 MISS je PRIČAKOVAN — commit šele v tej rundi; R258 če MISS = vlogo-omejeno MONTER, dokumentirano)"

echo "=== Z5: temna + err null + health ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
curl -s --max-time 10 "$PROD/api/public/health"; echo

echo "=== ZAKLJUČEK: brskalnik zaprt ==="
agent-browser close --all > /dev/null 2>&1
echo "=== R260 PROD QA KONEC ==="
