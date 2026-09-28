#!/bin/bash
# R253 prod QA — recheck R252 deploy (žig 15:13:01.053Z > R252 commit 15:12:38Z, ~23 s).
# JEDRO (worklog R253 točke a-d): spot (MONTER) R252 ŽIVO:
# (a) CRM tab: bulk pill 'Izvozi potekle opomnike kot PDF' ŽIVO (VEDNO viden,
#     P1-k precedens) + legendaR252 ŽIVO + press-scale žetoni;
# (b) R252 fail-closed pot ŽIVO — klik → prod verjetno 0 poteklih → iskren
#     toast 'Ni poteklih opomnikov' (kondicionalna resnica — obe poti
#     dokumentirani: toast fail-closed ALI uspešen PDF; LOKALNI E2E ostaja
#     glavni dokaz uspešne poti, ker prod nima opomnikov);
# (c) needleji R252 (14) + R251 (12) + R250 (9) + R249/.../R227 regresije v
#     odposlanih čankih;
# (d) prihodki fail-closed pot ŽIVO (MONTER 0 računov → iskren toast).
# Samo bralni pogledi + dialogi odpri/Escape — ZERO-MUTACIJA.
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z0: prod health žig (MORA biti > R252 commit 15:12:38Z) ==="
curl -s --max-time 15 "$PROD/api/public/health"; echo

echo "=== Z1: Domov — fingerprint (brez 8, pod 1) ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); const m=k?k.getAttribute('aria-label').match(/Brez dobavitelja \\((\\d+)\\)/):null; const pod=document.body.textContent.match(/(\\d+)\\s*pod\\b/); return JSON.stringify({brezSt:m?m[1]:null, podSt:pod?pod[1]:null, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z1b: R252 JEDRO (a) — CRM tab: bulk pill potekli opomniki + legendaR252 ŽIVI ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi potekle opomnike kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const pP=document.querySelector('button[aria-label=\"Izvozi potekle opomnike kot PDF\"]'); const cC=document.querySelector('button[aria-label=\"Izvozi račune kot CSV\"]'); const pO=document.querySelector('button[aria-label=\"Pripravi opomnik kot PDF\"]'); const priP=document.querySelector('button[aria-label=\"Izvozi prihodke kot PDF\"]'); const leg=document.body.textContent.includes('CSV = prikazani seznam · PDF = potekli opomniki (akcija) · Potekel = prek datuma'); const ps=pP&&pP.className.includes('press-scale'); const title=pP&&pP.getAttribute('title')==='Potekli opomniki kot akcijski PDF seznam za pisarno (najstarejši prvi)'; const b=document.body.textContent; const m=b.match(/(\\d+)\\s*z opomniki/i); const pk=b.match(/\\((\\d+)\\s*poteklo\\)/); return JSON.stringify({potekliPill:!!pP, ps, title, legendaR252:leg, bratje:{csv:!!cC, opomnik:!!pO, prihodki:!!priP}, zOpomnikiNavedba:m?m[1]:null, potekloZapis:pk?pk[1]:null, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r253-prod-potekli-pill.png" > /dev/null 2>&1

echo "=== Z1c: R252 fail-closed pot ŽIVO (b) — klik bulk pill (prod: verjetno 0 poteklih) ==="
eb_klik_gumb "Izvozi potekle opomnike kot PDF"
sleep 3
agent-browser eval "(()=>{const t=document.body.textContent; const failClosed=t.includes('Ni poteklih opomnikov'); const opis=t.includes('PDF se izvozi, ko opomnik preteče.'); const uspeh=t.includes('Potekli opomniki prenešeni v PDF'); return JSON.stringify({failClosedToast:failClosed, opis, uspezenPot:(uspeh||failClosed), kondicionalnaResnica:(uspeh!==failClosed), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r253-prod-potekli-failclosed.png" > /dev/null 2>&1

