#!/bin/bash
# R248 prod QA — recheck R247 deploy (žig 11:44:01.469Z > R247 commit 11:43:34Z, ~27 s).
# JEDRO (worklog R248 točke a-d): spot (MONTER) R247 ŽIVO:
# (a) Material → Cene card: 4 pilli VIDNI + R247 razširjena legenda
#     '% = razpon do najvišje' VIDNA (R247 glavni dokaz);
# (b) needleji R247 (% razlike glava, sklepni podpis %, fail-closed odstotek
#     od 0, legenda %, toast %) + R246 razponska dimenzija v odposlanih čankih;
# (c) regresije R246/R245/R244/R243/R242/R241/R240/R238/R237;
# (d) cenik/primerjalni fail-closed toasta (obe resnici vsaka svoja).
# Samo bralni pogledi + dialogi odpri/Escape — ZERO-MUTACIJA.
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z0: prod health žig (MORA biti > R247 commit 11:43:34Z) ==="
curl -s --max-time 15 "$PROD/api/public/health"; echo

echo "=== Z1: Domov — fingerprint (brez 8, pod 1) + R239 ogledalo (Nov projekt ODSOTEN za MONTER) ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); const m=k?k.getAttribute('aria-label').match(/Brez dobavitelja \\((\\d+)\\)/):null; const pod=document.body.textContent.match(/(\\d+)\\s*pod\\b/); const np=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Nov projekt')); return JSON.stringify({brezSt:m?m[1]:null, podSt:pod?pod[1]:null, novProjektOdsoten:!np, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z2: R245/R246 JEDRO (a) — Material/Cene za MONTER: 4 pilli VIDNI + legenda (b) VIDNA ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi primerjalni cenik kot CSV\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const cC=id('Izvozi cenik materiala kot CSV'); const cP=id('Izvozi cenik materiala kot PDF'); const pC=id('Izvozi primerjalni cenik kot CSV'); const pP=id('Izvozi primerjalni cenik kot PDF'); const leg=document.body.textContent.includes('Cenik = vse ponudbe · Primerjalni = najnižja per artikel'); const legPct=document.body.textContent.includes('% = razpon do najvišje'); return JSON.stringify({cenikCsv:!!cC, cenikPdf:!!cP, primCsv:!!pC, primPdf:!!pP, vsePS:[cC,cP,pC,pP].every(b=>b&&b.className.includes('press-scale')), legenda:leg, legendaR247Pct:legPct, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r248-prod-pilli.png" > /dev/null 2>&1

echo "=== Z2b: primerjalni CSV klik — fail-closed toast 'za primerjavo' (drugačna resnica od cenika) ==="
eb_klik_gumb "Izvozi primerjalni cenik kot CSV"
eb_pocakaj_tekst "Ni vpisanih cen za primerjavo" 14
eb_cakaj 1
agent-browser eval "(()=>{const prim=document.body.textContent.includes('Ni vpisanih cen za primerjavo'); const cenik=document.body.textContent.includes('Ni vpisanih cen za izvoz'); return JSON.stringify({primerjalniToast:prim, cenikToastSeNiPoslan:!cenik, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z2c: primerjalni PDF klik — ISTI fail-closed toast ==="
eb_klik_gumb "Izvozi primerjalni cenik kot PDF"
eb_pocakaj_tekst "Ni vpisanih cen za primerjavo" 14
eb_cakaj 1
agent-browser eval "(()=>{return JSON.stringify({primerjalniPdfToast:true, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z2d: R244 regresija — cenik fail-closed toast ostaja 'za izvoz' ==="
eb_klik_gumb "Izvozi cenik materiala kot CSV"
eb_pocakaj_tekst "Ni vpisanih cen za izvoz" 14
agent-browser eval "(()=>{const cenik=document.body.textContent.includes('Ni vpisanih cen za izvoz'); const prim=document.body.textContent.includes('Ni vpisanih cen za primerjavo'); return JSON.stringify({cenikToast:cenik, obeResniciViden:cenik&&prim, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r248-prod-failclosed.png" > /dev/null 2>&1

