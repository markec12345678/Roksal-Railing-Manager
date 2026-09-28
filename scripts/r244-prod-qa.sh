#!/bin/bash
# R244 prod QA — recheck R243 deploy (žig MORA biti > R243 commit 08:05:56Z).
# JEDRO (worklog R243 ⚠️ točke a-d): spot (MONTER) wave 5 ogledalo ŽIVO:
# (a) Zaloga: 'Dodaj gibanje zaloge' ODSOTEN + vodič VIDEN (inventory.write);
# (b) Osnutek dialog: 'Shrani osnutek' ODSOTEN + vodič VIDEN (procurement.create)
#     + CSV/PDF ŠE VEDNO VIDNA (bralni tok ohranjen — P1-k);
# (c) Dobavitelji: 'Nov dobavitelj' ODSOTEN + vodič VIDEN (catalog.manage);
# (d) Cene: select ODSOTEN + vodič VIDEN (price.override).
# Regresije: R242 Naročila ogledalo, R241 Računi, R240 vloga (MONTER 11/28),
# R238 plošča CSV fail-closed (CRM tab! — r243 lekcija), R237 Osnutek PDF
# (glifni razred: vsak od 30057/30119/30191/30253 LEGITIMEN), temna, žetoni,
# err null. Samo bralni pogledi + dialogi odpri/Escape — ZERO-MUTACIJA.
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z0: prod health žig (MORA biti > R243 commit 08:05:56Z) ==="
curl -s --max-time 15 "$PROD/api/public/health"; echo

echo "=== Z1: Domov — fingerprint (brez 8, pod 1) + R239 ogledalo (Nov projekt ODSOTEN za MONTER) ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); const m=k?k.getAttribute('aria-label').match(/Brez dobavitelja \((\d+)\)/):null; const pod=document.body.textContent.match(/(\d+)\s*pod\b/); const zam=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')); const np=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Nov projekt')); return JSON.stringify({brezSt:m?m[1]:null, podSt:pod?pod[1]:null, zamujenaOdsotna:!zam, novProjektOdsoten:!np, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r244-prod-domov.png" > /dev/null 2>&1

echo "=== Z2a: R243 JEDRO (a) — Zaloga za MONTER: 'Dodaj gibanje zaloge' ODSOTEN + vodič VIDEN (inventory.write) ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Shrani naročilnico vidnih artiklov kot osnutek naročila\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const gumb=[...document.querySelectorAll('button')].some(x=>(x.getAttribute('aria-label')||'')==='Dodaj gibanje zaloge'); const b=document.body.textContent; const vodic=b.includes('Pregled zaloge je samo za branje'); const pravica=b.includes('inventory.write'); const noteEl=[...document.querySelectorAll('[role=\"note\"]')].some(n=>(n.getAttribute('aria-label')||'').includes('Premiki zaloge so za branje')); return JSON.stringify({dodajGibanjeOdsoten:!gumb, vodicViden:vodic, pravicaVidna:pravica, noteAria:noteEl, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r244-prod-zaloga-monter.png" > /dev/null 2>&1

echo "=== Z2b: R243 JEDRO (b) — Osnutek dialog za MONTER: 'Shrani osnutek' ODSOTEN + vodič VIDEN + CSV/PDF VIDNA ==="
eb_klik_gumb "Shrani naročilnico vidnih artiklov kot osnutek naročila"
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Prenesi naročilnico vidnih artiklov kot PDF\"]');})()" 14
sleep 1
agent-browser eval "(()=>{const dlg=document.querySelector('[role=\"dialog\"]'); if(!dlg) return JSON.stringify({dialog:false, err:window.__err??null}); const shrani=[...dlg.querySelectorAll('button')].some(x=>x.textContent.trim()==='Shrani osnutek'); const vodic=dlg.textContent.includes('Shranjevanje osnutka naročila je pravica'); const pravica=dlg.textContent.includes('procurement.create'); const csv=!!dlg.querySelector('button[aria-label=\"Prenesi naročilnico vidnih artiklov kot CSV\"]'); const pdf=!!dlg.querySelector('button[aria-label=\"Prenesi naročilnico vidnih artiklov kot PDF\"]'); const noteEl=[...dlg.querySelectorAll('[role=\"note\"]')].some(n=>(n.getAttribute('aria-label')||'').includes('Shranjevanje osnutka naročila zahteva pravico')); return JSON.stringify({dialog:true, shraniOsnutekOdsoten:!shrani, vodicViden:vodic, pravicaVidna:pravica, noteAria:noteEl, csvViden:!!csv, pdfViden:!!pdf, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r244-prod-osnutek-monter.png" > /dev/null 2>&1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
eb_cakaj 1