echo "=== Z2: R250 regresija — prihodki pill + legendaR250 + fail-closed pot ŽIVO ==="
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi prihodke kot PDF\"]');})()" 24
sleep 1
eb_klik_gumb "Izvozi prihodke kot PDF"
eb_pocakaj_tekst "Ni računov za prihodke" 14
agent-browser eval "(()=>{const t=document.body.textContent; const leg=t.includes('CSV = vsi računi (vrstice) · PDF = povzetek za vodstvo · Odprto = izdano, neplačano · Zapadlo = prek roka'); return JSON.stringify({failClosedToast:t.includes('Ni računov za prihodke'), legendaR250:leg, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z3: R244-R249 regresija — Material/Cene: 4 pilli + legendi ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi primerjalni cenik kot CSV\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const cC=id('Izvozi cenik materiala kot CSV'); const cP=id('Izvozi cenik materiala kot PDF'); const pC=id('Izvozi primerjalni cenik kot CSV'); const pP=id('Izvozi primerjalni cenik kot PDF'); return JSON.stringify({vsi:[cC,cP,pC,pP].every(b=>!!b), vsePS:[cC,cP,pC,pP].every(b=>b&&b.className.includes('press-scale')), legendaR245:document.body.textContent.includes('Cenik = vse ponudbe · Primerjalni = najnižja per artikel'), legendaR247Pct:document.body.textContent.includes('% = razpon do najvišje'), legendaR248:document.body.textContent.includes('· Povprečni razpon = vsota razlik / vsota najboljših'), legendaR249:document.body.textContent.includes('· Največji razpon = najširši % med artikli'), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z4: R251 regresija — opomnik pill KONDICIONALNA resnica (prod zOpomniki=0 → ODSOTEN) ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi potekle opomnike kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const pO=document.querySelector('button[aria-label=\"Pripravi opomnik kot PDF\"]'); const b=document.body.textContent; const m=b.match(/(\\d+)\\s*z opomniki/i); return JSON.stringify({opomnikPillPrisoten:!!pO, zOpomniki:m?m[1]:null, err:window.__err??null});})()" 2>&1 | tail -1

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

echo "=== Z6: needleji R252 + R251-R227 regresije v odposlanih čankih ==="
OUT=/tmp/r253-chunks
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
echo "--- R252 potekli opomniki PDF (klient) ---"
need "Izvozi potekle opomnike kot PDF" "R252 bulk pill aria"
need "Potekli opomniki kot akcijski PDF seznam za pisarno" "R252 pill title"
need "POTEKLI OPOMNIKI" "R252 PDF glava"
need "prazen seznam ne nastaja dokumenta" "R252 fail-closed: prazen seznam"
need "seznam je izpeljava iz opomnikStatus" "R252 fail-closed: nepotečen vnos"
need "max prazne množice ne obstaja" "R252 fail-closed: povzetek prazne množice"
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
need "Opomnik PDF ni mogoče sestaviti iz teh podatkov" "R251 TypeError toast"
need "Opomnik-" "R251 filename prefix"
need "terenski list za obisk, odgovornost kontakta ostaja na timu" "R251 sklepni podpis"
need "Datum opomnika" "R251 KPI label"
need "Kontekst sodelovanja" "R251 sekcija konteksta"
echo "--- R250 prihodki PDF (klient) ---"
need "Izvozi prihodke kot PDF" "R250 prihodki pill aria"
need "PRIHODKI" "R250 prihodki PDF glava"
need "prazen seznam ne nastaja dokumenta" "R250 fail-closed: prazen seznam"
need "PLACAN brez placanoAt je inkonzistenca" "R250 fail-closed: statusna inkonzistenca"
need "· Odprto = izdano, neplačano · Zapadlo = prek roka" "R250 legenda"
need "Prihodki prenešeni v PDF" "R250 toast title"
need "računov prek roka" "R250 sklepna vrstica zapadlo resnica"
need "(izključeni iz zneskov)" "R250 sklepna vrstica iskren storno podpis"
echo "--- R249 največji razpon (klient) ---"
need "Največji razpon" "R249 KPI box label"
need " %, največji " "R249 toast agregat del"
need "max prazne množice ne obstaja" "R249 fail-closed: -Infinity laž poimenovana"
need "· Največji razpon = najširši % med artikli" "R249 legenda"
echo "--- R248/R247/R246 (klient) ---"
need "Povprečni razpon" "R248 KPI box label"
need "odstotek od vsote najboljših cen 0 ne obstaja" "R248 fail-closed"
need "% razlike" "R247 % razlike stolpec"
need "odstotek od najboljše cene 0 ne obstaja" "R247 fail-closed"
need "Najvišja (EUR/enota)" "R246 Najvišja stolpec"
need "manjka polje prices" "R246 fail-verbose"
need "Prihranek" "R246 KPI box label"
echo "--- R245/R244 regresije ---"
need "Izvozi primerjalni cenik kot CSV" "R245 primerjalni CSV pill aria"
need "Ni vpisanih cen za primerjavo" "R245 fail-closed toast"
need "PRIMERJALNI CENIK" "R245 PDF glava"
need "Izvozi cenik materiala kot CSV" "R244 cenik CSV pill aria"
need "Ni vpisanih cen za izvoz" "R244 fail-closed toast"
need "CENIK MATERIALA" "R244 PDF glava"
need "shadow-sm press-scale btn-shine" "R244 Nov projekt hero CTA"
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

echo "=== Z7: temna + err null + health ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
curl -s --max-time 10 "$PROD/api/public/health"; echo

echo "=== ZAKLJUČEK: brskalnik zaprt ==="
agent-browser close --all > /dev/null 2>&1
echo "=== R253 PROD QA KONEC ==="
