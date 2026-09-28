#!/bin/bash
# R243 prod QA — deploy ŽIVO (žig 07:14:07Z > R242 commit 07:13:49Z = ~18 s).
# JEDRO: (Z2) R242 RBAC ogledalo Naročil ŽIVO za spot (MONTER, read-only):
# vodič 'Pregled naročil je samo za branje' VIDEN + procurement.approve/receive
# imeni + CSV viden s press-scale + vodič role=note aria; (Z3) R241 Računi
# regresija; (Z4) R240 'Moja vloga' dialog (MONTER 11 od 28 — fingerprint);
# (Z5) R239 Nov projekt odsoten; (Z6) R238 plošča fail-closed 0; (Z7) needleji
# R242/R241/R240/R238 v odposlanih čankih; (Z8) R237 Osnutek PDF %PDF (dolžina
# = glifni razred trenutne minute — LEGITIMNO vsak razred); (Z9) geselni
# žetoni + temna + err null + health. Samo bralni pogledi + dialogi odpri/
# Escape — ZERO-MUTACIJA.
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z0: prod health žig (MORA biti > R242 commit 07:13:49Z) ==="
curl -s --max-time 15 "$PROD/api/public/health"; echo

echo "=== Z1: Domov — fingerprint (brez 8, pod 1, na 0) + R239 ogledalo ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const k=document.querySelector('button[aria-label^=\"Brez dobavitelja (\"]'); const m=k?k.getAttribute('aria-label').match(/Brez dobavitelja \((\d+)\)/):null; const pod=document.body.textContent.match(/(\d+)\s*pod)?/); const zam=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')); const np=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Nov projekt')); return JSON.stringify({brezSt:m?m[1]:null, zamujenaOdsotna:!zam, novProjektOdsoten:!np, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r243-prod-domov.png" > /dev/null 2>&1

echo "=== Z2: R242 JEDRO — Naročila tab za MONTER: vodič VIDEN + imena pravic + CSV press-scale ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]');})()" 24
sleep 2
agent-browser eval "(()=>{const csv=document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]'); const b=document.body.textContent; const vodic=b.includes('Pregled naročil je samo za branje'); const noteEl=[...document.querySelectorAll('[role=\"note\"]')].some(n=>(n.getAttribute('aria-label')||'').includes('Naročila so za branje')); const imena=vodic&&b.includes('procurement.approve')&&b.includes('procurement.receive'); const ps=csv?csv.className.includes('press-scale'):false; const poslji=[...document.querySelectorAll('button')].some(x=>x.textContent.trim().startsWith('Označi kot poslano')); const potrdi=[...document.querySelectorAll('button')].some(x=>x.textContent.trim()==='Potrdi'); const dobljeno=[...document.querySelectorAll('button')].some(x=>x.textContent.trim().startsWith('Dobljeno')); const preklici=[...document.querySelectorAll('button')].some(x=>x.textContent.trim().startsWith('Prekliči naročilo')); return JSON.stringify({csvViden:!!csv, vodicViden:vodic, vodicImena:imena, noteAria:noteEl, pressScale:ps, pisneAkcije:{poslji, potrdi, dobljeno, preklici}, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r243-prod-narocila-monter.png" > /dev/null 2>&1

echo "=== Z3: R241 regresija — Računi ogledalo (Nov račun odsoten + vodič) ==="
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('(FURS)');})()" 24
sleep 2
agent-browser eval "(()=>{const nov=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Nov račun')); const vodic=document.body.textContent.includes('Pregled računov je samo za branje'); const csv=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Izvozi račune kot CSV'); return JSON.stringify({novRacunOdsoten:!nov, vodicViden:vodic, csvViden:!!csv, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r243-prod-racuni.png" > /dev/null 2>&1

echo "=== Z4: R240 — 'Moja vloga in dovoljenja' dialog (fingerprint: MONTER 11 od 28) ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{const t=document.querySelector('button[aria-label=\"Odjava\"]'); if(!t) return 'ni trigra'; const r=t.getBoundingClientRect(); const o={bubbles:true,cancelable:true,view:window,clientX:r.x+r.width/2,clientY:r.y+r.height/2,button:0}; t.dispatchEvent(new PointerEvent('pointerdown',o)); t.dispatchEvent(new PointerEvent('pointerup',o)); t.dispatchEvent(new MouseEvent('click',o)); return 'meni poslan';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('[role=\"menuitem\"]')].some(x=>x.textContent.includes('Moja vloga in dovoljenja'));})()" 10
agent-browser eval "(()=>{const mi=[...document.querySelectorAll('[role=\"menuitem\"]')].find(x=>x.textContent.includes('Moja vloga in dovoljenja')); if(!mi) return 'ni menuitema'; const opt={bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true,buttons:1,button:0}; mi.dispatchEvent(new PointerEvent('pointermove',opt)); mi.dispatchEvent(new PointerEvent('pointerdown',opt)); mi.dispatchEvent(new PointerEvent('pointerup',opt)); mi.dispatchEvent(new MouseEvent('click',opt)); return 'kliknjeno';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{const d=document.body.textContent; return d.includes('Moja vloga in dovoljenja') && d.includes('od 28 dovoljenj');})()" 14
sleep 1
agent-browser eval "(()=>{const dialog=document.querySelector('[role=\"dialog\"]'); if(!dialog) return JSON.stringify({dialog:false, err:window.__err??null}); const vsebina=dialog.textContent; const povzetek=vsebina.match(/Imate (\d+) od (\d+) dovoljenj/); let vloga='NEZNANA'; for (const [chip,ime] of [['Admin','ADMIN'],['Vodja','VODJA'],['Monter','MONTER'],['Skladišče','SKLADISCE']]) { if (vsebina.includes(chip)) { vloga=ime; break; } } return JSON.stringify({dialog:true, vloga, povzetek:povzetek?[povzetek[1],povzetek[2]]:null, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r243-prod-vloga.png" > /dev/null 2>&1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
eb_cakaj 1