echo "=== Z2c: R243 JEDRO (c) — Dobavitelji za MONTER: 'Nov dobavitelj' ODSOTEN + vodič VIDEN (catalog.manage) ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi dobavitelje kot PDF\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const cta=[...document.querySelectorAll('button')].some(x=>x.textContent.trim().includes('Nov dobavitelj')); const b=document.body.textContent; const vodic=b.includes('Pregled dobaviteljev je samo za branje'); const pravica=b.includes('catalog.manage'); const noteEl=[...document.querySelectorAll('[role=\"note\"]')].some(n=>(n.getAttribute('aria-label')||'').includes('Dobavitelji so za branje')); return JSON.stringify({novDobaviteljOdsoten:!cta, vodicViden:vodic, pravicaVidna:pravica, noteAria:noteEl, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r244-prod-dobavitelji-monter.png" > /dev/null 2>&1

echo "=== Z2d: R243 JEDRO (d) — Cene materiala za MONTER: select ODSOTEN + vodič VIDEN (price.override) ==="
agent-browser eval "(()=>{const sel=[...document.querySelectorAll('button')].some(x=>x.textContent.includes('Izberi material')); const b=document.body.textContent; const vodic=b.includes('Pregled cen ostaja pri artiklih'); const pravica=b.includes('price.override'); const noteEl=[...document.querySelectorAll('[role=\"note\"]')].some(n=>(n.getAttribute('aria-label')||'').includes('Vpisi cen zahtevajo pravico')); return JSON.stringify({selectOdsoten:!sel, vodicViden:vodic, pravicaVidna:pravica, noteAria:noteEl, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r244-prod-cene-monter.png" > /dev/null 2>&1

echo "=== Z2e: R242 regresija — Naročila ogledalo za MONTER (vodič + 4 pisalne ODSOTNE + CSV) ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const csv=document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]'); const b=document.body.textContent; const vodic=b.includes('Pregled naročil je samo za branje'); const noteEl=[...document.querySelectorAll('[role=\"note\"]')].some(n=>(n.getAttribute('aria-label')||'').includes('Naročila so za branje')); const imena=vodic&&b.includes('procurement.approve')&&b.includes('procurement.receive'); const ps=csv?csv.className.includes('press-scale'):false; const poslji=[...document.querySelectorAll('button')].some(x=>x.textContent.trim().startsWith('Označi kot poslano')); const potrdi=[...document.querySelectorAll('button')].some(x=>x.textContent.trim()==='Potrdi'); const dobljeno=[...document.querySelectorAll('button')].some(x=>x.textContent.trim().startsWith('Dobljeno')); const preklici=[...document.querySelectorAll('button')].some(x=>x.textContent.trim().startsWith('Prekliči naročilo')); return JSON.stringify({csvViden:!!csv, vodicViden:vodic, noteAria:noteEl, vodicImena:imena, pressScale:ps, pisneAkcijeOdsotne:{poslji:!poslji, potrdi:!potrdi, dobljeno:!dobljeno, preklici:!preklici}, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r244-prod-narocila-monter.png" > /dev/null 2>&1

echo "=== Z3: R241 regresija — Računi ogledalo (Nov račun odsoten + vodič + CSV) ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('(FURS)');})()" 24
sleep 2
agent-browser eval "(()=>{const nov=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Nov račun')); const vodic=document.body.textContent.includes('Pregled računov je samo za branje'); const csv=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Izvozi račune kot CSV'); return JSON.stringify({novRacunOdsoten:!nov, vodicViden:vodic, csvViden:!!csv, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r244-prod-racuni.png" > /dev/null 2>&1

