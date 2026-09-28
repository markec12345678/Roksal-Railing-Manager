#!/bin/bash
# R254 prod QA — recheck R253 deploy (žig 15:48:42.008Z > R253 commit 15:48:22Z, ~20 s).
# JEDRO (worklog R254 točke a-d): spot (MONTER) R253 ŽIVO:
# (a) CRM tab: koledar pill 'Izvozi koledar pregledov kot PDF' ŽIVO (VEDNO
#     viden, P1-k precedens) + legendaR253 ('· Koledar = vsi vpisani pregledi
#     (časovna vrsta)') + press-scale + CalendarDays aria-hidden;
# (b) R253 fail-closed pot ŽIVO — klik → prod 0 vpisanih pregledov → iskren
#     toast 'Ni vpisanih pregledov' (kondicionalna resnica — obe poti
#     dokumentirani; LOKALNI E2E ostaja glavni dokaz uspešne poti);
# (c) R252 regresija — bulk pill poteklih + fail-closed toast;
# (d) prihodki fail-closed pot ŽIVO (MONTER 0 računov);
# (e) needleji R253 (14) + R252 (14) + R251/.../R227 regresije v čankih;
# (f) MONTER 11 od 28.
# Samo bralni pogledi — ZERO-MUTACIJA.
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z0: prod health žig (MORA biti > R253 commit 15:48:22Z) ==="
curl -s --max-time 15 "$PROD/api/public/health"; echo

echo "=== Z1: R253 JEDRO (a) — CRM tab: koledar pill + legendaR253 ŽIVI ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi koledar pregledov kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const kol=document.querySelector('button[aria-label=\"Izvozi koledar pregledov kot PDF\"]'); const bulk=document.querySelector('button[aria-label=\"Izvozi potekle opomnike kot PDF\"]'); const leg253=document.body.textContent.includes('Potekel = prek datuma · Koledar = vsi vpisani pregledi (časovna vrsta)'); const leg252=document.body.textContent.includes('CSV = prikazani seznam · PDF = potekli opomniki (akcija)'); const ps=kol?kol.className.includes('press-scale'):false; const title=kol?kol.getAttribute('title')==='Koledar pregledov kot PDF časovna vrsta (vsi vpisani datumi, najbližji prvi)':false; const ah=kol?!!kol.querySelector('svg[aria-hidden=\"true\"]'):false; return JSON.stringify({koledarPill:!!kol, ps, title, ariaHidden:ah, bulkPill:!!bulk, legenda253:leg253, legenda252:leg252, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r254-prod-koledar.png" > /dev/null 2>&1

echo "=== Z1b: R253 fail-closed pot ŽIVO (b) — klik koledar pill (prod: 0 vpisanih) ==="
eb_klik_gumb "Izvozi koledar pregledov kot PDF"
sleep 3
agent-browser eval "(()=>{const t=document.body.textContent; const failClosed=t.includes('Ni vpisanih pregledov'); const opis=t.includes('PDF se izvozi, ko je vpisan prvi datum pregleda.'); const uspeh=t.includes('Koledar pregledov prenešen v PDF'); return JSON.stringify({failClosedToast:failClosed, opis, uspezenPot:(uspeh||failClosed), kondicionalnaResnica:(uspeh!==failClosed), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r254-prod-koledar-failclosed.png" > /dev/null 2>&1