echo "=== Z5: R238 — prodajna plošča CSV fail-closed (0 projektov) ==="
eb_csv_capture csvP
eb_csv_reset csvP
eb_klik_gumb "Izvozi prodajno ploščo kot CSV"
eb_cakaj 2
agent-browser eval "(()=>{const csvP=window.__csvP; if(typeof csvP!=='string'||csvP.length===0){ const fail=document.body.textContent.includes('Ni projektov na plošči za izvoz'); return JSON.stringify({csvNastal:false, failClosedToastPri0:fail, err:window.__err??null}); } return JSON.stringify({csvNastal:true, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z6: needleji R242/R241/R240/R238 v odposlanih čankih ==="
OUT=/tmp/r243-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}'
sleep 3
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
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
echo "--- R242 (RBAC ogledalo Naročil + press-scale pariteta) ---"
need "Pregled naročil je samo za branje" "R242 vlogo-osveščen vodič"
need "procurement.approve" "R242 ime pravice 1 v klientu"
need "procurement.receive" "R242 ime pravice 2 v klientu"
need "Naročila so za branje — upravljanje zahteva pravice" "R242 vodič aria-label (role=note)"
need "w-full bg-roksal-navy text-white shadow-sm press-scale" "R242 Nov dobavitelj CTA mikro-pritisk"
need "h-8 text-xs press-scale" "R242 izvozne pilule mikro-pritisk"
need "h-6 gap-1 text-2xs press-scale" "R242 dobavitelji PDF pilula mikro-pritisk"
echo "--- R241/R240/R238 regresije ---"
need "Pregled računov je samo za branje" "R241 vlogo-osveščen vodič"
need "Moja vloga in dovoljenja" "R240 meni item + dialog naslov"
need "Branje projektov" "R240 katalog label v klientu"
need "Izvozi prodajno ploščo kot CSV" "R238 CSV gumb aria"
need "Ni projektov na plošči za izvoz" "R238 fail-closed toast"
need "text-2xs" "P1-e žeton 2xs"
echo "NEEDLE FAIL=$FAIL"

echo "=== Z7: R237 regresija — Osnutek dialog PDF pill + %PDF (glifni razclass zapis) ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Shrani naročilnico vidnih artiklov kot osnutek naročila\"]');})()" 24
eb_klik_gumb "Shrani naročilnico vidnih artiklov kot osnutek naročila"
eb_pocakaj_na "(()=>{const p=document.querySelector('button[aria-label=\"Prenesi naročilnico vidnih artiklov kot PDF\"]'); return !!p && !p.disabled;})()" 14
sleep 1
eb_zajem_pdf pdf
eb_csv_reset pdf
eb_klik_gumb "Prenesi naročilnico vidnih artiklov kot PDF"
eb_pocakaj_tekst "Osnutek prenesen v PDF" 14
eb_pocakaj_na "(()=>{return typeof window.__pdf==='string'&&window.__pdf.length>0;})()" 14
agent-browser eval "(()=>{const b64=window.__pdf; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); return JSON.stringify({pdf:true, magic:[bin.charCodeAt(0),bin.charCodeAt(1),bin.charCodeAt(2),bin.charCodeAt(3),bin.charCodeAt(4)].join(','), bajtov:bin.length, razred:' legitimno katerikoli od 30057/30119/30191/30253 (glifni subset žiga)', err:window.__err??null});})()" 2>&1 | tail -1
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
agent-browser screenshot "$SS/qa-r243-prod-temna.png" > /dev/null 2>&1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
curl -s --max-time 10 "$PROD/api/public/health"; echo

echo "=== ZAKLJUČEK: brskalnik zaprt ==="
agent-browser close --all > /dev/null 2>&1
echo "=== R243 PROD QA KONEC ==="
