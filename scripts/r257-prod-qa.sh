#!/bin/bash
# R257 prod QA — recheck R256 deploy (žig MORA biti > R256 push ~17:41:20Z).
# ⚠️ OB 18:28Z (46 min po commitu) je prod build žig ŠE VEDNO 17:15:09.009Z
# (R255 deploy) — prek zgodovine ~20 s je to anomalija; ESKALACIJA meja 60 min.
# Ta skripta IZKRCNO poroča realno stanje (R256 tedenski pill ŽIVO ALI NE) —
# brez mutacij (spot MONTER). JEDRO (worklog R257 točke a-e):
# (a) R256 tedenski pill ŽIVO: logistika 'Izvozi tedenski pregled montaž kot PDF'
#     VEDNO viden + press-scale + CalendarRange aria-hidden + legendaR256;
# (b) fail-closed toast 'Ni terminov v naslednjih 7 dneh' (kondicionalna
#     resnica — MONTERjev obseg 0 terminov);
# (c) needleji R256 (15) + R255 (7) + R254/…/R227 regresije — dispatch TEREN
#     taba pred zbiranjem čankov (lekcija R255 #1);
# (d) must_miss to-[#2a3f5f] ostane izginjela;
# (e) MONTER 11/28 + aria ŽIVO.
# Samo bralni pogledi — ZERO-MUTACIJA.
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