echo "=== Z4: R240 regresija — 'Moja vloga in dovoljenja' (fingerprint: MONTER 11 od 28) ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{const t=document.querySelector('button[aria-label=\"Odjava\"]'); if(!t) return 'ni trigra'; const r=t.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; t.dispatchEvent(new PointerEvent('pointerdown',o)); t.dispatchEvent(new PointerEvent('pointerup',o)); t.dispatchEvent(new MouseEvent('click',o)); return 'meni poslan';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('[role=\"menuitem\"]')].some(x=>x.textContent.includes('Moja vloga in dovoljenja'));})()" 10
agent-browser eval "(()=>{const mi=[...document.querySelectorAll('[role=\"menuitem\"]')].find(x=>x.textContent.includes('Moja vloga in dovoljenja')); if(!mi) return 'ni menuitema'; const opt={bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true,buttons:1,button:0}; mi.dispatchEvent(new PointerEvent('pointermove',opt)); mi.dispatchEvent(new PointerEvent('pointerdown',opt)); mi.dispatchEvent(new PointerEvent('pointerup',opt)); mi.dispatchEvent(new MouseEvent('click',opt)); return 'kliknjeno';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{const d=document.body.textContent; return d.includes('Moja vloga in dovoljenja') && d.includes('od 28 dovoljenj');})()" 14
sleep 1
agent-browser eval "(()=>{const dialog=document.querySelector('[role=\"dialog\"]'); if(!dialog) return JSON.stringify({dialog:false, err:window.__err??null}); const vsebina=dialog.textContent; const povzetek=vsebina.match(/Imate (\d+) od (\d+) dovoljenj/); let vloga='NEZNANA'; for (const [chip,ime] of [['Admin','ADMIN'],['Vodja','VODJA'],['Monter','MONTER'],['Skladišče','SKLADISCE']]) { if (vsebina.includes(chip)) { vloga=ime; break; } } return JSON.stringify({dialog:true, vloga, povzetek:povzetek?[povzetek[1],povzetek[2]]:null, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r244-prod-vloga.png" > /dev/null 2>&1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
eb_cakaj 1

echo "=== Z5: R238 regresija — prodajna plošča CSV fail-closed (CRM TAB! — r243 lekcija) ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('(FURS)');})()" 24
sleep 2
eb_klik_gumb "Izvozi prodajno ploščo kot CSV"
eb_pocakaj_tekst "Ni projektov na plošči za izvoz" 12
agent-browser eval "(()=>{const fail=document.body.textContent.includes('Ni projektov na plošči za izvoz'); return JSON.stringify({failClosedToastPri0:fail, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z6: needleji R243 (13) + R242/R241/R240/R238 regresije v odposlanih čankih ==="
OUT=/tmp/r244-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}'
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
echo "--- R243 (wave 5: vodiči + pravice + press-scale CTA) ---"
need "Premiki zaloge so za branje — beleženje zahteva pravico" "R243 vodič premikov aria (role=note)"
need "Pregled zaloge je samo za branje" "R243 vodič premikov besedilo"
need "inventory.write" "R243 ime pravice 1 v klientu"
need "Shranjevanje osnutka naročila zahteva pravico" "R243 vodič Osnutka aria (role=note)"
need "Shranjevanje osnutka naročila je pravica" "R243 vodič Osnutka besedilo"
need "procurement.create" "R243 ime pravice 2 v klientu"
need "Dobavitelji so za branje — urejanje zahteva pravico" "R243 vodič dobaviteljev aria (role=note)"
need "Pregled dobaviteljev je samo za branje" "R243 vodič dobaviteljev besedilo"
need "catalog.manage" "R243 ime pravice 3 v klientu"
need "Vpisi cen zahtevajo pravico" "R243 vodič cen aria (role=note)"
need "price.override" "R243 ime pravice 4 v klientu"
need "bg-roksal-amber hover:bg-roksal-amber/90 text-roksal-navy shadow-sm focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-1 press-scale" "R243 Potrdi premik CTA mikro-pritisk"
need "w-full bg-roksal-navy text-white press-scale" "R243 dialog Shrani/Shrani ceno mikro-pritisk"
echo "--- R242/R241/R240/R238 regresije ---"
need "Pregled naročil je samo za branje" "R242 vlogo-osveščen vodič"
need "Naročila so za branje — upravljanje zahteva pravice" "R242 vodič aria-label (role=note)"
need "Pregled računov je samo za branje" "R241 vlogo-osveščen vodič"
need "Moja vloga in dovoljenja" "R240 meni item + dialog naslov"
need "Branje projektov" "R240 katalog label v klientu"
need "Izvozi prodajno ploščo kot CSV" "R238 CSV gumb aria"
need "Ni projektov na plošči za izvoz" "R238 fail-closed toast"
need "text-2xs" "P1-e žeton 2xs"
echo "NEEDLE FAIL=$FAIL"