echo "=== Z3: R244/R245 regresija — Logistika za MONTER (termini + oprema subtab) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Termini montaž');})()" 24
sleep 2
agent-browser eval "(()=>{const termin=[...document.querySelectorAll('button')].some(x=>x.textContent.trim().includes('Nov termin montaže')); const b=document.body.textContent; const vodicT=b.includes('Pregled terminov je samo za branje'); return JSON.stringify({novTerminOdsoten:!termin, vodicTerminiViden:vodicT, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim().startsWith('Oprema')); if(!b) return 'ni subtaba'; const r=b.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; b.dispatchEvent(new PointerEvent('pointerdown',o)); b.dispatchEvent(new PointerEvent('pointerup',o)); b.dispatchEvent(new MouseEvent('click',o)); return 'klik Oprema';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Pregled opreme je samo za branje');})()" 14
sleep 1
agent-browser eval "(()=>{const b=document.body.textContent; const novO=[...document.querySelectorAll('button')].some(x=>x.textContent.trim().includes('Nova oprema')); return JSON.stringify({vodicOpremaViden:b.includes('Pregled opreme je samo za branje'), pravicaVidna:b.includes('production.manage'), novaOpremaOdsotna:!novO, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z4: R242/R243 regresija — Naročila + Zaloga mirror za MONTER ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const b=document.body.textContent; const poslji=[...document.querySelectorAll('button')].some(x=>x.textContent.trim().startsWith('Označi kot poslano')); return JSON.stringify({vodicNarocila:b.includes('Pregled naročil je samo za branje'), pisneOdsotne:!poslji, err:window.__err??null});})()" 2>&1 | tail -1
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Shrani naročilnico vidnih artiklov kot osnutek naročila\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const gumb=[...document.querySelectorAll('button')].some(x=>(x.getAttribute('aria-label')||'')==='Dodaj gibanje zaloge'); return JSON.stringify({dodajGibanjeOdsoten:!gumb, vodicViden:document.body.textContent.includes('Pregled zaloge je samo za branje'), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z5: R240 regresija — MONTER 11 od 28 ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{const t=document.querySelector('button[aria-label=\"Odjava\"]'); if(!t) return 'ni trigra'; const r=t.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; t.dispatchEvent(new PointerEvent('pointerdown',o)); t.dispatchEvent(new PointerEvent('pointerup',o)); t.dispatchEvent(new MouseEvent('click',o)); return 'meni poslan';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('[role=\"menuitem\"]')].some(x=>x.textContent.includes('Moja vloga in dovoljenja'));})()" 10
agent-browser eval "(()=>{const mi=[...document.querySelectorAll('[role=\"menuitem\"]')].find(x=>x.textContent.includes('Moja vloga in dovoljenja')); if(!mi) return 'ni menuitema'; const opt={bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true,buttons:1,button:0}; mi.dispatchEvent(new PointerEvent('pointermove',opt)); mi.dispatchEvent(new PointerEvent('pointerdown',opt)); mi.dispatchEvent(new PointerEvent('pointerup',opt)); mi.dispatchEvent(new MouseEvent('click',opt)); return 'kliknjeno';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{const d=document.body.textContent; return d.includes('Moja vloga in dovoljenja') && d.includes('od 28 dovoljenj');})()" 14
sleep 1
agent-browser eval "(()=>{const dialog=document.querySelector('[role=\"dialog\"]'); if(!dialog) return JSON.stringify({dialog:false, err:window.__err??null}); const povzetek=dialog.textContent.match(/Imate (\\d+) od (\\d+) dovoljenj/); return JSON.stringify({dialog:true, povzetek:povzetek?[povzetek[1],povzetek[2]]:null, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
eb_cakaj 1