echo "=== Z0: prod health žig (MORA biti > R256 commit ~17:41:20Z) ==="
curl -s --max-time 15 "$PROD/api/public/health"; echo

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z1: R256 (a) — tedenski pill ŽIVO: logistika tab ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi vozni red montaž kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const ted=id('Izvozi tedenski pregled montaž kot PDF'); const voz=id('Izvozi vozni red montaž kot PDF'); const ps=ted?ted.className.includes('press-scale'):false; const leg256=document.body.textContent.includes('Tedenski = naslednjih 7 dni (po dnevih)'); const calHidden=ted?!!ted.querySelector('svg[aria-hidden=\"true\"]'):false; return JSON.stringify({r256tedPill:!!ted, r256PS:ps, r256CalHidden:calHidden, r256Legenda:leg256, r255vozPill:!!voz, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r257-prod-tedenski.png" > /dev/null 2>&1

echo "=== Z1b: R256 (b) — tedenski fail-closed pot ŽIVO (prod MONTER: 0 terminov v obsegu) ==="
eb_klik_gumb "Izvozi tedenski pregled montaž kot PDF"
eb_pocakaj_tekst "Ni terminov v naslednjih 7 dneh" 14
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({failClosedToast:t.includes('Ni terminov v naslednjih 7 dneh'), opis:t.includes('Tedenski pregled se izvozi, ko je vpisan termin v prihajajočem tednu.'), kondicionalnaResnica:(!t.includes('Tedenski pregled prenešen v PDF')), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r257-prod-tedenski-failclosed.png" > /dev/null 2>&1

echo "=== Z2: R255/R254/R253/R252/R250 regresije — vozni red + CRM fail-closed poti ŽIVO ==="
eb_klik_gumb "Izvozi vozni red montaž kot PDF"
eb_pocakaj_tekst "Ni vidnih terminov montaže" 14
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({r255:t.includes('Ni vidnih terminov montaže'), legendaR255:t.includes('CSV = prikazani termini · ICS = koledar v telefonu · PDF = vozni red (kronološki)'), err:window.__err??null});})()" 2>&1 | tail -1
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi koledar pregledov kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const vseSvg=[...document.querySelectorAll('svg.lucide')]; const zAria=vseSvg.filter(s=>s.getAttribute('aria-hidden')==='true').length; return JSON.stringify({ariaR254:{lucide:vseSvg.length, zAria, vsePokrite:vseSvg.length===zAria}, legenda253:document.body.textContent.includes('Koledar = vsi vpisani pregledi (časovna vrsta)'), err:window.__err??null});})()" 2>&1 | tail -1
eb_klik_gumb "Izvozi koledar pregledov kot PDF"
eb_pocakaj_tekst "Ni vpisanih pregledov" 14
eb_klik_gumb "Izvozi potekle opomnike kot PDF"
eb_pocakaj_tekst "Ni poteklih opomnikov" 14
eb_klik_gumb "Izvozi prihodke kot PDF"
eb_pocakaj_tekst "Ni računov za prihodke" 14
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({r253:t.includes('Ni vpisanih pregledov'), r252:t.includes('Ni poteklih opomnikov'), r250:t.includes('Ni računov za prihodke'), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z3: R240 regresija — MONTER 11 od 28 (e) ==="
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

echo "=== Z4: needleji R256 + R255 + R254-R227 regresije v odposlanih čankih (c+d) ==="
OUT=/tmp/r257-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
sleep 3
# LEKCIJA R255 #1: žetoni v dynamic-import tabih (teren → accent-roksal-amber) —
# dispatch TEREN taba PRED zbiranjem čankov, sicer lažni MISS (probe artefakt).
eb_dispatch '{"tab":"more","more":"teren","subTab":null,"osnutek":null,"filter":null}'
sleep 4
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
must_miss() {
  if grep -rqF -- "$1" "$OUT" 2>/dev/null; then echo "HIT  : $2  (needle: $1 — MORAL IZGINITI!)"; FAIL=1; else echo "OK   : $2 (izginil)"; fi
}
echo "--- R256 tedenski vozni red (klient) ---"
need "Izvozi tedenski pregled montaž kot PDF" "R256 pill aria"
need "TEDENSKI VOZNI RED MONTAŽ" "R256 PDF glava"
need "Tedenski = naslednjih 7 dni (po dnevih)" "R256 legenda pripona"
need "Ni terminov v naslednjih 7 dneh" "R256 fail-closed toast"
need "Tedenski pregled prenešen v PDF" "R256 toast title"
need "tedenskiDanIme" "R256 weekday fiksni seznam"
need "\"Dni z delom\"" "R256 KPI label (dvojni navedki)"
echo "--- R255 vozni red + F2 navy-soft (klient) ---"
need "Izvozi vozni red montaž kot PDF" "R255 pill aria"
need "VOZNI RED MONTAŽ" "R255 PDF glava"
need "Ni vidnih terminov montaže" "R255 fail-closed toast"
need "Vozni red prenešen v PDF" "R255 toast title"
need "kronološki red (najbližji termin prvi)" "R255 sklep"
need "to-roksal-navy-soft" "R255 F2 navy-soft žeton (d)"
must_miss "to-[#2a3f5f]" "R255 must_miss to-[#2a3f5f] (d)"
echo "--- R254 aria + žetoni (klient) ---"
need "accent-roksal-amber" "R254 accent-roksal-amber žeton"
need "bg-roksal-bg" "R254 bg-roksal-bg žeton"
must_miss "accent-[#f59e0b]" "R254 must_miss accent-[#f59e0b]"
must_miss "bg-[#f7f9ff]" "R254 must_miss bg-[#f7f9ff]"
echo "--- R253/R252/R251/R250/R249/R244 (klient) ---"
need "Izvozi koledar pregledov kot PDF" "R253 pill aria"
need "KOLEDAR PREGLEDOV" "R253 PDF glava"
need "Ni vpisanih pregledov" "R253 fail-closed toast"
need "Koledar pregledov prenešen v PDF" "R253 toast title"
need "Izvozi potekle opomnike kot PDF" "R252 bulk pill aria"
need "Ni poteklih opomnikov" "R252 fail-closed toast"
need "Pripravi opomnik kot PDF" "R251 pill aria"
need "Izvozi prihodke kot PDF" "R250 pill aria"
need "Ni računov za prihodke" "R250 fail-closed toast"
need "Največji razpon" "R249 KPI box label"
need "CENIK MATERIALA" "R244 PDF glava"
echo "--- R243/R242/R240/R238/R237/R227 regresije ---"
need "Pregled zaloge je samo za branje" "R243 vodič premikov"
need "Pregled naročil je samo za branje" "R242 vodič"
need "Moja vloga in dovoljenja" "R240 meni + dialog"
need "Izvozi prodajno ploščo kot CSV" "R238 CSV aria"
need "Prenesi naročilnico vidnih artiklov kot PDF" "R237 Osnutek PDF pill"
need "Brez dobavitelja (" "R227 žig aria"
need "text-2xs" "P1-e žeton 2xs"
echo "NEEDLE FAIL=$FAIL"

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
echo "=== R257 PROD QA KONEC ==="