echo "=== Z7: R237 regresija — Osnutek PDF (glifni razred: vsak od 30057/30119/30191/30253 LEGITIMEN) ==="
# r244 lekcija: openOsnutekDialog() ima fail-closed guard (podMin.length===0 →
# toast, dialog se NE odpre) — klik TAKOJ po dispaču lahko pade v prazno zalogo
# (podatki se še nalagajo). Rešitev: retry zanka ×3 (klik → čakaj dialog →
# ponovi), dovolj dolgo, da je zaloga naložena.
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Shrani naročilnico vidnih artiklov kot osnutek naročila\"]');})()" 24
sleep 4
OSN_OK=0
for poskus in 1 2 3; do
  eb_klik_gumb "Shrani naročilnico vidnih artiklov kot osnutek naročila"
  if eb_pocakaj_na "(()=>{const p=document.querySelector('button[aria-label=\"Prenesi naročilnico vidnih artiklov kot PDF\"]'); return !!p && !p.disabled;})()" 10; then
    OSN_OK=1; echo "  dialog odprt (poskus $poskus)"; break
  fi
  echo "  poskus $poskus: dialog NI odprt (guard prazne zaloge?) — ponovim"
  sleep 5
done
[ "$OSN_OK" = "1" ] || { echo "Z7 FAIL: Osnutek dialog se ni odprl po 3 poskusih"; }
sleep 1
eb_zajem_pdf pdf
eb_csv_reset pdf
eb_klik_gumb "Prenesi naročilnico vidnih artiklov kot PDF"
eb_pocakaj_tekst "Osnutek prenesen v PDF" 14
eb_pocakaj_na "(()=>{return typeof window.__pdf==='string'&&window.__pdf.length>0;})()" 14
agent-browser eval "(()=>{const b64=window.__pdf; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); const bajtov=bin.length; const magic=[bin.charCodeAt(0),bin.charCodeAt(1),bin.charCodeAt(2),bin.charCodeAt(3),bin.charCodeAt(4)].join(','); const razredi=[30057,30119,30191,30253]; const razredOk=razredi.includes(bajtov); return JSON.stringify({pdf:true, magic, bajtov, razredOk, opomba:'glifni subset — vsak od 30057/30119/30191/30253 LEGITIMEN', err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
eb_cakaj 1

echo "=== Z8: geselni žetoni + temna + err null + health ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{const t=document.querySelector('button[aria-label=\"Odjava\"]'); if(!t) return 'ni trigra'; const r=t.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; t.dispatchEvent(new PointerEvent('pointerdown',o)); t.dispatchEvent(new PointerEvent('pointerup',o)); t.dispatchEvent(new MouseEvent('click',o)); return 'meni poslan';})()" 2>&1 | tail -1
sleep 1
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('[role=\"menuitem\"]')].some(x=>x.textContent.includes('Zamenjaj geslo'));})()" 8
agent-browser eval "(()=>{const mi=[...document.querySelectorAll('[role=\"menuitem\"]')].find(x=>x.textContent.includes('Zamenjaj geslo')); if(!mi) return 'ni menuitema'; const opt={bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true,buttons:1,button:0}; mi.dispatchEvent(new PointerEvent('pointermove',opt)); mi.dispatchEvent(new PointerEvent('pointerdown',opt)); mi.dispatchEvent(new PointerEvent('pointerup',opt)); mi.dispatchEvent(new MouseEvent('click',opt)); return 'kliknjeno';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return !!document.querySelector('#pwd-current');})()" 8
sleep 1
agent-browser eval "(()=>{const inp=document.querySelector('#pwd-current'); if(!inp) return JSON.stringify({dialog:false}); const barva=getComputedStyle(inp).borderTopColor; return JSON.stringify({dialog:true, obroba:barva, obrobaNiStone:barva!=='rgb(214, 211, 209)'&&barva!=='rgb(231, 229, 228)', err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
eb_cakaj 1
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r244-prod-temna.png" > /dev/null 2>&1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
curl -s --max-time 10 "$PROD/api/public/health"; echo

echo "=== ZAKLJUČEK: brskalnik zaprt ==="
agent-browser close --all > /dev/null 2>&1
echo "=== R244 PROD QA KONEC ==="
