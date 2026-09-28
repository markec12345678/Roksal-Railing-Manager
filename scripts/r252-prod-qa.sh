#!/bin/bash
# R252 prod QA — recheck R251 deploy (žig 14:49:23.010Z > R251 commit 14:49:06Z, ~17 s).
# JEDRO (worklog R252 točke a-d): spot (MONTER) R251 ŽIVO:
# (a) CRM tab: R250 pilli + legendaR250 ŽIVO + R251 KONDICIONALNA resnica —
#     pill 'Pripravi opomnik kot PDF' ODSOTEN, kadar NOBENA stranka nima opomnika
#     (prod zOpomniki=0 → odsoten = PRAVILNA pogojna resnica; prisoten, če je);
# (b) needleji R251 (12) + R250 (9) v odposlanih čankih + R249/.../R237 regresije;
# (c) prihodki fail-closed pot ŽIVO (MONTER vidi 0 računov → iskren toast);
# (d) cenik/primerjalni fail-closed toasta (obe resnici vsaka svoja).
# Samo bralni pogledi + dialogi odpri/Escape — ZERO-MUTACIJA.
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z0: prod health žig (MORA biti > R251 commit 14:49:06Z) ==="
curl -s --max-time 15 "$PROD/api/public/health"; echo

echo "=== Z1: Domov — fingerprint (brez 8, pod 1) ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); const m=k?k.getAttribute('aria-label').match(/Brez dobavitelja \\((\\d+)\\)/):null; const pod=document.body.textContent.match(/(\\d+)\\s*pod\\b/); return JSON.stringify({brezSt:m?m[1]:null, podSt:pod?pod[1]:null, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z1b: R250 JEDRO (a) — CRM tab: prihodki pill + legendaR250 ŽIVI ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi prihodke kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const pP=document.querySelector('button[aria-label=\"Izvozi prihodke kot PDF\"]'); const cC=document.querySelector('button[aria-label=\"Izvozi račune kot CSV\"]'); const leg=document.body.textContent.includes('CSV = vsi računi (vrstice) · PDF = povzetek za vodstvo · Odprto = izdano, neplačano · Zapadlo = prek roka'); const ps=[pP,cC].every(b=>b&&b.className.includes('press-scale')); const b=document.body.textContent; const m=b.match(/(\\d+)\\s*z opomniki/i); return JSON.stringify({prihodkiPill:!!pP, csvPill:!!cC, obaPS:ps, legendaR250:leg, opomnikPillViden:!!document.querySelector('button[aria-label=\"Pripravi opomnik kot PDF\"]'), zOpomnikiNavedba:m?m[1]:null, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r252-prod-prihodki.png" > /dev/null 2>&1

echo "=== Z1c: R250 fail-closed pot ŽIVO — prihodki klik (MONTER 0 računov) → iskren toast ==="
eb_klik_gumb "Izvozi prihodke kot PDF"
eb_pocakaj_tekst "Ni računov za prihodke" 14
agent-browser eval "(()=>{const t=document.body.textContent; return JSON.stringify({failClosedToast:t.includes('Ni računov za prihodke'), opis:t.includes('PDF se izvozi, ko je vpisan prvi račun.'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r252-prod-prihodki-failclosed.png" > /dev/null 2>&1

echo "=== Z2: R245-R249 regresija — Material/Cene: 4 pilli + legendi ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi primerjalni cenik kot CSV\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const id=(l)=>document.querySelector('button[aria-label=\"'+l+'\"]'); const cC=id('Izvozi cenik materiala kot CSV'); const cP=id('Izvozi cenik materiala kot PDF'); const pC=id('Izvozi primerjalni cenik kot CSV'); const pP=id('Izvozi primerjalni cenik kot PDF'); return JSON.stringify({cenikCsv:!!cC, cenikPdf:!!cP, primCsv:!!pC, primPdf:!!pP, vsePS:[cC,cP,pC,pP].every(b=>b&&b.className.includes('press-scale')), legenda:document.body.textContent.includes('Cenik = vse ponudbe · Primerjalni = najnižja per artikel'), legendaR247Pct:document.body.textContent.includes('% = razpon do najvišje'), legendaR248:document.body.textContent.includes('· Povprečni razpon = vsota razlik / vsota najboljših'), legendaR249:document.body.textContent.includes('· Največji razpon = najširši % med artikli'), err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z2b: primerjalni CSV fail-closed toast (drugačna resnica) ==="
eb_klik_gumb "Izvozi primerjalni cenik kot CSV"
eb_pocakaj_tekst "Ni vpisanih cen za primerjavo" 14
eb_cakaj 1
agent-browser eval "(()=>{const prim=document.body.textContent.includes('Ni vpisanih cen za primerjavo'); const cenik=document.body.textContent.includes('Ni vpisanih cen za izvoz'); return JSON.stringify({primerjalniToast:prim, cenikToastSeNiPoslan:!cenik, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z2c: R244 regresija — cenik fail-closed toast ostaja 'za izvoz' ==="
eb_klik_gumb "Izvozi cenik materiala kot CSV"
eb_pocakaj_tekst "Ni vpisanih cen za izvoz" 14
agent-browser eval "(()=>{const cenik=document.body.textContent.includes('Ni vpisanih cen za izvoz'); const prim=document.body.textContent.includes('Ni vpisanih cen za primerjavo'); return JSON.stringify({cenikToast:cenik, obeResniciViden:cenik&&prim, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z3: R244/R245 regresija — Logistika (termini + oprema) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Termini montaž');})()" 24
sleep 2
agent-browser eval "(()=>{const termin=[...document.querySelectorAll('button')].some(x=>x.textContent.trim().includes('Nov termin montaže')); return JSON.stringify({novTerminOdsoten:!termin, vodicTerminiViden:document.body.textContent.includes('Pregled terminov je samo za branje'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim().startsWith('Oprema')); if(!b) return 'ni subtaba'; const r=b.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; b.dispatchEvent(new PointerEvent('pointerdown',o)); b.dispatchEvent(new PointerEvent('pointerup',o)); b.dispatchEvent(new MouseEvent('click',o)); return 'klik Oprema';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Pregled opreme je samo za branje');})()" 14
sleep 1
agent-browser eval "(()=>{const b=document.body.textContent; const novO=[...document.querySelectorAll('button')].some(x=>x.textContent.trim().includes('Nova oprema')); return JSON.stringify({vodicOpremaViden:b.includes('Pregled opreme je samo za branje'), pravicaVidna:b.includes('production.manage'), novaOpremaOdsotna:!novO, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z4: R242/R243 regresija — Naročila + Zaloga mirror ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const poslji=[...document.querySelectorAll('button')].some(x=>x.textContent.trim().startsWith('Označi kot poslano')); return JSON.stringify({vodicNarocila:document.body.textContent.includes('Pregled naročil je samo za branje'), pisneOdsotne:!poslji, err:window.__err??null});})()" 2>&1 | tail -1
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