echo "=== Z2: R252 regresija — bulk pill poteklih + fail-closed pot ŽIVO ==="
eb_klik_gumb "Izvozi potekle opomnike kot PDF"
eb_pocakaj_tekst "Ni poteklih opomnikov" 14
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({failClosedToast:t.includes('Ni poteklih opomnikov'), opis:t.includes('PDF se izvozi, ko opomnik preteče.'), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z3: R250 regresija — prihodki fail-closed pot ŽIVO ==="
eb_klik_gumb "Izvozi prihodke kot PDF"
eb_pocakaj_tekst "Ni računov za prihodke" 14
agent-browser eval "(()=>{const t=document.body.textContent; const leg=t.includes('CSV = vsi računi (vrstice) · PDF = povzetek za vodstvo · Odprto = izdano, neplačano · Zapadlo = prek roka'); return JSON.stringify({failClosedToast:t.includes('Ni računov za prihodke'), legendaR250:leg, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z4: R240 regresija — MONTER 11 od 28 ==="
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

echo "=== Z5: needleji R254/R253 + R252-R227 regresije v odposlanih čankih ==="
OUT=/tmp/r254-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}'
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
echo "--- R253 koledar pregledov PDF (klient) ---"
need "Izvozi koledar pregledov kot PDF" "R253 pill aria"
need "Koledar pregledov kot PDF časovna vrsta (vsi vpisani datumi, najbližji prvi)" "R253 pill title"
need "KOLEDAR PREGLEDOV" "R253 PDF glava"
need "prazen koledar ne nastaja dokumenta" "R253 fail-closed: prazen koledar"
need "koledar je izpeljava iz opomnikStatus" "R253 fail-closed: NI vnos"
need "Potekel = prek datuma · Koledar = vsi vpisani pregledi (časovna vrsta)" "R253 legenda"
need "Koledar pregledov prenešen v PDF" "R253 toast title"
need "Ni vpisanih pregledov" "R253 fail-closed toast"
need "PDF se izvozi, ko je vpisan prvi datum pregleda." "R253 fail-closed toast opis"
need "Koledar-pregledov-" "R253 filename prefix"
need "koledarski red (najbližji pregled prvi)" "R253 sklepni podpis"
need "V tem tednu" "R253 KPI label"
need "\"Status\",\"Dni do\",\"Opis\"" "R253 tabela 7 stolpcev"
echo "--- R252 potekli opomniki PDF (klient) ---"
need "Izvozi potekle opomnike kot PDF" "R252 bulk pill aria"
need "Potekli opomniki kot akcijski PDF seznam za pisarno" "R252 pill title"
need "POTEKLI OPOMNIKI" "R252 PDF glava"
need "CSV = prikazani seznam · PDF = potekli opomniki (akcija) · Potekel = prek datuma" "R252 legenda"
need "Potekli opomniki prenešeni v PDF" "R252 toast title"
need "Ni poteklih opomnikov" "R252 fail-closed toast"
need "Potekli-opomniki-" "R252 filename prefix"
need "akcijski seznam za pisarno (najstarejši prvi)" "R252 sklepni podpis"
need "vir = opomnikStatus iz CRM" "R252 sklep vir resnica"
need "Najstarejši (dni)" "R252 KPI label"
need "Akcija za pisarno" "R252 sekcija"
echo "--- R251 opomnik PDF (klient) ---"
need "Pripravi opomnik kot PDF" "R251 opomnik pill aria"
need "Terenski list za ponovni kontakt kot pravi PDF" "R251 pill title"
need "OPOMNIK" "R251 opomnik PDF glava"
need "opomnik brez datuma ne nastaja dokumenta" "R251 fail-closed: brez datuma"
need "PDF = terenski list za obisk · Potekel = prek datuma" "R251 legenda"
need "Opomnik prenešen v PDF" "R251 toast title"
need "Opomnik ni nastavljen" "R251 fail-closed toast"
need "Opomnik-" "R251 filename prefix"
need "Datum opomnika" "R251 KPI label"
echo "--- R250 prihodki PDF (klient) ---"
need "Izvozi prihodke kot PDF" "R250 prihodki pill aria"
need "PRIHODKI" "R250 prihodki PDF glava"
need "prazen seznam ne nastaja dokumenta" "R250 fail-closed: prazen seznam"
need "· Odprto = izdano, neplačano · Zapadlo = prek roka" "R250 legenda"
need "Prihodki prenešeni v PDF" "R250 toast title"
echo "--- R249/R248/R247/R246/R245/R244 (klient) ---"
need "Največji razpon" "R249 KPI box label"
need "· Največji razpon = najširši % med artikli" "R249 legenda"
need "Povprečni razpon" "R248 KPI box label"
need "% razlike" "R247 % razlike stolpec"
need "Najvišja (EUR/enota)" "R246 Najvišja stolpec"
need "Prihranek" "R246 KPI box label"
need "Izvozi primerjalni cenik kot CSV" "R245 primerjalni CSV pill aria"
need "Ni vpisanih cen za primerjavo" "R245 fail-closed toast"
need "CENIK MATERIALA" "R244 PDF glava"
need "Ni vpisanih cen za izvoz" "R244 fail-closed toast"
echo "--- R243/R242/R240/R238/R237/R227 regresije ---"
need "Pregled zaloge je samo za branje" "R243 vodič premikov"
need "inventory.write" "R243 pravica 1"
need "procurement.create" "R243 pravica 2"
need "Pregled naročil je samo za branje" "R242 vodič"
need "Moja vloga in dovoljenja" "R240 meni + dialog"
need "Izvozi prodajno ploščo kot CSV" "R238 CSV aria"
need "Ni projektov na plošči za izvoz" "R238 fail-closed toast"
need "Prenesi naročilnico vidnih artiklov kot PDF" "R237 Osnutek PDF pill"
need "Brez dobavitelja (" "R227 žig aria"
need "text-2xs" "P1-e žeton 2xs"
echo "NEEDLE FAIL=$FAIL"

echo "=== Z6: temna + err null + health ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
curl -s --max-time 10 "$PROD/api/public/health"; echo

echo "=== ZAKLJUČEK: brskalnik zaprt ==="
agent-browser close --all > /dev/null 2>&1
echo "=== R254 PROD QA KONEC ==="