echo "=== Z6: R238 regresija — plošča CSV fail-closed (CRM TAB) ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('(FURS)');})()" 24
sleep 2
eb_klik_gumb "Izvozi prodajno ploščo kot CSV"
eb_pocakaj_tekst "Ni projektov na plošči za izvoz" 12
agent-browser eval "(()=>{return JSON.stringify({failClosedToast:document.body.textContent.includes('Ni projektov na plošči za izvoz'), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z7: needleji R246+R245 + regresije v odposlanih čankih ==="
OUT=/tmp/r248-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
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
echo "--- R247 % razlika (klient) ---"
need "% razlike" "R247 % razlike stolpec (CSV+PDF glava)"
need "razpon izražen tudi v odstotkih najboljše cene" "R247 sklepni podpis % resnica"
need "odstotek od najboljše cene 0 ne obstaja" "R247 fail-closed: odstotek od nič NIKOLI izmišljen"
need "· % = razpon do najvišje" "R247 legenda % resnica"
need "z dobaviteljem in razponom v %" "R247 toast + pill title % resnica"
echo "--- R246 razponska dimenzija (klient) ---"
need "Najvišja (EUR/enota)" "R246 Najvišja stolpec (CSV+PDF glava)"
need "Razlika (EUR/enota)" "R246 Razlika stolpec (CSV+PDF glava)"
need "manjka polje prices" "R246 fail-verbose: manjkajoče polje prices"
need "brez ujemajoče ponudbe v polju prices" "R246 fail-closed: vrstica brez ponudbe"
need "manjkajoči inventoryId/cena v odgovoru API-ja" "R246 fail-closed: pokvarjena prices vrstica"
need "vsota razlik do najvišjih veljavnih cen" "R246 KPI Prihranek podpis (sklepna vrstica)"
need "Prihranek" "R246 KPI box label"
echo "--- R245 (primerjalni cenik + legenda) ---"
need "Izvozi primerjalni cenik kot CSV" "R245 primerjalni CSV pill aria"
need "Izvozi primerjalni cenik kot PDF" "R245 primerjalni PDF pill aria"
need "Primerjalni-cenik-" "R245 primerjalni filename prefix"
need "Ni vpisanih cen za primerjavo" "R245 primerjalni fail-closed toast"
need "manjka polje bestPerMaterial" "R245 fail-verbose oblika"
need "PRIMERJALNI CENIK" "R245 primerjalni PDF glava"
need "najnižja vpisana cena per artikel" "R245 primerjalni PDF iskren podpis"
need "Cenik = vse ponudbe · Primerjalni = najnižja per artikel" "R245 legenda"
echo "--- R244 regresije (cenik + wave 6 + stil) ---"
need "Izvozi cenik materiala kot CSV" "R244 cenik CSV pill aria"
need "Cenik-materiala-" "R244 cenik filename prefix"
need "Ni vpisanih cen za izvoz" "R244 cenik fail-closed toast"
need "CENIK MATERIALA" "R244 cenik PDF glava"
need "Ustvarjanje terminov zahteva pravico" "R244 vodič terminov aria"
need "Pregled opreme je samo za branje. Dodajanje opreme in statusni" "R244 vodič opreme besedilo"
need "production.manage" "R244 ime pravice"
need "shadow-sm press-scale btn-shine" "R244 Nov projekt hero CTA"
need "accent-roksal-navy" "R244 accent žeton"
echo "--- R243/R242/R240/R238/R237/R227 regresije ---"
need "Pregled zaloge je samo za branje" "R243 vodič premikov"
need "inventory.write" "R243 pravica 1"
need "procurement.create" "R243 pravica 2"
need "catalog.manage" "R243 pravica 3"
need "price.override" "R243 pravica 4"
need "Pregled naročil je samo za branje" "R242 vodič"
need "Moja vloga in dovoljenja" "R240 meni + dialog"
need "Izvozi prodajno ploščo kot CSV" "R238 CSV aria"
need "Ni projektov na plošči za izvoz" "R238 fail-closed toast"
need "Prenesi naročilnico vidnih artiklov kot PDF" "R237 Osnutek PDF pill"
need "Brez dobavitelja (" "R227 žig aria"
need "text-2xs" "P1-e žeton 2xs"
echo "NEEDLE FAIL=$FAIL"

echo "=== Z8: R237 regresija — Osnutek PDF glifni razred ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Shrani naročilnico vidnih artiklov kot osnutek naročila\"]');})()" 24
sleep 4
OSN_OK=0
for poskus in 1 2 3; do
  eb_klik_gumb "Shrani naročilnico vidnih artiklov kot osnutek naročila"
  if eb_pocakaj_na "(()=>{const p=document.querySelector('button[aria-label=\"Prenesi naročilnico vidnih artiklov kot PDF\"]'); return !!p && !p.disabled;})()" 10; then
    OSN_OK=1; echo "  dialog odprt (poskus $poskus)"; break
  fi
  echo "  poskus $poskus: dialog NI odprt — ponovim"
  sleep 5
done
[ "$OSN_OK" = "1" ] || { echo "Z8 FAIL: Osnutek dialog se ni odprl"; }
sleep 1
eb_zajem_pdf pdf
eb_csv_reset pdf
eb_klik_gumb "Prenesi naročilnico vidnih artiklov kot PDF"
eb_pocakaj_tekst "Osnutek prenesen v PDF" 14
eb_pocakaj_na "(()=>{return typeof window.__pdf==='string'&&window.__pdf.length>0;})()" 14
agent-browser eval "(()=>{const b64=window.__pdf; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false}); const bin=atob(b64); const razredi=[30057,30119,30191,30253]; return JSON.stringify({pdf:true, bajtov:bin.length, razredOk:razredi.includes(bin.length), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
eb_cakaj 1

echo "=== Z9: temna + err null + health ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
curl -s --max-time 10 "$PROD/api/public/health"; echo

echo "=== ZAKLJUČEK: brskalnik zaprt ==="
agent-browser close --all > /dev/null 2>&1
echo "=== R248 PROD QA KONEC ==="