echo "=== Z7: needleji R250 + R249-R227 regresije v odposlanih čankih ==="
OUT=/tmp/r252-chunks
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
need " €, odprto " "R250 toast agregat del"
need "računov prek roka" "R250 sklepna vrstica zapadlo resnica"
need "(izključeni iz zneskov)" "R250 sklepna vrstica iskren storno podpis"
echo "--- R249 največji razpon (klient) ---"
need "Največji razpon" "R249 KPI box label"
need "največji razpon " "R249 sklep najširša resnica"
need " %, največji " "R249 toast agregat del"
need "prazen seznam nima največjega razpona" "R249 fail-closed: max prazne množice"
need "max prazne množice ne obstaja" "R249 fail-closed: -Infinity laž poimenovana"
need "· Največji razpon = najširši % med artikli" "R249 legenda"
echo "--- R248 povprečni razpon (klient) ---"
need "Povprečni razpon" "R248 KPI box label"
need " povprečni razpon " "R248 agregatna resnica template"
need " % najboljše cene " "R248 sklep imenovatelj"
need "odstotek od vsote najboljših cen 0 ne obstaja" "R248 fail-closed: odstotek od vsote 0"
need "· Povprečni razpon = vsota razlik / vsota najboljših" "R248 legenda formula"
echo "--- R247 % razlika (klient) ---"
need "% razlike" "R247 % razlike stolpec"
need "razpon izražen tudi v odstotkih najboljše cene" "R247 sklepni podpis % resnica"
need "odstotek od najboljše cene 0 ne obstaja" "R247 fail-closed"
need "· % = razpon do najvišje" "R247 legenda % resnica"
need "z dobaviteljem in razponom v %" "R247 toast + pill title"
echo "--- R246 razponska dimenzija (klient) ---"
need "Najvišja (EUR/enota)" "R246 Najvišja stolpec"
need "Razlika (EUR/enota)" "R246 Razlika stolpec"
need "manjka polje prices" "R246 fail-verbose"
need "brez ujemajoče ponudbe v polju prices" "R246 fail-closed: vrstica brez ponudbe"
need "manjkajoči inventoryId/cena v odgovoru API-ja" "R246 fail-closed: pokvarjena vrstica"
need "vsota razlik do najvišjih veljavnih cen" "R246 KPI Prihranek podpis"
need "Prihranek" "R246 KPI box label"
echo "--- R245 (primerjalni cenik + legenda) ---"
need "Izvozi primerjalni cenik kot CSV" "R245 primerjalni CSV pill aria"
need "Izvozi primerjalni cenik kot PDF" "R245 primerjalni PDF pill aria"
need "Primerjalni-cenik-" "R245 primerjalni filename prefix"
need "Ni vpisanih cen za primerjavo" "R245 fail-closed toast"
need "manjka polje bestPerMaterial" "R245 fail-verbose oblika"
need "PRIMERJALNI CENIK" "R245 PDF glava"
need "najnižja vpisana cena per artikel" "R245 iskren podpis"
need "Cenik = vse ponudbe · Primerjalni = najnižja per artikel" "R245 legenda"
echo "--- R244 regresije (cenik + wave 6 + stil) ---"
need "Izvozi cenik materiala kot CSV" "R244 cenik CSV pill aria"
need "Cenik-materiala-" "R244 cenik filename prefix"
need "Ni vpisanih cen za izvoz" "R244 fail-closed toast"
need "CENIK MATERIALA" "R244 PDF glava"
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
echo "=== R252 PROD QA KONEC ==="
